import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronDown, Search, Plus, ArrowLeft,
  FileText, Clock, CheckCircle2, X, Check, Edit2,
  AlertCircle, Scale, Bell, Users, Briefcase, Landmark,
  MoreHorizontal, CalendarPlus, ListTodo, Loader2, Table2, Gavel, Trash2, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import CargaMasivaModal from '../components/CargaMasivaModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import { useNavigation } from '../context/NavigationContext'
import useResizableColumns from '../hooks/useResizableColumns'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Configs ──────────────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  'Respondido':           { bg: 'bg-[#1a2e4a]',             text: 'text-white',      dot: 'bg-white',         border: 'border-transparent'          },
  'Proveído':             { bg: 'bg-[#1a2e4a]',             text: 'text-white',      dot: 'bg-white',         border: 'border-transparent'          },
  'Archivado':            { bg: 'bg-[#1a2e4a]',             text: 'text-white',      dot: 'bg-white',         border: 'border-transparent'          },
  'Pendiente':            { bg: 'bg-[rgba(26,46,74,0.08)]', text: 'text-[#1a2e4a]', dot: 'bg-[#1a2e4a]',    border: 'border-[rgba(26,46,74,0.2)]' },
  'Escrito presentado':   { bg: 'bg-[rgba(26,46,74,0.08)]', text: 'text-[#1a2e4a]', dot: 'bg-[#1a2e4a]',    border: 'border-[rgba(26,46,74,0.2)]' },
  'Resolución pendiente': { bg: 'bg-[rgba(26,46,74,0.08)]', text: 'text-[#1a2e4a]', dot: 'bg-[#1a2e4a]',    border: 'border-[rgba(26,46,74,0.2)]' },
  'No ha lugar':          { bg: 'bg-[#f1f5f9]',             text: 'text-[#64748b]',  dot: 'bg-[#94a3b8]',    border: 'border-[#e2e8f0]'            },
  'Urgente':              { bg: 'bg-[#fee2e2]',             text: 'text-[#991b1b]',  dot: 'bg-[#991b1b]',    border: 'border-transparent'          },
}
const ESTADOS_PJUD = Object.keys(ESTADO_CONFIG)

const PRESENTA_CONFIG = {
  'Nosotros':           { bg: 'bg-[rgba(26,46,74,0.08)]', text: 'text-[#1a2e4a]', icon: Briefcase,      short: 'Nos.'   },
  'Contraparte':        { bg: 'bg-[#fef2f2]',             text: 'text-[#991b1b]', icon: Users,          short: 'Ctra.'  },
  'Ministerio Público': { bg: 'bg-[#f1f5f9]',             text: 'text-[#475569]', icon: Gavel,          short: 'Min.P.' },
  'Tribunal':           { bg: 'bg-[#f1f5f9]',             text: 'text-[#475569]', icon: Landmark,       short: 'Trib.'  },
  'Otro':               { bg: 'bg-[#f8fafc]',             text: 'text-[#94a3b8]', icon: MoreHorizontal, short: 'Otro'   },
}

