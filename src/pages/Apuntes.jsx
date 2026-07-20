import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Gavel, CheckSquare, Clock, Plus, Check, X,
  Circle, CheckCircle2, ArrowRight, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constantes ────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const ACTION_VERBS = new Set([
  'llamar','enviar','revisar','preparar','solicitar',
  'mandar','subir','hacer','contactar','confirmar',
])

const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DIAS_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES     = ['enero','febrero','marzo','abril','mayo','junio','julio',
                   'agosto','septiembre','octubre','noviembre','diciembre']

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getISOWeek(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
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

function dowShort(isoDate) {
  return DIAS_CORTO[new Date(isoDate + 'T00:00:00').getDay()]
}
function dowLong(isoDate) {
  return DIAS_LARGO[new Date(isoDate + 'T00:00:00').getDay()]
}
function dayNum(isoDate) {
  return new Date(isoDate + 'T00:00:00').getDate()
}

function isActionText(text) {
  return ACTION_VERBS.has(text.trim().toLowerCase().split(/\s+/)[0])
}

function detectClientName(text, clientes) {
  if (!text || !clientes.length) return null
  const lower = text.toLowerCase()
  return clientes.find(c => c.nombre && c.nombre.length > 2 &&
    lower.includes(c.nombre.toLowerCase()))?.nombre || null
}

function nowHHMM() {
  return new Date().toTimeString().slice(0, 5)
}

function fmtHora(h) {
  if (!h) return ''
  return h.slice(0, 5)
}

// Resalta nombre de cliente en texto
function HighlightedText({ text, clienteNombre }) {
  if (!clienteNombre) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(clienteNombre.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span className="text-[#2570BA] font-medium">{text.slice(idx, idx + clienteNombre.length)}</span>
      {text.slice(idx + clienteNombre.length)}
    </span>
  )
}

// ── ConvMenu ──────────────────────────────────────────────────────────────────
function ConvMenu({ nota, onConvert, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => { clearTimeout(t); window.removeEventListener('keydown', fn) }
  }, [onClose])

  return (
    <div className="flex items-center gap-1 mt-1 ml-10">
      <button onClick={() => onConvert('tarea')}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#1A2E4A] text-white rounded-md hover:opacity-80 transition-opacity">
        <ArrowRight size={9} />Tarea
      </button>
      <button onClick={() => onConvert('seguimiento')}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#2570BA]/10 text-[#2570BA] border border-[#2570BA]/20 rounded-md hover:bg-[#2570BA]/20 transition-colors">
        <ArrowRight size={9} />Seguimiento
      </button>
      <button onClick={onClose}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-200 rounded-md hover:text-gray-600 transition-colors">
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
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-[#2570BA] uppercase tracking-wide mb-1">→ Seguimiento</p>
          <p className="text-xs text-gray-700 leading-snug line-clamp-2">"{nota.texto}"</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Selecciona la causa donde registrar este seguimiento</p>
        </div>
        {/* Search */}
        <div className="px-4 py-2.5 border-b border-gray-100">
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por RIT, RUC, materia o cliente…"
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2570BA] focus:ring-1 focus:ring-[#2570BA]/20 transition-colors" />
        </div>
        {/* Lista */}
        <div className="overflow-y-auto flex-1 py-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-gray-300 text-center py-6">Sin resultados</p>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => onConfirm(c)}
              className="w-full text-left px-4 py-2.5 hover:bg-[#2570BA]/5 transition-colors border-b border-gray-50 last:border-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-mono font-semibold text-[#1A2E4A]">{c.rit || c.ruc || '—'}</span>
                <span className="text-[10px] text-gray-400 truncate">{c.cliente_nombre}</span>
              </div>
              {c.materia && (
                <p className="text-[10px] text-gray-500 leading-snug mt-0.5 truncate">{c.materia}</p>
              )}
            </button>
          ))}
        </div>
        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-lg border border-gray-200">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NotaItem ──────────────────────────────────────────────────────────────────
