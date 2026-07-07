import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  Gavel, ArrowRight, Command, Search, Calendar,
  Circle, CheckCircle2, AlignLeft, Star, Send,
  Sun, BookOpen, Database, CheckSquare, X, Shield,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

// ── constants ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)
const STORAGE_KEY = 'bl_workspace_v2'

const ACTION_VERBS = new Set([
  'llamar','enviar','revisar','preparar','solicitar',
  'mandar','subir','hacer','contactar','confirmar',
])

// ── helpers ────────────────────────────────────────────────────────────────────
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
function daysSince(isoDate) {
  if (!isoDate) return 0
  const d = new Date(isoDate + 'T00:00:00')
  const t = new Date(TODAY + 'T00:00:00')
  return Math.floor((t - d) / 86400000)
}
const DOW = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
function dowShort(iso) { return DOW[new Date(iso + 'T00:00:00').getDay()] }
function dayNum(iso)   { return new Date(iso + 'T00:00:00').getDate() }

function isActionLine(text) {
  const word = text.trim().toLowerCase().split(/\s+/)[0]
  return ACTION_VERBS.has(word)
}
function detectClient(text, clientes) {
  if (!text || !clientes.length) return null
  const lower = text.toLowerCase()
  return clientes.find(c => c.nombre && c.nombre.length > 2 && lower.includes(c.nombre.toLowerCase())) || null
}
function detectCausa(text, causas) {
  if (!text || !causas.length) return null
  const lower = text.toLowerCase()
  const ritPattern = /\b([A-Z]-\d+-\d{4})\b/gi
  let m
  while ((m = ritPattern.exec(text)) !== null) {
    const hit = causas.find(c => c.rit && c.rit.toUpperCase() === m[1].toUpperCase())
    if (hit) return hit
  }
  const rucPattern = /\b(\d{15,20})\b/g
  while ((m = rucPattern.exec(text)) !== null) {
    const hit = causas.find(c => c.ruc && c.ruc === m[1])
    if (hit) return hit
  }
  return causas.find(c => {
    if (!c.cliente_nombre || c.cliente_nombre.length < 3) return false
    const cn = c.cliente_nombre.toLowerCase()
    if (lower.includes(cn)) return true
    // Also match if text contains 2 consecutive words of the client name
    // e.g. "Cristian Soto" matches "CRISTIAN SOTO CONTRERAS"
    const words = cn.split(/\s+/).filter(w => w.length > 1)
    for (let i = 0; i < words.length - 1; i++) {
      if (lower.includes(words[i] + ' ' + words[i + 1])) return true
    }
    return false
  }) || null
}

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

// ── localStorage ───────────────────────────────────────────────────────────────
const WS_DEFAULT = {
  hoItems:    [],
  dumpLines:  [{ id: 'init', text: '', type: 'nota', done: false, tag: null }],
  semana:     {},
  agendaMonth: TODAY.slice(0, 7),
}

function loadWS() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      // Always start on current month
      return { ...WS_DEFAULT, ...p, agendaMonth: TODAY.slice(0, 7) }
    }
    // Migrar desde v1
    const old = localStorage.getItem('bl_workspace_v1')
    if (old) {
      const p = JSON.parse(old)
      const dumpLines = (p.dump || '').split('\n').filter(Boolean)
        .map(text => ({ id: uid(), text, type: isActionLine(text) ? 'checkbox' : 'nota', done: false, tag: null }))
      if (!dumpLines.length) dumpLines.push({ id: uid(), text: '', type: 'nota', done: false, tag: null })
      return { ...WS_DEFAULT, hoItems: p.hoItems || [], dumpLines, semana: p.semana || {} }
    }
    return { ...WS_DEFAULT }
  } catch { return { ...WS_DEFAULT } }
}

