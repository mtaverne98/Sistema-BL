import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GOOGLE_REDIRECT_URI  = Deno.env.get('GOOGLE_REDIRECT_URI')!
const APP_URL              = Deno.env.get('APP_URL')!

// Single-tenant: fixed token row id
const TOKEN_ROW_ID = '00000000-0000-0000-0000-000000000001'

serve(async (req) => {
  const url   = new URL(req.url)
  const code  = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    const msg = encodeURIComponent(error || 'cancelled')
    return Response.redirect(`${APP_URL}/configuracion?calendar=error&msg=${msg}`, 302)
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.error) {
    const msg = encodeURIComponent(tokens.error_description || tokens.error)
    return Response.redirect(`${APP_URL}/configuracion?calendar=error&msg=${msg}`, 302)
  }

  const expiresAt = new Date(Date.now() + ((tokens.expires_in ?? 3600) - 60) * 1000).toISOString()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { error: dbErr } = await supabase.from('google_tokens').upsert({
    id:            TOKEN_ROW_ID,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at:    expiresAt,
    created_at:    new Date().toISOString(),
  })

  if (dbErr) {
    const msg = encodeURIComponent('Error al guardar tokens: ' + dbErr.message)
    return Response.redirect(`${APP_URL}/configuracion?calendar=error&msg=${msg}`, 302)
  }

  return Response.redirect(`${APP_URL}/configuracion?calendar=connected`, 302)
})
