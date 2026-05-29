import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  Clock, Gavel, AlertCircle, ArrowRight,
  Command, Search, Calendar, Zap, RefreshCw,
  Circle, CheckCircle2, AlignLeft, Star, Send,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)
const STORAGE_KEY = 'bl_workspace_v1'

// ── helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }
function capitalizeFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function formatDateLong(iso) {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).toUpperCase()
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1 + delta, 1).toISOString().slice(0, 7)
}
const DOW = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
const DOW_LONG = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
function dowShort(iso) { return DOW[new Date(iso + 'T00:00:00').getDay()] }
function dayNum(iso)   { return new Date(iso + 'T00:00:00').getDate() }

function getMonthWeeks(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  const weeks = []
  const c = new Date(firstDay)
  const dow = c.getDay() === 0 ? 6 : c.getDay() - 1
  c.setDate(c.getDate() - dow)
  while (c.getTime() <= lastDay.getTime()) {
    const wStart = c.toISOString().slice(0, 10)
    const work   = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(c); d.setDate(c.getDate() + i)
      work.push(d.toISOString().slice(0, 10))
    }
    const wEnd = new Date(c); wEnd.setDate(c.getDate() + 6)
    const wEndIso  = wEnd.toISOString().slice(0, 10)
    const mDays    = work.filter(date => new Date(date + 'T00:00:00').getMonth() === month - 1)
    if (mDays.length) {
      const f = new Date(mDays[0] + 'T00:00:00')
      const l = new Date(mDays[mDays.length - 1] + 'T00:00:00')
      weeks.push({
        weekStart: wStart, weekEnd: wEndIso, days: mDays,
        label: `${f.getDate()} – ${l.getDate()} ${l.toLocaleDateString('es-CL', { month: 'long' }).toUpperCase()}`,
      })
    }
    c.setDate(c.getDate() + 7)
  }
  return weeks
}
function isCurrentWeek(ws, we) { return TODAY >= ws && TODAY <= we }
function isPastWeek(we)        { return we < TODAY }

// ── default data ──────────────────────────────────────────────────────────────
const WS_DEFAULT = {
  hoItems: [
    { id: uid(), text: 'Revisar escritos Causa RIT C-1042-2025', done: false },
    { id: uid(), text: 'Llamar perito Martínez por informe pendiente', done: false },
    { id: uid(), text: 'Enviar propuesta honorarios cliente Lagos', done: false },
  ],
  dump: 'Notas libres, ideas, cosas que no quieres olvidar...\n\nLlegar temprano el jueves → audiencia 9:00 en Familia\nConsultar con Patricia sobre estrategia Carmona',
  revisarJueves: [
    { id: uid(), text: 'Confirmar fecha pericia caso Morales', done: false },
    { id: uid(), text: 'Responder correo Contreras re: liquidación', done: false },
  ],
  followUps: [
    { id: uid(), text: 'Cliente Torres — cotización pendiente desde 12 mayo', done: false },
    { id: uid(), text: 'Fiscalía → respuesta oficio RIT O-882', done: false },
  ],
  semana: {},
  agendaMonth: TODAY.slice(0, 7),
}
function loadWS() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '')
    return { ...WS_DEFAULT, ...p, agendaMonth: p.agendaMonth || TODAY.slice(0, 7) }
  } catch { return { ...WS_DEFAULT } }
}

