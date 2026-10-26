import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { unzlibSync, inflateSync } from 'https://esm.sh/fflate@0.8.2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const GMAIL_ROW_ID  = '00000000-0000-0000-0000-000000000003'
const PJUD_SENDER   = 'notificacion_judicial@pjud.cl'
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ── Gmail token ───────────────────────────────────────────────────────────────

async function getGmailToken(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: row } = await sb.from('google_tokens')
    .select('access_token, refresh_token, expires_at').eq('id', GMAIL_ROW_ID).single()
  if (!row?.refresh_token) throw new Error('Gmail no conectado')
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) return row.access_token

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: row.refresh_token, grant_type: 'refresh_token',
    }),
  })
  const t = await res.json()
  if (t.error) throw new Error('Refresh token Gmail: ' + t.error)
  const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString()
  await sb.from('google_tokens').update({ access_token: t.access_token, expires_at: expiresAt }).eq('id', GMAIL_ROW_ID)
  return t.access_token
}

// ── Gmail API ─────────────────────────────────────────────────────────────────

async function gmailGet(token: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodeB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

// Find PDF attachment part, return { attachmentId, data? }
function findPdfPart(payload: Record<string, unknown>): { id: string; data?: string } | null {
  if ((payload.mimeType as string) === 'application/pdf') {
    const body = payload.body as { attachmentId?: string; data?: string }
    return body?.attachmentId ? { id: body.attachmentId, data: body.data } : null
  }
  const parts = (payload.parts as Record<string, unknown>[]) ?? []
  for (const p of parts) {
    const found = findPdfPart(p)
    if (found) return found
  }
  return null
}

function extractBodyText(payload: Record<string, unknown>): string {
  if ((payload.mimeType as string)?.startsWith('text/plain')) {
    const data = (payload as { body?: { data?: string } }).body?.data
    return data ? new TextDecoder().decode(decodeB64url(data)) : ''
  }
  for (const p of (payload as { parts?: unknown[] }).parts ?? []) {
    const t = extractBodyText(p as Record<string, unknown>)
    if (t) return t
  }
  return ''
}

// ── PDF text extraction (adapted from drive-sync-causa) ───────────────────────

function decodeAscii85(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let group = 0, count = 0
  for (let i = 0; i < data.length; i++) {
    const c = data[i]
    if (c === 126 && data[i + 1] === 62) break
    if (c < 33 || c > 117) continue
    if (c === 122 && count === 0) { out.push(0, 0, 0, 0); continue }
    group = group * 85 + (c - 33)
    if (++count === 5) {
      out.push((group >>> 24) & 0xFF, (group >>> 16) & 0xFF, (group >>> 8) & 0xFF, group & 0xFF)
      group = 0; count = 0
    }
  }
  return new Uint8Array(out)
}

function extractPdfOps(content: string): string {
  const results: string[] = []
  for (const block of content.matchAll(/BT([\s\S]{0,3000}?)ET/g)) {
    for (const m of block[1].matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g)) {
      const t = m[1].replace(/\\[nrt]/g, ' ').replace(/\\\(/g, '(').replace(/\\\)/g, ')').trim()
      if (t.length > 1) results.push(t)
    }
    for (const m of block[1].matchAll(/\[((?:[^[\]]*\([^)]*\)[^[\]]*)+)\]\s*TJ/g)) {
      for (const s of m[1].matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g)) {
        const t = s[1].replace(/\\[nrt]/g, ' ').trim()
        if (t.length > 1) results.push(t)
      }
    }
  }
  return results.join(' ')
}

