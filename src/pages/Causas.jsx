import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Plus, X, Scale, Gavel, FileText,
  CheckSquare, BookOpen, Clock, Filter,
  LayoutList, Layers, User, Hash, Pencil,
  ChevronDown, ChevronRight, ChevronLeft, MessageSquare,
  Mail, Target, Send, Briefcase, AlignLeft,
  Loader2, AlertTriangle, RefreshCw, Trash2, Check,
  Calendar, Activity, Flame, PlusSquare,
  UserCheck, Upload, Table2, Database, Shield, ExternalLink,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

import { useQuickAdd } from '../context/QuickAddContext'
import { useNavigation } from '../context/NavigationContext'
import { CausaIdentChip, CausaAccordionCard, ClienteAccordionRow } from '../components/ClienteAccordion'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import InlineField from '../components/InlineField'
import CargaMasivaModal from '../components/CargaMasivaModal'
import CopyValue from '../components/CopyValue'
import { SolicitudesTable } from './SIAU'
import { MovimientosTable } from './PJUD'
import useResizableColumns from '../hooks/useResizableColumns'

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
  'Abierta':        { badge: 'bg-emerald-100 text-emerald-800',    dot: 'bg-emerald-700' },
  'Revisar':        { badge: 'bg-amber-50 text-amber-700',          dot: 'bg-amber-400'   },
  'Suspendida':     { badge: 'bg-yellow-50 text-yellow-700',        dot: 'bg-yellow-400'  },
  'Cerrada':        { badge: 'bg-gray-100 text-gray-500',           dot: 'bg-gray-400'    },
  // Legacy — pre-normalización SQL
  'En tramitación': { badge: 'bg-green-50 text-green-600',          dot: 'bg-green-400'   },
  'Terminada':      { badge: 'bg-red-50 text-red-600',              dot: 'bg-red-500'     },
  'Archivada':      { badge: 'bg-stone-100 text-stone-600',         dot: 'bg-stone-500'   },
}
const AREA_STYLES = {
  'Penal':                'bg-[#1a2e4a]/10 text-[#1a2e4a]',
  'Familia':              'bg-blue-50 text-blue-400',
  'Laboral':              'bg-sky-100 text-sky-700',
  'Civil':                'bg-blue-100 text-blue-600',
  'JPL':                  'bg-blue-50 text-blue-500',
  'Administrativo':       'bg-slate-100 text-slate-600',
  'Corte de Apelaciones': 'bg-blue-200 text-blue-800',
  'Corte Suprema':        'bg-blue-900/10 text-blue-900',
}

const ESTADOS  = ['Abierta', 'Revisar', 'Suspendida', 'Cerrada']
const CERRADAS = new Set(['Cerrada', 'Suspendida'])
const ACTIVAS  = new Set(['Abierta', 'Revisar'])

// Mapeo de estados legacy → nuevo estándar (para filtrado sin esperar SQL)
function normalizeEstado(e) {
  if (e === 'En tramitación' || e === 'Administrativa') return 'Abierta'
  if (e === 'Terminada' || e === 'Archivada') return 'Cerrada'
  return e
}
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

