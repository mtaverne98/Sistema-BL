import { getValidDriveToken } from './driveApi'
import { supabase } from './supabase'

const SHEETS_API    = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES   = 'https://www.googleapis.com/drive/v3/files'
const SHARED_DRIVE_ID = '1qS_tWyJItFqccW6Ig8MpmvSs2hhQ-_1a'

function fmtCL(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${String(d).padStart(2,'0')}-${String(m).padStart(2,'0')}-${y}`
}

async function api(url, { method = 'GET', token, body } = {}) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res  = await fetch(url, opts)
  const data = await res.json()
  if (data.error) {
    if (data.error.code === 401 || data.error.code === 403)
      throw new Error('RECONNECT_DRIVE')
    throw new Error(data.error.message || JSON.stringify(data.error))
  }
  return data
}

export async function exportarRevisionSheets({ causasActivas, rcRows, periodStart, periodEnd }) {
  const token = await getValidDriveToken()

  // ── Tareas ──────────────────────────────────────────────────────────────────
  const causaIds = causasActivas.map(c => c.id).filter(Boolean)
  const { data: tareas = [] } = await supabase
    .from('tareas')
    .select('id,titulo,estado,causa_id,fecha_vencimiento,fecha_completada,created_at')
    .in('causa_id', causaIds)

  const rcMap = new Map(rcRows.map(r => [String(r.causa_id), r]))
  const tareasMap = new Map()
  for (const t of tareas) {
    const cid = String(t.causa_id)
    if (!tareasMap.has(cid)) tareasMap.set(cid, [])
    tareasMap.get(cid).push(t)
  }

  // ── Listas ──────────────────────────────────────────────────────────────────
  const revisadas = causasActivas
    .filter(c => rcMap.has(String(c.id)))
    .sort((a, b) => (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '', 'es'))

  const noRevisadas = causasActivas
    .filter(c => !rcMap.has(String(c.id)))
    .sort((a, b) => (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '', 'es'))

  const tareasPend = tareas.filter(t => t.estado !== 'Completada' && t.estado !== 'Cancelada')

  function buildRow(causa, revisada) {
    const rc  = revisada ? rcMap.get(String(causa.id)) : null
    const ts  = tareasMap.get(String(causa.id)) || []
    const pend = ts.filter(t => t.estado !== 'Completada' && t.estado !== 'Cancelada')
    const comp = ts.filter(t =>
      t.estado === 'Completada' &&
      t.fecha_completada &&
      t.fecha_completada.slice(0, 10) >= periodStart
    )
    const pendTxt = pend.map(t =>
      t.fecha_vencimiento ? `• ${t.titulo} (${fmtCL(t.fecha_vencimiento)})` : `• ${t.titulo}`
    ).join('\n')
    const compTxt = comp.map(t => `• ${t.titulo}`).join('\n')

    return [
      false,
      causa.cliente_nombre || '',
      causa.materia || '',
      causa.rit || '',
      causa.tribunal || '',
      rc?.nota || '',
      pendTxt,
      compTxt,
    ]
  }

  const revisadasRows  = revisadas.map(c => buildRow(c, true))
  const noRevisadasRows = noRevisadas.map(c => buildRow(c, false))

  // ── Valores de la hoja ─────────────────────────────────────────────────────
  const today  = new Date().toISOString().slice(0, 10)
  const COLS   = 8
  const empty  = () => Array(COLS).fill('')

  const values = [
    [`Revisión de Causas — Período ${fmtCL(periodStart)} al ${fmtCL(periodEnd)}`, ...Array(COLS - 1).fill('')],
    [`Exportado: ${fmtCL(today)}   ·   ${revisadas.length} de ${causasActivas.length} causas revisadas   ·   ${tareasPend.length} tareas pendientes`, ...Array(COLS - 1).fill('')],
    empty(),
    ['✓', 'CLIENTE', 'MATERIA', 'RIT / ROL', 'TRIBUNAL', 'NOTA DE REVISIÓN', 'TAREAS PENDIENTES', 'COMPLETADAS EN PERÍODO'],
    ...revisadasRows,
  ]

  if (noRevisadas.length > 0) {
    values.push(empty())
    values.push([`⚠  CAUSAS NO REVISADAS EN ESTE PERÍODO (${noRevisadas.length})`, ...Array(COLS - 1).fill('')])
    values.push(...noRevisadasRows)
  }

  // ── Crear hoja ─────────────────────────────────────────────────────────────
  const title = `Revisión ${fmtCL(periodStart)} – ${fmtCL(periodEnd)}`
  const sheet = await api(SHEETS_API, {
    method: 'POST', token,
    body: {
      properties: { title, locale: 'es_CL' },
      sheets: [{ properties: { title: 'Revisión', sheetId: 0 } }],
    },
  })
  const spreadsheetId = sheet.spreadsheetId
  const sheetId = 0

  // ── Escribir valores ───────────────────────────────────────────────────────
  await api(`${SHEETS_API}/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT', token,
    body: { values },
  })

  // ── Formateo ───────────────────────────────────────────────────────────────
  const nRev = revisadasRows.length
  const requests = []

  const navy = { red: 0.102, green: 0.180, blue: 0.290 }
  const blue = { red: 0.145, green: 0.439, blue: 0.729 }
  const white = { red: 1, green: 1, blue: 1 }

  // Fila 1 — título
  requests.push({ repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLS },
    cell: { userEnteredFormat: {
      backgroundColor: navy,
      textFormat: { bold: true, fontSize: 13, foregroundColor: white },
      verticalAlignment: 'MIDDLE',
      padding: { top: 10, bottom: 10, left: 12, right: 12 },
    }},
    fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
  }})

  // Fila 2 — metadata
  requests.push({ repeatCell: {
    range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: COLS },
    cell: { userEnteredFormat: {
      backgroundColor: blue,
      textFormat: { fontSize: 10, foregroundColor: white },
      verticalAlignment: 'MIDDLE',
      padding: { top: 6, bottom: 6, left: 12, right: 12 },
    }},
    fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
  }})

  // Fila 4 — cabeceras de columnas
  requests.push({ repeatCell: {
    range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: COLS },
    cell: { userEnteredFormat: {
      backgroundColor: navy,
      textFormat: { bold: true, fontSize: 10, foregroundColor: white },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
      padding: { top: 8, bottom: 8, left: 8, right: 8 },
    }},
    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
  }})

  // Merge fila 1 y 2
  requests.push({ mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: 'MERGE_ALL' } })
  requests.push({ mergeCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: 'MERGE_ALL' } })

  // Fijar 4 filas
  requests.push({ updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount: 4 } },
    fields: 'gridProperties.frozenRowCount',
  }})

  // Anchos de columna (A–H)
  ;[70, 180, 150, 110, 160, 260, 260, 200].forEach((px, i) => {
    requests.push({ updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    }})
  })

  // Filas de datos — wrap + align
  if (nRev > 0) {
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 4 + nRev, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
      fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
    }})
    // Checkboxes en columna A
    requests.push({ setDataValidation: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 4 + nRev, startColumnIndex: 0, endColumnIndex: 1 },
      rule: { condition: { type: 'BOOLEAN' }, showCustomUi: true },
    }})
    // Centrar columna A (checkboxes)
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 4 + nRev, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
      fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
    }})
    // Banding (filas alternadas)
    requests.push({ addBanding: { bandedRange: {
      range: { sheetId, startRowIndex: 4, endRowIndex: 4 + nRev, startColumnIndex: 0, endColumnIndex: COLS },
      rowProperties: {
        firstBandColor:  { red: 1, green: 1, blue: 1 },
        secondBandColor: { red: 0.965, green: 0.969, blue: 0.976 },
      },
    }}})
  }

  // Sección "no revisadas"
  if (noRevisadas.length > 0) {
    const sepRow    = 4 + nRev       // fila separadora en blanco
    const headerRow = sepRow + 1
    const dataStart = headerRow + 1
    // Cabecera sección roja
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.988, green: 0.937, blue: 0.925 },
        textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.753, green: 0.224, blue: 0.169 } },
        verticalAlignment: 'MIDDLE',
        padding: { top: 6, bottom: 6, left: 12, right: 12 },
      }},
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,padding)',
    }})
    requests.push({ mergeCells: { range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: 'MERGE_ALL' } })
    // Wrap filas no revisadas
    if (noRevisadasRows.length > 0) {
      requests.push({ repeatCell: {
        range: { sheetId, startRowIndex: dataStart, endRowIndex: dataStart + noRevisadasRows.length, startColumnIndex: 0, endColumnIndex: COLS },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      }})
    }
  }

  await api(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST', token,
    body: { requests },
  })

  // ── Mover al Shared Drive (carpeta Revisiones) ─────────────────────────────
  let targetParent = SHARED_DRIVE_ID
  try {
    const q = `name='Revisiones' and mimeType='application/vnd.google-apps.folder' and '${SHARED_DRIVE_ID}' in parents and trashed=false`
    const search = await fetch(
      `${DRIVE_FILES}?${new URLSearchParams({ q, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', driveId: SHARED_DRIVE_ID, corpora: 'drive', fields: 'files(id)' })}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json())

    if (search.files?.length > 0) {
      targetParent = search.files[0].id
    } else {
      const folder = await api(`${DRIVE_FILES}?supportsAllDrives=true`, {
        method: 'POST', token,
        body: { name: 'Revisiones', mimeType: 'application/vnd.google-apps.folder', parents: [SHARED_DRIVE_ID] },
      })
      targetParent = folder.id
    }
  } catch (_) { /* si falla, queda en My Drive */ }

  const fileMeta = await fetch(`${DRIVE_FILES}/${spreadsheetId}?fields=parents`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())

  const removeParents = (fileMeta.parents || []).join(',')
  const moved = await fetch(
    `${DRIVE_FILES}/${spreadsheetId}?${new URLSearchParams({ addParents: targetParent, removeParents, supportsAllDrives: 'true', fields: 'id,webViewLink' })}`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json())

  const url = moved.webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  return { url, title }
}