// ── CheckItem ─────────────────────────────────────────────────────────────────
function CheckItem({ item, onToggle, onDelete, onMove }) {
  return (
    <div className="flex items-start gap-3 group py-1.5">
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

// ── InlineAdd (agenda items) ──────────────────────────────────────────────────
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

// ── ConversionMenu ────────────────────────────────────────────────────────────
function ConversionMenu({ detectedCausa, onConvert, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000)
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', fn) }
  }, [onClose])

  return (
    <div className="flex items-center gap-1 p-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex-wrap">
      {detectedCausa && (
        <span className="text-[10px] text-gray-400 px-1.5 flex-shrink-0">
          <span className="text-[#2570BA] font-semibold">{detectedCausa.cliente_nombre}</span>
          {detectedCausa.rit && <span className="font-mono ml-1">· {detectedCausa.rit}</span>} ·
        </span>
      )}
      <button onClick={() => onConvert('tarea')}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
        <CheckSquare size={10} /> Tarea
      </button>
      <button onClick={() => onConvert('seguimiento')}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
        <BookOpen size={10} /> Seguimiento
      </button>
      <button onClick={() => onConvert('siau')}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors">
        <Database size={10} /> SIAU
      </button>
      <button onClick={() => onConvert('nota')}
        className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
        Solo nota
      </button>
      <button onClick={onClose} className="ml-0.5 text-gray-200 hover:text-gray-400 transition-colors">
        <X size={10} />
      </button>
    </div>
  )
}