/** Dropdown elegante para cambiar estado de causa directamente desde la vista */
function EstadoDropdown({ estado, onCambiar }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const h = e => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES['Abierta']
  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-75 ${s.badge}`}
        title="Cambiar estado"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
        {estado}
        <ChevronDown size={9} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-[170px]"
        >
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-1 pb-1.5">Cambiar estado</p>
          {ESTADOS.map(e => {
            const es = ESTADO_STYLES[e] ?? ESTADO_STYLES['Abierta']
            const activo = e === estado
            return (
              <button
                key={e}
                onClick={() => { if (!activo) onCambiar(e); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors text-left ${
                  activo ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${es.dot}`} />
                <span className={`text-[12px] flex-1 ${activo ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>{e}</span>
                {activo && <Check size={11} className="text-gray-400 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
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
    responsable:      row.responsable      ?? null,
    prioridad:        row.prioridad        ?? null,
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
    responsable:      form.responsable                        || null,
    prioridad:        form.prioridad                          || null,
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
              value === opt ? 'border-[#2570BA] bg-[#2570BA] text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
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
            : 'border-[#2570BA] bg-[#2570BA] text-white'
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
          style={{ backgroundColor: '#2570BA' }}>
          {guardando && <Loader2 size={11} className="animate-spin" />}
          {esEdicion ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── CellDropdown — Dropdown flotante para edición inline en tabla ─────────
// Usa position:fixed con coordenadas de pantalla para evitar recorte por overflow
function CellDropdown({ value, options, onSelect, onClose, renderOption, rect }) {
  const ref = useRef()
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h, true)
    return () => document.removeEventListener('mousedown', h, true)
  }, [onClose])

  const style = rect
    ? { position: 'fixed', top: rect.bottom + 2, left: rect.left, minWidth: Math.max(rect.width, 150), zIndex: 9999, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }
    : { boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }
  const posClass = rect ? '' : 'absolute top-full left-0 mt-0.5'

  return (
    <div ref={ref} className={`${posClass} bg-white border border-gray-100 rounded-xl shadow-xl min-w-[150px] overflow-hidden py-1`} style={style}>
      {options.map(opt => (
        <button key={opt} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSelect(opt) }}
          className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${opt === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
          {renderOption ? renderOption(opt) : opt}
        </button>
      ))}
    </div>
  )
}

// ── CausaView — Vista completa de expediente jurídico ──────────────────────
function CausaView({ causa, onClose, onEdit, onDelete, onUpdate, onNavigateToCliente }) {
  const navigate = useNavigate()
  const { setActiveCausa, activeTab, setActiveTab } = useNavigation()

  // Restaurar la tab activa si es la misma causa que estaba abierta
  const [tab, setTabRaw] = useState(() => activeTab ?? 'resumen')
  const setTab = useCallback((t) => { setTabRaw(t); setActiveTab(t) }, [setActiveTab])

  // ── Exponer contexto al Quick Add global ──
  const { setCtx } = useQuickAdd()
  useEffect(() => {
    if (causa?.id) {
      setCtx({ causaId: causa.id, causaRit: causa.rit || '', clienteNombre: causa.cliente_nombre || '' })
    }
    return () => setCtx(null)
  }, [causa?.id])

  // ── Cmd+N dentro de una causa → acción rápida según tab activa ──────────
  useEffect(() => {
    const handler = () => {
      if (tab === 'seguimiento') { setNewSegRow({ fecha_revision: TODAY_C, por_hacer: '', que_se_hizo: 'Pendiente' }); return }
      if (tab === 'revisiones') { document.querySelector('[data-nueva-revision]')?.click(); return }
      if (tab === 'pjud' || tab === 'siau') { document.querySelector('[data-cmd-n]')?.click(); return }
      // Para otros tabs: disparar clic en el botón "+ Nuevo" de esa tab
      const newBtn = document.querySelector('[data-cmd-n]')
      newBtn?.click()
    }
    window.addEventListener('cmd-n', handler)
    return () => window.removeEventListener('cmd-n', handler)
  }, [tab, navigate])

  // ── Establecer causa activa en NavigationContext (para PJUD/SIAU/etc.) ──
  useEffect(() => {
    if (causa?.id) {
      setActiveCausa({
        id:             causa.id,
        rit:            causa.rit            || null,
        ruc:            causa.ruc            || null,
        materia:        causa.materia        || '',
        cliente_nombre: causa.cliente_nombre || '',
        cliente_id:     causa.cliente_id     || null,
        causa_key:      causa.id,            // alias para PJUD/SIAU
      })
    }
  }, [causa?.id, setActiveCausa])

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

  // Seguimiento (tabla simple)
  const [segRows,           setSegRows]           = useState([])
  const [loadingSeg,        setLoadingSeg]        = useState(false)
  const [newSegRow,         setNewSegRow]         = useState(null)
  const [editSegId,         setEditSegId]         = useState(null)
  const [editSegDraft,      setEditSegDraft]      = useState({})
  const [savingSegRow,      setSavingSegRow]      = useState(false)
  const [confirmDelSeg,     setConfirmDelSeg]     = useState(null)
  const [showCargaMasivaSeg, setShowCargaMasivaSeg] = useState(false)
  const [editingCell,       setEditingCell]       = useState(null)  // { id, field }
  const [cellDraft,         setCellDraft]         = useState('')
  const [openStatusId,      setOpenStatusId]      = useState(null) // kept for compatibility
  // Seguimiento — columnas redimensionables: [0]=FECHA [1]=ESTADO
  const { widths: segW, getResizerProps: segResizer } = useResizableColumns('cols-seguimiento', [100, 140])

  // Datos rápidos para el resumen (1 fila c/u)
  const [lastPjud,        setLastPjud]        = useState(undefined) // undefined = loading, null = empty
  const [lastSiau,        setLastSiau]        = useState(undefined)
  const [lastRevision,    setLastRevision]    = useState(undefined)

  // Timeline filter
  const [filterTimeline,  setFilterTimeline]  = useState('Todo')

  // Resumen — combined timeline filter
  const [tlFilter,        setTlFilter]        = useState('Todo')

  // Resumen — quick entry bar
  const [quickType,       setQuickType]       = useState('seguimiento')
  const [quickText,       setQuickText]       = useState('')
  const [savingQuick,     setSavingQuick]     = useState(false)

  // Resumen — current week revision banner
  const [currentWeekRev,  setCurrentWeekRev]  = useState(undefined) // undefined=loading, null=none
  const [weekRevDraft,    setWeekRevDraft]    = useState('')
  const [weekRevSaving,   setWeekRevSaving]   = useState(false)

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // ── SIAU/PJUD inline handlers (embedded table) ────────────────────────────
  const handleUpdateSiau = useCallback((id, cambios) => {
    setSiauRows(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
  }, [])
  const handleAddSiau = useCallback((row) => {
    setSiauRows(prev => [row, ...prev])
  }, [])
  const handleDeleteSiau = useCallback((id) => {
    setSiauRows(prev => prev.filter(r => r.id !== id))
  }, [])

  const handleUpdatePjud = useCallback((id, cambios) => {
    setPjudRows(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
  }, [])
  const handleAddPjud = useCallback(async (causaRit, causaRuc, clienteNombre, movData) => {
    const payload = {
      fecha: movData.fecha, folio: movData.folio, presenta: movData.presenta || 'Nosotros',
      tipo_solicitud: movData.tipo_solicitud || 'Solicitud',
      solicitud: movData.solicitud || null, respuesta: movData.respuesta || null,
      fecha_respuesta: movData.fecha_respuesta || null, fecha_notificacion: movData.fecha_notificacion || null,
      accion_requerida: movData.accion_requerida || null, consecuencia_procesal: movData.consecuencia_procesal || null,
      estado: movData.respuesta?.trim() ? 'Respondido' : (movData.estado || 'Pendiente'),
      tiene_documento: movData.tiene_documento || false, documento_desc: movData.documento_desc || null,
      notas: movData.notas || null, responsable: movData.responsable || 'MT',
      causa_rit: causaRit || null, causa_ruc: causaRuc || null,
      cliente_nombre: clienteNombre || movData.cliente_nombre || '',
      causa_id: movData.causa_id || causa?.id || null,
      cliente_id: movData.cliente_id || causa?.cliente_id || null,
    }
    const { data, error } = await supabase.from('pjud').insert([payload]).select().single()
    if (!error && data) setPjudRows(prev => [data, ...prev])
  }, [causa?.id, causa?.cliente_id])
  const handleDeletePjud = useCallback((id) => {
    setPjudRows(prev => prev.filter(r => r.id !== id))
  }, [])

  const handleAddTareaFromPjud = useCallback(async (tarea) => {
    const { data } = await supabase.from('tareas').insert([{
      titulo: tarea.titulo, estado: 'Pendiente', prioridad: tarea.prioridad || 'Media',
      fecha_vencimiento: tarea.fecha_vencimiento || null, notas: tarea.notas || null,
      cliente_nombre: tarea.cliente || null, causa_rit: tarea.causa_rit || null, causa_id: causa?.id || null,
    }]).select().single()
    if (data) setTareas(prev => [...prev, data])
  }, [causa?.id])

  const handleAddPlazoFromPjud = useCallback(async (plazo) => {
    const { data } = await supabase.from('plazos').insert([{
      titulo: plazo.titulo, tipo: plazo.tipo || 'Procesal',
      fecha_vencimiento: plazo.fecha_vencimiento || null, estado: 'Activo',
      notas: plazo.notas || null, causa_rit: plazo.causa_rit || null, causa_id: causa?.id || null,
    }]).select().single()
    if (data) setPlazos(prev => [...prev, data])
  }, [causa?.id])

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
    // Load last PJUD / SIAU — OR por causa_rit/causa_id para no perder registros
    {
      const pFilter = causa.rit ? `causa_rit.eq.${causa.rit},causa_id.eq.${causa.id}` : `causa_id.eq.${causa.id}`
      supabase.from('pjud').select('fecha,folio,estado,solicitud,respuesta').or(pFilter)
        .order('fecha', { ascending: false }).limit(1)
        .then(({ data }) => setLastPjud(data?.[0] ?? null))
      supabase.from('siau').select('fecha,folio,estado,solicitud,respuesta').or(pFilter)
        .order('fecha', { ascending: false }).limit(1)
        .then(({ data }) => setLastSiau(data?.[0] ?? null))
    }
    supabase.from('revisiones').select('fecha,responsable,nota,proxima_accion,semana_key').eq('causa_id', causa.id)
      .order('fecha', { ascending: false }).limit(3)
      .then(({ data }) => {
        const teamRev = (data ?? []).find(r => /^\d{4}-W\d{2}$/.test(r.semana_key ?? ''))
        setLastRevision(teamRev ?? null)
      })
  }, [causa?.id])

  // Load PJUD lazily (also for timeline and resumen) — OR por causa_rit/causa_id
  useEffect(() => {
    if ((tab !== 'pjud' && tab !== 'timeline' && tab !== 'resumen') || !causa?.id) return
    if (pjudRows.length > 0) return
    setLoadingPjud(true)
    const filter = causa.rit
      ? `causa_rit.eq.${causa.rit},causa_id.eq.${causa.id}`
      : `causa_id.eq.${causa.id}`
    supabase.from('pjud').select('*').or(filter).order('fecha', { ascending: false })
      .then(({ data }) => { setPjudRows(data ?? []); setLoadingPjud(false) })
  }, [tab, causa?.id, causa?.rit])

  // Load SIAU lazily (also for timeline and resumen) — OR por causa_rit/causa_id
  useEffect(() => {
    if ((tab !== 'siau' && tab !== 'timeline' && tab !== 'resumen') || !causa?.id) return
    if (siauRows.length > 0) return
    setLoadingSiau(true)
    const filter = causa.rit
      ? `causa_rit.eq.${causa.rit},causa_id.eq.${causa.id}`
      : `causa_id.eq.${causa.id}`
    supabase.from('siau').select('*').or(filter).order('fecha', { ascending: false })
      .then(({ data }) => { setSiauRows(data ?? []); setLoadingSiau(false) })
  }, [tab, causa?.id, causa?.rit])

  // Load revisiones when tab opens (or on mount for timeline)
  useEffect(() => {
    if ((tab !== 'seguimiento' && tab !== 'revisiones' && tab !== 'resumen') || !causa?.id) return
    if (revisiones.length > 0) return // already loaded
    setLoadingRev(true)
    supabase.from('revisiones').select('*').eq('causa_id', causa.id)
      .like('semana_key', '____-W%')
      .order('fecha', { ascending: false })
      .then(({ data }) => { setRevisiones(data ?? []); setLoadingRev(false) })
  }, [tab, causa?.id])

  // Load seguimiento rows — reset cache when causa changes
  useEffect(() => { setSegRows([]) }, [causa?.id])

  // Load seguimiento rows — includes null semana_key (daily) and SEG- (bulk-imported historical)
  useEffect(() => {
    if ((tab !== 'seguimiento' && tab !== 'revisiones' && tab !== 'resumen') || !causa?.id) return
    setLoadingSeg(true)
    // Filter by causa_rit (primary) or causa_id (fallback) to catch all records
    const query = causa.rit
      ? supabase.from('revisiones').select('*')
          .eq('causa_rit', causa.rit)
          .or('semana_key.is.null,semana_key.like.SEG-%')
          .order('fecha_revision', { ascending: false })
      : supabase.from('revisiones').select('*')
          .eq('causa_id', causa.id)
          .or('semana_key.is.null,semana_key.like.SEG-%')
          .order('fecha_revision', { ascending: false })
    query.then(({ data }) => { setSegRows(data ?? []); setLoadingSeg(false) })
  }, [tab, causa?.id])

  // Load current week revision for the banner
  useEffect(() => {
    if (!causa?.id) return
    const weekNum = getISOWeek_C(TODAY_C)
    const year = new Date().getFullYear()
    const semana_key = `${year}-W${String(weekNum).padStart(2, '0')}`
    supabase.from('revisiones').select('*').eq('causa_id', causa.id).eq('semana_key', semana_key)
      .maybeSingle().then(({ data }) => {
        setCurrentWeekRev(data ?? null)
        if (data?.revisada && data?.nota) setWeekRevDraft(data.nota)
      })
  }, [causa?.id])

  // Save/update current week revision from banner
  async function handleSaveWeekRev(revisada, nota) {
    if (!causa?.id) return
    setWeekRevSaving(true)
    const today = TODAY_C
    const weekNum = getISOWeek_C(today)
    const year = new Date().getFullYear()
    const semana_key = `${year}-W${String(weekNum).padStart(2, '0')}`
    const payload = {
      causa_id:       causa.id,
      causa_rit:      causa.rit || null,
      semana_key,
      revisada,
      nota:           nota || null,
      fecha:          today,
      responsable:    'MT',
    }
    const { data } = await supabase.from('revisiones')
      .upsert(payload, { onConflict: 'semana_key,causa_id' })
      .select().maybeSingle()
    if (data) setCurrentWeekRev(data)
    setWeekRevSaving(false)
    showToast(revisada ? 'Marcada como revisada ✓' : 'Marcada como no revisada')
  }

  // Save quick entry from the timeline input bar
  async function handleSaveQuickEntry() {
    if (!quickText.trim() || !causa?.id) return
    setSavingQuick(true)
    try {
      if (quickType === 'seguimiento') {
        const { data } = await supabase.from('revisiones').insert([{
          causa_id:       causa.id,
          causa_rit:      causa.rit  || null,
          cliente_nombre: causa.cliente_nombre || null,
          fecha_revision: TODAY_C,
          por_hacer:      quickText.trim(),
          que_se_hizo:    'Pendiente',
          semana_key:     null,
        }]).select().single()
        if (data) setSegRows(prev => [data, ...prev])
      } else if (quickType === 'tarea') {
        const { data } = await supabase.from('tareas').insert([{
          titulo:         quickText.trim(),
          estado:         'Pendiente',
          prioridad:      'Media',
          causa_id:       causa.id,
          causa_rit:      causa.rit  || null,
          cliente_nombre: causa.cliente_nombre || null,
        }]).select().single()
        if (data) setTareas(prev => [...prev, data])
      } else if (quickType === 'siau') {
        const { data } = await supabase.from('siau').insert([{
          solicitud:      quickText.trim(),
          fecha:          TODAY_C,
          estado:         'Pendiente',
          causa_rit:      causa.rit  || null,
          causa_id:       causa.id,
          cliente_nombre: causa.cliente_nombre || null,
        }]).select().single()
        if (data) setSiauRows(prev => [data, ...prev])
      } else if (quickType === 'pjud') {
        const { data } = await supabase.from('pjud').insert([{
          solicitud:      quickText.trim(),
          fecha:          TODAY_C,
          estado:         'Pendiente',
          causa_rit:      causa.rit  || null,
          causa_id:       causa.id,
          cliente_nombre: causa.cliente_nombre || null,
        }]).select().single()
        if (data) setPjudRows(prev => [data, ...prev])
      }
      setQuickText('')
      showToast('Guardado ✓')
    } finally {
      setSavingQuick(false)
    }
  }

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

  // Seguimiento — save new row
  async function handleSaveNewSegRow() {
    if (!newSegRow?.por_hacer?.trim()) return
    setSavingSegRow(true)
    const { data, error } = await supabase.from('revisiones').insert([{
      causa_id:       causa.id,
      causa_rit:      causa.rit       || null,
      cliente_nombre: causa.cliente_nombre || null,
      fecha_revision: newSegRow.fecha_revision || TODAY_C,
      por_hacer:      newSegRow.por_hacer.trim(),
      que_se_hizo:    newSegRow.que_se_hizo || 'Pendiente',
      notas:          newSegRow.notas?.trim() || null,
      semana_key:     null,
      revisada:       false,
    }]).select().single()
    if (!error && data) { setSegRows(prev => [data, ...prev]); showToast('Entrada guardada') }
    setNewSegRow(null)
    setSavingSegRow(false)
  }

  // Seguimiento — update row
  async function handleUpdateSegRow(id, changes) {
    const { data } = await supabase.from('revisiones').update(changes).eq('id', id).select().single()
    if (data) setSegRows(prev => prev.map(r => r.id === id ? data : r))
  }

  // Seguimiento — delete row
  async function handleDeleteSegRow(id) {
    await supabase.from('revisiones').delete().eq('id', id)
    setSegRows(prev => prev.filter(r => r.id !== id))
    setConfirmDelSeg(null)
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
  const isTeamRev = r => /^\d{4}-W\d{2}$/.test(r.semana_key ?? '')

  return (
    <>
    <div className="flex-1 min-w-0 flex flex-col h-full bg-white overflow-hidden">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2570BA] text-white text-[12px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <Check size={12} className="text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-8 pt-5 pb-0 border-b border-gray-100">

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between mb-3">

          {/* Breadcrumb: Causas › Cliente */}
          <div className="flex items-center gap-1 text-[12px] text-gray-400 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1 hover:text-gray-700 transition-colors group flex-shrink-0"
            >
              <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Causas</span>
            </button>
            {causa.cliente_nombre && (
              <>
                <span className="mx-0.5 text-gray-200 flex-shrink-0">›</span>
                <button
                  onClick={() => onNavigateToCliente?.(causa.cliente_nombre)}
                  className="hover:text-blue-500 transition-colors truncate max-w-[200px] text-left"
                  title={`Filtrar por ${causa.cliente_nombre}`}
                >
                  {causa.cliente_nombre}
                </button>
              </>
            )}
          </div>

          {/* Accesos directos cross-módulo */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/pjud')}
              title="Ver movimientos PJUD de esta causa"
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-[#2570ba] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Shield size={11} /> PJUD
            </button>
            <button
              onClick={() => navigate('/siau')}
              title="Ver solicitudes SIAU de esta causa"
              className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-[#2570ba] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Database size={11} /> SIAU
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
              title="Eliminar causa"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Cliente como link + materia editable inline */}
        <div className="mb-2">
          {causa.cliente_nombre && (
            <button
              onClick={() => onNavigateToCliente?.(causa.cliente_nombre)}
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5 hover:text-blue-500 hover:underline transition-colors cursor-pointer text-left block"
              title={`Filtrar causas de ${causa.cliente_nombre}`}
            >
              {causa.cliente_nombre}
            </button>
          )}
          {/* Materia editable inline */}
          <InlineField
            value={causa.materia || ''}
            onSave={v => v?.trim() && onUpdate?.({ materia: v.trim() })}
            placeholder="Materia del caso…"
            textClassName="text-[22px] font-bold text-gray-900 leading-snug"
            inputClassName="text-[20px] font-bold w-full"
          />
        </div>

        {/* ── Franja de identidad ── */}
        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mb-2">
          {/* Estado — único elemento con color */}
          {onUpdate
            ? <EstadoDropdown estado={causa.estado} onCambiar={e => onUpdate({ estado: e })} />
            : <EstadoBadge estado={causa.estado} />
          }
          {/* Área · Parte · Etapa en gris, separados por punto medio */}
          {[causa.area, causa.parte, causa.etapa_procesal].filter(Boolean).map((v, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="text-gray-200">·</span>
              <span className="text-[12px] text-gray-400">{v}</span>
            </span>
          ))}
          {/* Tribunal — inline editable, solo si tiene valor */}
          {causa.tribunal && (
            <span className="flex items-center gap-2">
              <span className="text-gray-200">·</span>
              <InlineField
                value={causa.tribunal}
                onSave={v => onUpdate?.({ tribunal: v.trim() || null })}
                placeholder=""
                textClassName="text-[12px] text-gray-400"
                inputClassName="text-[12px] w-52"
              />
            </span>
          )}
          {/* Fiscalía — solo si tiene valor */}
          {causa.fiscalia && (
            <span className="flex items-center gap-2">
              <span className="text-gray-200">·</span>
              <InlineField
                value={causa.fiscalia}
                onSave={v => onUpdate?.({ fiscalia: v.trim() || null })}
                placeholder=""
                textClassName="text-[12px] text-gray-400"
                inputClassName="text-[12px] w-48"
              />
            </span>
          )}
          {/* Fiscal — solo si tiene valor */}
          {causa.fiscal && (
            <span className="flex items-center gap-2">
              <span className="text-gray-200">·</span>
              <InlineField
                value={causa.fiscal}
                onSave={v => onUpdate?.({ fiscal: v.trim() || null })}
                placeholder=""
                textClassName="text-[12px] text-gray-400"
                inputClassName="text-[12px] w-36"
              />
            </span>
          )}
          {/* RIT | RUC — extremo derecho, mono gris sin fondos de color */}
          {(causa.rit || causa.ruc) && (
            <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
              {causa.rit && (
                <CopyValue value={causa.rit} prefix="RIT" className="text-[11px] text-gray-400" />
              )}
              {causa.rit && causa.ruc && <span className="text-gray-200 text-[11px]">|</span>}
              {causa.ruc && (
                <CopyValue value={causa.ruc} prefix="RUC" className="text-[11px] text-gray-400" />
              )}
            </div>
          )}
        </div>

        {/* Chips informativos — próxima audiencia y plazo crítico */}
        {(proxAudiencia || proxPlazo) && (
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {proxAudiencia && (
              <button
                onClick={() => setTab('audiencias')}
                className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Calendar size={10} className="text-purple-400 flex-shrink-0" />
                <span className="text-[11px] font-medium text-purple-700">
                  {fmtFechaCausa(proxAudiencia.fecha)}
                  {proxAudiencia.hora ? ` · ${proxAudiencia.hora}` : ''}
                </span>
              </button>
            )}
            {proxPlazo && (() => {
              const dias = Math.round((new Date(proxPlazo.fecha_vencimiento) - new Date(TODAY_C)) / 86400000)
              const urgente = dias <= 5
              return (
                <button
                  onClick={() => setTab('plazos')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${urgente ? 'bg-red-50 hover:bg-red-100' : 'bg-amber-50 hover:bg-amber-100'}`}
                >
                  <Clock size={10} className={urgente ? 'text-red-400 flex-shrink-0' : 'text-amber-400 flex-shrink-0'} />
                  <span className={`text-[11px] font-medium ${urgente ? 'text-red-700' : 'text-amber-700'}`}>
                    {fmtFechaCausa(proxPlazo.fecha_vencimiento)}
                    {dias === 0 ? ' · hoy' : dias === 1 ? ' · mañana' : ` · ${dias}d`}
                  </span>
                </button>
              )
            })()}
          </div>
        )}

        {/* ── Tabs unificadas ── */}
        {(() => {
          const plazosActivos = plazos.filter(p => p.estado === 'Activo').length
          const plazosUrgentes = plazos.filter(p => {
            const dias = Math.round((new Date(p.fecha_vencimiento + 'T00:00:00') - new Date(TODAY_C + 'T00:00:00')) / 86400000)
            return p.estado === 'Activo' && dias <= 5
          }).length
          const tareasUrgentes = tareas.filter(t => t.estado !== 'Completada' && (t.prioridad === 'Alta' || (t.fecha_vencimiento && t.fecha_vencimiento <= TODAY_C))).length
          const audProximas = audiencias.filter(a => {
            const dias = Math.round((new Date(a.fecha + 'T00:00:00') - new Date(TODAY_C + 'T00:00:00')) / 86400000)
            return dias >= 0 && dias <= 7
          }).length
          const revCount = revisiones.filter(isTeamRev).length
          const chips = [
            { key: 'resumen',     Icon: AlignLeft,   label: 'Resumen',     count: null,                    urgent: false },
            { key: 'siau',        Icon: Database,    label: 'SIAU',        count: siauRows.length || null, urgent: siauRows.some(r => r.estado === 'Urgente') },
            { key: 'pjud',        Icon: Shield,      label: 'PJUD',        count: pjudRows.length || null, urgent: pjudRows.some(r => r.estado === 'Urgente') },
            { key: 'audiencias',  Icon: Gavel,       label: 'Audiencias',  count: audiencias.length,       urgent: audProximas > 0 },
            { key: 'tareas',      Icon: CheckSquare, label: 'Tareas',      count: tareasPend,              urgent: tareasUrgentes > 0 },
            { key: 'plazos',      Icon: Clock,       label: 'Plazos',      count: plazosActivos,           urgent: plazosUrgentes > 0 },
            { key: 'documentos',  Icon: FileText,    label: 'Docs',        count: null,                    urgent: false },
            { key: 'seguimiento', Icon: Target,      label: 'Seguimiento', count: segRows.length || null,  urgent: false },
            { key: 'revisiones',  Icon: BookOpen,    label: 'Revisiones',  count: revCount || null,        urgent: false },
          ]
          return (
            <div className="flex items-center gap-1.5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {chips.map(({ key, Icon, label, count, urgent }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  title={`Ir a ${label}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                    tab === key
                      ? 'bg-[#1A2E4A] text-white'
                      : urgent
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-[#4A5568] hover:bg-[#F7F8FA] hover:text-[#1C2533]'
                  }`}
                >
                  <Icon size={11} className="flex-shrink-0" />
                  {label}
                  {count !== null && count > 0 && (
                    <span className={`text-[9px] font-semibold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ${
                      tab === key ? 'bg-white/20 text-white' : urgent ? 'bg-red-100 text-red-600' : 'bg-[#F1F2F4] text-[#6B7280]'
                    }`}>
                      {count}
                    </span>
                  )}
                  {urgent && tab !== key && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )
        })()}

      </div>


      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto">

        {/* RESUMEN — diseño completo */}
        {tab === 'resumen' && (() => {
          // Week info
          const weekNum  = getISOWeek_C(TODAY_C)
          const yearNow  = new Date().getFullYear()
          const d0       = new Date(TODAY_C + 'T00:00:00')
          const dow      = d0.getDay() || 7
          const mon      = new Date(d0); mon.setDate(d0.getDate() - dow + 1)
          const sun      = new Date(mon); sun.setDate(mon.getDate() + 6)
          const fmtDay   = dt => `${dt.getDate()} ${MESES_C[dt.getMonth()]}`
          const weekLabel = `Semana ${weekNum} · ${fmtDay(mon)} – ${fmtDay(sun)}`

          // Derived data
          const proxAud       = audiencias.filter(a => a.fecha >= TODAY_C).sort((a,b)=>a.fecha.localeCompare(b.fecha))[0] ?? null
          const audDias       = proxAud ? Math.round((new Date(proxAud.fecha+'T00:00:00')-new Date(TODAY_C+'T00:00:00'))/86400000) : null
          const proxPlazo     = plazos.filter(p=>p.fecha_vencimiento>=TODAY_C&&p.estado==='Activo').sort((a,b)=>a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]??null
          const tareasPendList= tareas.filter(t=>t.estado!=='Completada').sort((a,b)=>{
            if(a.prioridad==='Alta'&&b.prioridad!=='Alta')return -1
            if(b.prioridad==='Alta'&&a.prioridad!=='Alta')return 1
            return(a.fecha_vencimiento??'9999').localeCompare(b.fecha_vencimiento??'9999')
          })
          const siauSinResp   = siauRows.filter(r=>!r.respuesta?.trim())
          const oldestSiauDias= siauSinResp.length>0
            ? Math.round((new Date(TODAY_C+'T00:00:00')-new Date(siauSinResp[siauSinResp.length-1].fecha+'T00:00:00'))/86400000)
            : null
          const lastSegFecha  = segRows[0]?.fecha_revision ?? segRows[0]?.fecha
          const lastSegDias   = lastSegFecha
            ? Math.round((new Date(TODAY_C+'T00:00:00')-new Date(lastSegFecha+'T00:00:00'))/86400000)
            : null

          // Combined timeline
          const allItems = [
            ...segRows.map(r=>({id:`seg-${r.id}`,type:'seguimiento',date:r.fecha_revision??r.fecha,primary:r.por_hacer||r.nota||'—',secondary:r.que_se_hizo,notas:r.notas??r.nota,raw:r})),
            ...siauRows.map(r=>({id:`siau-${r.id}`,type:'siau',date:r.fecha,primary:r.solicitud||r.folio||'—',secondary:r.estado,folio:r.folio,raw:r})),
            ...pjudRows.map(r=>({id:`pjud-${r.id}`,type:'pjud',date:r.fecha,primary:r.solicitud||r.folio||'—',secondary:r.estado,folio:r.folio,raw:r})),
            ...audiencias.map(a=>({id:`aud-${a.id}`,type:'audiencia',date:a.fecha,primary:a.tipo||'Audiencia',secondary:a.hora,raw:a})),
            ...tareas.map(t=>({id:`tar-${t.id}`,type:'tarea',date:t.fecha_vencimiento||t.created_at?.slice(0,10),primary:t.titulo,secondary:t.estado,raw:t})),
          ].sort((a,b)=>{ if(!a.date&&!b.date)return 0; if(!a.date)return 1; if(!b.date)return -1; return b.date.localeCompare(a.date) })
          const filteredTl = tlFilter==='Todo' ? allItems : allItems.filter(i=>i.type===tlFilter)

          const TYPE_CFG = {
            seguimiento:{ bg:'bg-blue-50',   text:'text-blue-600',   border:'border-blue-100',   dot:'bg-blue-400',   label:'Seguimiento', Icon:BookOpen    },
            siau:       { bg:'bg-violet-50', text:'text-violet-600', border:'border-violet-100', dot:'bg-violet-400', label:'SIAU',        Icon:Database    },
            pjud:       { bg:'bg-emerald-50',text:'text-emerald-600',border:'border-emerald-100',dot:'bg-emerald-400',label:'PJUD',        Icon:Scale       },
            audiencia:  { bg:'bg-amber-50',  text:'text-amber-600',  border:'border-amber-100',  dot:'bg-amber-400',  label:'Audiencia',   Icon:Gavel       },
            tarea:      { bg:'bg-rose-50',   text:'text-rose-600',   border:'border-rose-100',   dot:'bg-rose-400',   label:'Tarea',       Icon:CheckSquare },
          }
          const tlLoading = loadingBase || loadingSeg || loadingPjud || loadingSiau

          return (
          <div className="flex flex-col h-full overflow-hidden">

            {/* ── 4 PULSE CARDS ────────────────────────────────────────── */}
            <div className="flex-shrink-0 grid grid-cols-4 border-b border-gray-100">
              {[
                { label:'SIAU sin resp.',
                  value: siauSinResp.length>0?`${siauSinResp.length} pendiente${siauSinResp.length>1?'s':''}`:'Al día',
                  sub:   oldestSiauDias!==null?`Más antigua: hace ${oldestSiauDias}d`:null,
                  urgent:(oldestSiauDias??0)>15, color:'amber', Icon:Database, onClick:()=>setTab('siau') },
                { label:'Próxima audiencia',
                  value: proxAud?`${fmtFechaCausa(proxAud.fecha)}${proxAud.hora?` · ${proxAud.hora}`:''}` :'Sin programar',
                  sub:   audDias!==null?(audDias===0?'Hoy':audDias===1?'Mañana':`En ${audDias} días`):null,
                  urgent:audDias!==null&&audDias<=1, color:'green', Icon:Gavel, onClick:()=>setTab('audiencias') },
                { label:'Último seguimiento',
                  value: lastSegDias===null?'Sin registros':lastSegDias===0?'Hoy':lastSegDias===1?'Ayer':`Hace ${lastSegDias} días`,
                  sub:   (segRows[0]?.por_hacer||segRows[0]?.nota)?.slice(0,45)||null,
                  urgent:false, color:'gray', Icon:BookOpen, onClick:()=>setTab('seguimiento') },
                { label:'Tareas pendientes',
                  value: tareasPendList.length===0?'Sin pendientes':`${tareasPendList.length} tarea${tareasPendList.length>1?'s':''}`,
                  sub:   tareasPendList[0]?.titulo?.slice(0,40)||null,
                  urgent:tareasPendList.length>0, color:'red', Icon:CheckSquare, onClick:()=>setTab('tareas') },
              ].map(({ label,value,sub,urgent,color,Icon,onClick })=>(
                <button key={label} onClick={onClick}
                  className={`text-left p-3.5 border-r border-gray-100 last:border-r-0 transition-colors hover:bg-gray-50/80 ${urgent?'bg-rose-50/40':''}`}>
                  <div className={`flex items-center gap-1 mb-1.5 text-[9px] font-bold uppercase tracking-widest ${
                    urgent?'text-rose-400':color==='amber'?'text-amber-500':color==='green'?'text-emerald-500':color==='gray'?'text-slate-400':'text-rose-400'
                  }`}><Icon size={9}/>{label}</div>
                  <p className={`text-[13px] font-semibold leading-snug ${urgent?'text-rose-700':'text-gray-800'}`}>{value}</p>
                  {sub&&<p className={`text-[10px] mt-0.5 truncate ${urgent?'text-rose-400':'text-gray-400'}`}>{sub}</p>}
                </button>
              ))}
            </div>

            {/* ── BANNER REVISIÓN SEMANAL ──────────────────────────────── */}
            <div className="flex-shrink-0 mx-4 my-2 rounded-xl border border-[#E2E5EA] bg-white flex items-center gap-3 px-4 py-2.5">
              <Calendar size={13} className="text-gray-400 flex-shrink-0"/>
              <span className="text-[12px] font-medium text-gray-600 flex-shrink-0">{weekLabel}</span>
              <span className="text-gray-200 flex-shrink-0">·</span>
              <span className="text-[12px] text-gray-500 flex-shrink-0">Revisado esta semana:</span>
              {currentWeekRev===undefined ? (
                <div className="h-6 w-28 bg-gray-100 rounded-lg animate-pulse"/>
              ) : (
                <select
                  value={currentWeekRev?.revisada===true?'SI':currentWeekRev?.revisada===false?'NO':''}
                  onChange={async e=>{
                    const v=e.target.value
                    await handleSaveWeekRev(v==='SI'?true:v==='NO'?false:null, currentWeekRev?.nota||null)
                  }}
                  disabled={weekRevSaving}
                  className="text-[12px] border border-[#E2E5EA] bg-[#F7F8FA] rounded-lg px-3 py-1 focus:outline-none focus:border-gray-300 text-gray-600 cursor-pointer appearance-none min-w-[120px] disabled:opacity-60"
                  style={{backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center',paddingRight:'24px'}}
                >
                  <option value="">— Sin marcar</option>
                  <option value="SI">✓ Sí, revisada</option>
                  <option value="NO">✗ No revisada</option>
                </select>
              )}
              {currentWeekRev?.revisada&&(
                currentWeekRev?.nota
                  ?<span className="text-[11px] text-gray-500 truncate flex-1 mx-1">{currentWeekRev.nota}</span>
                  :<button onClick={()=>setShowRevForm(true)} className="text-[11px] text-gray-400 hover:text-gray-600 mx-1 underline">+ agregar nota</button>
              )}
              <button onClick={()=>setTab('seguimiento')}
                className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#E2E5EA] bg-[#F7F8FA] text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors whitespace-nowrap">
                <Clock size={11}/>
                Ver historial
              </button>
            </div>

            {/* ── DOS COLUMNAS ─────────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0">

              {/* ── IZQUIERDA 60% — Expediente tipo chat ─────────────── */}
              <div className="flex-[3] min-w-0 flex flex-col border-r border-gray-100">

                {/* Filter pills */}
                <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-gray-50 overflow-x-auto" style={{scrollbarWidth:'none'}}>
                  {['Todo','seguimiento','siau','pjud','audiencia','tarea'].map(f=>{
                    const cfg  = TYPE_CFG[f]
                    const cnt  = f==='Todo'?allItems.length:allItems.filter(i=>i.type===f).length
                    const active = tlFilter===f
                    return (
                      <button key={f} onClick={()=>setTlFilter(f)}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full border whitespace-nowrap transition-all ${
                          active?(cfg?`${cfg.bg} ${cfg.text} ${cfg.border}`:'bg-[#1a2e4a] text-white border-[#1a2e4a]'):'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                        }`}>
                        {cfg&&<cfg.Icon size={9}/>}
                        {cfg?cfg.label:'Todo'}
                        {cnt>0&&<span className="ml-0.5 opacity-60">{cnt}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Timeline feed */}
                <div className="flex-1 overflow-y-auto">
                  {tlLoading&&filteredTl.length===0 ? (
                    <div className="p-4 space-y-3">
                      {[1,2,3].map(i=>(
                        <div key={i} className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-gray-100 mt-2 flex-shrink-0"/>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-20"/>
                            <div className="h-10 bg-gray-50 rounded-xl animate-pulse"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredTl.length===0 ? (
                    <div className="flex flex-col items-center justify-center h-32">
                      <Activity size={22} className="text-gray-200 mb-2"/>
                      <p className="text-[12px] text-gray-400">Sin actividad registrada</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">Usa la barra de abajo para agregar</p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 space-y-0">
                      {filteredTl.map((item,i)=>{
                        const cfg      = TYPE_CFG[item.type]||TYPE_CFG.seguimiento
                        const showDate = i===0||filteredTl[i-1].date!==item.date
                        const tabTarget= item.type==='seguimiento'?'seguimiento':item.type==='siau'?'siau':item.type==='pjud'?'pjud':item.type==='audiencia'?'audiencias':'tareas'
                        return (
                          <div key={item.id}>
                            {showDate&&item.date&&(
                              <div className="flex items-center gap-2 py-1.5">
                                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">{fmtFechaCausa(item.date)}</span>
                                <div className="flex-1 h-px bg-gray-100"/>
                              </div>
                            )}
                            <div className="flex gap-2.5 group">
                              <div className="flex flex-col items-center pt-1.5">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}/>
                                {i<filteredTl.length-1&&<div className="w-px flex-1 bg-gray-100 mt-0.5 mb-0 min-h-[8px]"/>}
                              </div>
                              <div className={`flex-1 min-w-0 rounded-xl border px-3 py-2 mb-1.5 hover:shadow-sm transition-all cursor-pointer ${cfg.bg} ${cfg.border}`}
                                onClick={()=>setTab(tabTarget)}>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                                  {item.folio&&(
                                    <span onClick={e=>e.stopPropagation()}>
                                      <CopyValue value={item.folio} className={`font-mono text-[10px] ${cfg.text}`}/>
                                    </span>
                                  )}
                                  <span className="ml-auto text-[9px] text-gray-400 flex-shrink-0">{fmtRelDate(item.date)}</span>
                                </div>
                                <p className="text-[12px] text-gray-800 leading-snug line-clamp-2">{item.primary}</p>
                                {item.notas&&<p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{item.notas}</p>}
                                {item.secondary&&(
                                  <span className={`inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                    {item.secondary}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Quick entry bar */}
                <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
                  <div className="flex items-center gap-1.5 mb-2">
                    {['seguimiento','tarea','siau','pjud'].map(t=>{
                      const cfg = TYPE_CFG[t]
                      return (
                        <button key={t} onClick={()=>setQuickType(t)}
                          className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all ${
                            quickType===t?`${cfg.bg} ${cfg.text} ${cfg.border}`:'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                          }`}>
                          <cfg.Icon size={9}/>{cfg.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={quickText}
                      onChange={e=>setQuickText(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(quickText.trim())handleSaveQuickEntry()}
                        if(e.key==='Escape'){setQuickText('')}
                      }}
                      placeholder={
                        quickType==='seguimiento'?'¿Qué se está haciendo?…':
                        quickType==='tarea'?'Título de la tarea…':
                        quickType==='siau'?'Solicitud SIAU…':'Solicitud PJUD…'
                      }
                      rows={2}
                      className="flex-1 text-[12px] border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#2570ba]/40 bg-white leading-relaxed placeholder-gray-300"
                    />
                    <button onClick={handleSaveQuickEntry} disabled={!quickText.trim()||savingQuick}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-white text-[11px] font-medium disabled:opacity-40 transition-opacity self-end"
                      style={{backgroundColor:'#2570BA'}}>
                      {savingQuick?<Loader2 size={13} className="animate-spin"/>:<Plus size={13}/>}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-300 mt-1.5">Enter guarda · Shift+Enter nueva línea · Escape limpia</p>
                </div>
              </div>

              {/* ── DERECHA 40% — Paneles compactos ─────────────────── */}
              <div className="flex-[2] min-w-0 overflow-y-auto px-4 py-4 space-y-4">

                {/* Info procesal */}
                <section className="rounded-xl bg-gray-50/60 border border-gray-100 p-3 space-y-1.5">
                  {[
                    ['RIT',     causa.rit,            true ],
                    ['RUC',     causa.ruc,            true ],
                    ['Tribunal',causa.tribunal,       false],
                    ['Fiscalía',causa.fiscalia,       false],
                    ['Fiscal',  causa.fiscal,         false],
                    ['Etapa',   causa.etapa_procesal, false],
                    ['Parte',   causa.parte,          false],
                  ].filter(([,v])=>v).map(([lbl,val,mono])=>(
                    <div key={lbl} className="flex items-start gap-2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider w-12 flex-shrink-0 pt-0.5">{lbl}</span>
                      {mono?<CopyValue value={val} className="text-[11px] text-gray-700"/>
                           :<span className="text-[11px] text-gray-700 leading-snug">{val}</span>}
                    </div>
                  ))}
                </section>

                {/* Próxima audiencia */}
                {proxAud&&(
                  <section>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-1.5">Próxima audiencia</p>
                    <button onClick={()=>setTab('audiencias')}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                        audDias!==null&&audDias<=1?'border-red-200 bg-red-50/40 hover:bg-red-50/60':'border-purple-100 bg-purple-50/30 hover:bg-purple-50/50'
                      }`}>
                      <p className="text-[12px] font-semibold text-gray-800">{proxAud.tipo||'Audiencia'}</p>
                      <p className={`text-[11px] mt-0.5 font-medium ${audDias!==null&&audDias<=1?'text-red-600':'text-purple-600'}`}>
                        {fmtFechaCausa(proxAud.fecha)}{proxAud.hora?` · ${proxAud.hora}`:''}
                        {audDias===0?' — hoy':audDias===1?' — mañana':audDias!==null?` — en ${audDias}d`:''}
                      </p>
                    </button>
                  </section>
                )}

                {/* Tareas pendientes */}
                {tareasPendList.length>0&&(
                  <section>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300">Tareas pendientes</p>
                      <button onClick={()=>setTab('tareas')} className="text-[9px] text-gray-400 hover:text-gray-600">Ver todas →</button>
                    </div>
                    <div className="space-y-1">
                      {tareasPendList.slice(0,5).map(t=>(
                        <div key={t.id} className="flex items-center gap-2 py-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.prioridad==='Alta'?'bg-red-400':'bg-amber-300'}`}/>
                          <p className="text-[11px] text-gray-700 flex-1 truncate">{t.titulo}</p>
                          {t.fecha_vencimiento&&<span className="text-[10px] text-gray-400 flex-shrink-0">{fmtFechaCausa(t.fecha_vencimiento)}</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Último SIAU */}
                {lastSiau&&(
                  <section>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300">Último SIAU</p>
                      <button onClick={()=>setTab('siau')} className="text-[9px] text-gray-400 hover:text-gray-600">Ver todos →</button>
                    </div>
                    <div onClick={()=>setTab('siau')}
                      className="px-3 py-2.5 rounded-xl border border-violet-100 bg-violet-50/30 hover:bg-violet-50/50 cursor-pointer transition-colors">
                      {lastSiau.folio&&<span onClick={e=>e.stopPropagation()}><CopyValue value={lastSiau.folio} className="font-mono text-[10px] text-violet-600 mb-1 block"/></span>}
                      <p className="text-[11px] text-gray-700 line-clamp-2 leading-snug">{lastSiau.solicitud||'—'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{[lastSiau.estado,fmtRelDate(lastSiau.fecha)].filter(Boolean).join(' · ')}</p>
                    </div>
                  </section>
                )}

                {/* Último PJUD */}
                {lastPjud&&(
                  <section>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300">Último PJUD</p>
                      <button onClick={()=>setTab('pjud')} className="text-[9px] text-gray-400 hover:text-gray-600">Ver todos →</button>
                    </div>
                    <div onClick={()=>setTab('pjud')}
                      className="px-3 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/50 cursor-pointer transition-colors">
                      {lastPjud.folio&&<span onClick={e=>e.stopPropagation()}><CopyValue value={lastPjud.folio} className="font-mono text-[10px] text-emerald-600 mb-1 block"/></span>}
                      <p className="text-[11px] text-gray-700 line-clamp-2 leading-snug">{lastPjud.solicitud||'—'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{[lastPjud.estado,fmtRelDate(lastPjud.fecha)].filter(Boolean).join(' · ')}</p>
                    </div>
                  </section>
                )}

                {/* Próximo plazo */}
                {proxPlazo&&(
                  <section>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-1.5">Próximo plazo</p>
                    <button onClick={()=>setTab('plazos')}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-amber-100 bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                      <p className="text-[11px] font-semibold text-gray-800">{proxPlazo.titulo||'—'}</p>
                      <p className="text-[10px] text-amber-600 mt-0.5">Vence {fmtRelDate(proxPlazo.fecha_vencimiento)}</p>
                    </button>
                  </section>
                )}

                {/* Notas */}
                <section>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 mb-1.5">Notas</p>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <InlineField
                      value={causa.observaciones}
                      onSave={v=>onUpdate?.({observaciones:v||null})}
                      type="textarea"
                      placeholder="Notas sobre esta causa…"
                      debounce={1200}
                      textClassName="text-[12px] text-gray-700 leading-relaxed whitespace-pre-line"
                      inputClassName="text-[12px] bg-transparent"
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>
          )
        })()}

        {/* REVISIONES FORMALES */}

        {tab === 'revisiones' && (
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1C2533]">Bitácora de revisiones</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Historial de revisiones de equipo · {revisiones.filter(isTeamRev).length} registros
                </p>
              </div>
              {!showRevForm && (
                <button
                  data-nueva-revision
                  onClick={() => setShowRevForm(true)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-white px-3.5 py-2 rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#2570BA' }}
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
                    style={{ backgroundColor: '#2570BA' }}
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
            ) : revisiones.filter(isTeamRev).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RefreshCw size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] text-gray-400 font-medium">Sin revisiones de equipo registradas</p>
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
                  {revisiones.filter(isTeamRev).map((rev, i) => {
                    const weekNum = rev.semana_key ? parseInt(rev.semana_key.split('-W')[1]) : null
                    const year    = rev.semana_key ? parseInt(rev.semana_key.split('-W')[0]) : null
                    const isFirst = i === 0
                    const accionStyle = ACCION_STYLES_C[rev.proxima_accion] || 'bg-gray-50 text-gray-400'
                    const isEditing = editRevId === rev.id
                    return (
                      <div key={rev.id} className="relative pl-6">
                        {/* Dot */}
                        <div className={`absolute left-0 top-2 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                          rev.urgente ? 'border-red-400 bg-red-400' :
                          isFirst ? 'border-[#2570BA] bg-[#2570BA]' : 'border-gray-200 bg-white'
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
                                  style={{ backgroundColor: '#2570BA' }}
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

        {/* TIMELINE — eliminado, el historial vive en Resumen */}
        {false && (() => {
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
            ...revisiones.filter(isTeamRev).map(r => ({
              id: `r-${r.id}`, fecha: r.fecha, tipo: 'Revisión',
              titulo: r.proxima_accion || 'Revisión semanal',
              subtitulo: RESPONSABLE_NAMES_C[r.responsable] || r.responsable || null,
              detalle: r.nota || null,
              color: r.urgente ? 'red' : 'slate', Icon: RefreshCw,
              futuro: false, urgente: r.urgente,
              navTab: 'seguimiento',
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
                            : 'bg-[#2570BA] text-white border-[#2570BA]'
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
          loadingPjud ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <MovimientosTable
              causaData={{ causa_rit: causa.rit, causa_ruc: causa.ruc || null, causaInfo: causa, clienteNombre: causa.cliente_nombre }}
              rowsAll={pjudRows}
              onUpdate={handleUpdatePjud}
              onAdd={handleAddPjud}
              onDelete={handleDeletePjud}
              causasInfo={[]}
              addTarea={handleAddTareaFromPjud}
              addPlazo={handleAddPlazoFromPjud}
              onBack={() => {}}
              embedded
            />
          )
        )}

        {/* SIAU */}
        {tab === 'siau' && (
          loadingSiau ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <SolicitudesTable
              grupo={{ causa_rit: causa.rit, causa_ruc: causa.ruc || null, causaInfo: causa }}
              registrosAll={siauRows}
              onUpdate={handleUpdateSiau}
              onAdd={handleAddSiau}
              onDelete={handleDeleteSiau}
              causasInfo={[]}
              onBack={() => {}}
              clienteNombre={causa.cliente_nombre}
              embedded
            />
          )
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

        {/* SEGUIMIENTO */}
        {tab === 'seguimiento' && (() => {
          const SEG_ESTADO = {
            'Pendiente':     { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
            'En progreso':   { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
            'Listo':         { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
            'Sin novedades': { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
          }
          const SEG_ESTADO_FALLBACK = { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' }

          function fmtSegFecha(iso) {
            if (!iso) return '—'
            const [y, m, d] = iso.split('-')
            return `${d}/${m}/${y}`
          }

          const isEditingCell = (id, field) => editingCell?.id === id && editingCell?.field === field

          function startEdit(id, field, value) {
            setEditingCell({ id, field })
            setCellDraft(value ?? '')
          }

          async function commitCell(id, field) {
            const original = segRows.find(r => r.id === id)?.[field] ?? null
            const newVal = cellDraft.trim() || null
            setEditingCell(null)
            if (newVal === original) return
            await handleUpdateSegRow(id, { [field]: newVal })
          }

          return (
            <div className="flex flex-col">
              {/* Sub-header */}
              <div className="px-6 py-3 border-b border-[#E2E5EA] border-t flex items-center justify-between flex-shrink-0 bg-[#F7F8FA]">
                <p className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider">
                  Seguimiento diario · {segRows.length} entrada{segRows.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowCargaMasivaSeg(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                    <Table2 size={13}/> Carga masiva
                  </button>
                  <button
                    onClick={() => { setNewSegRow({ fecha_revision: TODAY_C, por_hacer: '', que_se_hizo: 'Pendiente', notas: '' }); setEditingCell(null) }}
                    disabled={!!newSegRow}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 disabled:opacity-40 transition-colors shadow-sm">
                    <Plus size={13}/> Agregar
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                {loadingSeg ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={20} className="animate-spin text-gray-300"/>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 36 }} />
                      <col style={{ width: segW[0] }} />
                      <col />
                      <col style={{ width: segW[1] }} />
                      <col style={{ width: 36 }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-gray-50/90" style={{ backdropFilter: 'blur(4px)', borderBottom: '1px solid #efefef' }}>
                      <tr>
                        <th />
                        <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider relative select-none">
                          Fecha
                          <div {...segResizer(0)} className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center z-10" onClick={e=>e.stopPropagation()}>
                            <div className="w-px h-4 bg-[#2570ba]/30 opacity-0 hover:opacity-100 transition-opacity" />
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Gestión / Observación</th>
                        <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider relative select-none">
                          Estado
                          <div {...segResizer(1)} className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center z-10" onClick={e=>e.stopPropagation()}>
                            <div className="w-px h-4 bg-[#2570ba]/30 opacity-0 hover:opacity-100 transition-opacity" />
                          </div>
                        </th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>

                      {/* New row */}
                      {newSegRow && (
                        <tr style={{ background: 'rgba(37,112,186,0.03)', borderBottom: '1px solid #f0f0f0' }}>
                          <td className="px-3 py-3" />
                          <td className="px-3 py-3">
                            <input type="date" value={newSegRow.fecha_revision || TODAY_C}
                              onChange={e => setNewSegRow(p => ({ ...p, fecha_revision: e.target.value }))}
                              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-full"/>
                          </td>
                          <td className="px-3 py-3">
                            <textarea value={newSegRow.por_hacer || ''} onChange={e => setNewSegRow(p => ({ ...p, por_hacer: e.target.value }))}
                              rows={2} autoFocus placeholder="¿Qué hay que hacer?"
                              className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-300 bg-white placeholder:text-gray-300"/>
                          </td>
                          <td className="px-3 py-3">
                            <input type="text" value={newSegRow.que_se_hizo || ''}
                              onChange={e => setNewSegRow(p => ({ ...p, que_se_hizo: e.target.value }))}
                              placeholder="Ej: Pendiente, Listo…"
                              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-full" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <button onClick={handleSaveNewSegRow} disabled={savingSegRow || !newSegRow.por_hacer?.trim()}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-colors">
                                {savingSegRow ? <Loader2 size={11} className="animate-spin"/> : <Check size={11}/>}
                              </button>
                              <button onClick={() => setNewSegRow(null)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                                <X size={11}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Empty state */}
                      {!newSegRow && segRows.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <div className="py-16 text-center">
                              <Target size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-200"/>
                              <p className="text-[13px] text-gray-400 font-medium">Sin entradas de seguimiento</p>
                              <button onClick={() => setNewSegRow({ fecha_revision: TODAY_C, por_hacer: '', que_se_hizo: 'Pendiente', notas: '' })}
                                className="mt-2 text-[12px] text-[#2570ba] hover:underline font-medium">
                                + Agregar primera entrada
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Data rows */}
                      {segRows.map(row => {
                        const isRevisada   = !!row.revisada
                        const isDelConfirm = confirmDelSeg === row.id
                        const estadoC      = SEG_ESTADO[row.que_se_hizo] || SEG_ESTADO_FALLBACK

                        return (
                          <tr key={row.id}
                            className={`group transition-colors hover:bg-gray-50/60 ${isRevisada ? 'opacity-40' : ''}`}
                            style={{ borderBottom: '1px solid #f5f5f5' }}>

                            {/* Checkbox */}
                            <td className="px-3 py-3 align-top">
                              <button
                                onClick={() => handleUpdateSegRow(row.id, { revisada: !isRevisada })}
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all mt-0.5 flex-shrink-0 ${
                                  isRevisada
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-gray-300 hover:border-gray-400 bg-white'
                                }`}
                              >
                                {isRevisada && <Check size={9} strokeWidth={2.5}/>}
                              </button>
                            </td>

                            {/* Fecha */}
                            <td className="px-3 py-3 align-top">
                              {isEditingCell(row.id, 'fecha_revision') ? (
                                <input type="date" value={cellDraft}
                                  onChange={e => setCellDraft(e.target.value)}
                                  onBlur={() => commitCell(row.id, 'fecha_revision')}
                                  autoFocus
                                  className="text-[11px] border border-blue-300 rounded-lg px-2 py-1 bg-white focus:outline-none w-full"/>
                              ) : (
                                <button
                                  onClick={() => startEdit(row.id, 'fecha_revision', row.fecha_revision || row.fecha || '')}
                                  className="text-[12px] text-gray-500 font-mono hover:text-[#1a2e4a] transition-colors text-left w-full leading-snug">
                                  {fmtSegFecha(row.fecha_revision ?? row.fecha)}
                                </button>
                              )}
                            </td>

                            {/* Gestión / Observación */}
                            <td className="px-3 py-3 align-top">
                              {isEditingCell(row.id, 'por_hacer') ? (
                                <textarea
                                  value={cellDraft}
                                  onChange={e => setCellDraft(e.target.value)}
                                  onBlur={() => commitCell(row.id, 'por_hacer')}
                                  autoFocus rows={3}
                                  className="w-full text-[12px] border border-blue-300 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none bg-white leading-relaxed"
                                  style={{ minHeight: 64 }}
                                />
                              ) : (
                                <div
                                  onClick={() => startEdit(row.id, 'por_hacer', row.por_hacer || '')}
                                  className="text-[12px] text-gray-800 leading-relaxed cursor-text rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-gray-100/70 transition-colors whitespace-pre-wrap min-h-[2rem]"
                                >
                                  {row.por_hacer || row.nota || <span className="text-gray-300 italic text-[11px]">Clic para agregar…</span>}
                                  {row.notas && (
                                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">{row.notas}</p>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Estado — texto libre editable inline */}
                            <td className="px-3 py-3 align-top">
                              {isEditingCell(row.id, 'que_se_hizo') ? (
                                <input type="text" value={cellDraft}
                                  onChange={e => setCellDraft(e.target.value)}
                                  onBlur={() => commitCell(row.id, 'que_se_hizo')}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') e.currentTarget.blur()
                                    if (e.key === 'Escape') setEditingCell(null)
                                  }}
                                  autoFocus
                                  className="text-[11px] border border-blue-300 rounded-lg px-2 py-1 bg-white focus:outline-none w-full" />
                              ) : (
                                <button
                                  onClick={() => startEdit(row.id, 'que_se_hizo', row.que_se_hizo || '')}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap hover:opacity-80 cursor-pointer transition-opacity"
                                  style={{ backgroundColor: estadoC.bg, color: estadoC.text }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: estadoC.dot }}/>
                                  {row.que_se_hizo || 'Pendiente'}
                                </button>
                              )}
                            </td>

                            {/* Eliminar */}
                            <td className="px-2 py-3 align-top">
                              {!isDelConfirm ? (
                                <button onClick={e => { e.stopPropagation(); setConfirmDelSeg(row.id) }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all">
                                  <Trash2 size={11}/>
                                </button>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => handleDeleteSegRow(row.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Confirmar">
                                    <Check size={11}/>
                                  </button>
                                  <button onClick={() => setConfirmDelSeg(null)}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                                    <X size={11}/>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )
        })()}

      </div>
    </div>

    {showCargaMasivaSeg && (
      <CargaMasivaModal
        modulo="seguimiento_rev"
        causaObj={{
          rit:            causa.rit,
          ruc:            causa.ruc   || null,
          cliente_nombre: causa.cliente_nombre,
          id:             causa.id    || null,
          cliente_id:     causa.cliente_id || null,
          materia:        causa.materia || '',
          tribunal:       causa.tribunal || '',
        }}
        onClose={() => setShowCargaMasivaSeg(false)}
        onSuccess={rows => setSegRows(prev => [...rows, ...prev])}
      />
    )}

    </>
  )
}

// ── helper avatar color por estado de cliente ─────────────────────────────
// hasActiveCausas: true si el cliente tiene al menos una causa Abierta/Revisar
function clienteAvatarColor(isSelected, hasActiveCausas) {
  if (isSelected) return '#1a2e4a'
  return hasActiveCausas ? '#2570ba' : '#9ca3af'
}

// ── Sidebar de navegación interna ─────────────────────────────────────────
function CausasSidebar({ causas, clienteActivo, onSelect, busquedaSidebar, setBusquedaSidebar, clienteEstadoMap = {}, listaClientes = [] }) {
  // Mapa nombre→estado para búsqueda rápida por nombre (fallback cuando no hay cliente_id)
  const nombreEstadoMap = useMemo(() => {
    const m = {}
    listaClientes.forEach(c => { m[c.nombre] = c.estado ?? 'Activo' })
    return m
  }, [listaClientes])

  const clientes = useMemo(() => {
    const map = {}
    causas.forEach(c => {
      const key = (c.cliente_nombre || '').trim()
      if (!map[key]) map[key] = { nombre: key, total: 0, activas: 0, clienteId: c.cliente_id }
      map[key].total += 1
      if (ACTIVAS.has(c.estado) || ACTIVAS.has(normalizeEstado(c.estado))) map[key].activas += 1
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

  // Agrupar A-Z por primera letra
  const byLetterSidebar = useMemo(() => {
    const map = {}
    filtrados.forEach(c => {
      const l = c.nombre.trim().charAt(0).toUpperCase() || '#'
      if (!map[l]) map[l] = []
      map[l].push(c)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtrados])

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
            clienteActivo === null ? 'bg-[#2570BA] text-white' : 'text-gray-700 hover:bg-gray-50'
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
        {byLetterSidebar.length === 0
          ? <p className="px-4 py-6 text-[11px] text-gray-400 text-center">Sin resultados</p>
          : byLetterSidebar.map(([letra, grupo]) => (
            <div key={letra}>
              <p className="px-4 pt-3 pb-0.5 text-[9px] font-bold text-gray-300 uppercase tracking-widest">{letra}</p>
              {grupo.map(c => {
                const isSelected     = clienteActivo === c.nombre
                const hasActiveCausas = c.activas > 0
                const isInactivo    = !hasActiveCausas
                const avatarBg      = clienteAvatarColor(isSelected, hasActiveCausas)
                return (
                  <button key={c.nombre} onClick={() => onSelect(c.nombre)}
                    className={`w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors group ${
                      isSelected ? 'bg-[#e8f0fb] text-[#1a2e4a]' : isInactivo ? 'text-gray-400 hover:bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                        style={{ backgroundColor: avatarBg }}>
                        {initials(c.nombre)}
                      </div>
                      <span className={`text-xs truncate leading-snug ${isInactivo && !isSelected ? 'text-gray-400' : ''}`}>
                        {c.nombre.split(' ')[0]}
                      </span>
                    </div>
                    <span className={`text-[10px] tabular-nums font-medium flex-shrink-0 ml-1 ${
                      isSelected ? 'text-[#2570ba]' : 'text-gray-300 group-hover:text-gray-500'
                    }`}>{c.total}</span>
                  </button>
                )
              })}
            </div>
          ))
        }
      </nav>
    </div>
  )
}

// ── Vista agrupada ────────────────────────────────────────────────────────
function GrupoCliente({ nombre, lista, seleccionada, onSelect, forceOpen, clienteActivoCausasMap }) {
  const [abierto, setAbierto] = useState(forceOpen !== undefined ? forceOpen : true)
  useEffect(() => { if (forceOpen !== undefined) setAbierto(forceOpen) }, [forceOpen])
  const hasActiveCausas = !!(clienteActivoCausasMap?.[lista[0]?.cliente_id] || clienteActivoCausasMap?.[nombre])
  return (
    <div className="px-4 mb-2">
      <ClienteAccordionRow
        clienteNombre={nombre}
        hasActiveCausas={hasActiveCausas}
        isExpanded={abierto}
        onToggle={() => setAbierto(p => !p)}
        subtitle={`${lista.length} causa${lista.length !== 1 ? 's' : ''}`}
      >
        {lista.map(c => (
          <CausaAccordionCard
            key={c.id}
            rit={c.rit}
            ruc={c.ruc}
            materia={c.materia}
            rightContent={<>
              <AreaBadge area={c.area} />
              <EstadoBadge estado={c.estado} />
            </>}
            onClick={() => onSelect(seleccionada?.id === c.id ? null : c)}
          />
        ))}
      </ClienteAccordionRow>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Causas() {
  const location = useLocation()
  const _fromSidebar = location.state?.fromSidebar === true
  const [_ps] = useState(() => {
    if (_fromSidebar) {
      sessionStorage.removeItem('ps.causas')
      return {}
    }
    try { return JSON.parse(sessionStorage.getItem('ps.causas') ?? 'null') ?? {} }
    catch { return {} }
  })

  const [causas, setCausas]           = useState([])
  const [listaClientes, setListaClientes] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [guardando, setGuardando]     = useState(false)

  const [clienteActivo, setCliente]   = useState(null)
  const [busquedaSidebar, setSidebar] = useState('')
  const [busqueda, setBusqueda]       = useState(_ps.busqueda ?? '')
  // ── Filtros persistentes en localStorage ──────────────────────────────────
  const DEFAULT_ESTADOS_FILTRO = ['Abierta', 'Revisar']
  const [filtroEstados, setEstadosRaw] = useState(() => {
    try {
      const stored = localStorage.getItem('filtros_causas.estados')
      return stored ? JSON.parse(stored) : DEFAULT_ESTADOS_FILTRO
    } catch { return DEFAULT_ESTADOS_FILTRO }
  })
  const [filtroArea, setAreaRaw]              = useState(() => { try { return localStorage.getItem('filtros_causas.area')      ?? '' } catch { return '' } })
  const [filtroClienteEstado, setClEstadoRaw] = useState(() => { try { return localStorage.getItem('filtros_causas.clEstado') ?? '' } catch { return '' } }) // '' | 'Activo' | 'Inactivo'

  const setEstados  = useCallback((v) => { setEstadosRaw(v);  try { localStorage.setItem('filtros_causas.estados', JSON.stringify(v)) } catch {} }, [])
  const toggleEstadoFiltro = useCallback((estado) => {
    setEstados(prev => prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado])
  }, [setEstados])
  const setArea     = useCallback((v) => { setAreaRaw(v);     try { v ? localStorage.setItem('filtros_causas.area',      v) : localStorage.removeItem('filtros_causas.area')      } catch {} }, [])
  const setClEstado = useCallback((v) => { setClEstadoRaw(v); try { v ? localStorage.setItem('filtros_causas.clEstado', v) : localStorage.removeItem('filtros_causas.clEstado') } catch {} }, [])
  const [vista, setVista]             = useState('tabla')
  const [seleccionada, setSeleccionada] = useState(null)
  const [mostrarFiltros, setFiltros]  = useState(false)
  const [formulario, setFormulario]   = useState(null) // null | 'nueva' | objeto causa para editar
  const [deleteTarget, setDeleteTarget] = useState(null) // { causa, fromView }
  const [deleteError, setDeleteError]   = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [tableEdit, setTableEdit]     = useState(null)  // { id, field }
  const [bulkField, setBulkField]     = useState(null)  // campo activo del bulk action bar

  const { activeCausa, clearActiveCausa } = useNavigation()

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
      .select('id, nombre, rut, estado')
      .order('nombre', { ascending: true })
    setListaClientes(data || [])
  }, [])

  useEffect(() => { fetchCausas(); fetchListaClientes() }, [fetchCausas, fetchListaClientes])

  // ── Scroll persistence ──────────────────────────────────────────────────
  const scrollRef = useRef()

  useEffect(() => {
    if (!loading && _ps.scrollTop && scrollRef.current) {
      const el = scrollRef.current
      requestAnimationFrame(() => { el.scrollTop = _ps.scrollTop })
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const _stRef = useRef({})
  useEffect(() => {
    _stRef.current = { busqueda }
  }, [busqueda])

  useEffect(() => () => {
    sessionStorage.setItem('ps.causas', JSON.stringify({
      ..._stRef.current,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset al navegar desde sidebar ────────────────────────────────────
  useEffect(() => {
    if (!_fromSidebar) return
    setSeleccionada(null)
    setCliente(null)
    setBusqueda('')
    sessionStorage.removeItem('ps.causas')
    clearActiveCausa()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // ── Restaurar causa activa al volver desde PJUD/SIAU ──────────────────
  useEffect(() => {
    if (!activeCausa?.id || causas.length === 0) return
    if (seleccionada?.id === activeCausa.id) return
    const causa = causas.find(c => c.id === activeCausa.id)
    if (causa) {
      setSeleccionada(causa)
      if (causa.cliente_nombre) setCliente(causa.cliente_nombre)
      clearActiveCausa()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [causas, activeCausa?.id])

  // Mapa clienteId → estado para filtrar por estado de cliente
  const clienteEstadoMap = useMemo(() => {
    const m = {}
    listaClientes.forEach(c => { m[c.id] = c.estado ?? 'Activo' })
    return m
  }, [listaClientes])

  // Mapa clienteId/nombre → boolean: tiene al menos una causa activa (Abierta/Revisar)
  const clienteActivoCausasMap = useMemo(() => {
    const m = {}
    causas.forEach(c => {
      if (ACTIVAS.has(c.estado) || ACTIVAS.has(normalizeEstado(c.estado))) {
        if (c.cliente_id) m[c.cliente_id] = true
        if (c.cliente_nombre) m[c.cliente_nombre] = true
      }
    })
    return m
  }, [causas])

  // Expand/colapsar todo en vista agrupada
  const [expandTodos, setExpandTodosRaw] = useState(() => {
    try { return localStorage.getItem('causas_expand_all') !== 'false' } catch { return true }
  })
  const setExpandTodos = useCallback((v) => {
    setExpandTodosRaw(v)
    try { localStorage.setItem('causas_expand_all', String(v)) } catch {}
  }, [])

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

  // ── Actualización parcial (ej: cambio de estado inline) ─────────────────
  const handleCausaUpdate = useCallback(async (updates) => {
    if (!seleccionada) return
    const { data, error: err } = await supabase
      .from('causas').update(updates).eq('id', seleccionada.id).select().single()
    if (!err && data) {
      const actualizada = mapCausa(data)
      setCausas(prev => prev.map(c => c.id === actualizada.id ? actualizada : c))
      setSeleccionada(actualizada)
    }
  }, [seleccionada])

  // ── Edición rápida inline desde la tabla ────────────────────────────────
  const quickUpdate = useCallback(async (id, field, value) => {
    setTableEdit(null)
    setCausas(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    await supabase.from('causas').update({ [field]: value }).eq('id', id)
    if (seleccionada?.id === id) setSeleccionada(prev => ({ ...prev, [field]: value }))
  }, [seleccionada])

  const bulkUpdate = useCallback(async (field, value) => {
    setBulkField(null)
    const ids = [...selectedIds]
    setCausas(prev => prev.map(c => ids.includes(c.id) ? { ...c, [field]: value } : c))
    await supabase.from('causas').update({ [field]: value }).in('id', ids)
    setSelectedIds(new Set())
  }, [selectedIds])

  // ── Eliminar ────────────────────────────────────────────────────────────
  /** Abre el modal de confirmación para una causa */
  const handleRequestDelete = useCallback((causa) => {
    setDeleteTarget({ causa })
    setDeleteError(null)
  }, [])

  /** Hace el borrado en cascada (siau/pjud por rit/ruc, revisiones por causa_id) */
  const handleEliminarCausa = async (causa) => {
    const rit = causa.rit
    const ruc = causa.ruc

    // 1. Borrar tablas sin FK (siau, pjud) por rit y ruc
    const byRit = rit ? [
      supabase.from('siau').delete().eq('causa_rit', rit),
      supabase.from('pjud').delete().eq('causa_rit', rit),
    ] : []
    const byRuc = ruc ? [
      supabase.from('siau').delete().eq('causa_ruc', ruc),
      supabase.from('pjud').delete().eq('causa_ruc', ruc),
    ] : []
    // revisiones usa causa_id (FK con cascade, pero lo borramos explícitamente por seguridad)
    await Promise.all([
      ...byRit, ...byRuc,
      supabase.from('revisiones').delete().eq('causa_id', causa.id),
    ])

    // 2. Borrar causa (cascade elimina audiencias, tareas, plazos, documentos)
    const { error: err } = await supabase.from('causas').delete().eq('id', causa.id)
    if (err) {
      setDeleteError('Error al eliminar: ' + err.message)
      return false
    }
    return true
  }

  const handleEliminarConfirm = async () => {
    const { causa } = deleteTarget
    if (!causa) return
    const ok = await handleEliminarCausa(causa)
    if (ok) {
      setCausas(prev => prev.filter(c => c.id !== causa.id))
      if (seleccionada?.id === causa.id) setSeleccionada(null)
      setDeleteTarget(null)
    }
  }

  /** Archiva la causa (pasa a 'Archivada') sin borrar datos */
  const handleArchivar = async () => {
    const { causa } = deleteTarget
    if (!causa) return
    const { error: err } = await supabase
      .from('causas').update({ estado: 'Archivada' }).eq('id', causa.id)
    if (!err) {
      setCausas(prev => prev.map(c =>
        c.id === causa.id ? { ...c, estado: 'Archivada' } : c
      ))
      if (seleccionada?.id === causa.id)
        setSeleccionada(prev => ({ ...prev, estado: 'Archivada' }))
    }
    setDeleteTarget(null)
  }

  // ── Filtrado ────────────────────────────────────────────────────────────
  // filtradasSinCliente: aplica todos los filtros EXCEPTO clienteActivo.
  // Es lo que el sidebar debe mostrar — clientes del universo filtrado.
  const filtradasSinCliente = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return causas.filter(c => {
      const matchQ = !q ||
        c.cliente_nombre.toLowerCase().includes(q) ||
        c.materia.toLowerCase().includes(q) ||
        c.tribunal.toLowerCase().includes(q) ||
        (c.rit ?? '').toLowerCase().includes(q)
      const estadoNorm = normalizeEstado(c.estado)
      const matchEstado = filtroEstados.length === 0 || filtroEstados.includes(estadoNorm)
      const matchArea   = !filtroArea   || c.area   === filtroArea
      const estadoCliente = clienteEstadoMap[c.cliente_id] ?? 'Activo'
      const matchClEst = !filtroClienteEstado ||
        (filtroClienteEstado === 'Inactivo' ? estadoCliente !== 'Activo' : estadoCliente === 'Activo')
      return matchQ && matchEstado && matchArea && matchClEst
    })
  }, [causas, busqueda, filtroEstados, filtroArea, filtroClienteEstado, clienteEstadoMap])

  const filtradas = useMemo(() =>
    clienteActivo
      ? filtradasSinCliente.filter(c => c.cliente_nombre === clienteActivo)
      : filtradasSinCliente
  , [filtradasSinCliente, clienteActivo])

  const ordenadas = useMemo(() =>
    [...filtradas].sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es'))
  , [filtradas])

  // Agrupadas A-Z por primera letra del nombre de cliente
  const agrupadas = useMemo(() => {
    const grupos = {}
    ordenadas.forEach(c => {
      const letra = c.cliente_nombre.trim().charAt(0).toUpperCase() || '#'
      if (!grupos[letra]) grupos[letra] = []
      grupos[letra].push(c)
    })
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [ordenadas])

  const isDefaultEstadoFiltro = filtroEstados.length === DEFAULT_ESTADOS_FILTRO.length &&
    DEFAULT_ESTADOS_FILTRO.every(e => filtroEstados.includes(e))
  const hayFiltros = !isDefaultEstadoFiltro || filtroArea || filtroClienteEstado
  const tituloVista = clienteActivo

  // ── Keyboard navigation in list (arrow keys + Enter) ──────────────────────
  const [focusedCausaIdx, setFocusedCausaIdx] = useState(-1)

  useEffect(() => {
    if (seleccionada || formulario) return
    const fn = (e) => {
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedCausaIdx(i => Math.min(i + 1, ordenadas.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedCausaIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && focusedCausaIdx >= 0) {
        e.preventDefault()
        const causa = ordenadas[focusedCausaIdx]
        if (causa) { setSeleccionada(causa); setFormulario(null) }
      } else if (e.key === 'Escape') {
        setFocusedCausaIdx(-1)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [seleccionada, formulario, ordenadas, focusedCausaIdx])

  // Esc closes open panel or form (form takes priority)
  useEffect(() => {
    const fn = () => {
      if (formulario) setFormulario(null)
      else if (seleccionada) setSeleccionada(null)
    }
    window.addEventListener('modal:close', fn)
    return () => window.removeEventListener('modal:close', fn)
  }, [formulario, seleccionada])

    ? clienteActivo.split(' ').slice(0, 2).join(' ')
    : 'Todas las causas'

  const panelAbierto = seleccionada || formulario

  return (
    <div className="flex h-full min-h-screen">
      <CausasSidebar
        causas={filtradasSinCliente}
        clienteActivo={clienteActivo}
        onSelect={n => { setCliente(n); setSeleccionada(null); setBusqueda('') }}
        busquedaSidebar={busquedaSidebar}
        setBusquedaSidebar={setSidebar}
        clienteEstadoMap={clienteEstadoMap}
        listaClientes={listaClientes}
      />

      {seleccionada ? (
        /* ── Vista de causa completa ── */
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <CausaView
            causa={seleccionada}
            onClose={() => setSeleccionada(null)}
            onEdit={() => setFormulario(seleccionada)}
            onDelete={() => handleRequestDelete(seleccionada)}
            onUpdate={handleCausaUpdate}
            onNavigateToCliente={nombre => {
              setSeleccionada(null)
              setCliente(nombre)
              setBusqueda('')
            }}
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
                      const total    = ordenadas.length
                      const activas  = ordenadas.filter(c => ACTIVAS.has(normalizeEstado(c.estado))).length
                      const cerradas = total - activas
                      return `${total} causa${total !== 1 ? 's' : ''} · ${activas} activa${activas !== 1 ? 's' : ''}${cerradas ? ` · ${cerradas} cerrada${cerradas !== 1 ? 's' : ''}` : ''}`
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => { setSeleccionada(null); setFormulario('nueva') }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#2570BA' }}>
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
                    className={`p-1.5 rounded transition-colors ${vista === 'tabla' ? 'bg-[#2570BA] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                    <LayoutList size={12} />
                  </button>
                  <button onClick={() => setVista('agrupado')}
                    className={`p-1.5 rounded transition-colors ${vista === 'agrupado' ? 'bg-[#2570BA] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                    <Layers size={12} />
                  </button>
                </div>
                {vista === 'agrupado' && (
                  <button onClick={() => setExpandTodos(!expandTodos)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors">
                    {expandTodos ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    {expandTodos ? 'Colapsar todo' : 'Expandir todo'}
                  </button>
                )}
              </div>
              {mostrarFiltros && (
                <div className="flex items-start gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                  {/* Estado chips */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Estado</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ESTADOS.map(e => {
                        const active = filtroEstados.includes(e)
                        const s = ESTADO_STYLES[e]
                        return (
                          <button key={e} onClick={() => toggleEstadoFiltro(e)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                              active ? `${s.badge} border-transparent` : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? s.dot : 'bg-gray-300'}`} />
                            {e}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Área */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Área</span>
                    <select value={filtroArea} onChange={e => setArea(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-600 bg-white">
                      <option value="">Todas</option>
                      {AREAS.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  {/* Cliente */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cliente</span>
                    <div className="flex items-center gap-1.5">
                      {[['', 'Todos'], ['Activo', 'Activos'], ['Inactivo', 'Inactivos']].map(([val, label]) => (
                        <button key={val} onClick={() => setClEstado(val)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                            filtroClienteEstado === val
                              ? val === '' ? 'bg-gray-100 text-gray-700 border-gray-300'
                                : val === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-100 text-gray-500 border-gray-300'
                              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {hayFiltros && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide opacity-0">·</span>
                      <button onClick={() => { setEstados(DEFAULT_ESTADOS_FILTRO); setArea(''); setClEstado('') }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 py-1">
                        <X size={11} />Restablecer
                      </button>
                    </div>
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
              ) : vista === 'tabla' ? ((() => {
                // ── helpers inline ────────────────────────────────────────
                const isEditing = (id, field) => tableEdit?.id === id && tableEdit?.field === field
                const startEdit = (e, id, field) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setTableEdit({ id, field, rect }) }

                const allVisible   = ordenadas
                const allSelected  = allVisible.length > 0 && allVisible.every(c => selectedIds.has(c.id))
                const someSelected = allVisible.some(c => selectedIds.has(c.id))
                const toggleAll    = () => setSelectedIds(allSelected ? new Set() : new Set(allVisible.map(c => c.id)))
                const toggleOne    = (id) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

                const PRIORIDAD_STYLES = {
                  'Alta':  'bg-red-50 text-red-600',
                  'Media': 'bg-amber-50 text-amber-600',
                  'Baja':  'bg-gray-100 text-gray-500',
                }
                const PRIORIDADES = ['Alta', 'Media', 'Baja']
                const RESPONSABLES = Object.entries(RESPONSABLE_NAMES_C).map(([k,v]) => ({ key: k, label: v }))

                const COLS = clienteActivo ? 11 : 12

                return (
                <>
                {/* Bulk action bar */}
                {selectedIds.size > 0 && (
                  <div className="sticky top-0 z-30 flex items-center gap-3 px-6 py-2.5 bg-[#1a2e4a] text-white text-xs shadow-md">
                    <span className="font-semibold">{selectedIds.size} causa{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>
                    <span className="text-white/30">·</span>
                    <span className="text-white/60">Cambiar:</span>

                    {/* Estado bulk */}
                    <div className="relative">
                      <button onClick={() => setBulkField(bulkField === 'estado' ? null : 'estado')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                        Estado <ChevronDown size={11} />
                      </button>
                      {bulkField === 'estado' && (
                        <CellDropdown value={null} options={ESTADOS} onClose={() => setBulkField(null)}
                          onSelect={v => bulkUpdate('estado', v)} />
                      )}
                    </div>

                    {/* Responsable bulk */}
                    <div className="relative">
                      <button onClick={() => setBulkField(bulkField === 'responsable' ? null : 'responsable')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                        Responsable <ChevronDown size={11} />
                      </button>
                      {bulkField === 'responsable' && (
                        <CellDropdown value={null} options={RESPONSABLES.map(r => r.key)} onClose={() => setBulkField(null)}
                          onSelect={v => bulkUpdate('responsable', v)}
                          renderOption={v => RESPONSABLE_NAMES_C[v] || v} />
                      )}
                    </div>

                    {/* Etapa bulk */}
                    <div className="relative">
                      <button onClick={() => setBulkField(bulkField === 'etapa_procesal' ? null : 'etapa_procesal')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                        Etapa <ChevronDown size={11} />
                      </button>
                      {bulkField === 'etapa_procesal' && (
                        <CellDropdown value={null} options={[...ETAPAS.penal, ...ETAPAS.general, ...ETAPAS.corte]} onClose={() => setBulkField(null)}
                          onSelect={v => bulkUpdate('etapa_procesal', v)} />
                      )}
                    </div>

                    {/* Prioridad bulk */}
                    <div className="relative">
                      <button onClick={() => setBulkField(bulkField === 'prioridad' ? null : 'prioridad')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                        Prioridad <ChevronDown size={11} />
                      </button>
                      {bulkField === 'prioridad' && (
                        <CellDropdown value={null} options={PRIORIDADES} onClose={() => setBulkField(null)}
                          onSelect={v => bulkUpdate('prioridad', v)} />
                      )}
                    </div>

                    <button onClick={() => setSelectedIds(new Set())}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                      <X size={11} /> Cancelar
                    </button>
                  </div>
                )}

                <table className="w-full">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-gray-100">
                      {!clienteActivo && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Cliente</th>}
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Parte</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">RIT</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tribunal</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Fiscalía</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Área</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Etapa</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Resp.</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Prior.</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                      <th className="px-3 py-2.5 w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {agrupadas.map(([letra, grupo]) => (
                      <>
                        <tr key={`letra-${letra}`}>
                          <td colSpan={COLS} className="pl-7 pt-5 pb-1.5">
                            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">{letra}</span>
                          </td>
                        </tr>
                        {grupo.map(c => {
                          const flatIdx = ordenadas.indexOf(c)
                          const isFocused = flatIdx === focusedCausaIdx
                          const isSelected = selectedIds.has(c.id)
                          const areaGroup = getAreaGroup(c.area)
                          const parteOpts = PARTE_OPCIONES[areaGroup] ?? PARTE_OPCIONES.general
                          return (
                          <tr key={c.id}
                            tabIndex={0}
                            onClick={() => { if (tableEdit) { setTableEdit(null); return } setSeleccionada(seleccionada?.id === c.id ? null : c); setFormulario(null) }}
                            onFocus={() => setFocusedCausaIdx(flatIdx)}
                            className={`group border-b border-gray-50 cursor-pointer transition-colors outline-none ${
                              isSelected ? 'bg-blue-50/50' :
                              isFocused ? 'bg-[#2570ba]/[0.05] ring-1 ring-inset ring-[#2570ba]/20' :
                              seleccionada?.id === c.id ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'
                            } ${CERRADAS.has(normalizeEstado(c.estado)) ? 'opacity-55' : ''}`}>

                            {/* Cliente */}
                            {!clienteActivo && (
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                                    style={{ backgroundColor: clienteAvatarColor(false, clienteActivoCausasMap[c.cliente_id] ?? clienteActivoCausasMap[c.cliente_nombre] ?? true) }}>
                                    {initials(c.cliente_nombre)}
                                  </div>
                                  <span className={`text-xs whitespace-nowrap ${clienteEstadoMap[c.cliente_id] && clienteEstadoMap[c.cliente_id] !== 'Activo' ? 'text-gray-400' : 'text-gray-800'}`}>
                                    {c.cliente_nombre}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* Parte — dropdown */}
                            <td className={`${clienteActivo ? 'pl-4' : ''} px-3 py-2.5 relative`} onClick={e => e.stopPropagation()}>
                              <button onClick={e => startEdit(e, c.id, 'parte')}
                                className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1">
                                {c.parte || <span className="text-gray-300">—</span>}
                                <ChevronDown size={9} className="text-gray-300" />
                              </button>
                              {isEditing(c.id, 'parte') && (
                                <CellDropdown value={c.parte} options={parteOpts} rect={tableEdit?.rect} onClose={() => setTableEdit(null)}
                                  onSelect={v => quickUpdate(c.id, 'parte', v)} />
                              )}
                            </td>

                            {/* RIT */}
                            <td className="px-3 py-2.5">{c.rit ? <CopyValue value={c.rit} className="text-xs text-gray-500" /> : <span className="text-xs text-gray-300">—</span>}</td>

                            {/* Tribunal — text inline */}
                            <td className="px-3 py-2.5 max-w-[140px]" onClick={e => e.stopPropagation()}>
                              {isEditing(c.id, 'tribunal') ? (
                                <input autoFocus className="w-full text-xs px-1.5 py-0.5 border border-blue-300 rounded-lg outline-none bg-white"
                                  defaultValue={c.tribunal}
                                  onKeyDown={e => { if (e.key === 'Enter') quickUpdate(c.id, 'tribunal', e.target.value); if (e.key === 'Escape') setTableEdit(null) }}
                                  onBlur={e => quickUpdate(c.id, 'tribunal', e.target.value)} />
                              ) : (
                                <span onClick={e => startEdit(e, c.id, 'tribunal')}
                                  className="text-xs text-gray-600 hover:text-gray-900 cursor-text hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors block truncate">
                                  {c.tribunal?.split('—')[0]?.trim() || <span className="text-gray-300">—</span>}
                                </span>
                              )}
                            </td>

                            {/* Fiscalía — text inline */}
                            <td className="px-3 py-2.5 max-w-[110px]" onClick={e => e.stopPropagation()}>
                              {isEditing(c.id, 'fiscalia') ? (
                                <input autoFocus className="w-full text-xs px-1.5 py-0.5 border border-blue-300 rounded-lg outline-none bg-white"
                                  defaultValue={c.fiscalia || ''}
                                  onKeyDown={e => { if (e.key === 'Enter') quickUpdate(c.id, 'fiscalia', e.target.value || null); if (e.key === 'Escape') setTableEdit(null) }}
                                  onBlur={e => quickUpdate(c.id, 'fiscalia', e.target.value || null)} />
                              ) : (
                                <span onClick={e => startEdit(e, c.id, 'fiscalia')}
                                  className="text-xs text-gray-400 hover:text-gray-700 cursor-text hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors block truncate">
                                  {c.fiscalia || <span className="text-gray-300">—</span>}
                                </span>
                              )}
                            </td>

                            {/* Área — dropdown */}
                            <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                              <button onClick={e => startEdit(e, c.id, 'area')}
                                className="hover:ring-1 hover:ring-gray-200 rounded transition-all">
                                <AreaBadge area={c.area} />
                              </button>
                              {isEditing(c.id, 'area') && (
                                <CellDropdown value={c.area} options={AREAS} rect={tableEdit?.rect} onClose={() => setTableEdit(null)}
                                  onSelect={v => quickUpdate(c.id, 'area', v)}
                                  renderOption={v => <><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${AREA_STYLES[v] || 'bg-gray-100 text-gray-500'}`}>{v}</span></>} />
                              )}
                            </td>

                            {/* Etapa — dropdown */}
                            <td className="px-3 py-2.5 relative max-w-[130px]" onClick={e => e.stopPropagation()}>
                              <button onClick={e => startEdit(e, c.id, 'etapa_procesal')}
                                className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 truncate max-w-full">
                                <span className="truncate">{c.etapa_procesal || <span className="text-gray-300">—</span>}</span>
                                <ChevronDown size={9} className="text-gray-300 flex-shrink-0" />
                              </button>
                              {isEditing(c.id, 'etapa_procesal') && (
                                <CellDropdown value={c.etapa_procesal} options={ETAPAS[areaGroup] ?? ETAPAS.general} rect={tableEdit?.rect} onClose={() => setTableEdit(null)}
                                  onSelect={v => quickUpdate(c.id, 'etapa_procesal', v)} />
                              )}
                            </td>

                            {/* Responsable — dropdown */}
                            <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                              <button onClick={e => startEdit(e, c.id, 'responsable')}
                                className="flex items-center gap-1 hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors">
                                {c.responsable ? (
                                  <span className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: RESPONSABLE_COLORS_C[c.responsable] || '#9CA3AF' }}>
                                    {c.responsable}
                                  </span>
                                ) : <span className="text-xs text-gray-300">—</span>}
                              </button>
                              {isEditing(c.id, 'responsable') && (
                                <CellDropdown value={c.responsable} options={Object.keys(RESPONSABLE_NAMES_C)} rect={tableEdit?.rect} onClose={() => setTableEdit(null)}
                                  onSelect={v => quickUpdate(c.id, 'responsable', v)}
                                  renderOption={v => (
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                                        style={{ backgroundColor: RESPONSABLE_COLORS_C[v] || '#9CA3AF' }}>{v}</span>
                                      {RESPONSABLE_NAMES_C[v]}
                                    </div>
                                  )} />
                              )}
                            </td>

                            {/* Prioridad — dropdown */}
                            <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                              <button onClick={e => startEdit(e, c.id, 'prioridad')}
                                className="hover:ring-1 hover:ring-gray-200 rounded transition-all">
                                {c.prioridad ? (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORIDAD_STYLES[c.prioridad] || 'bg-gray-100 text-gray-500'}`}>
                                    {c.prioridad}
                                  </span>
                                ) : <span className="text-xs text-gray-300">—</span>}
                              </button>
                              {isEditing(c.id, 'prioridad') && (
                                <CellDropdown value={c.prioridad} options={PRIORIDADES} rect={tableEdit?.rect} onClose={() => setTableEdit(null)}
                                  onSelect={v => quickUpdate(c.id, 'prioridad', v)}
                                  renderOption={v => <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORIDAD_STYLES[v]}`}>{v}</span>} />
                              )}
                            </td>

                            {/* Estado — dropdown */}
                            <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                              <button onClick={e => startEdit(e, c.id, 'estado')}
                                className="hover:ring-1 hover:ring-gray-200 rounded transition-all">
                                <EstadoBadge estado={c.estado} />
                              </button>
                              {isEditing(c.id, 'estado') && (
                                <CellDropdown value={c.estado} options={ESTADOS} rect={tableEdit?.rect} onClose={() => setTableEdit(null)}
                                  onSelect={v => quickUpdate(c.id, 'estado', v)}
                                  renderOption={v => {
                                    const s = ESTADO_STYLES[v] ?? ESTADO_STYLES['Abierta']
                                    return <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{v}
                                    </span>
                                  }} />
                              )}
                            </td>

                            {/* Delete */}
                            <td className="px-2 py-2.5">
                              <button
                                onClick={e => { e.stopPropagation(); handleRequestDelete(c) }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                                title="Eliminar causa">
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                          )
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
                </>
                )
              })()) : (
                <div className="py-4">
                  {clienteActivo ? (
                    <div className="px-4 space-y-1.5">
                      {ordenadas.map(c => (
                        <CausaAccordionCard
                          key={c.id}
                          rit={c.rit}
                          ruc={c.ruc}
                          materia={c.materia}
                          rightContent={<><AreaBadge area={c.area} /><EstadoBadge estado={c.estado} /></>}
                          onClick={() => { setSeleccionada(seleccionada?.id === c.id ? null : c); setFormulario(null) }}
                        />
                      ))}
                    </div>
                  ) : (() => {
                    const grupos = {}
                    ordenadas.forEach(c => {
                      if (!grupos[c.cliente_nombre]) grupos[c.cliente_nombre] = []
                      grupos[c.cliente_nombre].push(c)
                    })
                    const byLetterAgr = {}
                    Object.entries(grupos).forEach(([nombre, lista]) => {
                      const l = nombre.trim().charAt(0).toUpperCase() || '#'
                      if (!byLetterAgr[l]) byLetterAgr[l] = []
                      byLetterAgr[l].push({ nombre, lista })
                    })
                    return Object.entries(byLetterAgr)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([letra, gruposLetra]) => (
                        <div key={letra}>
                          <div className="px-7 pt-3 pb-1">
                            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">{letra}</span>
                          </div>
                          {gruposLetra.map(({ nombre, lista }) => (
                            <GrupoCliente key={nombre} nombre={nombre} lista={lista}
                              seleccionada={seleccionada} onSelect={c => { setSeleccionada(c); setFormulario(null) }}
                              forceOpen={expandTodos}
                              clienteActivoCausasMap={clienteActivoCausasMap} />
                          ))}
                        </div>
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

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.causa?.materia ?? deleteTarget?.causa?.rit ?? ''}
        warning={
          deleteTarget?.causa
            ? `Se eliminarán los movimientos de PJUD/SIAU, audiencias, tareas, plazos y documentos de esta causa.`
            : null
        }
        onConfirm={handleEliminarConfirm}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
        onArchive={handleArchivar}
        archiveLabel="Archivar causa"
      />
    </div>
  )
}
