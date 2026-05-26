import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Clock, MapPin,
  Video, User, FileText, AlertTriangle, Flag, Eye,
  ExternalLink, Link2, ChevronDown, Calendar, Edit2, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY   = '2026-05-21'
const NOW_H   = 10
const NOW_M   = 30
const HOUR_PX = 64
const D_START = 8
const D_END   = 20
const HOURS   = Array.from({ length: D_END - D_START }, (_, i) => D_START + i)
const MESES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Date utils ────────────────────────────────────────────────────────────────
const parse   = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d) }
const fmt     = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (s,n) => { const d = parse(s); d.setDate(d.getDate()+n); return fmt(d) }
const getDow  = s => { const v = parse(s).getDay(); return v===0?6:v-1 }

function getWeekDays(anchor) {
  const mon = addDays(anchor, -getDow(anchor))
  return Array.from({ length: 7 }, (_,i) => addDays(mon, i))
}

function getMonthGrid(anchor) {
  const d = parse(anchor), yr = d.getFullYear(), mo = d.getMonth()
  const firstDow = (() => { const v = new Date(yr,mo,1).getDay(); return v===0?6:v-1 })()
  const lastDay  = new Date(yr,mo+1,0).getDate()
  const prevLast = new Date(yr,mo,0).getDate()
  const cells = []
  for (let i = firstDow-1; i >= 0; i--) cells.push(fmt(new Date(yr,mo-1,prevLast-i)))
  for (let i = 1; i <= lastDay; i++) cells.push(fmt(new Date(yr,mo,i)))
  while (cells.length < 42) cells.push(fmt(new Date(yr,mo+1,cells.length-lastDay-firstDow+1)))
  return cells
}

function timeToTop(h_str) {
  if (!h_str) return 0
  const [h,m] = h_str.split(':').map(Number)
  return (h + m/60 - D_START) * HOUR_PX
}
function durToH(min) { return Math.max(min/60*HOUR_PX - 4, 22) }
function dropTime(yPx) {
  const raw = (yPx / HOUR_PX) * 60 + D_START * 60
  const snapped = Math.round(raw / 30) * 30
  const h = Math.floor(snapped/60), m = snapped%60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}
function fmtFecha(s) {
  if (!s) return '—'
  const d = parse(s)
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
}
function fmtHdr(s) {
  const labels = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
  return { label: labels[getDow(s)], num: parse(s).getDate() }
}
function fmtMonthLabel(anchor) {
  const d = parse(anchor)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}