function extractPdfText(bytes: Uint8Array): string {
  const dec = new TextDecoder('latin1')
  const parts: string[] = []
  const STREAM = [115, 116, 114, 101, 97, 109]
  let found = 0
  for (let i = 0; i < bytes.length - STREAM.length && found < 20; i++) {
    if (!STREAM.every((b, j) => bytes[i + j] === b)) continue
    let pos = i + STREAM.length
    if (bytes[pos] === 13) pos++
    if (bytes[pos] !== 10) { i += STREAM.length; continue }
    pos++; i += STREAM.length; found++
    const chunk = bytes.slice(pos, Math.min(pos + 80_000, bytes.length))
    const b0 = chunk[0], b1 = chunk[1]
    const isAscii85 = b0 >= 33 && b0 <= 117
    if (isAscii85) {
      let mi = -1
      for (let j = 0; j < Math.min(chunk.length - 1, 60_000); j++) {
        if (chunk[j] === 126 && chunk[j + 1] === 62) { mi = j; break }
      }
      if (mi > 0) {
        try {
          const decoded = decodeAscii85(chunk.slice(0, mi + 2))
          let dc: Uint8Array
          try { dc = unzlibSync(decoded) } catch { dc = inflateSync(decoded) }
          const t = extractPdfOps(dec.decode(dc.slice(0, 150_000)))
          if (t.length > 5) parts.push(t)
        } catch { /* skip */ }
        continue
      }
    }
    const isZlib = b0 === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(b1)
    if (!isZlib) {
      const t = extractPdfOps(dec.decode(chunk.slice(0, 4_000)))
      if (t.length > 5) parts.push(t)
      continue
    }
    try {
      const dc = unzlibSync(chunk)
      const t = extractPdfOps(dec.decode(dc.slice(0, 150_000)))
      if (t.length > 5) parts.push(t)
    } catch {
      try {
        const dc = inflateSync(chunk)
        const t = extractPdfOps(dec.decode(dc.slice(0, 150_000)))
        if (t.length > 5) parts.push(t)
      } catch { /* skip */ }
    }
  }
  if (parts.length === 0) {
    let run = '', text = ''
    for (const b of bytes) {
      if (b >= 32 && b < 127) run += String.fromCharCode(b)
      else { if (run.length > 5) text += run + ' '; run = '' }
    }
    if (text.trim().length > 10) parts.push(text)
  }
  return parts.join('\n').replace(/\s{3,}/g, '\n').slice(0, 30_000)
}

// ── RIT/RUC matching ──────────────────────────────────────────────────────────

const RIT_RE = /\b([A-Z]-\d{1,6}-\d{4}|\d{1,6}-\d{4})\b/gi
const RUC_RE = /\b(\d{7,12}-[\dkK])\b/g

function extractRitRuc(text: string) {
  const rucs = [...text.matchAll(RUC_RE)].map(m => m[1])
  const rits = [...text.matchAll(RIT_RE)].map(m => m[1]).filter(r => !rucs.includes(r))
  return { rit: rits[0] ?? null, ruc: rucs[0] ?? null }
}

function normKey(s: string) { return s.replace(/[-.\s]/g, '').replace(/^0+/, '').toUpperCase() }

function findCausa(causas: Array<{ id: string; rit: string | null; ruc: string | null }>, rit: string | null, ruc: string | null): string | null {
  const nr = rit ? normKey(rit) : null
  const nu = ruc ? normKey(ruc) : null
  for (const c of causas) {
    if (nr && c.rit && normKey(c.rit) === nr) return c.id
    if (nu && c.ruc && normKey(c.ruc) === nu) return c.id
  }
  return null
}

// ── Claude extraction ─────────────────────────────────────────────────────────

const CLAUDE_PROMPT = `Eres un asistente jurídico. Analiza esta resolución judicial chilena y extrae:
- tipo_resolucion: tipo de resolución (ej: "Resolución de trámite", "Sentencia definitiva", "Auto", "Decreto", "Interlocutoria", "Otra")
- fecha: fecha de la resolución en formato YYYY-MM-DD
- tribunal: nombre del tribunal
- folio: número de folio o resolución
- resumen: una o dos líneas que expliquen qué resuelve esta resolución
- nombre_archivo: nombre descriptivo para guardar el PDF, formato YYYY-MM-DD_tipo_apellido_RIT.pdf (sin espacios, sin tildes, guiones bajos entre partes)
- rit: RIT o número de causa si aparece
- ruc: RUC si aparece

Responde SOLO con JSON válido, sin explicaciones ni markdown.`

