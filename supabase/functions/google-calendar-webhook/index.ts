import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const TOKEN_ROW_ID = '00000000-0000-0000-0000-000000000001'
const GCAL_BASE    = 'https://www.googleapis.com/calendar/v3/calendars'

serve(async (req) => {
  // Google sends a POST with X-Goog-Resource-State header
  const resourceState = req.headers.get('X-Goog-Resource-State')

  // Acknowledge sync/exists notifications immediately
  if (resourceState === 'sync' || resourceState === 'exists') {
    return new Response('ok', { status: 200 })
  }

  // Only process 'update' and 'delete' notifications
  if (resourceState !== 'update' && resourceState !== 'delete') {
    return new Response('ok', { status: 200 })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get fresh access token
    const { data: tokenRow } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('id', TOKEN_ROW_ID)
      .single()

    if (!tokenRow) return new Response('no tokens', { status: 200 })

    let accessToken = tokenRow.access_token
    if (new Date(tokenRow.expires_at) <= new Date() && tokenRow.refresh_token) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: tokenRow.refresh_token,
          client_id:     GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type:    'refresh_token',
        }),
      })
      const refreshed = await res.json()
      if (!refreshed.error) {
        accessToken = refreshed.access_token
        const expiresAt = new Date(Date.now() + ((refreshed.expires_in ?? 3600) - 60) * 1000).toISOString()
        await supabase.from('google_tokens').update({ access_token: accessToken, expires_at: expiresAt }).eq('id', TOKEN_ROW_ID)
      }
    }

    // Extract the changed event ID from the channel resource URI
    const resourceUri = req.headers.get('X-Goog-Resource-Uri') || ''
    const calMatch = resourceUri.match(/calendars\/([^/]+)\/events\/([^?]+)/)
    if (!calMatch) return new Response('ok', { status: 200 })

    const [, calId, eventId] = calMatch

    // Find the audiencia with this google_event_id
    const { data: audiencia } = await supabase
      .from('audiencias')
      .select('id, fecha, hora, tipo, tribunal, sala, cliente_nombre, causa_rit')
      .eq('google_event_id', eventId)
      .maybeSingle()

    if (!audiencia) return new Response('ok', { status: 200 })

    if (resourceState === 'delete') {
      // Clear the event id so it can be re-synced
      await supabase.from('audiencias').update({ google_event_id: null }).eq('id', audiencia.id)
      return new Response('ok', { status: 200 })
    }

    // Fetch the updated event from Google to sync back any changes
    const calEnc = encodeURIComponent(calId)
    const evRes  = await fetch(`${GCAL_BASE}/${calEnc}/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const gcalEvent = await evRes.json()
    if (gcalEvent.error) return new Response('ok', { status: 200 })

    // Update audiencia date/time if changed in Google Calendar
    const updates: Record<string, string> = {}
    const gcalDate = (gcalEvent.start?.dateTime || gcalEvent.start?.date || '').slice(0, 10)
    const gcalHora = gcalEvent.start?.dateTime ? gcalEvent.start.dateTime.slice(11, 16) : ''

    if (gcalDate && gcalDate !== audiencia.fecha) updates.fecha = gcalDate
    if (gcalHora && gcalHora !== audiencia.hora)  updates.hora  = gcalHora

    if (Object.keys(updates).length > 0) {
      await supabase.from('audiencias').update(updates).eq('id', audiencia.id)
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('Webhook error:', e)
    return new Response('error', { status: 200 }) // Always 200 to Google
  }
})
