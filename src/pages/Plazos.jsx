import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, Clock, Check, X, Plus, Search,
  ChevronRight, FileText, Scale,
  AlertTriangle, CheckCircle2, Edit2, Bell,
  Gavel, ExternalLink, ArrowRight, Loader2, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

// ── Today ──────────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

// ── Tipo config ────────────────────────────────────────────────────────────────
const TIPO_CONFIG = {
  Procesal:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  SIAU:           { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200'  },
  PJUD:           { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  Contractual:    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Administrativo: { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200'   },
  Interno:        { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200'    },
}

// ── Urgencia config ────────────────────────────────────────────────────────────
const URGENCIA_CONFIG = {
  critico:    { label: 'Crítico',    textColor: 'text-red-600',   bgColor: 'bg-red-50',    borderColor: 'border-red-200',   dotColor: 'bg-red-500',   leftColor: '#ef4444' },
  urgente:    { label: 'Urgente',    textColor: 'text-amber-600', bgColor: 'bg-amber-50',  borderColor: 'border-amber-200', dotColor: 'bg-amber-500', leftColor: '#f59e0b' },
  proximo:    { label: 'Próximo',    textColor: 'text-blue-600',  bgColor: 'bg-blue-50',   borderColor: 'border-blue-200',  dotColor: 'bg-blue-500',  leftColor: '#3b82f6' },
  normal:     { label: 'Normal',     textColor: 'text-green-600', bgColor: 'bg-green-50',  borderColor: 'border-green-200', dotColor: 'bg-green-500', leftColor: '#10b981' },
  vencido:    { label: 'Vencido',    textColor: 'text-red-800',   bgColor: 'bg-red-100',   borderColor: 'border-red-300',   dotColor: 'bg-red-700',   leftColor: '#b91c1c' },
  completado: { label: 'Completado', textColor: 'text-gray-500',  bgColor: 'bg-gray-100',  borderColor: 'border-gray-200',  dotColor: 'bg-gray-400',  leftColor: '#d1d5db' },
  cancelado:  { label: 'Cancelado',  textColor: 'text-gray-400',  bgColor: 'bg-gray-50',   borderColor: 'border-gray-200',  dotColor: 'bg-gray-300',  leftColor: '#e5e7eb' },
}

// ── Hito icons ─────────────────────────────────────────────────────────────────
const HITO_TIPO_CONFIG = {
  notificacion: { icon: Bell,        color: 'text-blue-500',   bg: 'bg-blue-50'    },
  resolucion:   { icon: Scale,       color: 'text-amber-600',  bg: 'bg-amber-50'   },
  escrito:      { icon: FileText,    color: 'text-indigo-500', bg: 'bg-indigo-50'  },
  audiencia:    { icon: Gavel,       color: 'text-violet-500', bg: 'bg-violet-50'  },
  tarea:        { icon: CheckCircle2,color: 'text-green-500',  bg: 'bg-green-50'   },
  vencimiento:  { icon: AlertCircle, color: 'text-red-500',    bg: 'bg-red-50'     },
  creacion:     { icon: Plus,        color: 'text-gray-400',   bg: 'bg-gray-100'   },
}

const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Andrea B.',   color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

// Campos que existen en la BD
const DB_FIELDS = new Set(['estado','notas','tipo','causa_rit','causa_id','cliente_id','titulo','fecha_vencimiento'])

function mapRow(row) {
  return {
    id:               row.id,
    created_at:       row.created_at,
    titulo:           row.titulo            || '',
    estado:           row.estado            || 'Activo',
    tipo:             row.tipo              || 'Interno',
    fecha_vencimiento:row.fecha_vencimiento || '',
    notas:            row.notas             || '',
    causa_rit:        row.causa_rit         || '',
    causa_id:         row.causa_id          || null,
    cliente_id:       row.cliente_id        || null,
    // Derivado del join con causas
    cliente_nombre:   row.causas?.cliente_nombre || '',
    // UI-only (no están en BD)
    causa_ruc:   '',
    responsable: 'MT',
    hitos:       [],
    actividad:   [],
  }
}

function mapToDb(form) {
  return {
    titulo:           form.titulo            || null,
    estado:           form.estado            || 'Activo',
    tipo:             form.tipo              || 'Interno',
    fecha_vencimiento:form.fecha_vencimiento || null,
    notas:            form.notas             || null,
    causa_rit:        form.causa_rit         || null,
    causa_id:         form.causa_id          || null,
    cliente_id:       form.cliente_id        || null,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcDias(fecha_vencimiento) {
  const today  = new Date(TODAY + 'T00:00:00')
  const target = new Date(fecha_vencimiento + 'T00:00:00')
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

function getUrgencia(plazo) {
  if (plazo.estado === 'Completado') return 'completado'
  if (plazo.estado === 'Cancelado')  return 'cancelado'
  const dias = calcDias(plazo.fecha_vencimiento)
  if (dias < 0)   return 'vencido'
  if (dias <= 1)  return 'critico'
  if (dias <= 4)  return 'urgente'
  if (dias <= 14) return 'proximo'
  return 'normal'
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${meses[m - 1]} ${y}`
}

// ── DaysCounter ────────────────────────────────────────────────────────────────
function DaysCounter({ plazo, large = false }) {
  if (plazo.estado === 'Completado') {
    return (
      <span className={`flex items-center gap-1 text-gray-400 ${large ? 'text-[13px]' : 'text-[11px]'}`}>
        <CheckCircle2 size={large ? 13 : 11} />
        Completado
      </span>
    )
  }
  if (plazo.estado === 'Cancelado') {
    return <span className={`text-gray-400 ${large ? 'text-[13px]' : 'text-[11px]'}`}>Cancelado</span>
  }

  const dias = calcDias(plazo.fecha_vencimiento)

  if (dias === 0) return (
    <span className={`font-bold text-red-600 ${large ? 'text-[14px]' : 'text-[11px]'} animate-pulse`}>
      Vence HOY
    </span>
  )
  if (dias < 0) return (
    <span className={`font-semibold text-red-800 ${large ? 'text-[13px]' : 'text-[11px]'}`}>
      Venció hace {Math.abs(dias)} {Math.abs(dias) === 1 ? 'día' : 'días'}
    </span>
  )
  if (dias === 1) return (
    <span className={`font-bold text-amber-600 ${large ? 'text-[14px]' : 'text-[11px]'}`}>
      Vence mañana
    </span>
  )
  if (dias <= 4) return (
    <span className={`font-semibold text-amber-600 ${large ? 'text-[13px]' : 'text-[11px]'}`}>
      {dias} días
    </span>
  )
  if (dias <= 14) return (
    <span className={`font-medium text-blue-600 ${large ? 'text-[13px]' : 'text-[11px]'}`}>
      {dias} días
    </span>
  )
  return (
    <span className={`text-green-600 ${large ? 'text-[13px]' : 'text-[11px]'}`}>
      {dias} días
    </span>
  )
}

// ── TipoBadge ──────────────────────────────────────────────────────────────────
function TipoBadge({ tipo, size = 'sm' }) {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.Interno
  const cls = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5 rounded'
    : 'text-[11px] px-2 py-0.5 rounded-md'
  return (
    <span className={`inline-flex items-center font-medium ${cfg.bg} ${cfg.text} ${cls}`}>
      {tipo}
    </span>
  )
}

// ── UrgenciaDot ────────────────────────────────────────────────────────────────
function UrgenciaDot({ urgencia }) {
  const cfg = URGENCIA_CONFIG[urgencia] || URGENCIA_CONFIG.normal
  const pulse = urgencia === 'critico' || urgencia === 'vencido'
  return (
    <span className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dotColor} opacity-40 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full w-2 h-2 ${cfg.dotColor}`} />
    </span>
  )
}

// ── AlertBanner ────────────────────────────────────────────────────────────────
function AlertBanner({ plazos, onDismiss }) {
  const criticos  = plazos.filter(p => getUrgencia(p) === 'critico')
  const vencidos  = plazos.filter(p => getUrgencia(p) === 'vencido')
  const total     = criticos.length + vencidos.length
  if (!total) return null

  return (
    <div className="mx-6 mt-5 mb-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-red-700 leading-none mb-1">
          {total} {total === 1 ? 'plazo requiere' : 'plazos requieren'} atención inmediata
        </p>
        <p className="text-[11px] text-red-500 leading-relaxed">
          {vencidos.length > 0 && `${vencidos.length} vencido${vencidos.length > 1 ? 's' : ''}`}
          {vencidos.length > 0 && criticos.length > 0 && ' · '}
          {criticos.length > 0 && `${criticos.length} vence${criticos.length > 1 ? 'n' : ''} hoy o mañana`}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-0.5 rounded text-red-300 hover:text-red-500 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── MetricCard ─────────────────────────────────────────────────────────────────
function MetricCard({ label, value, sublabel, iconBg, iconColor, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3.5 flex items-center gap-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[24px] font-bold text-gray-900 leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-tight truncate">{label}</p>
        {sublabel && <p className="text-[10px] text-gray-300 leading-tight truncate">{sublabel}</p>}
      </div>
    </div>
  )
}

// ── GroupHeader ────────────────────────────────────────────────────────────────
function GroupHeader({ groupKey, label, count, expanded, onToggle, isUrgencia }) {
  const cfg = isUrgencia ? (URGENCIA_CONFIG[groupKey] || {}) : {}
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50/80 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
    >
      <ChevronRight
        size={12}
        className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      />
      {isUrgencia && <UrgenciaDot urgencia={groupKey} />}
      <span className={`text-[11px] font-semibold ${isUrgencia && cfg.textColor ? cfg.textColor : 'text-gray-600'}`}>
        {label}
      </span>
      <span className="text-[10px] text-gray-400 font-normal">
        {count} {count === 1 ? 'plazo' : 'plazos'}
      </span>
    </button>
  )
}

// ── PlazosRow ──────────────────────────────────────────────────────────────────
function PlazosRow({ plazo, selected, onClick, onDeleteRequest }) {
  const urgencia = getUrgencia(plazo)
  const cfg      = URGENCIA_CONFIG[urgencia]
  const resp     = RESPONSABLE_INFO[plazo.responsable]

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors duration-100 relative ${
        selected ? 'bg-[#1a2e4a]/5' : 'hover:bg-gray-50/80'
      }`}
      style={{ borderLeft: `3px solid ${cfg.leftColor}` }}
    >
      <UrgenciaDot urgencia={urgencia} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <TipoBadge tipo={plazo.tipo} size="xs" />
          <span className="text-[10px] text-gray-400 truncate">{plazo.causa_rit}</span>
        </div>
        <p className={`text-[13px] font-medium leading-tight truncate ${
          urgencia === 'completado' || urgencia === 'cancelado'
            ? 'text-gray-400 line-through'
            : 'text-gray-800'
        }`}>
          {plazo.titulo}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{plazo.cliente_nombre}</p>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        <DaysCounter plazo={plazo} />
        <div className="flex items-center gap-1">
          <div
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[9px] font-bold"
            style={{ backgroundColor: resp?.color || '#94a3b8' }}
          >
            {plazo.responsable}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDeleteRequest && onDeleteRequest(plazo) }}
            className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Eliminar plazo">
            <Trash2 size={11}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PanelPlazo ─────────────────────────────────────────────────────────────────
function PanelPlazo({ plazo, onClose, onUpdate, tareas }) {
  const navigate = useNavigate()
  const [editing,             setEditing]             = useState(false)
  const [draft,               setDraft]               = useState({ ...plazo })
  const [showConfirmComplete, setShowConfirmComplete] = useState(false)

  const urgencia = getUrgencia(plazo)
  const cfg      = URGENCIA_CONFIG[urgencia]
  const resp     = RESPONSABLE_INFO[plazo.responsable]

  const tareasVinculadas   = useMemo(() => tareas.filter(t => t.causa_rit === plazo.causa_rit), [tareas, plazo.causa_rit])
  const tareasCompletadas  = tareasVinculadas.filter(t => t.estado === 'Completada').length
  const pct                = tareasVinculadas.length > 0 ? Math.round((tareasCompletadas / tareasVinculadas.length) * 100) : null
  const hayPendientes      = tareasVinculadas.filter(t => t.estado !== 'Completada').length > 0

  const handleSave = () => {
    onUpdate(plazo.id, draft)
    setEditing(false)
  }

  const handleMarkComplete = () => {
    onUpdate(plazo.id, { estado: 'Completado' })
    setShowConfirmComplete(false)
  }

  // Reset draft when plazo changes
  useMemo(() => { setDraft({ ...plazo }); setEditing(false) }, [plazo.id]) // eslint-disable-line

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3.5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <TipoBadge tipo={plazo.tipo} />
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.textColor}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {urgencia !== 'completado' && urgencia !== 'cancelado' && (
              <button
                onClick={() => setShowConfirmComplete(true)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#2570BA] text-white hover:bg-[#2570BA]/90 transition-colors flex items-center gap-1.5"
              >
                <Check size={11} />
                Completar
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <h2 className="text-[15px] font-semibold text-gray-900 leading-snug mb-2">
          {plazo.titulo}
        </h2>

        <div className="flex items-center gap-2.5 flex-wrap">
          <DaysCounter plazo={plazo} large />
          {plazo.estado === 'Activo' && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-[12px] text-gray-500">Vence {fmtFecha(plazo.fecha_vencimiento)}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Confirm complete ── */}
      {showConfirmComplete && (
        <div className="flex-shrink-0 mx-5 my-3 p-3.5 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-[12px] font-semibold text-green-800 mb-2.5">¿Marcar como completado?</p>
          <div className="flex gap-2">
            <button
              onClick={handleMarkComplete}
              className="text-[11px] px-3.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
            >
              <Check size={11} />
              Confirmar
            </button>
            <button
              onClick={() => setShowConfirmComplete(false)}
              className="text-[11px] px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Info */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Información</p>
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              className="text-[11px] text-[#1a2e4a] hover:text-[#243d5e] flex items-center gap-1.5 transition-colors"
            >
              {editing
                ? <><Check size={11} /> Guardar</>
                : <><Edit2 size={11} /> Editar</>
              }
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-400 mb-1">Cliente</p>
              <p className="text-[13px] text-gray-800">{plazo.cliente_nombre || '—'}</p>
            </div>

            <div>
              <p className="text-[10px] text-gray-400 mb-1">Causa</p>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-gray-800">{plazo.causa_rit || '—'}</p>
                </div>
                <button
                  onClick={() => navigate('/causas')}
                  className="flex-shrink-0 flex items-center gap-1 text-[11px] text-[#2570ba] hover:text-[#1a2e4a] transition-colors"
                >
                  Ver causa
                  <ArrowRight size={10} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Tipo</p>
                {editing ? (
                  <select
                    value={draft.tipo}
                    onChange={e => setDraft(d => ({ ...d, tipo: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                  >
                    {Object.keys(TIPO_CONFIG).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <TipoBadge tipo={plazo.tipo} size="xs" />
                )}
              </div>

              <div>
                <p className="text-[10px] text-gray-400 mb-1">Responsable</p>
                {editing ? (
                  <select
                    value={draft.responsable}
                    onChange={e => setDraft(d => ({ ...d, responsable: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                  >
                    {Object.keys(RESPONSABLE_INFO).map(r => (
                      <option key={r} value={r}>{r} – {RESPONSABLE_INFO[r].nombre}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                      style={{ backgroundColor: resp?.color || '#94a3b8' }}
                    >
                      {plazo.responsable}
                    </div>
                    <span className="text-[12px] text-gray-700">{resp?.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-gray-400 mb-1">Fecha vencimiento</p>
              {editing ? (
                <input
                  type="date"
                  value={draft.fecha_vencimiento}
                  onChange={e => setDraft(d => ({ ...d, fecha_vencimiento: e.target.value }))}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                />
              ) : (
                <p className="text-[13px] text-gray-800">{fmtFecha(plazo.fecha_vencimiento)}</p>
              )}
            </div>

            <div>
              <p className="text-[10px] text-gray-400 mb-1">Notas</p>
              {editing ? (
                <textarea
                  value={draft.notas}
                  onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))}
                  rows={3}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400"
                />
              ) : (
                <p className="text-[12px] text-gray-600 leading-relaxed">{plazo.notas || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tareas vinculadas */}
        {tareasVinculadas.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Tareas vinculadas
              </p>
              {pct !== null && (
                <span className={`text-[11px] font-semibold ${
                  pct === 100 ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {pct}%
                </span>
              )}
            </div>

            {pct !== null && (
              <div className="w-full bg-gray-100 rounded-full h-1 mb-3">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${
                    pct === 100
                      ? 'bg-green-500'
                      : urgencia === 'critico' || urgencia === 'vencido'
                        ? 'bg-red-400'
                        : 'bg-[#2570BA]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {(urgencia === 'critico' || urgencia === 'vencido') && hayPendientes && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg mb-3">
                <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                <p className="text-[11px] text-red-600">
                  {tareasVinculadas.filter(t => t.estado !== 'Completada').length} tareas pendientes en plazo crítico
                </p>
              </div>
            )}

            <div className="space-y-1">
              {tareasVinculadas.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                    t.estado === 'Completada'
                      ? 'bg-[#2570BA] border-[#2570BA]'
                      : 'border-gray-300'
                  }`}>
                    {t.estado === 'Completada' && <Check size={8} className="text-white" />}
                  </div>
                  <span className={`text-[12px] flex-1 truncate ${
                    t.estado === 'Completada' ? 'line-through text-gray-400' : 'text-gray-700'
                  }`}>
                    {t.titulo}
                  </span>
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                    style={{ backgroundColor: RESPONSABLE_INFO[t.responsable]?.color || '#94a3b8' }}
                  >
                    {t.responsable}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline / Hitos */}
        {plazo.hitos && plazo.hitos.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Contexto procesal
            </p>
            <div className="relative pl-8">
              <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-100" />
              <div className="space-y-4">
                {plazo.hitos.map((h, i) => {
                  const htCfg  = HITO_TIPO_CONFIG[h.tipo] || HITO_TIPO_CONFIG.creacion
                  const HIcon  = htCfg.icon
                  const isLast = i === plazo.hitos.length - 1 && h.tipo === 'vencimiento'
                  return (
                    <div key={i} className="relative flex gap-3">
                      <div
                        className={`absolute -left-8 w-6 h-6 rounded-full ${htCfg.bg} flex items-center justify-center z-10 ${
                          isLast ? 'ring-2 ring-red-200' : ''
                        }`}
                      >
                        <HIcon size={11} className={htCfg.color} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className={`text-[12px] font-medium leading-tight ${
                          isLast ? 'text-red-700' : 'text-gray-800'
                        }`}>
                          {h.titulo}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{fmtFecha(h.fecha)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Actividad */}
        {plazo.actividad && plazo.actividad.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Actividad
            </p>
            <div className="space-y-3">
              {[...plazo.actividad].reverse().map(a => (
                <div key={a.id} className="flex gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    style={{ backgroundColor: RESPONSABLE_INFO[a.autor]?.color || '#94a3b8' }}
                  >
                    {a.autor}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-gray-700 leading-tight">{a.desc}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtFecha(a.fecha)} · {a.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── FormNuevoPlazo ─────────────────────────────────────────────────────────────
function FormNuevoPlazo({ onSave, onClose, allCausas = [] }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titulo:            '',
    cliente_nombre:    '',
    causa_rit:         '',
    causa_id:          null,
    cliente_id:        null,
    tipo:              'Procesal',
    fecha_vencimiento: '',
    responsable:       'MT',
    notas:             '',
    estado:            'Activo',
  })

  // Causas del cliente seleccionado
  const causasCliente = form.cliente_nombre
    ? allCausas.filter(c => c.cliente_nombre === form.cliente_nombre)
    : []

  // Lista de clientes únicos
  const clientesLista = [...new Set(allCausas.map(c => c.cliente_nombre).filter(Boolean))].sort()

  const handleChange = (k, v) => {
    if (k === 'cliente_nombre') {
      const causas = allCausas.filter(c => c.cliente_nombre === v)
      setForm(f => ({
        ...f,
        cliente_nombre: v,
        causa_rit: causas[0]?.rit  || '',
        causa_id:  causas[0]?.id   || null,
        cliente_id:causas[0]?.cliente_id || null,
      }))
    } else if (k === 'causa_rit') {
      const causa = allCausas.find(c => c.rit === v)
      setForm(f => ({
        ...f,
        causa_rit:  v,
        causa_id:   causa?.id         || null,
        cliente_id: causa?.cliente_id || null,
      }))
    } else {
      setForm(f => ({ ...f, [k]: v }))
    }
  }

  const valid = form.titulo.trim() && form.causa_rit && form.fecha_vencimiento

  const handleSubmit = async () => {
    if (!valid) return
    setSaving(true)
    onSave(form)
  }

  // Cmd+Enter submits this form
  const saveRef = useRef(null)
  saveRef.current = handleSubmit
  useEffect(() => {
    const fn = () => saveRef.current?.()
    window.addEventListener('global:save', fn)
    return () => window.removeEventListener('global:save', fn)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-[15px] font-semibold text-gray-900">Nuevo plazo</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Título del plazo *</label>
            <input
              type="text"
              value={form.titulo}
              onChange={e => handleChange('titulo', e.target.value)}
              placeholder="Ej: Contestar demanda de alimentos"
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Cliente</label>
              <select
                value={form.cliente_nombre}
                onChange={e => handleChange('cliente_nombre', e.target.value)}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="">Seleccionar...</option>
                {clientesLista.map(c => (
                  <option key={c} value={c}>{c.split(' ').slice(0, 2).join(' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Causa RIT *</label>
              {causasCliente.length > 0 ? (
                <select
                  value={form.causa_rit}
                  onChange={e => handleChange('causa_rit', e.target.value)}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">Seleccionar...</option>
                  {causasCliente.map(c => <option key={c.id} value={c.rit}>{c.rit}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.causa_rit}
                  onChange={e => handleChange('causa_rit', e.target.value)}
                  placeholder="Ej: F-1234-2025"
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => handleChange('tipo', e.target.value)}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white"
              >
                {Object.keys(TIPO_CONFIG).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Responsable</label>
              <select
                value={form.responsable}
                onChange={e => handleChange('responsable', e.target.value)}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white"
              >
                {Object.keys(RESPONSABLE_INFO).map(r => (
                  <option key={r} value={r}>{r} – {RESPONSABLE_INFO[r].nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fecha vencimiento *</label>
            <input
              type="date"
              value={form.fecha_vencimiento}
              onChange={e => handleChange('fecha_vencimiento', e.target.value)}
              min={TODAY}
              className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => handleChange('notas', e.target.value)}
              rows={3}
              placeholder="Instrucciones, fundamentos legales, antecedentes relevantes..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="text-[13px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || saving}
            className={`text-[13px] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              valid && !saving
                ? 'bg-[#2570BA] text-white hover:bg-[#2570BA]/90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Crear plazo
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main: Plazos ───────────────────────────────────────────────────────────────
export default function Plazos() {
  const [_ps] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ps.plazos') ?? 'null') ?? {} }
    catch { return {} }
  })

  const [plazos,          setPlazos]          = useState([])
  const [allCausas,       setAllCausas]       = useState([])
  const [tareas,          setTareas]          = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [error,           setError]           = useState(null)
  const [search,          setSearch]          = useState(_ps.search ?? '')
  const [filterTipo,      setFilterTipo]      = useState(_ps.filterTipo ?? 'Todos')
  const [filterResp,      setFilterResp]      = useState(_ps.filterResp ?? 'Todas')
  const [filterEstado,    setFilterEstado]    = useState(_ps.filterEstado ?? 'Activos')
  const [groupBy,         setGroupBy]         = useState(_ps.groupBy ?? 'urgencia')
  const [selectedId,      setSelectedId]      = useState(null)
  const [showForm,        setShowForm]        = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)
  const [collapsed,       setCollapsed]       = useState({})
  const [deleteTarget,    setDeleteTarget]    = useState(null)

  // ── Fetch plazos ──
  const fetchPlazos = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('plazos')
      .select('*, causas(cliente_nombre)')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    if (err) {
      setError(err.message)
    } else {
      setPlazos((data || []).map(mapRow))
    }
    setCargando(false)
  }, [])

  // ── Fetch causas para el formulario ──
  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id, rit, cliente_nombre, cliente_id')
      .order('rit')
    setAllCausas(data || [])
  }, [])

  // ── Fetch tareas para el panel ──
  const fetchTareas = useCallback(async () => {
    const { data } = await supabase
      .from('tareas')
      .select('id, titulo, estado, causa_rit, responsable')
    setTareas((data || []).map(t => ({
      ...t,
      titulo:      t.titulo      || '',
      estado:      t.estado      || 'Pendiente',
      causa_rit:   t.causa_rit   || '',
      responsable: t.responsable || 'MT',
    })))
  }, [])

  useEffect(() => {
    fetchPlazos()
    fetchCausas()
    fetchTareas()
  }, [fetchPlazos, fetchCausas, fetchTareas])

  // Esc closes open form or panel (form takes priority)
  useEffect(() => {
    const fn = () => {
      if (showForm) setShowForm(false)
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('modal:close', fn)
    return () => window.removeEventListener('modal:close', fn)
  }, [showForm, selectedId])

  // Keep state ref synced for the unmount closure
  const _stRef = useRef({})
  useEffect(() => {
    _stRef.current = { search, filterTipo, filterResp, filterEstado, groupBy }
  }, [search, filterTipo, filterResp, filterEstado, groupBy])

  // Save on unmount
  useEffect(() => () => {
    sessionStorage.setItem('ps.plazos', JSON.stringify(_stRef.current))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Metrics ──
  const metrics = useMemo(() => {
    const activos     = plazos.filter(p => p.estado === 'Activo')
    const hoy         = activos.filter(p => p.fecha_vencimiento && calcDias(p.fecha_vencimiento) === 0).length
    const semana      = activos.filter(p => { if (!p.fecha_vencimiento) return false; const d = calcDias(p.fecha_vencimiento); return d > 0 && d <= 7 }).length
    const vencidos    = activos.filter(p => p.fecha_vencimiento && calcDias(p.fecha_vencimiento) < 0).length
    const completados = plazos.filter(p => p.estado === 'Completado').length
    return { hoy, semana, vencidos, completados }
  }, [plazos])

  // ── Filtered ──
  const filtered = useMemo(() => {
    let r = plazos
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(p =>
        (p.titulo          || '').toLowerCase().includes(q) ||
        (p.cliente_nombre  || '').toLowerCase().includes(q) ||
        (p.causa_rit       || '').toLowerCase().includes(q)
      )
    }
    if (filterTipo !== 'Todos') r = r.filter(p => p.tipo === filterTipo)
    if (filterResp !== 'Todas') r = r.filter(p => p.responsable === filterResp)
    if (filterEstado === 'Activos')     r = r.filter(p => p.estado === 'Activo')
    if (filterEstado === 'Completados') r = r.filter(p => p.estado === 'Completado')
    if (filterEstado === 'Vencidos')    r = r.filter(p => p.estado === 'Activo' && p.fecha_vencimiento && calcDias(p.fecha_vencimiento) < 0)
    return r
  }, [plazos, search, filterTipo, filterResp, filterEstado])

  // ── Grouped ──
  const grouped = useMemo(() => {
    if (groupBy === 'urgencia') {
      const order = ['critico', 'vencido', 'urgente', 'proximo', 'normal', 'completado', 'cancelado']
      return order
        .map(u => ({ key: u, label: URGENCIA_CONFIG[u].label, items: filtered.filter(p => getUrgencia(p) === u) }))
        .filter(g => g.items.length > 0)
    }
    if (groupBy === 'tipo') {
      return Object.keys(TIPO_CONFIG)
        .map(t => ({ key: t, label: t, items: filtered.filter(p => p.tipo === t) }))
        .filter(g => g.items.length > 0)
    }
    if (groupBy === 'responsable') {
      return Object.keys(RESPONSABLE_INFO)
        .map(r => ({ key: r, label: RESPONSABLE_INFO[r].nombre, items: filtered.filter(p => p.responsable === r) }))
        .filter(g => g.items.length > 0)
    }
    if (groupBy === 'causa') {
      const causas = [...new Set(filtered.map(p => p.causa_rit))]
      return causas.map(c => ({ key: c, label: c, items: filtered.filter(p => p.causa_rit === c) }))
    }
    return [{ key: 'all', label: 'Todos', items: filtered }]
  }, [filtered, groupBy])

  const selectedPlazo = useMemo(() => plazos.find(p => p.id === selectedId) || null, [plazos, selectedId])

  // ── Update plazo ──
  const handleUpdate = useCallback(async (id, changes) => {
    setPlazos(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))

    const dbCambios = Object.fromEntries(
      Object.entries(changes).filter(([k]) => DB_FIELDS.has(k))
    )
    if (Object.keys(dbCambios).length === 0) return

    const { error: err } = await supabase
      .from('plazos')
      .update(dbCambios)
      .eq('id', id)
    if (err) console.error('Error actualizando plazo:', err.message)
  }, [])

  // ── Create plazo ──
  const handleSave = useCallback(async (form) => {
    const payload = mapToDb(form)
    const { data, error: err } = await supabase
      .from('plazos')
      .insert([payload])
      .select('*, causas(cliente_nombre)')
      .single()
    if (err) {
      alert('Error al guardar: ' + err.message)
    } else {
      const nuevoPlazo = mapRow(data)
      setPlazos(prev => [nuevoPlazo, ...prev])
      setSelectedId(nuevoPlazo.id)
      setShowForm(false)
    }
  }, [])

  const handleDeletePlazo = useCallback(async () => {
    if (!deleteTarget) return
    await supabase.from('plazos').delete().eq('id', deleteTarget.id)
    setPlazos(prev => prev.filter(p => p.id !== deleteTarget.id))
    if (selectedId === deleteTarget.id) setSelectedId(null)
    setDeleteTarget(null)
  }, [deleteTarget, selectedId])

  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Left: list ── */}
      <div className={`flex flex-col min-w-0 overflow-hidden transition-all duration-200 ${
        selectedPlazo ? 'flex-1' : 'flex-1'
      }`}>

        {/* Alert banner */}
        {!dismissedBanner && (
          <AlertBanner plazos={plazos} onDismiss={() => setDismissedBanner(true)} />
        )}

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">Plazos</h1>
              <p className="text-[12px] text-gray-400 mt-1">
                {cargando ? 'Cargando...' : (
                  <>
                    {plazos.filter(p => p.estado === 'Activo').length} activos
                    {metrics.vencidos > 0 && (
                      <span className="text-red-500 font-medium"> · {metrics.vencidos} vencidos</span>
                    )}
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#2570BA] text-white text-[13px] font-medium rounded-lg hover:bg-[#2570BA]/90 transition-colors"
            >
              <Plus size={14} />
              Nuevo plazo
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-shrink-0 px-6 pb-3 grid grid-cols-4 gap-2.5">
          <MetricCard
            label="Vencen hoy"
            value={metrics.hoy}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            icon={AlertCircle}
          />
          <MetricCard
            label="Esta semana"
            value={metrics.semana}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            icon={Clock}
          />
          <MetricCard
            label="Vencidos"
            sublabel="sin completar"
            value={metrics.vencidos}
            iconBg="bg-red-100"
            iconColor="text-red-700"
            icon={AlertTriangle}
          />
          <MetricCard
            label="Completados"
            value={metrics.completados}
            iconBg="bg-green-50"
            iconColor="text-green-500"
            icon={CheckCircle2}
          />
        </div>

        {/* Toolbar */}
        <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título, cliente, causa..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Tipo */}
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            <option value="Todos">Todos los tipos</option>
            {Object.keys(TIPO_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Responsable */}
          <select
            value={filterResp}
            onChange={e => setFilterResp(e.target.value)}
            className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            <option value="Todas">Todos los resp.</option>
            {Object.keys(RESPONSABLE_INFO).map(r => (
              <option key={r} value={r}>{r} – {RESPONSABLE_INFO[r].nombre}</option>
            ))}
          </select>

          {/* Estado toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {['Activos', 'Todos', 'Completados', 'Vencidos'].map(opt => (
              <button
                key={opt}
                onClick={() => setFilterEstado(opt)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  filterEstado === opt
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Group-by strip */}
        <div className="flex-shrink-0 px-6 pb-2 flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Agrupar por:</span>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {[
              { key: 'urgencia',    label: 'Urgencia'     },
              { key: 'tipo',        label: 'Tipo'         },
              { key: 'responsable', label: 'Responsable'  },
              { key: 'causa',       label: 'Causa'        },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  groupBy === opt.key
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto border-t border-gray-100">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <AlertCircle size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
              <p className="text-[13px]">No hay plazos que coincidan con los filtros</p>
              {(search || filterTipo !== 'Todos' || filterResp !== 'Todas') && (
                <button
                  onClick={() => { setSearch(''); setFilterTipo('Todos'); setFilterResp('Todas') }}
                  className="mt-2 text-[12px] text-[#1a2e4a] hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            grouped.map(g => (
              <div key={g.key}>
                <GroupHeader
                  groupKey={g.key}
                  label={g.label}
                  count={g.items.length}
                  expanded={!collapsed[g.key]}
                  onToggle={() => toggleGroup(g.key)}
                  isUrgencia={groupBy === 'urgencia'}
                />
                {!collapsed[g.key] && g.items.map(p => (
                  <PlazosRow
                    key={p.id}
                    plazo={p}
                    selected={p.id === selectedId}
                    onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                    onDeleteRequest={p => setDeleteTarget({ id: p.id, name: p.titulo })}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      {selectedPlazo && (
        <div
          className="flex-shrink-0 border-l border-gray-100 overflow-hidden"
          style={{ width: 380 }}
        >
          <PanelPlazo
            key={selectedPlazo.id}
            plazo={selectedPlazo}
            onClose={() => setSelectedId(null)}
            onUpdate={handleUpdate}
            tareas={tareas}
          />
        </div>
      )}

      {/* ── Form modal ── */}
      {showForm && (
        <FormNuevoPlazo
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          allCausas={allCausas}
        />
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        onConfirm={handleDeletePlazo}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