async function callClaude(text: string): Promise<Record<string, string | null>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: `${CLAUDE_PROMPT}\n\nTEXTO DE LA RESOLUCIÓN:\n${text.slice(0, 20_000)}` }],
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const raw = data.content?.[0]?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió JSON')
  return JSON.parse(match[0])
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    const sb    = createClient(SUPABASE_URL, SERVICE_KEY)
    const token = await getGmailToken(sb)

    // Existing message IDs
    const { data: existing } = await sb.from('pjud_inbox').select('gmail_message_id')
    const knownIds = new Set((existing || []).map((r: { gmail_message_id: string }) => r.gmail_message_id))

    // List messages
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const after = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2,'0')}/${String(since.getDate()).padStart(2,'0')}`
    const list = await gmailGet(token, `messages?q=${encodeURIComponent(`from:${PJUD_SENDER} after:${after}`)}&maxResults=50`)
    const messages: Array<{ id: string }> = list.messages ?? []
    if (!messages.length) return json({ procesados: 0, nuevos: 0, errores: [] })

    // Causas for matching
    const { data: causas } = await sb.from('causas').select('id, rit, ruc, cliente_nombre, cliente_id')
    const causaList = causas ?? []

    const errores: string[] = []
    const inserts: unknown[] = []
    let procesados = 0

    for (const { id: msgId } of messages) {
      if (knownIds.has(msgId)) continue
      procesados++
      try {
        const msg     = await gmailGet(token, `messages/${msgId}?format=full`)
        const headers = (msg.payload as { headers: Array<{ name: string; value: string }> })?.headers ?? []
        const asunto  = getHeader(headers, 'subject')
        const dateStr = getHeader(headers, 'date')
        const fecha   = dateStr ? new Date(dateStr).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
        const remitente = getHeader(headers, 'from')
        const cuerpo    = extractBodyText(msg.payload as Record<string, unknown>).slice(0, 5_000)

        // Find PDF attachment
        const pdfPart = findPdfPart(msg.payload as Record<string, unknown>)
        let pdfText = ''
        let attachmentId: string | null = null

        if (pdfPart) {
          attachmentId = pdfPart.id
          // Download attachment (data may already be inline for small PDFs)
          let pdfBytes: Uint8Array
          if (pdfPart.data) {
            pdfBytes = decodeB64url(pdfPart.data)
          } else {
            const att = await gmailGet(token, `messages/${msgId}/attachments/${pdfPart.id}`)
            pdfBytes  = decodeB64url(att.data)
          }
          pdfText = extractPdfText(pdfBytes)
        }

        // Call Claude with PDF text or email body
        const inputText = pdfText || cuerpo || asunto
        let ai: Record<string, string | null> = {}
        try {
          ai = await callClaude(inputText)
        } catch (e) {
          errores.push(`${msgId}: Claude error — ${(e as Error).message}`)
        }

        // Merge RIT/RUC: prefer AI extraction, fallback to regex
        const textForMatch = `${asunto} ${inputText}`
        const { rit: ritFallback, ruc: rucFallback } = extractRitRuc(textForMatch)
        const rit = ai.rit ?? ritFallback
        const ruc = ai.ruc ?? rucFallback
        const causaId = findCausa(causaList, rit, ruc)

        const causa = causaId ? causaList.find(c => c.id === causaId) : null

        inserts.push({
          gmail_message_id:   msgId,
          gmail_attachment_id: attachmentId,
          fecha:              ai.fecha ?? fecha,
          asunto,
          remitente,
          cuerpo:             cuerpo.slice(0, 2_000),
          rit_detectado:      rit,
          ruc_detectado:      ruc,
          causa_id:           causaId,
          tipo_resolucion:    ai.tipo_resolucion ?? null,
          folio:              ai.folio ?? null,
          tribunal:           ai.tribunal ?? null,
          resumen_ia:         ai.resumen ?? null,
          nombre_archivo:     ai.nombre_archivo ?? `${ai.fecha ?? fecha}_resolucion_${rit ?? 'sin-rit'}.pdf`,
          estado:             'pendiente',
        })
      } catch (e) {
        errores.push(`${msgId}: ${(e as Error).message}`)
      }
    }

    if (inserts.length > 0) {
      const { error: insErr } = await sb.from('pjud_inbox').insert(inserts)
      if (insErr) throw new Error('Insert pjud_inbox: ' + insErr.message)
    }

    return json({ procesados, nuevos: inserts.length, errores })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
