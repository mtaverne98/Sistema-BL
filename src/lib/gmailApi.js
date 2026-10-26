// ── Gmail API — solo lectura ───────────────────────────────────────────────────
// Scope: gmail.readonly — el sistema nunca envía ni modifica correos.
// Token almacenado en google_tokens con tipo = 'gmail'.

const CLIENT_ID      = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI   = 'https://zzcdkjoetgclbtcuqswr.supabase.co/functions/v1/google-oauth-callback'
const SUPABASE_URL   = 'https://zzcdkjoetgclbtcuqswr.supabase.co'
const SUPABASE_ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY
const REFRESH_EF_URL = `${SUPABASE_URL}/functions/v1/google-token-refresh`
const GMAIL_SCOPE    = 'https://www.googleapis.com/auth/gmail.readonly'
const GMAIL_ROW_ID   = '00000000-0000-0000-0000-000000000003'

// ── URL de autorización ───────────────────────────────────────────────────────
export function getGmailAuthUrl() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         GMAIL_SCOPE,
    access_type:   'offline',
    prompt:        'consent',
    state:         'gmail',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Verificar conexión ────────────────────────────────────────────────────────
export async function checkGmailConnection(supabase) {
  try {
    const { data } = await supabase
      .from('google_tokens')
      .select('refresh_token')
      .eq('id', GMAIL_ROW_ID)
      .maybeSingle()
    return !!data?.refresh_token
  } catch { return false }
}

// ── Info de conexión (email + última sync) ────────────────────────────────────
export async function getGmailConnectionInfo(supabase) {
  try {
    const { data } = await supabase
      .from('google_tokens')
      .select('refresh_token, authorized_email, last_sync_at')
      .eq('id', GMAIL_ROW_ID)
      .maybeSingle()
    return {
      connected:   !!data?.refresh_token,
      email:       data?.authorized_email ?? null,
      lastSyncAt:  data?.last_sync_at ?? null,
    }
  } catch { return { connected: false, email: null, lastSyncAt: null } }
}

// ── Desconectar ───────────────────────────────────────────────────────────────
export async function disconnectGmail(supabase) {
  await supabase.from('google_tokens')
    .update({ access_token: null, refresh_token: null, expires_at: null, authorized_email: null })
    .eq('id', GMAIL_ROW_ID)
}

// ── Token válido ──────────────────────────────────────────────────────────────
export async function getValidGmailToken() {
  const res = await fetch(`${REFRESH_EF_URL}?tipo=gmail`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({}),
  })
  const { access_token, error } = await res.json()
  if (error || !access_token) throw new Error('Gmail token: ' + (error || 'sin token — reconectar Gmail en Configuración'))
  return access_token
}
