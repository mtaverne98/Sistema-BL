import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GMAIL_ROW_ID  = '00000000-0000-0000-0000-000000000003'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

function decodeB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))
  }
  return btoa(binary)
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const url      = new URL(req.url)
  const inbox_id = url.searchParams.get('inbox_id')
  if (!inbox_id) return json({ error: 'inbox_id requerido' }, 400)

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: inbox } = await sb.from('pjud_inbox')
      .select('gmail_message_id, gmail_attachment_id').eq('id', inbox_id).single()
    if (!inbox?.gmail_message_id || !inbox?.gmail_attachment_id) {
      return json({ error: 'Sin adjunto PDF registrado' }, 404)
    }

    const token  = await getGmailToken(sb)
    const attRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${inbox.gmail_message_id}/attachments/${inbox.gmail_attachment_id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!attRes.ok) return json({ error: `Gmail attachment ${attRes.status}` }, 502)
    const attData = await attRes.json()
    if (!attData.data) return json({ error: 'Adjunto vacío' }, 502)

    const bytes      = decodeB64url(attData.data)
    const pdf_base64 = bytesToBase64(bytes)
    return json({ pdf_base64 })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
