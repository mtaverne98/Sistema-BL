// ── Google Calendar Service ───────────────────────────────────────────────────
// OAuth 2.0 + Calendar API. GOOGLE_CLIENT_SECRET stays server-side only.
// Token refresh is done via the google-token-refresh Edge Function.

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID
const REDIRECT_URI = 'https://zzcdkjoetgclbtcuqswr.supabase.co/functions/v1/google-oauth-callback'
const SCOPES       = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_URL       = 'https://zzcdkjoetgclbtcuqswr.supabase.co'
const SYNC_EF_URL        = `${SUPABASE_URL}/functions/v1/google-calendar-sync`
const TOKEN_ROW_ID       = '00000000-0000-0000-0000-000000000001'
const TZ                 = 'America/Santiago'

// ── Auth URL ──────────────────────────────────────────────────────────────────
export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Connection + sync settings ────────────────────────────────────────────────
export async function checkConnectionServer(supabase) {
  try {
    const { data } = await supabase
      .from('google_tokens')
      .select('refresh_token')
      .eq('id', TOKEN_ROW_ID)
      .maybeSingle()
    return !!data?.refresh_token
  } catch { return false }
}

export async function isGCalEnabled(supabase) {
  try {
    const { data } = await supabase
      .from('google_tokens')
      .select('refresh_token, sync_enabled')
      .eq('id', TOKEN_ROW_ID)
      .maybeSingle()
    return !!(data?.refresh_token && data?.sync_enabled !== false)
  } catch { return false }
}

export async function getSyncSettings(supabase) {
  const { data } = await supabase
    .from('google_tokens')
    .select('sync_enabled, last_sync_at')
    .eq('id', TOKEN_ROW_ID)
    .maybeSingle()
  return { sync_enabled: true, last_sync_at: null, ...data }
}

export async function setSyncEnabled(supabase, enabled) {
  await supabase.from('google_tokens')
    .update({ sync_enabled: enabled })
    .eq('id', TOKEN_ROW_ID)
}

export async function disconnectServer(supabase) {
  await supabase.from('google_tokens')
    .update({ access_token: null, refresh_token: null, expires_at: null, bl_calendar_id: null })
    .eq('id', TOKEN_ROW_ID)
}

// ── Token refresh (via google-calendar-sync EF with action=get_token) ────────
export async function getValidToken() {
  const res = await fetch(SYNC_EF_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'get_token' }),
  })
  const { access_token, error } = await res.json()
  if (error || !access_token) throw new Error('GCal token: ' + (error || 'sin token'))
  return access_token
}

// ── "Sistema BL" calendar management ─────────────────────────────────────────
async function getBLCalendarId(token, supabase) {
  const { data: row } = await supabase
    .from('google_tokens').select('bl_calendar_id').eq('id', TOKEN_ROW_ID).single()
  if (row?.bl_calendar_id) return row.bl_calendar_id

  const listRes  = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listData = await listRes.json()
  const existing = (listData.items || []).find(c => c.summary === 'Sistema BL')
  if (existing) {
    await supabase.from('google_tokens').update({ bl_calendar_id: existing.id }).eq('id', TOKEN_ROW_ID)
    return existing.id
  }

  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Sistema BL', timeZone: TZ }),
  })
  const newCal = await createRes.json()
  if (newCal.error) throw new Error('Error creando calendario: ' + newCal.error.message)
  await supabase.from('google_tokens').update({ bl_calendar_id: newCal.id }).eq('id', TOKEN_ROW_ID)
  return newCal.id
}

