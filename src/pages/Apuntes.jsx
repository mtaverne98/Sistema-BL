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
  tarea:     { label: 'Tarea',     color: '#1E9E6A', bg: '#E8F8F0' },
  reunion:   { label: 'Reunión',   color: '#8E7CC3', bg: '#EDE9F7' },
  gcal:      { label: 'Google',    color: '#4285F4', bg: '#EEF3FD' },
  nota:      { label: 'Nota',      color: '#C8862B', bg: '#FDF3E7' },
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
// Items externos (audiencias, plazos, tareas, reuniones, Google).
// isOculto = ya está en agenda_ocultos para este día.
// onOcultar / onDesocultar = callbacks para marcar/desmarcar.
// subColor: color opcional para el texto del sub (p.ej. ámbar/rojo para atrasadas).
function EventoItem({ tipo, label, sub, subColor, hora, href, cliente, isOculto, onOcultar, onDesocultar }) {
  const t = TIPOS[tipo] || TIPOS.nota
  const done = !!isOculto

  const barColor = done ? '#D1D5DB' : t.color
  const textColor = done ? '#9CA3AF' : '#374151'
  const chipColor = done ? '#9CA3AF' : t.color
  const chipBg    = done ? '#F3F4F6' : t.bg

  return (
    <div className="flex items-center gap-2 py-1.5 group/ev">
      {/* Checkbox */}
      <button
        onClick={e => { e.preventDefault(); done ? onDesocultar?.() : onOcultar?.() }}
        className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors no-touch-min"
        style={{
          borderColor: done ? '#1E9E6A' : '#CBD5E1',
          background:  done ? '#1E9E6A' : 'transparent',
          minHeight: 'unset',
        }}
      >
        {done && <Check size={9} color="white" strokeWidth={3} />}
      </button>

      {/* Barra de color */}
      <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: barColor }} />

      {/* Chip de tipo */}
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ color: chipColor, background: chipBg }}>
        {t.label.toUpperCase()}
      </span>

      {/* Hora */}
      {hora && <span className="text-[11px] font-mono flex-shrink-0" style={{ color: done ? '#9CA3AF' : '#6B7280' }}>{fmtHora(hora)}</span>}

      {/* Label */}
      <span className="text-[12px] font-medium truncate flex-1"
        style={{ color: textColor, textDecoration: done ? 'line-through' : 'none' }}>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="hover:underline">{label}</a>
        ) : label}
      </span>

      {/* Sub (tipo audiencia, fecha atrasada, etc.) */}
      {sub && (
        <span className="text-[10px] flex-shrink-0 truncate max-w-[130px] font-medium"
          style={{ color: done ? '#D1D5DB' : (subColor || '#9CA3AF') }}>{sub}</span>
      )}

      {/* Cliente: nombre completo en negrita */}
      {cliente && (
        <span className="text-[11px] font-bold flex-shrink-0 truncate max-w-[150px]"
          style={{ color: done ? '#9CA3AF' : '#374151' }}>{cliente}</span>
      )}
    </div>
  )
}

