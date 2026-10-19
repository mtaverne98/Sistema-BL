import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  Numbering, LevelFormat,
} from 'docx'
import { supabase } from './supabase'

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function fmtCL(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${String(d).padStart(2,'0')}-${String(m).padStart(2,'0')}-${y}`
}

function fmtExport(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${d} de ${MESES[m-1]} de ${y}`
}

const EQUIPO_NOMBRES = {
  MT: 'Macarena Taverne',
  AB: 'María Angélica Bianchi',
  CL: 'Catalina Leiva',
}
function nombreResp(key) { return EQUIPO_NOMBRES[key] || key || '—' }

// ── Estilos base ──────────────────────────────────────────────────────────────
const NAVY  = '1A2E4A'
const BLUE  = '2570BA'
const GRAY3 = '6B7280'
const GRAY4 = '9CA3AF'
const GRAY5 = 'E5E7EB'
const GREEN = '065F46'
const GREEN_BG = 'ECFDF5'
const PAGE_W = 11906  // A4 en DXA (ancho)
const MARGIN  = 1440  // 1"

function thin() {
  return { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
}
function none() {
  return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
}

// ── Sección: encabezado ───────────────────────────────────────────────────────
function buildHeader(periodStart, periodEnd) {
  const today = new Date().toISOString().slice(0, 10)
  return [
    new Paragraph({
      children: [new TextRun({ text: 'REVISIÓN DE CAUSAS', bold: true, size: 36, color: NAVY, font: 'Calibri' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Período ${fmtCL(periodStart)} — ${fmtCL(periodEnd)}`,
        size: 24, color: BLUE, bold: true, font: 'Calibri',
      })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Exportado el ${fmtExport(today)}`,
        size: 18, color: GRAY3, italics: true, font: 'Calibri',
      })],
      spacing: { after: 400 },
    }),
    // Línea separadora
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE } },
      spacing: { after: 400 },
    }),
  ]
}

// ── Párrafo de texto normal ───────────────────────────────────────────────────
function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      size: opts.size || 20,
      bold:    opts.bold    || false,
      italics: opts.italics || false,
      color:   opts.color   || '1C2533',
      font: 'Calibri',
    })],
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0 },
    indent:  opts.indent ? { left: opts.indent } : undefined,
    alignment: opts.align || AlignmentType.LEFT,
  })
}

function pEmpty(after = 120) {
  return new Paragraph({ spacing: { after } })
}

// ── Item de tarea como fila de tabla ligera ───────────────────────────────────
function tareaRow(titulo, fechaVenc, responsable, completada = false) {
  const textColor = completada ? GRAY4 : '1C2533'
  const cw = [PAGE_W - MARGIN * 2 - 3240 - 1440, 3240, 1440]  // título, fecha, resp

  return new TableRow({
    children: [
      new TableCell({
        width: { size: cw[0], type: WidthType.DXA },
        borders: { top: none(), bottom: thin(), left: none(), right: none() },
        children: [new Paragraph({
          children: [new TextRun({
            text: titulo,
            size: 18, color: textColor, italics: completada,
            strike: completada, font: 'Calibri',
          })],
          spacing: { after: 60, before: 60 },
        })],
      }),
      new TableCell({
        width: { size: cw[1], type: WidthType.DXA },
        borders: { top: none(), bottom: thin(), left: none(), right: none() },
        children: [new Paragraph({
          children: [new TextRun({
            text: fechaVenc ? fmtCL(fechaVenc) : '—',
            size: 18, color: completada ? GRAY4 : GRAY3, font: 'Calibri',
          })],
          spacing: { after: 60, before: 60 },
          alignment: AlignmentType.CENTER,
        })],
      }),
      new TableCell({
        width: { size: cw[1], type: WidthType.DXA },
        borders: { top: none(), bottom: thin(), left: none(), right: none() },
        children: [new Paragraph({
          children: [new TextRun({
            text: nombreResp(responsable),
            size: 18, color: completada ? GRAY4 : GRAY3, font: 'Calibri',
          })],
          spacing: { after: 60, before: 60 },
          alignment: AlignmentType.RIGHT,
        })],
      }),
    ],
  })
}