// ── CauseConfirmPanel ──────────────────────────────────────────────────────────
function CauseConfirmPanel({ state, causas, onConfirm, onSwitchSearch, onClose }) {
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  const { detectedCausa, searching } = state

  useEffect(() => {
    if (searching) setTimeout(() => searchRef.current?.focus(), 30)
  }, [searching])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const lq = query.toLowerCase()
    return causas.filter(c =>
      (c.rit && c.rit.toLowerCase().includes(lq)) ||
      (c.ruc && c.ruc.toLowerCase().includes(lq)) ||
      (c.cliente_nombre && c.cliente_nombre.toLowerCase().includes(lq)) ||
      (c.materia && c.materia.toLowerCase().includes(lq))
    ).slice(0, 5)
  }, [query, causas])

  if (!searching && detectedCausa) {
    return (
      <div className="mt-2 p-2.5 bg-[#EEF5FF] rounded-xl border border-[#C5DBFB]">
        <div className="text-[10px] text-[#2570BA]/70 font-semibold uppercase tracking-wider mb-1">Detectado automáticamente</div>
        <div className="text-[12px] text-[#1a2e4a] font-semibold leading-snug">
          {detectedCausa.cliente_nombre}
          {detectedCausa.rit
            ? <span className="ml-1.5 font-mono font-normal text-[11px] text-[#2570BA]">{detectedCausa.rit}</span>
            : detectedCausa.ruc
              ? <span className="ml-1.5 font-mono font-normal text-[11px] text-[#2570BA]">RUC {detectedCausa.ruc.slice(0, 8)}…</span>
              : null}
          {detectedCausa.materia && (
            <span className="ml-1.5 text-[11px] font-normal text-gray-400">· {detectedCausa.materia}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => onConfirm(detectedCausa)}
            className="px-2.5 py-1 bg-[#2570BA] text-white rounded-lg text-[11px] font-semibold hover:bg-[#1e5fa0] transition-colors">
            Confirmar y guardar
          </button>
          <button onClick={onSwitchSearch}
            className="px-2.5 py-1 bg-white text-[#2570BA] border border-[#C5DBFB] rounded-lg text-[11px] hover:bg-blue-50 transition-colors">
            Cambiar
          </button>
          <button onClick={() => onConfirm(null)}
            className="ml-auto text-[11px] text-gray-300 hover:text-gray-500 transition-colors">
            Sin causa
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Search size={11} className="text-gray-400 flex-shrink-0" />
        <input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar causa por nombre, RIT o RUC..."
          className="flex-1 text-[12px] bg-transparent border-none outline-none text-gray-700 placeholder-gray-300"
        />
        <button onClick={onClose} className="text-gray-200 hover:text-gray-400 transition-colors flex-shrink-0">
          <X size={10} />
        </button>
      </div>
      {results.length > 0 && (
        <div className="space-y-0.5 mb-1">
          {results.map(c => (
            <button key={c.id} onClick={() => onConfirm(c)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-colors text-left">
              <span className="text-[12px] font-medium text-gray-700 flex-1 truncate">{c.cliente_nombre}</span>
              {c.rit
                ? <span className="text-[10px] font-mono text-[#2570BA] flex-shrink-0">{c.rit}</span>
                : c.ruc
                  ? <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">RUC</span>
                  : null}
            </button>
          ))}
        </div>
      )}
      {query.trim() && results.length === 0 && (
        <p className="text-[11px] text-gray-300 italic px-2 mb-1">Sin resultados</p>
      )}
      <button onClick={() => onConfirm(null)}
        className="text-[11px] text-gray-300 hover:text-gray-500 transition-colors px-2">
        Guardar sin causa
      </button>
    </div>
  )
}

// ── BrainDump (line-based) ─────────────────────────────────────────────────────
function BrainDump({ lines, onChange, clientes, causas, onSaveConversion }) {
  const inputRefs = useRef({})
  const [convMenu, setConvMenu] = useState(null)       // { lineId, text, detectedCausa }
  const [causeConfirm, setCauseConfirm] = useState(null) // { convType, lineId, text, detectedCausa, searching }
  const [savedMsg, setSavedMsg] = useState(null)

  function handleKeyDown(e, lineId) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const line = lines.find(l => l.id === lineId)
      if (!line) return
      const newLine = { id: uid(), text: '', type: 'nota', done: false, tag: null }
      const idx = lines.findIndex(l => l.id === lineId)
      onChange([...lines.slice(0, idx + 1), newLine, ...lines.slice(idx + 1)])
      if (line.text.trim().length > 2) {
        const detectedCausa = detectCausa(line.text, causas)
        setConvMenu({ lineId, text: line.text, detectedCausa })
      }
      setTimeout(() => inputRefs.current[newLine.id]?.focus(), 20)
    }
    if (e.key === 'Backspace') {
      const line = lines.find(l => l.id === lineId)
      if (line && line.text === '' && lines.length > 1) {
        e.preventDefault()
        const idx = lines.findIndex(l => l.id === lineId)
        onChange(lines.filter(l => l.id !== lineId))
        const prevLine = lines[Math.max(0, idx - 1)]
        setTimeout(() => inputRefs.current[prevLine?.id]?.focus(), 20)
      }
    }
  }

  function updateLine(lineId, text) {
    const type = isActionLine(text) ? 'checkbox' : 'nota'
    onChange(lines.map(l => l.id === lineId ? { ...l, text, type } : l))
  }

  function handleConvert(convType) {
    if (!convMenu) return
    const { lineId, text, detectedCausa } = convMenu
    setConvMenu(null)
    if (convType === 'nota') {
      onSaveConversion(lineId, text, convType, null)
      return
    }
    setCauseConfirm({ convType, lineId, text, detectedCausa, searching: !detectedCausa })
  }

  function confirmCause(causa) {
    const { convType, lineId, text } = causeConfirm
    setCauseConfirm(null)
    onSaveConversion(lineId, text, convType, causa)
    if (causa) {
      const label = causa.cliente_nombre + (causa.rit ? ' · ' + causa.rit : causa.ruc ? ' · RUC' : '')
      setSavedMsg('✓ Guardado en ' + label)
      setTimeout(() => setSavedMsg(null), 3000)
    }
  }

  const TAG_STYLES = {
    tarea:       'bg-rose-50 text-rose-600',
    seguimiento: 'bg-blue-50 text-blue-600',
    siau:        'bg-violet-50 text-violet-600',
  }

  return (
    <div>
      {lines.map((line, idx) => (
        <div key={line.id} className="flex items-start gap-1.5 py-[2px] group">
          {line.type === 'checkbox' ? (
            <button onClick={() => onChange(lines.map(l => l.id === line.id ? { ...l, done: !l.done } : l))}
              className="mt-[3px] flex-shrink-0 text-gray-300 hover:text-[#1a2e4a] transition-colors">
              {line.done
                ? <CheckCircle2 size={13} className="text-[#1a2e4a]" />
                : <Circle size={13} />}
            </button>
          ) : (
            <div className="w-[13px] mt-[3px] flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0 flex items-baseline gap-1 flex-wrap">
            {line.done ? (
              <span className="text-[13px] line-through text-gray-300 leading-relaxed">{line.text}</span>
            ) : (
              <input
                ref={el => { inputRefs.current[line.id] = el }}
                value={line.text}
                onChange={e => updateLine(line.id, e.target.value)}
                onKeyDown={e => handleKeyDown(e, line.id)}
                placeholder={idx === lines.length - 1 ? 'Escribe lo que sea...' : ''}
                className="bg-transparent border-none outline-none text-[13px] text-gray-700 placeholder-gray-200 leading-relaxed w-full"
              />
            )}
            {line.tag && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${TAG_STYLES[line.tag] || 'bg-gray-100 text-gray-500'}`}>
                → {line.tag}
              </span>
            )}
          </div>
          <button onClick={() => onChange(lines.filter(l => l.id !== line.id))}
            className="opacity-0 group-hover:opacity-100 mt-[3px] text-gray-200 hover:text-red-400 transition-all flex-shrink-0">
            <X size={10} />
          </button>
        </div>
      ))}

      {convMenu && (
        <div className="mt-1.5 mb-1">
          <ConversionMenu
            detectedCausa={convMenu.detectedCausa}
            onConvert={handleConvert}
            onClose={() => setConvMenu(null)}
          />
        </div>
      )}

      {causeConfirm && (
        <CauseConfirmPanel
          state={causeConfirm}
          causas={causas}
          onConfirm={confirmCause}
          onSwitchSearch={() => setCauseConfirm(p => ({ ...p, searching: true }))}
          onClose={() => setCauseConfirm(null)}
        />
      )}

      {savedMsg && (
        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-100 rounded-lg text-[11px] text-green-700 font-medium">
          {savedMsg}
        </div>
      )}
    </div>
  )
}

// ── WeekRow ───────────────────────────────────────────────────────────────────
function WeekRow({ week, semana, audiencias, tareas, isCurrent, isPast,
  onToggle, onDelete, onAdd, onMove, hoItems, onToggleHo, onDeleteHo, onAddHo }) {

  const [expanded, setExpanded] = useState(isCurrent)
  const [picker, setPicker]     = useState(false)
  const [selDay, setSelDay]     = useState(null)
  const [addTxt, setAddTxt]     = useState('')
  const addRef = useRef(null)

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
      <button onClick={() => { if (!isCurrent) setExpanded(v => !v) }}
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left group ${isCurrent ? 'cursor-default' : 'hover:bg-gray-50'}`}>
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
        {!isCurrent && (expanded
          ? <ChevronDown  size={11} className={`flex-shrink-0 ${isPast ? 'text-gray-200' : 'text-gray-400'}`} />
          : <ChevronRight size={11} className={`flex-shrink-0 ${isPast ? 'text-gray-200' : 'text-gray-400'}`} />)}
      </button>

      {(isCurrent || expanded) && (
        <div className="ml-3 pl-3 border-l border-gray-100 pb-1 mt-0.5 mb-1">
          {!isCurrent && activeDays.length === 0 && (
            <p className="py-1.5 text-[11px] text-gray-300 italic">Sin actividad registrada</p>
          )}

          {(isCurrent ? displayDays : activeDays).flatMap((date, idx, arr) => {
            const auds    = audiencias.filter(a => a.fecha === date)
            const tars    = tareas.filter(t => t.fecha_vencimiento === date && t.estado !== 'Completada')
            const custom  = semana[date] || []
            const isToday = date === TODAY
            const sep     = idx < arr.length - 1
              ? [<hr key={`sep-${date}`} className="border-gray-100 my-2" />]
              : []

            if (isToday) {
              return [
                <div key={date} className="mb-3 mt-1">
                  <div className="relative pl-3 py-3 pr-3 rounded-xl bg-gray-50/80"
                    style={{ borderLeft: '2.5px solid #2570BA' }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sun size={12} className="text-[#2570BA]/60 flex-shrink-0" />
                      <span className="text-[13px] font-bold text-[#1a2e4a] tracking-wide">
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

                    {auds.map(a => (
                      <div key={a.id} className="flex items-center gap-3 py-1.5">
                        <Gavel size={11} className="text-[#1a2e4a]/40 flex-shrink-0" />
                        <span className="text-[12.5px] text-gray-800 font-semibold flex-1 truncate">{a.causa_rit}</span>
                        {a.hora && <span className="text-[11px] text-[#1a2e4a]/50 tabular-nums font-medium flex-shrink-0">{a.hora}</span>}
                      </div>
                    ))}
                    {tars.map(t => (
                      <div key={t.id} className="flex items-center gap-3 py-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 flex-shrink-0" />
                        <span className="text-[12.5px] text-gray-600 flex-1 truncate">{t.titulo}</span>
                      </div>
                    ))}
                    {(auds.length > 0 || tars.length > 0) && (
                      <div className="border-t border-[#1a2e4a]/08 my-1.5" />
                    )}
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
                </div>,
                ...sep,
              ]
            }

            return [
              <div key={date} className="mb-3 mt-1">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className={`text-[13px] font-semibold ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>
                    {dowShort(date)} {dayNum(date)}
                  </span>
                  <div className={`flex-1 h-px ${isPast ? 'bg-gray-50' : 'bg-gray-100'}`} />
                </div>
                {auds.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-1.5 pl-0.5">
                    <Gavel size={11} className="text-[#1a2e4a]/35 flex-shrink-0" />
                    <span className={`text-[12.5px] font-medium flex-1 truncate ${isPast ? 'text-gray-400' : 'text-gray-700'}`}>{a.causa_rit}</span>
                    {a.hora && <span className={`text-[11px] tabular-nums flex-shrink-0 ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>{a.hora}</span>}
                  </div>
                ))}
                {tars.map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-1.5 pl-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${isPast ? 'border-gray-200' : 'border-amber-300'}`} />
                    <span className={`text-[12.5px] flex-1 truncate ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>{t.titulo}</span>
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
                {isCurrent && (
                  <InlineAdd onAdd={text => onAdd(date, text)} placeholder="Agregar..." />
                )}
              </div>,
              ...sep,
            ]
          })}

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
              className="flex items-center gap-1.5 mt-0.5 py-1 px-2 text-[12px] text-gray-300 hover:text-[#1a2e4a] transition-colors group">
              <Plus size={12} /> agregar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── RightSection ──────────────────────────────────────────────────────────────
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

// ── CausasActivasItem (con inline nota) ───────────────────────────────────────
function CausasActivasItem({ causa, onAddNota }) {
  const [showInput, setShowInput] = useState(false)
  const [notaText, setNotaText]   = useState('')
  const [saving, setSaving]       = useState(false)
  const inputRef = useRef(null)

  function open() { setShowInput(true); setTimeout(() => inputRef.current?.focus(), 20) }
  async function submit() {
    const t = notaText.trim()
    if (!t) { setShowInput(false); return }
    setSaving(true)
    await onAddNota(causa, t)
    setNotaText(''); setShowInput(false); setSaving(false)
  }

  return (
    <div className="py-[3px]">
      <div className="flex items-center gap-2 group">
        <ChevronRight size={11} className="text-gray-200 group-hover:text-gray-400 flex-shrink-0" />
        <span className="text-[12px] font-medium text-gray-500 flex-shrink-0">{causa.rit}</span>
        {causa.cliente && (
          <span className="text-[12px] text-gray-400 truncate flex-1">{causa.cliente}</span>
        )}
        <button onClick={open}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-[#2570BA]/70 hover:text-[#2570BA] transition-all flex-shrink-0 whitespace-nowrap">
          + nota
        </button>
      </div>
      {showInput && (
        <div className="ml-5 mt-1 flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
          <input
            ref={inputRef}
            value={notaText}
            onChange={e => setNotaText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setShowInput(false); setNotaText('') } }}
            placeholder="Nota para esta causa..."
            disabled={saving}
            className="flex-1 text-[12px] bg-transparent border-none outline-none text-gray-700 placeholder-gray-300"
          />
          <button onClick={submit} disabled={saving || !notaText.trim()}
            className="text-[#2570BA] hover:text-[#1a2e4a] disabled:opacity-30 transition-colors">
            <Send size={11} />
          </button>
          <button onClick={() => { setShowInput(false); setNotaText('') }}
            className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={11} />
          </button>
        </div>
      )}
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
  { id: 'tareas',     label: 'Ir a Tareas',      path: '/tareas'     },
]
function CmdKModal({ open, onClose, navigate }) {
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
            <button key={a.id} onClick={() => { navigate(a.path); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group text-left">
              <span className="text-[13px] text-gray-700 group-hover:text-gray-900 flex-1">{a.label}</span>
              <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Apuntes() {
  const navigate    = useNavigate()
  const [audiencias, setAudiencias] = useState([])
  const [tareas,     setTareas]     = useState([])
  const [clientes,   setClientes]   = useState([])
  const [causas,     setCausas]     = useState([])
  const [ws, setWs]                 = useState(loadWS)
  const [cmdOpen, setCmdOpen]       = useState(false)

  useEffect(() => {
    supabase.from('audiencias')
      .select('id, tipo, fecha, hora, causa_rit, estado, cliente_nombre')
      .then(({ data }) => setAudiencias(data || []))

    supabase.from('tareas')
      .select('id, titulo, fecha_vencimiento, estado, causa_rit, cliente_nombre, categoria')
      .then(({ data }) => setTareas(data || []))

    supabase.from('clientes')
      .select('id, nombre')
      .then(({ data }) => setClientes(data || []))

    supabase.from('causas')
      .select('id, rit, ruc, cliente_nombre, materia, estado')
      .then(({ data }) => setCausas(data || []))

  }, [])

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(ws)) }, [ws])
  useEffect(() => {
    const fn = e => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v) } }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // ── mutations ──────────────────────────────────────────────────────────────
  const setField = useCallback((f, v) => setWs(p => ({ ...p, [f]: v })), [])
  const toggleHo = useCallback(id => setWs(p => ({ ...p, hoItems: p.hoItems.map(i => i.id === id ? { ...i, done: !i.done } : i) })), [])
  const deleteHo = useCallback(id => setWs(p => ({ ...p, hoItems: p.hoItems.filter(i => i.id !== id) })), [])
  const addHo    = useCallback(text => setWs(p => ({ ...p, hoItems: [...p.hoItems, { id: uid(), text, done: false }] })), [])

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

  // ── BrainDump conversions ─────────────────────────────────────────────────
  const handleSaveConversion = useCallback(async (lineId, text, convType, causa) => {
    const causaRit      = causa?.rit            || null
    const causaId       = causa?.id             || null
    const clienteNombre = causa?.cliente_nombre || null

    if (convType === 'tarea') {
      await supabase.from('tareas').insert([{
        titulo:         text,
        estado:         'Pendiente',
        prioridad:      isActionLine(text) ? 'Alta' : 'Media',
        causa_rit:      causaRit,
        causa_id:       causaId,
        cliente_nombre: clienteNombre,
      }])
    } else if (convType === 'seguimiento') {
      await supabase.from('revisiones').insert([{
        causa_id:       causaId,
        causa_rit:      causaRit,
        cliente_nombre: clienteNombre,
        fecha:          TODAY,
        proxima_accion: text,
      }])
    } else if (convType === 'siau') {
      await supabase.from('siau').insert([{
        solicitud:      text,
        fecha:          TODAY,
        estado:         'Pendiente',
        causa_rit:      causaRit,
        causa_id:       causaId,
        cliente_nombre: clienteNombre,
      }])
    }

    // Mark line with tag
    setWs(p => ({
      ...p,
      dumpLines: p.dumpLines.map(l => l.id === lineId ? { ...l, tag: convType } : l),
    }))
  }, [])

  // ── Causas activas "+ nota" ───────────────────────────────────────────────
  const handleAddNotaToCausa = useCallback(async (causa, text) => {
    await supabase.from('revisiones').insert([{
      causa_id:       causa.id       || null,
      causa_rit:      causa.rit      || null,
      cliente_nombre: causa.cliente  || null,
      fecha:          TODAY,
      proxima_accion: text,
    }])
  }, [])

  const causasActivas = useMemo(() => {
    const seen = new Set()
    return tareas
      .filter(t => { if (!t.causa_rit || seen.has(t.causa_rit)) return false; seen.add(t.causa_rit); return true })
      .map(t => ({ rit: t.causa_rit, cliente: t.cliente_nombre || '', id: t.causa_id || null }))
      .slice(0, 8)
  }, [tareas])

  const monthWeeks = useMemo(() => getMonthWeeks(ws.agendaMonth), [ws.agendaMonth])

  const dumpLines = ws.dumpLines || [{ id: 'init', text: '', type: 'nota', done: false, tag: null }]
  function setDumpLines(lines) { setField('dumpLines', lines) }

  return (
    <div className="flex flex-col h-full bg-[#f7f8fa] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight leading-none">Agenda diaria</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{capitalizeFirst(formatDateLong(TODAY))}</p>
        </div>
        <button onClick={() => setCmdOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300 transition-all text-gray-500">
          <Command size={12} /><span className="text-[12px]">K</span>
        </button>
      </div>

      {/* ── Workspace surface ── */}
      <div className="flex-1 overflow-y-auto px-8 py-5 min-h-0">
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr' }}>

          {/* ══ LEFT: Agenda Diaria ══ */}
          <div className="border-r border-gray-50">
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
              <div className="flex items-center gap-2 mb-3">
                <AlignLeft size={12} className="text-purple-400 flex-shrink-0" />
                <span className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest flex-1">Brain Dump</span>
                <span className="text-[10px] text-gray-300">Enter para convertir</span>
              </div>
              <BrainDump
                lines={dumpLines}
                onChange={setDumpLines}
                clientes={clientes}
                causas={causas}
                onSaveConversion={handleSaveConversion}
              />
            </div>


            {/* Causas activas */}
            {causasActivas.length > 0 && (
              <RightSection title="Causas activas" icon={Star} iconColor="text-yellow-400" defaultOpen={false}>
                {causasActivas.map(c => (
                  <CausasActivasItem
                    key={c.rit}
                    causa={c}
                    onAddNota={handleAddNotaToCausa}
                  />
                ))}
              </RightSection>
            )}

          </div>
        </div>
      </div>

      <CmdKModal open={cmdOpen} onClose={() => setCmdOpen(false)} navigate={navigate} />
    </div>
  )
}
