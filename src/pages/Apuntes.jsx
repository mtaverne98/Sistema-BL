import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Check, X, Undo2,
  ChevronDown, ChevronUp, ArrowRight, CalendarDays, Link2, Scale,
  Circle, CheckCircle2, ExternalLink,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isGCalEnabled, fetchExternalGCalEvents } from '../lib/googleCalendar'

// ── Constantes ────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DIAS_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES      = ['enero','febrero','marzo','abril','mayo','junio','julio',
                    'agosto','septiembre','octubre','noviembre','diciembre']

const TIPOS = {
  audiencia: { label: 'Audiencia', color: '#2570BA', bg: '#EBF3FB' },
  plazo:     { label: 'Plazo',     color: '#C0392B', bg: '#FDECEA' },
  tarea:     { label: 'Tarea',     color: '#C8862B', bg: '#FDF3E7' },
  reunion:   { label: 'Reunión',   color: '#7C3AED', bg: '#F3EFFE' },
  gcal:      { label: 'Google',    color: '#4285F4', bg: '#EEF3FD' },
}

const ACTION_VERBS = new Set([
  'llamar','enviar','revisar','preparar','solicitar',
  'mandar','subir','hacer','contactar','confirmar',
])

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function getMonday(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getISOWeek(isoDate) {
  const d  = new Date(isoDate + 'T00:00:00')
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  return Math.ceil(((dt - yearStart) / 86400000 + 1) / 7)
}

function fmtWeekRange(monday) {
  const friday = addDays(monday, 4)
  const d1 = new Date(monday + 'T00:00:00')
  const d2 = new Date(friday + 'T00:00:00')
  const m1 = MESES[d1.getMonth()]
  const m2 = MESES[d2.getMonth()]
  const y  = d1.getFullYear()
  return m1 === m2
    ? `${d1.getDate()}–${d2.getDate()} ${m1} ${y}`
    : `${d1.getDate()} ${m1} – ${d2.getDate()} ${m2} ${y}`
}

function dowShort(isoDate)  { return DIAS_CORTO[new Date(isoDate + 'T00:00:00').getDay()] }
function dowLong(isoDate)   { return DIAS_LARGO[new Date(isoDate + 'T00:00:00').getDay()] }
function dayNum(isoDate)    { return new Date(isoDate + 'T00:00:00').getDate() }
function dayMonth(isoDate)  {
  const d = new Date(isoDate + 'T00:00:00')
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}
function nowHHMM() { return new Date().toTimeString().slice(0, 5) }
function fmtHora(h) { return h ? h.slice(0, 5) : '' }

function isActionText(text) {
  return ACTION_VERBS.has(text.trim().toLowerCase().split(/\s+/)[0])
}

function detectClientName(text, clientes) {
  if (!text || !clientes.length) return null
  const lower = text.toLowerCase()
  return clientes.find(c => c.nombre && c.nombre.length > 2 &&
    lower.includes(c.nombre.toLowerCase()))?.nombre || null
}

function semChip(isoDate) {
  const w = getISOWeek(isoDate)
  return `Sem ${w}`
}

// ── ConvMenu ──────────────────────────────────────────────────────────────────
function ConvMenu({ nota, onConvert, onClose }) {
  useEffect(() => {
    const t  = setTimeout(onClose, 6000)
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => { clearTimeout(t); window.removeEventListener('keydown', fn) }
  }, [onClose])
  return (
    <div className="flex items-center gap-1 mt-1 ml-6">
      <button onClick={() => onConvert('tarea')}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#1A2E4A] text-white rounded-md hover:opacity-80">
        <ArrowRight size={9} />Tarea
      </button>
      <button onClick={() => onConvert('seguimiento')}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#2570BA]/10 text-[#2570BA] border border-[#2570BA]/20 rounded-md hover:bg-[#2570BA]/20">
        <ArrowRight size={9} />Seguimiento
      </button>
      <button onClick={onClose}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-200 rounded-md hover:text-gray-600">
        Solo nota
      </button>
    </div>
  )
}

// ── SeguimientoPicker ─────────────────────────────────────────────────────────
function SeguimientoPicker({ nota, causas, onConfirm, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])
  const filtered = useMemo(() => {
    if (!query.trim()) return causas.slice(0, 12)
    const q = query.toLowerCase()
    return causas.filter(c =>
      (c.rit || '').toLowerCase().includes(q) ||
      (c.ruc || '').toLowerCase().includes(q) ||
      (c.materia || '').toLowerCase().includes(q) ||
      (c.cliente_nombre || '').toLowerCase().includes(q)
    ).slice(0, 12)
  }, [causas, query])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-[420px] max-h-[500px] flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-[#2570BA] uppercase tracking-wide mb-1">→ Seguimiento</p>
          <p className="text-xs text-gray-700 leading-snug line-clamp-2">"{nota.texto}"</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Selecciona la causa donde registrar este seguimiento</p>
        </div>
        <div className="px-4 py-2.5 border-b border-gray-100">
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por RIT, RUC, materia o cliente…"
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2570BA] transition-colors" />
        </div>
        <div className="overflow-y-auto flex-1 py-1">
          {filtered.length === 0
            ? <p className="text-[11px] text-gray-300 text-center py-6">Sin resultados</p>
            : filtered.map(c => (
              <button key={c.id} onClick={() => onConfirm(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-[#2570BA]/5 transition-colors border-b border-gray-50 last:border-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-mono font-semibold text-[#1A2E4A]">{c.rit || c.ruc || '—'}</span>
                  <span className="text-[10px] text-gray-400 truncate">{c.cliente_nombre}</span>
                </div>
                {c.materia && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{c.materia}</p>}
              </button>
            ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="text-[11px] text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EventoItem ────────────────────────────────────────────────────────────────
function EventoItem({ tipo, label, sub, hora, href }) {
  const t = TIPOS[tipo]
  const inner = (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: t.color }} />
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ color: t.color, background: t.bg }}
      >
        {t.label.toUpperCase()}
      </span>
      {hora && <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">{fmtHora(hora)}</span>}
      <span className="text-[12px] text-gray-700 font-medium truncate flex-1">{label}</span>
      {sub && <span className="text-[11px] text-gray-400 flex-shrink-0 truncate max-w-[160px]">{sub}</span>}
    </div>
  )
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-75 transition-opacity">{inner}</a>
    : inner
}

// ── NotaRow ───────────────────────────────────────────────────────────────────
function NotaRow({ nota, onToggle, onDelete, isPast, newNotaId, onConvert }) {
  const [showConv, setShowConv] = useState(false)
  const isNew = nota.id === newNotaId

  return (
    <div className="group">
      <div className="flex items-center gap-2 py-1 hover:bg-gray-50/60 rounded px-1 -mx-1">
        <button
          onClick={() => !isPast && onToggle(nota)}
          disabled={isPast}
          className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
          style={{
            borderColor: nota.completada ? '#1E9E6A' : '#CBD5E1',
            background:  nota.completada ? '#1E9E6A' : 'transparent',
          }}
        >
          {nota.completada && <Check size={9} color="white" strokeWidth={3} />}
        </button>
        <span
          className="flex-1 text-[12px] leading-snug"
          style={{
            color: nota.completada ? '#9CA3AF' : '#374151',
            textDecoration: nota.completada ? 'line-through' : 'none',
          }}
        >
          {nota.texto}
          {nota.tag && (
            <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-medium ${
              nota.tag === 'tarea' ? 'bg-[#1A2E4A]/10 text-[#1A2E4A]' : 'bg-[#2570BA]/10 text-[#2570BA]'
            }`}>
              {nota.tag === 'tarea' ? '→ Tarea' : '→ Seguimiento'}
            </span>
          )}
        </span>
        {!isPast && !nota.completada && !nota.tag && (
          <button
            onClick={() => setShowConv(s => !s)}
            className="opacity-0 group-hover:opacity-100 text-[9px] text-[#2570BA]/50 hover:text-[#2570BA] px-1.5 py-0.5 border border-[#2570BA]/20 rounded transition-all"
          >
            convertir
          </button>
        )}
        {!isPast && (
          <button
            onClick={() => onDelete(nota)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
          >
            <X size={11} />
          </button>
        )}
      </div>
      {(showConv || (isNew && isActionText(nota.texto) && !nota.tag)) && (
        <ConvMenu
          nota={nota}
          onConvert={async tipo => { setShowConv(false); await onConvert(nota, tipo) }}
          onClose={() => setShowConv(false)}
        />
      )}
    </div>
  )
}

// ── AnotarInput ───────────────────────────────────────────────────────────────
function AnotarInput({ date, onSave, isPast }) {
  const [visible, setVisible] = useState(false)
  const [val, setVal]         = useState('')
  const inputRef = useRef(null)

  if (isPast) return null

  function show() { setVisible(true); setTimeout(() => inputRef.current?.focus(), 20) }

  async function save() {
    const t = val.trim()
    setVisible(false)
    setVal('')
    if (!t) return
    await onSave(date, t)
  }

  if (!visible) {
    return (
      <button
        onClick={show}
        className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-[#2570BA] transition-colors mt-1.5 group"
      >
        <Plus size={11} />
        <span>anotar</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-1.5">
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
        placeholder="Anotar… (Enter guarda)"
        className="flex-1 text-[12px] text-gray-700 bg-transparent border-0 outline-none placeholder:text-gray-300 border-b border-[#2570BA]/30 pb-0.5 focus:border-[#2570BA] transition-colors"
      />
    </div>
  )
}

// ── DayBlock ──────────────────────────────────────────────────────────────────
function DayBlock({
  iso, isToday, isPast,
  audiencias, plazos, tareas, reuniones, notas,
  onToggleNota, onAddNota, onDeleteNota, onConvertNota,
  clientes, gcalEventos,
}) {
  const [newNotaId,     setNewNotaId]     = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const pendingNotas   = notas.filter(n => !n.completada)
  const completedNotas = notas.filter(n =>  n.completada)
  const hiddenCount    = showCompleted ? 0 : completedNotas.length
  const gcalItems      = gcalEventos || []

  const hasItems = (audiencias.length + plazos.length + tareas.length +
                    reuniones.length + pendingNotas.length + gcalItems.length) > 0
  const isEmpty  = !hasItems && completedNotas.length === 0

  const headerLabel = `${dowShort(iso)}, ${dayMonth(iso)}`

  const handleAddNota = useCallback(async (date, text) => {
    const id = await onAddNota(date, text)
    if (id) {
      setNewNotaId(id)
      setTimeout(() => setNewNotaId(null), 8000)
    }
  }, [onAddNota])

  // Día vacío y no es hoy → línea compacta
  if (isEmpty && !isToday) {
    return (
      <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-100/80">
        <span className="text-[12px] text-gray-300 min-w-[140px]">{headerLabel}</span>
        <AnotarInput date={iso} onSave={onAddNota} isPast={isPast} />
      </div>
    )
  }

  return (
    <div
      className="border-b border-gray-100/80"
      style={isToday ? { background: '#F4F8FD', borderLeft: '2.5px solid #2570BA' } : {}}
    >
      {/* Header del día */}
      <div className="flex items-center gap-2 px-5 pt-3 pb-1">
        <span
          className="text-[13px] font-semibold"
          style={{ color: isToday ? '#2570BA' : '#374151' }}
        >
          {headerLabel}
        </span>
        {isToday && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: '#2570BA', color: 'white' }}>
            HOY
          </span>
        )}
        {hiddenCount > 0 && (
          <span className="ml-auto text-[10px] text-gray-300 tabular-nums">{hiddenCount} oculta{hiddenCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Items del sistema */}
      {(audiencias.length + plazos.length + tareas.length + reuniones.length) > 0 && (
        <div className="px-5 pb-1">
          {audiencias.map(a => (
            <EventoItem key={a.id} tipo="audiencia"
              label={a.cliente_nombre || a.causa_rit || a.rit}
              sub={a.tipo || (a.rit !== a.causa_rit ? (a.rit || a.causa_rit) : null)}
              hora={a.hora} />
          ))}
          {plazos.map(p => (
            <EventoItem key={p.id} tipo="plazo"
              label={p.descripcion}
              sub={p.cliente_nombre}
              hora={null} />
          ))}
          {tareas.map(t => (
            <EventoItem key={t.id} tipo="tarea"
              label={t.titulo}
              sub={t.cliente_nombre}
              hora={null} />
          ))}
          {reuniones.map(r => (
            <EventoItem key={r.id} tipo="reunion"
              label={r.titulo || 'Reunión'}
              sub={null}
              hora={null} />
          ))}
        </div>
      )}

      {/* Eventos externos de Google Calendar (calendar principal) */}
      {gcalItems.length > 0 && (
        <div className="px-5 pb-1">
          {gcalItems.map(e => (
            <EventoItem key={e.id} tipo="gcal"
              label={e.title}
              sub={null}
              hora={e.hora}
              href={e.htmlLink} />
          ))}
        </div>
      )}

      {/* Notas pendientes */}
      {pendingNotas.length > 0 && (
        <div className="px-5 pb-1">
          {pendingNotas.map(n => (
            <NotaRow key={n.id} nota={n}
              onToggle={onToggleNota}
              onDelete={onDeleteNota}
              onConvert={onConvertNota}
              isPast={isPast}
              newNotaId={newNotaId}
            />
          ))}
        </div>
      )}

      {/* Notas completadas (plegadas) */}
      {completedNotas.length > 0 && showCompleted && (
        <div className="px-5 pb-1">
          {completedNotas.map(n => (
            <NotaRow key={n.id} nota={n}
              onToggle={onToggleNota}
              onDelete={onDeleteNota}
              onConvert={onConvertNota}
              isPast={isPast}
              newNotaId={newNotaId}
            />
          ))}
        </div>
      )}

      {/* Toggle completadas */}
      {completedNotas.length > 0 && (
        <div className="px-5 pb-1">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
          >
            {showCompleted
              ? `▾ Ocultar ${completedNotas.length} completada${completedNotas.length !== 1 ? 's' : ''}`
              : `▸ Mostrar ${completedNotas.length} completada${completedNotas.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Anotar */}
      <div className="px-5 pb-3">
        <AnotarInput date={iso} onSave={handleAddNota} isPast={isPast} />
      </div>
    </div>
  )
}

// ── PendienteRow ──────────────────────────────────────────────────────────────
function PendienteRow({
  p, children, causas, expanded, isResolving,
  onToggleExpand, onToggle, onUndo,
  onAddChild, onEditNota, onDelete,
  weekDays, onMover, onConvertTarea, onConvertSeguimiento,
  onLink, onUnlink,
}) {
  const [childInput,     setChildInput]     = useState('')
  const [showChildInput, setShowChildInput] = useState(false)
  const [notaDraft,      setNotaDraft]      = useState(p.notas || '')
  const [linkOpen,       setLinkOpen]       = useState(false)
  const [moverOpen,      setMoverOpen]      = useState(false)
  const childRef = useRef(null)
  const notaRef  = useRef(null)

  const linkedCausa = useMemo(
    () => p.causa_id ? causas.find(c => c.id === p.causa_id) : null,
    [causas, p.causa_id]
  )

  if (isResolving) {
    return (
      <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100/80">
        <div className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
          style={{ borderColor: '#1E9E6A', background: '#1E9E6A' }}>
          <Check size={9} color="white" strokeWidth={3} />
        </div>
        <span className="flex-1 text-[12px] text-gray-300 line-through">{p.texto}</span>
        <button onClick={() => onUndo(p)}
          className="flex items-center gap-1 text-[10px] font-medium text-[#2570BA] hover:underline flex-shrink-0">
          <Undo2 size={11} /> Deshacer
        </button>
      </div>
    )
  }

  function handleNotaBlur() {
    const t = notaDraft.trim()
    if (t !== (p.notas || '').trim()) onEditNota(p.id, t)
  }

  async function addChild() {
    const t = childInput.trim()
    if (!t) return
    setChildInput('')
    await onAddChild(p.id, t)
  }

  return (
    <div
      className="border-b border-gray-100/80"
      style={expanded
        ? { background: '#F8FAFC', borderLeft: '2px solid #2570BA' }
        : { borderLeft: '2px solid transparent' }}
    >
      {/* Fila principal */}
      <div className="flex items-center gap-2 px-5 py-2 group">
        <button
          onClick={() => onToggle(p)}
          className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center hover:border-green-500 transition-colors"
          style={{ borderColor: '#CBD5E1' }}
        />
        <span className="flex-1 text-[12px] text-gray-700 leading-snug">{p.texto}</span>
        {linkedCausa && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-[#2570BA] font-medium flex-shrink-0 truncate max-w-[110px]">
            {linkedCausa.cliente_nombre?.split(' ')[0] || linkedCausa.rit || '⚖'}
          </span>
        )}
        {children.length > 0 && (
          <span className="text-[10px] text-gray-300 flex-shrink-0">
            {children.length}p
          </span>
        )}
        <button
          onClick={onToggleExpand}
          className="p-1 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expansión */}
      {expanded && (
        <div className="px-8 pb-3">
          {/* Punteo */}
          {children.map(c => (
            <div key={c.id} className="flex items-center gap-2 py-0.5">
              <button
                onClick={() => onToggle(c)}
                className="flex-shrink-0 w-3.5 h-3.5 rounded border hover:border-green-500 transition-colors"
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
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addChild() }
                  if (e.key === 'Escape') { setShowChildInput(false); setChildInput('') }
                }}
                onBlur={() => { if (!childInput.trim()) setShowChildInput(false) }}
                placeholder="Nuevo punto… (Enter)"
                autoFocus
                className="flex-1 text-[11px] bg-transparent border-0 border-b border-[#2570BA]/30 outline-none placeholder:text-gray-300 text-gray-700 pb-0.5"
              />
            </div>
          ) : (
            <button
              onClick={() => { setShowChildInput(true); setTimeout(() => childRef.current?.focus(), 20) }}
              className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-[#2570BA] transition-colors mt-0.5 mb-1"
            >
              <Plus size={10} /> añadir punto
            </button>
          )}

          {/* Separador */}
          <div className="border-t border-dashed border-gray-200 my-2" />

          {/* Notas */}
          <textarea
            ref={notaRef}
            value={notaDraft}
            onChange={e => setNotaDraft(e.target.value)}
            onBlur={handleNotaBlur}
            placeholder="Notas…"
            rows={2}
            className="w-full text-[11px] text-gray-600 bg-transparent border-0 outline-none resize-none placeholder:text-gray-300 leading-relaxed"
          />

          {/* Acciones de conversión / mover */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-gray-100">
            {!linkedCausa && (
              <div className="relative">
                <button
                  onClick={() => setLinkOpen(s => !s)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 border border-gray-200 rounded-md hover:text-[#2570BA] hover:border-blue-200 transition-colors"
                >
                  <Link2 size={9} /> Causa
                </button>
                {linkOpen && (
                  <CausaLinkDropdown
                    causas={causas}
                    onLink={id => { onLink(p, id); setLinkOpen(false) }}
                    onClose={() => setLinkOpen(false)}
                  />
                )}
              </div>
            )}
            {linkedCausa && (
              <button
                onClick={() => onUnlink(p)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#2570BA] border border-blue-200 rounded-md hover:bg-blue-50"
              >
                <Scale size={9} />{linkedCausa.cliente_nombre?.split(' ')[0]} · ×
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setMoverOpen(s => !s)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 border border-gray-200 rounded-md hover:text-gray-600"
              >
                <CalendarDays size={9} /> Mover
              </button>
              {moverOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[110px]">
                  {(weekDays || []).map(date => (
                    <button key={date} onClick={() => { setMoverOpen(false); onMover(p, date) }}
                      className="w-full text-left px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                      {dowShort(date)} {dayNum(date)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onConvertTarea(p)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[#1A2E4A] text-white rounded-md hover:opacity-80">
              <ArrowRight size={9} />Tarea
            </button>
            <button onClick={() => onConvertSeguimiento(p)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[#2570BA]/10 text-[#2570BA] border border-[#2570BA]/20 rounded-md hover:bg-[#2570BA]/20">
              <ArrowRight size={9} />Seguimiento
            </button>
            <button
              onClick={() => onDelete(p)}
              className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-red-400 border border-gray-100 rounded-md"
            >
              <X size={9} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CausaLinkDropdown ─────────────────────────────────────────────────────────
function CausaLinkDropdown({ causas, onLink, onClose }) {
  const [q, setQ]   = useState('')
  const inputRef    = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])
  const filtered = useMemo(() => {
    if (!q.trim()) return causas.slice(0, 10)
    const qlo = q.toLowerCase()
    return causas.filter(c =>
      (c.rit || '').toLowerCase().includes(qlo) ||
      (c.cliente_nombre || '').toLowerCase().includes(qlo)
    ).slice(0, 10)
  }, [q, causas])
  return (
    <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden" style={{ minWidth: 220 }}>
      <div className="p-2 border-b border-gray-100">
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="RIT, RUC o nombre…"
          className="w-full text-[11px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-[#2570BA]" />
      </div>
      <div className="max-h-40 overflow-y-auto py-1">
        {filtered.map(c => (
          <button key={c.id} onClick={() => onLink(c.id)}
            className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-blue-50 border-b border-gray-50 last:border-0">
            <span className="font-semibold text-[#1A2E4A]">{c.rit || c.ruc || '—'}</span>
            {c.cliente_nombre && <span className="text-gray-400 ml-1.5">{c.cliente_nombre}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Apuntes() {
  const [weekMonday, setWeekMonday] = useState(() => {
    try { return localStorage.getItem('agenda_week') || getMonday(TODAY) }
    catch { return getMonday(TODAY) }
  })

  // Semana: datos por fecha
  const [notas,        setNotas]        = useState({})
  const [audiencias,   setAudiencias]   = useState({})
  const [tareas,       setTareas]       = useState({})
  const [plazos,       setPlazos]       = useState({})
  const [reuniones,    setReuniones]    = useState({})
  const [clientes,     setClientes]     = useState([])
  const [causas,       setCausas]       = useState([])
  const [loading,      setLoading]      = useState(false)
  const [segPicker,    setSegPicker]    = useState(null)
  const [gcalEventos,  setGcalEventos]  = useState({})

  // Pendientes
  const [pendientes,      setPendientes]      = useState([])
  const [pendienteInput,  setPendienteInput]  = useState('')
  const [pendTab,         setPendTab]         = useState('lista')
  const [expandedPendId,  setExpandedPendId]  = useState(null)
  const [resolvingIds,    setResolvingIds]    = useState(new Set())
  const resolveBatches = useRef({})
  const idToBatch      = useRef({})

  const weekDays = useMemo(() => [0,1,2,3,4].map(i => addDays(weekMonday, i)), [weekMonday])
  const isCurrentWeek = weekMonday === getMonday(TODAY)
  const weekNum   = getISOWeek(weekMonday)
  const weekRange = fmtWeekRange(weekMonday)
  const todayInWeek = weekDays.includes(TODAY)

  const pendienteParents = useMemo(() => pendientes.filter(p => !p.parent_id), [pendientes])
  const childrenByParent = useMemo(() => {
    const m = {}
    for (const p of pendientes) {
      if (p.parent_id) (m[p.parent_id] ||= []).push(p)
    }
    return m
  }, [pendientes])

  // ── Fetch week data ─────────────────────────────────────────────────────────
  useEffect(() => {
    const start = weekMonday
    const end   = addDays(weekMonday, 4)

    async function fetchAll() {
      setLoading(true)
      function groupBy(arr, key) {
        return (arr || []).reduce((m, r) => {
          const k = r[key]; if (!m[k]) m[k] = []; m[k].push(r); return m
        }, {})
      }
      const [
        { data: notasData },
        { data: audData },
        { data: tareasData },
        { data: plazosData },
        { data: reunData },
        { data: clientesData },
        { data: causasData },
      ] = await Promise.all([
        supabase.from('agenda_notas').select('*').gte('fecha', start).lte('fecha', end).order('hora'),
        supabase.from('audiencias').select('id, fecha, hora, rit, causa_rit, cliente_nombre, tipo')
          .gte('fecha', start).lte('fecha', end).order('hora'),
        supabase.from('tareas').select('id, titulo, fecha_vencimiento, cliente_nombre, estado, prioridad')
          .eq('estado', 'Pendiente').gte('fecha_vencimiento', start).lte('fecha_vencimiento', end),
        supabase.from('plazos').select('id, descripcion, fecha_limite, causa_rit, cliente_nombre, urgente')
          .gte('fecha_limite', start).lte('fecha_limite', end),
        supabase.from('reuniones').select('id, fecha_jueves, titulo')
          .gte('fecha_jueves', start).lte('fecha_jueves', end),
        supabase.from('clientes').select('id, nombre'),
        supabase.from('causas').select('id, rit, ruc, materia, cliente_nombre, estado')
          .in('estado', ['Abierta', 'Revisar', 'En tramitación']).order('cliente_nombre'),
      ])
      setNotas(groupBy(notasData, 'fecha'))
      setAudiencias(groupBy(audData, 'fecha'))
      setTareas(groupBy(tareasData, 'fecha_vencimiento'))
      setPlazos(groupBy(plazosData, 'fecha_limite'))
      setReuniones(groupBy(reunData, 'fecha_jueves'))
      setClientes(clientesData || [])
      setCausas(causasData || [])
      setLoading(false)
    }
    fetchAll()
  }, [weekMonday])

  // ── Fetch eventos externos de Google Calendar ───────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function fetchGcal() {
      const enabled = await isGCalEnabled(supabase)
      if (!enabled || cancelled) return
      try {
        const end    = addDays(weekMonday, 6)
        const events = await fetchExternalGCalEvents(weekMonday, end, supabase)
        if (cancelled) return
        const byDate = {}
        events.forEach(e => {
          if (!byDate[e.fecha]) byDate[e.fecha] = []
          byDate[e.fecha].push(e)
        })
        setGcalEventos(byDate)
      } catch { /* silencioso */ }
    }
    fetchGcal()
    return () => { cancelled = true }
  }, [weekMonday])

  // ── Fetch pendientes ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('agenda_pendientes').select('*')
      .eq('resuelto', false)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[agenda_pendientes] fetch:', error.message)
        // Filtrar pendiente con texto solo "-"
        setPendientes((data || []).filter(p => p.texto !== '-'))
      })
  }, [])

  // Limpia timers al desmontar
  useEffect(() => () => {
    Object.values(resolveBatches.current).forEach(b => clearTimeout(b.timer))
  }, [])

  // ── Convertir notas sin marcar de la semana anterior → pendientes ───────────
  useEffect(() => {
    const prevMonday = addDays(getMonday(TODAY), -7)
    const prevSunday = addDays(prevMonday, 6)

    supabase.from('agenda_notas')
      .select('*')
      .eq('completada', false)
      .gte('fecha', prevMonday).lte('fecha', prevSunday)
      .then(async ({ data }) => {
        if (!data || data.length === 0) return
        const rows = data.map(n => ({
          texto: `${n.texto}`,
          resuelto: false,
          parent_id: null,
          origen_nota_fecha: n.fecha,
        }))
        const { data: inserted } = await supabase.from('agenda_pendientes').insert(rows).select()
        await supabase.from('agenda_notas').update({ completada: true }).in('id', data.map(n => n.id))
        if (inserted?.length) setPendientes(prev => [...prev, ...inserted])
      })
  }, []) // solo al montar

  // ── Handlers: agenda ────────────────────────────────────────────────────────
  const handleAddNota = useCallback(async (date, text) => {
    const hora = nowHHMM()
    const tipo = isActionText(text) ? 'checkbox' : 'nota'
    const clNombre = detectClientName(text, clientes)
    const { data, error } = await supabase.from('agenda_notas')
      .insert([{ fecha: date, hora, texto: text, tipo, cliente_nombre: clNombre || null, completada: false }])
      .select().single()
    if (error) { console.error('[agenda_notas] insert:', error.message); return null }
    if (data) { setNotas(prev => ({ ...prev, [date]: [...(prev[date] || []), data] })); return data.id }
    return null
  }, [clientes])

  const handleToggleNota = useCallback(async (nota) => {
    const { error } = await supabase.from('agenda_notas').update({ completada: !nota.completada }).eq('id', nota.id)
    if (!error) setNotas(prev => ({
      ...prev,
      [nota.fecha]: (prev[nota.fecha] || []).map(n => n.id === nota.id ? { ...n, completada: !n.completada } : n)
    }))
  }, [])

  const handleDeleteNota = useCallback(async (nota) => {
    const { error } = await supabase.from('agenda_notas').delete().eq('id', nota.id)
    if (!error) setNotas(prev => ({
      ...prev,
      [nota.fecha]: (prev[nota.fecha] || []).filter(n => n.id !== nota.id)
    }))
  }, [])

  const handleConvertNota = useCallback(async (nota, tipo, causa = null) => {
    if (tipo === 'tarea') {
      await supabase.from('tareas').insert([{
        titulo: nota.texto, cliente_nombre: nota.cliente_nombre || null,
        estado: 'Pendiente', prioridad: 'Media', fecha_vencimiento: nota.fecha,
      }])
    } else if (tipo === 'seguimiento') {
      if (!causa) { setSegPicker({ kind: 'nota', item: nota }); return }
      const payload = {
        causa_id: causa.id, causa_rit: causa.rit || null, cliente_nombre: causa.cliente_nombre || null,
        fecha_revision: nota.fecha, por_hacer: nota.texto, que_se_hizo: 'Pendiente',
        semana_key: null, revisada: false, origen: 'agenda',
      }
      const { data: segData, error } = await supabase.from('revisiones').insert([payload]).select().single()
      if (error) { console.error('Error seguimiento:', error.message); return }
      window.dispatchEvent(new CustomEvent('seguimiento:created', { detail: { causa_id: causa.id, causa_rit: causa.rit, row: segData } }))
    }
    const { error } = await supabase.from('agenda_notas').update({ tag: tipo }).eq('id', nota.id)
    if (!error) setNotas(prev => ({
      ...prev,
      [nota.fecha]: (prev[nota.fecha] || []).map(n => n.id === nota.id ? { ...n, tag: tipo } : n)
    }))
  }, [])

  async function handleSegPickerConfirm(causa) {
    const picker = segPicker
    setSegPicker(null)
    if (!picker || !causa) return
    if (picker.kind === 'nota') await handleConvertNota(picker.item, 'seguimiento', causa)
    else await handleConvertPendienteSeguimiento(picker.item, causa)
  }

  // ── Handlers: pendientes ────────────────────────────────────────────────────
  async function handleAddPendiente(causaId = null) {
    const texto = pendienteInput.trim()
    if (!texto) return
    setPendienteInput('')
    const row = { texto, resuelto: false, parent_id: null }
    if (causaId) row.causa_id = causaId
    const { data, error } = await supabase.from('agenda_pendientes').insert([row]).select().single()
    if (error) { console.error('[agenda_pendientes] insert:', error.message); return }
    if (data) setPendientes(prev => [...prev, data])
  }

  async function handleLinkPendiente(p, causaId) {
    const { error } = await supabase.from('agenda_pendientes').update({ causa_id: causaId }).eq('id', p.id)
    if (error) { console.error('[agenda_pendientes] link:', error.message); return }
    setPendientes(prev => prev.map(x => x.id === p.id ? { ...x, causa_id: causaId } : x))
  }

  async function handleUnlinkPendiente(p) {
    const { error } = await supabase.from('agenda_pendientes').update({ causa_id: null }).eq('id', p.id)
    if (error) { console.error('[agenda_pendientes] unlink:', error.message); return }
    setPendientes(prev => prev.map(x => x.id === p.id ? { ...x, causa_id: null } : x))
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

  async function handleDeletePendiente(p) {
    const children = childrenByParent[p.id] || []
    const ids = [p.id, ...children.map(c => c.id)]
    await supabase.from('agenda_pendientes').delete().in('id', ids)
    setPendientes(prev => prev.filter(x => !ids.includes(x.id)))
  }

  function startResolveBatch(ids) {
    const batchKey = ids[0]
    setResolvingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
    ids.forEach(id => { idToBatch.current[id] = batchKey })
    const timer = setTimeout(() => {
      setPendientes(prev => prev.filter(x => !ids.includes(x.id)))
      setResolvingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      ids.forEach(id => delete idToBatch.current[id])
      delete resolveBatches.current[batchKey]
    }, 3000)
    resolveBatches.current[batchKey] = { ids, timer }
  }

  function handleTogglePendiente(p) {
    const kids = childrenByParent[p.id] || []
    const ids  = p.parent_id ? [p.id] : [p.id, ...kids.map(c => c.id)]
    supabase.from('agenda_pendientes')
      .update({ resuelto: true, resuelto_at: new Date().toISOString() }).in('id', ids)
      .then(({ error }) => { if (error) console.error('[agenda_pendientes] toggle:', error.message) })
    startResolveBatch(ids)
  }

  function handleUndoPendiente(p) {
    const batchKey = idToBatch.current[p.id]
    const batch    = resolveBatches.current[batchKey]
    if (!batch) return
    clearTimeout(batch.timer)
    const ids = batch.ids
    ids.forEach(id => delete idToBatch.current[id])
    delete resolveBatches.current[batchKey]
    setResolvingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
    supabase.from('agenda_pendientes')
      .update({ resuelto: false, resuelto_at: null }).in('id', ids)
      .then(({ error }) => { if (error) console.error('[agenda_pendientes] undo:', error.message) })
  }

  async function resolvePendienteGroupSilent(p) {
    const ids = [p.id, ...(childrenByParent[p.id] || []).map(c => c.id)]
    setPendientes(prev => prev.filter(x => !ids.includes(x.id)))
    await supabase.from('agenda_pendientes')
      .update({ resuelto: true, resuelto_at: new Date().toISOString() }).in('id', ids)
  }

  async function handleMoverPendiente(p, date) {
    const hora = nowHHMM()
    const tipo = isActionText(p.texto) ? 'checkbox' : 'nota'
    const clNombre = detectClientName(p.texto, clientes)
    const { data, error } = await supabase.from('agenda_notas')
      .insert([{ fecha: date, hora, texto: p.texto, tipo, cliente_nombre: clNombre || null, completada: false }])
      .select().single()
    if (error) { console.error('[pendiente→agenda_notas]:', error.message); return }
    if (data) setNotas(prev => ({ ...prev, [date]: [...(prev[date] || []), data] }))
    await resolvePendienteGroupSilent(p)
  }

  async function handleConvertPendienteTarea(p) {
    const clNombre = detectClientName(p.texto, clientes)
    const { error } = await supabase.from('tareas').insert([{
      titulo: p.texto, cliente_nombre: clNombre || null,
      estado: 'Pendiente', prioridad: 'Media', fecha_vencimiento: TODAY,
    }])
    if (error) { console.error('[pendiente→tarea]:', error.message); return }
    await resolvePendienteGroupSilent(p)
  }

  async function handleConvertPendienteSeguimiento(p, causa = null) {
    if (!causa) { setSegPicker({ kind: 'pendiente', item: p }); return }
    const payload = {
      causa_id: causa.id, causa_rit: causa.rit || null, cliente_nombre: causa.cliente_nombre || null,
      fecha_revision: TODAY, por_hacer: p.texto, que_se_hizo: 'Pendiente',
      semana_key: null, revisada: false, origen: 'agenda',
    }
    const { data: segData, error } = await supabase.from('revisiones').insert([payload]).select().single()
    if (error) { console.error('[pendiente→seguimiento]:', error.message); return }
    window.dispatchEvent(new CustomEvent('seguimiento:created', { detail: { causa_id: causa.id, causa_rit: causa.rit, row: segData } }))
    await resolvePendienteGroupSilent(p)
  }

  // ── Pendientes: agrupación por semana ───────────────────────────────────────
  const weekMondayDate = new Date(weekMonday + 'T00:00:00')

  const [pendAntes, pendEsta] = useMemo(() => {
    const antes = [], esta = []
    for (const p of pendienteParents) {
      const created = p.created_at ? new Date(p.created_at) : new Date()
      if (created < weekMondayDate) antes.push(p)
      else esta.push(p)
    }
    return [antes, esta]
  }, [pendienteParents, weekMondayDate])

  function filterByTab(list) {
    if (pendTab === 'por-causa') return list.filter(p => p.causa_id)
    if (pendTab === 'sin-causa') return list.filter(p => !p.causa_id)
    return list
  }

  const antesFiltered = filterByTab(pendAntes)
  const estaFiltered  = filterByTab(pendEsta)

  // "Por causa" grouping
  const estaGrouped = useMemo(() => {
    if (pendTab !== 'por-causa') return null
    const groups = {}
    for (const p of estaFiltered) {
      const k = p.causa_id || '__sin__'
      if (!groups[k]) groups[k] = []
      groups[k].push(p)
    }
    return groups
  }, [estaFiltered, pendTab])

  function navWeek(delta) {
    const next = addDays(weekMonday, delta * 7)
    setWeekMonday(next)
    try { localStorage.setItem('agenda_week', next) } catch {}
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#F5F6F8] overflow-hidden">

      {/* Picker de causa */}
      {segPicker && (
        <SeguimientoPicker
          nota={segPicker.item}
          causas={causas}
          onConfirm={handleSegPickerConfirm}
          onClose={() => setSegPicker(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="bg-[#1A2E4A] px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-[14px] leading-tight">Agenda diaria</h1>
          {todayInWeek ? (
            <p className="text-white/40 text-[11px] capitalize">
              {dowLong(TODAY)} {dayNum(TODAY)} · hoy
            </p>
          ) : (
            <p className="text-white/40 text-[11px]">
              {weekMonday < getMonday(TODAY) ? 'Semana anterior' : 'Próxima semana'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-white/10 rounded-xl px-1 py-1">
            <button onClick={() => navWeek(-1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <div className="px-4 text-center" style={{ minWidth: 200 }}>
              <p className="text-white font-semibold text-[12px]">Semana {weekNum} · {weekRange}</p>
            </div>
            <button onClick={() => navWeek(1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
          {!isCurrentWeek && (
            <button onClick={() => {
              const m = getMonday(TODAY)
              setWeekMonday(m)
              try { localStorage.setItem('agenda_week', m) } catch {}
            }} className="text-white/40 hover:text-white text-[11px] font-medium transition-colors">
              Semana actual
            </button>
          )}
        </div>
      </div>

      {/* ── Contenido: dos columnas ── */}
      <div className="flex-1 flex flex-col min-[1100px]:flex-row overflow-hidden">

        {/* ── Columna izquierda: La semana (60%) ── */}
        <div className="min-[1100px]:w-[60%] flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-200">
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">La semana</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#1a2e4a]/20 border-t-[#1a2e4a] rounded-full animate-spin" />
              </div>
            ) : (
              weekDays.map((date) => (
                <DayBlock
                  key={date}
                  iso={date}
                  isToday={date === TODAY}
                  isPast={date < TODAY}
                  audiencias={audiencias[date] || []}
                  plazos={plazos[date] || []}
                  tareas={tareas[date] || []}
                  reuniones={reuniones[date] || []}
                  notas={notas[date] || []}
                  clientes={clientes}
                  gcalEventos={gcalEventos[date] || []}
                  onToggleNota={handleToggleNota}
                  onAddNota={handleAddNota}
                  onDeleteNota={handleDeleteNota}
                  onConvertNota={handleConvertNota}
                />
              ))
            )}
            <div className="h-8" />
          </div>
        </div>

        {/* ── Columna derecha: Pendientes (40%) ── */}
        <div className="min-[1100px]:flex-1 flex flex-col overflow-hidden">
        <div className="bg-white flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pendientes</span>
            <span className="text-[10px] text-gray-300">{pendienteParents.length} sin resolver</span>
          </div>

          {/* Input */}
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" />
              <input
                type="text"
                value={pendienteInput}
                onChange={e => setPendienteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPendiente() } }}
                placeholder="Anotar pendiente… (Enter)"
                className="flex-1 text-[12px] text-gray-700 bg-transparent border-0 outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {[['lista','Lista'],['por-causa','Por causa'],['sin-causa','Sin causa']].map(([k, label]) => (
              <button key={k} onClick={() => setPendTab(k)}
                className="px-4 py-2 text-[11px] font-medium transition-colors border-b-2"
                style={{
                  color: pendTab === k ? '#2570BA' : '#9CA3AF',
                  borderBottomColor: pendTab === k ? '#2570BA' : 'transparent',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Lista scrollable */}
          <div className="flex-1 overflow-y-auto">

          {/* Pendientes anteriores */}
          {antesFiltered.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                  Vienen de la semana pasada · {antesFiltered.length}
                </span>
              </div>
              {antesFiltered.map(p => (
                <div key={p.id} className="relative">
                  <PendienteRow
                    p={p}
                    children={childrenByParent[p.id] || []}
                    causas={causas}
                    expanded={expandedPendId === p.id}
                    isResolving={resolvingIds.has(p.id)}
                    onToggleExpand={() => setExpandedPendId(prev => prev === p.id ? null : p.id)}
                    onToggle={handleTogglePendiente}
                    onUndo={handleUndoPendiente}
                    onAddChild={handleAddChild}
                    onEditNota={handleEditNota}
                    onDelete={handleDeletePendiente}
                    weekDays={weekDays}
                    onMover={handleMoverPendiente}
                    onConvertTarea={handleConvertPendienteTarea}
                    onConvertSeguimiento={handleConvertPendienteSeguimiento}
                    onLink={handleLinkPendiente}
                    onUnlink={handleUnlinkPendiente}
                  />
                  {/* Chip de semana */}
                  {!resolvingIds.has(p.id) && p.created_at && (
                    <span
                      className="absolute right-10 top-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none"
                      style={{ background: '#FEF3C7', color: '#92400E' }}
                    >
                      {semChip(p.created_at.slice(0, 10))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pendientes de esta semana */}
          {pendTab !== 'por-causa' && estaFiltered.length > 0 && (
            <div>
              {antesFiltered.length > 0 && (
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Esta semana</span>
                </div>
              )}
              {estaFiltered.map(p => (
                <PendienteRow
                  key={p.id}
                  p={p}
                  children={childrenByParent[p.id] || []}
                  causas={causas}
                  expanded={expandedPendId === p.id}
                  isResolving={resolvingIds.has(p.id)}
                  onToggleExpand={() => setExpandedPendId(prev => prev === p.id ? null : p.id)}
                  onToggle={handleTogglePendiente}
                  onUndo={handleUndoPendiente}
                  onAddChild={handleAddChild}
                  onEditNota={handleEditNota}
                  onDelete={handleDeletePendiente}
                  weekDays={weekDays}
                  onMover={handleMoverPendiente}
                  onConvertTarea={handleConvertPendienteTarea}
                  onConvertSeguimiento={handleConvertPendienteSeguimiento}
                  onLink={handleLinkPendiente}
                  onUnlink={handleUnlinkPendiente}
                />
              ))}
            </div>
          )}

          {/* Por causa: agrupado */}
          {pendTab === 'por-causa' && estaGrouped && (
            <div>
              {antesFiltered.length > 0 && (
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Esta semana</span>
                </div>
              )}
              {Object.entries(estaGrouped).map(([causaId, pList]) => {
                const causa = causaId === '__sin__' ? null : causas.find(c => c.id === causaId)
                return (
                  <div key={causaId}>
                    <div className="px-5 py-1.5 border-b border-gray-100 bg-blue-50/30">
                      <span className="text-[10px] font-semibold text-[#2570BA]">
                        {causa ? (causa.cliente_nombre || causa.rit || '—') : 'Sin causa'}
                      </span>
                      {causa?.rit && <span className="text-[10px] text-gray-400 ml-1.5 font-mono">{causa.rit}</span>}
                    </div>
                    {pList.map(p => (
                      <PendienteRow
                        key={p.id}
                        p={p}
                        children={childrenByParent[p.id] || []}
                        causas={causas}
                        expanded={expandedPendId === p.id}
                        isResolving={resolvingIds.has(p.id)}
                        onToggleExpand={() => setExpandedPendId(prev => prev === p.id ? null : p.id)}
                        onToggle={handleTogglePendiente}
                        onUndo={handleUndoPendiente}
                        onAddChild={handleAddChild}
                        onEditNota={handleEditNota}
                        onDelete={handleDeletePendiente}
                        weekDays={weekDays}
                        onMover={handleMoverPendiente}
                        onConvertTarea={handleConvertPendienteTarea}
                        onConvertSeguimiento={handleConvertPendienteSeguimiento}
                        onLink={handleLinkPendiente}
                        onUnlink={handleUnlinkPendiente}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {pendienteParents.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-[12px] text-gray-300">Sin pendientes · todo en orden</p>
            </div>
          )}

          {/* Pie */}
          <div className="h-6" />
          </div>{/* /lista scrollable */}
        </div>{/* /bg-white flex col */}
        </div>{/* /columna derecha */}
      </div>
    </div>
  )
}
