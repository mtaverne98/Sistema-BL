import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Search, Plus, X, Scale, Gavel, FileText,
  CheckSquare, BookOpen, Clock, Filter,
  LayoutList, Layers, User, Hash, Pencil,
  ChevronDown, ChevronRight, ChevronLeft, MessageSquare,
  Mail, Target, Send, Briefcase, AlignLeft,
  Loader2, AlertTriangle, RefreshCw, Trash2, Check,
  Calendar, Activity, Flame, PlusSquare,
  UserCheck, Upload,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import SegCargaHistorialModal from '../components/SegCargaHistorialModal'

// ── Exportación vacía para compatibilidad con CMD+K en MainLayout ──────────
export const CAUSAS = []

// ── Categorías de timeline ────────────────────────────────────────────────
const TIMELINE_CAT = {
  'Presentación': { bg: 'bg-blue-50',    text: 'text-blue-600',    bar: 'bg-blue-400',    Icon: Send      },
  'Resolución':   { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-400', Icon: Scale     },
  'Audiencia':    { bg: 'bg-purple-50',  text: 'text-purple-600',  bar: 'bg-purple-400',  Icon: Gavel     },
  'Oficio':       { bg: 'bg-amber-50',   text: 'text-amber-600',   bar: 'bg-amber-400',   Icon: Mail      },
  'Diligencia':   { bg: 'bg-orange-50',  text: 'text-orange-600',  bar: 'bg-orange-400',  Icon: Briefcase },
  'Documento':    { bg: 'bg-slate-50',   text: 'text-slate-500',   bar: 'bg-slate-400',   Icon: FileText  },
}

// ── Estilos ───────────────────────────────────────────────────────────────
const ESTADO_STYLES = {
  'En tramitación': { badge: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-400'    },
  'Abierta':        { badge: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400' },
  'Terminada':      { badge: 'bg-red-50 text-red-600',          dot: 'bg-red-500'     },
  'Archivada':      { badge: 'bg-red-100 text-red-500',         dot: 'bg-red-400'     },
  'Suspendida':     { badge: 'bg-amber-50 text-amber-600',     dot: 'bg-amber-400'   },
}
const AREA_STYLES = {
  'Penal':                'bg-red-50 text-red-600',
  'Familia':              'bg-rose-50 text-rose-500',
  'Laboral':              'bg-violet-50 text-violet-600',
  'Civil':                'bg-sky-50 text-sky-600',
  'JPL':                  'bg-orange-50 text-orange-600',
  'Administrativo':       'bg-teal-50 text-teal-600',
  'Corte de Apelaciones': 'bg-indigo-50 text-indigo-600',
  'Corte Suprema':        'bg-purple-50 text-purple-600',
}

const ESTADOS  = ['En tramitación', 'Abierta', 'Terminada', 'Archivada', 'Suspendida']
const CERRADAS = new Set(['Terminada', 'Archivada'])
const AREAS    = ['Penal', 'Familia', 'Laboral', 'Civil', 'JPL', 'Administrativo', 'Corte de Apelaciones', 'Corte Suprema']

// ── Lógica de área jurídica ────────────────────────────────────────────────
function getAreaGroup(area) {
  if (area === 'Penal') return 'penal'
  if (area === 'Corte de Apelaciones' || area === 'Corte Suprema') return 'corte'
  return 'general'
}

const ETAPAS = {
  penal: [
    'Investigación desformalizada', 'Investigación formalizada',
    'Audiencia de control detención', 'Audiencia de formalización',
    'Investigación vigente', 'Preparación juicio oral',
    'Juicio oral', 'Suspensión condicional', 'Procedimiento abreviado',
    'Sentencia', 'Cumplimiento', 'Archivada', 'Sobreseimiento', 'Recurso pendiente',
  ],
  general: [
    'En tramitación', 'Contestación pendiente', 'Prueba',
    'Audiencia preparatoria', 'Audiencia juicio', 'Sentencia pendiente',
    'Cumplimiento', 'Archivada', 'Apelada',
  ],
  corte: [
    'Admitida a tramitación', 'En tabla', 'Vista de la causa',
    'Acuerdo pendiente', 'Fallo pendiente', 'Fallada', 'Ejecutoriada',
  ],
}

const TIPOS_RECURSO = [
  'Apelación', 'Protección', 'Amparo', 'Nulidad', 'Queja', 'Casación', 'Reposición', 'Otro',
]

const PARTE_OPCIONES = {
  penal:   ['Imputado', 'Querellante'],
  general: ['Demandante', 'Demandado'],
  corte:   ['Recurrente', 'Recurrido'],
}

const TODAY_C = new Date().toISOString().slice(0, 10)
const MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function getISOWeek_C(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}

function fmtFechaCausa(iso) {
  if (!iso) return '—'
  try {
    const [,m,d] = iso.split('-').map(Number)
    return `${d} ${MESES_C[m-1]}`
  } catch { return iso }
}

// "hoy" / "mañana" / "ayer" / "hace 3d" / "en 5d"
function fmtRelDate(iso) {
  if (!iso) return null
  const diff = Math.round((new Date(iso.slice(0,10) + 'T00:00:00') - new Date(TODAY_C + 'T00:00:00')) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff === -1) return 'ayer'
  if (diff > 0 && diff <= 30) return `en ${diff}d`
  if (diff < 0 && diff >= -30) return `hace ${-diff}d`
  return fmtFechaCausa(iso)
}

const PROXIMAS_ACCIONES_C = [
  'Revisar PJUD', 'Revisar SIAU', 'Llamar cliente', 'Esperar resolución',
  'Preparar escrito', 'Presentar escrito', 'Insistir fiscalía',
  'Solicitar antecedentes', 'Agendar reunión', 'Revisar documentación',
  'Seguimiento interno', 'Otro',
]

const RESPONSABLE_NAMES_C = { MT: 'Macarena T.', AB: 'Angélica B.', CL: 'Catalina L.' }
const RESPONSABLE_COLORS_C = { MT: '#1a2e4a', AB: '#2570ba', CL: '#059669' }

const ACCION_STYLES_C = {
  'Revisar PJUD':           'bg-violet-50 text-violet-700',
  'Revisar SIAU':           'bg-blue-50 text-blue-700',
  'Llamar cliente':         'bg-amber-50 text-amber-700',
  'Esperar resolución':     'bg-gray-100 text-gray-500',
  'Preparar escrito':       'bg-indigo-50 text-indigo-700',
  'Presentar escrito':      'bg-green-50 text-green-700',
  'Insistir fiscalía':      'bg-red-50 text-red-700',
  'Solicitar antecedentes': 'bg-orange-50 text-orange-600',
  'Agendar reunión':        'bg-cyan-50 text-cyan-700',
  'Revisar documentación':  'bg-slate-50 text-slate-600',
  'Seguimiento interno':    'bg-gray-100 text-gray-500',
  'Otro':                   'bg-gray-50 text-gray-400',
}

const CAUSA_TABS = [
  { key: 'resumen',          label: 'Resumen',          Icon: AlignLeft     },
  { key: 'revision_semanal', label: 'Revisión semanal', Icon: RefreshCw     },
  { key: 'timeline',         label: 'Timeline',         Icon: Activity      },
  { key: 'tareas',           label: 'Tareas',           Icon: CheckSquare   },
  { key: 'plazos',           label: 'Plazos',           Icon: Clock         },
  { key: 'audiencias',       label: 'Audiencias',       Icon: Gavel         },
  { key: 'pjud',             label: 'PJUD',             Icon: Scale         },
  { key: 'siau',             label: 'SIAU',             Icon: MessageSquare },
  { key: 'documentos',       label: 'Documentos',       Icon: FileText      },
  { key: 'seguimiento',      label: 'Seguimiento',      Icon: Target        },
]

// ── Helpers ───────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES['Abierta']
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {estado}
    </span>
  )
}
function AreaBadge({ area }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${AREA_STYLES[area] ?? 'bg-gray-100 text-gray-500'}`}>
      {area}
    </span>
  )
}
function initials(nombre) {
  return (nombre || 'CS').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
function parteOpciones(area) {
  return area === 'Penal' ? ['Imputado', 'Querellante'] : ['Demandante', 'Demandado']
}
function formatFecha(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

/** Convierte fila Supabase → objeto UI */
function mapCausa(row) {
  return {
    id:               row.id,
    cliente_id:       row.cliente_id       ?? null,
    cliente_nombre:   row.cliente_nombre   ?? '',
    parte:            row.parte            ?? 'Imputado',
    rit:              row.rit              ?? null,
    ruc:              row.ruc              ?? null,
    tribunal:         row.tribunal         ?? '',
    fiscalia:         row.fiscalia         ?? null,
    fiscal:           row.fiscal           ?? null,
    area:             row.area             ?? 'Penal',
    materia:          row.materia          ?? '',
    estado:           row.estado           ?? 'Abierta',
    etapa_procesal:   row.etapa_procesal   ?? null,
    tipo_recurso:     row.tipo_recurso     ?? null,
    causa_origen_rit: row.causa_origen_rit ?? null,
    observaciones:    row.observaciones    ?? '',
    fecha_inicio:     row.fecha_inicio     ?? null,
    created_at:       row.created_at       ?? null,
    // Campos derivados (sin columna en DB)
    historial:       [],
    tareas:          [],
    audiencias:      [],
    documentos:      [],
    escritos:        [],
    reuniones:       [],
  }
}

/** Convierte formulario → payload Supabase */
function mapToDb(form) {
  return {
    cliente_id:       form.cliente_id                         || null,
    cliente_nombre:   (form.cliente_nombre   || '').trim(),
    area:             form.area,
    parte:            form.parte,
    rit:              (form.rit              || '').trim()    || null,
    ruc:              (form.ruc              || '').trim()    || null,
    materia:          (form.materia          || '').trim()    || null,
    tribunal:         (form.tribunal         || '').trim(),
    fiscalia:         (form.fiscalia         || '').trim()    || null,
    fiscal:           (form.fiscal           || '').trim()    || null,
    etapa_procesal:   (form.etapa_procesal   || '').trim()    || null,
    tipo_recurso:     (form.tipo_recurso     || '').trim()    || null,
    causa_origen_rit: (form.causa_origen_rit || '').trim()    || null,
    estado:           form.estado,
    observaciones:    (form.observaciones    || '').trim()    || null,
  }
}

// ── Carga ─────────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
      <Loader2 size={22} className="animate-spin text-gray-300" />
      <span className="text-sm">Cargando causas…</span>
    </div>
  )
}

// ── Selector de cliente con búsqueda ─────────────────────────────────────
function ClienteSelector({ clientes, value, onChange, onCrearCliente }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtrados = useMemo(() => {
    if (!query.trim()) return clientes
    const q = query.toLowerCase()
    return clientes.filter(c =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.rut    || '').toLowerCase().includes(q)
    )
  }, [clientes, query])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs border rounded-lg transition-all bg-white ${
          open
            ? 'border-[#2570ba] ring-1 ring-[#2570ba]/20'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        {value ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-[#1a2e4a]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-[#1a2e4a]">{initials(value.nombre)}</span>
            </div>
            <span className="text-xs text-gray-800 truncate font-medium">{value.nombre}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">Seleccionar cliente…</span>
        )}
        <ChevronDown
          size={11}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl shadow-black/5 z-50 overflow-hidden">
          {/* Búsqueda */}
          <div className="p-2 border-b border-gray-50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nombre o RUT…"
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 rounded-lg outline-none focus:bg-white border border-transparent focus:border-[#2570ba]/30 transition-all placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-52 overflow-y-auto py-1">
            {clientes.length === 0 ? (
              <div className="px-4 py-6 text-center space-y-2.5">
                <p className="text-xs text-gray-400">No existen clientes creados todavía</p>
                <button
                  type="button"
                  onClick={onCrearCliente}
                  className="text-xs font-semibold text-[#2570ba] hover:underline flex items-center gap-1 mx-auto"
                >
                  <Plus size={11} /> Crear cliente
                </button>
              </div>
            ) : filtrados.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-gray-400">Sin resultados para "{query}"</p>
              </div>
            ) : (
              filtrados.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setQuery('') }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    value?.id === c.id ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[#1a2e4a]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-[#1a2e4a]">{initials(c.nombre)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 truncate font-medium">{c.nombre}</p>
                    {c.rut && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{c.rut}</p>}
                  </div>
                  {value?.id === c.id && <Check size={11} className="text-[#2570ba] flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers de formulario ─────────────────────────────────────────────────
function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, mono }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>}
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300 ${mono ? 'font-mono' : ''}`} />
    </div>
  )
}