function tareaHeaderRow() {
  const cw = [PAGE_W - MARGIN * 2 - 3240 - 1440, 3240, 1440]
  const cell = (text, w, align = AlignmentType.LEFT) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: { top: none(), bottom: { style: BorderStyle.SINGLE, size: 6, color: GRAY5 }, left: none(), right: none() },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F9FAFB' },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 16, bold: true, color: GRAY3, font: 'Calibri', allCaps: true })],
      spacing: { after: 60, before: 60 },
      alignment: align,
    })],
  })
  return new TableRow({
    children: [
      cell('Tarea', cw[0]),
      cell('Fecha límite', cw[1], AlignmentType.CENTER),
      cell('Responsable', cw[1], AlignmentType.RIGHT),
    ],
  })
}

function tareaTable(rows) {
  const cw = [PAGE_W - MARGIN * 2 - 3240 - 1440, 3240, 1440]
  return new Table({
    width: { size: PAGE_W - MARGIN * 2, type: WidthType.DXA },
    columnWidths: [cw[0], cw[1], cw[1]],
    borders: { top: none(), bottom: none(), left: none(), right: none(), insideH: none(), insideV: none() },
    rows: [tareaHeaderRow(), ...rows],
  })
}

// ── Sección por causa ─────────────────────────────────────────────────────────
function buildCausaSection(causa, nota, tareasPend, tareasComp) {
  const items = []

  // Materia como subtítulo
  items.push(new Paragraph({
    children: [new TextRun({ text: causa.materia || '(sin materia)', bold: true, size: 22, color: NAVY, font: 'Calibri' })],
    spacing: { before: 200, after: 60 },
  }))

  // RIT + tribunal en una línea
  const ritTrib = [causa.rit, causa.tribunal].filter(Boolean).join('   ·   ')
  if (ritTrib) {
    items.push(new Paragraph({
      children: [new TextRun({ text: ritTrib, size: 18, color: BLUE, font: 'Calibri' })],
      spacing: { after: 120 },
    }))
  }

  // Nota de revisión
  if (nota?.trim()) {
    items.push(new Paragraph({
      children: [
        new TextRun({ text: 'Nota de revisión:  ', size: 18, bold: true, color: NAVY, font: 'Calibri' }),
        new TextRun({ text: nota.trim(), size: 18, color: '374151', font: 'Calibri' }),
      ],
      spacing: { after: 120 },
    }))
  } else {
    items.push(p('Sin nota en esta revisión.', { italics: true, color: GRAY4, after: 120 }))
  }

  // Tareas pendientes
  if (tareasPend.length > 0) {
    items.push(p('Tareas pendientes', { bold: true, size: 18, color: GRAY3, after: 60, before: 120 }))
    items.push(tareaTable(tareasPend.map(t =>
      tareaRow(t.titulo, t.fecha_vencimiento, t.responsable, false)
    )))
    items.push(pEmpty(80))
  }

  // Tareas completadas en el período
  if (tareasComp.length > 0) {
    items.push(p(`Tareas completadas en el período`, { bold: true, size: 18, color: GREEN, after: 60, before: 80 }))
    items.push(tareaTable(tareasComp.map(t =>
      tareaRow(t.titulo, t.fecha_completada, t.responsable, true)
    )))
    items.push(pEmpty(80))
  }

  return items
}

// ── Sección: resumen final ────────────────────────────────────────────────────
function buildResumen(revisadasCount, totalActivas, tareasPendCount, tareasCreadas, noRevisadas) {
  const items = [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE } },
      spacing: { before: 400, after: 0 },
    }),
    pEmpty(200),
    new Paragraph({
      children: [new TextRun({ text: 'RESUMEN', bold: true, size: 28, color: NAVY, font: 'Calibri', allCaps: true })],
      spacing: { after: 240 },
    }),
  ]

  const stat = (label, value) => new Paragraph({
    children: [
      new TextRun({ text: `${label}:  `, size: 20, bold: true, color: NAVY, font: 'Calibri' }),
      new TextRun({ text: String(value), size: 20, color: '374151', font: 'Calibri' }),
    ],
    spacing: { after: 120 },
  })

  items.push(stat('Causas revisadas', `${revisadasCount} de ${totalActivas} (${totalActivas > 0 ? Math.round(revisadasCount/totalActivas*100) : 0}%)`))
  items.push(stat('Tareas pendientes al exportar', tareasPendCount))
  items.push(stat('Tareas creadas en el período', tareasCreadas))

  if (noRevisadas.length > 0) {
    items.push(pEmpty(100))
    items.push(p(`Causas no revisadas en este período (${noRevisadas.length}):`, { bold: true, size: 20, color: NAVY, after: 100 }))
    noRevisadas.forEach(nr => {
      items.push(new Paragraph({
        children: [
          new TextRun({ text: '• ', size: 18, color: BLUE, font: 'Calibri' }),
          new TextRun({ text: `${nr.cliente_nombre}`, size: 18, bold: true, color: '374151', font: 'Calibri' }),
          new TextRun({ text: `  —  ${nr.materia || '—'}`, size: 18, color: GRAY3, font: 'Calibri' }),
          nr.rit ? new TextRun({ text: `  (${nr.rit})`, size: 18, color: BLUE, font: 'Calibri' }) : new TextRun({ text: '' }),
        ],
        spacing: { after: 60 },
        indent: { left: 240 },
      }))
    })
  }

  return items
}

