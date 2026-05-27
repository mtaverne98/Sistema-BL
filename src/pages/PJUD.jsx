import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  ChevronRight, ChevronDown, Search, Plus, ExternalLink,
  FileText, Clock, CheckCircle2, X, Check, Edit2,
  AlertCircle, Scale, Bell, Users, Briefcase, Landmark,
  MoreHorizontal, CalendarPlus, ListTodo, Loader2, Table2, Gavel,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import CargaMasivaModal from '../components/CargaMasivaModal'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Configs ─────────────────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  'Pendiente':            { bg: 'bg-amber-50',  text: 'text-amber-700',   dot: 'bg-amber-500'   },
  'Respondido':           { bg: 'bg-green-50',  text: 'text-green-700',   dot: 'bg-green-500'   },
  'Escrito presentado':   { bg: 'bg-blue-50',   text: 'text-blue-700',    dot: 'bg-blue-500'    },
  'Resolución pendiente': { bg: 'bg-violet-50', text: 'text-violet-700',  dot: 'bg-violet-500'  },
  'Proveído':             { bg: 'bg-teal-50',   text: 'text-teal-700',    dot: 'bg-teal-500'    },
  'No ha lugar':          { bg: 'bg-slate-100', text: 'text-slate-600',   dot: 'bg-slate-400'   },
  'Urgente':              { bg: 'bg-red-50',    text: 'text-red-700',     dot: 'bg-red-500'     },
  'Archivado':            { bg: 'bg-gray-100',  text: 'text-gray-500',    dot: 'bg-gray-400'    },
}
const ESTADOS_PJUD = Object.keys(ESTADO_CONFIG)

const PRESENTA_CONFIG = {
  'Nosotros':           { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: Briefcase,      short: 'Nos.'   },
  'Contraparte':        { bg: 'bg-red-50',    text: 'text-red-700',    icon: Users,          short: 'Ctra.'  },
  'Ministerio Público': { bg: 'bg-violet-50', text: 'text-violet-700', icon: Gavel,          short: 'Min.P.' },
  'Tribunal':           { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Landmark,       short: 'Trib.'  },
  'Otro':               { bg: 'bg-gray-100',  text: 'text-gray-500',   icon: MoreHorizontal, short: 'Otro'   },
}