function PillSelector({ label, value, onChange, options }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>}
      <div className="flex gap-1.5">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
              value === opt ? 'border-[#1a2e4a] bg-[#1a2e4a] text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function SelectDropdown({ label, value, onChange, options, placeholder = 'Seleccionar…', clearable }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>}
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-3 py-2 text-xs border rounded-lg transition-all bg-white ${
            open ? 'border-[#2570ba] ring-1 ring-[#2570ba]/20' : 'border-gray-200 hover:border-gray-300'
          }`}>
          <span className={value ? 'text-gray-800' : 'text-gray-300'}>{value || placeholder}</span>
          <ChevronDown size={11} className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl shadow-black/5 z-50 overflow-hidden">
            <div className="max-h-52 overflow-y-auto py-1">
              {clearable && value && (
                <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                  className="w-full px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-1.5">
                  <X size={10} /> Ninguno
                </button>
              )}
              {options.map(opt => (
                <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    value === opt ? 'bg-blue-50/60 text-[#1a2e4a] font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  {opt}
                  {value === opt && <Check size={11} className="text-[#2570ba] flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AreaSelector({ value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Área jurídica *</label>
      <div className="grid grid-cols-2 gap-1.5">
        {AREAS.map(area => {
          const sel   = value === area
          const group = getAreaGroup(area)
          const cls   = sel
            ? group === 'penal'  ? 'border-red-500 bg-red-500 text-white'
            : group === 'corte'  ? 'border-indigo-500 bg-indigo-500 text-white'
            : 'border-[#1a2e4a] bg-[#1a2e4a] text-white'
            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50/80'
          return (
            <button key={area} type="button" onClick={() => onChange(area)}
              className={`py-1.5 px-2.5 text-xs font-medium rounded-lg border transition-all text-left ${cls}`}>
              {area}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CausaOrigenSelector({ value, onChange, causas }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const filtradas = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return causas.slice(0, 20)
    return causas.filter(c =>
      (c.rit || '').toLowerCase().includes(q) ||
      (c.materia || '').toLowerCase().includes(q) ||
      c.cliente_nombre.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [causas, query])
  const selected = causas.find(c => (c.rit || c.id) === value)
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1">Causa de origen vinculada</label>
      <div ref={ref} className="relative">
        <button type="button" onClick={() => { setOpen(o => !o); setQuery('') }}
          className={`w-full flex items-center justify-between px-3 py-2 text-xs border rounded-lg transition-all bg-white ${
            open ? 'border-[#2570ba] ring-1 ring-[#2570ba]/20' : 'border-gray-200 hover:border-gray-300'
          }`}>
          {selected ? (
            <div className="flex-1 min-w-0 text-left flex items-center gap-2">
              <span className="text-xs text-gray-800 font-medium truncate">{selected.cliente_nombre}</span>
              {selected.rit && <span className="font-mono text-[10px] text-violet-500">{selected.rit}</span>}
              <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${AREA_STYLES[selected.area] ?? 'bg-gray-100 text-gray-500'}`}>{selected.area}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-300">Vincular causa de origen (opcional)…</span>
          )}
          <ChevronDown size={11} className={`text-gray-400 flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-gray-50">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por cliente, RIT o materia…"
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 rounded-lg outline-none border border-transparent focus:border-[#2570ba]/30 transition-all placeholder:text-gray-300" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {value && (
                <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                  className="w-full px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-1.5 border-b border-gray-50">
                  <X size={10} /> Quitar vínculo
                </button>
              )}
              {filtradas.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400 text-center">Sin causas encontradas</p>
              ) : filtradas.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { onChange(c.rit || c.id); setOpen(false); setQuery('') }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                    value === (c.rit || c.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                  }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 font-medium truncate">{c.cliente_nombre}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {c.materia}
                      {c.rit && <span className="font-mono ml-1.5 text-violet-500">{c.rit}</span>}
                    </p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${AREA_STYLES[c.area] ?? 'bg-gray-100 text-gray-500'}`}>{c.area}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Formulario nueva / editar causa (dinámico por área) ───────────────────