// ── Función principal ─────────────────────────────────────────────────────────
export async function exportarRevision({ causasActivas, rcRows, periodStart, periodEnd }) {
  // 1. Fetch tareas para todas las causas activas
  const causaIds = causasActivas.map(c => c.id).filter(Boolean)

  let tareasPorCausa = {}

  if (causaIds.length > 0) {
    const { data: todasTareas } = await supabase
      .from('tareas')
      .select('id, titulo, estado, prioridad, causa_id, fecha_vencimiento, fecha_completada, responsable, created_at')
      .in('causa_id', causaIds)

    ;(todasTareas || []).forEach(t => {
      const cid = String(t.causa_id)
      if (!tareasPorCausa[cid]) tareasPorCausa[cid] = []
      tareasPorCausa[cid].push(t)
    })
  }

  // 2. Calcular totales para el resumen
  const revisadasSet = new Set(rcRows.map(r => String(r.causa_id)))
  const revisadasCount = revisadasSet.size
  const totalActivas   = causasActivas.length

  let tareasPendTotal  = 0
  let tareasCreatedPeriodo = 0

  Object.values(tareasPorCausa).forEach(ts => {
    ts.forEach(t => {
      if (!['Completada','Cancelada'].includes(t.estado)) tareasPendTotal++
      if (t.created_at && t.created_at.slice(0,10) >= periodStart) tareasCreatedPeriodo++
    })
  })

  // 3. Causas revisadas, agrupadas por cliente (orden alfabético)
  const rcMap = {}
  rcRows.forEach(r => { rcMap[String(r.causa_id)] = r })

  const revisadasCausas = causasActivas
    .filter(c => revisadasSet.has(c.id))
    .sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es'))

  const noRevisadasCausas = causasActivas
    .filter(c => !revisadasSet.has(c.id))
    .sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es'))

  // 4. Agrupar revisadas por cliente
  const clienteMap = new Map()
  revisadasCausas.forEach(c => {
    const key = c.cliente_nombre.trim()
    if (!clienteMap.has(key)) clienteMap.set(key, [])
    clienteMap.get(key).push(c)
  })

  // 5. Construir documento
  const bodyChildren = [
    ...buildHeader(periodStart, periodEnd),
  ]

  clienteMap.forEach((causas, clienteNombre) => {
    // Encabezado de cliente
    bodyChildren.push(new Paragraph({
      children: [new TextRun({ text: clienteNombre, bold: true, size: 26, color: NAVY, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: GRAY5 } },
    }))

    causas.forEach(causa => {
      const rc       = rcMap[causa.id] || {}
      const nota     = rc.nota || ''
      const ts       = tareasPorCausa[causa.id] || []
      const pend     = ts.filter(t => !['Completada','Cancelada'].includes(t.estado))
        .sort((a, b) => (a.fecha_vencimiento||'9999').localeCompare(b.fecha_vencimiento||'9999'))
      const comp     = ts.filter(t => t.estado === 'Completada' && t.fecha_completada && t.fecha_completada.slice(0,10) >= periodStart)
        .sort((a, b) => (b.fecha_completada||'').localeCompare(a.fecha_completada||''))

      buildCausaSection(causa, nota, pend, comp).forEach(el => bodyChildren.push(el))
    })
  })

  // Resumen al final
  buildResumen(revisadasCount, totalActivas, tareasPendTotal, tareasCreatedPeriodo, noRevisadasCausas)
    .forEach(el => bodyChildren.push(el))

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: '1C2533' },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children: bodyChildren,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Revisión-${periodStart}-${periodEnd}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