function NotaItem({ nota, clientes, onToggle, onDelete, onConvert, isPast }) {
  const [showConv, setShowConv] = useState(false)
  const [showDel, setShowDel] = useState(false)
  return (
    <div className="group"
      onMouseEnter={() => setShowDel(true)}
      onMouseLeave={() => setShowDel(false)}>
      <div className="flex items-start gap-2 py-1 px-1 rounded-lg hover:bg-gray-50/70 transition-colors">
        {/* Hora */}
        <span className="text-[10px] text-gray-300 tabular-nums mt-0.5 w-9 flex-shrink-0">
          {fmtHora(nota.hora)}
        </span>
        {/* Checkbox — todos los apuntes */}
        <button onClick={() => !isPast && onToggle(nota)} disabled={isPast}
          className={`mt-0.5 flex-shrink-0 transition-colors ${
            nota.completada ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-500'
          } ${isPast ? 'cursor-default' : 'cursor-pointer'}`}>
          {nota.completada
            ? <CheckCircle2 size={13} />
            : <Circle size={13} />}
        </button>
        {/* Texto */}
        <span className={`text-xs flex-1 leading-relaxed ${
          nota.completada ? 'line-through text-gray-300' : 'text-gray-700'
        }`}>
          <HighlightedText text={nota.texto} clienteNombre={nota.cliente_nombre} />
          {nota.tag && (
            <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-medium ${
              nota.tag === 'tarea' ? 'bg-[#1A2E4A]/10 text-[#1A2E4A]' :
              nota.tag === 'seguimiento' ? 'bg-[#2570BA]/10 text-[#2570BA]' :
              'bg-gray-100 text-gray-400'
            }`}>
              {nota.tag === 'tarea' ? '→ Tarea' : nota.tag === 'seguimiento' ? '→ Seguimiento' : 'nota'}
            </span>
          )}
        </span>
        {/* Acciones */}
        <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${showDel && !isPast ? 'opacity-100' : 'opacity-0'}`}>
          {!nota.completada && !nota.tag && (
            <button onClick={() => setShowConv(s => !s)}
              className="text-[9px] text-[#2570BA]/60 hover:text-[#2570BA] px-1.5 py-0.5 border border-[#2570BA]/20 rounded">
              convertir
            </button>
          )}
          <button onClick={() => onDelete(nota)}
            className="text-gray-300 hover:text-red-400 transition-colors">
            <X size={11} />
          </button>
        </div>
      </div>
      {showConv && (
        <ConvMenu nota={nota}
          onConvert={async (tipo) => {
            setShowConv(false)
            await onConvert(nota, tipo)
          }}
          onClose={() => setShowConv(false)} />
      )}
    </div>
  )
}

// ── SystemItems ───────────────────────────────────────────────────────────────
function SystemItems({ audiencias = [], tareas = [], plazos = [] }) {
  if (!audiencias.length && !tareas.length && !plazos.length) return null
  return (
    <div className="mb-2">
      <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-1.5 px-1">
        Desde el sistema
      </p>
      <div className="space-y-0.5">
        {audiencias.map(a => (
          <div key={a.id} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50/70">
            <Gavel size={11} className="text-purple-400 flex-shrink-0" />
            <span className="text-[10px] font-medium text-gray-500 tabular-nums w-9 flex-shrink-0">
              {fmtHora(a.hora)}
            </span>
            <span className="text-xs text-gray-700 flex-1 truncate">
              {a.cliente_nombre || a.causa_rit || a.rit}
            </span>
            {(a.rit || a.causa_rit) && (
              <span className="text-[9px] text-gray-400 flex-shrink-0">
                {a.rit || a.causa_rit}
              </span>
            )}
          </div>
        ))}
        {tareas.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50/70">
            <CheckSquare size={11} className="text-blue-400 flex-shrink-0" />
            <span className="text-[10px] text-gray-400 w-9 flex-shrink-0" />
            <span className="text-xs text-gray-700 flex-1 truncate">{t.titulo}</span>
            {t.cliente_nombre && (
              <span className="text-[9px] text-gray-400 flex-shrink-0 truncate max-w-[80px]">
                {t.cliente_nombre.split(' ')[0]}
              </span>
            )}
          </div>
        ))}
        {plazos.map(p => (
          <div key={p.id} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50/70">
            <AlertTriangle size={11} className={`flex-shrink-0 ${p.urgente ? 'text-red-400' : 'text-amber-400'}`} />
            <span className="text-[10px] text-gray-400 w-9 flex-shrink-0" />
            <span className="text-xs text-gray-700 flex-1 truncate">{p.descripcion}</span>
            {p.urgente && (
              <span className="text-[9px] font-semibold text-red-500 flex-shrink-0">URGENTE</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 mb-2 border-t border-gray-100/80" />
    </div>
  )
}

// ── DiaRow ────────────────────────────────────────────────────────────────────
function DiaRow({
  date, isToday, isOpen, isPast, onToggle,
  notas, audiencias, tareas, plazos,
  clientes, onAddNota, onToggleNota, onDeleteNota, onConvertNota,
}) {
  const [inputVal, setInputVal]     = useState('')
  const [isAdding, setIsAdding]     = useState(false)
  const [newNotaId, setNewNotaId]   = useState(null)
  const inputRef = useRef(null)

  const totalItems = (audiencias?.length || 0) + (tareas?.length || 0) +
                     (plazos?.length || 0) + (notas?.length || 0)

  const pendientes = (notas || []).filter(n => !n.completada && n.tipo === 'checkbox').length +
                     (tareas?.length || 0) + (plazos?.length || 0)

  // Preview del día (colapsado)
  const previewItems = useMemo(() => {
    const items = []
    if (audiencias?.length) items.push(`${audiencias.length} audiencia${audiencias.length > 1 ? 's' : ''}`)
    if (tareas?.length) items.push(`${tareas.length} tarea${tareas.length > 1 ? 's' : ''}`)
    if (plazos?.length) items.push(`${plazos.length} plazo${plazos.length > 1 ? 's' : ''}`)
    const checkboxPend = (notas || []).filter(n => n.tipo === 'checkbox' && !n.completada)
    if (checkboxPend.length) items.push(checkboxPend[0].texto.slice(0, 30))
    else if (notas?.length) items.push(notas[0].texto.slice(0, 30))
    return items.slice(0, 2)
  }, [audiencias, tareas, plazos, notas])

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus()
  }, [isAdding])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const text = inputVal.trim()
      if (!text) { setIsAdding(false); return }
      onAddNota(date, text).then(id => {
        setNewNotaId(id)
        setTimeout(() => setNewNotaId(null), 8000)
      })
      setInputVal('')
      setIsAdding(false)
    }
    if (e.key === 'Escape') {
      setInputVal('')
      setIsAdding(false)
    }
  }

  return (
    <div className={`border-b border-gray-100/80 last:border-0 ${
      isToday ? 'bg-[#F4F8FD]' : 'bg-white'
    }`} style={isToday ? { borderLeft: '2.5px solid #2570BA' } : {}}>

      {/* Header del día */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
          isToday ? 'hover:bg-[#EEF4FC]' : 'hover:bg-gray-50/60'
        }`}>
        {isOpen
          ? <ChevronDown size={13} className="text-gray-300 flex-shrink-0" />
          : <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />}

        {/* Nombre del día */}
        <div className="flex items-center gap-2 min-w-[70px]">
          <span className={`text-[13px] font-semibold ${isToday ? 'text-[#2570BA]' : 'text-gray-700'}`}>
            {dowShort(date)} {dayNum(date)}
          </span>
          {isToday && (
            <span className="text-[9px] font-bold text-[#2570BA] uppercase tracking-wider bg-[#2570BA]/10 px-1.5 py-0.5 rounded">
              HOY
            </span>
          )}
        </div>

        {/* Preview (colapsado) */}
        {!isOpen && previewItems.length > 0 && (
          <span className="text-[11px] text-gray-400 truncate flex-1">
            {previewItems.join(' · ')}
          </span>
        )}
        {!isOpen && previewItems.length === 0 && (
          <span className="text-[11px] text-gray-300 flex-1">Sin items</span>
        )}

        {/* Contador */}
        {totalItems > 0 && (
          <span className={`ml-auto text-[10px] tabular-nums flex-shrink-0 font-medium ${
            pendientes > 0 ? 'text-gray-400' : 'text-gray-300'
          }`}>
            {totalItems}
          </span>
        )}
      </button>

      {/* Contenido expandido */}
      {isOpen && (
        <div className="px-5 pb-4 pt-0">
          <SystemItems
            audiencias={audiencias}
            tareas={tareas}
            plazos={plazos}
          />

          {/* Apuntes */}
          {(notas || []).length > 0 && (
            <div className="mb-2">
              {(notas?.length > 0 || (audiencias?.length || tareas?.length || plazos?.length) > 0) &&
                (notas || []).length > 0 &&
                (audiencias?.length || tareas?.length || plazos?.length) > 0 && (
                <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-1.5 px-1">
                  Apuntes
                </p>
              )}
              {(notas || []).map(n => (
                <div key={n.id}>
                  <NotaItem
                    nota={n}
                    clientes={clientes}
                    isPast={isPast}
                    onToggle={onToggleNota}
                    onDelete={onDeleteNota}
                    onConvert={onConvertNota}
                  />
                  {n.id === newNotaId && isActionText(n.texto) && !n.tag && (
                    <ConvMenu nota={n}
                      onConvert={async (tipo) => { setNewNotaId(null); await onConvertNota(n, tipo) }}
                      onClose={() => setNewNotaId(null)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input para agregar */}
          {!isPast && (
            isAdding ? (
              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-[10px] text-gray-300 w-9 flex-shrink-0">{nowHHMM()}</span>
                <input
                  ref={inputRef}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Anotar… (Enter para guardar, Esc para cancelar)"
                  className="flex-1 text-xs text-gray-700 placeholder:text-gray-300 bg-transparent outline-none border-b border-[#2570BA]/30 pb-0.5 focus:border-[#2570BA] transition-colors"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-gray-300 hover:text-[#2570BA] transition-colors group">
                <Plus size={11} className="group-hover:text-[#2570BA]" />
                <span>anotar (hora automática)</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Apuntes() {
  const [weekMonday, setWeekMonday] = useState(() => {
    try { return localStorage.getItem('agenda_week') || getMonday(TODAY) }
    catch { return getMonday(TODAY) }
  })

  const [expandedDays, setExpandedDays] = useState(() => new Set([TODAY]))
  const [notas,      setNotas]      = useState({})
  const [audiencias, setAudiencias] = useState({})
  const [tareas,     setTareas]     = useState({})
  const [plazos,     setPlazos]     = useState({})
  const [clientes,   setClientes]   = useState([])
  const [causas,     setCausas]     = useState([])
  const [loading,    setLoading]    = useState(false)
  const [segPickerNota, setSegPickerNota] = useState(null)

  // Días de la semana (Lun–Vie)
  const weekDays = useMemo(() =>
    [0,1,2,3,4].map(i => addDays(weekMonday, i)),
  [weekMonday])

  const isCurrentWeek = weekMonday === getMonday(TODAY)
  const weekNum  = getISOWeek(weekMonday)
  const weekRange = fmtWeekRange(weekMonday)

  // Subtítulo: solo si HOY está en la semana visible
  const todayInWeek = weekDays.includes(TODAY)
  const pendientesTotal = useMemo(() => {
    if (!todayInWeek) return 0
    return weekDays.reduce((sum, date) => {
      const checkPend = (notas[date] || []).filter(n => !n.completada && n.tipo === 'checkbox').length
      return sum + checkPend + (tareas[date]?.length || 0) + (plazos[date]?.length || 0)
    }, 0)
  }, [weekDays, notas, tareas, plazos, todayInWeek])

  // Navegar semanas
  function navWeek(delta) {
    const next = addDays(weekMonday, delta * 7)
    setWeekMonday(next)
    try { localStorage.setItem('agenda_week', next) } catch {}
    // Expandir HOY si está en la nueva semana
    const newDays = [0,1,2,3,4].map(i => addDays(next, i))
    if (newDays.includes(TODAY)) {
      setExpandedDays(prev => new Set([...prev, TODAY]))
    }
  }

  function toggleDay(date) {
    setExpandedDays(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  // Fetch datos de la semana
  useEffect(() => {
    const start = weekMonday
    const end   = addDays(weekMonday, 4)

    async function fetchAll() {
      setLoading(true)
      const [
        { data: notasData },
        { data: audData },
        { data: tareasData },
        { data: plazosData },
        { data: clientesData },
        { data: causasData },
      ] = await Promise.all([
        supabase.from('agenda_notas').select('*')
          .gte('fecha', start).lte('fecha', end).order('hora'),
        supabase.from('audiencias').select('id, fecha, hora, rit, causa_rit, cliente_nombre, tipo')
          .gte('fecha', start).lte('fecha', end).order('hora'),
        supabase.from('tareas').select('id, titulo, fecha_vencimiento, cliente_nombre, estado, prioridad')
          .eq('estado', 'Pendiente')
          .gte('fecha_vencimiento', start).lte('fecha_vencimiento', end),
        supabase.from('plazos').select('id, descripcion, fecha_limite, causa_rit, cliente_nombre, urgente')
          .gte('fecha_limite', start).lte('fecha_limite', end),
        supabase.from('clientes').select('id, nombre'),
        supabase.from('causas')
          .select('id, rit, ruc, materia, cliente_nombre, estado')
          .in('estado', ['Abierta', 'Revisar', 'En tramitación'])
          .order('cliente_nombre', { ascending: true }),
      ])

      function groupBy(arr, key) {
        return (arr || []).reduce((m, r) => {
          const k = r[key]
          if (!m[k]) m[k] = []
          m[k].push(r)
          return m
        }, {})
      }

      setNotas(groupBy(notasData, 'fecha'))
      setAudiencias(groupBy(audData, 'fecha'))
      setTareas(groupBy(tareasData, 'fecha_vencimiento'))
      setPlazos(groupBy(plazosData, 'fecha_limite'))
      setClientes(clientesData || [])
      setCausas(causasData || [])
      setLoading(false)
    }

    fetchAll()
  }, [weekMonday])

  // Expandir HOY al montar
  useEffect(() => {
    setExpandedDays(prev => new Set([...prev, TODAY]))
  }, [])

  // Agregar nota
  const handleAddNota = useCallback(async (date, text) => {
    const hora  = nowHHMM()
    const tipo  = isActionText(text) ? 'checkbox' : 'nota'
    const clNombre = detectClientName(text, clientes)

    const { data, error } = await supabase.from('agenda_notas')
      .insert([{ fecha: date, hora, texto: text, tipo,
                 cliente_nombre: clNombre || null, completada: false }])
      .select().single()

    if (error) {
      console.error('[agenda_notas] insert error:', error.message, error.details)
      return null
    }
    if (data) {
      setNotas(prev => ({ ...prev, [date]: [...(prev[date] || []), data] }))
      return data.id
    }
    return null
  }, [clientes])

  // Toggle completada
  const handleToggleNota = useCallback(async (nota) => {
    const { error } = await supabase.from('agenda_notas')
      .update({ completada: !nota.completada }).eq('id', nota.id)
    if (!error) {
      setNotas(prev => ({
        ...prev,
        [nota.fecha]: (prev[nota.fecha] || []).map(n =>
          n.id === nota.id ? { ...n, completada: !n.completada } : n)
      }))
    }
  }, [])

  // Eliminar nota
  const handleDeleteNota = useCallback(async (nota) => {
    const { error } = await supabase.from('agenda_notas').delete().eq('id', nota.id)
    if (!error) {
      setNotas(prev => ({
        ...prev,
        [nota.fecha]: (prev[nota.fecha] || []).filter(n => n.id !== nota.id)
      }))
    }
  }, [])

  // Convertir nota en tarea o seguimiento
  const handleConvertNota = useCallback(async (nota, tipo, causa = null) => {
    if (tipo === 'tarea') {
      await supabase.from('tareas').insert([{
        titulo:           nota.texto,
        cliente_nombre:   nota.cliente_nombre || null,
        estado:           'Pendiente',
        prioridad:        'Media',
        fecha_vencimiento: nota.fecha,
      }])
    } else if (tipo === 'seguimiento') {
      // Requiere selección de causa — abre picker si no viene causa
      if (!causa) {
        setSegPickerNota(nota)
        return
      }
      await supabase.from('revisiones').insert([{
        causa_id:       causa.id,
        causa_rit:      causa.rit || null,
        cliente_nombre: causa.cliente_nombre || null,
        fecha_revision: nota.fecha,
        por_hacer:      nota.texto,
        que_se_hizo:    'Pendiente',
        semana_key:     null,
        revisada:       false,
        origen:         'agenda',
      }])
    }
    // Marcar tag en la nota
    const { error } = await supabase.from('agenda_notas')
      .update({ tag: tipo }).eq('id', nota.id)
    if (!error) {
      setNotas(prev => ({
        ...prev,
        [nota.fecha]: (prev[nota.fecha] || []).map(n =>
          n.id === nota.id ? { ...n, tag: tipo } : n)
      }))
    }
  }, [])

  // Confirmar causa en el picker de seguimiento
  const handleSegPickerConfirm = useCallback(async (causa) => {
    const nota = segPickerNota
    setSegPickerNota(null)
    if (!nota || !causa) return
    await handleConvertNota(nota, 'seguimiento', causa)
  }, [segPickerNota, handleConvertNota])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-screen bg-white">

      {/* Picker de causa para → Seguimiento */}
      {segPickerNota && (
        <SeguimientoPicker
          nota={segPickerNota}
          causas={causas}
          onConfirm={handleSegPickerConfirm}
          onClose={() => setSegPickerNota(null)}
        />
      )}

      {/* Header */}
      <div className="px-7 pt-7 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navWeek(-1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-[#1C2533]">
              Semana {weekNum} · {weekRange}
            </h1>
            {todayInWeek ? (
              <p className="mt-0.5 text-xs text-gray-400">
                <span className="capitalize">{dowLong(TODAY)}</span>
                {' '}{dayNum(TODAY)} · <span className="font-semibold text-[#2570BA]">hoy</span>
                {pendientesTotal > 0 && (
                  <span className="ml-1 text-gray-400">
                    · {pendientesTotal} pendiente{pendientesTotal !== 1 ? 's' : ''} esta semana
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-400">
                {weekMonday < getMonday(TODAY) ? 'Semana anterior — solo lectura' : 'Próxima semana'}
              </p>
            )}
          </div>
          <button onClick={() => navWeek(1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
        {!isCurrentWeek && (
          <button onClick={() => {
            const m = getMonday(TODAY)
            setWeekMonday(m)
            try { localStorage.setItem('agenda_week', m) } catch {}
          }}
            className="mt-2 text-[11px] text-[#2570BA] hover:underline">
            ← Volver a semana actual
          </button>
        )}
      </div>

      {/* Lista de días */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-300">
            Cargando…
          </div>
        ) : (
          <div className="divide-y-0">
            {weekDays.map(date => {
              const isToday  = date === TODAY
              const isPast   = date < TODAY
              return (
                <DiaRow
                  key={date}
                  date={date}
                  isToday={isToday}
                  isPast={isPast && !isToday}
                  isOpen={expandedDays.has(date)}
                  onToggle={() => toggleDay(date)}
                  notas={notas[date] || []}
                  audiencias={audiencias[date] || []}
                  tareas={tareas[date] || []}
                  plazos={plazos[date] || []}
                  clientes={clientes}
                  onAddNota={handleAddNota}
                  onToggleNota={handleToggleNota}
                  onDeleteNota={handleDeleteNota}
                  onConvertNota={handleConvertNota}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