function FormCausa({ inicial, onClose, onGuardar, guardando, clientes = [], onCrearCliente, causas = [] }) {
  const esEdicion = !!inicial?.id
  const [form, setForm] = useState({
    cliente_id: null, cliente_nombre: '',
    area: 'Penal', parte: 'Imputado',
    rit: '', ruc: '', materia: '', tribunal: '', fiscalia: '', fiscal: '',
    etapa_procesal: '', tipo_recurso: '', causa_origen_rit: '',
    estado: 'Abierta', observaciones: '',
    ...inicial,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const areaGroup = getAreaGroup(form.area)

  // Cliente seleccionado
  const [clienteObj, setClienteObj] = useState(() => {
    if (!inicial) return null
    return clientes.find(c => c.id === inicial.cliente_id) ||
           (inicial.cliente_nombre ? { id: inicial.cliente_id || null, nombre: inicial.cliente_nombre, rut: '' } : null)
  })
  useEffect(() => {
    if (inicial?.cliente_id && !clienteObj?.rut) {
      const c = clientes.find(c => c.id === inicial.cliente_id)
      if (c) setClienteObj(c)
    }
  }, [clientes]) // eslint-disable-line

  const handleSelectCliente = c => {
    setClienteObj(c)
    setForm(f => ({ ...f, cliente_id: c.id, cliente_nombre: c.nombre }))
  }

  const handleAreaChange = newArea => {
    const newGroup = getAreaGroup(newArea)
    const oldGroup = getAreaGroup(form.area)
    setForm(f => ({
      ...f,
      area:           newArea,
      etapa_procesal: oldGroup !== newGroup ? '' : f.etapa_procesal,
      parte: PARTE_OPCIONES[newGroup].includes(f.parte) ? f.parte : PARTE_OPCIONES[newGroup][0],
      ...(newGroup !== 'penal'  ? { ruc: '', fiscal: '', fiscalia: '' } : {}),
      ...(newGroup !== 'corte'  ? { tipo_recurso: '', causa_origen_rit: '' } : {}),
    }))
  }

  return (
    <div className="w-[340px] flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{esEdicion ? 'Editar causa' : 'Nueva causa'}</p>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {/* ── Cliente ── */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Cliente *</label>
          <ClienteSelector clientes={clientes} value={clienteObj} onChange={handleSelectCliente} onCrearCliente={onCrearCliente} />
          {!clienteObj && <p className="mt-1 text-[10px] text-gray-300">Selecciona un cliente para continuar</p>}
        </div>

        {/* ── Área jurídica ── */}
        <AreaSelector value={form.area} onChange={handleAreaChange} />

        {/* ── Campos PENAL ── */}
        {areaGroup === 'penal' && (<>
          <SectionDivider label="Identificación" />
          <div className="grid grid-cols-2 gap-2">
            <FormInput label="RUC" value={form.ruc} onChange={v => set('ruc', v)} placeholder="0-1234-2025-0" mono />
            <FormInput label="RIT" value={form.rit} onChange={v => set('rit', v)} placeholder="O-1234-2025" mono />
          </div>
          <FormInput label="Materia / Delito" value={form.materia} onChange={v => set('materia', v)} placeholder="Robo con violencia, lesiones, etc." />
          <FormInput label="Fiscal" value={form.fiscal} onChange={v => set('fiscal', v)} placeholder="Nombre del fiscal a cargo" />
          <SectionDivider label="Tribunal" />
          <FormInput label="Tribunal" value={form.tribunal} onChange={v => set('tribunal', v)} placeholder="Tribunal de Garantía de Santiago" />
          <FormInput label="Fiscalía" value={form.fiscalia} onChange={v => set('fiscalia', v)} placeholder="Fiscalía Centro Norte" />
        </>)}

        {/* ── Campos GENERAL (Familia / Laboral / Civil / JPL / Administrativo) ── */}
        {areaGroup === 'general' && (<>
          <SectionDivider label="Identificación" />
          <FormInput label="Tribunal" value={form.tribunal} onChange={v => set('tribunal', v)} placeholder="Juzgado de Letras del Trabajo N°1" />
          <FormInput label="Rol" value={form.rit} onChange={v => set('rit', v)} placeholder="O-1234-2025" mono />
          <FormInput label="Caratulado" value={form.materia} onChange={v => set('materia', v)} placeholder="González con Empresa S.A." />
        </>)}

        {/* ── Campos CORTE (Corte de Apelaciones / Corte Suprema) ── */}
        {areaGroup === 'corte' && (<>
          <SectionDivider label="Identificación" />
          <FormInput label="Tribunal" value={form.tribunal} onChange={v => set('tribunal', v)} placeholder="Corte de Apelaciones de Santiago" />
          <FormInput label="Rol Corte" value={form.rit} onChange={v => set('rit', v)} placeholder="123-2025" mono />
          <FormInput label="Caratulado" value={form.materia} onChange={v => set('materia', v)} placeholder="González con Empresa S.A." />
          <SelectDropdown label="Tipo de recurso" value={form.tipo_recurso} onChange={v => set('tipo_recurso', v)} options={TIPOS_RECURSO} placeholder="Seleccionar tipo…" clearable />
          <SectionDivider label="Causa de origen" />
          <CausaOrigenSelector value={form.causa_origen_rit} onChange={v => set('causa_origen_rit', v)}
            causas={causas.filter(c => getAreaGroup(c.area) !== 'corte')} />
        </>)}

        {/* ── Proceso (todas las áreas) ── */}
        <SectionDivider label="Proceso" />
        <SelectDropdown label="Etapa procesal" value={form.etapa_procesal}
          onChange={v => set('etapa_procesal', v)} options={ETAPAS[areaGroup]}
          placeholder="Seleccionar etapa…" clearable />
        <PillSelector label="Parte" value={form.parte} onChange={v => set('parte', v)} options={PARTE_OPCIONES[areaGroup]} />

        {/* ── Estado ── */}
        <SectionDivider label="Estado" />
        <SelectDropdown value={form.estado} onChange={v => set('estado', v)} options={ESTADOS} />

        {/* ── Observaciones ── */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
            rows={3} placeholder="Notas internas…"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300 resize-none" />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        <button onClick={onClose} disabled={guardando}
          className="flex-1 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          Cancelar
        </button>
        <button onClick={() => onGuardar(form)}
          disabled={guardando || !clienteObj}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1a2e4a' }}>
          {guardando && <Loader2 size={11} className="animate-spin" />}
          {esEdicion ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── CausaView — Vista completa de expediente jurídico ──────────────────────
function CausaView({ causa, onClose, onEdit, onDelete }) {
  const [tab, setTab]               = useState('resumen')
  const [confirmDelete, setConfirm] = useState(false)

  // Data states
  const [audiencias,    setAudiencias]    = useState([])
  const [tareas,        setTareas]        = useState([])
  const [plazos,        setPlazos]        = useState([])
  const [pjudRows,      setPjudRows]      = useState([])
  const [siauRows,      setSiauRows]      = useState([])
  const [revisiones,    setRevisiones]    = useState([])

  // Loading states
  const [loadingBase,   setLoadingBase]   = useState(false)
  const [loadingPjud,   setLoadingPjud]   = useState(false)
  const [loadingSiau,   setLoadingSiau]   = useState(false)
  const [loadingRev,    setLoadingRev]    = useState(false)

  // Revision form & edit
  const [showRevForm,   setShowRevForm]   = useState(false)
  const [revDraft,      setRevDraft]      = useState({ nota: '', proxima_accion: 'Esperar resolución', responsable: 'MT', urgente: false })
  const [savingRev,     setSavingRev]     = useState(false)
  const [editRevId,     setEditRevId]     = useState(null)
  const [editRevDraft,  setEditRevDraft]  = useState(null)
  const [savingEditRev, setSavingEditRev] = useState(false)
  const [tareaFromRev,  setTareaFromRev]  = useState(null) // { revId, titulo, fecha }
  const [savingTarea,   setSavingTarea]   = useState(false)
  const [toastMsg,      setToastMsg]      = useState(null)

  // Seguimiento personal
  const [segDraft,        setSegDraft]        = useState({ por_hacer: '', que_se_hizo: '', estado_seg: 'Pendiente', proxima_accion: '', notas: '', responsable: 'MT' })
  const [savingSeg,       setSavingSeg]       = useState(false)
  const [showSegCarga,    setShowSegCarga]    = useState(false)

  // Datos rápidos para el resumen (1 fila c/u)
  const [lastPjud,        setLastPjud]        = useState(undefined) // undefined = loading, null = empty
  const [lastSiau,        setLastSiau]        = useState(undefined)
  const [lastRevision,    setLastRevision]    = useState(undefined)

  // Timeline filter
  const [filterTimeline,  setFilterTimeline]  = useState('Todo')

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // Load audiencias + tareas + plazos on mount
  useEffect(() => {
    if (!causa?.id) return
    setLoadingBase(true)
    Promise.all([
      supabase.from('audiencias').select('*').eq('causa_id', causa.id).order('fecha', { ascending: false }),
      supabase.from('tareas').select('*').eq('causa_id', causa.id).order('fecha_vencimiento'),
      supabase.from('plazos').select('*').eq('causa_id', causa.id).order('fecha_vencimiento'),
    ]).then(([{ data: a }, { data: t }, { data: p }]) => {
      setAudiencias(a ?? [])
      setTareas(t ?? [])
      setPlazos(p ?? [])
      setLoadingBase(false)
    })
    // Load last PJUD / SIAU / Revision for resumen dashboard (1 row each)
    if (causa.rit) {
      supabase.from('pjud').select('fecha,folio,estado,solicitud,respuesta').eq('causa_rit', causa.rit)
        .order('fecha', { ascending: false }).limit(1)
        .then(({ data }) => setLastPjud(data?.[0] ?? null))
      supabase.from('siau').select('fecha,folio,estado,solicitud,respuesta').eq('causa_rit', causa.rit)
        .order('fecha', { ascending: false }).limit(1)
        .then(({ data }) => setLastSiau(data?.[0] ?? null))
    } else {
      setLastPjud(null); setLastSiau(null)
    }
    supabase.from('revisiones').select('fecha,responsable,nota,proxima_accion,semana_key').eq('causa_id', causa.id)
      .order('fecha', { ascending: false }).limit(3)
      .then(({ data }) => {
        const teamRev = (data ?? []).find(r => !r.semana_key?.startsWith('SEG-'))
        setLastRevision(teamRev ?? null)
      })
  }, [causa?.id])

  // Load PJUD lazily (also for timeline)
  useEffect(() => {
    if ((tab !== 'pjud' && tab !== 'timeline') || !causa?.rit) return
    if (pjudRows.length > 0) return
    setLoadingPjud(true)
    supabase.from('pjud').select('*').eq('causa_rit', causa.rit).order('fecha', { ascending: false })
      .then(({ data }) => { setPjudRows(data ?? []); setLoadingPjud(false) })
  }, [tab, causa?.rit])

  // Load SIAU lazily (also for timeline)
  useEffect(() => {
    if ((tab !== 'siau' && tab !== 'timeline') || !causa?.rit) return
    if (siauRows.length > 0) return
    setLoadingSiau(true)
    supabase.from('siau').select('*').eq('causa_rit', causa.rit).order('fecha', { ascending: false })
      .then(({ data }) => { setSiauRows(data ?? []); setLoadingSiau(false) })
  }, [tab, causa?.rit])

  // Load revisiones when tab opens (or on mount for timeline)
  useEffect(() => {
    if ((tab !== 'revision_semanal' && tab !== 'timeline' && tab !== 'seguimiento') || !causa?.id) return
    if (revisiones.length > 0) return // already loaded
    setLoadingRev(true)
    supabase.from('revisiones').select('*').eq('causa_id', causa.id).order('fecha', { ascending: false })
      .then(({ data }) => { setRevisiones(data ?? []); setLoadingRev(false) })
  }, [tab, causa?.id])

  // Pre-fill segDraft with current week's seguimiento entry
  useEffect(() => {
    if (tab !== 'seguimiento') return
    const weekNum = getISOWeek_C(TODAY_C)
    const year = new Date().getFullYear()
    const semana_key = `SEG-${year}-W${String(weekNum).padStart(2, '0')}`
    const current = revisiones.find(r => r.semana_key === semana_key)
    if (current) {
      setSegDraft({
        por_hacer:      current.por_hacer      || '',
        que_se_hizo:    current.que_se_hizo    || '',
        estado_seg:     current.estado_seg     || 'Pendiente',
        proxima_accion: current.proxima_accion || '',
        notas:          current.nota           || '',
        responsable:    current.responsable    || 'MT',
      })
    } else {
      setSegDraft({ por_hacer: '', que_se_hizo: '', estado_seg: 'Pendiente', proxima_accion: '', notas: '', responsable: 'MT' })
    }
  }, [tab, revisiones])

  // Save new revision
  async function handleSaveRevision() {
    if (!revDraft.nota.trim()) return
    setSavingRev(true)
    const today = new Date().toISOString().slice(0, 10)
    const weekNum = getISOWeek_C(today)
    const year = new Date().getFullYear()
    const semana_key = `${year}-W${String(weekNum).padStart(2, '0')}`
    const payload = {
      causa_id: causa.id,
      semana_key,
      revisada: true,
      nota: revDraft.nota.trim(),
      proxima_accion: revDraft.proxima_accion,
      responsable: revDraft.responsable,
      urgente: revDraft.urgente,
      fecha: today,
    }
    const { data, error } = await supabase.from('revisiones')
      .upsert(payload, { onConflict: 'semana_key,causa_id' })
      .select().single()
    if (!error && data) {
      setRevisiones(prev => [data, ...prev.filter(r => r.id !== data.id)])
      showToast('Revisión guardada')
    }
    setShowRevForm(false)
    setRevDraft({ nota: '', proxima_accion: 'Esperar resolución', responsable: 'MT', urgente: false })
    setSavingRev(false)
  }

  // Save seguimiento personal
  async function handleSaveSeg() {
    setSavingSeg(true)
    const today = TODAY_C
    const weekNum = getISOWeek_C(today)
    const year = new Date().getFullYear()
    const semana_key = `SEG-${year}-W${String(weekNum).padStart(2, '0')}`
    const payload = {
      causa_id:       causa.id,
      semana_key,
      fecha:          today,
      por_hacer:      segDraft.por_hacer.trim(),
      que_se_hizo:    segDraft.que_se_hizo.trim(),
      estado_seg:     segDraft.estado_seg,
      proxima_accion: segDraft.proxima_accion.trim(),
      nota:           segDraft.notas.trim(),
      responsable:    segDraft.responsable,
      revisada:       false,
    }
    const { data, error } = await supabase.from('revisiones')
      .upsert(payload, { onConflict: 'semana_key,causa_id' })
      .select().single()
    if (!error && data) {
      setRevisiones(prev => [data, ...prev.filter(r => r.semana_key !== semana_key)])
      showToast('Seguimiento guardado ✓')
    }
    setSavingSeg(false)
  }

  // Save edited revision
  async function handleSaveEditRevision() {
    if (!editRevDraft?.nota?.trim()) return
    setSavingEditRev(true)
    const { data, error } = await supabase.from('revisiones')
      .update({
        nota: editRevDraft.nota.trim(),
        proxima_accion: editRevDraft.proxima_accion,
        responsable: editRevDraft.responsable,
        urgente: editRevDraft.urgente,
      })
      .eq('id', editRevId)
      .select().single()
    if (!error && data) {
      setRevisiones(prev => prev.map(r => r.id === data.id ? data : r))
      showToast('Revisión actualizada')
    }
    setEditRevId(null)
    setEditRevDraft(null)
    setSavingEditRev(false)
  }

  // Toggle urgente flag directly
  async function handleToggleUrgente(rev) {
    const { data } = await supabase.from('revisiones')
      .update({ urgente: !rev.urgente })
      .eq('id', rev.id)
      .select().single()
    if (data) setRevisiones(prev => prev.map(r => r.id === data.id ? data : r))
  }

  // Generar tarea desde revisión
  async function handleGenerarTarea() {
    if (!tareaFromRev?.titulo?.trim()) return
    setSavingTarea(true)
    const payload = {
      causa_id: causa.id,
      titulo: tareaFromRev.titulo.trim(),
      descripcion: `Generada desde revisión semanal`,
      estado: 'Pendiente',
      prioridad: 'Media',
      fecha_vencimiento: tareaFromRev.fecha || null,
    }
    const { data, error } = await supabase.from('tareas').insert([payload]).select().single()
    if (!error && data) {
      setTareas(prev => [...prev, data])
      showToast('Tarea creada correctamente')
    }
    setTareaFromRev(null)
    setSavingTarea(false)
  }

  const proxAudiencia = audiencias
    .filter(a => a.fecha >= TODAY_C)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
  const proxPlazo = plazos
    .filter(p => p.fecha_vencimiento >= TODAY_C && p.estado !== 'Vencido')
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]
  const tareasPend = tareas.filter(t => t.estado !== 'Completada').length

  return (
    <>
    <div className="flex-1 min-w-0 flex flex-col h-full bg-white overflow-hidden">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2e4a] text-white text-[12px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <Check size={12} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-8 pt-6 pb-0 border-b border-gray-100">

        {/* Back + actions */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors group"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Volver a causas
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Pencil size={11} /> Editar
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirm(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-red-700 font-medium">¿Eliminar?</span>
                <button onClick={onDelete} className="text-[11px] font-semibold text-red-600 hover:text-red-800">Sí</button>
                <button onClick={() => setConfirm(false)} className="text-[11px] text-gray-400 hover:text-gray-600 ml-1">No</button>
              </div>
            )}
          </div>
        </div>

        {/* Client label + materia */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{causa.cliente_nombre}</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-snug">{causa.materia}</h1>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <AreaBadge area={causa.area} />
          <EstadoBadge estado={causa.estado} />
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{causa.parte}</span>
          {causa.etapa_procesal && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
              {causa.etapa_procesal}
            </span>
          )}
          {causa.rit && (
            <span className="font-mono text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded">
              RIT {causa.rit}
            </span>
          )}
          {causa.ruc && (
            <span className="font-mono text-[11px] font-semibold bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded">
              RUC {causa.ruc}
            </span>
          )}
        </div>

        {/* Info row: tribunal + fiscalía + fiscal + alertas */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {causa.tribunal && (
            <div className="flex items-center gap-1.5">
              <Gavel size={11} className="text-gray-300 flex-shrink-0" />
              <span className="text-[12px] text-gray-600">{causa.tribunal}</span>
            </div>
          )}
          {causa.fiscalia && (
            <div className="flex items-center gap-1.5">
              <Scale size={11} className="text-gray-300 flex-shrink-0" />
              <span className="text-[12px] text-gray-600">{causa.fiscalia}</span>
            </div>
          )}
          {causa.fiscal && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
              <UserCheck size={10} className="text-slate-400 flex-shrink-0" />
              <span className="text-[11px] text-slate-600 font-medium">Fiscal: {causa.fiscal}</span>
            </div>
          )}
          {proxAudiencia && (
            <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg">
              <Calendar size={10} className="text-purple-400 flex-shrink-0" />
              <span className="text-[11px] font-medium text-purple-700">
                Próx. audiencia: {fmtFechaCausa(proxAudiencia.fecha)}
                {proxAudiencia.hora ? ` · ${proxAudiencia.hora}` : ''}
              </span>
            </div>
          )}
          {proxPlazo && (() => {
            const dias = Math.round((new Date(proxPlazo.fecha_vencimiento) - new Date(TODAY_C)) / 86400000)
            const urgente = dias <= 5
            return (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${urgente ? 'bg-red-50' : 'bg-amber-50'}`}>
                <Clock size={10} className={urgente ? 'text-red-400 flex-shrink-0' : 'text-amber-400 flex-shrink-0'} />
                <span className={`text-[11px] font-medium ${urgente ? 'text-red-700' : 'text-amber-700'}`}>
                  Plazo crítico: {fmtFechaCausa(proxPlazo.fecha_vencimiento)}
                  {dias === 0 ? ' · hoy' : dias === 1 ? ' · mañana' : ` · ${dias}d`}
                </span>
              </div>
            )
          })()}
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 pb-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <Gavel size={10} className="text-gray-300" />
            {audiencias.length} audiencias
          </span>
          <span className="flex items-center gap-1.5">
            <CheckSquare size={10} className="text-gray-300" />
            {tareasPend} tareas pendientes
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={10} className="text-gray-300" />
            {plazos.filter(p => p.estado === 'Activo').length} plazos activos
          </span>
          {revisiones.length > 0 && (
            <span className="flex items-center gap-1.5">
              <RefreshCw size={10} className="text-gray-300" />
              {revisiones.length} revisiones
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CAUSA_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                tab === t.key
                  ? 'border-[#1a2e4a] text-[#1a2e4a]'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              <t.Icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto">

        {/* RESUMEN — Centro de Causa */}
        {tab === 'resumen' && (() => {
          // ── Derived data ──────────────────────────────────────────────────
          const proxAud    = audiencias.filter(a => a.fecha >= TODAY_C).sort((a,b) => a.fecha.localeCompare(b.fecha))[0] ?? null
          const proxPlazo  = plazos.filter(p => p.fecha_vencimiento >= TODAY_C).sort((a,b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0] ?? null
          const lastTarea  = tareas.filter(t => t.estado !== 'Completada').sort((a,b) => {
            if (a.prioridad === 'Alta' && b.prioridad !== 'Alta') return -1
            if (b.prioridad === 'Alta' && a.prioridad !== 'Alta') return 1
            return (a.fecha_vencimiento ?? '9999').localeCompare(b.fecha_vencimiento ?? '9999')
          })[0] ?? null

          const plazosDias = proxPlazo ? Math.round((new Date(proxPlazo.fecha_vencimiento + 'T00:00:00') - new Date(TODAY_C + 'T00:00:00')) / 86400000) : null
          const audDias    = proxAud   ? Math.round((new Date(proxAud.fecha + 'T00:00:00') - new Date(TODAY_C + 'T00:00:00')) / 86400000) : null

          // urgency helpers
          const plazoUrgente = plazosDias !== null && plazosDias <= 2
          const audUrgente   = audDias    !== null && audDias    <= 1
          const pjudUrgente  = lastPjud?.estado === 'Urgente'
          const siauUrgente  = lastSiau?.estado  === 'Urgente'
          const tareaUrgente = lastTarea?.prioridad === 'Alta' || (lastTarea?.fecha_vencimiento && lastTarea.fecha_vencimiento <= TODAY_C)

          // ── PulsoCard ──────────────────────────────────────────────────────
          function PulsoCard({ icon: Icon, label, iconColor, main, sub, badge, urgent, empty, loading, onClick }) {
            return (
              <button
                onClick={onClick}
                className={`text-left w-full p-3.5 rounded-xl border transition-all duration-150 group focus:outline-none ${
                  urgent
                    ? 'bg-red-50/60 border-red-100 hover:border-red-200 hover:bg-red-50'
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest ${urgent ? 'text-red-400' : iconColor}`}>
                    <Icon size={9} />
                    {label}
                  </div>
                  {badge && <div className="flex-shrink-0">{badge}</div>}
                </div>
                {loading ? (
                  <div className="space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/2" />
                  </div>
                ) : empty ? (
                  <p className="text-[11px] text-gray-300">Sin registros</p>
                ) : (
                  <>
                    <p className={`text-[12px] font-medium leading-snug line-clamp-2 ${urgent ? 'text-red-800' : 'text-gray-800'}`}>{main}</p>
                    {sub && <p className={`text-[10px] mt-0.5 ${urgent ? 'text-red-400' : 'text-gray-400'}`}>{sub}</p>}
                  </>
                )}
              </button>
            )
          }

          // ── Estado mini-badge ──────────────────────────────────────────────
          function MiniEstado({ estado, urgent }) {
            if (!estado) return null
            const colors = urgent
              ? 'bg-red-100 text-red-700'
              : estado.toLowerCase().includes('pend')   ? 'bg-amber-50 text-amber-600'
              : estado.toLowerCase().includes('respond') ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'
            return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${colors}`}>{estado}</span>
          }

          return (
          <div className="px-6 py-6 space-y-6">

            {/* ── PULSO OPERATIVO ─────────────────────────────────────── */}
            <div>
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">
                Pulso operativo
              </p>
              <div className="grid grid-cols-3 gap-2.5">

                {/* PJUD */}
                <PulsoCard
                  icon={Scale}
                  label="PJUD"
                  iconColor="text-blue-400"
                  urgent={pjudUrgente}
                  loading={lastPjud === undefined}
                  empty={lastPjud === null}
                  main={lastPjud?.solicitud || lastPjud?.folio || '—'}
                  sub={[lastPjud?.estado, fmtRelDate(lastPjud?.fecha)].filter(Boolean).join(' · ')}
                  badge={lastPjud && <MiniEstado estado={lastPjud.estado} urgent={pjudUrgente} />}
                  onClick={() => setTab('pjud')}
                />

                {/* SIAU */}
                <PulsoCard
                  icon={MessageSquare}
                  label="SIAU"
                  iconColor="text-violet-400"
                  urgent={siauUrgente}
                  loading={lastSiau === undefined}
                  empty={lastSiau === null}
                  main={lastSiau?.solicitud || lastSiau?.folio || '—'}
                  sub={[lastSiau?.estado, fmtRelDate(lastSiau?.fecha)].filter(Boolean).join(' · ')}
                  badge={lastSiau && <MiniEstado estado={lastSiau.estado} urgent={siauUrgente} />}
                  onClick={() => setTab('siau')}
                />

                {/* Audiencia */}
                <PulsoCard
                  icon={Gavel}
                  label="Próxima audiencia"
                  iconColor="text-purple-400"
                  urgent={audUrgente}
                  loading={loadingBase}
                  empty={!proxAud}
                  main={proxAud?.tipo || 'Audiencia'}
                  sub={proxAud ? [fmtFechaCausa(proxAud.fecha), proxAud.hora].filter(Boolean).join(' · ') + (audDias === 0 ? ' — hoy' : audDias === 1 ? ' — mañana' : '') : null}
                  badge={proxAud && audDias !== null && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${audUrgente ? 'bg-red-100 text-red-700' : 'bg-purple-50 text-purple-600'}`}>
                      {audDias === 0 ? 'Hoy' : audDias === 1 ? 'Mañana' : `${audDias}d`}
                    </span>
                  )}
                  onClick={() => setTab('audiencias')}
                />

                {/* Plazo */}
                <PulsoCard
                  icon={Clock}
                  label="Próximo plazo"
                  iconColor="text-amber-400"
                  urgent={plazoUrgente}
                  loading={loadingBase}
                  empty={!proxPlazo}
                  main={proxPlazo?.titulo || '—'}
                  sub={proxPlazo ? `Vence ${fmtRelDate(proxPlazo.fecha_vencimiento)}` : null}
                  badge={proxPlazo && plazosDias !== null && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${plazoUrgente ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-600'}`}>
                      {plazosDias === 0 ? 'Hoy' : `${plazosDias}d`}
                    </span>
                  )}
                  onClick={() => setTab('plazos')}
                />

                {/* Revisión */}
                <PulsoCard
                  icon={RefreshCw}
                  label="Última revisión"
                  iconColor="text-teal-400"
                  loading={lastRevision === undefined}
                  empty={lastRevision === null}
                  main={lastRevision?.nota?.slice(0, 80) || 'Sin nota'}
                  sub={[lastRevision?.responsable, fmtRelDate(lastRevision?.fecha)].filter(Boolean).join(' · ')}
                  onClick={() => setTab('revision_semanal')}
                />

                {/* Tarea */}
                <PulsoCard
                  icon={CheckSquare}
                  label="Tarea pendiente"
                  iconColor="text-indigo-400"
                  urgent={tareaUrgente}
                  loading={loadingBase}
                  empty={!lastTarea}
                  main={lastTarea?.titulo || '—'}
                  sub={lastTarea ? [lastTarea.prioridad === 'Alta' ? '🔴 Alta prioridad' : null, lastTarea.fecha_vencimiento ? `vence ${fmtRelDate(lastTarea.fecha_vencimiento)}` : null].filter(Boolean).join(' · ') : null}
                  badge={lastTarea && tareasPend > 1 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">+{tareasPend - 1}</span>
                  )}
                  onClick={() => setTab('tareas')}
                />
              </div>
            </div>

            {/* ── INFORMACIÓN PROCESAL ───────────────────────────────── */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">
                  Información procesal
                </p>
                <div className="space-y-2.5">
                  {[
                    ['RIT',      causa.rit,            true],
                    ['RUC',      causa.ruc,            true],
                    ['Tribunal', causa.tribunal,       false],
                    ['Fiscalía', causa.fiscalia,       false],
                    ['Fiscal',   causa.fiscal,         false],
                    ['Etapa',    causa.etapa_procesal, false],
                    ['Parte',    causa.parte,          false],
                    ['Inicio',   formatFecha(causa.fecha_inicio ?? causa.created_at), false],
                  ].filter(([,v]) => v).map(([label, val, mono]) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-16 flex-shrink-0 pt-0.5">{label}</span>
                      <span className={`text-[12px] text-gray-700 leading-snug ${mono ? 'font-mono' : ''}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                {causa.observaciones && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">Observaciones</p>
                    <p className="text-[12px] text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3.5">
                      {causa.observaciones}
                    </p>
                  </div>
                )}

                {/* Tareas pendientes compactas */}
                {tareasPend > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Tareas pendientes</p>
                      <button onClick={() => setTab('tareas')} className="text-[10px] text-[#1a2e4a]/50 hover:text-[#1a2e4a] transition-colors">Ver todas →</button>
                    </div>
                    <div className="space-y-1">
                      {tareas.filter(t => t.estado !== 'Completada').slice(0, 4).map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.prioridad === 'Alta' ? 'bg-red-400' : 'bg-amber-300'}`} />
                          <p className="text-[11px] text-gray-700 flex-1 truncate">{t.titulo}</p>
                          {t.fecha_vencimiento && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtFechaCausa(t.fecha_vencimiento)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          )
        })()}

        {/* REVISIÓN SEMANAL */}
        {tab === 'revision_semanal' && (
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900">Bitácora de revisiones</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Historial semanal de seguimiento · {revisiones.length} registros
                </p>
              </div>
              {!showRevForm && (
                <button
                  onClick={() => setShowRevForm(true)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-2 rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#1a2e4a' }}
                >
                  <Plus size={12} /> Nueva revisión
                </button>
              )}
            </div>

            {/* New revision form */}
            {showRevForm && (
              <div className="mb-7 bg-[#1a2e4a]/[0.025] border border-[#1a2e4a]/10 rounded-2xl p-5 space-y-4">
                <p className="text-[13px] font-semibold text-gray-800">Nueva revisión semanal</p>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    ¿Qué se vio en esta causa?
                  </label>
                  <textarea
                    value={revDraft.nota}
                    onChange={e => setRevDraft(d => ({ ...d, nota: e.target.value }))}
                    rows={4}
                    autoFocus
                    placeholder="Estado actual, novedades, pendientes, decisiones tomadas..."
                    className="w-full text-[12px] border border-gray-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:border-[#1a2e4a]/30 bg-white leading-relaxed transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Próxima acción
                    </label>
                    <select
                      value={revDraft.proxima_accion}
                      onChange={e => setRevDraft(d => ({ ...d, proxima_accion: e.target.value }))}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#1a2e4a]/30"
                    >
                      {PROXIMAS_ACCIONES_C.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Revisado por
                    </label>
                    <select
                      value={revDraft.responsable}
                      onChange={e => setRevDraft(d => ({ ...d, responsable: e.target.value }))}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#1a2e4a]/30"
                    >
                      {Object.entries(RESPONSABLE_NAMES_C).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Urgente toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRevDraft(d => ({ ...d, urgente: !d.urgente }))}
                    className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all ${
                      revDraft.urgente
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Flame size={11} className={revDraft.urgente ? 'text-red-500' : 'text-gray-300'} />
                    Marcar seguimiento urgente
                  </button>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveRevision}
                    disabled={savingRev || !revDraft.nota.trim()}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#1a2e4a' }}
                  >
                    {savingRev ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Guardar revisión
                  </button>
                  <button
                    onClick={() => setShowRevForm(false)}
                    className="text-[12px] px-3 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Modal generar tarea */}
            {tareaFromRev && (
              <div className="mb-6 bg-amber-50/50 border border-amber-100 rounded-2xl p-4 space-y-3">
                <p className="text-[12px] font-semibold text-gray-800">Generar tarea desde revisión</p>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Título de la tarea</label>
                  <input
                    autoFocus
                    value={tareaFromRev.titulo}
                    onChange={e => setTareaFromRev(d => ({ ...d, titulo: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-300 bg-white"
                    placeholder="Ej: Preparar escrito de réplica"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Fecha límite (opcional)</label>
                  <input
                    type="date"
                    value={tareaFromRev.fecha}
                    onChange={e => setTareaFromRev(d => ({ ...d, fecha: e.target.value }))}
                    className="text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-300 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerarTarea}
                    disabled={savingTarea || !tareaFromRev.titulo.trim()}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-2 rounded-lg disabled:opacity-50 bg-amber-600 hover:bg-amber-700 transition-colors"
                  >
                    {savingTarea ? <Loader2 size={11} className="animate-spin" /> : <CheckSquare size={11} />}
                    Crear tarea
                  </button>
                  <button onClick={() => setTareaFromRev(null)} className="text-[12px] px-3 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            {loadingRev ? (
              <div className="flex justify-center py-12">
                <Loader2 size={18} className="animate-spin text-gray-300" />
              </div>
            ) : revisiones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RefreshCw size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400 font-medium">Sin revisiones registradas</p>
                <p className="text-[11px] text-gray-400 mt-1">La bitácora de esta causa está vacía</p>
                {!showRevForm && (
                  <button
                    onClick={() => setShowRevForm(true)}
                    className="mt-4 text-[12px] text-[#2570ba] hover:underline"
                  >
                    + Agregar primera revisión
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[9px] top-3 bottom-3 w-px bg-gray-100" />
                <div className="space-y-5">
                  {revisiones.map((rev, i) => {
                    const weekNum = rev.semana_key ? parseInt(rev.semana_key.split('-W')[1]) : null
                    const year    = rev.semana_key ? rev.semana_key.split('-W')[0] : null
                    const isFirst = i === 0
                    const accionStyle = ACCION_STYLES_C[rev.proxima_accion] || 'bg-gray-50 text-gray-400'
                    const isEditing = editRevId === rev.id
                    return (
                      <div key={rev.id} className="relative pl-6">
                        {/* Dot */}
                        <div className={`absolute left-0 top-2 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                          rev.urgente ? 'border-red-400 bg-red-400' :
                          isFirst ? 'border-[#1a2e4a] bg-[#1a2e4a]' : 'border-gray-200 bg-white'
                        }`}>
                          {rev.urgente ? <Flame size={9} className="text-white" /> :
                           isFirst ? <Check size={9} className="text-white" strokeWidth={3} /> : null}
                        </div>

                        {/* Card */}
                        <div className={`rounded-xl border p-4 transition-all ${
                          rev.urgente ? 'border-red-100 bg-red-50/30' :
                          isFirst ? 'border-[#1a2e4a]/12 bg-[#1a2e4a]/[0.02]' : 'border-gray-100 bg-white'
                        }`}>
                          {isEditing && editRevDraft ? (
                            /* Edit mode */
                            <div className="space-y-3">
                              <textarea
                                value={editRevDraft.nota}
                                onChange={e => setEditRevDraft(d => ({ ...d, nota: e.target.value }))}
                                rows={3}
                                autoFocus
                                className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-[#1a2e4a]/30 bg-white leading-relaxed"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <select
                                  value={editRevDraft.proxima_accion}
                                  onChange={e => setEditRevDraft(d => ({ ...d, proxima_accion: e.target.value }))}
                                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                                >
                                  {PROXIMAS_ACCIONES_C.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <select
                                  value={editRevDraft.responsable}
                                  onChange={e => setEditRevDraft(d => ({ ...d, responsable: e.target.value }))}
                                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                                >
                                  {Object.entries(RESPONSABLE_NAMES_C).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleSaveEditRevision}
                                  disabled={savingEditRev || !editRevDraft.nota.trim()}
                                  className="flex items-center gap-1.5 text-[11px] font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90"
                                  style={{ backgroundColor: '#1a2e4a' }}
                                >
                                  {savingEditRev ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                  Guardar
                                </button>
                                <button
                                  onClick={() => { setEditRevId(null); setEditRevDraft(null) }}
                                  className="text-[11px] px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {weekNum && (
                                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                      Sem. {weekNum}{year && ` · ${year}`}
                                    </span>
                                  )}
                                  {rev.fecha && (
                                    <span className="text-[10px] text-gray-400">{fmtFechaCausa(rev.fecha)}</span>
                                  )}
                                  {rev.responsable && (
                                    <div className="flex items-center gap-1">
                                      <div
                                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold"
                                        style={{ backgroundColor: RESPONSABLE_COLORS_C[rev.responsable] || '#94a3b8' }}
                                      >
                                        {rev.responsable}
                                      </div>
                                      <span className="text-[10px] text-gray-400">
                                        {RESPONSABLE_NAMES_C[rev.responsable] || rev.responsable}
                                      </span>
                                    </div>
                                  )}
                                  {isFirst && !rev.urgente && (
                                    <span className="text-[10px] font-medium bg-[#1a2e4a]/8 text-[#1a2e4a] px-1.5 py-0.5 rounded-full">
                                      Última revisión
                                    </span>
                                  )}
                                  {rev.urgente && (
                                    <span className="text-[10px] font-medium bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                      <Flame size={9} /> Seguimiento urgente
                                    </span>
                                  )}
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => setTareaFromRev({ revId: rev.id, titulo: rev.proxima_accion || '', fecha: '' })}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                    title="Generar tarea"
                                  >
                                    <PlusSquare size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleToggleUrgente(rev)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      rev.urgente
                                        ? 'text-red-400 bg-red-50'
                                        : 'text-gray-300 hover:text-red-400 hover:bg-red-50'
                                    }`}
                                    title={rev.urgente ? 'Quitar urgente' : 'Marcar urgente'}
                                  >
                                    <Flame size={12} />
                                  </button>
                                  <button
                                    onClick={() => { setEditRevId(rev.id); setEditRevDraft({ nota: rev.nota, proxima_accion: rev.proxima_accion, responsable: rev.responsable, urgente: rev.urgente }) }}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                    title="Editar revisión"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                </div>
                              </div>
                              {rev.nota && (
                                <p className="text-[12px] text-gray-700 leading-relaxed mb-2.5">{rev.nota}</p>
                              )}
                              {rev.proxima_accion && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${accionStyle}`}>
                                  → {rev.proxima_accion}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TIMELINE */}
        {tab === 'timeline' && (() => {
          const isLoading = loadingBase || loadingRev || loadingPjud || loadingSiau

          // Color palette
          const colorMap = {
            purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  dot: 'bg-purple-400',  badge: 'bg-purple-50 text-purple-700',   border: 'border-purple-100'  },
            blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700',       border: 'border-blue-100'    },
            amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700',     border: 'border-amber-100'   },
            green:   { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100' },
            red:     { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700',         border: 'border-red-100'     },
            slate:   { bg: 'bg-slate-50',   text: 'text-slate-500',   dot: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-500',    border: 'border-slate-100'   },
            orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-700',   border: 'border-orange-100'  },
          }

          // Filter tabs config
          const FILTERS = [
            { key: 'Todo',       label: 'Todo' },
            { key: 'PJUD',       label: 'PJUD',       color: 'blue'   },
            { key: 'SIAU',       label: 'SIAU',       color: 'amber'  },
            { key: 'Tarea',      label: 'Tareas',     color: 'green'  },
            { key: 'Audiencia',  label: 'Audiencias', color: 'purple' },
            { key: 'Plazo',      label: 'Plazos',     color: 'orange' },
            { key: 'Revisión',   label: 'Revisiones', color: 'slate'  },
          ]

          // Build unified events
          const allEvents = [
            ...audiencias.map(a => ({
              id: `a-${a.id}`, fecha: a.fecha, tipo: 'Audiencia',
              titulo: a.tipo ?? 'Audiencia',
              subtitulo: a.hora ? `${a.hora}${a.sala ? ' · Sala ' + a.sala : ''}` : null,
              detalle: a.notas || null,
              color: 'purple', Icon: Gavel,
              futuro: a.fecha >= TODAY_C,
              navTab: null,
            })),
            ...plazos.map(p => ({
              id: `p-${p.id}`, fecha: p.fecha_vencimiento, tipo: 'Plazo',
              titulo: p.titulo, subtitulo: p.tipo || null,
              detalle: p.descripcion || null,
              color: (() => {
                const d = Math.round((new Date(p.fecha_vencimiento) - new Date(TODAY_C)) / 86400000)
                return d >= 0 && d <= 3 ? 'red' : 'orange'
              })(),
              Icon: Clock,
              futuro: p.fecha_vencimiento >= TODAY_C,
              urgente: (() => {
                const d = Math.round((new Date(p.fecha_vencimiento) - new Date(TODAY_C)) / 86400000)
                return d >= 0 && d <= 3
              })(),
              navTab: null,
            })),
            ...tareas.filter(t => t.fecha_vencimiento).map(t => ({
              id: `t-${t.id}`, fecha: t.fecha_vencimiento, tipo: 'Tarea',
              titulo: t.titulo,
              subtitulo: [t.prioridad, t.responsable ? RESPONSABLE_NAMES_C[t.responsable] || t.responsable : null].filter(Boolean).join(' · ') || null,
              detalle: t.descripcion || null,
              color: t.estado === 'Completada' ? 'slate' : 'green', Icon: CheckSquare,
              futuro: t.fecha_vencimiento >= TODAY_C,
              completada: t.estado === 'Completada',
              navTab: 'tareas',
            })),
            ...revisiones.filter(r => !r.semana_key?.startsWith('SEG-')).map(r => ({
              id: `r-${r.id}`, fecha: r.fecha, tipo: 'Revisión',
              titulo: r.proxima_accion || 'Revisión semanal',
              subtitulo: RESPONSABLE_NAMES_C[r.responsable] || r.responsable || null,
              detalle: r.nota || null,
              color: r.urgente ? 'red' : 'slate', Icon: RefreshCw,
              futuro: false, urgente: r.urgente,
              navTab: 'revision_semanal',
            })),
            ...pjudRows.map(p => ({
              id: `pj-${p.id}`, fecha: p.fecha, tipo: 'PJUD',
              titulo: p.solicitud || p.folio || 'Movimiento PJUD',
              subtitulo: [p.folio, p.estado].filter(Boolean).join(' · ') || null,
              detalle: p.respuesta || p.notas || null,
              color: 'blue', Icon: Scale,
              futuro: p.fecha >= TODAY_C,
              urgente: p.estado === 'Urgente',
              navTab: 'pjud',
            })),
            ...siauRows.map(s => ({
              id: `si-${s.id}`, fecha: s.fecha, tipo: 'SIAU',
              titulo: s.solicitud || s.folio || 'Solicitud SIAU',
              subtitulo: [s.folio, s.estado].filter(Boolean).join(' · ') || null,
              detalle: s.respuesta || s.notas || null,
              color: 'amber', Icon: MessageSquare,
              futuro: s.fecha >= TODAY_C,
              urgente: s.estado === 'Urgente',
              navTab: 'siau',
            })),
          ].filter(e => e.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha))

          // Apply filter
          const events = filterTimeline === 'Todo'
            ? allEvents
            : allEvents.filter(e => e.tipo === filterTimeline)

          // Expanded card state (local to IIFE, tracked via closured state would need outer state)
          // We'll use a lightweight inline approach — no expansion for now, just rich single-line cards

          return (
            <div className="px-8 py-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-900">Timeline unificado</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Todos los eventos cronológicamente · {allEvents.length} total
                  </p>
                </div>
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap mb-6">
                {FILTERS.map(f => {
                  const active = filterTimeline === f.key
                  const c = f.color ? colorMap[f.color] : null
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilterTimeline(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                        active
                          ? f.color
                            ? `${c.badge} ${c.border}`
                            : 'bg-[#1a2e4a] text-white border-[#1a2e4a]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {f.color && (
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? c.dot : 'bg-gray-300'}`} />
                      )}
                      {f.label}
                      {f.key !== 'Todo' && (
                        <span className={`text-[10px] tabular-nums ${active ? 'opacity-70' : 'text-gray-400'}`}>
                          {allEvents.filter(e => e.tipo === f.key).length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Timeline body */}
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={18} className="animate-spin text-gray-300" />
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Activity size={28} className="text-gray-200 mb-3" />
                  <p className="text-[13px] text-gray-400">
                    {filterTimeline === 'Todo' ? 'Sin eventos registrados' : `Sin eventos de tipo ${filterTimeline}`}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[10px] top-3 bottom-3 w-px bg-gray-100" />
                  <div className="space-y-2">
                    {events.map((ev, i) => {
                      const c = colorMap[ev.color] || colorMap.slate
                      const isToday = ev.fecha === TODAY_C
                      const showHoySep = i > 0 && events[i-1].fecha >= TODAY_C && ev.fecha < TODAY_C
                      return (
                        <div key={ev.id} className="relative pl-8">
                          {/* Hoy separator */}
                          {showHoySep && (
                            <div className="flex items-center gap-2 mb-3 -ml-8 mr-0">
                              <div className="w-8 flex-shrink-0" />
                              <div className="flex-1 h-px bg-gray-200" />
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex-shrink-0">Hoy</span>
                              <div className="flex-1 h-px bg-gray-200" />
                            </div>
                          )}

                          {/* Dot */}
                          <div className={`absolute left-0 top-3 w-[20px] h-[20px] rounded-full flex items-center justify-center ${
                            ev.urgente    ? 'bg-red-400' :
                            ev.completada ? 'bg-emerald-400' :
                            ev.futuro     ? `bg-white border-2 ${c.border}` :
                            c.dot
                          }`}>
                            <ev.Icon
                              size={10}
                              className={
                                ev.urgente || ev.completada ? 'text-white' :
                                ev.futuro ? c.text : 'text-white'
                              }
                            />
                          </div>

                          {/* Card */}
                          <div
                            onClick={ev.navTab ? () => setTab(ev.navTab) : undefined}
                            className={`group rounded-xl border transition-all ${
                              ev.navTab ? 'cursor-pointer hover:shadow-sm' : ''
                            } ${
                              ev.urgente    ? 'border-red-100 bg-red-50/30 hover:border-red-200' :
                              isToday       ? 'border-[#1a2e4a]/15 bg-[#1a2e4a]/[0.02] hover:border-[#1a2e4a]/25' :
                              ev.futuro     ? `border-gray-100 bg-white hover:${c.border}` :
                              'border-gray-50 bg-gray-50/50 hover:border-gray-100'
                            }`}
                          >
                            <div className="flex items-start gap-3 px-3.5 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] font-medium leading-snug ${
                                  ev.completada ? 'line-through text-gray-300' : 'text-gray-800'
                                }`}>{ev.titulo}</p>
                                {ev.subtitulo && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{ev.subtitulo}</p>
                                )}
                                {ev.detalle && (
                                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{ev.detalle}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.badge}`}>
                                  {ev.tipo}
                                </span>
                                <span className={`text-[10px] tabular-nums ${
                                  isToday ? 'font-semibold text-[#1a2e4a]' : 'text-gray-400'
                                }`}>
                                  {fmtFechaCausa(ev.fecha)}
                                </span>
                              </div>
                              {ev.navTab && (
                                <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* TAREAS */}
        {tab === 'tareas' && (
          <div className="px-8 py-6">
            <p className="text-[11px] text-gray-400 mb-4">
              {tareas.filter(t => t.estado === 'Completada').length}/{tareas.length} completadas
            </p>
            {loadingBase ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : tareas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CheckSquare size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400">Sin tareas asociadas a esta causa</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tareas.map(t => (
                  <div key={t.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
                    t.estado === 'Completada' ? 'border-gray-50 bg-gray-50/40' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}>
                    <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 ${
                      t.estado === 'Completada' ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300'
                    }`}>
                      {t.estado === 'Completada' && (
                        <span className="text-white text-[9px] font-bold leading-none">✓</span>
                      )}
                    </div>
                    <p className={`text-[12px] flex-1 leading-snug ${
                      t.estado === 'Completada' ? 'line-through text-gray-300' : 'text-gray-700'
                    }`}>
                      {t.titulo}
                    </p>
                    {t.prioridad && t.estado !== 'Completada' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        t.prioridad === 'Alta' ? 'bg-red-50 text-red-600' :
                        t.prioridad === 'Media' ? 'bg-amber-50 text-amber-600' :
                        'bg-gray-100 text-gray-400'
                      }`}>{t.prioridad}</span>
                    )}
                    {t.fecha_vencimiento && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                        t.estado === 'Completada' ? 'bg-gray-50 text-gray-300' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {fmtFechaCausa(t.fecha_vencimiento)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PLAZOS */}
        {tab === 'plazos' && (
          <div className="px-8 py-6">
            {loadingBase ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : plazos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Clock size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400">Sin plazos registrados para esta causa</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plazos.map(p => {
                  const dias = p.fecha_vencimiento
                    ? Math.round((new Date(p.fecha_vencimiento) - new Date(TODAY_C)) / 86400000)
                    : null
                  const urgente = dias !== null && dias <= 3 && p.estado === 'Activo'
                  return (
                    <div key={p.id} className={`flex items-center gap-3 p-3.5 rounded-xl border ${
                      urgente ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white'
                    }`}>
                      <Clock size={13} className={urgente ? 'text-red-400 flex-shrink-0' : 'text-gray-300 flex-shrink-0'} />
                      <p className="text-[12px] text-gray-700 flex-1">{p.titulo}</p>
                      {p.tipo && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{p.tipo}</span>
                      )}
                      {dias !== null && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          urgente ? 'bg-red-100 text-red-700' : dias < 0 ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {dias === 0 ? 'Hoy' : dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias}d`}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* AUDIENCIAS */}
        {tab === 'audiencias' && (
          <div className="px-8 py-6">
            {loadingBase ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : audiencias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Gavel size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400">Sin audiencias registradas</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {audiencias.map(a => (
                  <div key={a.id} className={`p-4 rounded-xl border transition-colors ${
                    a.fecha >= TODAY_C ? 'border-purple-100/80 bg-purple-50/20' : 'border-gray-100 bg-white'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[13px] font-semibold text-gray-900">{a.tipo ?? 'Audiencia'}</p>
                      <EstadoBadge estado={a.estado ?? 'Próxima'} />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock size={10} className="text-gray-300" />
                        {formatFecha(a.fecha)}{a.hora ? ` · ${a.hora}` : ''}
                      </span>
                      {a.tribunal && <span>{a.tribunal}</span>}
                      {a.sala && <span>Sala {a.sala}</span>}
                      {a.modalidad && (
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">{a.modalidad}</span>
                      )}
                    </div>
                    {a.notas && <p className="text-[11px] text-gray-500 mt-2 leading-snug">{a.notas}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PJUD */}
        {tab === 'pjud' && (
          <div className="px-8 py-6">
            {loadingPjud ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : pjudRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Scale size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400">Sin movimientos PJUD para esta causa</p>
                {causa.rit && <p className="text-[11px] text-gray-400 mt-1 font-mono">{causa.rit}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 mb-3">{pjudRows.length} movimientos · RIT {causa.rit}</p>
                {pjudRows.map(p => (
                  <div key={p.id} className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5">
                        {p.folio}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-gray-700 leading-snug">{p.solicitud}</p>
                        {p.respuesta && (
                          <p className="text-[11px] text-green-700 mt-1 leading-snug">{p.respuesta}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400">{fmtFechaCausa(p.fecha)}</span>
                        {p.estado && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            p.estado === 'Respondida' ? 'bg-green-50 text-green-700' :
                            p.estado === 'Urgente'    ? 'bg-red-50 text-red-700' :
                            'bg-amber-50 text-amber-600'
                          }`}>{p.estado}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SIAU */}
        {tab === 'siau' && (
          <div className="px-8 py-6">
            {loadingSiau ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : siauRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageSquare size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400">Sin solicitudes SIAU para esta causa</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 mb-3">{siauRows.length} solicitudes</p>
                {siauRows.map(s => (
                  <div key={s.id} className="p-3.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5">
                        {s.folio}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-gray-700">{s.solicitud || '—'}</p>
                        {s.respuesta && <p className="text-[11px] text-green-700 mt-1">{s.respuesta}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400">{fmtFechaCausa(s.fecha)}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          s.estado === 'Respondida' ? 'bg-green-50 text-green-700' :
                          s.estado === 'Urgente'    ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-600'
                        }`}>{s.estado}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTOS */}
        {tab === 'documentos' && (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <FileText size={28} className="text-gray-200 mb-3" />
            <p className="text-[13px] text-gray-400 font-medium">Documentos de la causa</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Los documentos vinculados a esta causa aparecerán aquí
            </p>
          </div>
        )}

        {/* SEGUIMIENTO PERSONAL */}
        {tab === 'seguimiento' && (() => {
          const weekNum = getISOWeek_C(TODAY_C)
          const d = new Date(TODAY_C + 'T12:00:00')
          const dow = d.getDay() === 0 ? 7 : d.getDay()
          const monday = new Date(d); monday.setDate(d.getDate() - (dow - 1))
          const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
          const mesNombre = monday.toLocaleDateString('es-CL', { month: 'long' })
          const weekHeader = `Semana ${weekNum} · ${monday.getDate()}–${sunday.getDate()} de ${mesNombre} ${monday.getFullYear()}`
          const semana_key = `SEG-${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
          const segHistory = revisiones.filter(r => r.semana_key?.startsWith('SEG-') && r.semana_key !== semana_key)
            .sort((a, b) => (b.semana_key ?? '').localeCompare(a.semana_key ?? ''))

          const estadoColors = {
            'Pendiente':     'border-amber-300 bg-amber-50 text-amber-700',
            'En progreso':   'border-blue-300 bg-blue-50 text-blue-700',
            'Listo':         'border-emerald-300 bg-emerald-50 text-emerald-700',
            'Sin novedades': 'border-gray-300 bg-gray-50 text-gray-500',
          }
          const estadoInactive = 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'

          return (
            <div className="p-6 max-w-2xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
                    <Target size={15} className="text-indigo-500" />
                    Seguimiento personal
                  </h3>
                  <p className="text-[12px] text-gray-400 mt-0.5 ml-5">{weekHeader}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSegCarga(true)}
                    className="flex items-center gap-1.5 text-[12px] font-medium border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Upload size={13} />
                    Cargar historial
                  </button>
                  <button
                    onClick={handleSaveSeg}
                    disabled={savingSeg}
                    className="flex items-center gap-1.5 text-[12px] font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {savingSeg ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Guardar semana
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-5 shadow-sm">

                {/* ¿Qué hay que hacer? */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">¿Qué hay que hacer?</label>
                  <textarea
                    value={segDraft.por_hacer}
                    onChange={e => setSegDraft(d => ({ ...d, por_hacer: e.target.value }))}
                    placeholder="Tareas pendientes, gestiones, escritos…"
                    rows={3}
                    className="w-full text-[13px] text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder-gray-300"
                  />
                </div>

                {/* ¿Qué se hizo? */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">¿Qué se hizo esta semana?</label>
                  <textarea
                    value={segDraft.que_se_hizo}
                    onChange={e => setSegDraft(d => ({ ...d, que_se_hizo: e.target.value }))}
                    placeholder="Avances, reuniones, escritos enviados…"
                    rows={3}
                    className="w-full text-[13px] text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder-gray-300"
                  />
                </div>

                {/* Estado */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Estado</label>
                  <div className="flex flex-wrap gap-2">
                    {['Pendiente', 'En progreso', 'Listo', 'Sin novedades'].map(e => (
                      <button
                        key={e}
                        onClick={() => setSegDraft(d => ({ ...d, estado_seg: e }))}
                        className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all ${segDraft.estado_seg === e ? estadoColors[e] : estadoInactive}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Próxima acción */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Próxima acción</label>
                  <input
                    value={segDraft.proxima_accion}
                    onChange={e => setSegDraft(d => ({ ...d, proxima_accion: e.target.value }))}
                    placeholder="¿Qué sigue?"
                    className="w-full text-[13px] text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder-gray-300"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Notas</label>
                  <textarea
                    value={segDraft.notas}
                    onChange={e => setSegDraft(d => ({ ...d, notas: e.target.value }))}
                    placeholder="Observaciones, recordatorios…"
                    rows={2}
                    className="w-full text-[13px] text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder-gray-300"
                  />
                </div>

                {/* Responsable */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Responsable</label>
                  <div className="flex gap-2">
                    {['MT', 'AB', 'CL'].map(r => (
                      <button
                        key={r}
                        onClick={() => setSegDraft(d => ({ ...d, responsable: r }))}
                        className={`text-[12px] font-semibold w-10 h-8 rounded-lg border transition-all ${
                          segDraft.responsable === r
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Historial */}
              {segHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Historial</h4>
                  <div className="space-y-3">
                    {segHistory.map(r => {
                      const wk = r.semana_key?.replace('SEG-', '') ?? ''
                      const estColor = estadoColors[r.estado_seg] ?? 'border-gray-200 bg-gray-50 text-gray-500'
                      return (
                        <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-gray-500">{wk}</span>
                            <div className="flex items-center gap-2">
                              {r.responsable && (
                                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{r.responsable}</span>
                              )}
                              {r.estado_seg && (
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border ${estColor}`}>{r.estado_seg}</span>
                              )}
                            </div>
                          </div>
                          {r.por_hacer && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Por hacer</p>
                              <p className="text-[12px] text-gray-600 whitespace-pre-wrap">{r.por_hacer}</p>
                            </div>
                          )}
                          {r.que_se_hizo && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Se hizo</p>
                              <p className="text-[12px] text-gray-600 whitespace-pre-wrap">{r.que_se_hizo}</p>
                            </div>
                          )}
                          {r.proxima_accion && (
                            <div className="flex items-start gap-1.5">
                              <ChevronRight size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                              <p className="text-[12px] text-indigo-600 font-medium">{r.proxima_accion}</p>
                            </div>
                          )}
                          {r.nota && (
                            <p className="text-[11px] text-gray-400 italic">{r.nota}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

      </div>
    </div>

    {/* Carga historial seguimiento */}
    {showSegCarga && (
      <SegCargaHistorialModal
        causa={causa}
        onClose={() => setShowSegCarga(false)}
        onSuccess={inserted => {
          setRevisiones(prev => {
            const updated = [...prev]
            inserted.forEach(r => {
              const idx = updated.findIndex(x => x.semana_key === r.semana_key)
              if (idx >= 0) updated[idx] = r
              else updated.unshift(r)
            })
            return updated.sort((a, b) => (b.semana_key ?? '').localeCompare(a.semana_key ?? ''))
          })
        }}
      />
    )}
    </>
  )
}

// ── Sidebar de navegación interna ─────────────────────────────────────────
function CausasSidebar({ causas, clienteActivo, onSelect, busquedaSidebar, setBusquedaSidebar }) {
  const clientes = useMemo(() => {
    const map = {}
    causas.forEach(c => {
      const key = (c.cliente_nombre || '').trim()
      if (!map[key]) map[key] = { nombre: key, total: 0, activas: 0 }
      map[key].total += 1
      if (c.estado === 'En tramitación' || c.estado === 'Abierta') map[key].activas += 1
    })
    return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [causas])

  const filtrados = useMemo(() => {
    const q = busquedaSidebar.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      causas.some(ca =>
        ca.cliente_nombre === c.nombre &&
        ((ca.rit ?? '').toLowerCase().includes(q) || (ca.ruc ?? '').toLowerCase().includes(q))
      )
    )
  }, [busquedaSidebar, clientes, causas])

  return (
    <div className="flex-shrink-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden" style={{ width: 200 }}>
      <div className="px-3 pt-4 pb-3 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={busquedaSidebar}
            onChange={e => setBusquedaSidebar(e.target.value)}
            placeholder="Cliente, RIT…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300"
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <button onClick={() => onSelect(null)}
          className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-colors ${
            clienteActivo === null ? 'bg-[#1a2e4a] text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <div className="flex items-center gap-2">
            <Scale size={12} className={clienteActivo === null ? 'text-white/70' : 'text-gray-400'} />
            <span>Todas las causas</span>
          </div>
          <span className={`text-[10px] font-medium tabular-nums ${clienteActivo === null ? 'text-white/60' : 'text-gray-400'}`}>
            {causas.length}
          </span>
        </button>
        <div className="mx-4 my-2 border-t border-gray-100" />
        {filtrados.map(c => (
          <button key={c.nombre} onClick={() => onSelect(c.nombre)}
            className={`w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors group ${
              clienteActivo === c.nombre ? 'bg-[#e8f0fb] text-[#1a2e4a]' : 'text-gray-600 hover:bg-gray-50'
            }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                style={{ backgroundColor: clienteActivo === c.nombre ? '#1a2e4a' : '#cbd5e1' }}>
                {initials(c.nombre)}
              </div>
              <span className="text-xs truncate leading-snug">{c.nombre.split(' ')[0]}</span>
            </div>
            <span className={`text-[10px] tabular-nums font-medium flex-shrink-0 ml-1 ${
              clienteActivo === c.nombre ? 'text-[#2570ba]' : 'text-gray-300 group-hover:text-gray-500'
            }`}>{c.total}</span>
          </button>
        ))}
        {filtrados.length === 0 && <p className="px-4 py-6 text-[11px] text-gray-400 text-center">Sin resultados</p>}
      </nav>
    </div>
  )
}

// ── Vista agrupada ────────────────────────────────────────────────────────
function GrupoCliente({ nombre, lista, seleccionada, onSelect }) {
  const [abierto, setAbierto] = useState(true)
  return (
    <div>
      <button onClick={() => setAbierto(p => !p)}
        className="w-full flex items-center gap-3 px-7 py-2.5 hover:bg-gray-50 transition-colors text-left">
        {abierto ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        <span className="text-sm font-semibold text-gray-800">{nombre}</span>
        <span className="text-xs text-gray-400">{lista.length} causa{lista.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-1 ml-1">
          {lista.map(c => <span key={c.id} className={`w-1.5 h-1.5 rounded-full ${ESTADO_STYLES[c.estado]?.dot ?? 'bg-gray-300'}`} />)}
        </div>
      </button>
      {abierto && (
        <div className="ml-7 border-l border-gray-100">
          {lista.map(c => (
            <div key={c.id}
              onClick={() => onSelect(seleccionada?.id === c.id ? null : c)}
              className={`flex items-center gap-4 px-5 py-2.5 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${
                seleccionada?.id === c.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'
              } ${CERRADAS.has(c.estado) ? 'opacity-55' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 truncate">{c.materia}</p>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">{c.rit ?? '—'}</p>
              </div>
              <AreaBadge area={c.area} />
              <EstadoBadge estado={c.estado} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Causas() {
  const [causas, setCausas]           = useState([])
  const [listaClientes, setListaClientes] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [guardando, setGuardando]     = useState(false)

  const [clienteActivo, setCliente]   = useState(null)
  const [busquedaSidebar, setSidebar] = useState('')
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setEstado]     = useState('')
  const [filtroArea, setArea]         = useState('')
  const [vista, setVista]             = useState('tabla')
  const [seleccionada, setSeleccionada] = useState(null)
  const [mostrarFiltros, setFiltros]  = useState(false)
  const [formulario, setFormulario]   = useState(null) // null | 'nueva' | objeto causa para editar

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchCausas = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('causas')
      .select('*')
      .order('cliente_nombre', { ascending: true })
    if (err) {
      setError('No se pudo cargar las causas: ' + err.message)
    } else {
      setCausas((data ?? []).map(mapCausa))
    }
    setLoading(false)
  }, [])

  const fetchListaClientes = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, rut')
      .order('nombre', { ascending: true })
    setListaClientes(data || [])
  }, [])

  useEffect(() => { fetchCausas(); fetchListaClientes() }, [fetchCausas, fetchListaClientes])

  // ── Guardar (crear / editar) ─────────────────────────────────────────────
  const handleGuardar = async (form) => {
    setGuardando(true)
    const payload = mapToDb(form)

    if (formulario === 'nueva') {
      const { data, error: err } = await supabase.from('causas').insert([payload]).select().single()
      if (err) { alert('Error al guardar: ' + err.message) }
      else {
        const nueva = mapCausa(data)
        setCausas(prev => [...prev, nueva].sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es')))
        setFormulario(null)
        setSeleccionada(nueva)
      }
    } else {
      const { data, error: err } = await supabase.from('causas').update(payload).eq('id', formulario.id).select().single()
      if (err) { alert('Error al actualizar: ' + err.message) }
      else {
        const actualizada = mapCausa(data)
        setCausas(prev => prev.map(c => c.id === actualizada.id ? actualizada : c))
        setFormulario(null)
        setSeleccionada(actualizada)
      }
    }
    setGuardando(false)
  }

  // ── Eliminar ────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!seleccionada) return
    const { error: err } = await supabase.from('causas').delete().eq('id', seleccionada.id)
    if (err) { alert('Error al eliminar: ' + err.message) }
    else {
      setCausas(prev => prev.filter(c => c.id !== seleccionada.id))
      setSeleccionada(null)
    }
  }

  // ── Filtrado ────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return causas.filter(c => {
      const matchCliente = !clienteActivo || c.cliente_nombre === clienteActivo
      const matchQ = !q ||
        c.cliente_nombre.toLowerCase().includes(q) ||
        c.materia.toLowerCase().includes(q) ||
        c.tribunal.toLowerCase().includes(q) ||
        (c.rit ?? '').toLowerCase().includes(q)
      const matchEstado = !filtroEstado ||
        (filtroEstado === 'Cerradas' ? CERRADAS.has(c.estado) : c.estado === filtroEstado)
      const matchArea   = !filtroArea   || c.area   === filtroArea
      return matchCliente && matchQ && matchEstado && matchArea
    })
  }, [causas, clienteActivo, busqueda, filtroEstado, filtroArea])

  const ordenadas = useMemo(() =>
    [...filtradas].sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es'))
  , [filtradas])

  const hayFiltros = filtroEstado || filtroArea
  const tituloVista = clienteActivo
    ? clienteActivo.split(' ').slice(0, 2).join(' ')
    : 'Todas las causas'

  const panelAbierto = seleccionada || formulario

  return (
    <div className="flex h-full min-h-screen">
      <CausasSidebar
        causas={causas}
        clienteActivo={clienteActivo}
        onSelect={n => { setCliente(n); setSeleccionada(null); setBusqueda('') }}
        busquedaSidebar={busquedaSidebar}
        setBusquedaSidebar={setSidebar}
      />

      {seleccionada ? (
        /* ── Vista de causa completa ── */
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <CausaView
            causa={seleccionada}
            onClose={() => setSeleccionada(null)}
            onEdit={() => setFormulario(seleccionada)}
            onDelete={handleEliminar}
          />
          {formulario && (
            <FormCausa
              inicial={formulario === 'nueva' ? null : formulario}
              onClose={() => setFormulario(null)}
              onGuardar={handleGuardar}
              guardando={guardando}
              clientes={listaClientes}
              causas={causas}
              onCrearCliente={() => { setFormulario(null); window.location.href = '/clientes' }}
            />
          )}
        </div>
      ) : (
        /* ── Vista de lista ── */
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Header */}
            <div className="px-7 pt-7 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{tituloVista}</h1>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {loading ? 'Cargando…' : (() => {
                      const activas  = ordenadas.filter(c => !CERRADAS.has(c.estado)).length
                      const cerradas = ordenadas.filter(c =>  CERRADAS.has(c.estado)).length
                      return `${activas} activa${activas !== 1 ? 's' : ''}${cerradas ? ` · ${cerradas} cerrada${cerradas !== 1 ? 's' : ''}` : ''}`
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => { setSeleccionada(null); setFormulario('nueva') }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#1a2e4a' }}>
                  <Plus size={13} />Nueva causa
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <div className="relative flex-1 max-w-xs">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar materia, tribunal, RIT…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300" />
                </div>
                <button onClick={() => setFiltros(p => !p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    hayFiltros ? 'border-[#2570ba] text-[#2570ba] bg-blue-50' : 'border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}>
                  <Filter size={11} />Filtros
                  {hayFiltros && <span className="w-1.5 h-1.5 rounded-full bg-[#2570ba]" />}
                </button>
                <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
                  <button onClick={() => setVista('tabla')}
                    className={`p-1.5 rounded transition-colors ${vista === 'tabla' ? 'bg-[#1a2e4a] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                    <LayoutList size={12} />
                  </button>
                  <button onClick={() => setVista('agrupado')}
                    className={`p-1.5 rounded transition-colors ${vista === 'agrupado' ? 'bg-[#1a2e4a] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                    <Layers size={12} />
                  </button>
                </div>
              </div>
              {mostrarFiltros && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Filtrar por:</span>
                  <select value={filtroEstado} onChange={e => setEstado(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-600 bg-white">
                    <option value="">Todos los estados</option>
                    <option value="Cerradas">— Cerradas (Terminada + Archivada)</option>
                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                  <select value={filtroArea} onChange={e => setArea(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-600 bg-white">
                    <option value="">Todas las áreas</option>
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                  {hayFiltros && (
                    <button onClick={() => { setEstado(''); setArea('') }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      <X size={11} />Limpiar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-7 mt-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={fetchCausas} className="flex items-center gap-1.5 font-medium hover:underline">
                  <RefreshCw size={11} /> Reintentar
                </button>
              </div>
            )}

            {/* Tabla / agrupado */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <LoadingState />
              ) : ordenadas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Scale size={28} className="text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin causas registradas'}
                  </p>
                  {!busqueda && (
                    <button onClick={() => { setSeleccionada(null); setFormulario('nueva') }}
                      className="mt-3 text-xs text-[#2570ba] hover:underline">
                      + Agregar primera causa
                    </button>
                  )}
                </div>
              ) : vista === 'tabla' ? (
                <table className="w-full">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-gray-100">
                      {(clienteActivo
                        ? ['Parte', 'RUC', 'RIT', 'Tribunal', 'Fiscalía', 'Área', 'Materia', 'Estado']
                        : ['Cliente', 'Parte', 'RUC', 'RIT', 'Tribunal', 'Fiscalía', 'Área', 'Materia', 'Estado']
                      ).map(col => (
                        <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide first:pl-7">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ordenadas.map(c => (
                      <tr key={c.id}
                        onClick={() => { setSeleccionada(seleccionada?.id === c.id ? null : c); setFormulario(null) }}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${
                          seleccionada?.id === c.id ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'
                        } ${CERRADAS.has(c.estado) ? 'opacity-55' : ''}`}>
                        {!clienteActivo && (
                          <td className="pl-7 pr-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: '#2570ba' }}>
                                {initials(c.cliente_nombre)}
                              </div>
                              <span className="text-xs text-gray-800 whitespace-nowrap">{c.cliente_nombre}</span>
                            </div>
                          </td>
                        )}
                        <td className={`${clienteActivo ? 'pl-7' : ''} px-3 py-2.5`}>
                          <span className="text-xs text-gray-600">{c.parte}</span>
                        </td>
                        <td className="px-3 py-2.5"><span className="text-xs font-mono text-gray-400">{c.ruc ?? '—'}</span></td>
                        <td className="px-3 py-2.5"><span className="text-xs font-mono text-gray-500">{c.rit ?? '—'}</span></td>
                        <td className="px-3 py-2.5 max-w-[140px]"><p className="text-xs text-gray-600 truncate">{c.tribunal.split('—')[0]?.trim()}</p></td>
                        <td className="px-3 py-2.5"><span className="text-xs text-gray-400">{c.fiscalia ?? '—'}</span></td>
                        <td className="px-3 py-2.5"><AreaBadge area={c.area} /></td>
                        <td className="px-3 py-2.5 max-w-[140px]"><p className="text-xs text-gray-700 truncate">{c.materia}</p></td>
                        <td className="px-3 py-2.5"><EstadoBadge estado={c.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(() => {
                    const grupos = {}
                    ordenadas.forEach(c => {
                      if (!grupos[c.cliente_nombre]) grupos[c.cliente_nombre] = []
                      grupos[c.cliente_nombre].push(c)
                    })
                    return Object.entries(grupos).map(([nombre, lista]) => (
                      <GrupoCliente key={nombre} nombre={nombre} lista={lista}
                        seleccionada={seleccionada} onSelect={c => { setSeleccionada(c); setFormulario(null) }} />
                    ))
                  })()}
                </div>
              )}
            </div>
          </div>
          {formulario && (
            <FormCausa
              inicial={formulario === 'nueva' ? null : formulario}
              onClose={() => setFormulario(null)}
              onGuardar={handleGuardar}
              guardando={guardando}
              clientes={listaClientes}
              causas={causas}
              onCrearCliente={() => { setFormulario(null); window.location.href = '/clientes' }}
            />
          )}
        </div>
      )}
    </div>
  )
}