// ── Event builders ────────────────────────────────────────────────────────────
function audienciaToEvent(a) {
  const hora = a.hora || '09:00'
  const [h, m] = hora.split(':').map(Number)
  const endMin = h * 60 + m + 90
  const endH   = String(Math.floor(endMin / 60)).padStart(2, '0')
  const endM   = String(endMin % 60).padStart(2, '0')

  const desc = [
    a.causa_rit ? `RIT: ${a.causa_rit}` : '',
    a.tribunal  ? `Tribunal: ${a.tribunal}` : '',
    a.sala      ? `Sala: ${a.sala}` : '',
    a.notas     ? `\nNotas: ${a.notas}` : '',
  ].filter(Boolean).join('\n')

  return {
    summary:     [a.tipo || 'Audiencia', a.cliente_nombre].filter(Boolean).join(' — '),
    description: desc || undefined,
    location:    [a.tribunal, a.sala].filter(Boolean).join(', ') || undefined,
    start:       { dateTime: `${a.fecha}T${hora}:00`, timeZone: TZ },
    end:         { dateTime: `${a.fecha}T${endH}:${endM}:00`, timeZone: TZ },
    reminders:   { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
  }
}

function reunionToEvent(r) {
  return {
    summary: 'Reunión de equipo — Sistema BL',
    start:   { date: r.fecha_jueves },
    end:     { date: r.fecha_jueves },
  }
}

// ── Push audiencia ────────────────────────────────────────────────────────────
export async function pushAudiencia(audiencia, supabase) {
  if (!audiencia.fecha || !audiencia.hora) return null
  const enabled = await isGCalEnabled(supabase)
  if (!enabled) return null
  try {
    const token = await getValidToken()
    const calId = await getBLCalendarId(token, supabase)
    const body  = audienciaToEvent(audiencia)

    let gcalId = audiencia.google_event_id
    if (gcalId) {
      const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${gcalId}`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error?.code === 404 || data.error?.code === 410) {
        gcalId = null
      } else if (data.error) {
        throw new Error(data.error.message)
      } else {
        gcalId = data.id
      }
    }

    if (!gcalId) {
      const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      gcalId = data.id
    }

    await supabase.from('audiencias').update({ google_event_id: gcalId }).eq('id', audiencia.id)
    supabase.from('google_tokens').update({ last_sync_at: new Date().toISOString() }).eq('id', TOKEN_ROW_ID)
    return gcalId
  } catch (e) {
    console.warn('GCal pushAudiencia:', e.message)
    return null
  }
}

export async function deleteAudienciaGEvent(googleEventId, supabase) {
  if (!googleEventId) return
  try {
    const token    = await getValidToken()
    const { data } = await supabase.from('google_tokens').select('bl_calendar_id').eq('id', TOKEN_ROW_ID).single()
    if (!data?.bl_calendar_id) return
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(data.bl_calendar_id)}/events/${googleEventId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    console.warn('GCal deleteAudienciaGEvent:', e.message)
  }
}

// ── Push reunión ──────────────────────────────────────────────────────────────
export async function pushReunion(reunion, supabase) {
  if (!reunion.fecha_jueves) return null
  const enabled = await isGCalEnabled(supabase)
  if (!enabled) return null
  try {
    const token = await getValidToken()
    const calId = await getBLCalendarId(token, supabase)
    const body  = reunionToEvent(reunion)

    let gcalId = reunion.google_event_id
    if (gcalId) {
      const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${gcalId}`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error?.code === 404 || data.error?.code === 410) gcalId = null
      else if (data.error) throw new Error(data.error.message)
      else gcalId = data.id
    }

    if (!gcalId) {
      const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      gcalId = data.id
    }

    await supabase.from('reuniones').update({ google_event_id: gcalId }).eq('id', reunion.id)
    supabase.from('google_tokens').update({ last_sync_at: new Date().toISOString() }).eq('id', TOKEN_ROW_ID)
    return gcalId
  } catch (e) {
    console.warn('GCal pushReunion:', e.message)
    return null
  }
}

export async function deleteReunionGEvent(googleEventId, supabase) {
  if (!googleEventId) return
  try {
    const token    = await getValidToken()
    const { data } = await supabase.from('google_tokens').select('bl_calendar_id').eq('id', TOKEN_ROW_ID).single()
    if (!data?.bl_calendar_id) return
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(data.bl_calendar_id)}/events/${googleEventId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    console.warn('GCal deleteReunionGEvent:', e.message)
  }
}

// ── Fetch external events from primary calendar ───────────────────────────────
export async function fetchExternalGCalEvents(weekStart, weekEnd, supabase) {
  const enabled = await isGCalEnabled(supabase)
  if (!enabled) return []
  try {
    const token  = await getValidToken()
    const params = new URLSearchParams({
      timeMin:      `${weekStart}T00:00:00-03:00`,
      timeMax:      `${weekEnd}T23:59:59-03:00`,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '250',
    })
    const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.error) return []
    return (data.items || []).map(item => ({
      id:       item.id,
      title:    item.summary || '(sin título)',
      fecha:    (item.start.dateTime || item.start.date || '').slice(0, 10),
      hora:     item.start.dateTime ? item.start.dateTime.slice(11, 16) : '',
      isAllDay: !item.start.dateTime,
      htmlLink: item.htmlLink,
    }))
  } catch (e) {
    console.warn('GCal fetchExternalGCalEvents:', e.message)
    return []
  }
}

// ── Batch sync via Edge Function (used in Configuracion) ─────────────────────
export async function syncViaEdgeFunction() {
  const res = await fetch(SYNC_EF_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Error en la sincronización')
  return data
}

// ── Backward-compat stubs (Calendario.jsx uses these; will migrate later) ────
export const GCal = {
  getCalendarId:  () => 'sistema-bl',
  setCalendarId:  () => {},
  isConnected:    () => false,
  getAllEventIds:  () => ({}),
  getEventId:     () => null,
  setEventId:     () => {},
  removeEventId:  () => {},
  saveTokens:     () => {},
  loadTokens:     () => null,
  clearTokens:    () => {},
}

export async function fetchEvents()     { return [] }
export async function createEvent()    { return null }
export async function updateEvent()    { return null }
export async function deleteEvent()    { return null }
export function      gcalItemToEvent() { return null }

// ── List calendars (for Configuracion) ───────────────────────────────────────
export async function listCalendars() {
  try {
    const token = await getValidToken()
    const res   = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data  = await res.json()
    return data.items || []
  } catch { return [] }
}