const TIPO_SOLICITUD_CONFIG = {
  'Escrito':      { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
  'Presentación': { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
  'Recurso':      { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
  'Otrosí':       { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
  'Solicitud':    { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
  'Otro':         { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]' },
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
  'tiene_documento','documento_desc','fecha','folio','causa_rit','causa_ruc','cliente_nombre',
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
    causa_ruc:             row.causa_ruc             || '',
    cliente_nombre:        row.cliente_nombre        || '',
    causa_id:              row.causa_id              || null,
    cliente_id:            row.cliente_id            || null,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2,'0')}-${MESES[m-1]}-${String(y).slice(2)}`
}
function fmtFechaLarga(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m-1]} ${y}`
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
const ESTADO_FALLBACK = { bg: 'bg-[#f8fafc]', text: 'text-[#94a3b8]', dot: 'bg-[#94a3b8]', border: 'border-transparent' }

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_FALLBACK
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border || 'border-transparent'}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{estado}
    </span>
  )
}

function EstadoInline({ estado, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(estado)
  const cfg = ESTADO_CONFIG[estado] || ESTADO_FALLBACK

  function commit() {
    setEditing(false)
    const val = draft.trim() || estado
    if (val !== estado) onChange(val)
  }

  if (editing) return (
    <input
      type="text"
      value={draft}
      autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if (e.key === 'Escape') { setDraft(estado); setEditing(false) }
      }}
      onClick={e => e.stopPropagation()}
      className="text-[11px] border border-blue-300 rounded-lg px-2 py-0.5 bg-white focus:outline-none w-36"
    />
  )
  return (
    <button
      onClick={e => { e.stopPropagation(); setDraft(estado); setEditing(true) }}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap hover:opacity-80 transition-opacity cursor-pointer ${cfg.bg} ${cfg.text} ${cfg.border || 'border-transparent'}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{estado}
    </button>
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
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${cfg.bg} ${cfg.text} border-current/20`}>
      {tipo || '—'}
    </span>
  )
}

function DocChip({ tiene, desc }) {
  if (!tiene) return <span className="text-[11px] text-gray-300">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 max-w-[80px] truncate" title={desc}>
      <FileText size={9} className="flex-shrink-0" />{desc ? desc.split(' ')[0] : 'Ver doc'}
    </span>
  )
}

// ── CausaIdentChip — muestra RIT (violeta) o RUC (celeste) o "Sin RIT/RUC" ───
function CausaIdentChip({ causa_rit, causa_ruc, size = 'md' }) {
  const cls = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 rounded'
    : 'text-[11px] px-2 py-0.5 rounded-lg'
  if (causa_rit) return (
    <span className={`font-mono font-bold border whitespace-nowrap bg-violet-50 text-violet-700 border-violet-100 ${cls}`}>
      {causa_rit}
    </span>
  )
  if (causa_ruc) return (
    <span className={`font-mono font-bold border whitespace-nowrap bg-sky-50 text-sky-700 border-sky-100 ${cls}`}>
      RUC {causa_ruc}
    </span>
  )
  return <span className={`text-gray-400 font-medium ${cls}`}>Sin RIT/RUC</span>
}

/** Filtra registros de una causa considerando RIT → RUC → sin identificador */
function matchCausa(r, causaData, clienteNombre) {
  if (r.cliente_nombre !== clienteNombre) return false
  if (causaData.causa_rit) return r.causa_rit === causaData.causa_rit
  if (causaData.causa_ruc) return r.causa_ruc === causaData.causa_ruc
  return !r.causa_rit && !r.causa_ruc
}

// ── GenerarTareaForm ──────────────────────────────────────────────────────────
function GenerarTareaForm({ causaRit, clienteNombre, mov, addTarea, onClose }) {
  const [form, setForm] = useState({
    titulo:            mov.accion_requerida || '',
    categoria:         'PJUD',
    prioridad:         mov.estado === 'Urgente' ? 'Alta' : 'Media',
    fecha_vencimiento: mov.fecha_respuesta ? addDays(mov.fecha_respuesta, 5) : addDays(TODAY, 5),
    responsable:       mov.responsable || 'MT',
    notas:             `Generado desde PJUD · ${causaRit} · Folio ${mov.folio}`,
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
        <button onClick={e => {
          e.stopPropagation(); if (!valid) return
          addTarea({ id: `ta_${Date.now()}`, titulo: form.titulo.trim(), cliente: clienteNombre, causa_rit: causaRit, categoria: form.categoria, prioridad: form.prioridad, fecha_vencimiento: form.fecha_vencimiento, responsable: form.responsable, estado: 'Pendiente', notas: form.notas, subtareas: [] })
          onClose()
        }}
          disabled={!valid}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${valid ? 'bg-[#2570BA] text-white hover:bg-[#2570BA]/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
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

// ── GenerarPlazoForm ──────────────────────────────────────────────────────────
function GenerarPlazoForm({ causaRit, clienteNombre, mov, addPlazo, onClose }) {
  const defaultVenc = mov.fecha_notificacion ? addDays(mov.fecha_notificacion, 5) : mov.fecha_respuesta ? addDays(mov.fecha_respuesta, 5) : addDays(TODAY, 5)
  const [form, setForm] = useState({
    titulo: mov.consecuencia_procesal || mov.accion_requerida || '',
    tipo: 'Procesal', fecha_inicio: TODAY, fecha_vencimiento: defaultVenc,
    responsable: mov.responsable || 'MT', notas: `Generado desde PJUD · ${causaRit} · Folio ${mov.folio}`,
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
        <button onClick={e => {
          e.stopPropagation(); if (!valid) return
          addPlazo({ id: `pl_${Date.now()}`, titulo: form.titulo.trim(), cliente: clienteNombre, causa_rit: causaRit, tipo: form.tipo, fecha_inicio: form.fecha_inicio, fecha_vencimiento: form.fecha_vencimiento, responsable: form.responsable, estado: 'Activo', notas: form.notas })
          onClose()
        }}
          disabled={!valid}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${valid ? 'bg-[#2570BA] text-white hover:bg-[#2570BA]/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
          <Check size={10} /> Crear plazo
        </button>
        <button onClick={e => { e.stopPropagation(); onClose() }}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
      </div>
    </div>
  )
}

// ── FormNuevaEntrada (modal) ──────────────────────────────────────────────────
function FormNuevaEntrada({ causa, causasInfo, onSave, onClose, globalMode = false }) {
  const [selectedClienteNombre, setSelectedClienteNombre] = useState(globalMode ? '' : (causa?.cliente_nombre || ''))
  const [selectedCausaRit, setSelectedCausaRit] = useState(globalMode ? '' : (causa?.rit || causa?.causa_rit || ''))
  const [form, setForm] = useState({
    fecha: TODAY, folio: '', presenta: 'Nosotros', tipo_solicitud: 'Solicitud',
    solicitud: '', respuesta: '', fecha_respuesta: '', fecha_notificacion: '',
    accion_requerida: '', consecuencia_procesal: '',
    estado: 'Pendiente', tiene_documento: false, documento_desc: '', notas: '', responsable: 'MT',
  })

  const allClienteNames = useMemo(() =>
    [...new Set((causasInfo || []).map(c => c.cliente_nombre).filter(Boolean))].sort(),
    [causasInfo])
  const causasForCliente = useMemo(() =>
    (causasInfo || []).filter(c => c.cliente_nombre === selectedClienteNombre),
    [causasInfo, selectedClienteNombre])
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
      notas: form.notas.trim(), responsable: form.responsable,
      causa_rit: globalMode ? selectedCausaRit : (causa?.rit || causa?.causa_rit || ''),
      cliente_nombre: globalMode ? selectedClienteNombre : (causa?.cliente_nombre || ''),
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
            {!globalMode && causa && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                <span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">{causa.rit || causa.causa_rit}</span>
                {' '}— {causa.cliente_nombre}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={15} /></button>
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
              <input type="text" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                placeholder="Ej: Pendiente, Respondido…" className={inp + ' bg-white'} />
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
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${form.tiene_documento === v ? 'bg-[#2570BA] border-[#2570BA]' : 'border-gray-300'}`}>
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
          <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSubmit} disabled={!valid}
            className={`text-[13px] px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${valid ? 'bg-[#2570BA] text-white hover:bg-[#2570BA]/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <Plus size={13} /> Guardar entrada
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded detail for a movimiento row ─────────────────────────────────────
function MovimientoDetail({ mov, causaRit, clienteNombre, onUpdate, addTarea, addPlazo }) {
  const [editNota, setEditNota] = useState(false)
  const [notaDraft, setNotaDraft] = useState(mov.notas)
  const [showTarea, setShowTarea] = useState(false)
  const [showPlazo, setShowPlazo] = useState(false)
  const resp = RESPONSABLE_INFO[mov.responsable]

  return (
    <div className="rounded-2xl border border-[#1a2e4a]/8 bg-[#1a2e4a]/[0.025] p-5 space-y-4" onClick={e => e.stopPropagation()}>
      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <EstadoInline estado={mov.estado} onChange={e => onUpdate(mov.id, { estado: e })} />
        <PresentaBadge presenta={mov.presenta || 'Otro'} />
        <TipoSolicitudBadge tipo={mov.tipo_solicitud} />
        <span className="text-[11px] text-gray-400">{fmtFechaLarga(mov.fecha)}</span>
        {mov.responsable && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ backgroundColor: resp?.color || '#94a3b8' }}>{mov.responsable}</div>
            <span className="text-[11px] text-gray-500">{resp?.nombre}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Solicitud */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Solicitud completa</p>
          <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-white rounded-xl p-3 border border-gray-100">
            {mov.solicitud || '—'}
          </p>
        </div>
        {/* Respuesta */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Respuesta del tribunal</p>
          {mov.respuesta ? (
            <div className="rounded-xl border border-green-100 bg-green-50/50 p-3 space-y-2">
              <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{mov.respuesta}</p>
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
            <div className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100">
              <EstadoBadge estado={mov.estado} />
              <span className="text-[11px] text-gray-400">Sin respuesta aún</span>
            </div>
          )}
        </div>
      </div>

      {/* Acción / Consecuencia */}
      <div className="flex gap-3">
        {mov.accion_requerida && (
          <div className="flex-1 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 flex items-start gap-2">
            <Bell size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Acción requerida</p>
              <p className="text-[12px] text-amber-900 leading-snug font-medium">{mov.accion_requerida}</p>
            </div>
          </div>
        )}
        {mov.consecuencia_procesal && (
          <div className="flex-1 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5 flex items-start gap-2">
            <Scale size={11} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Consecuencia procesal</p>
              <p className="text-[12px] text-blue-900 leading-snug">{mov.consecuencia_procesal}</p>
            </div>
          </div>
        )}
      </div>

      {/* Documento */}
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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notas internas</p>
          {!editNota && (
            <button onClick={() => setEditNota(true)}
              className="text-[10px] text-[#1a2e4a] hover:text-[#243d5e] flex items-center gap-1">
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
                className="text-[11px] px-2.5 py-1 bg-[#2570BA] text-white rounded-lg hover:bg-[#2570BA]/90 flex items-center gap-1">
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

      {/* Generar Tarea / Plazo */}
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
        {showTarea && <GenerarTareaForm causaRit={causaRit} clienteNombre={clienteNombre} mov={mov} addTarea={addTarea} onClose={() => setShowTarea(false)} />}
        {showPlazo && <GenerarPlazoForm causaRit={causaRit} clienteNombre={clienteNombre} mov={mov} addPlazo={addPlazo} onClose={() => setShowPlazo(false)} />}
      </div>
    </div>
  )
}

// ── MovimientosTable (table view) ─────────────────────────────────────────────
export function MovimientosTable({ causaData, rowsAll, onUpdate, onAdd, onDelete, causasInfo, addTarea, addPlazo, onBack, embedded = false }) {
  const { causa_rit, causa_ruc, causaInfo, clienteNombre } = causaData

  const movimientos = useMemo(() =>
    rowsAll.filter(r => matchCausa(r, causaData, clienteNombre))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [rowsAll, causa_rit, causa_ruc, clienteNombre])

  const [expandedId,      setExpandedId]      = useState(null)
  const [editingId,       setEditingId]       = useState(null)
  const [editDraft,       setEditDraft]       = useState({})
  const [showForm,        setShowForm]        = useState(false)
  const [showCargaMasiva, setShowCargaMasiva] = useState(false)
  const [search,          setSearch]          = useState('')
  const [deleteTarget,    setDeleteTarget]    = useState(null)

  const { widths: pjudW, getResizerProps: pjudResizer } = useResizableColumns('cols-pjud', [90, 80, 110, 250, 250, 90, 110, 150, 45])
  const pjudMinWidth = pjudW.reduce((s, w) => s + w, 0)

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('pjud').delete().eq('id', deleteTarget.id)
    onDelete && onDelete(deleteTarget.id)
    setDeleteTarget(null)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return movimientos
    const q = search.toLowerCase()
    return movimientos.filter(m =>
      (m.folio || '').toLowerCase().includes(q) ||
      (m.solicitud || '').toLowerCase().includes(q) ||
      (m.respuesta || '').toLowerCase().includes(q)
    )
  }, [movimientos, search])

  const counts = {
    total:       movimientos.length,
    pendientes:  movimientos.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length,
    respondidas: movimientos.filter(m => m.estado === 'Respondido').length,
    urgentes:    movimientos.filter(m => m.estado === 'Urgente').length,
  }

  const toggleRow  = id => { if (editingId === id) return; setExpandedId(p => p === id ? null : id) }
  const startEdit  = (r, e) => { e.stopPropagation(); setEditingId(r.id); setEditDraft({ ...r }); setExpandedId(null) }
  const cancelEdit = e => { e.stopPropagation(); setEditingId(null) }
  const saveEdit   = async e => {
    e.stopPropagation()
    await onUpdate(editingId, editDraft)
    setEditingId(null)
  }
  const ed = (k, v) => setEditDraft(p => ({ ...p, [k]: v }))

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      {embedded ? (
        <div className="px-6 py-3.5 border-b border-gray-50 flex items-center justify-between flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="font-semibold text-gray-800 tabular-nums">{counts.total} mov.</span>
            {counts.respondidas > 0 && <span className="text-green-700">{counts.respondidas} resp.</span>}
            {counts.pendientes  > 0 && <span className="text-amber-700">{counts.pendientes} pend.</span>}
            {counts.urgentes    > 0 && <span className="text-red-700 font-bold flex items-center gap-1"><AlertCircle size={10}/>{counts.urgentes} urg.</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                className="pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg w-32 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11}/></button>}
            </div>
            <button onClick={() => setShowCargaMasiva(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <Table2 size={13}/> Carga masiva
            </button>
            <button onClick={() => setShowForm(true)} data-cmd-n
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
              <Plus size={13}/> Nueva entrada
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3">
            <button onClick={() => onBack('clientes')} className="hover:text-[#1a2e4a] font-medium transition-colors">Clientes</button>
            <ChevronRight size={10} className="text-gray-300"/>
            <button onClick={() => onBack('causas')} className="hover:text-[#1a2e4a] font-medium transition-colors truncate max-w-[160px]">{clienteNombre}</button>
            <ChevronRight size={10} className="text-gray-300"/>
            <CausaIdentChip causa_rit={causa_rit} causa_ruc={causa_ruc} size="sm"/>
          </nav>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => onBack('causas')}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#1a2e4a] transition-colors">
                <ArrowLeft size={13}/> Volver
              </button>
              <div className="w-px h-4 bg-gray-200"/>
              <div>
                <div className="flex items-center gap-2">
                  <CausaIdentChip causa_rit={causa_rit} causa_ruc={causa_ruc}/>
                </div>
                {causaInfo?.materia && <p className="text-[11px] text-gray-400 mt-0.5">{causaInfo.materia}</p>}
              </div>
              {causaInfo?.tribunal && <span className="text-[11px] text-gray-400 hidden sm:block">· {causaInfo.tribunal}</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="font-semibold text-gray-800 tabular-nums">{counts.total} mov.</span>
                {counts.respondidas > 0 && <span className="text-green-700">{counts.respondidas} resp.</span>}
                {counts.pendientes  > 0 && <span className="text-amber-700">{counts.pendientes} pend.</span>}
                {counts.urgentes    > 0 && <span className="text-red-700 font-bold flex items-center gap-1"><AlertCircle size={10}/>{counts.urgentes} urg.</span>}
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                  className="pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg w-36 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"/>
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11}/></button>}
              </div>
              <button onClick={() => setShowCargaMasiva(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <Table2 size={13}/> Carga masiva
              </button>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
                <Plus size={13}/> Nueva entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <Scale size={32} className="text-gray-200 mb-3"/>
            <p className="text-sm text-gray-400 font-medium">
              {search ? `Sin resultados para "${search}"` : 'Sin movimientos en esta causa'}
            </p>
            {!search && (
              <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-[#2570ba] hover:underline font-medium">
                + Agregar primer movimiento
              </button>
            )}
          </div>
        ) : (
          <table className="text-left border-collapse" style={{ minWidth: pjudMinWidth }}>
            <colgroup>
              <col style={{ width: pjudW[0] }} />
              <col style={{ width: pjudW[1] }} />
              <col style={{ width: pjudW[2] }} />
              <col style={{ width: pjudW[3] }} />
              <col style={{ width: pjudW[4] }} />
              <col style={{ width: pjudW[5] }} />
              <col style={{ width: pjudW[6] }} />
              <col style={{ width: pjudW[7] }} />
              <col style={{ width: pjudW[8] }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_1px_0_#f3f4f6]">
              <tr>
                {['Fecha','Folio','Tipo solicitud','Solicitud','Respuesta','F. Respuesta','Documentos','Notas'].map((col, i) => (
                  <th key={col} className="px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap first:pl-6 relative select-none">
                    {col}
                    <div {...pjudResizer(i)} className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center z-10" onClick={e=>e.stopPropagation()}>
                      <div className="w-px h-4 bg-[#2570ba]/30 opacity-0 hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 last:pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const isExpanded = expandedId === r.id
                const isEditing  = editingId  === r.id
                const altRow     = idx % 2 === 1

                return (
                  <>
                    <tr key={r.id}
                      onClick={() => !isEditing && toggleRow(r.id)}
                      className={`border-b border-gray-50 transition-colors group ${
                        r.estado === 'Urgente' ? 'border-l-2 border-l-red-400' : ''
                      } ${
                        isEditing  ? 'bg-blue-50/20' :
                        isExpanded ? 'bg-[#1a2e4a]/[0.03]' :
                        altRow     ? 'bg-gray-50/60 hover:bg-gray-100/60' :
                        'bg-white hover:bg-gray-50'
                      } ${!isEditing ? 'cursor-pointer' : ''}`}>

                      {isEditing ? (
                        <>
                          <td className="px-3 py-2 first:pl-6">
                            <input type="date" value={editDraft.fecha||''} onChange={e=>ed('fecha',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editDraft.folio||''} onChange={e=>ed('folio',e.target.value)}
                              onClick={e=>e.stopPropagation()} placeholder="folio"
                              className="text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <select value={editDraft.tipo_solicitud||'Otro'} onChange={e=>ed('tipo_solicitud',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-300 bg-white">
                              {TIPOS_SOLICITUD.map(t=><option key={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={editDraft.solicitud||''} onChange={e=>ed('solicitud',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[140px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={editDraft.respuesta||''} onChange={e=>ed('respuesta',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[140px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" value={editDraft.fecha_respuesta||''} onChange={e=>ed('fecha_respuesta',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editDraft.documento_desc||''} onChange={e=>ed('documento_desc',e.target.value)}
                              onClick={e=>e.stopPropagation()} placeholder="doc..."
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editDraft.notas||''} onChange={e=>ed('notas',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:border-blue-300 bg-white min-w-[100px]"/>
                          </td>
                          <td className="px-3 py-2 pr-4">
                            <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                              <button onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={11}/></button>
                              <button onClick={cancelEdit} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100"><X size={11}/></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 first:pl-6 whitespace-nowrap">
                            <span className="text-[11px] text-gray-500 font-mono">{fmtFecha(r.fecha)}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="space-y-1">
                              <span className="text-[11px] font-mono font-semibold text-gray-700 bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded block w-fit">{r.folio || '—'}</span>
                              {r.presenta && r.presenta !== 'Nosotros' && <PresentaBadge presenta={r.presenta} compact />}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <TipoSolicitudBadge tipo={r.tipo_solicitud}/>
                          </td>
                          <td className="px-3 py-3">
                            <p className={`text-xs text-gray-700 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {r.solicitud || '—'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <EstadoInline estado={r.estado} onChange={e => onUpdate(r.id, { estado: e })} />
                              {r.respuesta?.trim() && (
                                <p className={`text-[10px] text-gray-500 leading-snug ${isExpanded ? '' : 'line-clamp-2'}`}>
                                  {r.respuesta}
                                </p>
                              )}
                              {!r.respuesta && r.accion_requerida && (
                                <p className="text-[10px] text-amber-600 line-clamp-1 italic">{r.accion_requerida}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-[11px] text-gray-500 font-mono">{r.fecha_respuesta ? fmtFecha(r.fecha_respuesta) : '—'}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <DocChip tiene={r.tiene_documento} desc={r.documento_desc}/>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-[11px] text-gray-400 line-clamp-2">{r.notas || '—'}</p>
                          </td>
                          <td className="px-3 py-3 pr-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={e => startEdit(r, e)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                                <Edit2 size={11}/>
                              </button>
                              <button onClick={e => { e.stopPropagation(); setDeleteTarget({ id: r.id, name: `el folio ${r.folio || r.id}` }) }}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                                <Trash2 size={11}/>
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && !isEditing && (
                      <tr key={`${r.id}_exp`} className={altRow ? 'bg-gray-50/60' : 'bg-white'}>
                        <td colSpan={9} className="px-6 pb-5 pt-1">
                          <MovimientoDetail
                            mov={r}
                            causaRit={causa_rit}
                            clienteNombre={clienteNombre}
                            onUpdate={onUpdate}
                            addTarea={addTarea}
                            addPlazo={addPlazo}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <FormNuevaEntrada
          causa={causaInfo ? { ...causaInfo, causa_rit: causa_rit, causa_ruc: causa_ruc } : { rit: causa_rit, ruc: causa_ruc, causa_rit, causa_ruc, cliente_nombre: clienteNombre, id: null, cliente_id: null }}
          causasInfo={causasInfo}
          globalMode={false}
          onSave={mov => { onAdd(causa_rit, causa_ruc, clienteNombre, mov); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {showCargaMasiva && (
        <CargaMasivaModal
          modulo="pjud"
          causaObj={{
            rit:            causaInfo?.rit   || causa_rit,
            ruc:            causaInfo?.ruc   || null,
            cliente_nombre: clienteNombre,
            id:             causaInfo?.id    || null,
            cliente_id:     causaInfo?.cliente_id || null,
            materia:        causaInfo?.materia || '',
            tribunal:       causaInfo?.tribunal || '',
          }}
          onClose={() => setShowCargaMasiva(false)}
          onSuccess={rows => { rows.forEach(r => onAdd(causa_rit, clienteNombre, mapPjudRow(r))) }}
        />
      )}
    </div>
  )
}

// ── CausaCard ──────────────────────────────────────────────────────────────────
function CausaCard({ causaData, rowsAll, clienteNombre, onClick }) {
  const movs       = rowsAll.filter(r => matchCausa(r, causaData, clienteNombre))
  const pendientes = movs.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length
  const urgentes   = movs.filter(m => m.estado === 'Urgente').length

  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#1a2e4a]/5 transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-[#1a2e4a]/8 flex items-center justify-center flex-shrink-0">
        <Scale size={14} className="text-[#1a2e4a]/50"/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <CausaIdentChip causa_rit={causaData.causa_rit} causa_ruc={causaData.causa_ruc} size="sm"/>
          {urgentes > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
            </span>
          )}
        </div>
        {causaData.causaInfo?.materia && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{causaData.causaInfo.materia}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {urgentes   > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">{urgentes} urg.</span>}
        {pendientes > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{pendientes} pend.</span>}
        <span className="text-[10px] text-gray-400">{movs.length} mov.</span>
        <ChevronRight size={13} className="text-gray-300 group-hover:text-[#2570ba] transition-colors"/>
      </div>
    </button>
  )
}

// ── ClienteRow (accordion) ────────────────────────────────────────────────────
function ClienteRow({ clienteData, rowsAll, isExpanded, onToggle, onSelectCausa, hasActiveCausas }) {
  const { clienteNombre, causasData } = clienteData
  const allMovs    = rowsAll.filter(r => r.cliente_nombre === clienteNombre)
  const urgentes   = allMovs.filter(m => m.estado === 'Urgente').length
  const pendientes = allMovs.filter(m => m.estado === 'Pendiente' || m.estado === 'Resolución pendiente').length
  const ini        = clienteNombre.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

  return (
    <div className={`border border-gray-100 rounded-2xl overflow-hidden transition-shadow ${isExpanded ? 'shadow-sm' : ''}`}>
      <button onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
          isExpanded ? 'bg-[#1a2e4a]/[0.04]' : 'bg-white hover:bg-gray-50'
        }`}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold select-none"
          style={{ backgroundColor: hasActiveCausas ? '#2570BA' : '#9CA3AF' }}>
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-[13px] font-semibold truncate ${hasActiveCausas ? 'text-[#1a2e4a]' : 'text-gray-400'}`}>{clienteNombre}</p>
            {urgentes > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {causasData.length} causa{causasData.length !== 1 ? 's' : ''}
            {allMovs.length > 0 && <span className="ml-1.5">· {allMovs.length} movimiento{allMovs.length !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {urgentes   > 0 && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">{urgentes} urg.</span>}
          {pendientes > 0 && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{pendientes} pend.</span>}
          <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}/>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-white px-3 py-2 space-y-0.5">
          {causasData.map(cd => (
            <CausaCard key={cd.causa_key}
              causaData={cd} rowsAll={rowsAll} clienteNombre={clienteNombre}
              onClick={() => onSelectCausa(clienteNombre, cd)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main PJUD ──────────────────────────────────────────────────────────────────
export default function PJUD() {
  const navigate = useNavigate()
  const { activeCausa } = useNavigation()

  const [_ps] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ps.pjud') ?? 'null') ?? {} }
    catch { return {} }
  })

  const [rows,       setRows]       = useState([])
  const [causasInfo, setCausasInfo] = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [clienteHasActiveCausasMap, setClienteHasActiveCausasMap] = useState({})
  const [error,      setError]      = useState(null)

  // Navigation: 'clientes' | 'tabla'
  const [view,        setView]       = useState(_ps.view ?? 'clientes')
  const [selCliente,  setSelCliente] = useState(_ps.selCliente ?? null)   // string
  const [selCausaKey, setSelCausaKey] = useState(_ps.selCausaKey ?? null)  // UUID (causa.id)
  const [fromCausa,   setFromCausa]  = useState(false)  // vinimos desde CausaView

  // Accordion
  const [expandedSet, setExpanded] = useState(new Set())

  // Filters (client list)
  const [search, setSearch] = useState(_ps.search ?? '')

  // Modals
  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false)

  const fetchRows = useCallback(async () => {
    setCargando(true); setError(null)
    const { data, error: err } = await supabase.from('pjud').select('*').order('fecha', { ascending: false })
    if (err) setError(err.message)
    else setRows((data || []).map(mapPjudRow))
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id,rit,ruc,materia,tribunal,area,cliente_nombre,cliente_id,estado')
      .order('rit')
    setCausasInfo((data || []).filter(c => c.estado === 'Abierta' || c.estado === 'En tramitación'))
    // Mapa nombre→hasActiveCausas para color de avatar
    const map = {}
    ;(data || []).forEach(c => {
      if (!c.cliente_nombre) return
      if (!map[c.cliente_nombre]) map[c.cliente_nombre] = false
      if (c.estado === 'Abierta' || c.estado === 'Revisar') map[c.cliente_nombre] = true
    })
    setClienteHasActiveCausasMap(map)
  }, [])

  useEffect(() => { fetchRows(); fetchCausas() }, [fetchRows, fetchCausas])

  // Build client → causas tree (from causasInfo, like SIAU)
  const clienteGrupos = useMemo(() => {
    const clienteSet = new Set()
    causasInfo.forEach(c => { if (c.cliente_nombre) clienteSet.add(c.cliente_nombre) })

    return [...clienteSet].sort().map(clienteNombre => {
      const causasCliente = causasInfo.filter(c => c.cliente_nombre === clienteNombre)
      const causasData = causasCliente.map(ci => ({
        causa_rit: ci.rit || null,
        causa_ruc: ci.ruc || null,
        causa_key: ci.id,
        causaInfo: ci,
      })).sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))
      return { clienteNombre, causasData }
    })
  }, [causasInfo])

  // Filter by search
  const filteredGrupos = useMemo(() => {
    if (!search.trim()) return clienteGrupos
    const q = search.toLowerCase()
    return clienteGrupos.filter(cl =>
      cl.clienteNombre.toLowerCase().includes(q) ||
      cl.causasData.some(cd =>
        (cd.causa_rit || '').toLowerCase().includes(q) ||
        (cd.causa_ruc || '').toLowerCase().includes(q) ||
        (cd.causaInfo?.materia || '').toLowerCase().includes(q)
      )
    )
  }, [clienteGrupos, search])

  // A-Z grouping
  const byLetter = useMemo(() => {
    const map = {}
    filteredGrupos.forEach(cl => {
      const l = cl.clienteNombre.charAt(0).toUpperCase() || '#'
      if (!map[l]) map[l] = []
      map[l].push(cl)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredGrupos])

  // ── Auto-seleccionar causa al venir desde CausaView ──────────────────────
  useEffect(() => {
    if (!activeCausa?.id || !clienteGrupos.length) return
    if (selCausaKey === activeCausa.id) return // ya seleccionada
    const grupo = clienteGrupos.find(g => g.clienteNombre === activeCausa.cliente_nombre)
    const causaData = grupo?.causasData.find(c => c.causa_key === activeCausa.id)
    if (grupo && causaData) {
      setSelCliente(activeCausa.cliente_nombre)
      setSelCausaKey(activeCausa.id)
      setView('tabla')
      setFromCausa(true)
    }
  }, [clienteGrupos, activeCausa?.id])  // eslint-disable-line

  // Selected causa (derived)
  const selectedCausaData = useMemo(() => {
    if (!selCausaKey || !selCliente) return null
    const cl = clienteGrupos.find(g => g.clienteNombre === selCliente)
    return cl?.causasData.find(cd => cd.causa_key === selCausaKey) || null
  }, [clienteGrupos, selCausaKey, selCliente])

  // Stats
  const stats = useMemo(() => ({
    clientes:    clienteGrupos.length,
    total:       rows.length,
    pendientes:  rows.filter(r => r.estado === 'Pendiente' || r.estado === 'Resolución pendiente').length,
    urgentes:    rows.filter(r => r.estado === 'Urgente').length,
    conAccion:   rows.filter(r => r.accion_requerida?.trim()).length,
  }), [clienteGrupos, rows])

  // Handlers
  const handleUpdate = useCallback(async (movId, cambios) => {
    setRows(prev => prev.map(r => r.id === movId ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(Object.entries(cambios).filter(([k]) => PJUD_DB_FIELDS.has(k)))
    if (Object.keys(dbCambios).length === 0) return
    const { error: err } = await supabase.from('pjud').update(dbCambios).eq('id', movId)
    if (err) console.error('Error actualizando PJUD:', err.message)
  }, [])

  const handleAddMovimiento = useCallback(async (causaRit, causaRuc, clienteNombre, movData) => {
    const ci = causasInfo.find(c => c.rit === causaRit) || causasInfo.find(c => c.ruc === causaRuc)
    const payload = {
      fecha: movData.fecha, folio: movData.folio, presenta: movData.presenta || 'Nosotros',
      tipo_solicitud: movData.tipo_solicitud || 'Solicitud',
      solicitud: movData.solicitud || null, respuesta: movData.respuesta || null,
      fecha_respuesta: movData.fecha_respuesta || null, fecha_notificacion: movData.fecha_notificacion || null,
      accion_requerida: movData.accion_requerida || null, consecuencia_procesal: movData.consecuencia_procesal || null,
      estado: movData.respuesta?.trim() ? 'Respondido' : (movData.estado || 'Pendiente'),
      tiene_documento: movData.tiene_documento || false, documento_desc: movData.documento_desc || null,
      notas: movData.notas || null, responsable: movData.responsable || 'MT',
      causa_rit: causaRit || null,
      causa_ruc: causaRuc || null,
      cliente_nombre: clienteNombre || movData.cliente_nombre || (ci?.cliente_nombre || ''),
      causa_id: movData.causa_id || (ci?.id || null),
      cliente_id: movData.cliente_id || (ci?.cliente_id || null),
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

  const handleDeleteRow = useCallback((id) => {
    setRows(prev => prev.filter(r => r.id !== id))
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

  const toggleExpanded = nombre => setExpanded(prev => {
    const next = new Set(prev); next.has(nombre) ? next.delete(nombre) : next.add(nombre); return next
  })

  function handleSelectCausa(clienteNombre, causaData) {
    setSelCliente(clienteNombre)
    setSelCausaKey(causaData.causa_key)
    setView('tabla')
  }

  function handleBack(to) {
    setView('clientes')
    if (to === 'clientes') { setSelCliente(null); setSelCausaKey(null) }
  }

  // Keep state ref synced for the unmount closure
  const _stRef = useRef({})
  useEffect(() => {
    _stRef.current = { search, view, selCliente, selCausaKey }
  }, [search, view, selCliente, selCausaKey])

  // Save on unmount
  useEffect(() => () => {
    sessionStorage.setItem('ps.pjud', JSON.stringify(_stRef.current))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tabla view ──
  if (view === 'tabla' && selectedCausaData) {
    return (
      <div className="flex flex-col h-full">
        {/* Breadcrumb "← Volver a causa" cuando vinimos desde CausaView */}
        {fromCausa && activeCausa && (
          <div className="bg-white border-b border-gray-100 px-5 py-2 flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => navigate('/causas')}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-[#2570ba] transition-colors group"
            >
              <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Causa</span>
            </button>
            <span className="text-gray-200 text-[12px]">›</span>
            <span className="text-[12px] text-gray-500 truncate max-w-[280px]" title={activeCausa.materia}>
              {activeCausa.materia}
            </span>
            <span className="text-gray-200 mx-0.5">›</span>
            <span className="text-[12px] font-semibold text-[#1a2e4a]">PJUD</span>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <MovimientosTable
            causaData={{ ...selectedCausaData, clienteNombre: selCliente }}
            rowsAll={rows}
            onUpdate={handleUpdate}
            onAdd={handleAddMovimiento}
            onDelete={handleDeleteRow}
            causasInfo={causasInfo}
            addTarea={handleAddTarea}
            addPlazo={handleAddPlazo}
            onBack={handleBack}
          />
        </div>
      </div>
    )
  }

  // ── Client list view ──
  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-[#1a2e4a]">PJUD</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNuevaSolicitud(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-4 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
              <Plus size={14}/> Nueva entrada
            </button>
            <a href="https://oficinajudicialvirtual.pjud.cl/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              <Scale size={14}/> Portal PJUD
            </a>
          </div>
        </div>

        {/* Stats row */}
        {!cargando && (
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {[
              { label: 'Movimientos',        value: stats.total,       bg: 'bg-gray-50',    ic: 'text-gray-500',  Icon: FileText      },
              { label: 'Pendientes',          value: stats.pendientes,  bg: 'bg-amber-50',   ic: 'text-amber-500', Icon: Clock         },
              { label: 'Con acción requerida',value: stats.conAccion,   bg: 'bg-red-50',     ic: 'text-red-500',   Icon: Bell          },
              { label: 'Urgentes',            value: stats.urgentes,    bg: 'bg-orange-50',  ic: 'text-orange-500',Icon: AlertCircle   },
            ].map(({ label, value, bg, ic, Icon }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={14} className={ic} />
                </div>
                <div>
                  <p className="text-[22px] font-bold text-gray-900 leading-none tabular-nums">{value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, RIT, materia…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300 bg-white"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12}/>
            </button>
          )}
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

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300"/>
          </div>
        ) : byLetter.length === 0 ? (
          <div className="text-center py-20">
            <Scale size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-200"/>
            <p className="text-sm text-gray-400">{search ? `Sin resultados para "${search}"` : 'Sin clientes con causas activas'}</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {byLetter.map(([letra, grupos]) => (
              <div key={letra}>
                <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-2.5 px-1">{letra}</p>
                <div className="space-y-2">
                  {grupos.map(cl => (
                    <ClienteRow key={cl.clienteNombre}
                      clienteData={cl}
                      rowsAll={rows}
                      isExpanded={expandedSet.has(cl.clienteNombre)}
                      onToggle={() => toggleExpanded(cl.clienteNombre)}
                      onSelectCausa={handleSelectCausa}
                      hasActiveCausas={clienteHasActiveCausasMap[cl.clienteNombre] ?? true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Nueva Entrada Modal */}
      {showNuevaSolicitud && (
        <FormNuevaEntrada
          globalMode
          causasInfo={causasInfo}
          onSave={async movData => {
            await handleAddMovimiento(movData.causa_rit, movData.cliente_nombre, movData)
            setShowNuevaSolicitud(false)
          }}
          onClose={() => setShowNuevaSolicitud(false)}
        />
      )}

    </div>
  )
}