function fmtWeekLabel(days) {
  const a = parse(days[0]), b = parse(days[6])
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} de ${MESES[a.getMonth()]} ${a.getFullYear()}`
  return `${a.getDate()} ${MESES_S[a.getMonth()]} – ${b.getDate()} ${MESES_S[b.getMonth()]} ${b.getFullYear()}`
}

// ── Styles ────────────────────────────────────────────────────────────────────
const TIPO_COLOR = {
  audiencia: '#60a5fa',
  tarea:     '#34d399',
  reunion:   '#a78bfa',
  plazo:     '#fbbf24',
  fiscalia:  '#f87171',
  interno:   '#94a3b8',
}

// Colores de prioridad para tareas sincronizadas (border left)
const PRIORIDAD_COLOR = {
  Alta:  '#f87171',
  Media: '#fbbf24',
  Baja:  '#94a3b8',
}

const TIPOS = {
  audiencia: { label:'Audiencia', dot:'bg-blue-400',    block:'bg-blue-50 text-blue-800',   allDay:'bg-blue-100 text-blue-700',   pill:'bg-blue-50 text-blue-600',   alert:'bg-blue-50 border-blue-100 text-blue-700'   },
  tarea:     { label:'Tarea',     dot:'bg-emerald-400', block:'bg-emerald-50 text-emerald-800', allDay:'bg-emerald-100 text-emerald-700', pill:'bg-emerald-50 text-emerald-600', alert:'bg-emerald-50 border-emerald-100 text-emerald-700' },
  reunion:   { label:'Reunión',   dot:'bg-violet-400',  block:'bg-violet-50 text-violet-800',   allDay:'bg-violet-100 text-violet-700',  pill:'bg-violet-50 text-violet-600',   alert:'bg-violet-50 border-violet-100 text-violet-700'  },
  plazo:     { label:'Plazo',     dot:'bg-amber-400',   block:'bg-amber-50 text-amber-800',     allDay:'bg-amber-100 text-amber-700',    pill:'bg-amber-50 text-amber-600',     alert:'bg-amber-50 border-amber-100 text-amber-700'    },
  fiscalia:  { label:'Fiscalía',  dot:'bg-red-400',     block:'bg-red-50 text-red-800',         allDay:'bg-red-100 text-red-700',        pill:'bg-red-50 text-red-600',         alert:'bg-red-50 border-red-100 text-red-700'          },
  interno:   { label:'Interno',   dot:'bg-slate-300',   block:'bg-slate-50 text-slate-600',     allDay:'bg-slate-100 text-slate-500',    pill:'bg-slate-100 text-slate-500',    alert:'bg-slate-50 border-slate-100 text-slate-500'   },
}

const ABOGADAS = [
  { key:'MT', nombre:'Macarena', bg:'bg-blue-100',    text:'text-blue-700'    },
  { key:'AB', nombre:'Angélica', bg:'bg-emerald-100', text:'text-emerald-700' },
  { key:'CL', nombre:'Catalina', bg:'bg-violet-100',  text:'text-violet-700'  },
]

const TIPO_KEYS = Object.keys(TIPOS)

// ── Context signals ───────────────────────────────────────────────────────────
const SIGNAL_STYLES = {
  urgent: { bg:'bg-red-50 border border-red-100 text-red-600',      dot:'bg-red-400'    },
  warn:   { bg:'bg-amber-50 border border-amber-100 text-amber-600', dot:'bg-amber-400'  },
  info:   { bg:'bg-blue-50 border border-blue-100 text-blue-600',    dot:'bg-blue-400'   },
}

function getSignals(ev, todos) {
  const s = []
  if (ev.tipo === 'audiencia' && !ev.sala)
    s.push({ kind:'warn',   label:'Sin sala asignada'      })
  if (ev.tipo === 'audiencia' && !ev.tribunal)
    s.push({ kind:'warn',   label:'Sin tribunal indicado'  })
  if (ev.tipo === 'plazo' && ev.fecha <= TODAY)
    s.push({ kind:'urgent', label: ev.fecha === TODAY ? 'Vence hoy' : 'Plazo vencido' })
  if (ev.tipo === 'tarea' && ev._source === 'tarea' && ev.fecha < TODAY && !ev.completado)
    s.push({ kind:'urgent', label: 'Tarea vencida' })
  if (ev.tipo === 'tarea' && ev._source === 'tarea' && ev.fecha === TODAY && !ev.completado && ev._prioridad === 'Alta')
    s.push({ kind:'warn', label: 'Vence hoy · Alta prioridad' })
  if (ev.tipo === 'reunion' && ev.modalidad === 'zoom' && !ev.zoom_link)
    s.push({ kind:'warn',   label:'Sin enlace Zoom'        })
  if (ev._source === 'audiencia' && ev.modalidad === 'zoom' && !ev.zoom_link)
    s.push({ kind:'warn',   label:'Sin enlace Zoom'        })
  if (ev.causa_rit) {
    const rel = todos.filter(e =>
      e.id !== ev.id && e.causa_rit === ev.causa_rit &&
      e.tipo === 'tarea' && e.fecha >= TODAY && e.fecha <= addDays(ev.fecha, 5)
    )
    if (rel.length) s.push({ kind:'info', label:`${rel.length} tarea${rel.length>1?'s':''} pendiente${rel.length>1?'s':''}` })
  }
  return s
}

// ── Sample data ───────────────────────────────────────────────────────────────
const EVENTOS_INIT = []

// ── Hover Preview ────────────────────────────────────────────────────────────
function HoverPreview({ ev, x, y, todos }) {
  const t      = TIPOS[ev.tipo] || TIPOS.interno
  const abo    = ABOGADAS.find(a => a.key === ev.responsable)
  const sigs   = getSignals(ev, todos)
  const safeX  = Math.min(x, window.innerWidth  - 256)
  const safeY  = Math.min(y, window.innerHeight - 200)

  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ left: safeX, top: safeY }}>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-black/8 p-3.5 w-[240px] animate-in fade-in duration-150"
        style={{ borderLeft: `3px solid ${TIPO_COLOR[ev.tipo]}` }}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${t.pill}`}>{t.label}</span>
          {abo && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto ${abo.bg} ${abo.text}`}>
              {abo.nombre}
            </span>
          )}
        </div>
        <p className="text-[12px] font-bold text-gray-800 leading-snug mb-2">{ev.titulo}</p>
        <div className="space-y-1">
          {ev.hora_inicio && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <Clock size={9} className="flex-shrink-0" />
              <span>{ev.hora_inicio} · {ev.duracion} min</span>
            </div>
          )}
          {ev.cliente && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <User size={9} className="flex-shrink-0" />
              <span className="truncate">{ev.cliente}</span>
            </div>
          )}
          {(ev.tribunal || ev.sala) && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <MapPin size={9} className="flex-shrink-0" />
              <span className="truncate">{[ev.tribunal, ev.sala].filter(Boolean).join(' · ')}</span>
            </div>
          )}
          {ev.causa_rit && (
            <div className="flex items-center gap-1.5 text-[10px] text-violet-500 mt-1">
              <Flag size={9} className="flex-shrink-0" />
              <span className="font-mono font-semibold">{ev.causa_rit}</span>
            </div>
          )}
        </div>
        {sigs.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-gray-50 space-y-1">
            {sigs.map((s, i) => {
              const ss = SIGNAL_STYLES[s.kind]
              return (
                <div key={i} className={`flex items-center gap-1.5 text-[9px] font-semibold px-2 py-1 rounded-lg ${ss.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ss.dot}`} />
                  {s.label}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Alert Bar ─────────────────────────────────────────────────────────────────
function AlertBar({ eventos }) {
  const todayEvs   = eventos.filter(e => e.fecha === TODAY)
  const tmrwEvs    = eventos.filter(e => e.fecha === addDays(TODAY,1))
  const plazosHoy  = todayEvs.filter(e => e.tipo === 'plazo')
  const audHoy     = todayEvs.filter(e => e.tipo === 'audiencia')
  const audManana  = tmrwEvs.filter(e => e.tipo === 'audiencia')
  const totalHoy   = todayEvs.length

  const alerts = []
  if (plazosHoy.length)  alerts.push({ label:`${plazosHoy.length} plazo${plazosHoy.length>1?'s':''} vence${plazosHoy.length>1?'n':''} hoy`,  cls:'bg-red-50 border-red-100 text-red-700',    dot:'bg-red-400'    })
  if (audHoy.length)     alerts.push({ label:`${audHoy.length} audiencia${audHoy.length>1?'s':''} hoy`,                                        cls:'bg-blue-50 border-blue-100 text-blue-700',  dot:'bg-blue-400'   })
  if (audManana.length)  alerts.push({ label:`${audManana.length} audiencia${audManana.length>1?'s':''} mañana`,                               cls:'bg-indigo-50 border-indigo-100 text-indigo-700', dot:'bg-indigo-400' })
  if (alerts.length === 0) alerts.push({ label:'Semana sin alertas críticas', cls:'bg-emerald-50 border-emerald-100 text-emerald-700', dot:'bg-emerald-400' })

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 border-b border-gray-100 bg-white flex-shrink-0 overflow-x-auto">
      <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest flex-shrink-0">Alertas</span>
      <div className="flex items-center gap-2 flex-wrap">
        {alerts.map((a, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${a.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
            {a.label}
          </span>
        ))}
      </div>
      <div className="ml-auto flex-shrink-0 text-[10px] text-gray-300 font-medium whitespace-nowrap">
        Jueves, {fmtFecha(TODAY)}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ eventos, days, onEventClick, onSlotClick, onDrop }) {
  const scrollRef    = useRef(null)
  const hoverTimer   = useRef(null)
  const [dragOver,   setDragOver]   = useState(null)
  const [draggedId,  setDraggedId]  = useState(null)
  const [hoverEv,    setHoverEv]    = useState(null)
  const [hoverPos,   setHoverPos]   = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = Math.max(0, (NOW_H - 2 - D_START) * HOUR_PX)
  }, [])

  const allDayEvs = eventos.filter(e => e.allDay)
  const timedEvs  = eventos.filter(e => !e.allDay && e.hora_inicio)

  const handleDrop = (e, date) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('evId')
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOver(null); setDraggedId(null)
    if (id) onDrop(id, date, dropTime(e.clientY - rect.top))
  }

  const showHover = (ev, e) => {
    clearTimeout(hoverTimer.current)
    const r = e.currentTarget.getBoundingClientRect()
    setHoverPos({ x: r.right + 10, y: r.top })
    hoverTimer.current = setTimeout(() => setHoverEv(ev), 350)
  }
  const hideHover = () => { clearTimeout(hoverTimer.current); setHoverEv(null) }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-w-0" onMouseLeave={hideHover}>
      {/* Day headers */}
      <div className="flex border-b border-gray-100 flex-shrink-0 bg-white">
        <div className="w-14 flex-shrink-0" />
        {days.map(day => {
          const { label, num } = fmtHdr(day)
          const isToday   = day === TODAY
          const isWeekend = getDow(day) >= 5
          return (
            <div key={day} className={`flex-1 text-center py-3 border-l border-gray-50 ${isToday ? 'bg-blue-50/30' : isWeekend ? 'bg-gray-50/50' : ''}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-blue-500' : isWeekend ? 'text-gray-300' : 'text-gray-400'}`}>{label}</div>
              <div className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${
                isToday ? 'bg-[#1a2e4a] text-white' : isWeekend ? 'text-gray-300' : 'text-gray-700'
              }`}>{num}</div>
            </div>
          )
        })}
      </div>

      {/* All-day strip */}
      <div className="flex border-b border-gray-100 bg-gray-50/40 flex-shrink-0">
        <div className="w-14 flex-shrink-0 flex items-center justify-end pr-2">
          <span className="text-[9px] text-gray-300 font-medium">Todo día</span>
        </div>
        {days.map(day => {
          const dayEvs    = allDayEvs.filter(e => e.fecha === day)
          const isToday   = day === TODAY
          const isWeekend = getDow(day) >= 5
          return (
            <div key={day} className={`flex-1 border-l border-gray-100 px-1 py-1.5 min-h-[28px] ${isToday ? 'bg-blue-50/20' : isWeekend ? 'bg-gray-50/30' : ''}`}>
              {dayEvs.map(ev => {
                const t        = TIPOS[ev.tipo] || TIPOS.interno
                const sigs     = getSignals(ev, eventos)
                const isSynced = !!ev._source
                // Para tareas sincronizadas, usar color de prioridad en el borde
                const bdrColor = (ev._source === 'tarea' && ev._prioridad)
                  ? PRIORIDAD_COLOR[ev._prioridad] ?? TIPO_COLOR[ev.tipo]
                  : TIPO_COLOR[ev.tipo]
                const isDone   = ev.completado
                return (
                  <button key={ev.id} onClick={() => onEventClick(ev)}
                    onMouseEnter={e => showHover(ev, e)} onMouseLeave={hideHover}
                    className={`w-full text-left text-[10px] font-semibold px-2 py-0.5 rounded-md mb-0.5 transition-all hover:opacity-90 hover:scale-[1.01] flex items-center gap-1 ${t.allDay} ${isDone ? 'opacity-50' : ''}`}
                    style={{ borderLeft: `2px solid ${bdrColor}` }}>
                    {isSynced
                      ? <Link2 size={8} className="opacity-40 flex-shrink-0" />
                      : <Flag  size={8} className="opacity-50 flex-shrink-0" />}
                    <span className={`truncate ${isDone ? 'line-through' : ''}`}>{ev.titulo}</span>
                    {sigs.some(s => s.kind === 'urgent') && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />}
                    {sigs.some(s => s.kind === 'warn') && !sigs.some(s => s.kind === 'urgent') && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: (D_END - D_START) * HOUR_PX }}>
          {/* Time labels */}
          <div className="w-14 flex-shrink-0 relative">
            {HOURS.map((h, i) => (
              <div key={h} className="absolute w-full" style={{ top: i * HOUR_PX - 9 }}>
                <span className="block text-right pr-3 text-[10px] text-gray-300 font-medium leading-none">
                  {String(h).padStart(2,'0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const dayEvs    = timedEvs.filter(e => e.fecha === day)
            const isToday   = day === TODAY
            const isWeekend = getDow(day) >= 5

            return (
              <div
                key={day}
                className={`flex-1 border-l relative transition-colors duration-150
                  ${isToday   ? 'bg-blue-50/15 border-gray-100' : ''}
                  ${isWeekend && !isToday ? 'bg-gray-50/40 border-gray-50' : !isToday ? 'border-gray-100' : ''}
                  ${dragOver === day ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-200/60' : ''}`}
                style={{ height: (D_END - D_START) * HOUR_PX }}
                onDragOver={e => { e.preventDefault(); setDragOver(day) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, day)}
              >
                {/* Hour lines */}
                {HOURS.map((h, i) => (
                  <div key={h}>
                    <div className="absolute left-0 right-0 border-t border-gray-100/80" style={{ top: i * HOUR_PX }}
                      onClick={() => onSlotClick(day, `${String(h).padStart(2,'0')}:00`)} />
                    <div className="absolute left-0 right-0 border-t border-gray-50" style={{ top: i * HOUR_PX + HOUR_PX/2 }} />
                  </div>
                ))}

                {/* Current time line */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                    style={{ top: (NOW_H + NOW_M/60 - D_START) * HOUR_PX }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 -ml-1.5 shadow-md shadow-red-200" />
                    <div className="flex-1 h-px bg-red-400/60" />
                  </div>
                )}

                {/* Events */}
                {dayEvs.map(ev => {
                  const t        = TIPOS[ev.tipo] || TIPOS.interno
                  const top      = timeToTop(ev.hora_inicio)
                  const h        = durToH(ev.duracion)
                  const abo      = ABOGADAS.find(a => a.key === ev.responsable)
                  const sigs     = getSignals(ev, eventos)
                  const isDone   = ev.completado
                  const isDrag   = draggedId === ev.id
                  const isSynced = !!ev._source
                  // Color borde: prioridad para tareas sinc, tipo para el resto
                  const bdrColor = (ev._source === 'tarea' && ev._prioridad)
                    ? PRIORIDAD_COLOR[ev._prioridad] ?? TIPO_COLOR[ev.tipo]
                    : TIPO_COLOR[ev.tipo]

                  return (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('evId', ev.id)
                        e.stopPropagation()
                        setDraggedId(ev.id)
                        hideHover()
                      }}
                      onDragEnd={() => setDraggedId(null)}
                      onMouseEnter={e => showHover(ev, e)}
                      onMouseLeave={hideHover}
                      onClick={() => { hideHover(); onEventClick(ev) }}
                      className={`absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer select-none
                        ${t.block}
                        ${isDone ? 'opacity-40' : ''}
                        ${isDrag ? 'opacity-25 cursor-grabbing' : 'hover:shadow-md hover:scale-[1.01] hover:-translate-y-px hover:z-20 active:scale-[0.98]'}`}
                      style={{
                        top: top + 2, height: h,
                        borderLeft: `3px solid ${bdrColor}`,
                        zIndex: isDrag ? 1 : 5,
                        transition: isDrag ? 'none' : 'all 0.15s ease',
                      }}
                    >
                      <div className={`font-semibold text-[11px] leading-tight truncate flex items-center gap-1 ${isDone ? 'line-through opacity-60' : ''}`}>
                        {isSynced && <Link2 size={8} className="opacity-30 flex-shrink-0" />}
                        {ev.hora_inicio} · {ev.titulo}
                      </div>
                      {h > 28 && ev.cliente && (
                        <div className="text-[10px] opacity-60 truncate mt-0.5">{ev.cliente}</div>
                      )}
                      {h > 46 && abo && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block ${abo.bg} ${abo.text}`}>
                          {abo.key}
                        </span>
                      )}
                      {/* Signal dots */}
                      {sigs.length > 0 && (
                        <div className="absolute top-1 right-1.5 flex gap-0.5">
                          {sigs.some(s => s.kind === 'urgent') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          )}
                          {!sigs.some(s => s.kind === 'urgent') && sigs.some(s => s.kind === 'warn') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                          {sigs.some(s => s.kind === 'info') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating hover preview */}
      {hoverEv && <HoverPreview ev={hoverEv} x={hoverPos.x} y={hoverPos.y} todos={eventos} />}
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────
function MonthView({ eventos, anchor, onEventClick, onDayClick, selectedDay }) {
  const d = parse(anchor)
  const curMonth = d.getMonth()
  const cells = getMonthGrid(anchor)
  const DAY_HDRS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="grid grid-cols-7 mb-2">
        {DAY_HDRS.map(lbl => (
          <div key={lbl} className="text-center text-[9px] font-bold text-gray-300 uppercase tracking-widest py-1">{lbl}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        {cells.map(dateStr => {
          const isCurrentMonth = parse(dateStr).getMonth() === curMonth
          const isToday        = dateStr === TODAY
          const isSelected     = dateStr === selectedDay
          const dayEvs         = eventos.filter(e => e.fecha === dateStr)
          const allDayEvs      = dayEvs.filter(e => e.allDay)
          const timedEvs       = dayEvs.filter(e => !e.allDay)
          const shown          = [...allDayEvs, ...timedEvs].slice(0, 3)
          const extra          = dayEvs.length - shown.length

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              className={`bg-white p-2 min-h-[88px] cursor-pointer transition-colors hover:bg-gray-50/70 ${!isCurrentMonth ? 'opacity-25' : ''} ${isSelected ? 'ring-2 ring-inset ring-[#1a2e4a]/20' : ''}`}
            >
              <div className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1.5 leading-none ${
                isToday ? 'bg-[#1a2e4a] text-white' : 'text-gray-600'
              }`}>
                {parse(dateStr).getDate()}
              </div>
              {shown.map(ev => {
                const t = TIPOS[ev.tipo] || TIPOS.interno
                return (
                  <button key={ev.id}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    className={`w-full text-left text-[9px] font-semibold px-1.5 py-0.5 rounded-md mb-0.5 truncate flex items-center gap-1 hover:opacity-80 ${t.allDay}`}
                    style={{ borderLeft: `2px solid ${TIPO_COLOR[ev.tipo]}` }}
                  >
                    {!ev.allDay && <span className="opacity-60 flex-shrink-0">{ev.hora_inicio}</span>}
                    <span className="truncate">{ev.titulo}</span>
                  </button>
                )
              })}
              {extra > 0 && (
                <div className="text-[9px] text-gray-400 font-semibold px-1.5 mt-0.5">+{extra} más</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day Sidebar (month view click) ────────────────────────────────────────────
function DaySidebar({ date, eventos, onEventClick, onClose, onNewEvent }) {
  const evs  = eventos.filter(e => e.fecha === date)
  const d    = parse(date)
  const dow  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][getDow(date)]

  return (
    <div className="w-[340px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{dow}</p>
          <p className="text-base font-bold text-[#1a2e4a]">{d.getDate()} de {MESES[d.getMonth()]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onNewEvent(date, '09:00')}
            className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#1a2e4a] text-white px-3 py-1.5 rounded-lg hover:bg-[#2570ba] transition-colors">
            <Plus size={12} /> Nuevo
          </button>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {evs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-300 font-medium">Sin eventos este día</p>
            <button onClick={() => onNewEvent(date, '09:00')}
              className="mt-3 text-xs text-blue-500 hover:text-blue-700 font-semibold">
              + Agregar evento
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {evs.filter(e => e.allDay).map(ev => {
              const t = TIPOS[ev.tipo] || TIPOS.interno
              return (
                <button key={ev.id} onClick={() => onEventClick(ev)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 hover:opacity-90 transition-opacity ${t.allDay}`}
                  style={{ borderLeft: `3px solid ${TIPO_COLOR[ev.tipo]}` }}>
                  <Flag size={11} className="opacity-60 flex-shrink-0" />
                  <div>
                    <div className="text-[11px] font-bold truncate">{ev.titulo}</div>
                    {ev.cliente && <div className="text-[10px] opacity-60">{ev.cliente}</div>}
                  </div>
                </button>
              )
            })}
            {evs.filter(e => !e.allDay).sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio)).map(ev => {
              const t   = TIPOS[ev.tipo] || TIPOS.interno
              const abo = ABOGADAS.find(a => a.key === ev.responsable)
              return (
                <button key={ev.id} onClick={() => onEventClick(ev)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl hover:opacity-90 transition-opacity ${t.block}`}
                  style={{ borderLeft: `3px solid ${TIPO_COLOR[ev.tipo]}` }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-bold">{ev.hora_inicio}</span>
                    <span className="text-[10px] opacity-50">· {ev.duracion}min</span>
                    {abo && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto ${abo.bg} ${abo.text}`}>{abo.key}</span>}
                  </div>
                  <div className="text-[11px] font-semibold truncate">{ev.titulo}</div>
                  {ev.cliente && <div className="text-[10px] opacity-60 truncate mt-0.5">{ev.cliente}</div>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Event Panel ───────────────────────────────────────────────────────────────
function EventPanel({ ev, todos, onClose, onUpdate }) {
  const t   = TIPOS[ev.tipo] || TIPOS.interno
  const abo = ABOGADAS.find(a => a.key === ev.responsable)
  const [editNotas,  setEditNotas]  = useState(false)
  const [notas,      setNotas]      = useState(ev.notas)
  const [reschedule, setReschedule] = useState({ show: false, fecha: ev.fecha, hora: ev.hora_inicio || '' })

  useEffect(() => {
    setNotas(ev.notas)
    setReschedule({ show: false, fecha: ev.fecha, hora: ev.hora_inicio || '' })
  }, [ev.id])

  const signals   = getSignals(ev, todos)
  const relEvents = todos
    .filter(e => e.id !== ev.id && e.causa_rit && e.causa_rit === ev.causa_rit)
    .sort((a,b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 4)

  const saveNotas   = () => { onUpdate(ev.id, { notas }); setEditNotas(false) }
  const markDone    = () => onUpdate(ev.id, { completado: !ev.completado })
  const confirmResc = () => {
    onUpdate(ev.id, { fecha: reschedule.fecha, hora_inicio: reschedule.hora })
    setReschedule(r => ({ ...r, show: false }))
  }

  const InfoRow = ({ icon: Icon, label, value, href, mono }) => value ? (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <Icon size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-medium">
            {value} <ExternalLink size={10} />
          </a>
        ) : (
          <p className={`text-xs text-gray-700 font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="w-[400px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0"
        style={{ borderLeft: `4px solid ${TIPO_COLOR[ev.tipo]}` }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.pill}`}>{t.label}</span>
              {ev._source === 'tarea' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Link2 size={8} />
                  Módulo Tareas
                </span>
              )}
              {ev._source === 'audiencia' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  <Link2 size={8} />
                  Módulo Audiencias
                </span>
              )}
              {ev.completado && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  ✓ Completado
                </span>
              )}
            </div>
            <h2 className={`text-[15px] font-bold text-[#1a2e4a] leading-snug ${ev.completado ? 'line-through opacity-50' : ''}`}>
              {ev.titulo}
            </h2>
          </div>
          <button onClick={onClose}
            className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 mt-0.5">
            <X size={15} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ev.fecha && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
              <Clock size={9} className="opacity-60" />{fmtFecha(ev.fecha)}
            </span>
          )}
          {ev.hora_inicio && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
              {ev.hora_inicio} · {ev.duracion}min
            </span>
          )}
          {ev.allDay && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              <Flag size={9} /> Todo el día
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-1 px-4 py-3 border-b border-gray-50 bg-gray-50/30 flex-shrink-0">
        {[
          {
            icon: Check, label: ev.completado ? 'Reabrír' : 'Completar',
            act: markDone,
            cls: ev.completado
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
              : 'bg-white text-gray-400 border-gray-100 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200',
          },
          {
            icon: Calendar, label: 'Reagendar',
            act: () => setReschedule(r => ({ ...r, show: !r.show })),
            cls: reschedule.show
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : 'bg-white text-gray-400 border-gray-100 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200',
          },
          {
            icon: Plus, label: 'Tarea',
            act: () => {},
            cls: 'bg-white text-gray-400 border-gray-100 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200',
          },
          {
            icon: Eye, label: 'Ver causa',
            act: () => {},
            cls: ev.causa_rit
              ? 'bg-white text-gray-400 border-gray-100 hover:text-[#1a2e4a] hover:bg-[#1a2e4a]/5 hover:border-[#1a2e4a]/20'
              : 'bg-white text-gray-200 border-gray-50 opacity-40 cursor-not-allowed',
          },
        ].map(({ icon: Icon, label, act, cls }) => (
          <button key={label} onClick={act}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[9px] font-bold border transition-all ${cls}`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Reagendar inline */}
      {reschedule.show && (
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/20 flex-shrink-0">
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2">Reagendar</p>
          <div className="flex gap-2 items-center">
            <input type="date" value={reschedule.fecha}
              onChange={e => setReschedule(r => ({ ...r, fecha: e.target.value }))}
              className="flex-1 text-xs border border-blue-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-300 bg-white" />
            {!ev.allDay && (
              <input type="time" value={reschedule.hora}
                onChange={e => setReschedule(r => ({ ...r, hora: e.target.value }))}
                className="w-24 text-xs border border-blue-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-300 bg-white" />
            )}
            <button onClick={confirmResc}
              className="text-[11px] font-bold bg-[#1a2e4a] text-white px-3 py-1.5 rounded-lg hover:bg-[#2570ba] whitespace-nowrap transition-colors">
              OK
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* Smart signals */}
        {signals.length > 0 && (
          <div className="px-5 pt-4 space-y-1.5">
            {signals.map((s, i) => {
              const ss = SIGNAL_STYLES[s.kind] || SIGNAL_STYLES.info
              return (
                <div key={i} className={`flex items-center gap-2 text-[10px] font-semibold px-3 py-2 rounded-xl ${ss.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.kind === 'urgent' ? 'animate-pulse ' : ''}${ss.dot}`} />
                  {s.label}
                </div>
              )
            })}
          </div>
        )}

        {/* Info fields */}
        <div className="px-5 pt-4 pb-2">
          <InfoRow icon={User}   label="Cliente"     value={ev.cliente} />
          <InfoRow icon={Flag}   label="Causa (RIT)" value={ev.causa_rit} mono />
          <InfoRow icon={MapPin} label="Tribunal"    value={[ev.tribunal, ev.sala].filter(Boolean).join(' · ')} />
          <InfoRow icon={Clock}  label="Modalidad"   value={ev.modalidad ? ev.modalidad.charAt(0).toUpperCase() + ev.modalidad.slice(1) : null} />
          {ev.zoom_link && (
            <InfoRow icon={Video} label="Enlace Zoom" value="Unirse a la reunión" href={ev.zoom_link} />
          )}
          {abo && (
            <div className="flex items-start gap-3 py-2.5 border-b border-gray-50">
              <User size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Responsable</p>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${abo.bg} ${abo.text}`}>{abo.nombre}</span>
              </div>
            </div>
          )}
        </div>

        {/* Related events from same causa */}
        {relEvents.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-50">
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <span className="text-violet-400 font-mono">{ev.causa_rit}</span>
              <span>· Otros eventos</span>
            </p>
            <div className="space-y-1.5">
              {relEvents.map(re => {
                const rt = TIPOS[re.tipo] || TIPOS.interno
                const reAbo = ABOGADAS.find(a => a.key === re.responsable)
                return (
                  <div key={re.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:opacity-80 transition-opacity ${rt.block}`}
                    style={{ borderLeft: `2px solid ${TIPO_COLOR[re.tipo]}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold truncate">{re.titulo}</div>
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {fmtFecha(re.fecha)}{re.hora_inicio ? ` · ${re.hora_inicio}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${rt.pill}`}>{rt.label}</span>
                      {reAbo && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${reAbo.bg} ${reAbo.text}`}>{reAbo.key}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notas */}
        <div className="px-5 py-4 border-t border-gray-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Notas internas</p>
            {!editNotas && (
              <button onClick={() => setEditNotas(true)}
                className="text-[10px] text-blue-400 hover:text-blue-600 font-semibold flex items-center gap-1">
                <Edit2 size={9} /> Editar
              </button>
            )}
          </div>
          {editNotas ? (
            <div>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} autoFocus
                className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50 resize-none leading-relaxed" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setNotas(ev.notas); setEditNotas(false) }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={saveNotas}
                  className="text-xs font-semibold bg-[#1a2e4a] text-white px-3 py-1.5 rounded-lg hover:bg-[#2570ba]">Guardar</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 leading-relaxed">
              {notas || <span className="text-gray-300 italic">Sin notas</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── New Event Form ────────────────────────────────────────────────────────────
function NewEventForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    tipo: 'audiencia', titulo: '', cliente: '', causa_rit: '',
    fecha: initial?.fecha || TODAY,
    hora_inicio: initial?.hora || '09:00',
    duracion: 60, tribunal: '', sala: '',
    modalidad: 'presencial', zoom_link: '', responsable: 'MT', notas: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    if (!form.titulo.trim()) return
    setSaving(true)
    setTimeout(() => {
      onSave({ ...form, id: `ev${Date.now()}`, allDay: !form.hora_inicio })
      setSaving(false)
      onClose()
    }, 400)
  }

  const Label = ({ children }) => (
    <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">{children}</p>
  )

  return (
    <div className="w-[380px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-[#1a2e4a]/20" />
          <h2 className="text-sm font-bold text-[#1a2e4a]">Nuevo evento</h2>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-0.5 rounded-lg hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Tipo */}
        <div>
          <Label>Tipo de evento</Label>
          <div className="flex flex-wrap gap-1.5">
            {TIPO_KEYS.map(k => {
              const t = TIPOS[k]
              return (
                <button key={k} onClick={() => f('tipo', k)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all border ${
                    form.tipo === k ? `${t.allDay} border-current` : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Título */}
        <div>
          <Label>Título *</Label>
          <input type="text" value={form.titulo} onChange={e => f('titulo', e.target.value)} autoFocus
            placeholder="Descripción del evento..."
            className="w-full text-sm text-gray-800 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/50 font-medium" />
        </div>

        {/* Fecha / Hora / Duración */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)}
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
          </div>
          <div>
            <Label>Hora inicio</Label>
            <input type="time" value={form.hora_inicio} onChange={e => f('hora_inicio', e.target.value)}
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
          </div>
          <div>
            <Label>Duración (min)</Label>
            <input type="number" value={form.duracion} onChange={e => f('duracion', +e.target.value)}
              min={15} step={15}
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
          </div>
          <div>
            <Label>Modalidad</Label>
            <select value={form.modalidad} onChange={e => f('modalidad', e.target.value)}
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none bg-gray-50/50">
              <option value="presencial">Presencial</option>
              <option value="zoom">Zoom</option>
              <option value="remoto">Remoto</option>
            </select>
          </div>
        </div>

        {/* Cliente / Causa */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cliente</Label>
            <input type="text" value={form.cliente} onChange={e => f('cliente', e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
          </div>
          <div>
            <Label>RIT / Causa</Label>
            <input type="text" value={form.causa_rit} onChange={e => f('causa_rit', e.target.value)}
              placeholder="RIT-XXX-XXXX"
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50 font-mono" />
          </div>
        </div>

        {/* Tribunal */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tribunal</Label>
            <input type="text" value={form.tribunal} onChange={e => f('tribunal', e.target.value)}
              placeholder="Tribunal"
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
          </div>
          <div>
            <Label>Sala</Label>
            <input type="text" value={form.sala} onChange={e => f('sala', e.target.value)}
              placeholder="Sala 1..."
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
          </div>
        </div>

        {form.modalidad === 'zoom' && (
          <div>
            <Label>Link Zoom</Label>
            <input type="url" value={form.zoom_link} onChange={e => f('zoom_link', e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50 font-mono" />
          </div>
        )}

        {/* Responsable */}
        <div>
          <Label>Responsable</Label>
          <div className="flex gap-2">
            {ABOGADAS.map(a => (
              <button key={a.key} onClick={() => f('responsable', a.key)}
                className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${
                  form.responsable === a.key ? `${a.bg} ${a.text} border-transparent` : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'
                }`}>
                {a.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Notas</Label>
          <textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={3}
            placeholder="Instrucciones o contexto..."
            className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50 resize-none" />
        </div>
      </div>

      <div className="border-t border-gray-100 px-5 py-3.5 flex gap-2 flex-shrink-0 bg-gray-50/30">
        <button onClick={onClose} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-2.5 rounded-xl hover:bg-gray-100 transition-colors font-medium">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={!form.titulo.trim() || saving}
          className="flex-1 text-xs bg-[#1a2e4a] text-white py-2.5 rounded-xl hover:bg-[#2570ba] transition-colors font-semibold disabled:opacity-40 shadow-sm">
          {saving ? 'Guardando...' : 'Crear evento'}
        </button>
      </div>
    </div>
  )
}

// ── Sync Toast ────────────────────────────────────────────────────────────────
function SyncToast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none
      animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="bg-[#1a2e4a] text-white text-xs font-medium px-4 py-2.5 rounded-full
        shadow-xl shadow-black/20 flex items-center gap-2.5 whitespace-nowrap">
        <RefreshCw size={11} className="text-emerald-400 animate-spin" style={{ animationDuration: '1.5s' }} />
        <span>{msg}</span>
      </div>
    </div>
  )
}

// ── Main Calendario ───────────────────────────────────────────────────────────
export default function Calendario() {
  // ── Estado local (eventos "nativos" del calendario) ──
  const [eventos,      setEventos]      = useState(EVENTOS_INIT)
  const [view,         setView]         = useState('week')
  const [anchor,       setAnchor]       = useState(TODAY)
  const [selEvent,     setSelEvent]     = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [formInitial,  setFormInitial]  = useState(null)
  const [selDay,       setSelDay]       = useState(null)
  const [filterTipo,   setFilterTipo]   = useState('Todos')
  const [filterResp,   setFilterResp]   = useState('Todas')
  const [syncToast,    setSyncToast]    = useState(null)
  const toastTimer = useRef(null)

  // ── Datos de Supabase ──
  const [tareas,     setTareas]     = useState([])
  const [audiencias, setAudiencias] = useState([])
  const [plazos,     setPlazos]     = useState([])

  useEffect(() => {
    supabase.from('tareas')
      .select('id, titulo, fecha_vencimiento, estado, prioridad, notas, categoria, causa_rit, cliente_nombre')
      .then(({ data }) => setTareas(data || []))
    supabase.from('audiencias')
      .select('id, tipo, fecha, hora, tribunal, sala, estado, modalidad, zoom_link, notas, cliente_nombre, causa_rit')
      .then(({ data }) => setAudiencias(data || []))
    supabase.from('plazos')
      .select('id, titulo, fecha_vencimiento, estado, tipo, notas, causa_rit, causas(cliente_nombre)')
      .then(({ data }) => setPlazos((data || []).map(r => ({ ...r, cliente_nombre: r.causas?.cliente_nombre || '' }))))
  }, [])

  // ── Campos DB válidos por tabla ──
  const TAREA_DB  = new Set(['estado','notas','titulo','prioridad','fecha_vencimiento','cliente_nombre','causa_rit','cliente_id','causa_id'])
  const AUD_DB    = new Set(['estado','notas','tipo','fecha','hora','tribunal','sala','resultado','cliente_nombre','causa_rit','cliente_id','causa_id'])
  const PLAZO_DB  = new Set(['estado','notas','tipo','causa_rit','causa_id','cliente_id','titulo','fecha_vencimiento'])

  const updateTarea = useCallback(async (id, changes) => {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t))
    const payload = Object.fromEntries(Object.entries(changes).filter(([k]) => TAREA_DB.has(k)))
    if (Object.keys(payload).length) await supabase.from('tareas').update(payload).eq('id', id)
  }, [])

  const updateAudiencia = useCallback(async (id, changes) => {
    setAudiencias(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a))
    const payload = Object.fromEntries(Object.entries(changes).filter(([k]) => AUD_DB.has(k)))
    if (Object.keys(payload).length) await supabase.from('audiencias').update(payload).eq('id', id)
  }, [])

  const updatePlazo = useCallback(async (id, changes) => {
    setPlazos(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))
    const payload = Object.fromEntries(Object.entries(changes).filter(([k]) => PLAZO_DB.has(k)))
    if (Object.keys(payload).length) await supabase.from('plazos').update(payload).eq('id', id)
  }, [])

  // ── Toast helper ──
  const showSyncToast = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setSyncToast(msg)
    toastTimer.current = setTimeout(() => setSyncToast(null), 2800)
  }, [])

  // ── Derivar eventos sincrónicos desde Tareas ──
  const eventosFromTareas = useMemo(() => tareas
    .filter(t => t.fecha_vencimiento && t.estado !== 'Cancelada')
    .map(t => ({
      id:          `sync_ta_${t.id}`,
      tipo:        'tarea',
      titulo:      t.titulo,
      fecha:       t.fecha_vencimiento,
      hora_inicio: '',
      duracion:    0,
      allDay:      true,
      cliente:     t.cliente_nombre || '',
      causa_rit:   t.causa_rit || '',
      responsable: t.responsable || 'MT',
      completado:  t.estado === 'Completada',
      notas:       t.notas || '',
      _source:     'tarea',
      _sourceId:   t.id,
      _prioridad:  t.prioridad,
      _categoria:  t.categoria,
      _estado:     t.estado,
    })), [tareas])

  // ── Derivar eventos sincrónicos desde Audiencias ──
  const eventosFromAudiencias = useMemo(() => audiencias
    .filter(a => a.fecha && a.estado !== 'Suspendida')
    .map(a => ({
      id:          `sync_au_${a.id}`,
      tipo:        'audiencia',
      titulo:      a.tipo || 'Audiencia',
      fecha:       a.fecha,
      hora_inicio: a.hora || '',
      duracion:    90,
      allDay:      false,
      cliente:     a.cliente_nombre || '',
      causa_rit:   a.causa_rit || '',
      tribunal:    a.tribunal || '',
      sala:        a.sala || '',
      modalidad:   a.modalidad === 'Zoom' ? 'zoom' : 'presencial',
      zoom_link:   a.zoom_link || '',
      responsable: 'MT',
      completado:  a.estado === 'Realizada',
      notas:       a.notas || '',
      _source:     'audiencia',
      _sourceId:   a.id,
      _estado:     a.estado,
    })), [audiencias])

  // ── Derivar eventos sincrónicos desde Plazos ──
  const eventosFromPlazos = useMemo(() => plazos
    .filter(p => p.fecha_vencimiento && p.estado !== 'Cancelado')
    .map(p => ({
      id:          `sync_pl_${p.id}`,
      tipo:        'plazo',
      titulo:      p.titulo || 'Plazo',
      fecha:       p.fecha_vencimiento,
      hora_inicio: '',
      duracion:    0,
      allDay:      true,
      cliente:     p.cliente_nombre || '',
      causa_rit:   p.causa_rit || '',
      responsable: p.responsable || 'MT',
      completado:  p.estado === 'Completado',
      notas:       p.notas || '',
      _source:     'plazo',
      _sourceId:   p.id,
      _tipo:       p.tipo,
      _estado:     p.estado,
    })), [plazos])

  // ── Merge: eventos nativos + sincrónicos ──
  const todosEventos = useMemo(() =>
    [...eventos, ...eventosFromTareas, ...eventosFromAudiencias, ...eventosFromPlazos],
    [eventos, eventosFromTareas, eventosFromAudiencias, eventosFromPlazos])

  const days      = useMemo(() => getWeekDays(anchor), [anchor])

  // Navigate
  const goNext = () => setAnchor(a => view === 'week' ? addDays(a, 7) : (() => {
    const d = parse(a); d.setMonth(d.getMonth()+1); return fmt(d)
  })())
  const goPrev = () => setAnchor(a => view === 'week' ? addDays(a, -7) : (() => {
    const d = parse(a); d.setMonth(d.getMonth()-1); return fmt(d)
  })())
  const goToday = () => { setAnchor(TODAY); setSelDay(null); setSelEvent(null) }

  // Filters
  const filtered = useMemo(() => {
    let r = todosEventos
    if (filterTipo !== 'Todos')  r = r.filter(e => e.tipo === filterTipo)
    if (filterResp !== 'Todas')  r = r.filter(e => e.responsable === filterResp)
    return r
  }, [todosEventos, filterTipo, filterResp])

  const handleEventClick = ev => {
    setSelDay(null)
    setShowForm(false)
    setSelEvent(ev)
  }

  const handleSlotClick = (date, hora) => {
    setSelEvent(null)
    setSelDay(null)
    setFormInitial({ fecha: date, hora })
    setShowForm(true)
  }

  const handleDayClick = date => {
    setSelEvent(null)
    setShowForm(false)
    setSelDay(date)
  }

  // ── Drag & Drop con sincronización bidireccional ──
  const handleDrop = (id, newDate, newHora) => {
    if (id.startsWith('sync_ta_')) {
      // Tarea sincronizada → actualizar módulo Tareas
      const sourceId = id.replace('sync_ta_', '')
      updateTarea(sourceId, { fecha_vencimiento: newDate })
      showSyncToast('Fecha actualizada en módulo Tareas')
    } else if (id.startsWith('sync_au_')) {
      // Audiencia sincronizada → actualizar módulo Audiencias
      const sourceId = id.replace('sync_au_', '')
      updateAudiencia(sourceId, { fecha: newDate, hora: newHora })
      showSyncToast('Audiencia reagendada en módulo Audiencias')
    } else if (id.startsWith('sync_pl_')) {
      // Plazo sincronizado → actualizar módulo Plazos
      const sourceId = id.replace('sync_pl_', '')
      updatePlazo(sourceId, { fecha_vencimiento: newDate })
      showSyncToast('Plazo actualizado en módulo Plazos')
    } else {
      // Evento nativo del calendario
      setEventos(prev => prev.map(e => e.id === id ? { ...e, fecha: newDate, hora_inicio: newHora } : e))
    }
  }

  // ── Update con sincronización bidireccional ──
  const handleUpdate = (id, changes) => {
    if (id.startsWith('sync_ta_')) {
      const sourceId = id.replace('sync_ta_', '')
      // Mapear completado → estado en Tareas
      const tareaChanges = {}
      if ('completado' in changes) {
        tareaChanges.estado = changes.completado ? 'Completada' : 'Pendiente'
      }
      if (changes.fecha) tareaChanges.fecha_vencimiento = changes.fecha
      if (Object.keys(tareaChanges).length) {
        updateTarea(sourceId, tareaChanges)
        showSyncToast('Tarea actualizada en módulo Tareas')
      }
    } else if (id.startsWith('sync_au_')) {
      const sourceId = id.replace('sync_au_', '')
      // Mapear completado → estado en Audiencias
      const audChanges = {}
      if ('completado' in changes) {
        audChanges.estado = changes.completado ? 'Realizada' : 'Programada'
      }
      if (changes.fecha)       audChanges.fecha = changes.fecha
      if (changes.hora_inicio) audChanges.hora  = changes.hora_inicio
      if (Object.keys(audChanges).length) {
        updateAudiencia(sourceId, audChanges)
        showSyncToast('Audiencia actualizada en módulo Audiencias')
      }
    } else if (id.startsWith('sync_pl_')) {
      const sourceId = id.replace('sync_pl_', '')
      // Mapear completado → estado en Plazos
      const plazoCambios = {}
      if ('completado' in changes) {
        plazoCambios.estado = changes.completado ? 'Completado' : 'Activo'
      }
      if (changes.fecha) plazoCambios.fecha_vencimiento = changes.fecha
      if (Object.keys(plazoCambios).length) {
        updatePlazo(sourceId, plazoCambios)
        showSyncToast('Plazo actualizado en módulo Plazos')
      }
    } else {
      // Evento nativo
      setEventos(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e))
      if (selEvent?.id === id) setSelEvent(prev => ({ ...prev, ...changes }))
    }
    // Actualizar selEvent si estaba abierto
    if (selEvent?.id === id) setSelEvent(prev => ({ ...prev, ...changes }))
  }

  const handleSave = newEv => {
    setEventos(prev => [newEv, ...prev])
  }

  const closePanel = () => {
    setSelEvent(null)
    setShowForm(false)
    setSelDay(null)
  }

  const navLabel = view === 'week' ? fmtWeekLabel(days) : fmtMonthLabel(anchor)

  return (
    <div className="flex flex-col h-full bg-[#fafafa] overflow-hidden">

      {/* Alert bar */}
      <AlertBar eventos={todosEventos} />

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        {/* Nav */}
        <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ChevronRight size={16} />
        </button>
        <button onClick={goToday}
          className="text-[11px] font-semibold text-[#1a2e4a] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
          Hoy
        </button>

        <h2 className="text-sm font-bold text-[#1a2e4a] min-w-[220px]">{navLabel}</h2>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-2">
          {[['week','Semana'],['month','Mes']].map(([v, lbl]) => (
            <button key={v} onClick={() => { setView(v); setSelDay(null) }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-md transition-all ${
                view === v ? 'bg-white text-[#1a2e4a] shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Legend dots */}
        <div className="hidden lg:flex items-center gap-3 ml-2">
          {TIPO_KEYS.map(k => {
            const t = TIPOS[k]
            return (
              <button key={k}
                onClick={() => setFilterTipo(filterTipo === k ? 'Todos' : k)}
                className={`flex items-center gap-1.5 text-[10px] font-semibold transition-opacity ${filterTipo !== 'Todos' && filterTipo !== k ? 'opacity-30' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                <span className="text-gray-500">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Responsable */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
            {ABOGADAS.map(a => (
              <button key={a.key}
                onClick={() => setFilterResp(filterResp === a.key ? 'Todas' : a.key)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                  filterResp === a.key ? `${a.bg} ${a.text}` : 'text-gray-300 hover:text-gray-500'
                }`}>
                {a.key}
              </button>
            ))}
          </div>


          {/* New event */}
          <button
            onClick={() => { setSelEvent(null); setSelDay(null); setFormInitial(null); setShowForm(true) }}
            className="inline-flex items-center gap-1.5 bg-[#1a2e4a] text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-[#2570ba] transition-colors shadow-sm">
            <Plus size={14} /> Nuevo evento
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-200`}>
          {view === 'week' ? (
            <WeekView
              eventos={filtered}
              days={days}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
              onDrop={handleDrop}
            />
          ) : (
            <MonthView
              eventos={filtered}
              anchor={anchor}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
              selectedDay={selDay}
            />
          )}
        </div>

        {/* Side panels */}
        {selEvent && (
          <EventPanel
            ev={selEvent}
            todos={todosEventos}
            onClose={closePanel}
            onUpdate={handleUpdate}
          />
        )}
        {showForm && !selEvent && (
          <NewEventForm
            initial={formInitial}
            onClose={closePanel}
            onSave={handleSave}
          />
        )}
        {selDay && !selEvent && !showForm && (
          <DaySidebar
            date={selDay}
            eventos={filtered}
            onEventClick={handleEventClick}
            onClose={closePanel}
            onNewEvent={(d, h) => { setSelDay(null); setFormInitial({ fecha: d, hora: h }); setShowForm(true) }}
          />
        )}
      </div>

      {/* Sync toast */}
      <SyncToast msg={syncToast} />
    </div>
  )
}
