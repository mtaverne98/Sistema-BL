import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID       = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET   = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GMAIL_ROW_ID    = '00000000-0000-0000-0000-000000000003'
const PJUD_SENDER     = 'notificacion_judicial@pjud.cl'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getValidToken(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: row } = await sb
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', GMAIL_ROW_ID)
    .single()

  if (!row?.refresh_token) throw new Error('Gmail no conectado')

  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) {
    return row.access_token
  }

  // Refresh
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: row.refresh_token, grant_type: 'refresh_token',
    }),
  })
  const tokens = await res.json()
  if (tokens.error) throw new Error('Error refrescando token Gmail: ' + tokens.error)

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await sb.from('google_tokens')
    .update({ access_token: tokens.access_token, expires_at: expiresAt })
    .eq('id', GMAIL_ROW_ID)

  return tokens.access_token
}

// ── Gmail API helpers ─────────────────────────────────────────────────────────

async function gmailGet(token: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail API error ${res.status}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeBase64Url(s: string): string {
  try {
    return atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  } catch { return '' }
}

function extractBody(payload: Record<string, unknown>): string {
  // Recursively extract text/plain body
  if ((payload.mimeType as string)?.startsWith('text/plain')) {
    const data = (payload as { body?: { data?: string } }).body?.data
    return data ? decodeBase64Url(data) : ''
  }
  const parts = (payload as { parts?: unknown[] }).parts
  if (!Array.isArray(parts)) return ''
  for (const part of parts) {
    const t = extractBody(part as Record<string, unknown>)
    if (t) return t
  }
  return ''
}

// ── RIT/RUC extraction ────────────────────────────────────────────────────────

// RIT: e.g. "C-1234-2024", "O-5678-2023", or plain "1234-2024"
const RIT_RE = /\b([A-Z]-\d{1,6}-\d{4}|\d{1,6}-\d{4})\b/gi
// RUC: e.g. "1234567890-1" or "0123456789-1K"
const RUC_RE = /\b(\d{7,12}-[\dkK])\b/g

function extractRitRuc(text: string): { rit: string | null; ruc: string | null } {
  const rucs = [...text.matchAll(RUC_RE)].map(m => m[1])
  const rits = [...text.matchAll(RIT_RE)].map(m => m[1])
    .filter(r => !rucs.includes(r)) // exclude RUC-shaped hits

  return {
    rit: rits[0] ?? null,
    ruc: rucs[0] ?? null,
  }
}

// ── Causa matching ────────────────────────────────────────────────────────────

function normKey(s: string): string {
  return s.replace(/[-.\s]/g, '').replace(/^0+/, '').toUpperCase()
}

function findCausa(
  causas: Array<{ id: string; rit: string | null; ruc: string | null }>,
  rit: string | null,
  ruc: string | null,
): string | null {
  const nrit = rit ? normKey(rit) : null
  const nruc = ruc ? normKey(ruc) : null

  for (const c of causas) {
    if (nrit && c.rit && normKey(c.rit) === nrit) return c.id
    if (nruc && c.ruc && normKey(c.ruc) === nruc) return c.id
  }
  return null
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    const token = await getValidToken(sb)

    // Fetch existing gmail_message_ids to skip duplicates
    const { data: existing } = await sb
      .from('pjud_inbox')
      .select('gmail_message_id')
    const knownIds = new Set((existing || []).map((r: { gmail_message_id: string }) => r.gmail_message_id))

    // Build Gmail query: last 30 days, from PJUD sender
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const afterDate = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2,'0')}/${String(since.getDate()).padStart(2,'0')}`
    const q = encodeURIComponent(`from:${PJUD_SENDER} after:${afterDate}`)

    const listData = await gmailGet(token, `messages?q=${q}&maxResults=50`)
    const messages: Array<{ id: string }> = listData.messages ?? []

    if (messages.length === 0) {
      return json({ synced: 0, total: 0 })
    }

    // Load causas for matching
    const { data: causas } = await sb
      .from('causas')
      .select('id, rit, ruc')
    const causaList = causas ?? []

    let synced = 0
    const inserts: unknown[] = []

    for (const { id: msgId } of messages) {
      if (knownIds.has(msgId)) continue

      let msg: Record<string, unknown>
      try {
        msg = await gmailGet(token, `messages/${msgId}?format=full`)
      } catch (e) {
        console.warn('Error fetching message', msgId, (e as Error).message)
        continue
      }

      const headers = (msg.payload as { headers: Array<{ name: string; value: string }> })?.headers ?? []
      const subject = getHeader(headers, 'subject')
      const dateHeader = getHeader(headers, 'date')
      const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

      const body = extractBody(msg.payload as Record<string, unknown>)
      const { rit, ruc } = extractRitRuc(`${subject} ${body}`)
      const causaId = findCausa(causaList, rit, ruc)

      inserts.push({
        gmail_message_id: msgId,
        subject,
        received_at: receivedAt,
        snippet:     (msg.snippet as string | null) ?? null,
        rit_detectado: rit,
        ruc_detectado: ruc,
        causa_id:    causaId,
        estado:      'pendiente',
      })
      synced++
    }

    if (inserts.length > 0) {
      const { error: insErr } = await sb.from('pjud_inbox').insert(inserts)
      if (insErr) throw new Error('Error insertando en pjud_inbox: ' + insErr.message)
    }

    return json({ synced, total: messages.length })
  } catch (e) {
    console.error('gmail-pjud-sync error:', (e as Error).message)
    return json({ error: (e as Error).message }, 500)
  }
})
