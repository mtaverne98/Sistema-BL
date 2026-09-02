import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID       = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET   = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const TOKEN_ROW_ID    = '00000000-0000-0000-0000-000000000001'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: row } = await sb
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('id', TOKEN_ROW_ID)
      .single()

    if (!row?.refresh_token) return json({ error: 'No refresh token' }, 401)

    // Still valid with 60s buffer → return as-is
    if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) {
      return json({ access_token: row.access_token })
    }

    // Refresh
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: row.refresh_token,
        grant_type:    'refresh_token',
      }),
    })
    const tokens = await resp.json()
    if (tokens.error) return json({ error: tokens.error_description || tokens.error }, 400)

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    await sb.from('google_tokens')
      .update({ access_token: tokens.access_token, expires_at: expiresAt })
      .eq('id', TOKEN_ROW_ID)

    return json({ access_token: tokens.access_token })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
