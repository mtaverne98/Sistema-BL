import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarCheck, Plus, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

// ── ISO week helpers ───────────────────────────────────────────────────────────
function getISOYearWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function getMondayOfWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7)
  return monday
}

function shiftWeeks({ year, week }, delta) {
  const monday = getMondayOfWeek(year, week)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  return getISOYearWeek(monday)
}

function fmtIso(date) {
  return date.toISOString().slice(0, 10)
}

function semanaLabel({ year, week }) {
  const monday = getMondayOfWeek(year, week)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const fmt = d => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
  return `Semana ${week} · ${fmt(monday)} – ${fmt(sunday)}`
}

function getWeekDays(year, week) {
  const monday = getMondayOfWeek(year, week)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return fmtIso(d)
  })
}

const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MESES_FULL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmtDayHeader(iso) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} de ${MESES_FULL[parseInt(m) - 1]}`
}

function fmtHora(hora) {
  if (!hora) return ''
  return hora.slice(0, 5)
}

// ── Type config ────────────────────────────────────────────────────────────────
const TIPOS = {
  audiencia: { label: 'Audiencia', color: '#2570BA', bg: '#EBF3FB' },
  plazo:     { label: 'Plazo',     color: '#C0392B', bg: '#FDECEA' },
  tarea:     { label: 'Tarea',     color: '#C8862B', bg: '#FDF3E7' },
  reunion:   { label: 'Reunión',   color: '#7C3AED', bg: '#F3EFFE' },
}

// ── Item row in a day ──────────────────────────────────────────────────────────
function EventoItem({ tipo, label, sub, hora }) {
  const t = TIPOS[tipo]
  return (
    <div className="flex items-start gap-2 py-1.5 group">
      <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: t.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {hora && <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">{fmtHora(hora)}</span>}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ color: t.color, background: t.bg }}
          >
            {t.label.toUpperCase()}
          </span>
          <span className="text-[12px] text-gray-700 font-medium truncate">{label}</span>
        </div>
        {sub && <p className="text-[11px] text-gray-400 truncate pl-[calc(0px)] ml-[0px] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Nota con checkbox ──────────────────────────────────────────────────────────
function NotaRow({ nota, onToggle }) {
  return (
    <div className="flex items-center gap-2 py-1 group">
      <button
        onClick={() => onToggle(nota)}
        className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
        style={{
          borderColor: nota.completada ? '#1E9E6A' : '#CBD5E1',
          background: nota.completada ? '#1E9E6A' : 'transparent',
        }}
      >
        {nota.completada && <Check size={10} color="white" strokeWidth={3} />}
      </button>
      <span
        className="text-[12px] text-gray-600 leading-snug"
        style={{ textDecoration: nota.completada ? 'line-through' : 'none', color: nota.completada ? '#9CA3AF' : undefined }}
      >
        {nota.texto}
      </span>
    </div>
  )
}

// ── Inline anotar input ────────────────────────────────────────────────────────
function AnotarInput({ date, onSave }) {
  const [visible, setVisible] = useState(false)
  const [val, setVal] = useState('')
  const inputRef = useRef(null)

  function show() {
    setVisible(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  async function save() {
    const t = val.trim()
    if (!t) { setVisible(false); return }
    await onSave(date, t)
    setVal('')
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  if (!visible) {
    return (
      <button
        onClick={show}
        className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-[#2570BA] transition-colors mt-1 py-0.5 group"
      >
        <Plus size={11} />
        <span>anotar</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); save() }
          if (e.key === 'Escape') { setVisible(false); setVal('') }
        }}
        onBlur={() => { if (!val.trim()) setVisible(false) }}
        placeholder="Anotar…"
        className="flex-1 text-[12px] bg-transparent border-0 outline-none placeholder:text-gray-300 text-gray-700"
      />
      <span className="text-[10px] text-gray-300">↵</span>
    </div>
  )
}

// ── Day block ──────────────────────────────────────────────────────────────────
function DayBlock({ iso, dayIndex, isToday, audiencias, plazos, tareas, reuniones, notas, onToggleNota, onAddNota }) {
  const hasItems = (audiencias.length + plazos.length + tareas.length + reuniones.length + notas.length) > 0
  const isEmpty = !hasItems

  const [,, d] = iso.split('-')
  const dayLabel = `${DIAS_FULL[dayIndex]}, ${fmtDayHeader(iso)}`

  // Días vacíos que no son hoy: línea compacta
  if (isEmpty && !isToday) {
    return (
      <div
        className="flex items-center gap-4 px-4 py-2 border-b border-gray-100"
        style={{ minHeight: 36 }}
      >
        <span className="text-[11px] text-gray-300 w-48 flex-shrink-0">{dayLabel}</span>
        <AnotarInput date={iso} onSave={onAddNota} />
      </div>
    )
  }

  // Día con contenido o hoy
  return (
    <div
      className="border-b border-gray-100"
      style={isToday ? { background: '#F0F7FF' } : undefined}
    >
      {/* Header del día */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        {isToday && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: '#2570BA', color: 'white' }}
          >
            HOY
          </span>
        )}
        <span
          className="text-[12px] font-semibold"
          style={{ color: isToday ? '#1A2E4A' : '#374151' }}
        >
          {dayLabel}
        </span>
      </div>

      {/* Eventos del sistema */}
      {(audiencias.length + plazos.length + tareas.length + reuniones.length) > 0 && (
        <div className="px-4 pb-1">
          {audiencias.map(a => (
            <EventoItem
              key={a.id}
              tipo="audiencia"
              label={a.cliente_nombre}
              sub={a.causa_rit ? `${a.causa_rit}${a.tipo ? ' · ' + a.tipo : ''}` : a.tipo}
              hora={a.hora}
            />
          ))}
          {plazos.map(p => (
            <EventoItem
              key={p.id}
              tipo="plazo"
              label={p.descripcion}
              sub={p.cliente_nombre}
            />
          ))}
          {tareas.map(t => (
            <EventoItem
              key={t.id}
              tipo="tarea"
              label={t.titulo}
              sub={t.cliente_nombre}
            />
          ))}
          {reuniones.map(r => (
            <EventoItem
              key={r.id}
              tipo="reunion"
              label={r.titulo || 'Reunión'}
              sub={null}
            />
          ))}
        </div>
      )}

      {/* Notas sueltas */}
      {notas.length > 0 && (
        <div className="px-4 pb-1">
          {notas.map(n => (
            <NotaRow key={n.id} nota={n} onToggle={onToggleNota} />
          ))}
        </div>
      )}

      {/* Anotar */}
      <div className="px-4 pb-3">
        <AnotarInput date={iso} onSave={onAddNota} />
      </div>
    </div>
  )
}

// ── Pendiente row (expandible) ─────────────────────────────────────────────────
function PendienteRow({ p, children, causas, expanded, onToggleExpand, onToggle, onAddChild, onEditNota }) {
  const [childInput, setChildInput] = useState('')
  const [showChildInput, setShowChildInput] = useState(false)
  const [notaDraft, setNotaDraft] = useState(p.notas || '')
  const childRef = useRef(null)
  const notaRef = useRef(null)

  const { year: yw, week: ww } = useMemo(() => {
    const d = p.created_at ? new Date(p.created_at) : new Date()
    return getISOYearWeek(d)
  }, [p.created_at])

  const causa = causas.find(c => c.id === p.causa_id)

  function handleChildKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const t = childInput.trim()
      if (!t) return
      onAddChild(p.id, t)
      setChildInput('')
    }
    if (e.key === 'Escape') {
      setShowChildInput(false)
      setChildInput('')
    }
  }

  function handleNotaBlur() {
    const t = notaDraft.trim()
    if (t !== (p.notas || '').trim()) {
      onEditNota(p.id, t)
    }
  }

  return (
    <div
      className="border-b border-gray-100"
      style={expanded ? { background: '#F8FAFC', borderLeft: '2px solid #2570BA' } : { borderLeft: '2px solid transparent' }}
    >
      {/* Fila principal */}
      <div className="flex items-center gap-2 px-4 py-2 group">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(p)}
          className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
          style={{
            borderColor: '#CBD5E1',
            background: 'transparent',
          }}
        >
        </button>

        {/* Texto */}
        <span className="flex-1 text-[12px] text-gray-700 leading-snug">{p.texto}</span>

        {/* Chips */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {causa && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium truncate max-w-[120px]">
              {causa.cliente_nombre}
            </span>
          )}
          {(children.length > 0 || p.notas) && (
            <span className="text-[10px] text-gray-400">{children.length > 0 ? `${children.length} punto${children.length > 1 ? 's' : ''}` : ''}</span>
          )}
        </div>

        {/* Toggle expand */}
        <button
          onClick={onToggleExpand}
          className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Expansión */}
      {expanded && (
        <div className="px-8 pb-3 space-y-1">
          {/* Punteo (children) */}
          {children.map(c => (
            <div key={c.id} className="flex items-center gap-2 py-0.5">
              <button
                onClick={() => onToggle(c)}
                className="flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center"
                style={{ borderColor: '#CBD5E1' }}
              />
              <span className="text-[11px] text-gray-600">{c.texto}</span>
            </div>
          ))}

          {/* Input nuevo punto */}
          {showChildInput ? (
            <div className="flex items-center gap-2 py-0.5">
              <div className="w-3.5 h-3.5 rounded border border-gray-200 flex-shrink-0" />
              <input
                ref={childRef}
                type="text"
                value={childInput}
                onChange={e => setChildInput(e.target.value)}
                onKeyDown={handleChildKeyDown}
                onBlur={() => { if (!childInput.trim()) setShowChildInput(false) }}
                placeholder="Nuevo punto…"
                autoFocus
                className="flex-1 text-[11px] bg-transparent border-0 outline-none placeholder:text-gray-300 text-gray-700"
              />
            </div>
          ) : (
            <button
              onClick={() => { setShowChildInput(true); setTimeout(() => childRef.current?.focus(), 20) }}
              className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-[#2570BA] transition-colors mt-0.5"
            >
              <Plus size={10} />
              <span>añadir punto</span>
            </button>
          )}

          {/* Línea separadora */}
          <div className="border-t border-dashed border-gray-200 my-2" />

          {/* Notas libres */}
          <textarea
            ref={notaRef}
            value={notaDraft}
            onChange={e => setNotaDraft(e.target.value)}
            onBlur={handleNotaBlur}
            placeholder="Notas…"
            rows={2}
            className="w-full text-[11px] text-gray-600 bg-transparent border-0 outline-none resize-none placeholder:text-gray-300 leading-relaxed"
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MiSemana() {
  const navigate = useNavigate()
  const todayAnchor = getISOYearWeek(new Date())
  const TODAY = fmtIso(new Date())

  const [anchor, setAnchor] = useState(todayAnchor)
  const [loading, setLoading] = useState(true)

  // Semana: items por fecha
  const [audByDate,     setAudByDate]     = useState({})
  const [plazosByDate,  setPlazosByDate]  = useState({})
  const [tareasByDate,  setTareasByDate]  = useState({})
  const [reunByDate,    setReunByDate]    = useState({})
  const [notasByDate,   setNotasByDate]   = useState({})

  // Pendientes
  const [pendientes,    setPendientes]    = useState([])
  const [pendInput,     setPendInput]     = useState('')
  const [pendTab,       setPendTab]       = useState('lista')
  const [expandedPend,  setExpandedPend]  = useState(null)

  // Causas (para labels en pendientes)
  const [causas, setCausas] = useState([])

  // Resolving animation
  const [resolvingIds, setResolvingIds]   = useState(new Set())
  const resolveBatches = useRef({})
  const idToBatch      = useRef({})

  const { year, week } = anchor
  const weekDays = useMemo(() => getWeekDays(year, week), [year, week])
  const mondayIso = weekDays[0]
  const sundayIso = weekDays[6]
  const isCurrentWeek = year === todayAnchor.year && week === todayAnchor.week

  // ── Fetch week data ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)

    function groupBy(arr, key) {
      return (arr || []).reduce((m, r) => {
        const k = r[key]
        if (!m[k]) m[k] = []
        m[k].push(r)
        return m
      }, {})
    }

    Promise.all([
      supabase.from('audiencias')
        .select('id, fecha, hora, rit, causa_rit, cliente_nombre, tipo')
        .gte('fecha', mondayIso).lte('fecha', sundayIso)
        .order('hora'),
      supabase.from('plazos')
        .select('id, descripcion, fecha_limite, causa_rit, cliente_nombre, urgente')
        .gte('fecha_limite', mondayIso).lte('fecha_limite', sundayIso),
      supabase.from('tareas')
        .select('id, titulo, fecha_vencimiento, cliente_nombre, estado, prioridad')
        .eq('estado', 'Pendiente')
        .gte('fecha_vencimiento', mondayIso).lte('fecha_vencimiento', sundayIso),
      supabase.from('reuniones')
        .select('id, fecha_jueves, titulo')
        .gte('fecha_jueves', mondayIso).lte('fecha_jueves', sundayIso),
      supabase.from('agenda_notas')
        .select('*')
        .gte('fecha', mondayIso).lte('fecha', sundayIso)
        .order('hora'),
    ]).then(([
      { data: audData },
      { data: plazosData },
      { data: tareasData },
      { data: reunData },
      { data: notasData },
    ]) => {
      setAudByDate(groupBy(audData, 'fecha'))
      setPlazosByDate(groupBy(plazosData, 'fecha_limite'))
      setTareasByDate(groupBy(tareasData, 'fecha_vencimiento'))
      setReunByDate(groupBy(reunData, 'fecha_jueves'))
      setNotasByDate(groupBy(notasData, 'fecha'))
      setLoading(false)
    })
  }, [mondayIso, sundayIso])

  // ── Fetch pendientes and causas (once) ─────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from('agenda_pendientes')
        .select('*')
        .eq('resuelto', false)
        .order('created_at', { ascending: true }),
      supabase.from('causas')
        .select('id, rit, cliente_nombre')
        .in('estado', ['Abierta', 'Revisar', 'En tramitación']),
    ]).then(([{ data: pData }, { data: cData }]) => {
      setPendientes(pData || [])
      setCausas(cData || [])
    })
  }, [])

  // ── Conversión de notas sin marcar de semana anterior → pendientes ──────────
  // Al montar, si hay notas sin marcar de la semana pasada, las convierte
  useEffect(() => {
    const prevWeek = shiftWeeks(todayAnchor, -1)
    const prevDays = getWeekDays(prevWeek.year, prevWeek.week)
    const prevMonday = prevDays[0]
    const prevSunday = prevDays[6]

    supabase.from('agenda_notas')
      .select('*')
      .eq('completada', false)
      .gte('fecha', prevMonday).lte('fecha', prevSunday)
      .then(async ({ data }) => {
        if (!data || data.length === 0) return
        // Convertir a pendientes
        const rows = data.map(n => ({
          texto: n.texto,
          resuelto: false,
          parent_id: null,
          origen_nota_fecha: n.fecha,
        }))
        const { data: inserted } = await supabase.from('agenda_pendientes')
          .insert(rows).select()
        // Marcar las notas como completadas para no convertirlas de nuevo
        await supabase.from('agenda_notas')
          .update({ completada: true })
          .in('id', data.map(n => n.id))
        if (inserted?.length) {
          setPendientes(prev => [...prev, ...inserted])
        }
      })
  }, []) // solo al montar

  // ── Handlers: semana ────────────────────────────────────────────────────────
  const handleAddNota = useCallback(async (date, texto) => {
    const { data, error } = await supabase.from('agenda_notas')
      .insert([{ fecha: date, texto, tipo: 'checkbox', completada: false }])
      .select().single()
    if (error) { console.error('[agenda_notas] insert:', error.message); return }
    if (data) {
      setNotasByDate(prev => ({ ...prev, [date]: [...(prev[date] || []), data] }))
    }
  }, [])

  const handleToggleNota = useCallback(async (nota) => {
    const { error } = await supabase.from('agenda_notas')
      .update({ completada: !nota.completada }).eq('id', nota.id)
    if (!error) {
      setNotasByDate(prev => ({
        ...prev,
        [nota.fecha]: (prev[nota.fecha] || []).map(n =>
          n.id === nota.id ? { ...n, completada: !n.completada } : n),
      }))
    }
  }, [])

  // ── Handlers: pendientes ────────────────────────────────────────────────────
  async function handleAddPendiente() {
    const texto = pendInput.trim()
    if (!texto) return
    setPendInput('')
    const { data, error } = await supabase.from('agenda_pendientes')
      .insert([{ texto, resuelto: false, parent_id: null }]).select().single()
    if (error) { console.error('[agenda_pendientes] insert:', error.message); return }
    if (data) setPendientes(prev => [...prev, data])
  }

  function handleTogglePendiente(p) {
    const children = pendientes.filter(x => x.parent_id === p.id)
    const ids = p.parent_id ? [p.id] : [p.id, ...children.map(c => c.id)]

    setResolvingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
    ids.forEach(id => { idToBatch.current[id] = ids[0] })

    supabase.from('agenda_pendientes')
      .update({ resuelto: true, resuelto_at: new Date().toISOString() }).in('id', ids)
      .then(({ error }) => { if (error) console.error('[agenda_pendientes] toggle:', error.message) })

    const timer = setTimeout(() => {
      setPendientes(prev => prev.filter(x => !ids.includes(x.id)))
      setResolvingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      ids.forEach(id => delete idToBatch.current[id])
      delete resolveBatches.current[ids[0]]
    }, 3000)
    resolveBatches.current[ids[0]] = { ids, timer }
  }

  function handleUndoPendiente(batchKey) {
    const batch = resolveBatches.current[batchKey]
    if (!batch) return
    clearTimeout(batch.timer)
    delete resolveBatches.current[batchKey]
    supabase.from('agenda_pendientes')
      .update({ resuelto: false, resuelto_at: null }).in('id', batch.ids)
      .then(({ error }) => { if (error) console.error('[agenda_pendientes] undo:', error.message) })
    setResolvingIds(prev => { const n = new Set(prev); batch.ids.forEach(id => n.delete(id)); return n })
    batch.ids.forEach(id => delete idToBatch.current[id])
  }

  async function handleAddChild(parentId, texto) {
    const { data, error } = await supabase.from('agenda_pendientes')
      .insert([{ texto, resuelto: false, parent_id: parentId }]).select().single()
    if (error) { console.error('[agenda_pendientes] insert child:', error.message); return }
    if (data) setPendientes(prev => [...prev, data])
  }

  async function handleEditNota(id, notas) {
    await supabase.from('agenda_pendientes').update({ notas: notas || null }).eq('id', id)
    setPendientes(prev => prev.map(p => p.id === id ? { ...p, notas } : p))
  }

  // ── Derived pendientes data ─────────────────────────────────────────────────
  const mondayDate = new Date(mondayIso + 'T00:00:00Z')

  const rootPendientes    = useMemo(() => pendientes.filter(p => !p.parent_id), [pendientes])
  const childrenByParent  = useMemo(() => {
    const m = {}
    pendientes.filter(p => p.parent_id).forEach(c => {
      if (!m[c.parent_id]) m[c.parent_id] = []
      m[c.parent_id].push(c)
    })
    return m
  }, [pendientes])

  // Split: de semanas anteriores vs esta semana
  const [pendAntes, pendEsta] = useMemo(() => {
    const antes = [], esta = []
    for (const p of rootPendientes) {
      const created = p.created_at ? new Date(p.created_at) : new Date()
      if (created < mondayDate) antes.push(p)
      else esta.push(p)
    }
    return [antes, esta]
  }, [rootPendientes, mondayDate])

  // Filtros por tab
  function filterByTab(list) {
    if (pendTab === 'por-causa') return list.filter(p => p.causa_id)
    if (pendTab === 'sin-causa') return list.filter(p => !p.causa_id)
    return list
  }

  const antesFiltered = filterByTab(pendAntes)
  const estaFiltered  = filterByTab(pendEsta)

  // Chip de semana para los de antes
  function semChip(p) {
    const d = p.created_at ? new Date(p.created_at) : new Date()
    const { year: y, week: w } = getISOYearWeek(d)
    return `Sem ${w}`
  }

  // ── Navigate ────────────────────────────────────────────────────────────────
  function handleNav(delta) {
    setAnchor(prev => shiftWeeks(prev, delta))
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#F5F6F8] overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-[#1a2e4a] px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <CalendarCheck size={15} className="text-white/80" />
          </div>
          <div>
            <h1 className="text-white font-bold text-[14px] leading-tight">Mi Semana</h1>
            <p className="text-white/40 text-[11px]">Agenda y pendientes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-white/10 rounded-xl px-1 py-1">
            <button
              onClick={() => handleNav(-1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="px-4 text-center" style={{ minWidth: 220 }}>
              <p className="text-white font-semibold text-[12px]">{semanaLabel(anchor)}</p>
              {!isCurrentWeek && (
                <p className="text-white/30 text-[10px] leading-tight">{year}</p>
              )}
            </div>
            <button
              onClick={() => handleNav(1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {!isCurrentWeek && (
            <button
              onClick={() => setAnchor(todayAnchor)}
              className="text-white/40 hover:text-white text-[11px] font-medium transition-colors"
            >
              Semana actual
            </button>
          )}
        </div>
      </div>

      {/* ── Content (scrollable) ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Sección semana ── */}
        <div className="bg-white border-b border-gray-200">
          {/* Label sección */}
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">La semana</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#1a2e4a]/20 border-t-[#1a2e4a] rounded-full animate-spin" />
            </div>
          ) : (
            <div>
              {weekDays.map((iso, i) => (
                <DayBlock
                  key={iso}
                  iso={iso}
                  dayIndex={i}
                  isToday={iso === TODAY}
                  audiencias={audByDate[iso] || []}
                  plazos={plazosByDate[iso] || []}
                  tareas={tareasByDate[iso] || []}
                  reuniones={reunByDate[iso] || []}
                  notas={notasByDate[iso] || []}
                  onToggleNota={handleToggleNota}
                  onAddNota={handleAddNota}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Sección pendientes ── */}
        <div className="bg-white">
          {/* Label sección */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pendientes</span>
            <span className="text-[10px] text-gray-300">{rootPendientes.length} sin resolver</span>
          </div>

          {/* Input nuevo pendiente */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" />
              <input
                type="text"
                value={pendInput}
                onChange={e => setPendInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPendiente() } }}
                placeholder="Anotar pendiente…"
                className="flex-1 text-[12px] text-gray-700 bg-transparent border-0 outline-none placeholder:text-gray-300"
              />
              <span className="text-[10px] text-gray-300">↵</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {[['lista', 'Lista'], ['por-causa', 'Por causa'], ['sin-causa', 'Sin causa']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPendTab(k)}
                className="px-4 py-2 text-[11px] font-medium transition-colors border-b-2"
                style={{
                  color: pendTab === k ? '#2570BA' : '#9CA3AF',
                  borderBottomColor: pendTab === k ? '#2570BA' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Resolving undo chips */}
          {resolvingIds.size > 0 && (() => {
            const batches = Object.entries(resolveBatches.current)
              .filter(([, b]) => b.ids.some(id => !pendientes.find(p => p.id === id && !resolvingIds.has(id))))
            return batches.length > 0 ? (
              <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-gray-100 bg-green-50">
                {batches.map(([key, batch]) => (
                  <button
                    key={key}
                    onClick={() => handleUndoPendiente(key)}
                    className="text-[11px] text-green-700 font-medium hover:underline"
                  >
                    Deshacer
                  </button>
                ))}
              </div>
            ) : null
          })()}

          {/* Pendientes de semanas anteriores */}
          {antesFiltered.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                  Vienen de semanas anteriores · {antesFiltered.length}
                </span>
              </div>
              {antesFiltered
                .filter(p => !resolvingIds.has(p.id))
                .map(p => (
                  <div key={p.id} className="relative">
                    <PendienteRow
                      p={p}
                      children={childrenByParent[p.id] || []}
                      causas={causas}
                      expanded={expandedPend === p.id}
                      onToggleExpand={() => setExpandedPend(prev => prev === p.id ? null : p.id)}
                      onToggle={handleTogglePendiente}
                      onAddChild={handleAddChild}
                      onEditNota={handleEditNota}
                    />
                    <span
                      className="absolute right-10 top-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#FEF3C7', color: '#92400E' }}
                    >
                      {semChip(p)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Pendientes de esta semana */}
          {estaFiltered.length > 0 && (
            <div>
              {antesFiltered.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Esta semana</span>
                </div>
              )}
              {estaFiltered
                .filter(p => !resolvingIds.has(p.id))
                .map(p => (
                  <PendienteRow
                    key={p.id}
                    p={p}
                    children={childrenByParent[p.id] || []}
                    causas={causas}
                    expanded={expandedPend === p.id}
                    onToggleExpand={() => setExpandedPend(prev => prev === p.id ? null : p.id)}
                    onToggle={handleTogglePendiente}
                    onAddChild={handleAddChild}
                    onEditNota={handleEditNota}
                  />
                ))}
            </div>
          )}

          {rootPendientes.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] text-gray-300">Sin pendientes · todo en orden</p>
            </div>
          )}

          {/* Link a página completa */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => navigate('/apuntes')}
              className="flex items-center gap-1.5 text-[11px] text-[#2570BA] hover:underline"
            >
              Ver todos los pendientes
              <ExternalLink size={11} />
            </button>
          </div>
        </div>

        {/* Espacio al pie */}
        <div className="h-8" />
      </div>
    </div>
  )
}
