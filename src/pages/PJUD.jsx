import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronRight, Search, Plus, ExternalLink,
  FileText, AlertTriangle, Clock, CheckCircle2,
  X, Check, Edit2, AlertCircle, Scale, Gavel, Bell,
  User, Users, Briefcase, Landmark, MoreHorizontal,
  CalendarPlus, ListTodo, ChevronDown, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Today ──────────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

// ── Estado config ──────────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  Respondida:      { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  Pendiente:       { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  Urgente:         { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
  'Sin respuesta': { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

// ── Presenta config ────────────────────────────────────────────────────────────
const PRESENTA_CONFIG = {
  'Nosotros':          { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: Briefcase, short: 'Nos.'    },
  'Contraparte':       { bg: 'bg-red-50',    text: 'text-red-700',    icon: Users,     short: 'Ctra.'   },
  'Ministerio Público':{ bg: 'bg-violet-50', text: 'text-violet-700', icon: Gavel,     short: 'Min.P.'  },
  'Tribunal':          { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Landmark,  short: 'Trib.'   },
  'Otro':              { bg: 'bg-gray-100',  text: 'text-gray-500',   icon: MoreHorizontal, short: 'Otro' },
}

const TIPO_CAUSA_COLOR = {
  Laboral: { bg: 'bg-blue-50',   text: 'text-blue-700'   },
  Civil:   { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  Familia: { bg: 'bg-rose-50',   text: 'text-rose-700'   },
  Penal:   { bg: 'bg-orange-50', text: 'text-orange-700' },
}

const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Andrea B.',   color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

// DB fields that can be persisted
const PJUD_DB_FIELDS = new Set([
  'estado','notas','solicitud','respuesta','fecha_respuesta','fecha_notificacion',
  'accion_requerida','consecuencia_procesal','presenta','responsable',
  'tiene_documento','documento_desc','fecha','folio','causa_rit','cliente_nombre',
  'causa_id','cliente_id',
])

function mapPjudRow(row) {
  return {
    id:                    row.id,
    fecha:                 row.fecha                 || TODAY,
    folio:                 row.folio                 || '',
    presenta:              row.presenta              || 'Nosotros',
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

const CATEGORIA_TAREA = ['Escrito', 'PJUD', 'Audiencia', 'SIAU', 'Documento', 'Seguimiento cliente', 'Cobranza', 'Otro']
const PRIORIDAD_TAREA = ['Alta', 'Media', 'Baja']
const TIPO_PLAZO = ['Legal', 'Procesal', 'Contractual', 'Judicial', 'Administrativo', 'Otro']

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcDiasDesde(fecha) {
  const t = new Date(TODAY + 'T00:00:00')
  const v = new Date(fecha  + 'T00:00:00')
  return Math.round((t - v) / (1000 * 60 * 60 * 24))
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-').map(Number)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[m - 1]}`
}

function fmtFechaLarga(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[m - 1]} ${y}`
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Small UI atoms ─────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Sin respuesta']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {estado}
    </span>
  )
}

function PresentaBadge({ presenta, compact = false }) {
  const cfg = PRESENTA_CONFIG[presenta] || PRESENTA_CONFIG['Otro']
  const Icon = cfg.icon
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
        <Icon size={9} className="flex-shrink-0" />
        {cfg.short}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      <Icon size={10} className="flex-shrink-0" />
      {presenta}
    </span>
  )
}

function FolioBadge({ folio }) {
  return (
    <span className="inline-flex items-center font-mono text-[10px] px-2 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold tracking-tight whitespace-nowrap">
      {folio}
    </span>
  )
}

function DocChip({ tiene, desc }) {
  if (!tiene) return <span className="text-[11px] text-gray-300">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 max-w-[80px] truncate" title={desc}>
      <FileText size={9} className="flex-shrink-0" />
      {desc ? desc.split(' ')[0] : 'Doc'}
    </span>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────────
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

// ── AlertBanner ────────────────────────────────────────────────────────────────
function AlertBanner({ causas }) {
  const overdue = []
  causas.forEach(c => {
    c.movimientos.forEach(m => {
      if ((m.estado === 'Sin respuesta' || m.estado === 'Pendiente') && calcDiasDesde(m.fecha) > 15) {
        overdue.push({ causa: c, mov: m })
      }
    })
  })
  const urgentes = causas.flatMap(c => c.movimientos.filter(m => m.estado === 'Urgente'))
  if (!overdue.length && !urgentes.length) return null

  return (
    <div className="mx-6 mb-3 space-y-2">
      {urgentes.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2.5">
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-[12px] text-red-700 font-medium">
            {urgentes.length} movimiento{urgentes.length > 1 ? 's' : ''} marcado{urgentes.length > 1 ? 's' : ''} como urgente requiere{urgentes.length === 1 ? '' : 'n'} atención inmediata
          </p>
        </div>
      )}
      {overdue.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2.5">
          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
          <p className="text-[12px] text-amber-700">
            {overdue.length} movimiento{overdue.length > 1 ? 's' : ''} sin respuesta hace más de 15 días
          </p>
        </div>
      )}
    </div>
  )
}

// ── RespuestaPanel (expanded) ──────────────────────────────────────────────────
function RespuestaPanel({ mov }) {
  if (!mov.respuesta && !mov.accion_requerida && !mov.consecuencia_procesal) {
    return (
      <div className="flex items-center gap-2">
        <EstadoBadge estado={mov.estado} />
        <span className="text-[11px] text-gray-400">
          Presentado el {fmtFechaLarga(mov.fecha)} · Sin respuesta aún
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Resolución */}
      {mov.respuesta && (
        <div className="rounded-lg border border-green-100 bg-green-50/50 p-3">
          <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest mb-1.5">Resolución del tribunal</p>
          <p className="text-[12px] text-gray-700 leading-relaxed">{mov.respuesta}</p>
          {/* Fechas metadata */}
          {(mov.fecha_respuesta || mov.fecha_notificacion) && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-green-100">
              {mov.fecha_respuesta && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Respondida</span>
                  <span className="text-[11px] font-medium text-gray-600">{fmtFechaLarga(mov.fecha_respuesta)}</span>
                </div>
              )}
              {mov.fecha_notificacion && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Notificada</span>
                  <span className="text-[11px] font-medium text-gray-600">{fmtFechaLarga(mov.fecha_notificacion)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Acción requerida */}
      {mov.accion_requerida && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 flex items-start gap-2">
          <Bell size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Acción requerida</p>
            <p className="text-[12px] text-amber-900 leading-snug font-medium">{mov.accion_requerida}</p>
          </div>
        </div>
      )}

      {/* Consecuencia procesal */}
      {mov.consecuencia_procesal && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5 flex items-start gap-2">
          <Scale size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Consecuencia procesal</p>
            <p className="text-[12px] text-blue-900 leading-snug">{mov.consecuencia_procesal}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── RespuestaCollapsed (table cell) ───────────────────────────────────────────
function RespuestaCollapsed({ mov }) {
  const dias = calcDiasDesde(mov.fecha)
  if (mov.respuesta) {
    return (
      <div className="space-y-1">
        <EstadoBadge estado={mov.estado} />
        {mov.fecha_respuesta && (
          <p className="text-[10px] text-gray-400">{fmtFecha(mov.fecha_respuesta)}</p>
        )}
        <p className="text-[11px] text-gray-600 leading-snug line-clamp-2">{mov.respuesta}</p>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <EstadoBadge estado={mov.estado} />
      {dias > 0 && (
        <p className={`text-[10px] ${dias > 15 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {dias}d sin respuesta
        </p>
      )}
      {mov.accion_requerida && (
        <p className="text-[10px] text-amber-600 line-clamp-1 italic">{mov.accion_requerida}</p>
      )}
    </div>
  )
}

// ── GenerarTareaForm ───────────────────────────────────────────────────────────
function GenerarTareaForm({ causa, mov, addTarea, onClose }) {
  const [form, setForm] = useState({
    titulo:           mov.accion_requerida || '',
    categoria:        'PJUD',
    prioridad:        mov.estado === 'Urgente' ? 'Alta' : 'Media',
    fecha_vencimiento: mov.fecha_respuesta ? addDays(mov.fecha_respuesta, 5) : addDays(TODAY, 5),
    responsable:      mov.responsable || causa.responsable,
    notas:            `Generado desde PJUD · ${causa.causa_rit} · Folio ${mov.folio}`,
  })

  const valid = form.titulo.trim() && form.fecha_vencimiento

  const handleSave = (e) => {
    e.stopPropagation()
    if (!valid) return
    addTarea({
      id: `ta_pjud_${Date.now()}`,
      titulo: form.titulo.trim(),
      cliente: causa.cliente,
      causa_rit: causa.causa_rit,
      causa_ruc: causa.causa_ruc,
      categoria: form.categoria,
      prioridad: form.prioridad,
      fecha_vencimiento: form.fecha_vencimiento,
      responsable: form.responsable,
      estado: 'Pendiente',
      notas: form.notas,
      subtareas: [],
      actividad: [{ id: `a1`, fecha: TODAY, hora: '', autor: form.responsable, tipo: 'creacion', desc: 'Tarea generada desde PJUD' }],
    })
    onClose()
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3 space-y-2.5" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
        <ListTodo size={10} /> Nueva tarea vinculada
      </p>
      <input
        type="text"
        value={form.titulo}
        onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
        placeholder="Título de la tarea..."
        className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
      />
      <div className="grid grid-cols-4 gap-2">
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Categoría</p>
          <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400">
            {CATEGORIA_TAREA.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Prioridad</p>
          <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400">
            {PRIORIDAD_TAREA.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vencimiento</p>
          <input type="date" value={form.fecha_vencimiento}
            onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
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
      <div className="flex items-center gap-2 pt-0.5">
        <button onClick={handleSave} disabled={!valid}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
            valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}>
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

// ── GenerarPlazoForm ───────────────────────────────────────────────────────────
function GenerarPlazoForm({ causa, mov, addPlazo, onClose }) {
  const defaultVenc = mov.fecha_notificacion
    ? addDays(mov.fecha_notificacion, 5)
    : mov.fecha_respuesta
      ? addDays(mov.fecha_respuesta, 5)
      : addDays(TODAY, 5)

  const [form, setForm] = useState({
    titulo:           mov.consecuencia_procesal || mov.accion_requerida || '',
    tipo:             'Procesal',
    fecha_inicio:     TODAY,
    fecha_vencimiento: defaultVenc,
    responsable:      mov.responsable || causa.responsable,
    notas:            `Generado desde PJUD · ${causa.causa_rit} · Folio ${mov.folio}`,
  })

  const valid = form.titulo.trim() && form.fecha_vencimiento

  const handleSave = (e) => {
    e.stopPropagation()
    if (!valid) return
    addPlazo({
      id: `pl_pjud_${Date.now()}`,
      titulo: form.titulo.trim(),
      cliente: causa.cliente,
      causa_rit: causa.causa_rit,
      causa_ruc: causa.causa_ruc,
      tipo: form.tipo,
      fecha_inicio: form.fecha_inicio,
      fecha_vencimiento: form.fecha_vencimiento,
      responsable: form.responsable,
      estado: 'Activo',
      notas: form.notas,
      tareas_vinculadas: [],
      hitos: [],
    })
    onClose()
  }

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2.5" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
        <CalendarPlus size={10} /> Nuevo plazo vinculado
      </p>
      <input
        type="text"
        value={form.titulo}
        onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
        placeholder="Descripción del plazo..."
        className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-400 bg-white"
      />
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
          <input type="date" value={form.fecha_inicio}
            onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-violet-400" />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vencimiento</p>
          <input type="date" value={form.fecha_vencimiento}
            onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
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
      <div className="flex items-center gap-2 pt-0.5">
        <button onClick={handleSave} disabled={!valid}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
            valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}>
          <Check size={10} /> Crear plazo
        </button>
        <button onClick={e => { e.stopPropagation(); onClose() }}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── MovimientoRow ──────────────────────────────────────────────────────────────
function MovimientoRow({ causa, mov, index, onUpdateNota, onChangeEstado, addTarea, addPlazo }) {
  const [expanded,    setExpanded]    = useState(false)
  const [editingNota, setEditingNota] = useState(false)
  const [notaDraft,   setNotaDraft]   = useState(mov.notas)
  const [showTareaForm, setShowTareaForm] = useState(false)
  const [showPlazoForm, setShowPlazoForm] = useState(false)

  const dias      = calcDiasDesde(mov.fecha)
  const isUrgente = mov.estado === 'Urgente'
  const isSinResp = (mov.estado === 'Sin respuesta' || mov.estado === 'Pendiente') && dias > 15
  const highlight = isUrgente || isSinResp
  const resp      = RESPONSABLE_INFO[mov.responsable]

  const saveNota = () => {
    onUpdateNota(notaDraft)
    setEditingNota(false)
  }

  const hasAcciones = mov.accion_requerida || mov.consecuencia_procesal

  return (
    <div
      className={`border-b border-gray-50 transition-colors ${
        expanded ? 'bg-[#1a2e4a]/[0.02]' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
      }`}
      style={highlight ? { borderLeft: '3px solid #ef4444' } : { borderLeft: '3px solid transparent' }}
    >
      {/* Main row — 7 cols: fecha | folio | presenta | solicitud | respuesta | doc | acciones */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="grid gap-0 items-start px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors group"
        style={{ gridTemplateColumns: '68px 128px 72px 1fr 1fr 90px 72px' }}
      >
        {/* Fecha */}
        <div className="pt-0.5">
          <p className="text-[12px] text-gray-600 font-medium">{fmtFecha(mov.fecha)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{mov.fecha.slice(0,4)}</p>
        </div>

        {/* Folio */}
        <div className="pt-0.5 pr-2">
          <FolioBadge folio={mov.folio} />
        </div>

        {/* Presenta */}
        <div className="pt-0.5">
          <PresentaBadge presenta={mov.presenta || 'Otro'} compact />
        </div>

        {/* Solicitud */}
        <div className="pr-3 pt-0.5">
          <p className="text-[12px] text-gray-700 leading-snug line-clamp-2">
            {mov.solicitud}
          </p>
        </div>

        {/* Respuesta */}
        <div className="pr-3 pt-0.5">
          <RespuestaCollapsed mov={mov} />
        </div>

        {/* Documentos */}
        <div className="pt-0.5">
          <DocChip tiene={mov.tiene_documento} desc={mov.documento_desc} />
          {mov.notas?.trim() && (
            <p className="text-[10px] text-amber-600 mt-1 line-clamp-1" title={mov.notas}>
              {mov.notas}
            </p>
          )}
        </div>

        {/* Expand chevron + acciones indicator */}
        <div className="pt-0.5 flex flex-col items-end gap-1">
          <ChevronRight
            size={13}
            className={`text-gray-300 group-hover:text-gray-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
          {hasAcciones && !expanded && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Tiene acción requerida" />
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-gray-100 bg-white" onClick={e => e.stopPropagation()}>

          {/* Meta row: estado + fechas + responsable + cambiar estado */}
          <div className="flex items-center gap-3 flex-wrap">
            <EstadoBadge estado={mov.estado} />
            <PresentaBadge presenta={mov.presenta || 'Otro'} />
            <span className="text-[11px] text-gray-400">{fmtFechaLarga(mov.fecha)}</span>
            {mov.responsable && (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                  style={{ backgroundColor: resp?.color || '#94a3b8' }}
                >
                  {mov.responsable}
                </div>
                <span className="text-[11px] text-gray-500">{resp?.nombre}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {['Respondida','Pendiente','Urgente','Sin respuesta']
                .filter(e => e !== mov.estado)
                .map(e => (
                  <button
                    key={e}
                    onClick={ev => { ev.stopPropagation(); onChangeEstado(e) }}
                    className="text-[10px] text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    → {e}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Solicitud */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Solicitud / Movimiento</p>
            <p className="text-[12px] text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
              {mov.solicitud}
            </p>
          </div>

          {/* Respuesta del tribunal — structured */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Respuesta del tribunal</p>
            <RespuestaPanel mov={mov} />
          </div>

          {/* Documento */}
          {mov.tiene_documento && mov.documento_desc && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Documento:</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                <FileText size={11} />
                {mov.documento_desc}
              </span>
            </div>
          )}

          {/* Notas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Notas internas</p>
              {!editingNota && (
                <button
                  onClick={() => setEditingNota(true)}
                  className="text-[10px] text-[#1a2e4a] hover:text-[#243d5e] flex items-center gap-1 transition-colors"
                >
                  <Edit2 size={9} /> Editar
                </button>
              )}
            </div>
            {editingNota ? (
              <div className="space-y-1.5">
                <textarea
                  value={notaDraft}
                  onChange={e => setNotaDraft(e.target.value)}
                  rows={2}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveNota()}
                    className="text-[11px] px-2.5 py-1 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] transition-colors flex items-center gap-1"
                  >
                    <Check size={10} /> Guardar
                  </button>
                  <button
                    onClick={() => { setEditingNota(false); setNotaDraft(mov.notas) }}
                    className="text-[11px] px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-gray-600 leading-relaxed bg-amber-50/50 rounded-lg p-2.5 min-h-[2rem]">
                {mov.notas || <span className="text-gray-400 italic">Sin notas</span>}
              </p>
            )}
          </div>

          {/* Generar tarea / plazo */}
          <div className="pt-1 border-t border-gray-100">
            {!showTareaForm && !showPlazoForm && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mr-1">Generar</span>
                <button
                  onClick={() => { setShowTareaForm(true); setShowPlazoForm(false) }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <ListTodo size={11} /> Tarea
                </button>
                <button
                  onClick={() => { setShowPlazoForm(true); setShowTareaForm(false) }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <CalendarPlus size={11} /> Plazo
                </button>
              </div>
            )}

            {showTareaForm && (
              <GenerarTareaForm
                causa={causa}
                mov={mov}
                addTarea={addTarea}
                onClose={() => setShowTareaForm(false)}
              />
            )}

            {showPlazoForm && (
              <GenerarPlazoForm
                causa={causa}
                mov={mov}
                addPlazo={addPlazo}
                onClose={() => setShowPlazoForm(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ClienteCard ────────────────────────────────────────────────────────────────
function ClienteCard({ causa, onSelect }) {
  const movimientos = causa.movimientos
  const counts = {
    Respondida:      movimientos.filter(m => m.estado === 'Respondida').length,
    Pendiente:       movimientos.filter(m => m.estado === 'Pendiente').length,
    Urgente:         movimientos.filter(m => m.estado === 'Urgente').length,
    'Sin respuesta': movimientos.filter(m => m.estado === 'Sin respuesta').length,
  }
  const hasUrgente = counts.Urgente > 0
  const tipoCfg = TIPO_CAUSA_COLOR[causa.tipo_causa] || TIPO_CAUSA_COLOR.Civil

  return (
    <div
      onClick={() => onSelect(causa)}
      className="border border-gray-100 rounded-xl px-4 py-3.5 cursor-pointer hover:shadow-sm hover:border-gray-200 transition-all group bg-white"
    >
      <div className="flex items-start gap-3">
        <ChevronRight size={14} className="flex-shrink-0 mt-1 text-gray-300 group-hover:text-gray-500 transition-colors" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-[14px] font-semibold text-gray-900 leading-none">{causa.cliente}</p>
            {hasUrgente && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">RIT {causa.causa_rit}</span>
            {causa.causa_ruc && <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700">RUC {causa.causa_ruc}</span>}
            <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${tipoCfg.bg} ${tipoCfg.text}`}>{causa.tipo_causa}</span>
            {causa.tribunal && <span className="text-[11px] text-gray-400">{causa.tribunal}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {counts.Urgente > 0 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{counts.Urgente} urg.</span>}
          {counts.Pendiente > 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{counts.Pendiente} pend.</span>}
          {counts['Sin respuesta'] > 0 && <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{counts['Sin respuesta']} s/r.</span>}
          <span className="text-[11px] text-gray-400 ml-1">{movimientos.length} mov.</span>
        </div>
      </div>
    </div>
  )
}

// ── CausaDrawer ────────────────────────────────────────────────────────────────
function CausaDrawer({ causa, onClose, onUpdate, onAddMovimiento, addTarea, addPlazo }) {
  const [showForm, setShowForm] = useState(false)
  const movimientos = causa.movimientos
  const counts = {
    respondidas: movimientos.filter(m => m.estado === 'Respondida').length,
    pendientes:  movimientos.filter(m => m.estado === 'Pendiente' || m.estado === 'Sin respuesta').length,
    conAccion:   movimientos.filter(m => m.accion_requerida?.trim()).length,
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="w-[18%] bg-black/25 backdrop-blur-[2px] cursor-pointer" onClick={onClose} />

      {/* Panel */}
      <div className="flex-1 bg-white flex flex-col shadow-2xl border-l border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">{causa.cliente}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-[11px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-semibold">RIT {causa.causa_rit}</span>
              {causa.causa_ruc && <span className="font-mono text-[11px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded font-semibold">RUC {causa.causa_ruc}</span>}
              {causa.tribunal && <span className="text-[11px] text-gray-400">{causa.tribunal}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://oficinajudicialvirtual.pjud.cl/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-3 py-1.5 rounded-lg transition-colors">
              <Scale size={12} /> Abrir PJUD <ExternalLink size={10} className="opacity-60" />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex items-center gap-5 px-6 py-2.5 bg-gray-50/50 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</span>
            <span className="text-[14px] font-bold text-gray-800 tabular-nums">{movimientos.length}</span>
          </div>
          <span className="text-gray-200">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Respondidas</span>
            <span className="text-[14px] font-bold text-green-700 tabular-nums">{counts.respondidas}</span>
          </div>
          <span className="text-gray-200">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Pendientes</span>
            <span className="text-[14px] font-bold text-amber-700 tabular-nums">{counts.pendientes}</span>
          </div>
          {counts.conAccion > 0 && (
            <>
              <span className="text-gray-200">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Con acción</span>
                <span className="text-[14px] font-bold text-red-700 tabular-nums">{counts.conAccion}</span>
              </div>
            </>
          )}
        </div>

        {/* Table header */}
        <div
          className="grid px-6 py-2 bg-gray-50/60 border-b border-gray-100 flex-shrink-0"
          style={{ gridTemplateColumns: '68px 140px 76px 1fr 1fr 96px 72px' }}
        >
          {['Fecha','Folio','Presenta','Solicitud / Movimiento','Respuesta del tribunal','Docs / Notas',''].map((h, i) => (
            <p key={i} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">{h}</p>
          ))}
        </div>

        {/* Movements */}
        <div className="flex-1 overflow-y-auto">
          {movimientos.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <p className="text-[13px]">Sin movimientos registrados</p>
            </div>
          ) : (
            movimientos.map((mov, i) => (
              <MovimientoRow
                key={mov.id}
                causa={causa}
                mov={mov}
                index={i}
                onUpdateNota={nota => onUpdate(mov.id, { notas: nota })}
                onChangeEstado={estado => onUpdate(mov.id, { estado })}
                addTarea={addTarea}
                addPlazo={addPlazo}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 flex items-center justify-between bg-gray-50/30">
          <p className="text-[11px] text-gray-400">
            {movimientos.length} {movimientos.length === 1 ? 'movimiento' : 'movimientos'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Nueva entrada
          </button>
        </div>
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

// ── FormNuevaEntrada ───────────────────────────────────────────────────────────
function FormNuevaEntrada({ causa, onSave, onClose }) {
  const [form, setForm] = useState({
    fecha:             TODAY,
    folio:             '',
    presenta:          'Nosotros',
    solicitud:         '',
    respuesta:         '',
    fecha_respuesta:   '',
    fecha_notificacion:'',
    accion_requerida:  '',
    consecuencia_procesal: '',
    estado:            'Pendiente',
    tiene_documento:   false,
    documento_desc:    '',
    notas:             '',
    responsable:       causa.responsable,
  })

  const valid = form.fecha && form.folio.trim() && form.solicitud.trim()

  const handleSubmit = () => {
    if (!valid) return
    onSave({
      id:                    `m_${Date.now()}`,
      fecha:                 form.fecha,
      folio:                 form.folio.trim(),
      presenta:              form.presenta,
      solicitud:             form.solicitud.trim(),
      respuesta:             form.respuesta.trim(),
      fecha_respuesta:       form.fecha_respuesta || null,
      fecha_notificacion:    form.fecha_notificacion || null,
      accion_requerida:      form.accion_requerida.trim() || null,
      consecuencia_procesal: form.consecuencia_procesal.trim() || null,
      estado:                form.respuesta.trim() ? 'Respondida' : form.estado,
      tiene_documento:       form.tiene_documento,
      documento_desc:        form.tiene_documento ? form.documento_desc.trim() || 'Documento adjunto' : null,
      notas:                 form.notas.trim(),
      responsable:           form.responsable,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Nueva entrada PJUD</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              <span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">
                {causa.causa_rit}
              </span>
              {' '}— {causa.cliente}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fecha *</label>
              <input type="date" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Folio / Referencia *</label>
              <input type="text" value={form.folio}
                onChange={e => setForm(f => ({ ...f, folio: e.target.value }))}
                placeholder="Ej: T-20261789-A"
                className="w-full text-[12px] font-mono border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">¿Quién presenta?</label>
              <select value={form.presenta}
                onChange={e => setForm(f => ({ ...f, presenta: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-blue-400">
                {Object.keys(PRESENTA_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Solicitud / Movimiento *</label>
            <textarea value={form.solicitud}
              onChange={e => setForm(f => ({ ...f, solicitud: e.target.value }))}
              rows={3}
              placeholder="Descripción del movimiento o solicitud..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
              Respuesta del tribunal
              <span className="text-gray-400 font-normal ml-1">(dejar vacío si aún no hay)</span>
            </label>
            <textarea value={form.respuesta}
              onChange={e => setForm(f => ({ ...f, respuesta: e.target.value }))}
              rows={3}
              placeholder="Resolución o respuesta del tribunal..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400" />
          </div>

          {form.respuesta && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fecha respuesta</label>
                <input type="date" value={form.fecha_respuesta}
                  onChange={e => setForm(f => ({ ...f, fecha_respuesta: e.target.value }))}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fecha notificación</label>
                <input type="date" value={form.fecha_notificacion}
                  onChange={e => setForm(f => ({ ...f, fecha_notificacion: e.target.value }))}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Acción requerida</label>
            <input type="text" value={form.accion_requerida}
              onChange={e => setForm(f => ({ ...f, accion_requerida: e.target.value }))}
              placeholder="¿Qué acción debe tomarse a raíz de este movimiento?"
              className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Consecuencia procesal</label>
            <input type="text" value={form.consecuencia_procesal}
              onChange={e => setForm(f => ({ ...f, consecuencia_procesal: e.target.value }))}
              placeholder="Audiencia fijada, plazo que corre, resolución que genera..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Estado</label>
              <select value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-blue-400">
                {Object.keys(ESTADO_CONFIG).map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Responsable</label>
              <select value={form.responsable}
                onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-blue-400">
                {Object.keys(RESPONSABLE_INFO).map(r => <option key={r} value={r}>{r} – {RESPONSABLE_INFO[r].nombre}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">¿Tiene documento adjunto?</label>
            <div className="flex gap-3">
              {[true, false].map(v => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, tiene_documento: v }))}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                      form.tiene_documento === v ? 'bg-[#1a2e4a] border-[#1a2e4a]' : 'border-gray-300'
                    }`}
                  >
                    {form.tiene_documento === v && <Check size={9} className="text-white" />}
                  </div>
                  <span className="text-[12px] text-gray-600">{v ? 'Sí' : 'No'}</span>
                </label>
              ))}
            </div>
            {form.tiene_documento && (
              <input type="text" value={form.documento_desc}
                onChange={e => setForm(f => ({ ...f, documento_desc: e.target.value }))}
                placeholder="Descripción del documento..."
                className="mt-2 w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400" />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Notas internas</label>
            <textarea value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2}
              placeholder="Observaciones internas, recordatorios..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button onClick={onClose}
            className="text-[13px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!valid}
            className={`text-[13px] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            <Plus size={13} />
            Guardar entrada
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main: PJUD ─────────────────────────────────────────────────────────────────
export default function PJUD() {
  const [rows,            setRows]            = useState([])
  const [causasInfo,      setCausasInfo]      = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [error,           setError]           = useState(null)
  const [search,          setSearch]          = useState('')
  const [filterEstado,    setFilterEstado]    = useState('Todos')
  const [filterCliente,   setFilterCliente]   = useState('Todos')
  const [filterPresenta,  setFilterPresenta]  = useState('Todos')
  const [filterDocumento, setFilterDocumento] = useState('Todos')
  const [selectedCausa,   setSelectedCausa]   = useState(null)

  // ── Fetch pjud rows ──
  const fetchRows = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pjud')
      .select('*')
      .order('fecha', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setRows((data || []).map(mapPjudRow))
    }
    setCargando(false)
  }, [])

  // ── Fetch causas for enrichment ──
  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id, rit, ruc, materia, tribunal, cliente_nombre, cliente_id')
      .order('rit')
    setCausasInfo(data || [])
  }, [])

  useEffect(() => {
    fetchRows()
    fetchCausas()
  }, [fetchRows, fetchCausas])

  // ── Build causa blocks from flat rows ──
  const pjudCausas = useMemo(() => {
    const map = {}
    rows.forEach(row => {
      const key = row.causa_rit || row.cliente_nombre || 'sin_causa'
      if (!map[key]) {
        const ci = causasInfo.find(c => c.rit === row.causa_rit)
        map[key] = {
          id:         key,
          causa_rit:  row.causa_rit,
          cliente:    row.cliente_nombre || ci?.cliente_nombre || '',
          causa_ruc:  ci?.ruc      || '',
          tipo_causa: ci?.materia  || 'Civil',
          tribunal:   ci?.tribunal || '',
          responsable:'MT',
          movimientos:[],
        }
      }
      map[key].movimientos.push(row)
    })
    // Sort movimientos within each causa by date desc
    Object.values(map).forEach(c => {
      c.movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha))
    })
    return Object.values(map).sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''))
  }, [rows, causasInfo])

  // ── Update a movimiento ──
  const handleUpdate = useCallback(async (movId, cambios) => {
    setRows(prev => prev.map(r => r.id === movId ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(
      Object.entries(cambios).filter(([k]) => PJUD_DB_FIELDS.has(k))
    )
    if (Object.keys(dbCambios).length === 0) return
    const { error: err } = await supabase.from('pjud').update(dbCambios).eq('id', movId)
    if (err) console.error('Error actualizando PJUD:', err.message)
  }, [])

  // ── Add new movimiento ──
  const handleAddMovimiento = useCallback(async (causaRit, movData) => {
    const ci = causasInfo.find(c => c.rit === causaRit)
    const payload = {
      fecha:                 movData.fecha,
      folio:                 movData.folio,
      presenta:              movData.presenta              || 'Nosotros',
      solicitud:             movData.solicitud             || null,
      respuesta:             movData.respuesta             || null,
      fecha_respuesta:       movData.fecha_respuesta       || null,
      fecha_notificacion:    movData.fecha_notificacion    || null,
      accion_requerida:      movData.accion_requerida      || null,
      consecuencia_procesal: movData.consecuencia_procesal || null,
      estado:                movData.respuesta?.trim() ? 'Respondida' : (movData.estado || 'Pendiente'),
      tiene_documento:       movData.tiene_documento       || false,
      documento_desc:        movData.documento_desc        || null,
      notas:                 movData.notas                 || null,
      responsable:           movData.responsable           || 'MT',
      causa_rit:             causaRit,
      cliente_nombre:        ci?.cliente_nombre            || '',
      causa_id:              ci?.id                        || null,
      cliente_id:            ci?.cliente_id                || null,
    }
    const { data, error: err } = await supabase.from('pjud').insert([payload]).select().single()
    if (err) {
      alert('Error al guardar: ' + err.message)
    } else {
      setRows(prev => [mapPjudRow(data), ...prev])
    }
  }, [causasInfo])

  // ── Add tarea to Supabase ──
  const handleAddTarea = useCallback(async (tarea) => {
    const payload = {
      titulo:           tarea.titulo,
      estado:           tarea.estado           || 'Pendiente',
      prioridad:        tarea.prioridad         || 'Media',
      fecha_vencimiento:tarea.fecha_vencimiento || null,
      notas:            tarea.notas             || null,
      cliente_nombre:   tarea.cliente           || null,
      causa_rit:        tarea.causa_rit         || null,
    }
    const { error: err } = await supabase.from('tareas').insert([payload])
    if (err) console.error('Error creando tarea:', err.message)
  }, [])

  // ── Add plazo to Supabase ──
  const handleAddPlazo = useCallback(async (plazo) => {
    const payload = {
      titulo:           plazo.titulo,
      tipo:             plazo.tipo              || 'Procesal',
      fecha_vencimiento:plazo.fecha_vencimiento || null,
      estado:           plazo.estado            || 'Activo',
      notas:            plazo.notas             || null,
      causa_rit:        plazo.causa_rit         || null,
    }
    const { error: err } = await supabase.from('plazos').insert([payload])
    if (err) console.error('Error creando plazo:', err.message)
  }, [])

  const allMovs = useMemo(() => pjudCausas.flatMap(c => c.movimientos), [pjudCausas])

  const stats = useMemo(() => ({
    total:       allMovs.length,
    pendientes:  allMovs.filter(m => m.estado === 'Pendiente' || m.estado === 'Sin respuesta').length,
    respondidas: allMovs.filter(m => m.estado === 'Respondida').length,
    conAccion:   allMovs.filter(m => m.accion_requerida?.trim()).length,
  }), [allMovs])

  const filteredCausas = useMemo(() => {
    return pjudCausas
      .filter(c => filterCliente === 'Todos' || c.cliente === filterCliente)
      .map(c => ({
        ...c,
        movimientos: c.movimientos.filter(m => {
          const q = search.toLowerCase()
          const matchSearch = !q ||
            (m.folio        || '').toLowerCase().includes(q) ||
            (m.solicitud    || '').toLowerCase().includes(q) ||
            (m.respuesta    || '').toLowerCase().includes(q) ||
            (c.cliente      || '').toLowerCase().includes(q) ||
            (c.causa_rit    || '').toLowerCase().includes(q)
          const matchEstado   = filterEstado   === 'Todos' || m.estado   === filterEstado
          const matchPresenta = filterPresenta === 'Todos' || m.presenta === filterPresenta
          const matchDoc =
            filterDocumento === 'Todos' ||
            (filterDocumento === 'Con documento' &&  m.tiene_documento) ||
            (filterDocumento === 'Sin documento' && !m.tiene_documento)
          return matchSearch && matchEstado && matchPresenta && matchDoc
        }),
      }))
      .filter(c =>
        c.movimientos.length > 0 ||
        (!search && filterEstado === 'Todos' && filterPresenta === 'Todos' && filterDocumento === 'Todos')
      )
  }, [pjudCausas, search, filterEstado, filterCliente, filterPresenta, filterDocumento])

  const clientes    = useMemo(() => [...new Set(pjudCausas.map(c => c.cliente).filter(Boolean))], [pjudCausas])
  const hasFilters  = search || filterEstado !== 'Todos' || filterCliente !== 'Todos' || filterPresenta !== 'Todos' || filterDocumento !== 'Todos'

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">PJUD</h1>
            <p className="text-[12px] text-gray-400 mt-1">
              {cargando
                ? 'Cargando...'
                : `Poder Judicial de Chile · ${pjudCausas.length} causas · ${allMovs.length} movimientos`
              }
            </p>
          </div>
          <a
            href="https://oficinajudicialvirtual.pjud.cl/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 border border-[#1a2e4a]/20 text-[#1a2e4a] text-[13px] font-medium rounded-lg hover:bg-[#1a2e4a]/5 hover:border-[#1a2e4a]/40 transition-colors"
          >
            <Scale size={14} />
            Portal PJUD
            <ExternalLink size={11} className="opacity-60" />
          </a>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-6 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2.5">
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-[12px] text-red-700">{error}</p>
          <button onClick={fetchRows} className="ml-auto text-[11px] text-red-600 underline">Reintentar</button>
        </div>
      )}

      {/* ── Loading ── */}
      {cargando && (
        <div className="flex items-center justify-center py-20 text-gray-300">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* ── Stats ── */}
          <div className="flex-shrink-0 px-6 pb-3 grid grid-cols-4 gap-2.5">
            <StatCard label="Total movimientos"   value={stats.total}       iconBg="bg-gray-50"  iconColor="text-gray-500"  icon={FileText}     />
            <StatCard label="Pendientes"           value={stats.pendientes}  iconBg="bg-amber-50" iconColor="text-amber-500" icon={Clock}        />
            <StatCard label="Respondidas"          value={stats.respondidas} iconBg="bg-green-50" iconColor="text-green-500" icon={CheckCircle2} />
            <StatCard label="Con acción requerida" value={stats.conAccion}   iconBg="bg-red-50"   iconColor="text-red-500"   icon={Bell}         />
          </div>

          {/* ── Alerts ── */}
          <AlertBanner causas={pjudCausas} />

          {/* ── Filters ── */}
          <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por folio, solicitud, respuesta, cliente..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>

            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              <option value="Todos">Todos los estados</option>
              {Object.keys(ESTADO_CONFIG).map(e => <option key={e} value={e}>{e}</option>)}
            </select>

            <select value={filterPresenta} onChange={e => setFilterPresenta(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              <option value="Todos">Todos los presentantes</option>
              {Object.keys(PRESENTA_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              <option value="Todos">Todos los clientes</option>
              {clientes.map(c => <option key={c} value={c}>{c.split(' ').slice(0,2).join(' ')}</option>)}
            </select>

            <select value={filterDocumento} onChange={e => setFilterDocumento(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              <option value="Todos">Con y sin documentos</option>
              <option value="Con documento">Con documento</option>
              <option value="Sin documento">Sin documento</option>
            </select>

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFilterEstado('Todos'); setFilterCliente('Todos'); setFilterPresenta('Todos'); setFilterDocumento('Todos') }}
                className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
              >
                <X size={11} /> Limpiar
              </button>
            )}
          </div>

          {/* ── Blocks list ── */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {filteredCausas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Scale size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
                <p className="text-[13px]">No se encontraron causas con los filtros actuales</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCausas.map(c => (
                  <ClienteCard key={c.id} causa={c} onSelect={setSelectedCausa} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedCausa && (
        <CausaDrawer
          causa={pjudCausas.find(c => c.id === selectedCausa.id) || selectedCausa}
          onClose={() => setSelectedCausa(null)}
          onUpdate={handleUpdate}
          onAddMovimiento={handleAddMovimiento}
          addTarea={handleAddTarea}
          addPlazo={handleAddPlazo}
        />
      )}
    </div>
  )
}
