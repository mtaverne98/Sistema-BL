import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, X, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return null
  const datePart = String(iso).slice(0, 10)
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return null
  return `${d}-${m}-${y}`
}

function fmtDatetime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PRIORIDAD_CFG = {
  URGENTE:          { cls: 'bg-red-100 text-red-700 border-red-300' },
  'ESTA SEMANA':    { cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  'PRÓXIMA SEMANA': { cls: 'bg-gray-100 text-gray-500 border-gray-300' },
}

const NIVEL_CFG = {
  cumplida:         { label: 'Cumplida',                       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  parcial:          { label: 'Parcialmente cumplida',          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  sin_cumplimiento: { label: 'Sin cumplimiento identificado',  cls: 'bg-red-50 text-red-600 border-red-200' },
  pendiente:        { label: 'Pendiente',                      cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  no_determinable:  { label: 'No determinable',                cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  no_aplicable:     { label: 'No aplicable',                   cls: 'bg-gray-50 text-gray-400 border-gray-200' },
}

const ALERTA_CFG = {
  rojo:     { emoji: '🔴', cls: 'bg-red-50 border-red-200' },
  amarillo: { emoji: '🟡', cls: 'bg-amber-50 border-amber-200' },
  verde:    { emoji: '🟢', cls: 'bg-emerald-50 border-emerald-200' },
  azul:     { emoji: '🔵', cls: 'bg-blue-50 border-blue-200' },
  naranja:  { emoji: '⚠️', cls: 'bg-orange-50 border-orange-200' },
}

const RECO_ESTADOS = ['evaluando', 'aceptada', 'descartada']
const RECO_ESTADO_CLS = {
  evaluando: 'bg-blue-50 text-blue-600 border-blue-200',
  aceptada:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  descartada:'bg-gray-100 text-gray-400 border-gray-200',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NivelChip({ value }) {
  const cfg = NIVEL_CFG[value] || { label: value || 'Sin evaluar', cls: 'bg-gray-50 text-gray-400 border-gray-200' }
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
}

function PrioridadChip({ value }) {
  const cfg = PRIORIDAD_CFG[value] || { cls: 'bg-gray-100 text-gray-500 border-gray-300' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.cls}`}>{value}</span>
}

function CollapsibleBlock({ title, count, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[#E3E7EC] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F7F8FA] hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <span className="text-[11.5px] font-bold text-[#1A2E4A] uppercase tracking-wide">{title}</span>
          {count != null && count > 0 && (
            <span className="text-[10px] bg-[#2570BA] text-white rounded-full px-1.5 py-0.5 font-semibold">{count}</span>
          )}
          {badge}
        </span>
      </button>
      {open && <div className="p-4 space-y-2">{children}</div>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalisisTab({
  causa,
  analisisMeta, setAnalisisMeta,
  alertasAnalisis, setAlertasAnalisis,
  faltantes, setFaltantes,
  contradicciones, setContradicciones,
  recomendaciones, setRecomendaciones,
  documentosDrive,
  diligencias,
  instrucciones,
  pendientes,
  siauRows,
  pjudRows,
  audiencias,
  tareas,
  segRows,
  editingCell, setEditingCell,
  cellDraft, setCellDraft,
  setTab,
}) {
  const [iaLoading, setIaLoading] = useState(false)
  const [iaError,   setIaError]   = useState(null)
  const [buildingEstado, setBuildingEstado] = useState(false)

  // ── Build estado modelo automatically on mount ──────────────────────────
  const buildEstadoModelo = useCallback(async () => {
    if (!causa?.id) return
    setBuildingEstado(true)
    try {
      const modelo = {
        timestamp: new Date().toISOString(),
        causa: {
          id: causa.id,
          ruc: causa.ruc,
          rit: causa.rit,
          tribunal: causa.tribunal,
          fiscalia: causa.fiscalia,
          delito: causa.delito,
          etapa_procesal: causa.etapa_procesal,
          calidad: causa.calidad,
          estado: causa.estado,
          area: causa.area,
        },
        diligencias: diligencias.map(d => ({
          nombre: d.nombre,
          estado: d.estado,
          nivel_cumplimiento: d.nivel_cumplimiento,
          fundamento: d.fundamento,
          fecha_limite: d.fecha_limite,
        })),
        siau: siauRows.map(s => ({
          tipo: s.tipo,
          descripcion: s.descripcion,
          estado: s.estado,
          fecha_solicitud: s.fecha_solicitud,
          fecha_respuesta: s.fecha_respuesta,
        })),
        pjud: pjudRows.map(p => ({
          tipo: p.tipo,
          descripcion: p.descripcion,
          estado: p.estado,
          fecha: p.fecha,
        })),
        audiencias: audiencias.map(a => ({
          tipo: a.tipo,
          fecha: a.fecha,
          resultado: a.resultado,
          estado: a.estado,
        })),
        tareas: tareas.map(t => ({
          descripcion: t.descripcion,
          estado: t.estado,
          prioridad: t.prioridad,
          fecha_limite: t.fecha_limite,
        })),
        documentos: documentosDrive.map(d => ({
          nombre: d.nombre,
          tipo: d.tipo,
          fecha_creacion: d.fecha_creacion,
        })),
        alertas: alertasAnalisis.filter(a => !a.resuelta).map(a => ({
          tipo: a.tipo,
          titulo: a.titulo,
          detalle: a.detalle,
        })),
        faltantes: faltantes.map(f => ({
          descripcion: f.descripcion,
          relevancia: f.relevancia,
          accion_sugerida: f.accion_sugerida,
        })),
        contradicciones: contradicciones.map(c => ({
          materia: c.materia,
          descripcion: c.descripcion,
          relevancia: c.relevancia,
        })),
        recomendaciones: recomendaciones.map(r => ({
          diligencia_propuesta: r.diligencia_propuesta,
          prioridad: r.prioridad,
          estado: r.estado,
          fundamento: r.fundamento,
          objetivo: r.objetivo,
        })),
        seguimiento: segRows.slice(0, 10).map(s => ({
          tipo: s.tipo,
          descripcion: s.descripcion,
          fecha: s.fecha,
        })),
      }

      await supabase
        .from('causa_analisis_meta')
        .upsert({ causa_id: causa.id, estado_modelo: modelo }, { onConflict: 'causa_id' })

      setAnalisisMeta(prev => prev ? { ...prev, estado_modelo: modelo } : { causa_id: causa.id, estado_modelo: modelo })
    } finally {
      setBuildingEstado(false)
    }
  }, [causa, diligencias, siauRows, pjudRows, audiencias, tareas, documentosDrive, alertasAnalisis, faltantes, contradicciones, recomendaciones, segRows, setAnalisisMeta])

  useEffect(() => {
    buildEstadoModelo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [causa?.id])

  // ── Run AI analysis on demand ─────────────────────────────────────────────
  async function runAnalisisIA() {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setIaError('VITE_ANTHROPIC_API_KEY no está configurada.')
      return
    }
    if (!analisisMeta?.estado_modelo) {
      setIaError('Estado del modelo no disponible. Espera un momento.')
      return
    }

    setIaLoading(true)
    setIaError(null)

    const prompt = `Eres un asistente jurídico especializado en litigio chileno. Analiza el estado actual de esta causa legal y entrega un análisis estratégico estructurado.

DATOS DE LA CAUSA:
${JSON.stringify(analisisMeta.estado_modelo, null, 2)}

Basándote únicamente en los datos entregados, responde con un JSON válido (sin markdown, sin texto adicional) con esta estructura exacta:

{
  "resumen_ejecutivo": "Párrafo conciso (3-5 oraciones) sobre el estado actual de la causa, avances y posición estratégica.",
  "acciones_semana": [
    {
      "accion": "Descripción de la acción a tomar",
      "prioridad": "URGENTE" | "ESTA SEMANA" | "PRÓXIMA SEMANA",
      "fundamento": "Por qué esta acción es necesaria ahora"
    }
  ],
  "brechas": [
    {
      "descripcion": "Brecha o elemento faltante en la investigación",
      "relevancia": "ALTA" | "MEDIA" | "BAJA",
      "impacto": "Cómo afecta esta brecha a la estrategia"
    }
  ],
  "contradicciones": [
    {
      "descripcion": "Descripción de la contradicción o vacío identificado",
      "relevancia": "ALTA" | "MEDIA" | "BAJA"
    }
  ],
  "proxima_accion": "La acción más importante a realizar, en una oración directa.",
  "proxima_accion_fundamento": "Fundamento estratégico de por qué esta es la próxima acción prioritaria.",
  "proxima_accion_prioridad": "ALTA" | "MEDIA" | "BAJA"
}

Si no hay suficientes datos para algún campo, usa un array vacío o null. Responde SOLO con el JSON.`

    try {
      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      })

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })

      const rawText = response.content[0]?.text || ''
      let parsed
      try {
        parsed = JSON.parse(rawText)
      } catch {
        // Try to extract JSON from the response if there's extra text
        const match = rawText.match(/\{[\s\S]*\}/)
        if (!match) throw new Error(`Respuesta no es JSON válido: ${rawText.slice(0, 200)}`)
        parsed = JSON.parse(match[0])
      }

      const updates = {
        resumen_ejecutivo:        parsed.resumen_ejecutivo || null,
        acciones_semana:          parsed.acciones_semana || [],
        proxima_accion:           parsed.proxima_accion || null,
        proxima_accion_fundamento:parsed.proxima_accion_fundamento || null,
        proxima_accion_prioridad: parsed.proxima_accion_prioridad || null,
        analisis_ia_at:           new Date().toISOString(),
        analisis_ia_version:      (analisisMeta?.analisis_ia_version || 0) + 1,
      }

      await supabase
        .from('causa_analisis_meta')
        .upsert({ causa_id: causa.id, ...updates }, { onConflict: 'causa_id' })

      setAnalisisMeta(prev => ({ ...(prev || { causa_id: causa.id }), ...updates }))

      // If AI returned brechas/contradicciones, save them too
      if (parsed.brechas?.length) {
        await supabase.from('causa_faltantes').delete().eq('causa_id', causa.id)
        const newFaltantes = parsed.brechas.map(b => ({
          causa_id: causa.id,
          descripcion: b.descripcion,
          relevancia: b.relevancia,
          accion_sugerida: b.impacto,
          revisado: true,
        }))
        const { data: insertedF } = await supabase.from('causa_faltantes').insert(newFaltantes).select()
        if (insertedF) setFaltantes(insertedF)
      }

      if (parsed.contradicciones?.length) {
        // Only add new ones that don't already exist
        const { data: newC } = await supabase
          .from('causa_contradicciones')
          .insert(parsed.contradicciones.map(c => ({
            causa_id: causa.id,
            materia: 'IA',
            descripcion: c.descripcion,
            relevancia: c.relevancia,
            revisado: false,
          })))
          .select()
        if (newC) setContradicciones(prev => [...newC, ...prev])
      }
    } catch (err) {
      setIaError(err.message || String(err))
    } finally {
      setIaLoading(false)
    }
  }

  // ── Inline edit helpers ───────────────────────────────────────────────────
  const REVISADO_SETTERS = {
    causa_alertas:         setAlertasAnalisis,
    causa_faltantes:       setFaltantes,
    causa_contradicciones: setContradicciones,
    causa_recomendaciones: setRecomendaciones,
  }

  async function commitAnalisisField(table, id, field, rawValue) {
    setEditingCell(null)
    const value = typeof rawValue === 'string' ? (rawValue.trim() || null) : rawValue
    if (table === 'causa_analisis_meta') {
      setAnalisisMeta(prev => prev ? { ...prev, [field]: value } : prev)
      await supabase.from('causa_analisis_meta').update({ [field]: value }).eq('causa_id', causa.id)
      return
    }
    const setter = REVISADO_SETTERS[table]
    setter(prev => prev.map(x => x.id === id ? { ...x, [field]: value, revisado: true } : x))
    await supabase.from(table).update({ [field]: value, revisado: true }).eq('id', id)
  }

  async function deleteAnalisisRow(table, id) {
    if (!window.confirm('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return
    const setter = REVISADO_SETTERS[table]
    setter(prev => prev.filter(x => x.id !== id))
    await supabase.from(table).delete().eq('id', id)
  }

  async function addAnalisisRow(table, defaults, focusField) {
    const { data, error } = await supabase.from(table)
      .insert({ causa_id: causa.id, revisado: true, ...defaults })
      .select().single()
    if (!error && data) {
      REVISADO_SETTERS[table](prev => [data, ...prev])
      if (focusField) { setEditingCell({ id: data.id, field: focusField }); setCellDraft(defaults[focusField] ?? '') }
    }
  }

  async function toggleAlertaResuelta(a) {
    const nuevo = !a.resuelta
    setAlertasAnalisis(prev => prev.map(x => x.id === a.id ? { ...x, resuelta: nuevo } : x))
    await supabase.from('causa_alertas').update({ resuelta: nuevo }).eq('id', a.id)
  }

  async function marcarRevisado(table, id) {
    REVISADO_SETTERS[table](prev => prev.map(x => x.id === id ? { ...x, revisado: true } : x))
    await supabase.from(table).update({ revisado: true }).eq('id', id)
  }

  async function commitRecoEstado(id, value) {
    setEditingCell(null)
    setRecomendaciones(prev => prev.map(r => r.id === id ? { ...r, estado: value } : r))
    await supabase.from('causa_recomendaciones').update({ estado: value }).eq('id', id)
  }

  // ── Inline edit sub-components ────────────────────────────────────────────
  function NuevoTag({ table, id }) {
    return (
      <button
        onClick={e => { e.stopPropagation(); marcarRevisado(table, id) }}
        title="Nuevo — clic para marcar como revisado"
        className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
      >
        🆕 nuevo
      </button>
    )
  }

  function DeleteRowBtn({ table, id }) {
    return (
      <button
        onClick={e => { e.stopPropagation(); deleteAnalisisRow(table, id) }}
        title="Eliminar"
        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
      >
        <X size={12} />
      </button>
    )
  }

  function AnalisisText({ table, id, field, value, multiline = false, rows = 3, placeholder = '—', className = '' }) {
    const isEdit = editingCell?.id === id && editingCell?.field === field
    if (isEdit) {
      const props = {
        autoFocus: true,
        value: cellDraft,
        onChange: e => setCellDraft(e.target.value),
        onBlur: () => commitAnalisisField(table, id, field, cellDraft),
        onKeyDown: e => {
          if (!multiline && e.key === 'Enter') { e.preventDefault(); commitAnalisisField(table, id, field, cellDraft) }
          if (e.key === 'Escape') setEditingCell(null)
        },
        onClick: e => e.stopPropagation(),
        className: `w-full bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none ${className}`,
      }
      return multiline ? <textarea rows={rows} {...props} /> : <input {...props} />
    }
    return (
      <span
        onClick={e => { e.stopPropagation(); setEditingCell({ id, field }); setCellDraft(value ?? '') }}
        className={`cursor-text hover:bg-gray-50 rounded px-0.5 ${!value ? 'text-gray-300 italic' : ''} ${className}`}
      >
        {value || placeholder}
      </span>
    )
  }

  function AnalisisSelect({ table, id, field, value, options }) {
    const isEdit = editingCell?.id === id && editingCell?.field === field
    if (isEdit) {
      return (
        <select autoFocus value={cellDraft} onChange={e => setCellDraft(e.target.value)}
                onBlur={() => commitAnalisisField(table, id, field, cellDraft)}
                onClick={e => e.stopPropagation()}
                className="text-[10px] border border-blue-300 rounded px-1 py-0.5 outline-none">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <span onClick={e => { e.stopPropagation(); setEditingCell({ id, field }); setCellDraft(value || options[0]) }}
            className="cursor-pointer text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100">
        {value || options[0]}
      </span>
    )
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const docsById = {}
  for (const d of documentosDrive) docsById[d.id] = d

  function DocLink({ id, fallback = '—' }) {
    const d = docsById[id]
    if (!d) return <span className="text-gray-300 italic">{fallback}</span>
    return (
      <a href={d.url || undefined} target="_blank" rel="noreferrer"
         className="inline-flex items-center gap-1 text-[#2570BA] hover:underline">
        <Link2 size={10} /> {d.nombre}
      </a>
    )
  }

  const dilByInstr = {}
  const dilSinInstr = []
  for (const dl of diligencias) {
    if (dl.instruccion_id) (dilByInstr[dl.instruccion_id] ||= []).push(dl)
    else dilSinInstr.push(dl)
  }

  const eventos = []
  for (const i of instrucciones) {
    if (i.fecha) eventos.push({ fecha: i.fecha, tipo: 'Instrucción/solicitud', label: `${i.numero_oficio || 'Sin número de oficio'} — ${i.autoridad || 'Autoridad no identificada'}`, documento_id: i.documento_origen_id })
  }
  for (const d of documentosDrive) {
    if (d.fecha_creacion) eventos.push({ fecha: d.fecha_creacion, tipo: 'Documento incorporado', label: d.tipo || '—', documento_id: d.id })
  }
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const accionesSemana = analisisMeta?.acciones_semana || []
  const alertasActivas = alertasAnalisis.filter(a => !a.resuelta)
  const sinRevisar = [...alertasAnalisis, ...faltantes, ...contradicciones, ...recomendaciones].filter(x => x.revisado === false)

  if (!causa?.id) return null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-5 space-y-4">

        {/* ── ZONA 1: QUÉ HACER ESTA SEMANA ─────────────────────────────── */}
        <div className="border-l-4 border-[#2570BA] bg-[#EBF2FA] rounded-r-lg px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[11px] font-bold text-[#2570BA] uppercase tracking-wider">Qué hacer esta semana</h2>
              {analisisMeta?.analisis_ia_at && (
                <p className="text-[9px] text-[#2570BA]/60 mt-0.5">
                  Último análisis IA: {fmtDatetime(analisisMeta.analisis_ia_at)}
                  {analisisMeta.analisis_ia_version ? ` · v${analisisMeta.analisis_ia_version}` : ''}
                </p>
              )}
            </div>
            <button
              onClick={runAnalisisIA}
              disabled={iaLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[#2570BA] text-white hover:bg-[#1a5a9e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={12} className={iaLoading ? 'animate-spin' : ''} />
              {iaLoading ? 'Analizando…' : '⟳ Actualizar análisis'}
            </button>
          </div>

          {iaError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <p className="text-[11px] text-red-700 font-semibold">Error al llamar a la IA:</p>
              <p className="text-[10.5px] text-red-600 mt-0.5 font-mono break-all">{iaError}</p>
            </div>
          )}

          {accionesSemana.length === 0 ? (
            <p className="text-[11.5px] text-[#2570BA]/50 italic py-2">
              {analisisMeta?.analisis_ia_at
                ? 'Sin acciones para esta semana según el último análisis.'
                : 'Presiona "⟳ Actualizar análisis" para generar las acciones de esta semana con IA.'}
            </p>
          ) : (
            <div className="space-y-2">
              {accionesSemana.map((acc, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-white/70 rounded-md px-3 py-2">
                  <PrioridadChip value={acc.prioridad} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-semibold text-gray-800">{acc.accion}</p>
                    {acc.fundamento && <p className="text-[10.5px] text-gray-500 mt-0.5">{acc.fundamento}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RESUMEN EJECUTIVO ──────────────────────────────────────────── */}
        <div className="bg-white border border-[#E3E7EC] rounded-lg p-4">
          <h3 className="text-[10.5px] font-bold text-[#1A2E4A] uppercase tracking-wide mb-2">Resumen ejecutivo</h3>
          {analisisMeta ? (
            <>
              <AnalisisText
                table="causa_analisis_meta" id="meta" field="resumen_ejecutivo" multiline rows={6}
                value={analisisMeta.resumen_ejecutivo} placeholder="Sin resumen registrado. Usa el análisis IA o escribe uno manualmente."
                className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap block w-full"
              />
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 text-[10px] text-gray-400">
                Última sincronización: {fmtDate(analisisMeta.fecha_ultima_sincronizacion) || 'no registrada'}
                {analisisMeta.drive_folder_id && (
                  <> · <a className="text-[#2570BA] hover:underline" target="_blank" rel="noreferrer"
                          href={`https://drive.google.com/drive/folders/${analisisMeta.drive_folder_id}`}>Ver carpeta en Drive</a></>
                )}
              </div>
            </>
          ) : (
            <p className="text-[12px] text-gray-400 italic">Todavía no hay análisis para esta causa.</p>
          )}
        </div>

        {/* ── ZONA 2: BLOQUES COLAPSABLES ───────────────────────────────── */}

        {/* Próxima acción */}
        <CollapsibleBlock
          title="Próxima acción"
          defaultOpen={true}
          badge={analisisMeta?.proxima_accion_prioridad && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${PRIORIDAD_CFG[analisisMeta.proxima_accion_prioridad === 'ALTA' ? 'URGENTE' : analisisMeta.proxima_accion_prioridad === 'MEDIA' ? 'ESTA SEMANA' : 'PRÓXIMA SEMANA']?.cls || 'bg-gray-100 text-gray-500 border-gray-300'}`}>
              {analisisMeta.proxima_accion_prioridad}
            </span>
          )}
        >
          {analisisMeta ? (
            <div className="bg-[#1A2E4A] text-white rounded-lg p-4">
              <AnalisisText table="causa_analisis_meta" id="meta" field="proxima_accion" multiline rows={2}
                value={analisisMeta.proxima_accion} placeholder="Sin próxima acción registrada."
                className="text-[12px] leading-relaxed block text-white placeholder:text-white/40" />
              <AnalisisText table="causa_analisis_meta" id="meta" field="proxima_accion_fundamento" multiline rows={2}
                value={analisisMeta.proxima_accion_fundamento} placeholder="Sin fundamento registrado."
                className="text-[10.5px] text-white/70 mt-2 leading-relaxed block" />
              <div className="mt-2">
                <AnalisisSelect table="causa_analisis_meta" id="meta" field="proxima_accion_prioridad"
                  value={analisisMeta.proxima_accion_prioridad} options={['ALTA', 'MEDIA', 'BAJA']} />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-300 italic">Sin próxima acción registrada.</p>
          )}
        </CollapsibleBlock>

        {/* Brechas / Faltantes */}
        <CollapsibleBlock
          title="Brechas / Faltantes"
          count={faltantes.length}
          defaultOpen={faltantes.length > 0}
        >
          <div className="flex justify-end mb-1">
            <button onClick={() => addAnalisisRow('causa_faltantes', { descripcion: 'Nuevo faltante', relevancia: 'MEDIA', accion_sugerida: '', estado: 'pendiente' }, 'descripcion')}
                    className="text-[10px] text-[#2570BA] hover:underline">+ agregar</button>
          </div>
          {faltantes.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin brechas o faltantes identificados.</p>
            : faltantes.map(f => (
            <div key={f.id} className="bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <AnalisisText table="causa_faltantes" id={f.id} field="descripcion" multiline rows={2}
                  value={f.descripcion} className="text-[11px] text-blue-800 flex-1 block" />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {f.revisado === false && <NuevoTag table="causa_faltantes" id={f.id} />}
                  <DeleteRowBtn table="causa_faltantes" id={f.id} />
                </div>
              </div>
              <p className="text-[10px] text-blue-500 mt-0.5 flex items-center gap-1 flex-wrap">
                Relevancia: <AnalisisSelect table="causa_faltantes" id={f.id} field="relevancia" value={f.relevancia} options={['ALTA', 'MEDIA', 'BAJA']} /> ·
                <AnalisisText table="causa_faltantes" id={f.id} field="accion_sugerida" value={f.accion_sugerida} placeholder="Sin acción sugerida." className="flex-1" />
              </p>
            </div>
          ))}
        </CollapsibleBlock>

        {/* Contradicciones / Vacíos */}
        <CollapsibleBlock
          title="Contradicciones / Vacíos"
          count={contradicciones.length}
          defaultOpen={contradicciones.length > 0}
        >
          <div className="flex justify-end mb-1">
            <button onClick={() => addAnalisisRow('causa_contradicciones', { materia: 'Contradicción', descripcion: 'Nueva contradicción o vacío' }, 'materia')}
                    className="text-[10px] text-[#2570BA] hover:underline">+ agregar</button>
          </div>
          {contradicciones.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin contradicciones o vacíos registrados.</p>
            : contradicciones.map(c => (
            <div key={c.id} className={`border rounded-md px-3 py-2 ${c.materia === 'Vacío investigativo' ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <AnalisisText table="causa_contradicciones" id={c.id} field="materia" value={c.materia}
                  className="text-[10px] font-semibold uppercase tracking-wide text-gray-500" />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.revisado === false && <NuevoTag table="causa_contradicciones" id={c.id} />}
                  <DeleteRowBtn table="causa_contradicciones" id={c.id} />
                </div>
              </div>
              {(c.fuente_1_version || c.fuente_2_version) ? (
                <>
                  <p className="text-[11px] text-gray-700 flex gap-1">
                    <DocLink id={c.fuente_1_documento_id} fallback="Fuente 1" />:
                    <AnalisisText table="causa_contradicciones" id={c.id} field="fuente_1_version" multiline rows={2}
                      value={c.fuente_1_version} placeholder="Sin versión de la fuente 1." className="flex-1" />
                  </p>
                  <p className="text-[11px] text-gray-700 mt-0.5 flex gap-1">
                    <DocLink id={c.fuente_2_documento_id} fallback="Fuente 2" />:
                    <AnalisisText table="causa_contradicciones" id={c.id} field="fuente_2_version" multiline rows={2}
                      value={c.fuente_2_version} placeholder="Sin versión de la fuente 2." className="flex-1" />
                  </p>
                </>
              ) : (
                <AnalisisText table="causa_contradicciones" id={c.id} field="descripcion" multiline rows={2}
                  value={c.descripcion} className="text-[11px] text-gray-700 block" />
              )}
              <p className="text-[10px] text-gray-400 mt-1">Relevancia:{' '}
                <AnalisisText table="causa_contradicciones" id={c.id} field="relevancia" value={c.relevancia} placeholder="—" /></p>
            </div>
          ))}
        </CollapsibleBlock>

        {/* Alertas */}
        <CollapsibleBlock
          title={`Alertas (${alertasActivas.length} activas)`}
          count={sinRevisar.filter(x => alertasAnalisis.some(a => a.id === x.id)).length}
          defaultOpen={alertasActivas.length > 0}
        >
          <div className="flex justify-end mb-1">
            <button onClick={() => addAnalisisRow('causa_alertas', { tipo: 'azul', titulo: 'Nueva alerta', detalle: '', resuelta: false }, 'titulo')}
                    className="text-[10px] text-[#2570BA] hover:underline">+ agregar</button>
          </div>
          {alertasAnalisis.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin alertas registradas.</p>
            : alertasAnalisis.map(a => {
            const cfg = ALERTA_CFG[a.tipo] || { emoji: '•', cls: 'bg-gray-50 border-gray-200' }
            return (
              <div key={a.id} className={`flex items-start gap-2 border rounded-md px-2.5 py-1.5 ${cfg.cls} ${a.resuelta ? 'opacity-40' : ''}`}>
                <input type="checkbox" checked={!!a.resuelta} onChange={() => toggleAlertaResuelta(a)}
                       className="mt-0.5 w-3 h-3 accent-[#2570BA] flex-shrink-0" title="Marcar como resuelta" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1 min-w-0">
                      <AnalisisSelect table="causa_alertas" id={a.id} field="tipo" value={a.tipo} options={['rojo', 'amarillo', 'verde', 'azul', 'naranja']} />
                      <AnalisisText table="causa_alertas" id={a.id} field="titulo" value={a.titulo}
                        className={`text-[11px] font-semibold ${a.resuelta ? 'line-through text-gray-400' : 'text-gray-800'}`} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {a.revisado === false && <NuevoTag table="causa_alertas" id={a.id} />}
                      <DeleteRowBtn table="causa_alertas" id={a.id} />
                    </div>
                  </div>
                  <AnalisisText table="causa_alertas" id={a.id} field="detalle" multiline rows={2} value={a.detalle}
                    placeholder="Sin detalle." className="text-[10.5px] text-gray-500 mt-0.5 block" />
                </div>
              </div>
            )
          })}
        </CollapsibleBlock>

        {/* Recomendaciones / Acciones */}
        <CollapsibleBlock
          title="Diligencias recomendadas"
          count={recomendaciones.filter(r => r.estado === 'evaluando').length || null}
          defaultOpen={recomendaciones.length > 0}
        >
          <div className="flex justify-end mb-1">
            <button onClick={() => addAnalisisRow('causa_recomendaciones', { diligencia_propuesta: 'Nueva recomendación', prioridad: 'MEDIA', estado: 'evaluando' }, 'diligencia_propuesta')}
                    className="text-[10px] text-[#2570BA] hover:underline">+ agregar</button>
          </div>
          {recomendaciones.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin recomendaciones registradas.</p>
            : recomendaciones.map(r => {
            const isEdit = editingCell?.id === r.id && editingCell?.field === 'estado'
            return (
              <div key={r.id} className="bg-white border border-[#E3E7EC] rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <AnalisisText table="causa_recomendaciones" id={r.id} field="diligencia_propuesta" value={r.diligencia_propuesta}
                    className="text-[11.5px] font-semibold text-gray-800 flex-1" />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.revisado === false && <NuevoTag table="causa_recomendaciones" id={r.id} />}
                    <DeleteRowBtn table="causa_recomendaciones" id={r.id} />
                    <AnalisisSelect table="causa_recomendaciones" id={r.id} field="prioridad" value={r.prioridad} options={['ALTA', 'MEDIA', 'BAJA']} />
                    {isEdit ? (
                      <select autoFocus value={cellDraft} onChange={e => setCellDraft(e.target.value)}
                              onBlur={() => commitRecoEstado(r.id, cellDraft)}
                              className="text-[10px] border border-blue-300 rounded px-1 py-0.5 outline-none">
                        {RECO_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span onClick={() => { setEditingCell({ id: r.id, field: 'estado' }); setCellDraft(r.estado || 'evaluando') }}
                            className={`cursor-pointer text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${RECO_ESTADO_CLS[r.estado] || RECO_ESTADO_CLS.evaluando}`}>
                        {r.estado || 'evaluando'}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10.5px] text-gray-500 mt-1"><span className="font-medium text-gray-600">Fundamento:</span>{' '}
                  <AnalisisText table="causa_recomendaciones" id={r.id} field="fundamento" multiline rows={2} value={r.fundamento} placeholder="Sin fundamento." /></p>
                <p className="text-[10.5px] text-gray-500 mt-0.5"><span className="font-medium text-gray-600">Objetivo:</span>{' '}
                  <AnalisisText table="causa_recomendaciones" id={r.id} field="objetivo" multiline rows={2} value={r.objetivo} placeholder="Sin objetivo." /></p>
              </div>
            )
          })}
        </CollapsibleBlock>

        {/* Diligencias (read-only resumen) */}
        <CollapsibleBlock title="Diligencias" count={diligencias.length}>
          {diligencias.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin diligencias registradas — ver pestaña Diligencias.</p>
            : diligencias.map(dl => (
            <div key={dl.id} className="bg-white border border-[#E3E7EC] rounded-md px-3 py-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11.5px] font-semibold text-gray-800">{dl.nombre}</p>
                <NivelChip value={dl.nivel_cumplimiento} />
              </div>
              {dl.fundamento && <p className="text-[10.5px] text-gray-500 mt-1 leading-relaxed">{dl.fundamento}</p>}
            </div>
          ))}
        </CollapsibleBlock>

        {/* Checklist de pendientes */}
        <CollapsibleBlock title="Checklist pendientes" count={pendientes.filter(p => !p.parent_id).length}>
          <div className="flex justify-end mb-1">
            <button onClick={() => setTab('pendientes')} className="text-[10px] text-[#2570BA] hover:underline">Ir a Pendientes →</button>
          </div>
          {pendientes.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin pendientes abiertos.</p>
            : pendientes.filter(p => !p.parent_id).slice(0, 8).map(p => (
            <div key={p.id} className="flex items-center gap-2 text-[11px] text-gray-700 py-0.5">
              <span className="w-3 h-3 border border-gray-300 rounded-sm flex-shrink-0" />
              {p.texto}
            </div>
          ))}
        </CollapsibleBlock>

        {/* Línea de tiempo */}
        <CollapsibleBlock title="Línea de tiempo" count={eventos.length}>
          <p className="text-[10px] text-gray-400 mb-2">Construida a partir de fechas registradas (instrucciones y documentos).</p>
          {eventos.length === 0
            ? <p className="text-[11px] text-gray-300 italic">Sin eventos con fecha registrada.</p>
            : eventos.map((e, idx) => (
            <div key={idx} className="flex items-start gap-3 text-[11px] py-1 border-b border-gray-100 last:border-0">
              <span className="text-gray-400 tabular-nums w-20 flex-shrink-0">{fmtDate(e.fecha)}</span>
              <span className="text-gray-500 w-40 flex-shrink-0">{e.tipo}</span>
              <span className="text-gray-700 flex-1">{e.label}</span>
              <DocLink id={e.documento_id} fallback="" />
            </div>
          ))}
        </CollapsibleBlock>

        {/* Matriz de trazabilidad */}
        {instrucciones.length > 0 && (
          <CollapsibleBlock title="Matriz de trazabilidad" count={instrucciones.length}>
            <p className="text-[10px] text-gray-400 mb-2">Instrucción → diligencia → documento → nivel de cumplimiento.</p>
            <div className="space-y-3">
              {instrucciones.map(i => (
                <div key={i.id} className="border border-[#E3E7EC] rounded-lg overflow-hidden">
                  <div className="bg-[#F7F8FA] px-3 py-2 flex items-center justify-between flex-wrap gap-1">
                    <div>
                      <span className="text-[11px] font-semibold text-gray-800">{i.numero_oficio || 'Sin número de oficio'}</span>
                      <span className="text-[10px] text-gray-400 ml-2">{fmtDate(i.fecha)} · {i.autoridad}</span>
                    </div>
                    <DocLink id={i.documento_origen_id} fallback="Documento origen no encontrado" />
                  </div>
                  <div className="divide-y divide-gray-100">
                    {(dilByInstr[i.id] || []).length === 0 && (
                      <p className="text-[10.5px] text-gray-300 italic px-3 py-2">Sin diligencias vinculadas.</p>
                    )}
                    {(dilByInstr[i.id] || []).map(dl => (
                      <div key={dl.id} className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-gray-700">{dl.nombre}</span>
                        <div className="flex items-center gap-2">
                          <DocLink id={dl.documento_respuesta_id} fallback="Sin documento de respuesta" />
                          <NivelChip value={dl.nivel_cumplimiento} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {dilSinInstr.length > 0 && (
                <div className="border border-dashed border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-[#F7F8FA] px-3 py-2 text-[11px] font-semibold text-gray-500">
                    Sin instrucción particular (gestión propia de la defensa)
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dilSinInstr.map(dl => (
                      <div key={dl.id} className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-gray-700">{dl.nombre}</span>
                        <NivelChip value={dl.nivel_cumplimiento} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleBlock>
        )}

      </div>
    </div>
  )
}