// ── VieneDAntes ───────────────────────────────────────────────────────────────
// Bloque en la columna de pendientes con tareas y notas de semanas anteriores.
// Al marcar una tarea: agenda_ocultos + seguimiento en su causa.
// Al marcar una nota: completada en agenda_notas.
function VieneDAntes({ tareas, notas, ocultos, weekMonday, onOcultarTarea, onDesocultarTarea, onToggleNota }) {
  const [collapsed,   setCollapsed]   = useState(false)
  const [resolviendo, setResolviendo] = useState(new Set()) // Set de `${tipo}:${id}`
  const timeoutsRef = useRef(new Map())

  function diasAtras(fecha) {
    const ref = new Date(weekMonday + 'T00:00:00')
    const d   = new Date(fecha + 'T00:00:00')
    return Math.max(0, Math.floor((ref - d) / 86400000))
  }

  function fmtFecha(fecha) {
    const d  = new Date(fecha + 'T00:00:00')
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}`
  }

  function handleCheck(tipo, item) {
    if (tipo === 'nota') { onToggleNota(item); return }

    const key = `tarea:${item.id}`
    const done = (ocultos[item.fecha_vencimiento] || new Set()).has(key)

    if (done) {
      // Ya está oculto → deshacer (quitar de ocultos)
      onDesocultarTarea(item)
      return
    }

    if (resolviendo.has(key)) return // ya en ventana de undo

    // Marcar localmente de inmediato
    setResolviendo(prev => { const s = new Set(prev); s.add(key); return s })

    const tid = setTimeout(() => {
      timeoutsRef.current.delete(key)
      setResolviendo(prev => { const s = new Set(prev); s.delete(key); return s })
      onOcultarTarea(item) // escribe en DB y actualiza ocultos en el padre
    }, 3000)
    timeoutsRef.current.set(key, tid)
  }

  function handleUndo(tipo, item) {
    const key = `tarea:${item.id}`
    const tid = timeoutsRef.current.get(key)
    if (tid) clearTimeout(tid)
    timeoutsRef.current.delete(key)
    setResolviendo(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  const allItems = [
    ...tareas.map(t => ({ tipo: 'tarea', item: t, fecha: t.fecha_vencimiento })),
    ...notas.map(n => ({ tipo: 'nota',  item: n, fecha: n.fecha })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  // Ocultar filas que ya están en ocultos Y no están en ventana de undo
  const items = allItems.filter(({ tipo, item, fecha }) => {
    if (tipo === 'nota') return !item.completada
    const key  = `tarea:${item.id}`
    const done = (ocultos[fecha] || new Set()).has(key)
    return !done || resolviendo.has(key)
  })

  if (items.length === 0) return null

  const pendCount = items.filter(({ tipo, item }) => {
    if (tipo === 'nota') return !item.completada
    const key = `tarea:${item.id}`
    return !resolviendo.has(key) && !(ocultos[item.fecha_vencimiento] || new Set()).has(key)
  }).length

  return (
    <div className="border-t border-[#E3E7EC] mt-2">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Viene de antes</span>
          {pendCount > 0 && (
            <span className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
              style={{ background: '#FEF3C7', color: '#92400E' }}>
              {pendCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(s => !s)}
          className="text-[11px] text-amber-600 hover:text-amber-800 transition-colors"
        >
          {collapsed ? `▸ Mostrar ${items.length}` : '▾ Ocultar'}
        </button>
      </div>

      {!collapsed && (
        <div>
          {items.map(({ tipo, item, fecha }) => {
            const key  = `tarea:${item.id}`
            const dias = diasAtras(fecha)
            const late = dias > 15
            const fechaLabel = `${fmtFecha(fecha)} · hace ${dias}d`
            const fechaColor = late ? '#C0392B' : '#C8862B'
            const isResolviendo = tipo === 'tarea' && resolviendo.has(key)
            const done = tipo === 'tarea'
              ? (ocultos[fecha] || new Set()).has(key)
              : item.completada
            const cliente   = tipo === 'tarea' ? item.cliente_nombre : null
            const texto     = tipo === 'tarea' ? item.titulo : item.texto
            const tipoLabel = tipo === 'tarea' ? 'TAREA' : 'NOTA'
            const tipoColor = tipo === 'tarea' ? TIPOS.tarea : TIPOS.nota

            // Fila en ventana de undo
            if (isResolviendo) {
              return (
                <div key={`vda-${tipo}-${item.id}`}
                  className="flex items-center gap-2 px-5 py-2 border-b border-gray-50"
                >
                  <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center"
                    style={{ borderColor: '#1E9E6A', background: '#1E9E6A' }}>
                    <Check size={9} color="white" strokeWidth={3} />
                  </div>
                  <span className="flex-1 text-[12px] text-gray-300 line-through leading-snug">{texto}</span>
                  <button
                    onClick={() => handleUndo(tipo, item)}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#2570BA] hover:underline flex-shrink-0"
                  >
                    <Undo2 size={11} /> Deshacer
                  </button>
                </div>
              )
            }

            return (
              <div key={`vda-${tipo}-${item.id}`}
                className="flex items-start gap-2 px-5 py-2 border-b border-gray-50 group/vda"
                style={{ opacity: done ? 0.55 : 1 }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleCheck(tipo, item)}
                  className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors"
                  style={{
                    borderColor: done ? '#1E9E6A' : '#CBD5E1',
                    background:  done ? '#1E9E6A' : 'transparent',
                  }}
                >
                  {done && <Check size={9} color="white" strokeWidth={3} />}
                </button>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 mt-0.5"
                      style={{ color: tipoColor.color, background: tipoColor.bg }}>
                      {tipoLabel}
                    </span>
                    <span className="text-[12px] leading-snug"
                      style={{ textDecoration: done ? 'line-through' : 'none', color: done ? '#9CA3AF' : '#374151' }}>
                      {texto}
                    </span>
                  </div>
                  {cliente ? (
                    <p className="text-[11px] font-bold text-gray-700 mt-0.5 pl-0.5">{cliente}</p>
                  ) : (
                    <p className="text-[11px] text-gray-300 mt-0.5 pl-0.5">sin causa</p>
                  )}
                </div>

                {/* Fecha */}
                <span className="text-[10px] font-medium tabular-nums flex-shrink-0 mt-0.5"
                  style={{ color: done ? '#D1D5DB' : fechaColor }}>
                  {fechaLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── NotaRow ───────────────────────────────────────────────────────────────────
// Notas propias de agenda_notas (barra ámbar). Expandibles con contenido.
function NotaRow({ nota, onToggle, onDelete, isPast, newNotaId, onConvert, onSaveContenido }) {
  const [showConv,  setShowConv]  = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [detalle,   setDetalle]   = useState(nota.detalle || '')
  const textareaRef = useRef(null)
  const isNew = nota.id === newNotaId
  const hasDetalle = !!(nota.detalle || '').trim()

  useEffect(() => {
    setDetalle(nota.detalle || '')
  }, [nota.detalle])

  useEffect(() => {
    if (expanded) setTimeout(() => textareaRef.current?.focus(), 30)
  }, [expanded])

  function handleDetalleBlur() {
    const txt = detalle.trim()
    if (txt !== (nota.detalle || '').trim()) {
      onSaveContenido?.(nota, txt || null)
    }
  }

  return (
    <div>
      {/* Fila principal */}
      <div
        className="group flex items-center gap-1.5 py-1 hover:bg-gray-50/60 rounded px-1 -mx-1"
        style={expanded ? { background: '#F0F7FF', borderRadius: 6 } : {}}
      >
        {/* Flecha expand (solo notas propias) */}
        <button
          onClick={() => setExpanded(s => !s)}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-300 hover:text-[#2570BA] transition-colors no-touch-min"
          style={{ minHeight: 'unset' }}
          title={expanded ? 'Cerrar' : 'Expandir'}
        >
          {expanded
            ? <ChevronDown size={10} />
            : <ChevronRight size={10} strokeWidth={2} className={hasDetalle ? 'text-[#C8862B]' : ''} />
          }
        </button>

        {/* Barra ámbar */}
        <div className="w-0.5 self-stretch rounded-full flex-shrink-0"
          style={{ background: nota.completada ? '#D1D5DB' : '#C8862B' }} />

        {/* Checkbox completar — funciona en cualquier día, sin restricción por fecha */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(nota) }}
          className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: nota.completada ? '#1E9E6A' : '#CBD5E1',
            background:  nota.completada ? '#1E9E6A' : 'transparent',
          }}
        >
          {nota.completada && <Check size={10} color="white" strokeWidth={3} />}
        </button>

        {/* Texto */}
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
          {/* Indicador de detalle */}
          {hasDetalle && !expanded && (
            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#C8862B]/60 align-middle" title="Tiene contenido" />
          )}
        </span>

        {!isPast && !nota.completada && !nota.tag && (
          <button
            onClick={() => setShowConv(s => !s)}
            className="opacity-0 group-hover:opacity-100 text-[9px] text-[#2570BA]/50 hover:text-[#2570BA] px-1.5 py-0.5 border border-[#2570BA]/20 rounded transition-all no-touch-min"
            style={{ minHeight: 'unset' }}
          >
            convertir
          </button>
        )}
        {!isPast && (
          <button
            onClick={() => onDelete(nota)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all no-touch-min"
            style={{ minHeight: 'unset' }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Área expandida */}
      {expanded && (
        <div
          className="ml-8 mb-1 mt-0.5 rounded-lg p-2.5"
          style={{ background: '#F8FAFC', borderLeft: '2px solid #2570BA' }}
        >
          <textarea
            ref={textareaRef}
            value={detalle}
            onChange={e => setDetalle(e.target.value)}
            onBlur={handleDetalleBlur}
            placeholder="Notas, explicaciones, artículos…"
            rows={3}
            className="w-full text-[11px] text-gray-700 bg-transparent border-0 outline-none resize-none placeholder:text-gray-300 leading-relaxed"
          />
        </div>
      )}

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
  onToggleNota, onAddNota, onDeleteNota, onConvertNota, onSaveContenido,
  clientes, gcalEventos,
  ocultosSet, onOcultar, onDesocultar,
}) {
  const [newNotaId,     setNewNotaId]     = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const gcalItems = gcalEventos || []

  // Helper para la clave de agenda_ocultos
  const oKey = (origen, id) => `${origen}:${String(id)}`

  // Separar cada tipo en visible / oculto
  const visAud  = audiencias.filter(a => !ocultosSet.has(oKey('audiencia', a.id)))
  const doneAud = audiencias.filter(a =>  ocultosSet.has(oKey('audiencia', a.id)))

  const visPlaz  = plazos.filter(p => !ocultosSet.has(oKey('plazo', p.id)))
  const donePlaz = plazos.filter(p =>  ocultosSet.has(oKey('plazo', p.id)))

  const visTar  = tareas.filter(t => !ocultosSet.has(oKey('tarea', t.id)))
  const doneTar = tareas.filter(t =>  ocultosSet.has(oKey('tarea', t.id)))

  const visReu  = reuniones.filter(r => !ocultosSet.has(oKey('reunion', r.id)))
  const doneReu = reuniones.filter(r =>  ocultosSet.has(oKey('reunion', r.id)))

  const visGcal  = gcalItems.filter(e => !ocultosSet.has(oKey('google', e.id)))
  const doneGcal = gcalItems.filter(e =>  ocultosSet.has(oKey('google', e.id)))

  const pendingNotas   = notas.filter(n => !n.completada)
  const completedNotas = notas.filter(n =>  n.completada)

  // Todos los completados (externos + notas)
  const allDoneExternal = [...doneAud, ...donePlaz, ...doneTar, ...doneReu, ...doneGcal]
  const totalDone = allDoneExternal.length + completedNotas.length

  // Contadores para la barra de progreso
  const totalAll = audiencias.length + plazos.length + tareas.length +
                   reuniones.length + gcalItems.length + notas.length
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0

  const hasVisible = (visAud.length + visPlaz.length + visTar.length +
                      visReu.length + visGcal.length + pendingNotas.length) > 0
  const isEmpty = totalAll === 0

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

        {/* Contador y barra de progreso */}
        {totalAll > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] tabular-nums" style={{ color: totalDone === totalAll ? '#1E9E6A' : '#9CA3AF' }}>
              {totalDone} de {totalAll}
            </span>
            <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#1E9E6A' }} />
            </div>
          </div>
        )}
      </div>

      {/* Items externos visibles */}
      {(visAud.length + visPlaz.length + visTar.length + visReu.length + visGcal.length) > 0 && (
        <div className="px-5 pb-1">
          {visAud.map(a => (
            <EventoItem key={a.id} tipo="audiencia"
              label={a.cliente_nombre || a.causa_rit || a.rit}
              sub={a.tipo}
              hora={a.hora}
              cliente={null}
              onOcultar={() => onOcultar(iso, 'audiencia', String(a.id))} />
          ))}
          {visPlaz.map(p => (
            <EventoItem key={p.id} tipo="plazo"
              label={p.descripcion}
              sub={null}
              cliente={p.cliente_nombre || null}
              onOcultar={() => onOcultar(iso, 'plazo', String(p.id))} />
          ))}
          {visTar.map(t => (
            <EventoItem key={t.id} tipo="tarea"
              label={t.titulo}
              sub={null}
              cliente={t.cliente_nombre || null}
              onOcultar={() => onOcultar(iso, 'tarea', String(t.id))} />
          ))}
          {visReu.map(r => (
            <EventoItem key={r.id} tipo="reunion"
              label={r.titulo || 'Reunión'}
              sub={null}
              cliente={null}
              onOcultar={() => onOcultar(iso, 'reunion', String(r.id))} />
          ))}
          {visGcal.map(e => (
            <EventoItem key={e.id} tipo="gcal"
              label={e.title}
              sub={null}
              hora={e.hora}
              href={e.htmlLink}
              cliente={null}
              onOcultar={() => onOcultar(iso, 'google', String(e.id))} />
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
              onSaveContenido={onSaveContenido}
              isPast={isPast}
              newNotaId={newNotaId}
            />
          ))}
        </div>
      )}

      {/* Toggle completadas */}
      {totalDone > 0 && (
        <div className="px-5 pb-1">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors"
          >
            {showCompleted
              ? `▾ Ocultar ${totalDone} completada${totalDone !== 1 ? 's' : ''}`
              : `▸ Mostrar ${totalDone} completada${totalDone !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Items completados */}
      {showCompleted && totalDone > 0 && (
        <div className="px-5 pb-1">
          {/* Externos completados */}
          {doneAud.map(a => (
            <EventoItem key={a.id} tipo="audiencia"
              label={a.cliente_nombre || a.causa_rit || a.rit}
              sub={a.tipo}
              hora={a.hora}
              cliente={null}
              isOculto
              onDesocultar={() => onDesocultar(iso, 'audiencia', String(a.id))} />
          ))}
          {donePlaz.map(p => (
            <EventoItem key={p.id} tipo="plazo"
              label={p.descripcion}
              sub={null}
              cliente={p.cliente_nombre || null}
              isOculto
              onDesocultar={() => onDesocultar(iso, 'plazo', String(p.id))} />
          ))}
          {doneTar.map(t => (
            <EventoItem key={t.id} tipo="tarea"
              label={t.titulo}
              sub={null}
              cliente={t.cliente_nombre || null}
              isOculto
              onDesocultar={() => onDesocultar(iso, 'tarea', String(t.id))} />
          ))}
          {doneReu.map(r => (
            <EventoItem key={r.id} tipo="reunion"
              label={r.titulo || 'Reunión'}
              sub={null}
              cliente={null}
              isOculto
              onDesocultar={() => onDesocultar(iso, 'reunion', String(r.id))} />
          ))}
          {doneGcal.map(e => (
            <EventoItem key={e.id} tipo="gcal"
              label={e.title}
              sub={null}
              hora={e.hora}
              href={e.htmlLink}
              cliente={null}
              isOculto
              onDesocultar={() => onDesocultar(iso, 'google', String(e.id))} />
          ))}
          {/* Notas completadas */}
          {completedNotas.map(n => (
            <NotaRow key={n.id} nota={n}
              onToggle={onToggleNota}
              onDelete={onDeleteNota}
              onConvert={onConvertNota}
              onSaveContenido={onSaveContenido}
              isPast={isPast}
              newNotaId={newNotaId}
            />
          ))}
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
      <div className="flex items-start gap-2 px-5 py-2 group">
        <button
          onClick={() => onToggle(p)}
          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center hover:border-green-500 transition-colors"
          style={{ borderColor: '#CBD5E1' }}
        />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] text-gray-700 leading-snug">{p.texto}</span>
          {linkedCausa && (
            <p className="text-[11px] font-bold text-gray-700 mt-0.5">
              {linkedCausa.cliente_nombre || linkedCausa.rit || '⚖'}
            </p>
          )}
        </div>
        {children.length > 0 && (
          <span className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5">
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

          {/* Acciones */}
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
                <Scale size={9} />{linkedCausa.cliente_nombre || linkedCausa.rit} · ×
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

// ── Leyenda de tipos ──────────────────────────────────────────────────────────
function Leyenda() {
  const items = [
    { tipo: 'audiencia', label: 'Audiencia' },
    { tipo: 'plazo',     label: 'Plazo' },
    { tipo: 'tarea',     label: 'Tarea' },
    { tipo: 'reunion',   label: 'Reunión' },
    { tipo: 'gcal',      label: 'Google' },
    { tipo: 'nota',      label: 'Mis notas' },
  ]
  return (
    <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/60 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(({ tipo, label }) => {
        const t = TIPOS[tipo]
        return (
          <span key={tipo} className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Apuntes() {
  const [weekMonday, setWeekMonday] = useState(() => {
    try { return localStorage.getItem('agenda_week') || getMonday(TODAY) }
    catch { return getMonday(TODAY) }
  })

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
  const [ocultos,          setOcultos]          = useState({}) // { [fecha]: Set<"origen:itemId"> }
  const [atrasadasTareas,  setAtrasadasTareas]  = useState([])
  const [atrasadasNotas,   setAtrasadasNotas]   = useState([])

  const [pendientes,      setPendientes]      = useState([])
  const [pendienteInput,  setPendienteInput]  = useState('')
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
    const start     = weekMonday
    const end       = addDays(weekMonday, 4)
    const pastStart = addDays(weekMonday, -60) // hasta 60 días atrás para atrasadas

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
        { data: ocultosData },
        { data: atTareasData },
        { data: atNotasData },
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
        // Ocultos cubre la semana actual + el rango de atrasadas
        supabase.from('agenda_ocultos').select('fecha, origen, item_id')
          .gte('fecha', pastStart).lte('fecha', end),
        // Tareas atrasadas: pendientes con vencimiento anterior a este lunes (incluye causa_id para seguimiento)
        supabase.from('tareas').select('id, titulo, fecha_vencimiento, cliente_nombre, causa_id, causa_rit, estado, prioridad')
          .eq('estado', 'Pendiente').lt('fecha_vencimiento', weekMonday).gte('fecha_vencimiento', pastStart),
        // Notas atrasadas: no completadas de semanas anteriores
        supabase.from('agenda_notas').select('*')
          .eq('completada', false).lt('fecha', weekMonday).gte('fecha', pastStart),
      ])
      setNotas(groupBy(notasData, 'fecha'))
      setAudiencias(groupBy(audData, 'fecha'))
      setTareas(groupBy(tareasData, 'fecha_vencimiento'))
      setPlazos(groupBy(plazosData, 'fecha_limite'))
      setReuniones(groupBy(reunData, 'fecha_jueves'))
      setClientes(clientesData || [])
      setCausas(causasData || [])
      setAtrasadasTareas(atTareasData || [])
      setAtrasadasNotas(atNotasData || [])

      // Construir mapa de ocultos por fecha (cubre semana actual + rango pasado)
      const ocMap = {}
      for (const o of (ocultosData || [])) {
        if (!ocMap[o.fecha]) ocMap[o.fecha] = new Set()
        ocMap[o.fecha].add(`${o.origen}:${o.item_id}`)
      }
      setOcultos(ocMap)

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
        setPendientes((data || []).filter(p => p.texto !== '-'))
      })
  }, [])

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
  }, [])

  // ── Handlers: ocultos ───────────────────────────────────────────────────────
  const handleOcultar = useCallback(async (fecha, origen, itemId) => {
    const { error } = await supabase.from('agenda_ocultos')
      .insert({ fecha, origen, item_id: String(itemId) })
    if (error) { console.error('[agenda_ocultos] insert:', error.message); return }
    setOcultos(prev => {
      const s = new Set(prev[fecha] || [])
      s.add(`${origen}:${itemId}`)
      return { ...prev, [fecha]: s }
    })
  }, [])

  // Ocultar tarea atrasada del panel + registrar seguimiento en su causa
  const handleOcultarAtrasadaTarea = useCallback(async (tarea) => {
    const fecha = tarea.fecha_vencimiento
    await supabase.from('agenda_ocultos')
      .insert({ fecha, origen: 'tarea', item_id: String(tarea.id) })
    if (tarea.causa_id) {
      await supabase.from('revisiones').insert({
        causa_id: tarea.causa_id,
        causa_rit: tarea.causa_rit || null,
        cliente_nombre: tarea.cliente_nombre || null,
        fecha_revision: TODAY,
        por_hacer: tarea.titulo,
        que_se_hizo: 'Revisado desde la agenda. Pendiente sin completar.',
        revisada: false,
        origen: 'agenda',
      })
    }
    setOcultos(prev => {
      const s = new Set(prev[fecha] || [])
      s.add(`tarea:${tarea.id}`)
      return { ...prev, [fecha]: s }
    })
  }, [])

  const handleDesocultarAtrasadaTarea = useCallback(async (tarea) => {
    const fecha = tarea.fecha_vencimiento
    await supabase.from('agenda_ocultos')
      .delete().eq('fecha', fecha).eq('origen', 'tarea').eq('item_id', String(tarea.id))
    setOcultos(prev => {
      const s = new Set(prev[fecha] || [])
      s.delete(`tarea:${tarea.id}`)
      return { ...prev, [fecha]: s }
    })
  }, [])

  const handleDesocultar = useCallback(async (fecha, origen, itemId) => {
    await supabase.from('agenda_ocultos')
      .delete()
      .eq('fecha', fecha).eq('origen', origen).eq('item_id', String(itemId))
    setOcultos(prev => {
      const s = new Set(prev[fecha] || [])
      s.delete(`${origen}:${itemId}`)
      return { ...prev, [fecha]: s }
    })
  }, [])

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
    const newVal = !nota.completada
    const { error } = await supabase.from('agenda_notas').update({ completada: newVal }).eq('id', nota.id)
    if (!error) {
      setNotas(prev => ({
        ...prev,
        [nota.fecha]: (prev[nota.fecha] || []).map(n => n.id === nota.id ? { ...n, completada: newVal } : n)
      }))
      // Actualizar también en atrasadas si aplica
      setAtrasadasNotas(prev => prev.map(n => n.id === nota.id ? { ...n, completada: newVal } : n))
    }
  }, [])

  const handleDeleteNota = useCallback(async (nota) => {
    const { error } = await supabase.from('agenda_notas').delete().eq('id', nota.id)
    if (!error) setNotas(prev => ({
      ...prev,
      [nota.fecha]: (prev[nota.fecha] || []).filter(n => n.id !== nota.id)
    }))
  }, [])

  const handleSaveContenidoNota = useCallback(async (nota, detalle) => {
    await supabase.from('agenda_notas').update({ detalle: detalle || null }).eq('id', nota.id)
    setNotas(prev => ({
      ...prev,
      [nota.fecha]: (prev[nota.fecha] || []).map(n => n.id === nota.id ? { ...n, detalle: detalle || null } : n)
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

  // Todos los pendientes propios (planos, sin jerarquía de tabs)
  const todosPendientes = pendienteParents

  function navWeek(delta) {
    const next = addDays(weekMonday, delta * 7)
    setWeekMonday(next)
    try { localStorage.setItem('agenda_week', next) } catch {}
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#F5F6F8] overflow-hidden">

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
              <>
              {weekDays.map((date) => (
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
                  ocultosSet={ocultos[date] || new Set()}
                  onOcultar={handleOcultar}
                  onDesocultar={handleDesocultar}
                  onToggleNota={handleToggleNota}
                  onAddNota={handleAddNota}
                  onDeleteNota={handleDeleteNota}
                  onConvertNota={handleConvertNota}
                  onSaveContenido={handleSaveContenidoNota}
                />
              ))}
              </>
            )}
            <div className="h-8" />
          </div>
          {/* Leyenda de tipos */}
          <Leyenda />
        </div>

        {/* ── Columna derecha: Pendientes (40%) ── */}
        <div className="min-[1100px]:flex-1 flex flex-col overflow-hidden bg-white">

          {/* Input */}
          <div className="px-5 py-3 border-b border-[#E3E7EC] flex-shrink-0">
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

          {/* Lista scrollable */}
          <div className="flex-1 overflow-y-auto">

            {/* ── MIS PENDIENTES ── */}
            <div className="px-5 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mis pendientes</span>
              {todosPendientes.length > 0 && (
                <span className="text-[10px] tabular-nums text-gray-300">{todosPendientes.length}</span>
              )}
            </div>

            {todosPendientes.length === 0 ? (
              <div className="px-5 py-4">
                <p className="text-[11px] text-gray-300">Sin pendientes · todo en orden</p>
              </div>
            ) : (
              todosPendientes.map(p => (
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
              ))
            )}

            {/* ── VIENE DE ANTES ── */}
            <VieneDAntes
              tareas={atrasadasTareas}
              notas={atrasadasNotas}
              ocultos={ocultos}
              weekMonday={weekMonday}
              onOcultarTarea={handleOcultarAtrasadaTarea}
              onDesocultarTarea={handleDesocultarAtrasadaTarea}
              onToggleNota={handleToggleNota}
            />

            <div className="h-8" />
          </div>
        </div>
      </div>
    </div>
  )
}
