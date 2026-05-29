import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search, Plus, X, Check, ChevronDown, ChevronRight,
  Calendar, Clock, Flag, CheckSquare, Activity,
  AlignLeft, Layers, Tag, Trash2, Edit2, Loader2, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constantes ────────────────────────────────────────────────────────────────
const TODAY      = new Date().toISOString().split('T')[0]
const TOMORROW   = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()
const SEMANA_FIN = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })()

const PRIORIDAD_STYLES = {
  'Alta':  { badge: 'bg-rose-50 text-rose-600',   dot: 'bg-rose-400',  border: 'border-l-rose-400'  },
  'Media': { badge: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400', border: 'border-l-amber-300' },
  'Baja':  { badge: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-300',  border: 'border-l-gray-200'  },
}

const ESTADO_STYLES = {
  'Pendiente':              { badge: 'bg-gray-100 text-gray-500',        dot: 'bg-gray-400'     },
  'En progreso':            { badge: 'bg-blue-50 text-blue-600',         dot: 'bg-blue-400'     },
  'Esperando antecedentes': { badge: 'bg-orange-50 text-orange-600',     dot: 'bg-orange-400'   },
  'En revisión':            { badge: 'bg-amber-50 text-amber-700',       dot: 'bg-amber-400'    },
  'Bloqueada':              { badge: 'bg-rose-50 text-rose-600',         dot: 'bg-rose-500'     },
  'Lista para envío':       { badge: 'bg-indigo-50 text-indigo-600',     dot: 'bg-indigo-400'   },
  'Completada':             { badge: 'bg-emerald-50 text-emerald-600',   dot: 'bg-emerald-400'  },
  'Cancelada':              { badge: 'bg-gray-100 text-gray-400',        dot: 'bg-gray-300'     },
  'Vencida':                { badge: 'bg-red-50 text-red-600',           dot: 'bg-red-500'      },
}

const CATEGORIA_STYLES = {
  'Escrito':             { badge: 'bg-indigo-50 text-indigo-600',  dot: 'bg-indigo-400' },
  'Audiencia':           { badge: 'bg-purple-50 text-purple-600',  dot: 'bg-purple-400' },
  'SIAU':                { badge: 'bg-teal-50 text-teal-600',      dot: 'bg-teal-400'   },
  'PJUD':                { badge: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-400'   },
  'Reunión':             { badge: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-400' },
  'Administrativo':      { badge: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400'  },
  'Cobranza':            { badge: 'bg-amber-50 text-amber-600',    dot: 'bg-amber-400'  },
  'Seguimiento cliente': { badge: 'bg-sky-50 text-sky-600',        dot: 'bg-sky-400'    },
  'Documento':           { badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400'   },
  'Otro':                { badge: 'bg-gray-50 text-gray-400',      dot: 'bg-gray-300'   },
}

const ABOGADAS = [
  { key: 'MT', nombre: 'Macarena', bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  { key: 'AB', nombre: 'Angélica', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'CL', nombre: 'Catalina', bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
]

const ACT_STYLES = {
  creacion:   { dot: 'bg-blue-400',    text: 'text-blue-500'   },
  estado:     { dot: 'bg-amber-400',   text: 'text-amber-500'  },
  comentario: { dot: 'bg-gray-300',    text: 'text-gray-400'   },
  alerta:     { dot: 'bg-red-400',     text: 'text-red-500'    },
  completada: { dot: 'bg-emerald-400', text: 'text-emerald-500'},
  progreso:   { dot: 'bg-indigo-400',  text: 'text-indigo-500' },
}

const ESTADO_OPTIONS    = ['Pendiente','En progreso','Esperando antecedentes','En revisión','Bloqueada','Lista para envío','Completada','Cancelada','Vencida']
const PRIORIDAD_OPTIONS = ['Alta','Media','Baja']
const RESPONSABLE_OPT   = ['MT','AB','CL']
const CATEGORIA_OPTIONS = ['Escrito','Audiencia','SIAU','PJUD','Reunión','Administrativo','Cobranza','Seguimiento cliente','Documento','Otro']
const GRUPO_OPTIONS     = ['Por fecha','Por prioridad','Por estado','Por responsable','Por causa']

const MATERIA_CAUSA_COLORS = {
  'Familia': 'bg-rose-50 text-rose-500',
  'Penal':   'bg-red-50 text-red-600',
  'Civil':   'bg-sky-50 text-sky-600',
  'Laboral': 'bg-violet-50 text-violet-600',
  'Otro':    'bg-gray-100 text-gray-500',
}

// Campos que existen en la BD
const DB_FIELDS = new Set(['estado','notas','titulo','prioridad','fecha_vencimiento','cliente_nombre','causa_rit','cliente_id','causa_id'])

// ── Mappers ───────────────────────────────────────────────────────────────────
function mapRow(row) {
  return {
    id:               row.id,
    created_at:       row.created_at,
    titulo:           row.titulo            || '',
    estado:           row.estado            || 'Pendiente',
    prioridad:        row.prioridad         || 'Media',
    fecha_vencimiento:row.fecha_vencimiento || '',
    notas:            row.notas             || '',
    cliente_nombre:   row.cliente_nombre    || '',
    causa_rit:        row.causa_rit         || '',
    causa_id:         row.causa_id          || null,
    cliente_id:       row.cliente_id        || null,
    // UI-only (no están en BD)
    causa_ruc:   '',
    categoria:   'Otro',
    responsable: 'MT',
    subtareas:   [],
    actividad:   [],
  }
}

function mapToDb(form) {
  return {
    titulo:           form.titulo            || null,
    estado:           form.estado            || 'Pendiente',
    prioridad:        form.prioridad         || 'Media',
    fecha_vencimiento:form.fecha_vencimiento || null,
    notas:            form.notas             || null,
    cliente_nombre:   form.cliente_nombre    || null,
    causa_rit:        form.causa_rit         || null,
    cliente_id:       form.cliente_id        || null,
    causa_id:         form.causa_id          || null,
  }
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────
function ErrorBanner({ mensaje, onRetry }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-600">
      <AlertCircle size={16} className="flex-shrink-0" />
      <span className="flex-1">{mensaje}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-medium underline underline-offset-2 hover:text-red-800 transition-colors">
          Reintentar
        </button>
      )}
    </div>
  )
}

// ── ClienteSelect ──────────────────────────────────────────────────────────────
function ClienteSelect({ value, onChange, clientesLista = [] }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState({ top:0, left:0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)
  const inputRef= useRef(null)

  const filtered = clientesLista.filter(c => c.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const close = e => {
      if (btnRef.current  && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const handleOpen = e => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 290))
      setCoords({ top: r.bottom + 4, left })
    }
    setOpen(p => !p)
    setSearch('')
  }

  const select = cliente => { onChange(cliente); setOpen(false); setSearch('') }
  const clear  = e => { e.stopPropagation(); onChange('') }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 text-xs border rounded-xl px-3 py-2 transition-all ${
          value
            ? 'border-gray-200 text-gray-800 bg-white hover:border-gray-300'
            : 'border-gray-100 text-gray-400 bg-gray-50/50 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value ? (
            <>
              <span className="w-5 h-5 rounded-full bg-[#1a2e4a]/8 text-[#1a2e4a] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {value[0]}
              </span>
              <span className="truncate font-medium">{value}</span>
            </>
          ) : (
            <span className="text-gray-400">Seleccionar cliente...</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span onClick={clear} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded">
              <X size={11} />
            </span>
          )}
          <ChevronDown size={10} className="text-gray-300" />
        </div>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top: coords.top, left: coords.left, minWidth: 280 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pt-2 pb-2 border-b border-gray-50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-7 pr-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50/60 border border-gray-100 rounded-lg focus:outline-none focus:border-blue-200"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">Sin resultados</p>
            ) : filtered.map(c => (
              <button
                key={c}
                onClick={() => select(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${value === c ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}
              >
                <span className="w-6 h-6 rounded-full bg-[#1a2e4a]/8 text-[#1a2e4a] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {c[0]}
                </span>
                <span className={`text-xs flex-1 ${value === c ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{c}</span>
                {value === c && <Check size={11} className="text-emerald-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CausaSelect ────────────────────────────────────────────────────────────────
function CausaSelect({ ritValue, onChange, clienteSeleccionado, allCausas = [] }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState({ top:0, left:0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)
  const inputRef= useRef(null)

  const disabled = !clienteSeleccionado
  const causas   = allCausas.filter(c => c.cliente_nombre === clienteSeleccionado)
  const filtered = causas.filter(c =>
    (c.rit || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.materia || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.tribunal || '').toLowerCase().includes(search.toLowerCase())
  )
  const selected = causas.find(c => c.rit === ritValue)

  useEffect(() => {
    const close = e => {
      if (btnRef.current  && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const handleOpen = e => {
    e.stopPropagation()
    if (disabled) return
    if (!open && btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 310))
      setCoords({ top: r.bottom + 4, left })
    }
    setOpen(p => !p)
    setSearch('')
  }

  const select = causa => {
    onChange(causa.rit, causa.id, causa.cliente_id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 text-xs border rounded-xl px-3 py-2 transition-all ${
          disabled
            ? 'border-gray-100 text-gray-300 bg-gray-50/30 cursor-not-allowed'
            : ritValue
              ? 'border-gray-200 text-gray-800 bg-white hover:border-gray-300'
              : 'border-gray-100 text-gray-400 bg-gray-50/50 hover:border-gray-300 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {disabled && <span className="text-[10px] text-gray-300 italic">Selecciona un cliente primero</span>}
          {!disabled && !ritValue && <span className="text-gray-400">Seleccionar causa...</span>}
          {!disabled && ritValue && selected && (
            <>
              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{selected.rit}</span>
              {selected.materia && (
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${MATERIA_CAUSA_COLORS[selected.materia] || 'bg-gray-100 text-gray-400'}`}>
                  {selected.materia}
                </span>
              )}
            </>
          )}
          {!disabled && ritValue && !selected && (
            <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{ritValue}</span>
          )}
        </div>
        {!disabled && <ChevronDown size={10} className="text-gray-300 flex-shrink-0" />}
      </button>

      {open && !disabled && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top: coords.top, left: coords.left, minWidth: 310 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pt-2 pb-2 border-b border-gray-50">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">
              Causas · {clienteSeleccionado.split(' ')[0]}
            </p>
            {causas.length > 2 && (
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar RIT, materia..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50/60 border border-gray-100 rounded-lg focus:outline-none"
                />
              </div>
            )}
          </div>
          <div className="py-1 max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">Sin causas para este cliente</p>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => select(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${ritValue === c.rit ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">{c.rit}</span>
                    {c.materia && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${MATERIA_CAUSA_COLORS[c.materia] || 'bg-gray-100 text-gray-400'}`}>
                        {c.materia}
                      </span>
                    )}
                  </div>
                  {c.tribunal && (
                    <span className="text-[10px] text-gray-400 truncate block">{c.tribunal}</span>
                  )}
                </div>
                {ritValue === c.rit && <Check size={11} className="text-emerald-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function efectivoEstado(t) {
  if (!['Completada','Cancelada','Vencida'].includes(t.estado) && t.fecha_vencimiento && t.fecha_vencimiento < TODAY)
    return 'Vencida'
  return t.estado
}

function getFechaLabel(f) {
  if (!f) return '—'
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const [,m,d] = f.split('-').map(Number)
  if (f === TODAY)    return 'Hoy'
  if (f === TOMORROW) return 'Mañana'
  if (f < TODAY)      return `${d} ${M[m-1]}`
  const diff = Math.round((new Date(f) - new Date(TODAY)) / 86400000)
  if (diff <= 7) return `en ${diff}d`
  return `${d} ${M[m-1]}`
}

function sortTareas(list) {
  return [...list].sort((a, b) => {
    const aF = ['Completada','Cancelada'].includes(a.estado)
    const bF = ['Completada','Cancelada'].includes(b.estado)
    if (aF !== bF) return aF ? 1 : -1
    const aV = efectivoEstado(a) === 'Vencida'
    const bV = efectivoEstado(b) === 'Vencida'
    if (aV !== bV) return aV ? -1 : 1
    return (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || '')
  })
}

function computeGrupos(tareas, groupBy) {
  if (groupBy === 'Por fecha') {
    const defs = [
      { key:'Vencidas',     filter: t => efectivoEstado(t)==='Vencida',                      color:'text-red-500',   dot:'bg-red-400'    },
      { key:'Hoy',          filter: t => t.fecha_vencimiento===TODAY && efectivoEstado(t)!=='Vencida' && !['Completada','Cancelada'].includes(t.estado),
                                                                                               color:'text-amber-600', dot:'bg-amber-400'  },
      { key:'Mañana',       filter: t => t.fecha_vencimiento===TOMORROW && !['Completada','Cancelada'].includes(t.estado),
                                                                                               color:'text-blue-600',  dot:'bg-blue-400'   },
      { key:'Esta semana',  filter: t => t.fecha_vencimiento>TOMORROW && t.fecha_vencimiento<=SEMANA_FIN && !['Completada','Cancelada'].includes(t.estado),
                                                                                               color:'text-gray-600',  dot:'bg-gray-400'   },
      { key:'Más adelante', filter: t => t.fecha_vencimiento>SEMANA_FIN && !['Completada','Cancelada'].includes(t.estado),
                                                                                               color:'text-gray-500',  dot:'bg-gray-300'   },
      { key:'Sin fecha',    filter: t => !t.fecha_vencimiento && !['Completada','Cancelada'].includes(t.estado),
                                                                                               color:'text-gray-400',  dot:'bg-gray-200'   },
      { key:'Completadas',  filter: t => ['Completada','Cancelada'].includes(t.estado),        color:'text-gray-400',  dot:'bg-gray-300'   },
    ]
    return defs.map(d => ({ ...d, items: tareas.filter(d.filter) })).filter(g => g.items.length > 0)
  }

  const buckets = {}
  const order   = []
  const keyOf   = t => {
    if (groupBy === 'Por prioridad')   return t.prioridad
    if (groupBy === 'Por estado')      return efectivoEstado(t)
    if (groupBy === 'Por responsable') return t.responsable
    if (groupBy === 'Por causa')       return t.causa_rit || '(sin causa)'
    return 'all'
  }
  tareas.forEach(t => {
    const k = keyOf(t)
    if (!buckets[k]) { buckets[k] = []; order.push(k) }
    buckets[k].push(t)
  })
  if (groupBy === 'Por prioridad') order.sort((a,b) => ['Alta','Media','Baja'].indexOf(a) - ['Alta','Media','Baja'].indexOf(b))
  return order.map(k => ({ key:k, label:k, color:'text-gray-600', dot:'bg-gray-400', items:buckets[k] }))
}

// ── DropdownSelect ────────────────────────────────────────────────────────────
function DropdownSelect({ value, onChange, options, getStyle, label, compact = false }) {
  const [open, setOpen]     = useState(false)
  const [coords, setCoords] = useState({ top:0, left:0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = e => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleOpen = e => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 230))
      setCoords({ top: r.bottom + 4, left })
    }
    setOpen(p => !p)
  }

  const s = getStyle ? getStyle(value) : {}

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-80 select-none ${
          compact
            ? `text-[10px] font-medium px-2 py-0.5 rounded-full ${s.badge || 'bg-gray-100 text-gray-500'}`
            : `text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-100 hover:border-gray-200 text-gray-700 bg-white`
        }`}
      >
        {s.dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />}
        <span>{value || '—'}</span>
        <ChevronDown size={9} className="opacity-30 flex-shrink-0" />
      </button>
      {open && (
        <div ref={menuRef} className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top:coords.top, left:coords.left, minWidth:210 }}>
          <div className="px-3 pt-2 pb-1.5 border-b border-gray-50">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">{label}</p>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map(opt => {
              const os  = getStyle ? getStyle(opt) : {}
              const sel = value === opt
              return (
                <button key={opt}
                  onClick={e => { e.stopPropagation(); onChange(opt); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${sel ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}
                >
                  {os.dot && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${os.dot}`} />}
                  <span className={`text-xs flex-1 ${sel ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{opt}</span>
                  {sel && <Check size={11} className="text-emerald-500 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────
function TaskRow({ tarea, onClick, onToggle, panelOpen }) {
  const eE    = efectivoEstado(tarea)
  const eS    = ESTADO_STYLES[eE]     || ESTADO_STYLES['Pendiente']
  const pS    = PRIORIDAD_STYLES[tarea.prioridad] || PRIORIDAD_STYLES['Media']
  const catS  = CATEGORIA_STYLES[tarea.categoria] || CATEGORIA_STYLES['Otro']
  const abo   = ABOGADAS.find(a => a.key === tarea.responsable)
  const done  = ['Completada','Cancelada'].includes(tarea.estado)
  const label = getFechaLabel(tarea.fecha_vencimiento)

  const fechaColor =
    eE === 'Vencida'                          ? 'text-red-500 font-semibold'  :
    tarea.fecha_vencimiento === TODAY         ? 'text-amber-500 font-semibold' :
    tarea.fecha_vencimiento === TOMORROW      ? 'text-blue-500'                :
                                                'text-gray-400'

  return (
    <div
      onClick={() => onClick(tarea)}
      className={`group relative flex items-center gap-3 px-4 py-3.5 border-l-[3px] cursor-pointer transition-all hover:bg-[#f7f9fc] ${pS.border} ${done ? 'opacity-50' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(tarea.id) }}
        className="flex-shrink-0"
        title={done ? 'Marcar como pendiente' : 'Marcar como completada'}
      >
        <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
          done
            ? 'bg-emerald-400 border-emerald-400'
            : 'border-gray-200 group-hover:border-emerald-300 group-hover:bg-emerald-50/50'
        }`}>
          {done && <Check size={9} className="text-white" />}
        </div>
      </button>

      {/* Título + cliente + categoría */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-medium leading-snug truncate ${done ? 'line-through text-gray-300' : 'text-gray-800'}`}>
            {tarea.titulo}
          </span>
          <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md ${catS.badge}`}>
            {tarea.categoria}
          </span>
        </div>
        <span className={`text-[11px] leading-none mt-1 block truncate ${done ? 'text-gray-300' : 'text-gray-400'}`}>
          {tarea.cliente_nombre}
        </span>
      </div>

      {/* RIT chip */}
      {tarea.causa_rit && (
        <span className="flex-shrink-0 text-[10px] font-semibold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-md hidden sm:block tracking-wide">
          {tarea.causa_rit}
        </span>
      )}

      {/* Fecha */}
      <span className={`flex-shrink-0 text-[11px] w-16 text-right tabular-nums ${fechaColor}`}>
        {label}
      </span>

      {/* Responsable */}
      {abo && (
        <span className={`flex-shrink-0 text-[9px] font-bold w-[22px] h-[22px] rounded-full flex items-center justify-center ${abo.bg} ${abo.text}`}
          title={abo.nombre}>
          {abo.key[0]}
        </span>
      )}

      {/* Quick actions */}
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={e => { e.stopPropagation(); onToggle(tarea.id) }}
          title={done ? 'Reabrir' : 'Completar'}
          className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-500 transition-colors"
        >
          <Check size={12} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onClick(tarea) }}
          title="Editar"
          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={e => e.stopPropagation()}
          title="Reagendar"
          className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-300 hover:text-violet-500 transition-colors"
        >
          <Calendar size={12} />
        </button>
      </div>

      {/* Estado */}
      <span className={`flex-shrink-0 text-[10px] font-medium px-2.5 py-0.5 rounded-md min-w-[80px] text-center ${eS.badge}`}>
        {eE}
      </span>
    </div>
  )
}

// ── GroupSection ──────────────────────────────────────────────────────────────
function GroupSection({ grupo, onTaskClick, onToggle, panelOpen }) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50/60 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${grupo.dot}`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${grupo.color}`}>
          {grupo.label || grupo.key}
        </span>
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full leading-none">
          {grupo.items.length}
        </span>
        <ChevronRight size={11} className={`text-gray-300 transition-transform duration-150 ${open ? 'rotate-90' : ''} ml-auto`} />
      </button>
      {open && (
        <div className="divide-y divide-gray-50">
          {grupo.items.map(t => (
            <TaskRow
              key={t.id}
              tarea={t}
              onClick={onTaskClick}
              onToggle={onToggle}
              panelOpen={panelOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── PanelTarea ────────────────────────────────────────────────────────────────
function PanelTarea({ tarea, onClose, onUpdate, clientesLista, allCausas }) {
  const [tab, setTab]           = useState('detalle')
  const [editTitulo, setEditT]  = useState(false)
  const [draftTitulo, setDraftT]= useState(tarea.titulo)
  const [newSub, setNewSub]     = useState('')

  const eE   = efectivoEstado(tarea)
  const pS   = PRIORIDAD_STYLES[tarea.prioridad] || PRIORIDAD_STYLES['Media']
  const eS   = ESTADO_STYLES[eE] || ESTADO_STYLES['Pendiente']
  const abo  = ABOGADAS.find(a => a.key === tarea.responsable)
  const done = (tarea.subtareas || []).filter(s => s.completada).length
  const total= (tarea.subtareas || []).length

  const update = cambios => onUpdate(tarea.id, cambios)

  const toggleSub = id => update({
    subtareas: (tarea.subtareas || []).map(s => s.id === id ? { ...s, completada: !s.completada } : s)
  })

  const deleteSub = id => update({ subtareas: (tarea.subtareas || []).filter(s => s.id !== id) })

  const addSub = () => {
    if (!newSub.trim()) return
    update({ subtareas: [...(tarea.subtareas || []), { id: `s${Date.now()}`, texto: newSub.trim(), completada: false }] })
    setNewSub('')
  }

  const saveTitulo = () => {
    if (draftTitulo.trim()) update({ titulo: draftTitulo.trim() })
    setEditT(false)
  }

  const TABS = [
    { key:'detalle',   label:'Detalle',   Icon: AlignLeft    },
    { key:'subtareas', label:'Subtareas', Icon: CheckSquare  },
    { key:'actividad', label:'Actividad', Icon: Activity     },
  ]

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className={`border-b border-gray-100 px-6 pt-5 pb-4 border-l-[4px] ${pS.border}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          {editTitulo ? (
            <input
              value={draftTitulo}
              onChange={e => setDraftT(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitulo(); if (e.key === 'Escape') setEditT(false) }}
              onBlur={saveTitulo}
              autoFocus
              className="flex-1 text-[15px] font-semibold text-[#1a2e4a] border-b-2 border-blue-300 focus:outline-none bg-transparent leading-snug"
            />
          ) : (
            <button
              onClick={() => { setEditT(true); setDraftT(tarea.titulo) }}
              className="flex-1 text-left text-[15px] font-semibold text-[#1a2e4a] leading-snug hover:text-[#2570ba] transition-colors group"
            >
              {tarea.titulo}
              <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-25 transition-opacity" />
            </button>
          )}
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5 p-0.5 rounded-lg hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>

        {/* Badge row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <DropdownSelect
            value={eE}
            onChange={v => update({ estado: v })}
            options={ESTADO_OPTIONS}
            getStyle={v => ESTADO_STYLES[v] || {}}
            label="Estado"
            compact
          />
          <DropdownSelect
            value={tarea.prioridad}
            onChange={v => update({ prioridad: v })}
            options={PRIORIDAD_OPTIONS}
            getStyle={v => PRIORIDAD_STYLES[v] || {}}
            label="Prioridad"
            compact
          />
          <DropdownSelect
            value={tarea.categoria}
            onChange={v => update({ categoria: v })}
            options={CATEGORIA_OPTIONS}
            getStyle={v => CATEGORIA_STYLES[v] || {}}
            label="Categoría"
            compact
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-6 flex-shrink-0 bg-gray-50/30">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold py-3 mr-6 border-b-2 transition-colors ${
              tab === key
                ? 'border-[#1a2e4a] text-[#1a2e4a]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={12} />
            {label}
            {key === 'subtareas' && total > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-[#1a2e4a]/10 text-[#1a2e4a]' : 'bg-gray-100 text-gray-400'}`}>
                {done}/{total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* ── Detalle ── */}
        {tab === 'detalle' && (
          <div className="space-y-0">
            <div className="pb-5">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-3">Asignación</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Responsable</p>
                  <DropdownSelect
                    value={tarea.responsable}
                    onChange={v => update({ responsable: v })}
                    options={RESPONSABLE_OPT}
                    getStyle={v => { const a=ABOGADAS.find(ab=>ab.key===v); return a ? {badge:`${a.bg} ${a.text}`,dot:a.dot} : {} }}
                    label="Responsable"
                    compact
                  />
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Fecha límite</p>
                  <input
                    type="date"
                    value={tarea.fecha_vencimiento}
                    onChange={e => update({ fecha_vencimiento: e.target.value })}
                    className="text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-200 bg-gray-50/50 w-full"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-50 pt-5 pb-5">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-3">Expediente</p>
              <div className="mb-3">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Cliente</p>
                <ClienteSelect
                  value={tarea.cliente_nombre}
                  clientesLista={clientesLista}
                  onChange={nuevoCliente => {
                    update({ cliente_nombre: nuevoCliente, causa_rit: '', causa_id: null })
                  }}
                />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Causa asociada</p>
                <CausaSelect
                  ritValue={tarea.causa_rit}
                  clienteSeleccionado={tarea.cliente_nombre}
                  allCausas={allCausas}
                  onChange={(rit, causaId, clienteId) => update({ causa_rit: rit, causa_id: causaId, cliente_id: clienteId })}
                />
              </div>
            </div>

            <div className="border-t border-gray-50 pt-5">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-3">Notas internas</p>
              <textarea
                value={tarea.notas}
                onChange={e => update({ notas: e.target.value })}
                rows={4}
                className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/30 resize-none leading-relaxed placeholder:text-gray-300"
                placeholder="Instrucciones, contexto, referencias..."
              />
            </div>
          </div>
        )}

        {/* ── Subtareas ── */}
        {tab === 'subtareas' && (
          <div className="space-y-4">
            {total > 0 && (
              <div className="bg-gray-50/60 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500 font-semibold">{done} de {total} completadas</span>
                  <span className="text-[10px] font-bold text-emerald-500">{Math.round((done/total)*100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (done/total)*100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-0.5">
              {(tarea.subtareas || []).map(s => (
                <div key={s.id} className="group flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50/80 transition-colors">
                  <button onClick={() => toggleSub(s.id)} className="flex-shrink-0">
                    <div className={`w-[15px] h-[15px] rounded border-2 flex items-center justify-center transition-all ${
                      s.completada ? 'bg-emerald-400 border-emerald-400' : 'border-gray-200 group-hover:border-gray-300'
                    }`}>
                      {s.completada && <Check size={8} className="text-white" />}
                    </div>
                  </button>
                  <span className={`flex-1 text-[12px] leading-relaxed ${s.completada ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                    {s.texto}
                  </span>
                  <button onClick={() => deleteSub(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1 border-t border-dashed border-gray-100">
              <div className="w-[15px] h-[15px] rounded border-2 border-dashed border-gray-200 flex-shrink-0" />
              <input
                type="text"
                value={newSub}
                onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSub()}
                placeholder="Agregar subtarea..."
                className="flex-1 text-[12px] text-gray-600 placeholder:text-gray-300 bg-transparent focus:outline-none py-1.5"
              />
              {newSub.trim() && (
                <button onClick={addSub} className="text-[10px] bg-[#2570BA] text-white px-3 py-1 rounded-lg hover:bg-[#2570BA]/90 transition-colors font-semibold">
                  Agregar
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Actividad ── */}
        {tab === 'actividad' && (
          <div className="space-y-0">
            {(tarea.actividad || []).length === 0 && (
              <p className="text-xs text-gray-300 text-center py-8">Sin actividad registrada</p>
            )}
            {(tarea.actividad || []).map((act, i) => {
              const s   = ACT_STYLES[act.tipo] || ACT_STYLES['comentario']
              const abo = ABOGADAS.find(a => a.key === act.autor)
              const last= i === (tarea.actividad || []).length - 1
              return (
                <div key={act.id} className="flex gap-3.5">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
                    {!last && <div className="w-px flex-1 bg-gray-100 my-1.5" />}
                  </div>
                  <div className="pb-5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {abo && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${abo.bg} ${abo.text}`}>{abo.nombre}</span>
                      )}
                      <span className="text-[10px] text-gray-300 tabular-nums">{act.fecha} · {act.hora}</span>
                    </div>
                    <p className={`text-[12px] leading-relaxed ${s.text}`}>{act.desc}</p>
                  </div>
                </div>
              )
            })}

            <div className="flex gap-3 pt-3 border-t border-gray-50 mt-2">
              <div className="w-2 flex-shrink-0 mt-2.5">
                <div className="w-2 h-2 rounded-full bg-gray-200" />
              </div>
              <input
                type="text"
                placeholder="Agregar comentario..."
                className="flex-1 text-xs text-gray-600 placeholder:text-gray-300 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-6 py-3.5 flex items-center gap-2 flex-shrink-0 bg-gray-50/30">
        <button
          onClick={() => update({ estado: tarea.estado === 'Completada' ? 'Pendiente' : 'Completada' })}
          className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl transition-colors ${
            tarea.estado === 'Completada'
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-200'
          }`}
        >
          <Check size={13} />
          {tarea.estado === 'Completada' ? 'Reabrir tarea' : 'Marcar completada'}
        </button>
      </div>
    </div>
  )
}

// ── FormNuevaTarea ────────────────────────────────────────────────────────────
function FormNuevaTarea({ onClose, onSave, clientesLista, allCausas }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titulo: '', cliente_nombre: '', causa_rit: '', causa_id: null, cliente_id: null,
    categoria: 'Escrito', prioridad: 'Media',
    fecha_vencimiento: TODAY, responsable: 'MT',
    estado: 'Pendiente', notas: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.titulo.trim()) return
    setSaving(true)
    onSave(form)
  }

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-[#1a2e4a]/20" />
          <h2 className="text-sm font-bold text-[#1a2e4a]">Nueva tarea</h2>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded-lg hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Título *</p>
          <input
            type="text"
            value={form.titulo}
            onChange={e => f('titulo', e.target.value)}
            autoFocus
            placeholder="¿Qué hay que hacer?"
            className="w-full text-sm text-gray-800 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/50 font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Categoría</p>
            <DropdownSelect value={form.categoria} onChange={v=>f('categoria',v)} options={CATEGORIA_OPTIONS}
              getStyle={v=>CATEGORIA_STYLES[v]||{}} label="Categoría" compact />
          </div>
          <div>
            <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Prioridad</p>
            <DropdownSelect value={form.prioridad} onChange={v=>f('prioridad',v)} options={PRIORIDAD_OPTIONS}
              getStyle={v=>PRIORIDAD_STYLES[v]||{}} label="Prioridad" compact />
          </div>
          <div>
            <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Responsable</p>
            <DropdownSelect value={form.responsable} onChange={v=>f('responsable',v)} options={RESPONSABLE_OPT}
              getStyle={v=>{ const a=ABOGADAS.find(ab=>ab.key===v); return a?{badge:`${a.bg} ${a.text}`,dot:a.dot}:{} }}
              label="Responsable" compact />
          </div>
          <div>
            <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Estado</p>
            <DropdownSelect value={form.estado} onChange={v=>f('estado',v)} options={ESTADO_OPTIONS}
              getStyle={v=>ESTADO_STYLES[v]||{}} label="Estado" compact />
          </div>
        </div>

        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Fecha límite</p>
          <input type="date" value={form.fecha_vencimiento} onChange={e=>f('fecha_vencimiento',e.target.value)}
            className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
        </div>

        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Cliente</p>
          <ClienteSelect
            value={form.cliente_nombre}
            clientesLista={clientesLista}
            onChange={nuevoCliente => {
              setForm(p => ({ ...p, cliente_nombre: nuevoCliente, causa_rit: '', causa_id: null }))
            }}
          />
        </div>

        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Causa asociada</p>
          <CausaSelect
            ritValue={form.causa_rit}
            clienteSeleccionado={form.cliente_nombre}
            allCausas={allCausas}
            onChange={(rit, causaId, clienteId) => setForm(p => ({ ...p, causa_rit: rit, causa_id: causaId, cliente_id: clienteId }))}
          />
        </div>

        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Notas internas</p>
          <textarea value={form.notas} onChange={e=>f('notas',e.target.value)} rows={3}
            placeholder="Instrucciones, contexto, referencias..."
            className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/50 resize-none" />
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-3.5 flex gap-2 flex-shrink-0 bg-gray-50/30">
        <button onClick={onClose} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-2.5 rounded-xl hover:bg-gray-100 transition-colors font-medium">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!form.titulo.trim() || saving}
          className="flex-1 text-xs bg-[#2570BA] text-white py-2.5 rounded-xl hover:bg-[#2570BA]/90 transition-colors font-semibold disabled:opacity-40 shadow-sm shadow-[#1a2e4a]/20"
        >
          {saving ? 'Guardando...' : 'Crear tarea'}
        </button>
      </div>
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'text-[#1a2e4a]', alert = false }) {
  return (
    <div className={`bg-white border rounded-2xl px-4 py-4 flex-1 min-w-0 shadow-sm ${alert && value > 0 ? 'border-red-100 bg-red-50/20' : 'border-gray-100'}`}>
      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-[26px] font-bold leading-none tabular-nums ${alert && value > 0 ? 'text-red-500' : color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1 font-medium">{sub}</p>}
    </div>
  )
}

// ── Main Tareas ───────────────────────────────────────────────────────────────
export default function Tareas() {
  const [tareas,       setTareas]       = useState([])
  const [allCausas,    setAllCausas]    = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [error,        setError]        = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [busqueda,     setBusqueda]     = useState('')
  const [groupBy,      setGroupBy]      = useState('Por fecha')

  const [fEstado,    setFEstado]    = useState('Todos')
  const [fPrioridad, setFPrioridad] = useState('Todas')
  const [fResp,      setFResp]      = useState('Todas')
  const [fCategoria, setFCategoria] = useState('Todas')

  const panelOpen = !!(seleccionada || showForm)

  // ── Fetch tareas ──
  const fetchTareas = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tareas')
      .select('*')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    if (err) {
      setError(err.message)
    } else {
      setTareas((data || []).map(mapRow))
    }
    setCargando(false)
  }, [])

  // ── Fetch causas para selects ──
  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id, rit, materia, tribunal, cliente_nombre, cliente_id')
      .order('rit')
    setAllCausas(data || [])
  }, [])

  useEffect(() => {
    fetchTareas()
    fetchCausas()
  }, [fetchTareas, fetchCausas])

  // Lista de clientes para los selects
  const clientesLista = useMemo(() => {
    const nombres = [...new Set(allCausas.map(c => c.cliente_nombre).filter(Boolean))]
    return nombres.sort()
  }, [allCausas])

  // ── Actualizar tarea ──
  const handleUpdate = useCallback(async (id, cambios) => {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, ...cambios } : t))

    // Persist solo campos que existen en BD
    const dbCambios = Object.fromEntries(
      Object.entries(cambios).filter(([k]) => DB_FIELDS.has(k))
    )
    if (Object.keys(dbCambios).length === 0) return

    const { error: err } = await supabase
      .from('tareas')
      .update(dbCambios)
      .eq('id', id)
    if (err) console.error('Error actualizando tarea:', err.message)
  }, [])

  // ── Toggle completada ──
  const handleToggle = useCallback(async (id) => {
    const tarea = tareas.find(t => t.id === id)
    if (!tarea) return
    const done      = ['Completada','Cancelada'].includes(tarea.estado)
    const nuevoEstado = done ? 'Pendiente' : 'Completada'
    setTareas(prev => prev.map(t => t.id === id ? { ...t, estado: nuevoEstado } : t))
    const { error: err } = await supabase
      .from('tareas')
      .update({ estado: nuevoEstado })
      .eq('id', id)
    if (err) console.error('Error toggling tarea:', err.message)
  }, [tareas])

  // ── Crear tarea ──
  const handleAdd = useCallback(async (form) => {
    const payload = mapToDb(form)
    const { data, error: err } = await supabase
      .from('tareas')
      .insert([payload])
      .select()
      .single()
    if (err) {
      alert('Error al guardar: ' + err.message)
    } else {
      setTareas(prev => [mapRow(data), ...prev])
      setShowForm(false)
    }
  }, [])

  const openTask = (tarea) => { setShowForm(false); setSeleccionada(tarea) }
  const closePanel = () => { setSeleccionada(null); setShowForm(false) }

  // Sync seleccionada with updated tareas
  const selActual = useMemo(() => {
    if (!seleccionada) return null
    return tareas.find(t => t.id === seleccionada.id) || null
  }, [tareas, seleccionada?.id])

  // Metrics
  const activas     = tareas.filter(t => !['Completada','Cancelada'].includes(t.estado))
  const vencidas    = activas.filter(t => efectivoEstado(t) === 'Vencida')
  const semana      = activas.filter(t => t.fecha_vencimiento >= TODAY && t.fecha_vencimiento <= SEMANA_FIN)
  const enProgreso  = activas.filter(t => t.estado === 'En progreso')
  const altaPrior   = activas.filter(t => t.prioridad === 'Alta')
  const mes         = new Date().toISOString().slice(0, 7)
  const completadas = tareas.filter(t => t.estado === 'Completada' && (t.fecha_vencimiento || '').startsWith(mes))

  // Filter
  const filtradas = useMemo(() => {
    let r = tareas
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(t =>
        (t.titulo         || '').toLowerCase().includes(q) ||
        (t.cliente_nombre || '').toLowerCase().includes(q) ||
        (t.causa_rit      || '').toLowerCase().includes(q)
      )
    }
    if (fEstado    !== 'Todos')  r = r.filter(t => efectivoEstado(t) === fEstado)
    if (fPrioridad !== 'Todas')  r = r.filter(t => t.prioridad  === fPrioridad)
    if (fResp      !== 'Todas')  r = r.filter(t => t.responsable === fResp)
    if (fCategoria !== 'Todas')  r = r.filter(t => t.categoria  === fCategoria)
    return r
  }, [tareas, busqueda, fEstado, fPrioridad, fResp, fCategoria])

  const grupos = useMemo(() => computeGrupos(filtradas, groupBy), [filtradas, groupBy])
  const hayFiltros = busqueda || fEstado !== 'Todos' || fPrioridad !== 'Todas' || fResp !== 'Todas' || fCategoria !== 'Todas'

  return (
    <div className="flex h-full bg-[#fafafa]">

      {/* ── Lista principal ── */}
      <div className={`flex flex-col transition-all duration-200 ${panelOpen ? 'flex-1 min-w-0' : 'w-full'}`}>

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#1a2e4a]">Tareas</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {cargando ? 'Cargando...' : (
                <>
                  {activas.length} activas
                  {vencidas.length > 0 && <> · <span className="text-red-500 font-medium">{vencidas.length} vencidas</span></>}
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => { setSeleccionada(null); setShowForm(true) }}
            className="inline-flex items-center gap-2 bg-[#2570BA] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#2570BA]/90 transition-colors"
          >
            <Plus size={15} />
            Nueva tarea
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {error && <ErrorBanner mensaje={`Error al cargar tareas: ${error}`} onRetry={fetchTareas} />}

          {cargando ? (
            <div className="flex items-center justify-center py-20 text-gray-300">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : (
            <>
              {/* Métricas */}
              <div className="flex gap-2.5">
                <MetricCard label="Activas"        value={activas.length}     sub="tareas en curso"           />
                <MetricCard label="Vencidas"       value={vencidas.length}    sub="requieren atención" alert  />
                <MetricCard label="Esta semana"    value={semana.length}      sub="próximos 7 días"           />
                <MetricCard label="En progreso"    value={enProgreso.length}  sub="en desarrollo"  color="text-blue-600" />
                <MetricCard label="Alta prioridad" value={altaPrior.length}   sub="urgentes"       color="text-rose-600" />
                <MetricCard label="Completadas"    value={completadas.length} sub="este mes"       color="text-emerald-600" />
              </div>

              {/* Filtros */}
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2.5 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar tarea, cliente, RIT..."
                    className="w-full pl-8 pr-3 py-2 text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50/60 border border-gray-100 rounded-xl focus:outline-none focus:border-blue-200"
                  />
                </div>

                {[
                  { lbl:'Estado',     val:fEstado,    set:setFEstado,    opts:['Todos',...ESTADO_OPTIONS]     },
                  { lbl:'Prioridad',  val:fPrioridad, set:setFPrioridad, opts:['Todas',...PRIORIDAD_OPTIONS]  },
                  { lbl:'Responsable',val:fResp,      set:setFResp,      opts:['Todas',...RESPONSABLE_OPT]    },
                  { lbl:'Categoría',  val:fCategoria, set:setFCategoria, opts:['Todas',...CATEGORIA_OPTIONS]  },
                ].map(({ lbl, val, set, opts }) => (
                  <div key={lbl} className="relative">
                    <select value={val} onChange={e => set(e.target.value)}
                      className="appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl pl-3 pr-7 py-2 focus:outline-none cursor-pointer">
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                  </div>
                ))}

                <div className="flex items-center gap-1 ml-auto border-l border-gray-100 pl-3">
                  <Layers size={12} className="text-gray-300 flex-shrink-0" />
                  {GRUPO_OPTIONS.map(g => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        groupBy === g ? 'bg-[#1a2e4a]/8 text-[#1a2e4a]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {g.replace('Por ','')}
                    </button>
                  ))}
                </div>

                {hayFiltros && (
                  <button
                    onClick={() => { setBusqueda(''); setFEstado('Todos'); setFPrioridad('Todas'); setFResp('Todas'); setFCategoria('Todas') }}
                    className="text-[11px] text-gray-300 hover:text-gray-500 flex items-center gap-1"
                  >
                    <X size={11} />
                    Limpiar
                  </button>
                )}
              </div>

              {/* Task list */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                  <div className="w-[18px] flex-shrink-0" />
                  <span className="flex-1 text-[9px] font-bold text-gray-300 uppercase tracking-widest">Tarea</span>
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest hidden sm:block w-24">Causa</span>
                  <span className="w-16 text-[9px] font-bold text-gray-300 uppercase tracking-widest text-right">Límite</span>
                  <span className="w-[22px] text-[9px] font-bold text-gray-300 uppercase tracking-widest text-center">Resp</span>
                  <span className="w-[76px] text-[9px] font-bold text-gray-300 uppercase tracking-widest opacity-0">Acciones</span>
                  <span className="w-[80px] text-[9px] font-bold text-gray-300 uppercase tracking-widest">Estado</span>
                </div>

                {grupos.length === 0 ? (
                  <div className="text-center py-16 text-gray-300">
                    <CheckSquare size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">
                      {tareas.length === 0 ? 'No hay tareas registradas' : 'No hay tareas que coincidan'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50/80">
                    {grupos.map(g => (
                      <GroupSection
                        key={g.key}
                        grupo={g}
                        onTaskClick={openTask}
                        onToggle={handleToggle}
                        panelOpen={panelOpen}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Panel lateral ── */}
      {selActual && (
        <PanelTarea
          tarea={selActual}
          onClose={closePanel}
          onUpdate={handleUpdate}
          clientesLista={clientesLista}
          allCausas={allCausas}
        />
      )}
      {showForm && !seleccionada && (
        <FormNuevaTarea
          onClose={closePanel}
          onSave={handleAdd}
          clientesLista={clientesLista}
          allCausas={allCausas}
        />
      )}
    </div>
  )
}