// ── micro components ──────────────────────────────────────────────────────────
function CheckItem({ item, onToggle, onDelete, onMove }) {
  return (
    <div className="flex items-start gap-2 group py-[3px]">
      <button onClick={() => onToggle(item.id)}
        className="mt-[1px] flex-shrink-0 text-gray-300 hover:text-[#1a2e4a] transition-colors">
        {item.done ? <CheckCircle2 size={13} className="text-[#1a2e4a]" /> : <Circle size={13} />}
      </button>
      <span className={`text-[13px] flex-1 leading-snug min-w-0 ${item.done ? 'line-through text-gray-300' : 'text-gray-700'}`}>
        {item.text}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {onMove && (
          <button onClick={() => onMove(item.id)} title="Siguiente semana"
            className="text-gray-300 hover:text-blue-400 transition-colors">
            <ArrowRight size={11} />
          </button>
        )}
        <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function InlineAdd({ onAdd, placeholder = 'Agregar...', autoFocus = false }) {
  const [val, setVal] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  function submit() {
    const t = val.trim(); if (!t) return
    onAdd(t); setVal('')
  }
  return (
    <div className="flex items-center gap-1.5 mt-1 group">
      <Plus size={11} className="text-gray-200 group-focus-within:text-gray-400 transition-colors flex-shrink-0" />
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-[13px] text-gray-600 placeholder-gray-200 focus:placeholder-gray-300" />
    </div>
  )
}

// ── WeekRow (flat, no outer card) ─────────────────────────────────────────────
function WeekRow({ week, semana, audiencias, tareas, isCurrent, isPast,
  onToggle, onDelete, onAdd, onMove, hoItems, onToggleHo, onDeleteHo, onAddHo }) {

  const [expanded, setExpanded] = useState(isCurrent)
  const [picker, setPicker]     = useState(false)
  const [selDay, setSelDay]     = useState(null)
  const [addTxt, setAddTxt]     = useState('')
  const addRef = useRef(null)

  // Include today even if weekend
  const displayDays = useMemo(() => {
    if (isCurrent && !week.days.includes(TODAY) && TODAY >= week.weekStart && TODAY <= week.weekEnd)
      return [...week.days, TODAY].sort()
    return week.days
  }, [week.days, week.weekStart, week.weekEnd, isCurrent])

  const activeDays = useMemo(() => displayDays.filter(date => {
    return audiencias.some(a => a.fecha === date)
      || tareas.some(t => t.fecha_vencimiento === date && t.estado !== 'Completada')
      || (semana[date] || []).length > 0
      || (isCurrent && date === TODAY)
  }), [displayDays, semana, audiencias, tareas, isCurrent])

  const count = useMemo(() => {
    let n = 0
    week.days.forEach(d => {
      n += audiencias.filter(a => a.fecha === d).length
      n += tareas.filter(t => t.fecha_vencimiento === d && t.estado !== 'Completada').length
      n += (semana[d] || []).length
    })
    if (isCurrent) n += hoItems.filter(i => !i.done).length
    return n
  }, [week.days, semana, audiencias, tareas, isCurrent, hoItems])

  function openPicker() {
    const def = displayDays.includes(TODAY) ? TODAY : displayDays[0]
    setSelDay(def); setAddTxt(''); setPicker(true)
    setTimeout(() => addRef.current?.focus(), 60)
  }
  function submitPicker() {
    const t = addTxt.trim(); if (!t || !selDay) return
    if (selDay === TODAY) onAddHo(t); else onAdd(selDay, t)
    setAddTxt(''); setPicker(false)
  }

  return (
    <div>
      {/* Week header row */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left group">
        <div className={`w-1 h-1 rounded-full flex-shrink-0 ${isCurrent ? 'bg-[#2570BA]' : isPast ? 'bg-gray-200' : 'bg-gray-300'}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-widest flex-1 ${
          isCurrent ? 'text-[#1a2e4a]' : isPast ? 'text-gray-300' : 'text-gray-500'
        }`}>
          {week.label}
        </span>
        {isCurrent && (
          <span className="text-[8px] font-bold bg-[#2570BA] text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
            ACTUAL
          </span>
        )}
        {count > 0 && (
          <span className={`text-[10px] flex-shrink-0 ${isPast ? 'text-gray-200' : 'text-gray-400'}`}>{count}</span>
        )}
        {expanded
          ? <ChevronDown  size={11} className={`flex-shrink-0 ${isPast ? 'text-gray-200' : 'text-gray-400'}`} />
          : <ChevronRight size={11} className={`flex-shrink-0 ${isPast ? 'text-gray-200' : 'text-gray-400'}`} />}
      </button>

      {/* Week content */}
      {expanded && (
        <div className="ml-3 pl-3 border-l border-gray-100 pb-1 mt-0.5 mb-1">
          {activeDays.length === 0 && (
            <p className="py-1.5 text-[11px] text-gray-300 italic">Sin actividad registrada</p>
          )}

          {activeDays.map(date => {
            const auds   = audiencias.filter(a => a.fecha === date)
            const tars   = tareas.filter(t => t.fecha_vencimiento === date && t.estado !== 'Completada')
            const custom = semana[date] || []
            const isToday = date === TODAY

            if (isToday) {
              return (
                <div key={date} className="mb-2 mt-1">
                  {/* Today: accent left border + tinted bg */}
                  <div className="relative pl-3 py-2 pr-2 rounded-lg"
                    style={{ background: 'linear-gradient(to right, rgba(26,46,74,0.04), rgba(26,46,74,0.02))' }}>
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#1a2e4a]/30 rounded-full" />

                    {/* Day header */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[12px] font-bold text-[#1a2e4a] tracking-wide">
                        {dowShort(date)} {dayNum(date)}
                      </span>
                      <span className="text-[8px] font-bold bg-[#2570BA] text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        HOY
                      </span>
                      {hoItems.filter(i => !i.done).length > 0 && (
                        <span className="text-[10px] text-[#1a2e4a]/40 ml-auto">
                          {hoItems.filter(i => !i.done).length} pendiente{hoItems.filter(i => !i.done).length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Audiencias */}
                    {auds.map(a => (
                      <div key={a.id} className="flex items-center gap-2 py-[2px]">
                        <Gavel size={11} className="text-[#1a2e4a]/40 flex-shrink-0" />
                        <span className="text-[12.5px] text-gray-800 font-semibold flex-1 truncate">{a.causa_rit}</span>
                        {a.hora && <span className="text-[11px] text-[#1a2e4a]/50 tabular-nums font-medium flex-shrink-0">{a.hora}</span>}
                      </div>
                    ))}
                    {tars.map(t => (
                      <div key={t.id} className="flex items-center gap-2 py-[2px]">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 flex-shrink-0" />
                        <span className="text-[12.5px] text-gray-600 flex-1 truncate">{t.titulo}</span>
                      </div>
                    ))}

                    {/* Divider before checklist */}
                    {(auds.length > 0 || tars.length > 0) && (
                      <div className="border-t border-[#1a2e4a]/08 my-1.5" />
                    )}

                    {/* HOY checklist */}
                    {hoItems.map(item => (
                      <CheckItem key={item.id} item={item} onToggle={onToggleHo} onDelete={onDeleteHo} />
                    ))}
                    {custom.map(item => (
                      <CheckItem key={item.id} item={item}
                        onToggle={id => onToggle(date, id)}
                        onDelete={id => onDelete(date, id)}
                        onMove={id => onMove(date, id)} />
                    ))}
                    <InlineAdd onAdd={onAddHo} placeholder="Agregar a HOY..." />
                  </div>
                </div>
              )
            }

            // Normal day
            return (
              <div key={date} className="mb-1.5 mt-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] font-semibold ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>
                    {dowShort(date)} {dayNum(date)}
                  </span>
                  <div className={`flex-1 h-px ${isPast ? 'bg-gray-50' : 'bg-gray-100'}`} />
                </div>
                {auds.map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-[2px] pl-0.5">
                    <Gavel size={11} className="text-[#1a2e4a]/35 flex-shrink-0" />
                    <span className={`text-[12px] font-medium flex-1 truncate ${isPast ? 'text-gray-400' : 'text-gray-700'}`}>{a.causa_rit}</span>
                    {a.hora && <span className={`text-[11px] tabular-nums flex-shrink-0 ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>{a.hora}</span>}
                  </div>
                ))}
                {tars.map(t => (
                  <div key={t.id} className="flex items-center gap-2 py-[2px] pl-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${isPast ? 'border-gray-200' : 'border-amber-300'}`} />
                    <span className={`text-[12px] flex-1 truncate ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>{t.titulo}</span>
                  </div>
                ))}
                {custom.map(item => (
                  <div key={item.id} className="pl-0.5">
                    <CheckItem item={item}
                      onToggle={id => onToggle(date, id)}
                      onDelete={id => onDelete(date, id)}
                      onMove={id => onMove(date, id)} />
                  </div>
                ))}
              </div>
            )
          })}

          {/* Add to week */}
          {picker ? (
            <div className="mt-1 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                {displayDays.map(date => (
                  <button key={date} onClick={() => setSelDay(date)}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-all ${
                      selDay === date ? 'bg-[#2570BA] text-white'
                        : date === TODAY ? 'bg-[#1a2e4a]/10 text-[#1a2e4a]'
                        : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {dowShort(date)} {dayNum(date)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input ref={addRef} value={addTxt} onChange={e => setAddTxt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitPicker(); if (e.key === 'Escape') setPicker(false) }}
                  placeholder="Nota, tarea o recordatorio..."
                  className="flex-1 text-[12px] text-gray-700 placeholder-gray-300 bg-transparent border-none outline-none" />
                <button onClick={() => setPicker(false)} className="text-[10px] text-gray-300 hover:text-gray-500 flex-shrink-0">cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={openPicker}
              className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-300 hover:text-[#1a2e4a] transition-colors group">
              <Plus size={10} /> agregar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── inline section (right column) ────────────────────────────────────────────
function RightSection({ title, icon: Icon, iconColor, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="px-5 py-4 border-t border-gray-50">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 mb-2 text-left group">
        <Icon size={12} className={`flex-shrink-0 ${iconColor}`} />
        <span className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest flex-1">{title}</span>
        {badge > 0 && (
          <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#1a2e4a]/08 text-[#1a2e4a] text-[9px] font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
        {open
          ? <ChevronDown  size={11} className="text-gray-200 flex-shrink-0" />
          : <ChevronRight size={11} className="text-gray-200 flex-shrink-0" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// ── CMD+K ─────────────────────────────────────────────────────────────────────
const CMD_ACTIONS = [
  { id: 'clientes',   label: 'Ir a Clientes',   path: '/clientes'   },
  { id: 'causas',     label: 'Ir a Causas',      path: '/causas'     },
  { id: 'audiencias', label: 'Ir a Audiencias',  path: '/audiencias' },
  { id: 'plazos',     label: 'Ir a Plazos',      path: '/plazos'     },
  { id: 'documentos', label: 'Ir a Documentos',  path: '/documentos' },
  { id: 'gastos',     label: 'Ir a Gastos',      path: '/gastos'     },
  { id: 'tareas',     label: 'Ir a Tareas',      path: '/tareas'     },
]
function CmdKModal({ open, onClose }) {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (open) { setQ(''); setTimeout(() => ref.current?.focus(), 50) } }, [open])
  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])
  const filtered = useMemo(() => {
    const lq = q.toLowerCase()
    return q ? CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(lq)) : CMD_ACTIONS
  }, [q])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      style={{ background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-[460px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar o navegar..."
            className="flex-1 text-[14px] text-gray-800 placeholder-gray-300 bg-transparent border-none outline-none" />
          <kbd className="text-[10px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="py-1.5 max-h-64 overflow-y-auto">
          {filtered.map(a => (
            <a key={a.id} href={`#${a.path}`} onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group">
              <span className="text-[13px] text-gray-700 group-hover:text-gray-900 flex-1">{a.label}</span>
              <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-400" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Apuntes() {
  const [audiencias, setAudiencias] = useState([])
  const [tareas,     setTareas]     = useState([])
  const [ws, setWs]                 = useState(loadWS)

  useEffect(() => {
    supabase.from('audiencias')
      .select('id, tipo, fecha, hora, causa_rit, estado, cliente_nombre')
      .then(({ data }) => setAudiencias(data || []))
    supabase.from('tareas')
      .select('id, titulo, fecha_vencimiento, estado, causa_rit, cliente_nombre, categoria')
      .then(({ data }) => setTareas(data || []))
  }, [])
  const [cmdOpen, setCmdOpen] = useState(false)
  const [capturaInput, setCapturaInput] = useState('')

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(ws)) }, [ws])
  useEffect(() => {
    const fn = e => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v) } }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // mutations
  const setField = useCallback((f, v) => setWs(p => ({ ...p, [f]: v })), [])
  const toggleHo = useCallback(id => setWs(p => ({ ...p, hoItems: p.hoItems.map(i => i.id === id ? { ...i, done: !i.done } : i) })), [])
  const deleteHo = useCallback(id => setWs(p => ({ ...p, hoItems: p.hoItems.filter(i => i.id !== id) })), [])
  const addHo    = useCallback(text => setWs(p => ({ ...p, hoItems: [...p.hoItems, { id: uid(), text, done: false }] })), [])

  const toggleJueves = useCallback(id => setWs(p => ({ ...p, revisarJueves: p.revisarJueves.map(i => i.id === id ? { ...i, done: !i.done } : i) })), [])
  const deleteJueves = useCallback(id => setWs(p => ({ ...p, revisarJueves: p.revisarJueves.filter(i => i.id !== id) })), [])
  const addJueves    = useCallback(text => setWs(p => ({ ...p, revisarJueves: [...p.revisarJueves, { id: uid(), text, done: false }] })), [])

  const toggleFU = useCallback(id => setWs(p => ({ ...p, followUps: p.followUps.map(i => i.id === id ? { ...i, done: !i.done } : i) })), [])
  const deleteFU = useCallback(id => setWs(p => ({ ...p, followUps: p.followUps.filter(i => i.id !== id) })), [])
  const addFU    = useCallback(text => setWs(p => ({ ...p, followUps: [...p.followUps, { id: uid(), text, done: false }] })), [])

  const toggleS = useCallback((date, id) => setWs(p => ({ ...p, semana: { ...p.semana, [date]: (p.semana[date] || []).map(i => i.id === id ? { ...i, done: !i.done } : i) } })), [])
  const deleteS = useCallback((date, id) => setWs(p => ({ ...p, semana: { ...p.semana, [date]: (p.semana[date] || []).filter(i => i.id !== id) } })), [])
  const addS    = useCallback((date, text) => setWs(p => ({ ...p, semana: { ...p.semana, [date]: [...(p.semana[date] || []), { id: uid(), text, done: false }] } })), [])
  const moveS   = useCallback((date, id) => {
    const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate() + 7)
    const nIso = next.toISOString().slice(0, 10)
    setWs(p => {
      const item = (p.semana[date] || []).find(i => i.id === id); if (!item) return p
      return { ...p, semana: { ...p.semana, [date]: (p.semana[date] || []).filter(i => i.id !== id), [nIso]: [...(p.semana[nIso] || []), { ...item }] } }
    })
  }, [])

  const goPrev = useCallback(() => setWs(p => ({ ...p, agendaMonth: shiftMonth(p.agendaMonth, -1) })), [])
  const goNext = useCallback(() => setWs(p => ({ ...p, agendaMonth: shiftMonth(p.agendaMonth, +1) })), [])

  const causasActivas = useMemo(() => {
    const seen = new Set()
    return tareas.filter(t => { if (!t.causa_rit || seen.has(t.causa_rit)) return false; seen.add(t.causa_rit); return true })
      .map(t => ({ rit: t.causa_rit, cliente: t.cliente_nombre || '' })).slice(0, 5)
  }, [tareas])

  const monthWeeks = useMemo(() => getMonthWeeks(ws.agendaMonth), [ws.agendaMonth])

  function sendCaptura() {
    const t = capturaInput.trim(); if (!t) return
    addHo(t); setCapturaInput('')
  }

  return (
    <div className="flex flex-col h-full bg-[#f7f8fa] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight leading-none">Agenda diaria</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{capitalizeFirst(formatDateLong(TODAY))}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-60 focus-within:border-[#1a2e4a]/30 focus-within:bg-white transition-all">
            <Zap size={12} className="text-gray-300 flex-shrink-0" />
            <input value={capturaInput} onChange={e => setCapturaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendCaptura() }}
              placeholder="Captura rápida..."
              className="flex-1 text-[13px] text-gray-700 placeholder-gray-300 bg-transparent border-none outline-none" />
            {capturaInput && (
              <button onClick={sendCaptura} className="text-[#1a2e4a] hover:text-[#1a2e4a]/70 flex-shrink-0">
                <Send size={12} />
              </button>
            )}
          </div>
          <button onClick={() => setCmdOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 transition-all text-gray-500">
            <Command size={12} /><span className="text-[12px]">K</span>
          </button>
        </div>
      </div>

      {/* ── Workspace surface ── */}
      <div className="flex-1 overflow-y-auto px-8 py-5 min-h-0">
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr' }}>

          {/* ══ LEFT: Agenda Diaria ══ */}
          <div className="border-r border-gray-50">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50 sticky top-0 bg-white z-10">
              <Calendar size={12} className="text-blue-400 flex-shrink-0" />
              <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-widest flex-1">Agenda Diaria</span>
              <div className="flex items-center gap-0.5">
                <button onClick={goPrev} className="p-1 rounded hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1 whitespace-nowrap">
                  {monthLabel(ws.agendaMonth)}
                </span>
                <button onClick={goNext} className="p-1 rounded hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Weeks */}
            <div className="px-4 py-3 space-y-0.5">
              {monthWeeks.map(week => (
                <WeekRow
                  key={week.weekStart}
                  week={week}
                  semana={ws.semana}
                  audiencias={audiencias}
                  tareas={tareas}
                  isCurrent={isCurrentWeek(week.weekStart, week.weekEnd)}
                  isPast={isPastWeek(week.weekEnd)}
                  onToggle={toggleS}
                  onDelete={deleteS}
                  onAdd={addS}
                  onMove={moveS}
                  hoItems={ws.hoItems}
                  onToggleHo={toggleHo}
                  onDeleteHo={deleteHo}
                  onAddHo={addHo}
                />
              ))}
            </div>
          </div>

          {/* ══ RIGHT: Brain dump + sections ══ */}
          <div className="divide-y divide-gray-50">

            {/* Brain Dump */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <AlignLeft size={12} className="text-purple-400 flex-shrink-0" />
                <span className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Brain Dump</span>
              </div>
              <textarea
                value={ws.dump}
                onChange={e => setField('dump', e.target.value)}
                placeholder="Escribe lo que sea... ideas, notas, cosas sueltas."
                className="w-full min-h-[220px] text-[13px] text-gray-700 placeholder-gray-300 bg-transparent border-none outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Revisar el jueves */}
            <RightSection title="Revisar el jueves" icon={RefreshCw} iconColor="text-amber-400"
              badge={ws.revisarJueves.filter(i => !i.done).length}>
              {ws.revisarJueves.map(item => (
                <CheckItem key={item.id} item={item} onToggle={toggleJueves} onDelete={deleteJueves} />
              ))}
              <InlineAdd onAdd={addJueves} placeholder="Agregar para revisar..." />
            </RightSection>

            {/* Esperando */}
            <RightSection title="Esperando respuesta" icon={Clock} iconColor="text-rose-400"
              badge={ws.followUps.filter(i => !i.done).length}>
              {ws.followUps.map(item => (
                <CheckItem key={item.id} item={item} onToggle={toggleFU} onDelete={deleteFU} />
              ))}
              <InlineAdd onAdd={addFU} placeholder="Agregar seguimiento..." />
            </RightSection>

            {/* Causas activas */}
            {causasActivas.length > 0 && (
              <RightSection title="Causas activas" icon={Star} iconColor="text-yellow-400" defaultOpen={false}>
                {causasActivas.map(c => (
                  <div key={c.rit} className="flex items-center gap-2 py-[3px] group">
                    <ChevronRight size={11} className="text-gray-200 group-hover:text-gray-400 flex-shrink-0" />
                    <span className="text-[12px] font-medium text-gray-500 flex-shrink-0">{c.rit}</span>
                    {c.cliente && <span className="text-[12px] text-gray-400 truncate">{c.cliente}</span>}
                  </div>
                ))}
              </RightSection>
            )}

          </div>
        </div>
      </div>

      <CmdKModal open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
