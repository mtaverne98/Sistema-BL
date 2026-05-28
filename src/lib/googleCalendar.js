// ── Google Calendar Service ───────────────────────────────────────────────────
// OAuth 2.0 + Calendar API for Sistema BL

const CLIENT_ID     = import.meta.env.VITE_GOOGLE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET
const REDIRECT_URI  = import.meta.env.VITE_GOOGLE_REDIRECT_URI
const SCOPES        = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'

const TOKEN_KEY     = 'gcal_tokens'
const EVENT_MAP_KEY = 'gcal_event_ids'   // { [audiencia_id]: gcal_event_id }
const CAL_ID_KEY    = 'gcal_calendar_id'

// ── Token / Storage helpers ───────────────────────────────────────────────────
export const GCal = {
  saveTokens(t) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      ...t,
      expires_at: Date.now() + ((t.expires_in ?? 3600) - 60) * 1000,
    }))
  },

  loadTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) } catch { return null }
  },

  clearTokens() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EVENT_MAP_KEY)
  },

  isConnected() {
    return !!this.loadTokens()?.access_token
  },

  getCalendarId() {
    return localStorage.getItem(CAL_ID_KEY) || 'primary'
  },

  setCalendarId(id) {
    localStorage.setItem(CAL_ID_KEY, id)
  },

  getEventId(audienciaId) {
    try {
      return (JSON.parse(localStorage.getItem(EVENT_MAP_KEY) || '{}'))[String(audienciaId)] || null
    } catch { return null }
  },

  setEventId(audienciaId, gcalId) {
    const map = _loadEventMap()
    map[String(audienciaId)] = gcalId
    localStorage.setItem(EVENT_MAP_KEY, JSON.stringify(map))
  },

  removeEventId(audienciaId) {
    const map = _loadEventMap()
    delete map[String(audienciaId)]
    localStorage.setItem(EVENT_MAP_KEY, JSON.stringify(map))
  },

  getAllEventIds() {
    return _loadEventMap()
  },
}

function _loadEventMap() {
  try { return JSON.parse(localStorage.getItem(EVENT_MAP_KEY) || '{}') } catch { return {} }
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
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

export async function exchangeCode(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  GCal.saveTokens(data)
  return data
}

async function _refreshToken() {
  const tokens = GCal.loadTokens()
  if (!tokens?.refresh_token) throw new Error('No refresh token — reconecta Google Calendar')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) {
    if (data.error === 'invalid_grant') {
      GCal.clearTokens()
      throw new Error('Sesión expirada — por favor reconecta Google Calendar')
    }
    throw new Error(data.error_description || data.error)
  }
  GCal.saveTokens({ ...tokens, ...data })
  return data.access_token
}

export async function getAccessToken() {
  const tokens = GCal.loadTokens()
  if (!tokens?.access_token) throw new Error('No conectado a Google Calendar')
  if (Date.now() >= (tokens.expires_at ?? 0)) return await _refreshToken()
  return tokens.access_token
}

// ── Calendar list ─────────────────────────────────────────────────────────────
export async function listCalendars() {
  const token = await getAccessToken()
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.items || []
}

// ── Audiencia → GCal event object ─────────────────────────────────────────────
function audienciaToGCalEvent(a) {
  const tz   = 'America/Santiago'
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
    summary:     [a.tipo || 'Audiencia', a.cliente_nombre].filter(Boolean).join(' – '),
    description: desc,
    location:    [a.tribunal, a.sala].filter(Boolean).join(', '),
    start:       { dateTime: `${a.fecha}T${hora}:00`, timeZone: tz },
    end:         { dateTime: `${a.fecha}T${endH}:${endM}:00`, timeZone: tz },
    reminders: {
      useDefault: false,
      overrides:  [{ method: 'popup', minutes: 1440 }], // 24 h
    },
  }
}

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars'

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function createEvent(audiencia, calendarId) {
  const cal   = calendarId || GCal.getCalendarId()
  const token = await getAccessToken()
  const res   = await fetch(`${GCAL_BASE}/${encodeURIComponent(cal)}/events`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(audienciaToGCalEvent(audiencia)),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  GCal.setEventId(audiencia.id, data.id)
  return data
}

export async function updateEvent(audiencia, calendarId) {
  const gcalId = GCal.getEventId(audiencia.id)
  if (!gcalId) return createEvent(audiencia, calendarId)

  const cal   = calendarId || GCal.getCalendarId()
  const token = await getAccessToken()
  const res   = await fetch(`${GCAL_BASE}/${encodeURIComponent(cal)}/events/${gcalId}`, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(audienciaToGCalEvent(audiencia)),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}

export async function deleteEvent(audienciaId, calendarId) {
  const gcalId = GCal.getEventId(audienciaId)
  if (!gcalId) return

  const cal   = calendarId || GCal.getCalendarId()
  const token = await getAccessToken()
  await fetch(`${GCAL_BASE}/${encodeURIComponent(cal)}/events/${gcalId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  GCal.removeEventId(audienciaId)
}

// ── Fetch events from Google Calendar ────────────────────────────────────────
export async function fetchEvents(timeMin, timeMax, calendarId) {
  const cal    = calendarId || GCal.getCalendarId()
  const token  = await getAccessToken()
  const params = new URLSearchParams({
    timeMin:      `${timeMin}T00:00:00Z`,
    timeMax:      `${timeMax}T23:59:59Z`,
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '250',
  })
  const res  = await fetch(`${GCAL_BASE}/${encodeURIComponent(cal)}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.items || []
}

// ── Convert GCal item → Calendario event ─────────────────────────────────────
export function gcalItemToEvent(item) {
  const start = item.start?.dateTime || item.start?.date || ''
  const end   = item.end?.dateTime   || item.end?.date   || ''
  const allDay = !item.start?.dateTime
  const fecha  = start.slice(0, 10)
  const hora   = allDay ? '' : start.slice(11, 16)

  let duracion = 60
  if (!allDay && end) {
    const [h1, m1] = (start.slice(11, 16) || '00:00').split(':').map(Number)
    const [h2, m2] = (end.slice(11, 16) || '01:00').split(':').map(Number)
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (diff > 0) duracion = diff
  }

  return {
    id:         `gcal_${item.id}`,
    tipo:       'gcal',
    titulo:     item.summary || '(sin título)',
    fecha,
    hora_inicio: hora,
    duracion,
    allDay,
    cliente:    '',
    causa_rit:  '',
    notas:      item.description || '',
    responsable: '',
    completado: item.status === 'cancelled',
    _source:    'gcal',
    _gcalId:    item.id,
    _htmlLink:  item.htmlLink,
  }
}
