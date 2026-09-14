// ── Google Drive API ──────────────────────────────────────────────────────────
// Scope: drive.file — solo archivos que la app crea/sube.
// Tokens almacenados en google_tokens con tipo = 'drive' (fila separada de Calendar).

const CLIENT_ID       = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI    = 'https://zzcdkjoetgclbtcuqswr.supabase.co/functions/v1/google-oauth-callback'
const SUPABASE_URL    = 'https://zzcdkjoetgclbtcuqswr.supabase.co'
const SUPABASE_ANON   = import.meta.env.VITE_SUPABASE_ANON_KEY
const REFRESH_EF_URL  = `${SUPABASE_URL}/functions/v1/google-token-refresh`
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_ROW_ID    = '00000000-0000-0000-0000-000000000002'
const SHARED_DRIVE_ID = '1qS_tWyJItFqccW6Ig8MpmvSs2hhQ-_1a'

// ── Auth URL ──────────────────────────────────────────────────────────────────
export function getDriveAuthUrl() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         DRIVE_SCOPE,
    access_type:   'offline',
    prompt:        'consent',
    state:         'drive',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Verificar conexión ────────────────────────────────────────────────────────
export async function checkDriveConnection(supabase) {
  try {
    const { data } = await supabase
      .from('google_tokens')
      .select('refresh_token')
      .eq('id', DRIVE_ROW_ID)
      .maybeSingle()
    return !!data?.refresh_token
  } catch { return false }
}

// ── Desconectar ───────────────────────────────────────────────────────────────
export async function disconnectDrive(supabase) {
  await supabase.from('google_tokens')
    .update({ access_token: null, refresh_token: null, expires_at: null })
    .eq('id', DRIVE_ROW_ID)
}

// ── Obtener token válido ──────────────────────────────────────────────────────
export async function getValidDriveToken() {
  const res = await fetch(`${REFRESH_EF_URL}?tipo=drive`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({}),
  })
  const { access_token, error } = await res.json()
  if (error || !access_token) throw new Error('Drive token: ' + (error || 'sin token — reconectar Drive en Configuración'))
  return access_token
}

// ── Buscar o crear carpeta de la causa en el Shared Drive ─────────────────────
// Estructura: Shared Drive → {cliente_nombre} → Causa RUC {ruc} (o RIT {rit})
// Guarda el folder_id en causa_analisis_meta.drive_folder_id para no buscarlo cada vez.
export async function findOrCreateCausaFolder(token, causa, analisisMeta, supabase) {
  // 1. Si ya tenemos el folder cacheado, usarlo
  if (analisisMeta?.drive_folder_id) return analisisMeta.drive_folder_id

  const driveParams = { supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', driveId: SHARED_DRIVE_ID, corpora: 'drive' }

  async function searchFolder(name, parentId) {
    const parentClause = parentId ? ` and '${parentId}' in parents` : ` and '${SHARED_DRIVE_ID}' in parents`
    const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`
    const qs = new URLSearchParams({ ...driveParams, q, fields: 'files(id,name)' })
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.error) throw new Error('Drive buscar carpeta: ' + data.error.message)
    return data.files?.[0]?.id || null
  }

  async function createFolder(name, parentId) {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents:  [parentId || SHARED_DRIVE_ID],
        driveId:  SHARED_DRIVE_ID,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error('Drive crear carpeta: ' + data.error.message)
    return data.id
  }

  // 2. Carpeta del cliente (primer nivel)
  const clienteNombre = causa.cliente_nombre || 'Sin cliente'
  let clienteFolderId = await searchFolder(clienteNombre, null)
  if (!clienteFolderId) clienteFolderId = await createFolder(clienteNombre, SHARED_DRIVE_ID)

  // 3. Carpeta de la causa (segundo nivel)
  const causaLabel = causa.ruc
    ? `Causa RUC ${causa.ruc}`
    : causa.rit
      ? `Causa RIT ${causa.rit}`
      : `Causa ${causa.id.slice(0, 8)}`
  let causaFolderId = await searchFolder(causaLabel, clienteFolderId)
  if (!causaFolderId) causaFolderId = await createFolder(causaLabel, clienteFolderId)

  // 4. Guardar en DB para no volver a buscar
  await supabase.from('causa_analisis_meta')
    .upsert({ causa_id: causa.id, drive_folder_id: causaFolderId }, { onConflict: 'causa_id' })

  return causaFolderId
}

// ── Subir archivo a Drive ─────────────────────────────────────────────────────
export async function uploadFileToDrive(token, folderId, file) {
  const metadata = {
    name:    file.name,
    parents: [folderId],
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,mimeType,modifiedTime',
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
    }
  )
  const data = await res.json()
  if (data.error) throw new Error('Drive upload: ' + data.error.message)
  return data // { id, name, webViewLink, mimeType, modifiedTime }
}