const TIPO_SOLICITUD_CONFIG = {
  'Escrito':      { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'Presentación': { bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
  'Recurso':      { bg: 'bg-violet-50',  text: 'text-violet-700'  },
  'Otrosí':       { bg: 'bg-cyan-50',    text: 'text-cyan-700'    },
  'Solicitud':    { bg: 'bg-teal-50',    text: 'text-teal-700'    },
  'Otro':         { bg: 'bg-gray-100',   text: 'text-gray-500'    },
}
const TIPOS_SOLICITUD = Object.keys(TIPO_SOLICITUD_CONFIG)

const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Andrea B.',   color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

const PJUD_DB_FIELDS = new Set([
  'estado','notas','solicitud','respuesta','fecha_respuesta','fecha_notificacion',
  'accion_requerida','consecuencia_procesal','presenta','responsable',
  'tiene_documento','documento_desc','fecha','folio','causa_rit','cliente_nombre',
  'causa_id','cliente_id','tipo_solicitud',
])

const CATEGORIA_TAREA = ['Escrito','PJUD','Audiencia','SIAU','Documento','Seguimiento cliente','Cobranza','Otro']
const PRIORIDAD_TAREA = ['Alta','Media','Baja']
const TIPO_PLAZO = ['Legal','Procesal','Contractual','Judicial','Administrativo','Otro']

function mapPjudRow(row) {
  return {
    id:                    row.id,
    fecha:                 row.fecha                 || TODAY,
    folio:                 row.folio                 || '',
    presenta:              row.presenta              || 'Nosotros',
    tipo_solicitud:        row.tipo_solicitud        || 'Otro',
    solicitud:             row.solicitud             || '',
    respuesta:             row.respuesta             || '',
    fecha_respuesta:       row.fecha_respuesta       || null,
    fecha_notificacion:    row.fecha_notificacion    || null,
    accion_requerida:      row.accion_requerida      || '',
    consecuencia_procesal: row.consecuencia_procesal || '',
    estado:                row.estado                || 'Pendiente',
    tiene_documento:       row.tiene_documento       || false,
    documento_desc:        row.documento_desc        || '',
    notas:                 row.notas                 || '',
    responsable:           row.responsable           || 'MT',
    causa_rit:             row.causa_rit             || '',
    cliente_nombre:        row.cliente_nombre        || '',
    causa_id:              row.causa_id              || null,
    cliente_id:            row.cliente_id            || null,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${String(d).padStart(2,'0')}-${M[m-1]}-${String(y).slice(2)}`
}
function fmtFechaLarga(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${M[m-1]} ${y}`
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Atoms ────────────────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Pendiente']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{estado}
    </span>
  )
}

function EstadoDropdown({ estado, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Pendiente']
  useEffect(() => {
    if (!open) return
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative inline-flex" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap hover:opacity-80 transition-opacity cursor-pointer`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{estado}
        <ChevronDown size={9} className="opacity-50 -mr-0.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[180px] py-1">
          {ESTADOS_PJUD.map(e => {
            const c = ESTADO_CONFIG[e]
            return (
              <button key={e} onClick={() => { onChange(e); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors ${e === estado ? 'bg-gray-50/80' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className={`text-[11px] font-medium ${e === estado ? c.text : 'text-gray-600'}`}>{e}</span>
                {e === estado && <Check size={10} className="ml-auto text-gray-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PresentaBadge({ presenta, compact = false }) {
  const cfg = PRESENTA_CONFIG[presenta] || PRESENTA_CONFIG['Otro']
  const Icon = cfg.icon
  if (compact) return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      <Icon size={9} className="flex-shrink-0" />{cfg.short}
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      <Icon size={10} className="flex-shrink-0" />{presenta}
    </span>
  )
}

function TipoSolicitudBadge({ tipo }) {
  const cfg = TIPO_SOLICITUD_CONFIG[tipo] || TIPO_SOLICITUD_CONFIG['Otro']
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      {tipo || '—'}
    </span>
  )
}

function DocChip({ tiene, desc }) {
  if (!tiene) return <span className="text-[11px] text-gray-300">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 max-w-[72px] truncate" title={desc}>
      <FileText size={9} className="flex-shrink-0" />{desc ? desc.split(' ')[0] : 'Ver doc'}
    </span>
  )
}

function StatCard({ label, value, iconBg, iconColor, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={14} className={iconColor} />
      </div>
      <div>
        <p className="text-[22px] font-bold text-gray-900 leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  )
}

// ── GenerarTareaForm ──────────────────────────────────────────────────────────────
function GenerarTareaForm({ causa, mov, addTarea, onClose }) {
  const [form, setForm] = useState({
    titulo:            mov.accion_requerida || '',
    categoria:         'PJUD',
    prioridad:         mov.estado === 'Urgente' ? 'Alta' : 'Media',
    fecha_vencimiento: mov.fecha_respuesta ? addDays(mov.fecha_respuesta, 5) : addDays(TODAY, 5),
    responsable:       mov.responsable || 'MT',
    notas:             `Generado desde PJUD · ${causa.causa_rit} · Folio ${mov.folio}`,
  })
  const valid = form.titulo.trim() && form.fecha_vencimiento
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 space-y-2.5" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1.5"><ListTodo size={10} /> Nueva tarea vinculada</p>
      <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
        placeholder="Título de la tarea..."
        className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white" />
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Categoría', field: 'categoria', opts: CATEGORIA_TAREA },
          { label: 'Prioridad', field: 'prioridad', opts: PRIORIDAD_TAREA },
        ].map(({ label, field, opts }) => (
          <div key={field}>
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <select value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400">
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vencimiento</p>
          <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Responsable</p>
          <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400">
            {Object.keys(RESPONSABLE_INFO).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={e => { e.stopPropagation(); if (!valid) return; addTarea({ id: `ta_${Date.now()}`, titulo: form.titulo.trim(), cliente: causa.cliente, causa_rit: causa.causa_rit, categoria: form.categoria, prioridad: form.prioridad, fecha_vencimiento: form.fecha_vencimiento, responsable: form.responsable, estado: 'Pendiente', notas: form.notas, subtareas: [] }); onClose() }}
          disabled={!valid}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
          <Check size={10} /> Crear tarea
        </button>
        <button onClick={e => { e.stopPropagation(); onClose() }}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── GenerarPlazoForm ──────────────────────────────────────────────────────────────
function GenerarPlazoForm({ causa, mov, addPlazo, onClose }) {
  const defaultVenc = mov.fecha_notificacion ? addDays(mov.fecha_notificacion, 5) : mov.fecha_respuesta ? addDays(mov.fecha_respuesta, 5) : addDays(TODAY, 5)
  const [form, setForm] = useState({
    titulo: mov.consecuencia_procesal || mov.accion_requerida || '',
    tipo: 'Procesal', fecha_inicio: TODAY, fecha_vencimiento: defaultVenc,
    responsable: mov.responsable || 'MT', notas: `Generado desde PJUD · ${causa.causa_rit} · Folio ${mov.folio}`,
  })
  const valid = form.titulo.trim() && form.fecha_vencimiento
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2.5" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold text-violet-700 uppercase tracking-widest flex items-center gap-1.5"><CalendarPlus size={10} /> Nuevo plazo vinculado</p>
      <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
        placeholder="Descripción del plazo..."
        className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-400 bg-white" />
      <div className="grid grid-cols-4 gap-2">
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tipo</p>
          <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-400">
            {TIPO_PLAZO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Inicio</p>
          <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-400" />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vencimiento</p>
          <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-400" />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Responsable</p>
          <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-400">
            {Object.keys(RESPONSABLE_INFO).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={e => { e.stopPropagation(); if (!valid) return; addPlazo({ id: `pl_${Date.now()}`, titulo: form.titulo.trim(), cliente: causa.cliente, causa_rit: causa.causa_rit, tipo: form.tipo, fecha_inicio: form.fecha_inicio, fecha_vencimiento: form.fecha_vencimiento, responsable: form.responsable, estado: 'Activo', notas: form.notas }); onClose() }}
          disabled={!valid}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
          <Check size={10} /> Crear plazo
        </button>
        <button onClick={e => { e.stopPropagation(); onClose() }}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
      </div>
    </div>
  )
}

// ── MovimientoRow ─────────────────────────────────────────────────────────────────
const MOV_COLS = '72px 118px 110px 1fr 1fr 88px 72px 28px'
const MOV_HEADERS = ['Fecha', 'Folio', 'Tipo solicitud', 'Solicitud', 'Respuesta', 'F. Respuesta', 'Docs', '']

function MovimientoRow({ causa, mov, index, onUpdate, addTarea, addPlazo }) {
  const [expanded, setExpanded] = useState(false)
  const [editNota, setEditNota] = useState(false)
  const [notaDraft, setNotaDraft] = useState(mov.notas)
  const [showTarea, setShowTarea] = useState(false)
  const [showPlazo, setShowPlazo] = useState(false)
  const isUrgente = mov.estado === 'Urgente'
  const resp = RESPONSABLE_INFO[mov.responsable]

  return (
    <div
      className={`border-b border-gray-50 transition-colors ${expanded ? 'bg-[#1a2e4a]/[0.02]' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
      style={isUrgente ? { borderLeft: '3px solid #ef4444' } : { borderLeft: '3px solid transparent' }}
    >
      <div onClick={() => setExpanded(e => !e)}
        className="grid items-start px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors group"
        style={{ gridTemplateColumns: MOV_COLS }}>
        {/* Fecha */}
        <div className="pt-0.5 min-w-0">
          <p className="text-[11px] text-gray-600 font-mono leading-none">{fmtFecha(mov.fecha)}</p>
        </div>
        {/* Folio */}
        <div className="pt-0.5 pr-1 min-w-0">
          <span className="inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold tracking-tight whitespace-nowrap">
            {mov.folio || '—'}
          </span>
          {mov.presenta && mov.presenta !== 'Nosotros' && (
            <div className="mt-0.5"><PresentaBadge presenta={mov.presenta} compact /></div>
          )}
        </div>
        {/* Tipo */}
        <div className="pt-0.5 min-w-0">
          <TipoSolicitudBadge tipo={mov.tipo_solicitud} />
        </div>
        {/* Solicitud */}
        <div className="pr-3 pt-0.5 min-w-0">
          <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{mov.solicitud || '—'}</p>
        </div>
        {/* Respuesta */}
        <div className="pr-3 pt-0.5 min-w-0">
          <div className="mb-0.5">
            <EstadoDropdown estado={mov.estado} onChange={e => onUpdate(mov.id, { estado: e })} />
          </div>
          {mov.respuesta?.trim() && (
            <p className="text-[10px] text-gray-500 line-clamp-2 leading-snug mt-0.5">{mov.respuesta}</p>
          )}
          {!mov.respuesta && mov.accion_requerida && (
            <p className="text-[10px] text-amber-600 line-clamp-1 italic mt-0.5">{mov.accion_requerida}</p>
          )}
        </div>
        {/* Fecha Respuesta */}
        <div className="pt-0.5 min-w-0">
          <p className="text-[11px] text-gray-500 font-mono">{mov.fecha_respuesta ? fmtFecha(mov.fecha_respuesta) : '—'}</p>
        </div>
        {/* Docs */}
        <div className="pt-0.5 min-w-0">
          <DocChip tiene={mov.tiene_documento} desc={mov.documento_desc} />
        </div>
        {/* Expand */}
        <div className="pt-0.5 flex justify-end">
          <ChevronRight size={13} className={`text-gray-300 group-hover:text-gray-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3.5 border-t border-gray-100 bg-white" onClick={e => e.stopPropagation()}>
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <EstadoDropdown estado={mov.estado} onChange={e => onUpdate(mov.id, { estado: e })} />
            <PresentaBadge presenta={mov.presenta || 'Otro'} />
            <TipoSolicitudBadge tipo={mov.tipo_solicitud} />
            <span className="text-[11px] text-gray-400">{fmtFechaLarga(mov.fecha)}</span>
            {mov.responsable && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ backgroundColor: resp?.color || '#94a3b8' }}>{mov.responsable}</div>
                <span className="text-[11px] text-gray-500">{resp?.nombre}</span>
              </div>
            )}
          </div>
          {/* Solicitud */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Solicitud / Movimiento</p>
            <p className="text-[12px] text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{mov.solicitud}</p>
          </div>
          {/* Respuesta */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Respuesta del tribunal</p>
            {mov.respuesta ? (
              <div className="rounded-lg border border-green-100 bg-green-50/50 p-3 space-y-2">
                <p className="text-[12px] text-gray-700 leading-relaxed">{mov.respuesta}</p>
                {(mov.fecha_respuesta || mov.fecha_notificacion) && (
                  <div className="flex items-center gap-4 pt-2 border-t border-green-100">
                    {mov.fecha_respuesta && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Respondida</span>
                        <span className="text-[11px] text-gray-600">{fmtFechaLarga(mov.fecha_respuesta)}</span>
                      </div>
                    )}
                    {mov.fecha_notificacion && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Notificada</span>
                        <span className="text-[11px] text-gray-600">{fmtFechaLarga(mov.fecha_notificacion)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <EstadoBadge estado={mov.estado} />
                <span className="text-[11px] text-gray-400">Sin respuesta aún</span>
              </div>
            )}
          </div>
          {mov.accion_requerida && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 flex items-start gap-2">
              <Bell size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Acción requerida</p>
                <p className="text-[12px] text-amber-900 leading-snug font-medium">{mov.accion_requerida}</p>
              </div>
            </div>
          )}
          {mov.consecuencia_procesal && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5 flex items-start gap-2">
              <Scale size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Consecuencia procesal</p>
                <p className="text-[12px] text-blue-900 leading-snug">{mov.consecuencia_procesal}</p>
              </div>
            </div>
          )}
          {mov.tiene_documento && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Documento:</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                <FileText size={11} />{mov.documento_desc || 'Documento adjunto'}
              </span>
            </div>
          )}
          {/* Notas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Notas internas</p>
              {!editNota && (
                <button onClick={() => setEditNota(true)}
                  className="text-[10px] text-[#1a2e4a] hover:text-[#243d5e] flex items-center gap-1 transition-colors">
                  <Edit2 size={9} /> Editar
                </button>
              )}
            </div>
            {editNota ? (
              <div className="space-y-1.5">
                <textarea value={notaDraft} onChange={e => setNotaDraft(e.target.value)} rows={2}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400" />
                <div className="flex gap-2">
                  <button onClick={() => { onUpdate(mov.id, { notas: notaDraft }); setEditNota(false) }}
                    className="text-[11px] px-2.5 py-1 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] flex items-center gap-1">
                    <Check size={10} /> Guardar
                  </button>
                  <button onClick={() => { setEditNota(false); setNotaDraft(mov.notas) }}
                    className="text-[11px] px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-gray-600 leading-relaxed bg-amber-50/50 rounded-lg p-2.5 min-h-[2rem]">
                {mov.notas || <span className="text-gray-400 italic">Sin notas</span>}
              </p>
            )}
          </div>
          {/* Generar */}
          <div className="pt-1 border-t border-gray-100">
            {!showTarea && !showPlazo && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mr-1">Generar</span>
                <button onClick={() => { setShowTarea(true); setShowPlazo(false) }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-2.5 py-1 rounded-lg transition-colors">
                  <ListTodo size={11} /> Tarea
                </button>
                <button onClick={() => { setShowPlazo(true); setShowTarea(false) }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-2.5 py-1 rounded-lg transition-colors">
                  <CalendarPlus size={11} /> Plazo
                </button>
              </div>
            )}
            {showTarea && <GenerarTareaForm causa={causa} mov={mov} addTarea={addTarea} onClose={() => setShowTarea(false)} />}
            {showPlazo && <GenerarPlazoForm causa={causa} mov={mov} addPlazo={addPlazo} onClose={() => setShowPlazo(false)} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FormNuevaEntrada ──────────────────────────────────────────────────────────────
function FormNuevaEntrada({ causa, causasInfo, pjudClientes, onSave, onClose, globalMode = false }) {
  const [selectedClienteNombre, setSelectedClienteNombre] = useState(
    globalMode ? '' : (causa?.cliente || '')
  )
  const [selectedCausaRit, setSelectedCausaRit] = useState(
    globalMode ? '' : (causa?.causa_rit || '')
  )
  const [form, setForm] = useState({
    fecha: TODAY, folio: '', presenta: 'Nosotros', tipo_solicitud: 'Solicitud',
    solicitud: '', respuesta: '', fecha_respuesta: '', fecha_notificacion: '',
    accion_requerida: '', consecuencia_procesal: '',
    estado: 'Pendiente', tiene_documento: false, documento_desc: '', notas: '', responsable: 'MT',
  })

  const causasForCliente = useMemo(() => {
    if (!globalMode) return []
    return causasInfo?.filter(c => c.cliente_nombre === selectedClienteNombre) || []
  }, [causasInfo, selectedClienteNombre, globalMode])

  const allClienteNames = useMemo(() => {
    if (!globalMode) return []
    return [...new Set((causasInfo || []).map(c => c.cliente_nombre).filter(Boolean))].sort()
  }, [causasInfo, globalMode])

  const resolvedCausa = globalMode
    ? (causasInfo?.find(c => c.rit === selectedCausaRit) || null)
    : causa

  const valid = form.fecha && form.folio.trim() && form.solicitud.trim() &&
    (globalMode ? (selectedClienteNombre && selectedCausaRit) : true)

  const handleSubmit = () => {
    if (!valid) return
    onSave({
      fecha: form.fecha, folio: form.folio.trim(), presenta: form.presenta,
      tipo_solicitud: form.tipo_solicitud, solicitud: form.solicitud.trim(),
      respuesta: form.respuesta.trim(), fecha_respuesta: form.fecha_respuesta || null,
      fecha_notificacion: form.fecha_notificacion || null,
      accion_requerida: form.accion_requerida.trim() || null,
      consecuencia_procesal: form.consecuencia_procesal.trim() || null,
      estado: form.respuesta.trim() ? 'Respondido' : form.estado,
      tiene_documento: form.tiene_documento,
      documento_desc: form.tiene_documento ? (form.documento_desc.trim() || 'Documento adjunto') : null,
      notas: form.notas.trim(),
      responsable: form.responsable,
      causa_rit: globalMode ? selectedCausaRit : (causa?.causa_rit || ''),
      cliente_nombre: globalMode ? selectedClienteNombre : (causa?.cliente || ''),
      causa_id: resolvedCausa?.id || null,
      cliente_id: resolvedCausa?.cliente_id || null,
    })
  }

  const F = ({ label, children }) => (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
  const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Nueva entrada PJUD</h3>
            {!globalMode && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                <span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">{causa?.causa_rit}</span>
                {' '}— {causa?.cliente}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
          {globalMode && (
            <div className="grid grid-cols-2 gap-3">
              <F label="Cliente *">
                <select value={selectedClienteNombre} onChange={e => { setSelectedClienteNombre(e.target.value); setSelectedCausaRit('') }} className={inp + ' bg-white'}>
                  <option value="">Seleccionar cliente...</option>
                  {allClienteNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </F>
              <F label="Causa *">
                <select value={selectedCausaRit} onChange={e => setSelectedCausaRit(e.target.value)} className={inp + ' bg-white'} disabled={!selectedClienteNombre}>
                  <option value="">Seleccionar causa...</option>
                  {causasForCliente.map(c => <option key={c.id} value={c.rit}>{c.rit}{c.materia ? ` — ${c.materia}` : ''}</option>)}
                </select>
              </F>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <F label="Fecha *">
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={inp} />
            </F>
            <F label="Folio / Referencia *">
              <input type="text" value={form.folio} onChange={e => setForm(f => ({ ...f, folio: e.target.value }))} placeholder="T-20261789-A" className={inp + ' font-mono'} />
            </F>
            <F label="Tipo de solicitud">
              <select value={form.tipo_solicitud} onChange={e => setForm(f => ({ ...f, tipo_solicitud: e.target.value }))} className={inp + ' bg-white'}>
                {TIPOS_SOLICITUD.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="¿Quién presenta?">
              <select value={form.presenta} onChange={e => setForm(f => ({ ...f, presenta: e.target.value }))} className={inp + ' bg-white'}>
                {Object.keys(PRESENTA_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>
            <F label="Estado">
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inp + ' bg-white'}>
                {ESTADOS_PJUD.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </F>
          </div>
          <F label="Solicitud / Movimiento *">
            <textarea value={form.solicitud} onChange={e => setForm(f => ({ ...f, solicitud: e.target.value }))} rows={3}
              placeholder="Descripción del movimiento o solicitud..."
              className={inp + ' resize-none'} />
          </F>
          <F label={<>Respuesta del tribunal <span className="text-gray-400 font-normal ml-1">(dejar vacío si no hay aún)</span></>}>
            <textarea value={form.respuesta} onChange={e => setForm(f => ({ ...f, respuesta: e.target.value }))} rows={2}
              placeholder="Resolución o respuesta del tribunal..."
              className={inp + ' resize-none'} />
          </F>
          {form.respuesta && (
            <div className="grid grid-cols-2 gap-3">
              <F label="Fecha respuesta">
                <input type="date" value={form.fecha_respuesta} onChange={e => setForm(f => ({ ...f, fecha_respuesta: e.target.value }))} className={inp} />
              </F>
              <F label="Fecha notificación">
                <input type="date" value={form.fecha_notificacion} onChange={e => setForm(f => ({ ...f, fecha_notificacion: e.target.value }))} className={inp} />
              </F>
            </div>
          )}
          <F label="Acción requerida">
            <input type="text" value={form.accion_requerida} onChange={e => setForm(f => ({ ...f, accion_requerida: e.target.value }))}
              placeholder="¿Qué acción debe tomarse?" className={inp} />
          </F>
          <F label="Consecuencia procesal">
            <input type="text" value={form.consecuencia_procesal} onChange={e => setForm(f => ({ ...f, consecuencia_procesal: e.target.value }))}
              placeholder="Audiencia fijada, plazo que corre..." className={inp} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Responsable">
              <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} className={inp + ' bg-white'}>
                {Object.keys(RESPONSABLE_INFO).map(r => <option key={r} value={r}>{r} – {RESPONSABLE_INFO[r].nombre}</option>)}
              </select>
            </F>
            <F label="¿Tiene documento adjunto?">
              <div className="flex gap-3 mt-0.5">
                {[true, false].map(v => (
                  <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setForm(f => ({ ...f, tiene_documento: v }))}
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${form.tiene_documento === v ? 'bg-[#1a2e4a] border-[#1a2e4a]' : 'border-gray-300'}`}>
                      {form.tiene_documento === v && <Check size={9} className="text-white" />}
                    </div>
                    <span className="text-[12px] text-gray-600">{v ? 'Sí' : 'No'}</span>
                  </label>
                ))}
              </div>
            </F>
          </div>
          {form.tiene_documento && (
            <F label="Descripción del documento">
              <input type="text" value={form.documento_desc} onChange={e => setForm(f => ({ ...f, documento_desc: e.target.value }))}
                placeholder="Descripción del documento..." className={inp} />
            </F>
          )}
          <F label="Notas internas">
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
              placeholder="Observaciones internas..." className={inp + ' resize-none'} />
          </F>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={!valid}
            className={`text-[13px] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <Plus size={13} /> Guardar entrada
          </button>
        </div>
      </div>
    </div>
  )
}

// ── View 3: MovimientosView ───────────────────────────────────────────────────────
function MovimientosView({ causa, onUpdate, onAddMovimiento, addTarea, addPlazo, onBack, onBackToClientes, causasInfo }) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const movimientos = useMemo(() => {
    if (!search.trim()) return causa.movimientos
    const q = search.toLowerCase()
    return causa.movimientos.filter(m =>
      (m.folio || '').toLowerCase().includes(q) ||
      (m.solicitud || '').toLowerCase().includes(q) ||
      (m.respuesta || '').toLowerCase().includes(q) ||
      (m.tipo_solicitud || '').toLowerCase().includes(q)
    )
  }, [causa.movimientos, search])

  const counts = {
    total:       causa.movimientos.length,
    pendientes:  causa.movimientos.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length,
    respondidas: causa.movimientos.filter(m => m.estado === 'Respondido').length,
    urgentes:    causa.movimientos.filter(m => m.estado === 'Urgente').length,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-1.5 border-b border-gray-100 bg-white">
        <button onClick={onBackToClientes} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Clientes</button>
        <ChevronRight size={11} className="text-gray-300" />
        <button onClick={onBack} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">{causa.cliente}</button>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-[11px] font-semibold text-gray-700">{causa.causa_rit ? `RIT ${causa.causa_rit}` : 'Sin RIT'}</span>
        <div className="ml-auto flex items-center gap-2">
          {causa.causa_ruc && (
            <span className="font-mono text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded">RUC {causa.causa_ruc}</span>
          )}
          {causa.materia && <span className="text-[12px] font-medium text-gray-600">{causa.materia}</span>}
          {causa.tribunal && <span className="text-[11px] text-gray-400">· {causa.tribunal}</span>}
        </div>
      </div>
      {/* Sub-header: stats + search + add */}
      <div className="flex-shrink-0 px-6 py-2.5 flex items-center gap-3 bg-white border-b border-gray-50">
        <div className="flex items-center gap-4 text-[11px]">
          <span className="font-bold text-gray-800 tabular-nums">{counts.total} mov.</span>
          {counts.respondidas > 0 && <span className="text-green-700 font-medium">{counts.respondidas} resp.</span>}
          {counts.pendientes > 0 && <span className="text-amber-700 font-medium">{counts.pendientes} pend.</span>}
          {counts.urgentes > 0 && <span className="text-red-700 font-bold flex items-center gap-1"><AlertCircle size={11} />{counts.urgentes} urg.</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="pl-8 pr-7 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg w-44 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium bg-[#1a2e4a] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#243d5e] transition-colors">
            <Plus size={13} /> Nueva entrada
          </button>
        </div>
      </div>
      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid px-4 py-2.5 bg-gray-50 border-b border-gray-100 sticky top-0 z-10"
          style={{ gridTemplateColumns: MOV_COLS }}>
          {MOV_HEADERS.map((h, i) => (
            <p key={i} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">{h}</p>
          ))}
        </div>
        {movimientos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Scale size={24} strokeWidth={1.5} className="mb-2 opacity-30" />
            <p className="text-[13px]">{search ? 'Sin resultados para la búsqueda' : 'Sin movimientos en esta causa'}</p>
          </div>
        ) : (
          movimientos.map((mov, i) => (
            <MovimientoRow key={mov.id} causa={causa} mov={mov} index={i}
              onUpdate={onUpdate} addTarea={addTarea} addPlazo={addPlazo} />
          ))
        )}
      </div>
      {showForm && (
        <FormNuevaEntrada
          causa={causa}
          onSave={mov => { onAddMovimiento(causa.causa_rit, mov); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ── View 2: CausasView ────────────────────────────────────────────────────────────
function CausasView({ clienteData, onSelectCausa, onBack }) {
  const { cliente, causas } = clienteData
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-1.5 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Clientes</button>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-[11px] font-semibold text-gray-700">{cliente}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
        <p className="text-[11px] text-gray-400 mb-2">{causas.length} causa{causas.length !== 1 ? 's' : ''}</p>
        {causas.map(c => {
          const allMovs = c.movimientos
          const urgentes   = allMovs.filter(m => m.estado === 'Urgente').length
          const pendientes = allMovs.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length
          const respondidas = allMovs.filter(m => m.estado === 'Respondido').length
          const lastMov = allMovs[0]
          return (
            <div key={c.id} onClick={() => onSelectCausa(c)}
              className="bg-white border border-gray-100 rounded-xl px-5 py-4 cursor-pointer hover:shadow-sm hover:border-gray-200 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {c.causa_rit && (
                      <span className="font-mono text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-semibold">RIT {c.causa_rit}</span>
                    )}
                    {c.causa_ruc && (
                      <span className="font-mono text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded">RUC {c.causa_ruc}</span>
                    )}
                    {c.tipo_causa && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{c.tipo_causa}</span>
                    )}
                    {urgentes > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
                      </span>
                    )}
                  </div>
                  {c.materia && <p className="text-[13px] font-semibold text-gray-800 mb-1">{c.materia}</p>}
                  {c.tribunal && <p className="text-[11px] text-gray-400">{c.tribunal}</p>}
                  {lastMov && (
                    <p className="text-[11px] text-gray-400 mt-1.5 truncate">
                      Último mov.: {fmtFechaLarga(lastMov.fecha)}{lastMov.solicitud ? ` · ${lastMov.solicitud.slice(0,55)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[12px] font-bold text-gray-700 tabular-nums">{allMovs.length} mov.</span>
                  {urgentes   > 0 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{urgentes} urg.</span>}
                  {pendientes > 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{pendientes} pend.</span>}
                  {respondidas > 0 && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{respondidas} resp.</span>}
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main PJUD ─────────────────────────────────────────────────────────────────────
export default function PJUD() {
  const [rows,           setRows]           = useState([])
  const [causasInfo,     setCausasInfo]     = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [error,          setError]          = useState(null)

  // Navigation
  const [view,            setView]            = useState('clientes')
  const [selectedClienteId, setSelectedClienteId] = useState(null)
  const [selectedCausaId,   setSelectedCausaId]   = useState(null)

  // Filters
  const [search,          setSearch]          = useState('')
  const [filterEstado,    setFilterEstado]    = useState('Todos')
  const [filterCliente,   setFilterCliente]   = useState('Todos')
  const [filterPresenta,  setFilterPresenta]  = useState('Todos')
  const [filterDocumento, setFilterDocumento] = useState('Todos')

  // Modals
  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false)
  const [showCargaMasiva,    setShowCargaMasiva]    = useState(false)

  const fetchRows = useCallback(async () => {
    setCargando(true); setError(null)
    const { data, error: err } = await supabase.from('pjud').select('*').order('fecha', { ascending: false })
    if (err) setError(err.message)
    else setRows((data || []).map(mapPjudRow))
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase.from('causas').select('id,rit,ruc,materia,tribunal,area,cliente_nombre,cliente_id').order('rit')
    setCausasInfo(data || [])
  }, [])

  useEffect(() => { fetchRows(); fetchCausas() }, [fetchRows, fetchCausas])

  // Build data tree
  const pjudClientes = useMemo(() => {
    const causaMap = {}
    rows.forEach(row => {
      const key = row.causa_rit || `${row.cliente_nombre || 'sin'}_sinrit`
      if (!causaMap[key]) {
        const ci = causasInfo.find(c => c.rit === row.causa_rit)
        causaMap[key] = {
          id: key, causa_rit: row.causa_rit || '', cliente: row.cliente_nombre || '',
          causa_ruc: ci?.ruc || '', tipo_causa: ci?.area || 'Civil',
          materia: ci?.materia || '', tribunal: ci?.tribunal || '',
          responsable: 'MT', movimientos: [],
        }
      }
      causaMap[key].movimientos.push(row)
    })
    Object.values(causaMap).forEach(c => c.movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha)))

    const clienteMap = {}
    Object.values(causaMap).forEach(causa => {
      const key = causa.cliente || '(sin cliente)'
      if (!clienteMap[key]) clienteMap[key] = { id: key, cliente: key, causas: [] }
      clienteMap[key].causas.push(causa)
    })
    Object.values(clienteMap).forEach(cl => cl.causas.sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || '')))
    return Object.values(clienteMap).sort((a, b) => a.cliente.localeCompare(b.cliente))
  }, [rows, causasInfo])

  const allMovsFlat = useMemo(() => pjudClientes.flatMap(cl => cl.causas.flatMap(c => c.movimientos)), [pjudClientes])

  const stats = useMemo(() => ({
    total:       allMovsFlat.length,
    pendientes:  allMovsFlat.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length,
    respondidas: allMovsFlat.filter(m => m.estado === 'Respondido').length,
    conAccion:   allMovsFlat.filter(m => m.accion_requerida?.trim()).length,
  }), [allMovsFlat])

  // Filtered clients for view 1
  const filteredClientes = useMemo(() => {
    const noFilters = !search && filterEstado === 'Todos' && filterPresenta === 'Todos' && filterDocumento === 'Todos'
    return pjudClientes
      .filter(cl => filterCliente === 'Todos' || cl.cliente === filterCliente)
      .map(cl => ({
        ...cl,
        causas: cl.causas.map(c => ({
          ...c,
          movimientos: c.movimientos.filter(m => {
            const q = search.toLowerCase()
            const ms = !q || (m.folio || '').toLowerCase().includes(q) || (m.solicitud || '').toLowerCase().includes(q) || (cl.cliente || '').toLowerCase().includes(q) || (c.causa_rit || '').toLowerCase().includes(q)
            const me = filterEstado   === 'Todos' || m.estado   === filterEstado
            const mp = filterPresenta === 'Todos' || m.presenta === filterPresenta
            const md = filterDocumento === 'Todos' || (filterDocumento === 'Con documento' && m.tiene_documento) || (filterDocumento === 'Sin documento' && !m.tiene_documento)
            return ms && me && mp && md
          }),
        })).filter(c => c.movimientos.length > 0 || noFilters),
      }))
      .filter(cl => cl.causas.length > 0)
  }, [pjudClientes, search, filterEstado, filterCliente, filterPresenta, filterDocumento])

  // Derive selected data from current state
  const currentCliente = useMemo(() => pjudClientes.find(cl => cl.id === selectedClienteId), [pjudClientes, selectedClienteId])
  const currentCausa   = useMemo(() => currentCliente?.causas.find(c => c.id === selectedCausaId), [currentCliente, selectedCausaId])

  // Handlers
  const handleUpdate = useCallback(async (movId, cambios) => {
    setRows(prev => prev.map(r => r.id === movId ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(Object.entries(cambios).filter(([k]) => PJUD_DB_FIELDS.has(k)))
    if (Object.keys(dbCambios).length === 0) return
    const { error: err } = await supabase.from('pjud').update(dbCambios).eq('id', movId)
    if (err) console.error('Error actualizando PJUD:', err.message)
  }, [])

  const handleAddMovimiento = useCallback(async (causaRit, movData) => {
    const ci = causasInfo.find(c => c.rit === causaRit)
    const payload = {
      fecha: movData.fecha, folio: movData.folio, presenta: movData.presenta || 'Nosotros',
      tipo_solicitud: movData.tipo_solicitud || 'Solicitud',
      solicitud: movData.solicitud || null, respuesta: movData.respuesta || null,
      fecha_respuesta: movData.fecha_respuesta || null, fecha_notificacion: movData.fecha_notificacion || null,
      accion_requerida: movData.accion_requerida || null, consecuencia_procesal: movData.consecuencia_procesal || null,
      estado: movData.respuesta?.trim() ? 'Respondido' : (movData.estado || 'Pendiente'),
      tiene_documento: movData.tiene_documento || false, documento_desc: movData.documento_desc || null,
      notas: movData.notas || null, responsable: movData.responsable || 'MT',
      causa_rit: causaRit, cliente_nombre: movData.cliente_nombre || (ci?.cliente_nombre || ''),
      causa_id: movData.causa_id || (ci?.id || null), cliente_id: movData.cliente_id || (ci?.cliente_id || null),
    }
    const { data, error: err } = await supabase.from('pjud').insert([payload]).select().single()
    if (err) alert('Error al guardar: ' + err.message)
    else setRows(prev => [mapPjudRow(data), ...prev])
  }, [causasInfo])

  const handleAddTarea = useCallback(async (tarea) => {
    const payload = {
      titulo: tarea.titulo, estado: tarea.estado || 'Pendiente', prioridad: tarea.prioridad || 'Media',
      fecha_vencimiento: tarea.fecha_vencimiento || null, notas: tarea.notas || null,
      cliente_nombre: tarea.cliente || null, causa_rit: tarea.causa_rit || null,
    }
    const { error: err } = await supabase.from('tareas').insert([payload])
    if (err) console.error('Error creando tarea:', err.message)
  }, [])

  const handleAddPlazo = useCallback(async (plazo) => {
    const payload = {
      titulo: plazo.titulo, tipo: plazo.tipo || 'Procesal',
      fecha_vencimiento: plazo.fecha_vencimiento || null,
      estado: plazo.estado || 'Activo', notas: plazo.notas || null, causa_rit: plazo.causa_rit || null,
    }
    const { error: err } = await supabase.from('plazos').insert([payload])
    if (err) console.error('Error creando plazo:', err.message)
  }, [])

  const clienteNames = useMemo(() => pjudClientes.map(cl => cl.cliente), [pjudClientes])
  const hasFilters = search || filterEstado !== 'Todos' || filterCliente !== 'Todos' || filterPresenta !== 'Todos' || filterDocumento !== 'Todos'

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">PJUD</h1>
            <p className="text-[12px] text-gray-400 mt-1">
              {cargando ? 'Cargando...' : `Poder Judicial · ${pjudClientes.length} clientes · ${allMovsFlat.length} movimientos`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCargaMasiva(true)}
              className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 text-gray-600 text-[13px] font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
              <Table2 size={14} /> Carga masiva
            </button>
            <button onClick={() => setShowNuevaSolicitud(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1a2e4a] text-white text-[13px] font-medium rounded-lg hover:bg-[#243d5e] transition-colors">
              <Plus size={14} /> Nueva entrada
            </button>
            <a href="https://oficinajudicialvirtual.pjud.cl/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 border border-[#1a2e4a]/20 text-[#1a2e4a] text-[13px] font-medium rounded-lg hover:bg-[#1a2e4a]/5 hover:border-[#1a2e4a]/40 transition-colors">
              <Scale size={14} /> Portal PJUD <ExternalLink size={11} className="opacity-60" />
            </a>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2.5">
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-[12px] text-red-700">{error}</p>
          <button onClick={fetchRows} className="ml-auto text-[11px] text-red-600 underline">Reintentar</button>
        </div>
      )}

      {/* Loading */}
      {cargando && (
        <div className="flex items-center justify-center py-20 text-gray-300">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* Stats — only on clientes view */}
          {view === 'clientes' && (
            <div className="flex-shrink-0 px-6 pt-3 pb-2 grid grid-cols-4 gap-2.5">
              <StatCard label="Total movimientos"   value={stats.total}       iconBg="bg-gray-50"  iconColor="text-gray-500"  icon={FileText}     />
              <StatCard label="Pendientes"           value={stats.pendientes}  iconBg="bg-amber-50" iconColor="text-amber-500" icon={Clock}        />
              <StatCard label="Respondidos"          value={stats.respondidas} iconBg="bg-green-50" iconColor="text-green-500" icon={CheckCircle2} />
              <StatCard label="Con acción requerida" value={stats.conAccion}   iconBg="bg-red-50"   iconColor="text-red-500"   icon={Bell}         />
            </div>
          )}

          {/* View router */}
          {view === 'clientes' && (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap py-3 sticky top-0 bg-white z-10">
                <div className="relative flex-1 min-w-48">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por folio, solicitud, cliente..."
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
                </div>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                  <option value="Todos">Todos los estados</option>
                  {ESTADOS_PJUD.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={filterPresenta} onChange={e => setFilterPresenta(e.target.value)}
                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                  <option value="Todos">Todos los presentantes</option>
                  {Object.keys(PRESENTA_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                  <option value="Todos">Todos los clientes</option>
                  {clienteNames.map(c => <option key={c} value={c}>{c.split(' ').slice(0,2).join(' ')}</option>)}
                </select>
                <select value={filterDocumento} onChange={e => setFilterDocumento(e.target.value)}
                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                  <option value="Todos">Con y sin documentos</option>
                  <option value="Con documento">Con documento</option>
                  <option value="Sin documento">Sin documento</option>
                </select>
                {hasFilters && (
                  <button onClick={() => { setSearch(''); setFilterEstado('Todos'); setFilterCliente('Todos'); setFilterPresenta('Todos'); setFilterDocumento('Todos') }}
                    className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                    <X size={11} /> Limpiar
                  </button>
                )}
              </div>
              {/* Client list */}
              <div className="space-y-2">
                {filteredClientes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <Scale size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
                    <p className="text-[13px]">No se encontraron registros</p>
                  </div>
                ) : filteredClientes.map(cl => {
                  const allMovs = cl.causas.flatMap(c => c.movimientos)
                  const urgentes   = allMovs.filter(m => m.estado === 'Urgente').length
                  const pendientes = allMovs.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length
                  return (
                    <div key={cl.id}
                      onClick={() => { setSelectedClienteId(cl.id); setView('causas') }}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-4 cursor-pointer hover:shadow-sm hover:border-gray-200 transition-all group">
                      <div className="flex items-start gap-3">
                        <ChevronRight size={14} className="flex-shrink-0 mt-0.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <p className="text-[14px] font-semibold text-gray-900 leading-none">{cl.cliente}</p>
                            {urgentes > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {cl.causas.map(c => {
                              const hU = c.movimientos.some(m => m.estado === 'Urgente')
                              const hP = c.movimientos.some(m => m.estado === 'Pendiente')
                              return (
                                <span key={c.id} className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-700">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hU ? 'bg-red-400' : hP ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                  {c.causa_rit ? <span className="font-mono text-[10px] text-violet-700 font-semibold">{c.causa_rit}</span> : <span className="text-gray-400 text-[10px]">sin RIT</span>}
                                  {c.materia && <span className="text-gray-500 text-[10px] max-w-[160px] truncate">· {c.materia}</span>}
                                  <span className="text-[10px] text-gray-400 font-medium">{c.movimientos.length} mov.</span>
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[10px] text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded-full">
                            {cl.causas.length} causa{cl.causas.length !== 1 ? 's' : ''}
                          </span>
                          {urgentes   > 0 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{urgentes} urg.</span>}
                          {pendientes > 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{pendientes} pend.</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'causas' && currentCliente && (
            <CausasView
              clienteData={currentCliente}
              onSelectCausa={c => { setSelectedCausaId(c.id); setView('movimientos') }}
              onBack={() => { setView('clientes'); setSelectedClienteId(null) }}
            />
          )}

          {view === 'movimientos' && currentCausa && (
            <MovimientosView
              causa={currentCausa}
              onUpdate={handleUpdate}
              onAddMovimiento={handleAddMovimiento}
              addTarea={handleAddTarea}
              addPlazo={handleAddPlazo}
              causasInfo={causasInfo}
              onBack={() => { setView('causas'); setSelectedCausaId(null) }}
              onBackToClientes={() => { setView('clientes'); setSelectedClienteId(null); setSelectedCausaId(null) }}
            />
          )}
        </>
      )}

      {/* Global Nueva Solicitud Modal */}
      {showNuevaSolicitud && (
        <FormNuevaEntrada
          globalMode
          causasInfo={causasInfo}
          pjudClientes={pjudClientes}
          onSave={async (movData) => {
            await handleAddMovimiento(movData.causa_rit, movData)
            setShowNuevaSolicitud(false)
          }}
          onClose={() => setShowNuevaSolicitud(false)}
        />
      )}

      {showCargaMasiva && (
        <CargaMasivaModal
          modulo="pjud"
          allCausas={causasInfo}
          onClose={() => setShowCargaMasiva(false)}
          onSuccess={insertedRows => setRows(prev => [...insertedRows.map(mapPjudRow), ...prev])}
        />
      )}
    </div>
  )
}
