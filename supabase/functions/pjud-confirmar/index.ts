import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID       = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET   = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SA_KEY_JSON     = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!
const GMAIL_ROW_ID    = '00000000-0000-0000-0000-000000000003'
const SHARED_DRIVE_ID = '1qS_tWyJItFqccW6Ig8MpmvSs2hhQ-_1a'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ── Helpers ───────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))
  }
  return btoa(binary)
}

function decodeB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

// ── Gmail token ───────────────────────────────────────────────────────────────

async function getGmailToken(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: row } = await sb.from('google_tokens')
    .select('access_token, refresh_token, expires_at').eq('id', GMAIL_ROW_ID).single()
  if (!row?.refresh_token) throw new Error('Gmail no conectado')
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) return row.access_token

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: row.refresh_token, grant_type: 'refresh_token',
    }),
  })
  const t = await res.json()
  if (t.error) throw new Error('Gmail refresh: ' + t.error)
  const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString()
  await sb.from('google_tokens').update({ access_token: t.access_token, expires_at: expiresAt }).eq('id', GMAIL_ROW_ID)
  return t.access_token
}

// ── Service account token (drive write) ──────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getServiceAccountToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)))
  const header  = enc({ alg: 'RS256', typ: 'JWT' })
  const payload = enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })
  const sigInput = `${header}.${payload}`
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput))
  const jwt = `${sigInput}.${b64url(new Uint8Array(sig))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('SA token failed: ' + JSON.stringify(data))
  return data.access_token
}

// ── Drive upload ──────────────────────────────────────────────────────────────

const driveBase    = 'https://www.googleapis.com/drive/v3'
const uploadBase   = 'https://www.googleapis.com/upload/drive/v3'
const sharedParams = `supportsAllDrives=true&includeItemsFromAllDrives=true`

async function uploadFileToDrive(
  token: string,
  filename: string,
  pdfBytes: Uint8Array,
  folderId: string | null,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = 'boundary_' + Math.random().toString(36).slice(2)
  const enc = new TextEncoder()
  const metadata: Record<string, unknown> = { name: filename, mimeType: 'application/pdf' }
  if (folderId) metadata.parents = [folderId]

  const metaPart  = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`)
  const pdfHeader = enc.encode(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`)
  const ending    = enc.encode(`\r\n--${boundary}--`)

  const body = new Uint8Array(metaPart.length + pdfHeader.length + pdfBytes.length + ending.length)
  body.set(metaPart, 0)
  body.set(pdfHeader, metaPart.length)
  body.set(pdfBytes, metaPart.length + pdfHeader.length)
  body.set(ending, metaPart.length + pdfHeader.length + pdfBytes.length)

  const res = await fetch(
    `${uploadBase}/files?uploadType=multipart&${sharedParams}&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    },
  )
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (!data.id) throw new Error('Drive upload sin id: ' + JSON.stringify(data))
  return data
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    const body = await req.json()
    const { inbox_id, nombre_archivo, fecha, folio, tipo_resolucion, tribunal, resumen } = body
    if (!inbox_id) return json({ error: 'inbox_id requerido' }, 400)

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    // Get inbox row
    const { data: inbox, error: inboxErr } = await sb.from('pjud_inbox')
      .select('*, causas(id, rit, ruc, cliente_nombre, cliente_id, drive_folder_id)')
      .eq('id', inbox_id).single()
    if (inboxErr || !inbox) return json({ error: 'inbox no encontrado' }, 404)
    if (!inbox.causa_id) return json({ error: 'Sin causa asignada' }, 400)

    const causa    = inbox.causas
    const filename = nombre_archivo || `${fecha || inbox.fecha}_resolucion_${inbox.rit_detectado || 'sin-rit'}.pdf`

    // Re-download PDF from Gmail
    const gmailToken = await getGmailToken(sb)
    let pdfBytes: Uint8Array | null = null

    if (inbox.gmail_message_id && inbox.gmail_attachment_id) {
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${inbox.gmail_message_id}/attachments/${inbox.gmail_attachment_id}`,
        { headers: { Authorization: `Bearer ${gmailToken}` } },
      )
      if (attRes.ok) {
        const attData = await attRes.json()
        if (attData.data) pdfBytes = decodeB64url(attData.data)
      }
    }

    let driveFileId: string | null = null
    let driveUrl:    string | null = null

    if (pdfBytes) {
      const sa = JSON.parse(SA_KEY_JSON) as Record<string, string>
      const driveToken = await getServiceAccountToken(sa)
      const folderId   = causa?.drive_folder_id ?? null
      const uploaded   = await uploadFileToDrive(driveToken, filename, pdfBytes, folderId)
      driveFileId = uploaded.id
      driveUrl    = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`
    }

    // Insert into pjud
    const pjudPayload = {
      causa_id:       inbox.causa_id,
      causa_rit:      causa?.rit || inbox.rit_detectado || null,
      causa_ruc:      causa?.ruc || inbox.ruc_detectado || null,
      cliente_nombre: causa?.cliente_nombre || '',
      cliente_id:     causa?.cliente_id || null,
      fecha:          fecha || inbox.fecha || new Date().toISOString().slice(0, 10),
      folio:          folio || inbox.folio || null,
      tipo_solicitud: tipo_resolucion || inbox.tipo_resolucion || 'Otro',
      solicitud:      resumen || inbox.resumen_ia || '',
      presenta:       'Tribunal',
      estado:         'Pendiente',
      notas:          tribunal || inbox.tribunal || null,
      tiene_documento: !!driveFileId,
      documento_desc: filename,
      drive_file_id:  driveFileId,
      drive_url:      driveUrl,
    }
    const { data: pjudData, error: pjudErr } = await sb.from('pjud').insert([pjudPayload]).select().single()
    if (pjudErr) throw new Error('Insert pjud: ' + pjudErr.message)

    // Insert into documentos (if uploaded)
    if (driveFileId) {
      await sb.from('documentos').insert([{
        causa_id:     inbox.causa_id,
        nombre:       filename,
        drive_file_id: driveFileId,
        drive_url:    driveUrl,
        fuente:       'gmail_pjud',
        drive_mime:   'application/pdf',
      }])
    }

    // Update pjud_inbox
    await sb.from('pjud_inbox').update({
      estado:         'registrado',
      procesado_at:   new Date().toISOString(),
      drive_file_id:  driveFileId,
      drive_url:      driveUrl,
      nombre_archivo: filename,
      ...(folio          ? { folio }          : {}),
      ...(fecha          ? { fecha }           : {}),
      ...(tipo_resolucion ? { tipo_resolucion } : {}),
      ...(tribunal       ? { tribunal }        : {}),
      ...(resumen        ? { resumen_ia: resumen } : {}),
    }).eq('id', inbox_id)

    return json({ ok: true, pjud_id: pjudData.id, drive_url: driveUrl })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
