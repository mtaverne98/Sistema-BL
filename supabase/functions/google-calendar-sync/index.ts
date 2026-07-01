import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const TOKEN_ROW_ID = '00000000-0000-0000-0000-000000000001'
const GCAL_BASE    = 'https://www.googleapis.com/calendar/v3/calendars'
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

// ── Token helpers ─────────────────────────────────────────────────────────────
async function refreshAccessToken(supabase: ReturnType<typeof createClient>, refreshToken: string) {
  console.log('Refreshing access token...')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  const refreshed = await res.json()
  console.log('Token refresh response:', JSON.stringify({ error: refreshed.error, has_access_token: !!refreshed.access_token }))
  if (refreshed.error) throw new Error(refreshed.error_description || refreshed.error)

  const expiresAt = new Date(Date.now() + ((refreshed.expires_in ?? 3600) - 60) * 1000).toISOString()
  await supabase.from('google_tokens').update({
    access_token: refreshed.access_token,
    expires_at:   expiresAt,
  }).eq('id', TOKEN_ROW_ID)

  return refreshed.access_token as string
}

async function getValidToken(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('id', TOKEN_ROW_ID)
    .single()

  if (error || !data) throw new Error('No hay tokens de Google Calendar guardados')
  console.log('Token row found, expires_at:', data.expires_at, 'has_refresh:', !!data.refresh_token)

  const expired = new Date(data.expires_at) <= new Date()
  if (expired) {
    if (!data.refresh_token) throw new Error('Token expirado y sin refresh_token — reconecta Google Calendar')
    return refreshAccessToken(supabase, data.refresh_token)
  }

  // Return stored token but keep refresh_token available for 401 handling
  return { accessToken: data.access_token as string, refreshToken: data.refresh_token as string }
}

// ── Build GCal event from audiencia ──────────────────────────────────────────
function toGCalEvent(a: Record<string, string>) {
  const tz   = 'America/Santiago'
  const hora = a.hora || '09:00'
  const [h, m] = hora.split(':').map(Number)
  const endMin = h * 60 + m + 90
  const endH   = String(Math.floor(endMin / 60)).padStart(2, '0')
  const endM   = String(endMin % 60).padStart(2, '0')

  const desc = [
    a.causa_rit    ? `RIT: ${a.causa_rit}`     : '',
    a.tribunal     ? `Tribunal: ${a.tribunal}` : '',
    a.sala         ? `Sala: ${a.sala}`         : '',
    a.notas        ? `\nNotas: ${a.notas}`     : '',
  ].filter(Boolean).join('\n')

  return {
    summary:     [a.tipo || 'Audiencia', a.cliente_nombre].filter(Boolean).join(' – '),
    description: desc,
    location:    [a.tribunal, a.sala].filter(Boolean).join(', '),
    start:       { dateTime: `${a.fecha}T${hora}:00`, timeZone: tz },
    end:         { dateTime: `${a.fecha}T${endH}:${endM}:00`, timeZone: tz },
    reminders:   { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const tokenData  = await getValidToken(supabase)
    let accessToken  = typeof tokenData === 'string' ? tokenData : tokenData.accessToken
    const refreshToken = typeof tokenData === 'string' ? null : tokenData.refreshToken

    // Read request body for optional calendar_id override
    let calendarId = 'primary'
    try {
      const body = await req.json()
      if (body?.calendar_id) calendarId = body.calendar_id
    } catch { /* body optional */ }

    const calEnc = encodeURIComponent(calendarId)
    const today  = new Date().toISOString().slice(0, 10)
    console.log('Syncing to calendarId:', calendarId, '| today:', today)

    // Fetch audiencias (future, not suspended)
    const { data: audiencias, error: audErr } = await supabase
      .from('audiencias')
      .select('id, tipo, fecha, hora, tribunal, sala, estado, notas, cliente_nombre, causa_rit, google_event_id')
      .neq('estado', 'Suspendida')
      .gte('fecha', today)

    if (audErr) throw new Error('Error leyendo audiencias: ' + audErr.message)
    console.log('Audiencias to sync:', audiencias?.length ?? 0)

    let created = 0, updated = 0, errors = 0

    for (const a of (audiencias ?? [])) {
      if (!a.fecha) continue
      const eventBody = JSON.stringify(toGCalEvent(a))

      const doRequest = async (token: string, method: string, url: string) => {
        const res = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: eventBody,
        })
        const data = await res.json()
        console.log(`${method} ${url} → status implied by error:`, data.error?.code ?? 'ok')
        return { status: res.status, data }
      }

      try {
        if (a.google_event_id) {
          // Try to update existing event
          let { status, data } = await doRequest(
            accessToken,
            'PUT',
            `${GCAL_BASE}/${calEnc}/events/${a.google_event_id}`
          )

          // 401: token rejected — force refresh and retry once
          if (status === 401 && refreshToken) {
            console.log('Got 401, refreshing token and retrying...')
            accessToken = await refreshAccessToken(supabase, refreshToken)
            ;({ status, data } = await doRequest(
              accessToken,
              'PUT',
              `${GCAL_BASE}/${calEnc}/events/${a.google_event_id}`
            ))
          }

          // 404: event no longer exists in Google Calendar — clear id and create fresh
          if (status === 404) {
            console.log(`Event ${a.google_event_id} not found in GCal, will create new`)
            await supabase.from('audiencias').update({ google_event_id: null }).eq('id', a.id)
            a.google_event_id = null
          } else {
            if (data.error) throw new Error(data.error.message)
            updated++
            continue
          }
        }

        // Create new event
        let { status, data } = await doRequest(
          accessToken,
          'POST',
          `${GCAL_BASE}/${calEnc}/events`
        )

        // 401: force refresh and retry
        if (status === 401 && refreshToken) {
          console.log('Got 401 on create, refreshing token and retrying...')
          accessToken = await refreshAccessToken(supabase, refreshToken)
          ;({ status, data } = await doRequest(
            accessToken,
            'POST',
            `${GCAL_BASE}/${calEnc}/events`
          ))
        }

        if (data.error) throw new Error(data.error.message)
        console.log('Created event id:', data.id, 'for audiencia:', a.id)
        await supabase.from('audiencias')
          .update({ google_event_id: data.id })
          .eq('id', a.id)
        created++

      } catch (e) {
        console.error(`Error syncing audiencia ${a.id}:`, (e as Error).message)
        errors++
      }
    }

    console.log('Sync done — created:', created, 'updated:', updated, 'errors:', errors)
    return json({ ok: true, created, updated, errors, total: (audiencias ?? []).length })
  } catch (e) {
    console.error('Fatal error:', (e as Error).message)
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
