import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { unzlibSync, inflateSync } from 'https://esm.sh/fflate@0.8.2'

const SHARED_DRIVE_ID = '1qS_tWyJItFqccW6Ig8MpmvSs2hhQ-_1a'
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Google OAuth2 via service account ────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getGoogleToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)))
  const header  = enc({ alg: 'RS256', typ: 'JWT' })
  const payload = enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
  const sigInput = `${header}.${payload}`

  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(sigInput))
  const jwt = `${sigInput}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

const driveBase = 'https://www.googleapis.com/drive/v3'
const sharedParams = `supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${SHARED_DRIVE_ID}`

async function driveReq(path: string, token: string): Promise<Response> {
  return fetch(`${driveBase}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
}

async function findFolder(token: string, name: string, parentId?: string): Promise<string | null> {
  const parentClause = parentId ? `'${parentId}' in parents and ` : ''
  const q = encodeURIComponent(`${parentClause}name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
  const res = await driveReq(`files?q=${q}&${sharedParams}&fields=files(id,name)`, token)
  const data = await res.json()
  return data.files?.[0]?.id ?? null
}

async function findFolderStartingWith(token: string, prefix: string, parentId: string): Promise<{ id: string; name: string } | null> {
  const q = encodeURIComponent(`'${parentId}' in parents and name contains '${prefix.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
  const res = await driveReq(`files?q=${q}&${sharedParams}&fields=files(id,name)`, token)
  const data = await res.json()
  return data.files?.[0] ?? null
}

async function listFiles(token: string, folderId: string): Promise<any[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const res = await driveReq(`files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime,webViewLink)&pageSize=100`, token)
  const data = await res.json()
  return data.files ?? []
}

async function extractText(token: string, fileId: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      const res = await driveReq(`files/${fileId}/export?mimeType=text%2Fplain`, token)
      if (!res.ok) return ''
      return (await res.text()).slice(0, 50_000)
    }

    if (mimeType === 'application/pdf') {
      const res = await fetch(`${driveBase}/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return ''
      const bytes = new Uint8Array(await res.arrayBuffer())
      return await extractPdfText(bytes)
    }
  } catch { /* ignore extraction errors */ }
  return ''
}

// Decodes ASCII85-encoded bytes (used as pre-filter in some PDFs before FlateDecode)
function decodeAscii85(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let group = 0, count = 0
  for (let i = 0; i < data.length; i++) {
    const c = data[i]
    if (c === 126 && data[i + 1] === 62) break  // ~> end marker
    if (c < 33 || c > 117) continue              // skip whitespace
    if (c === 122 && count === 0) { out.push(0, 0, 0, 0); continue } // z = 00000000
    group = group * 85 + (c - 33)
    if (++count === 5) {
      out.push((group >>> 24) & 0xFF, (group >>> 16) & 0xFF, (group >>> 8) & 0xFF, group & 0xFF)
      group = 0; count = 0
    }
  }
  if (count > 0) {
    for (let i = count; i < 5; i++) group = group * 85 + 84
    const b = [(group >>> 24) & 0xFF, (group >>> 16) & 0xFF, (group >>> 8) & 0xFF, group & 0xFF]
    for (let i = 0; i < count - 1; i++) out.push(b[i])
  }
  return new Uint8Array(out)
}

// Extracts text from PDF: handles ASCII85+FlateDecode (pypdf), plain FlateDecode,
// and uncompressed streams. Falls back to raw ASCII scan. Keeps work under ~10s.
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const dec = new TextDecoder('latin1')
  const parts: string[] = []

  // Find 'stream\r?\n' boundaries (PDF spec requires newline after 'stream')
  const STREAM = [115,116,114,101,97,109] // 'stream'
  let found = 0
  for (let i = 0; i < bytes.length - STREAM.length && found < 20; i++) {
    if (!STREAM.every((b, j) => bytes[i + j] === b)) continue
    let pos = i + STREAM.length
    if (bytes[pos] === 13) pos++ // \r
    if (bytes[pos] !== 10) { i += STREAM.length; continue } // must end with \n
    pos++ // skip \n
    i += STREAM.length
    found++

    const end = Math.min(pos + 80_000, bytes.length)
    const chunk = bytes.slice(pos, end)
    const b0 = chunk[0], b1 = chunk[1]

    // Detect ASCII85 encoding: starts with printable chars in range '!'..'u' and ends with ~>
    const isAscii85Start = b0 >= 33 && b0 <= 117
    if (isAscii85Start) {
      // Look for ~> marker within the first 60KB
      let markerAt = -1
      const limit = Math.min(chunk.length - 1, 60_000)
      for (let j = 0; j < limit; j++) {
        if (chunk[j] === 126 && chunk[j + 1] === 62) { markerAt = j; break }
      }
      if (markerAt > 0) {
        // ASCII85 + FlateDecode: decode then inflate
        try {
          const decoded = decodeAscii85(chunk.slice(0, markerAt + 2))
          let decompressed: Uint8Array
          try { decompressed = unzlibSync(decoded) }
          catch { decompressed = inflateSync(decoded) }  // try raw deflate as fallback
          const t = extractPdfOps(dec.decode(decompressed.slice(0, 150_000)))
          if (t.length > 5) parts.push(t)
        } catch { /* skip corrupt stream */ }
        continue
      }
    }

    const isZlib = b0 === 0x78 && (b1 === 0x01 || b1 === 0x5E || b1 === 0x9C || b1 === 0xDA)

    if (!isZlib) {
      // Uncompressed — read small chunk directly
      const raw = dec.decode(chunk.slice(0, 4_000))
      const t = extractPdfOps(raw)
      if (t.length > 5) parts.push(t)
      continue
    }

    // Standard zlib FlateDecode — sync, no event-loop errors on bad data
    try {
      const decompressed = unzlibSync(chunk)
      const t = extractPdfOps(dec.decode(decompressed.slice(0, 150_000)))
      if (t.length > 5) parts.push(t)
    } catch {
      // Try raw deflate (no zlib wrapper) as fallback
      try {
        const decompressed = inflateSync(chunk)
        const t = extractPdfOps(dec.decode(decompressed.slice(0, 150_000)))
        if (t.length > 5) parts.push(t)
      } catch { /* corrupted stream — skip */ }
    }
  }

  // Fallback: ASCII run scan (works for uncompressed PDFs)
  if (parts.length === 0) {
    let run = '', text = ''
    for (const b of bytes) {
      if (b >= 32 && b < 127) run += String.fromCharCode(b)
      else { if (run.length > 5) text += run + ' '; run = '' }
    }
    if (run.length > 5) text += run
    if (text.trim().length > 10) parts.push(text)
  }

  return parts.join('\n').replace(/\s{3,}/g, '\n').slice(0, 30_000)
}

// Extracts visible text from PDF content operators inside BT...ET blocks.
function extractPdfOps(content: string): string {
  const results: string[] = []
  for (const block of content.matchAll(/BT([\s\S]{0,3000}?)ET/g)) {
    const inner = block[1]
    // Match (text)Tj / (text)TJ / (text)' / (text)"
    for (const m of inner.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g)) {
      const t = m[1]
        .replace(/\\n/g, ' ').replace(/\\r/g, ' ').replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\').trim()
      if (t.length > 1) results.push(t)
    }
    // Match [(text) kern ...]TJ (array form)
    for (const m of inner.matchAll(/\[((?:[^[\]]*\([^)]*\)[^[\]]*)+)\]\s*TJ/g)) {
      for (const s of m[1].matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g)) {
        const t = s[1].replace(/\\[nrt]/g, ' ')
          .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\').trim()
        if (t.length > 1) results.push(t)
      }
    }
  }
  if (results.length === 0) {
    for (const m of content.matchAll(/\(([^)]{3,})\)\s*Tj/g)) {
      if (m[1].trim().length > 2) results.push(m[1].trim())
    }
  }
  return results.join(' ')
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const jsonRes = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { causa_id, drive_folder_id: inputFolderId } = await req.json()
    if (!causa_id) return jsonRes({ error: 'causa_id requerido' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 1. Cargar causa ──────────────────────────────────────────────────────
    const { data: causa, error: causaErr } = await supabase
      .from('causas')
      .select('*')
      .eq('id', causa_id)
      .single()
    if (causaErr || !causa) throw new Error('Causa no encontrada')

    // ── 2. Cargar contexto para Claude ───────────────────────────────────────
    const [{ data: diligencias }, { data: siauRows }, { data: pjudRows }, { data: audiencias }, { data: tareas }] = await Promise.all([
      supabase.from('diligencias').select('nombre,estado,nivel_cumplimiento,fundamento').eq('causa_id', causa_id),
      supabase.from('siau').select('tipo,descripcion,estado,fecha_solicitud,fecha_respuesta').eq('causa_id', causa_id),
      supabase.from('pjud').select('tipo,descripcion,estado,fecha').eq('causa_id', causa_id),
      supabase.from('audiencias').select('tipo,fecha,resultado,estado').eq('causa_id', causa_id),
      supabase.from('tareas').select('descripcion,estado,prioridad,fecha_limite').eq('causa_id', causa_id),
    ])

    // ── 3. Auth con Drive ────────────────────────────────────────────────────
    const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!)
    const driveToken = await getGoogleToken(sa)

    // ── 4. Encontrar carpeta ─────────────────────────────────────────────────
    let folderId: string | null = inputFolderId || causa.drive_folder_id || null

    if (!folderId) {
      const clienteNombre = causa.cliente_nombre
      if (!clienteNombre) {
        return jsonRes({ error: 'No se encontró carpeta en Drive para esta causa', no_folder: true })
      }

      const clienteFolderId = await findFolder(driveToken, clienteNombre)
      if (!clienteFolderId) {
        return jsonRes({ error: 'No se encontró carpeta en Drive para esta causa', no_folder: true })
      }

      if (causa.ruc) {
        const causaFolder = await findFolderStartingWith(driveToken, `Causa RUC ${causa.ruc}`, clienteFolderId)
        if (causaFolder) {
          folderId = causaFolder.id
          await supabase.from('causas').update({ drive_folder_id: folderId }).eq('id', causa_id)
        }
      }

      if (!folderId) {
        return jsonRes({ error: 'No se encontró carpeta en Drive para esta causa', no_folder: true })
      }
    }

    // ── 5. Listar archivos ───────────────────────────────────────────────────
    const files = await listFiles(driveToken, folderId)

    // ── 6. Extraer texto — caché para docs existentes, descarga solo los nuevos ─
    const { data: existingDocs } = await supabase
      .from('documentos')
      .select('drive_file_id, texto_extraido, nombre')
      .eq('causa_id', causa_id)
    const existingIds = new Set((existingDocs || []).map((d: any) => d.drive_file_id).filter(Boolean))
    // Cache includes docs with empty string (extraction attempted, got nothing) to avoid retries
    const textoCache = new Map((existingDocs || [])
      .filter((d: any) => d.drive_file_id && d.texto_extraido !== null && d.texto_extraido !== undefined)
      .map((d: any) => [d.drive_file_id, d.texto_extraido as string])
    )

    const textParts: string[] = []
    const newDocs: any[] = []

    for (const file of files) {
      const isNew = !existingIds.has(file.id)
      const canExtract = file.mimeType === 'application/vnd.google-apps.document' || file.mimeType === 'application/pdf'

      let texto = ''
      if (canExtract) {
        if (!isNew && textoCache.has(file.id)) {
          texto = textoCache.get(file.id)!  // use cached text (may be empty = already tried)
        } else {
          texto = await extractText(driveToken, file.id, file.mimeType)
          // Update existing doc with extracted text (including empty string, to avoid future retries)
          if (!isNew) {
            await supabase.from('documentos')
              .update({ texto_extraido: texto })
              .eq('drive_file_id', file.id)
              .eq('causa_id', causa_id)
          }
        }
      }
      if (texto) textParts.push(`=== ${file.name} ===\n${texto}`)

      if (isNew) {
        newDocs.push({
          causa_id,
          nombre:            file.name,
          url:               file.webViewLink,
          drive_file_id:     file.id,
          drive_url:         file.webViewLink,
          drive_mime:        file.mimeType,
          drive_modified_at: file.modifiedTime,
          fuente:            'drive_auto',
          tipo:              file.mimeType === 'application/vnd.google-apps.document' ? 'Google Doc' : 'PDF',
          fecha_creacion:    file.modifiedTime?.slice(0, 10) ?? null,
          texto_extraido:    texto,
        })
      }
    }

    if (newDocs.length > 0) {
      await supabase.from('documentos').insert(newDocs)
    }

    // ── 7. Llamar a Claude ───────────────────────────────────────────────────
    const causaCtx = JSON.stringify({
      materia: causa.delito,
      area: causa.area,
      calidad: causa.calidad,
      ruc: causa.ruc,
      rit: causa.rit,
      tribunal: causa.tribunal,
      fiscalia: causa.fiscalia,
      etapa_procesal: causa.etapa_procesal,
      diligencias: diligencias || [],
      siau: siauRows || [],
      pjud: pjudRows || [],
      audiencias: audiencias || [],
      tareas: tareas || [],
    }, null, 2)

    const documentosTexto = textParts.length > 0
      ? textParts.join('\n\n')
      : 'No se encontraron documentos con texto extraíble.'

    const prompt = `Eres un asistente jurídico especializado en litigio chileno. Analiza esta causa legal y sus documentos.

DATOS DE LA CAUSA:
${causaCtx}

DOCUMENTOS DE DRIVE (${files.length} archivos, texto extraído de ${textParts.length}):
${documentosTexto.slice(0, 80_000)}

Responde SOLO con un JSON válido (sin markdown ni texto adicional) con esta estructura exacta:
{
  "partes": {
    "parte_1_label": "Querellante|Demandante|Denunciante|Víctima",
    "parte_1_nombre": "Nombre completo o null si no se identifica",
    "parte_2_label": "Imputado|Demandado|Denunciado",
    "parte_2_nombre": "Nombre completo o null si no se identifica",
    "delito": "El hecho punible específico tal como se describe en la causa — el tipo penal investigado (ej: 'Lesiones graves gravísimas', 'Maltrato habitual', 'Falsificación de instrumento privado'). No es el nombre de las partes ni la carátula completa. Si no se identifica, null."
  },
  "resumen_ejecutivo": "3 a 4 líneas sobre el estado actual de la causa y la posición estratégica",
  "acciones_semana": [
    { "accion": "Descripción de la acción", "prioridad": "URGENTE|ESTA SEMANA|PRÓXIMA SEMANA", "fundamento": "Por qué ahora" }
  ],
  "brechas": [
    { "descripcion": "Brecha o elemento faltante", "relevancia": "ALTA|MEDIA|BAJA", "impacto": "Cómo afecta la estrategia" }
  ],
  "contradicciones": [
    { "descripcion": "Descripción de la contradicción o vacío", "relevancia": "ALTA|MEDIA|BAJA" }
  ],
  "proxima_accion": "La acción más importante en una oración directa",
  "proxima_accion_fundamento": "Por qué es la prioritaria",
  "proxima_accion_prioridad": "ALTA|MEDIA|BAJA",
  "diligencias_detectadas": [
    {
      "tipo": "OI o IP",
      "numero_oficio": "Número completo del oficio tal como aparece en el documento (ej: 2026-1502-9426)",
      "fecha": "Fecha en formato YYYY-MM-DD si se menciona, o null",
      "organismo": "Organismo destinatario exacto (ej: PDI - BRIDEC, PDI - OFAN RM Centro Norte, OS-10, Carabineros, SML)",
      "instrucciones": ["Texto literal de cada instrucción como elemento separado del array"],
      "plazo_dias": null
    }
  ]
}

Además del análisis general, identifica TODAS las Órdenes de Investigar (OI) e Instrucciones Particulares (IP) que aparezcan en los documentos. Para cada una extrae:
- tipo: "OI" o "IP"
- numero_oficio: el número completo (ej: "2026-1502-9426")
- fecha: fecha del oficio en formato YYYY-MM-DD
- organismo: a quién va dirigida (ej: "PDI - BRIDEC", "PDI - OFAN RM Centro Norte")
- instrucciones: array con cada instrucción separada como texto (si la OI tiene varias instrucciones numeradas o separadas, ponlas como elementos distintos del array)
- plazo_dias: número de días de plazo si lo menciona, null si no

Incluye esto en el JSON de respuesta bajo la clave "diligencias_detectadas". Si no hay OIs ni IPs en los documentos, devuelve un arreglo vacío.`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Claude API ${claudeRes.status}: ${errText}`)
    }

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.text || ''

    let parsed: any
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`Respuesta no es JSON válido: ${rawText.slice(0, 300)}`)
      parsed = JSON.parse(match[0])
    }

    // ── 8. Guardar en Supabase ───────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('causa_analisis_meta')
      .select('analisis_ia_version')
      .eq('causa_id', causa_id)
      .maybeSingle()

    await supabase.from('causa_analisis_meta').upsert({
      causa_id,
      resumen_ejecutivo:         parsed.resumen_ejecutivo || null,
      acciones_semana:           parsed.acciones_semana || [],
      proxima_accion:            parsed.proxima_accion || null,
      proxima_accion_fundamento: parsed.proxima_accion_fundamento || null,
      proxima_accion_prioridad:  parsed.proxima_accion_prioridad || null,
      partes:                    parsed.partes || null,
      diligencias_detectadas:    parsed.diligencias_detectadas || [],
      analisis_ia_at:            new Date().toISOString(),
      analisis_ia_version:       (existing?.analisis_ia_version || 0) + 1,
      drive_folder_id:           folderId,
    }, { onConflict: 'causa_id' })

    if (parsed.brechas?.length) {
      await supabase.from('causa_faltantes').delete().eq('causa_id', causa_id)
      await supabase.from('causa_faltantes').insert(
        parsed.brechas.map((b: any) => ({
          causa_id,
          descripcion:     b.descripcion,
          relevancia:      b.relevancia,
          accion_sugerida: b.impacto,
          revisado:        true,
        })),
      )
    }

    if (parsed.contradicciones?.length) {
      await supabase.from('causa_contradicciones').delete().eq('causa_id', causa_id)
      await supabase.from('causa_contradicciones').insert(
        parsed.contradicciones.map((c: any) => ({
          causa_id,
          materia:     'IA',
          descripcion: c.descripcion,
          relevancia:  c.relevancia,
          revisado:    false,
        })),
      )
    }

    await supabase.from('drive_sync_log').insert({
      causa_id,
      archivos_vistos: files.length,
      archivos_nuevos: newDocs.length,
    })

    return jsonRes({
      ok: true,
      archivos_vistos:         files.length,
      archivos_nuevos:         newDocs.length,
      partes:                  parsed.partes,
      resumen_ejecutivo:       parsed.resumen_ejecutivo,
      diligencias_detectadas:  parsed.diligencias_detectadas || [],
    })

  } catch (err: any) {
    console.error(err)
    return jsonRes({ error: err.message || String(err) }, 500)
  }
})
