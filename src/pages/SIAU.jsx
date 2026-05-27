import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  ChevronRight, ChevronDown, Search, Plus, ExternalLink,
  FileText, Clock, CheckCircle2, X, Check, Edit2,
  AlertCircle, MinusCircle, Gavel, Loader2, Table2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import CargaMasivaModal from '../components/CargaMasivaModal'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Configs ─────────────────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  'Pendiente':           { bg: 'bg-amber-50',  text: 'text-amber-700',   dot: 'bg-amber-500'   },
  'Respondida':          { bg: 'bg-green-50',  text: 'text-green-700',   dot: 'bg-green-500'   },
  'Sin respuesta':       { bg: 'bg-gray-100',  text: 'text-gray-500',    dot: 'bg-gray-400'    },
  'Urgente':             { bg: 'bg-red-50',    text: 'text-red-700',     dot: 'bg-red-500'     },
  'No ha lugar':         { bg: 'bg-slate-100', text: 'text-slate-600',   dot: 'bg-slate-400'   },
  'Entrevista agendada': { bg: 'bg-blue-50',   text: 'text-blue-700',    dot: 'bg-blue-500'    },
  'Fiscal contactó':     { bg: 'bg-violet-50', text: 'text-violet-700',  dot: 'bg-violet-500'  },
  'Archivado':           { bg: 'bg-gray-100',  text: 'text-gray-500',    dot: 'bg-gray-400'    },
}
const ESTADOS_SIAU = Object.keys(ESTADO_CONFIG)

const TIPO_SOLICITUD_CONFIG = {
  'Copia carpeta': { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'Entrevista':    { bg: 'bg-violet-50',  text: 'text-violet-700'  },
  'Diligencias':   { bg: 'bg-amber-50',   text: 'text-amber-700'   },
  'Información':   { bg: 'bg-teal-50',    text: 'text-teal-700'    },
  'Documento':     { bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
  'Otro':          { bg: 'bg-gray-100',   text: 'text-gray-500'    },
}
const TIPOS_SOLICITUD = Object.keys(TIPO_SOLICITUD_CONFIG)

const DB_FIELDS = new Set([
  'estado','notas','fecha','folio','causa_id','cliente_id','causa_rit','cliente_nombre',
  'solicitud','respuesta','documentos','fecha_respuesta','tipo_solicitud',
])

function mapRow(row) {
  return {
    id:             row.id,
    created_at:     row.created_at,
    estado:         row.estado         || 'Pendiente',
    notas:          row.notas          || '',
    fecha:          row.fecha          || '',
    folio:          row.folio          || '',
    tipo_solicitud: row.tipo_solicitud || 'Otro',
    solicitud:      row.solicitud      || '',
    respuesta:      row.respuesta      || '',
    fecha_respuesta:row.fecha_respuesta|| null,
    documentos:     row.documentos     || '',
    causa_rit:      row.causa_rit      || '',
    cliente_nombre: row.cliente_nombre || '',
    causa_id:       row.causa_id       || null,
    cliente_id:     row.cliente_id     || null,
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
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[176px] py-1">
          {ESTADOS_SIAU.map(e => {
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

function TipoSolicitudBadge({ tipo }) {
  const cfg = TIPO_SOLICITUD_CONFIG[tipo] || TIPO_SOLICITUD_CONFIG['Otro']
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      {tipo || '—'}
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

// ── RegistroRow ─────────────────────────────────────────────────────────────────
const REG_COLS = '72px 118px 110px 1fr 1fr 88px 72px 90px 28px'
const REG_HEADERS = ['Fecha', 'Folio', 'Tipo solicitud', 'Solicitud', 'Respuesta', 'F. Respuesta', 'Docs', 'Notas', '']

function RegistroRow({ reg, index, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [editNota, setEditNota] = useState(false)
  const [notaDraft, setNotaDraft] = useState(reg.notas)
  const [saving, setSaving] = useState(false)

  const saveNota = async () => {
    setSaving(true)
    await onUpdate(reg.id, { notas: notaDraft })
    setEditNota(false)
    setSaving(false)
  }

  return (
    <div className={`border-b border-gray-50 transition-colors ${expanded ? 'bg-[#1a2e4a]/[0.015]' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
      style={reg.estado === 'Urgente' ? { borderLeft: '3px solid #ef4444' } : { borderLeft: '3px solid transparent' }}>
      <div onClick={() => setExpanded(e => !e)}
        className="grid items-start px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors group"
        style={{ gridTemplateColumns: REG_COLS }}>
        {/* Fecha */}
        <div className="pt-0.5 min-w-0">
          <p className="text-[11px] text-gray-600 font-mono leading-none">{fmtFecha(reg.fecha)}</p>
        </div>
        {/* Folio */}
        <div className="pt-0.5 pr-1 min-w-0">
          <span className="inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold tracking-tight whitespace-nowrap">
            {reg.folio || '—'}
          </span>
        </div>
        {/* Tipo */}
        <div className="pt-0.5 min-w-0">
          <TipoSolicitudBadge tipo={reg.tipo_solicitud} />
        </div>
        {/* Solicitud */}
        <div className="pr-3 pt-0.5 min-w-0">
          <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{reg.solicitud || '—'}</p>
        </div>
        {/* Respuesta */}
        <div className="pr-3 pt-0.5 min-w-0">
          <div className="mb-0.5">
            <EstadoDropdown estado={reg.estado} onChange={e => onUpdate(reg.id, { estado: e })} />
          </div>
          {reg.respuesta?.trim() && (
            <p className="text-[10px] text-gray-500 line-clamp-2 leading-snug mt-0.5">{reg.respuesta}</p>
          )}
        </div>
        {/* Fecha Respuesta */}
        <div className="pt-0.5 min-w-0">
          <p className="text-[11px] text-gray-500 font-mono">{reg.fecha_respuesta ? fmtFecha(reg.fecha_respuesta) : '—'}</p>
        </div>
        {/* Documentos */}
        <div className="pt-0.5 min-w-0">
          {reg.documentos?.trim() ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 max-w-[70px] truncate" title={reg.documentos}>
              <FileText size={9} className="flex-shrink-0" />Ver doc
            </span>
          ) : <span className="text-[11px] text-gray-300">—</span>}
        </div>
        {/* Notas */}
        <div className="pt-0.5 min-w-0">
          {reg.notas?.trim() ? (
            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 max-w-[80px] truncate" title={reg.notas}>
              {reg.notas}
            </span>
          ) : <span className="text-[11px] text-gray-300">—</span>}
        </div>
        {/* Expand */}
        <div className="pt-0.5 flex justify-end">
          <ChevronRight size={13} className={`text-gray-300 group-hover:text-gray-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3.5 border-t border-gray-100 bg-white" onClick={e => e.stopPropagation()}>
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <EstadoDropdown estado={reg.estado} onChange={e => onUpdate(reg.id, { estado: e })} />
            <TipoSolicitudBadge tipo={reg.tipo_solicitud} />
            {reg.folio && (
              <span className="font-mono text-[11px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded font-semibold">{reg.folio}</span>
            )}
            <span className="text-[11px] text-gray-400">{fmtFechaLarga(reg.fecha)}</span>
          </div>
          {/* Solicitud */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Solicitud</p>
            <p className="text-[12px] text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{reg.solicitud || <span className="text-gray-400 italic">Sin descripción</span>}</p>
          </div>
          {/* Respuesta */}
          {(reg.respuesta || reg.fecha_respuesta) && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Respuesta</p>
              <div className="rounded-lg border border-green-100 bg-green-50/50 p-3 space-y-2">
                {reg.respuesta && <p className="text-[12px] text-gray-700 leading-relaxed">{reg.respuesta}</p>}
                {reg.fecha_respuesta && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-green-100">
                    <span className="text-[9px] font-semibold text-green-600 uppercase tracking-wider">Respondida</span>
                    <span className="text-[11px] text-gray-600">{fmtFechaLarga(reg.fecha_respuesta)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Documentos */}
          {reg.documentos?.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Documentos:</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                <FileText size={11} />{reg.documentos}
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
                <textarea value={notaDraft} onChange={e => setNotaDraft(e.target.value)} rows={3} autoFocus
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400" />
                <div className="flex gap-2">
                  <button onClick={saveNota} disabled={saving}
                    className="text-[11px] px-2.5 py-1 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] flex items-center gap-1 disabled:opacity-50">
                    {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={10} />} Guardar
                  </button>
                  <button onClick={() => { setEditNota(false); setNotaDraft(reg.notas) }}
                    className="text-[11px] px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-gray-600 leading-relaxed bg-amber-50/50 rounded-lg p-2.5 min-h-[2rem]">
                {reg.notas || <span className="text-gray-400 italic">Sin notas</span>}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FormNuevaSolicitud ────────────────────────────────────────────────────────────
function FormNuevaSolicitud({ causa, causasInfo, globalMode = false, onSave, onClose }) {
  const [selCliente, setSelCliente] = useState(globalMode ? '' : (causa?.cliente_nombre || ''))
  const [selCausaRit, setSelCausaRit] = useState(globalMode ? '' : (causa?.causa_rit || ''))
  const [form, setForm] = useState({
    fecha: TODAY, folio: '', tipo_solicitud: 'Información', solicitud: '',
    respuesta: '', fecha_respuesta: '', documentos: '', estado: 'Pendiente', notas: '',
  })

  const allClienteNames = useMemo(() => {
    if (!globalMode) return []
    return [...new Set((causasInfo || []).map(c => c.cliente_nombre).filter(Boolean))].sort()
  }, [causasInfo, globalMode])

  const causasForCliente = useMemo(() => {
    if (!globalMode) return []
    return (causasInfo || []).filter(c => c.cliente_nombre === selCliente)
  }, [causasInfo, selCliente, globalMode])

  const resolvedCausa = globalMode
    ? (causasInfo?.find(c => c.rit === selCausaRit) || null)
    : causa

  const valid = form.folio.trim() && form.fecha &&
    (globalMode ? (selCliente && selCausaRit) : true)

  const handleSave = async () => {
    if (!valid) return
    onSave({
      fecha: form.fecha, folio: form.folio.trim(), tipo_solicitud: form.tipo_solicitud,
      solicitud: form.solicitud.trim() || null, respuesta: form.respuesta.trim() || null,
      fecha_respuesta: form.fecha_respuesta || null,
      documentos: form.documentos.trim() || null, estado: form.estado,
      notas: form.notas || null,
      causa_rit: globalMode ? selCausaRit : (causa?.causa_rit || null),
      cliente_nombre: globalMode ? selCliente : (causa?.cliente_nombre || ''),
      causa_id: resolvedCausa?.id || null,
      cliente_id: resolvedCausa?.cliente_id || null,
    })
  }

  const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Nueva solicitud SIAU</h3>
            {!globalMode && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                <span className="font-mono bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">{causa?.causa_rit}</span>
                {' '}— {causa?.cliente_nombre}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
          {globalMode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Cliente *</label>
                <select value={selCliente} onChange={e => { setSelCliente(e.target.value); setSelCausaRit('') }} className={inp + ' bg-white'}>
                  <option value="">Seleccionar cliente...</option>
                  {allClienteNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Causa *</label>
                <select value={selCausaRit} onChange={e => setSelCausaRit(e.target.value)} className={inp + ' bg-white'} disabled={!selCliente}>
                  <option value="">Seleccionar causa...</option>
                  {causasForCliente.map(c => <option key={c.id} value={c.rit}>{c.rit}{c.materia ? ` — ${c.materia}` : ''}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Folio SIAU *</label>
              <input type="text" value={form.folio} onChange={e => setForm(f => ({ ...f, folio: e.target.value }))}
                placeholder="SIAU-2026-001" className={inp + ' font-mono'} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Tipo</label>
              <select value={form.tipo_solicitud} onChange={e => setForm(f => ({ ...f, tipo_solicitud: e.target.value }))} className={inp + ' bg-white'}>
                {TIPOS_SOLICITUD.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inp + ' bg-white'}>
                {ESTADOS_SIAU.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fecha respuesta</label>
              <input type="date" value={form.fecha_respuesta} onChange={e => setForm(f => ({ ...f, fecha_respuesta: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Solicitud</label>
            <input type="text" value={form.solicitud} onChange={e => setForm(f => ({ ...f, solicitud: e.target.value }))}
              placeholder="Descripción de la solicitud..." className={inp} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Respuesta</label>
            <input type="text" value={form.respuesta} onChange={e => setForm(f => ({ ...f, respuesta: e.target.value }))}
              placeholder="Respuesta recibida..." className={inp} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Documentos</label>
            <input type="text" value={form.documentos} onChange={e => setForm(f => ({ ...f, documentos: e.target.value }))}
              placeholder="Nombre o descripción de documentos..." className={inp} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Notas internas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
              placeholder="Observaciones internas..." className={inp + ' resize-none'} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!valid}
            className={`text-[13px] px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <Plus size={13} /> Guardar solicitud
          </button>
        </div>
      </div>
    </div>
  )
}

// ── View 3: RegistrosView ─────────────────────────────────────────────────────────
function RegistrosView({ causa, allRegistros, onUpdate, onAdd, onBack, onBackToClientes, causasInfo }) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const registros = useMemo(() => {
    const regs = allRegistros.filter(r => {
      const rCausaId = r.causa_id || null
      const matchId  = rCausaId && causa.causaInfo?.id && rCausaId === causa.causaInfo.id
      const matchRit = r.causa_rit && causa.causa_rit && r.causa_rit === causa.causa_rit
      return matchId || matchRit || (!rCausaId && !r.causa_rit && !causa.causa_rit)
    })
    if (!search.trim()) return regs.sort((a, b) => b.fecha.localeCompare(a.fecha))
    const q = search.toLowerCase()
    return regs
      .filter(r =>
        (r.folio || '').toLowerCase().includes(q) ||
        (r.solicitud || '').toLowerCase().includes(q) ||
        (r.respuesta || '').toLowerCase().includes(q) ||
        (r.tipo_solicitud || '').toLowerCase().includes(q)
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [allRegistros, causa, search])

  const counts = {
    total:       registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta' || r.estado === 'Urgente').length,
    respondidas: registros.filter(r => r.estado === 'Respondida').length,
    urgentes:    registros.filter(r => r.estado === 'Urgente').length,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-1.5 border-b border-gray-100 bg-white">
        <button onClick={onBackToClientes} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Clientes</button>
        <ChevronRight size={11} className="text-gray-300" />
        <button onClick={onBack} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">{causa.cliente_nombre}</button>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-[11px] font-semibold text-gray-700">{causa.causa_rit ? `RIT ${causa.causa_rit}` : 'Sin RIT'}</span>
        <div className="ml-auto flex items-center gap-2">
          {causa.causaInfo?.ruc && (
            <span className="font-mono text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded">RUC {causa.causaInfo.ruc}</span>
          )}
          {causa.causaInfo?.materia && <span className="text-[12px] font-medium text-gray-600">{causa.causaInfo.materia}</span>}
          {causa.causaInfo?.fiscalia && <span className="text-[11px] text-gray-400">· Fiscalía {causa.causaInfo.fiscalia}</span>}
        </div>
      </div>
      {/* Sub-header */}
      <div className="flex-shrink-0 px-6 py-2.5 flex items-center gap-3 bg-white border-b border-gray-50">
        <div className="flex items-center gap-4 text-[11px]">
          <span className="font-bold text-gray-800 tabular-nums">{counts.total} sol.</span>
          {counts.respondidas > 0 && <span className="text-green-700 font-medium">{counts.respondidas} resp.</span>}
          {counts.pendientes  > 0 && <span className="text-amber-700 font-medium">{counts.pendientes} pend.</span>}
          {counts.urgentes    > 0 && <span className="text-red-700 font-bold flex items-center gap-1"><AlertCircle size={11} />{counts.urgentes} urg.</span>}
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
            <Plus size={13} /> Nueva solicitud
          </button>
        </div>
      </div>
      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid px-4 py-2.5 bg-gray-50 border-b border-gray-100 sticky top-0 z-10"
          style={{ gridTemplateColumns: REG_COLS }}>
          {REG_HEADERS.map((h, i) => (
            <p key={i} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">{h}</p>
          ))}
        </div>
        {registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Gavel size={24} strokeWidth={1.5} className="mb-2 opacity-30" />
            <p className="text-[13px]">{search ? 'Sin resultados' : 'Sin solicitudes en esta causa'}</p>
          </div>
        ) : (
          registros.map((reg, i) => (
            <RegistroRow key={reg.id} reg={reg} index={i} onUpdate={onUpdate} />
          ))
        )}
      </div>
      {showForm && (
        <FormNuevaSolicitud
          causa={causa}
          causasInfo={causasInfo}
          onSave={async (data) => {
            const causa2 = causasInfo?.find(c => c.rit === (data.causa_rit || causa.causa_rit))
            const payload = {
              ...data,
              causa_rit:      data.causa_rit      || causa.causa_rit      || null,
              cliente_nombre: data.cliente_nombre || causa.cliente_nombre || '',
              causa_id:       data.causa_id       || causa2?.id           || null,
              cliente_id:     data.cliente_id     || causa2?.cliente_id   || null,
            }
            const { data: inserted, error } = await supabase.from('siau').insert([payload]).select().single()
            if (error) { alert('Error al guardar: ' + error.message); return }
            onAdd(mapRow(inserted))
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ── View 2: CausasClienteView ─────────────────────────────────────────────────────
function CausasClienteView({ clienteNombre, causasGrupos, onSelectCausa, onBack }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-3 flex items-center gap-1.5 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Clientes</button>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-[11px] font-semibold text-gray-700">{clienteNombre}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
        <p className="text-[11px] text-gray-400 mb-2">{causasGrupos.length} causa{causasGrupos.length !== 1 ? 's' : ''}</p>
        {causasGrupos.map(g => {
          const urgentes   = g.registros.filter(r => r.estado === 'Urgente').length
          const pendientes = g.registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta' || r.estado === 'Urgente').length
          const respondidas = g.registros.filter(r => r.estado === 'Respondida').length
          const last = [...g.registros].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
          return (
            <div key={g.causa_rit || 'sin'} onClick={() => onSelectCausa(g)}
              className="bg-white border border-gray-100 rounded-xl px-5 py-4 cursor-pointer hover:shadow-sm hover:border-gray-200 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {g.causa_rit ? (
                      <span className="font-mono text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-semibold">RIT {g.causa_rit}</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Sin causa vinculada</span>
                    )}
                    {g.causaInfo?.ruc && (
                      <span className="font-mono text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded">RUC {g.causaInfo.ruc}</span>
                    )}
                    {urgentes > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
                      </span>
                    )}
                  </div>
                  {g.causaInfo?.materia && <p className="text-[13px] font-semibold text-gray-800 mb-1">{g.causaInfo.materia}</p>}
                  {g.causaInfo?.fiscalia && <p className="text-[11px] text-gray-400">Fiscalía {g.causaInfo.fiscalia}</p>}
                  {last && (
                    <p className="text-[11px] text-gray-400 mt-1.5 truncate">
                      Último: {fmtFechaLarga(last.fecha)}{last.solicitud ? ` · ${last.solicitud.slice(0,55)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[12px] font-bold text-gray-700 tabular-nums">{g.registros.length} sol.</span>
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

// ── Main SIAU ─────────────────────────────────────────────────────────────────────
export default function SIAU() {
  const [registros,  setRegistros]  = useState([])
  const [allCausas,  setAllCausas]  = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [error,      setError]      = useState(null)

  // Navigation
  const [view,              setView]              = useState('clientes')
  const [selectedCliente,   setSelectedCliente]   = useState(null)
  const [selectedCausaGrupo, setSelectedCausaGrupo] = useState(null)

  // Filters
  const [search,       setSearch]       = useState('')
  const [filterEstado, setFilterEstado] = useState('Todos')
  const [filterCliente, setFilterCliente] = useState('Todos')

  // Modals
  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false)
  const [showCargaMasiva,    setShowCargaMasiva]    = useState(false)

  const fetchRegistros = useCallback(async () => {
    setCargando(true); setError(null)
    const { data, error: err } = await supabase.from('siau').select('*').order('fecha', { ascending: false })
    if (err) setError(err.message)
    else setRegistros((data || []).map(mapRow))
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas').select('id,rit,ruc,materia,fiscalia,tribunal,cliente_nombre,cliente_id').order('rit')
    setAllCausas(data || [])
  }, [])

  useEffect(() => { fetchRegistros(); fetchCausas() }, [fetchRegistros, fetchCausas])

  const handleUpdate = useCallback(async (id, cambios) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(Object.entries(cambios).filter(([k]) => DB_FIELDS.has(k)))
    if (Object.keys(dbCambios).length === 0) return
    const { error: err } = await supabase.from('siau').update(dbCambios).eq('id', id)
    if (err) console.error('Error actualizando SIAU:', err.message)
  }, [])

  const handleAdd = useCallback((newReg) => {
    setRegistros(prev => [newReg, ...prev])
  }, [])

  // Build clients → causas → registros structure
  const clienteGrupos = useMemo(() => {
    // Get all unique client names from both registros AND allCausas
    const clienteSet = new Set()
    registros.forEach(r => { if (r.cliente_nombre) clienteSet.add(r.cliente_nombre) })
    allCausas.forEach(c => { if (c.cliente_nombre) clienteSet.add(c.cliente_nombre) })

    return [...clienteSet].sort().map(clienteNombre => {
      const causasCliente = allCausas.filter(c => c.cliente_nombre === clienteNombre)
      const regsCliente   = registros.filter(r => r.cliente_nombre === clienteNombre)

      // Assign registros to causas
      const byId = {}
      const sinCausa = []
      regsCliente.forEach(r => {
        let asignadaId = r.causa_id || null
        if (!asignadaId && r.causa_rit) {
          const ci = causasCliente.find(c => c.rit === r.causa_rit)
          if (ci) asignadaId = ci.id
        }
        if (asignadaId) {
          if (!byId[asignadaId]) byId[asignadaId] = []
          byId[asignadaId].push(r)
        } else sinCausa.push(r)
      })

      let grupos
      if (causasCliente.length > 0) {
        grupos = causasCliente.map(ci => ({
          causa_rit:    ci.rit || null,
          causaInfo:    ci,
          cliente_nombre: clienteNombre,
          registros:    byId[ci.id] || [],
        }))
        if (sinCausa.length > 0) grupos.push({ causa_rit: null, causaInfo: null, cliente_nombre: clienteNombre, registros: sinCausa })
      } else {
        const map = {}
        regsCliente.forEach(r => {
          const key = r.causa_rit || 'sin_causa'
          if (!map[key]) {
            const ci = allCausas.find(c => c.rit === r.causa_rit)
            map[key] = { causa_rit: r.causa_rit || null, causaInfo: ci || null, cliente_nombre: clienteNombre, registros: [] }
          }
          map[key].registros.push(r)
        })
        grupos = Object.values(map)
      }
      grupos.sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))

      return { clienteNombre, causasGrupos: grupos }
    }).filter(cl => cl.causasGrupos.some(g => g.registros.length > 0) || allCausas.some(c => c.cliente_nombre === cl.clienteNombre))
  }, [registros, allCausas])

  const stats = useMemo(() => ({
    total:       registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta').length,
    respondidas: registros.filter(r => r.estado === 'Respondida').length,
    urgentes:    registros.filter(r => r.estado === 'Urgente').length,
    noHaLugar:   registros.filter(r => r.estado === 'No ha lugar').length,
  }), [registros])

  const filteredClientes = useMemo(() => {
    const noFilters = !search && filterEstado === 'Todos' && filterCliente === 'Todos'
    if (noFilters) return clienteGrupos

    return clienteGrupos
      .filter(cl => filterCliente === 'Todos' || cl.clienteNombre === filterCliente)
      .map(cl => ({
        ...cl,
        causasGrupos: cl.causasGrupos.map(g => ({
          ...g,
          registros: g.registros.filter(r => {
            const q = search.toLowerCase()
            const ms = !q || (r.folio || '').toLowerCase().includes(q) || (r.solicitud || '').toLowerCase().includes(q) || (cl.clienteNombre || '').toLowerCase().includes(q) || (r.causa_rit || '').toLowerCase().includes(q)
            const me = filterEstado === 'Todos' || r.estado === filterEstado
            return ms && me
          }),
        })).filter(g => g.registros.length > 0),
      }))
      .filter(cl => cl.causasGrupos.length > 0)
  }, [clienteGrupos, search, filterEstado, filterCliente])

  const clienteNames = useMemo(() => clienteGrupos.map(cl => cl.clienteNombre), [clienteGrupos])
  const hasFilters = search || filterEstado !== 'Todos' || filterCliente !== 'Todos'

  // Derive current selection from latest state
  const currentClienteData = useMemo(() =>
    clienteGrupos.find(cl => cl.clienteNombre === selectedCliente),
    [clienteGrupos, selectedCliente]
  )
  const currentCausaGrupo = useMemo(() => {
    if (!currentClienteData || !selectedCausaGrupo) return null
    return currentClienteData.causasGrupos.find(g =>
      (g.causa_rit || 'sin') === (selectedCausaGrupo.causa_rit || 'sin')
    ) || selectedCausaGrupo
  }, [currentClienteData, selectedCausaGrupo])

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">SIAU</h1>
            <p className="text-[12px] text-gray-400 mt-1">
              {cargando ? 'Cargando...' : `Fiscalía de Chile · ${clienteGrupos.length} clientes · ${registros.length} solicitudes`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCargaMasiva(true)}
              className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 text-gray-600 text-[13px] font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
              <Table2 size={14} /> Carga masiva
            </button>
            <button onClick={() => setShowNuevaSolicitud(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1a2e4a] text-white text-[13px] font-medium rounded-lg hover:bg-[#243d5e] transition-colors">
              <Plus size={14} /> Nueva solicitud
            </button>
            <a href="https://www.siau.fiscaliadechile.cl/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 border border-[#1a2e4a]/20 text-[#1a2e4a] text-[13px] font-medium rounded-lg hover:bg-[#1a2e4a]/5 hover:border-[#1a2e4a]/40 transition-colors">
              <Gavel size={14} /> Portal SIAU <ExternalLink size={11} className="opacity-60" />
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-center gap-2.5">
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-[12px] text-red-700">{error}</p>
          <button onClick={fetchRegistros} className="ml-auto text-[11px] text-red-600 underline">Reintentar</button>
        </div>
      )}

      {cargando && (
        <div className="flex items-center justify-center py-20 text-gray-300">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* Stats — only on clientes view */}
          {view === 'clientes' && (
            <div className="flex-shrink-0 px-6 pt-3 pb-2 grid grid-cols-5 gap-2">
              <StatCard label="Total solicitudes"  value={stats.total}       iconBg="bg-gray-50"   iconColor="text-gray-500"   icon={FileText}     />
              <StatCard label="Pendientes"          value={stats.pendientes}  iconBg="bg-amber-50"  iconColor="text-amber-500"  icon={Clock}        />
              <StatCard label="Respondidas"         value={stats.respondidas} iconBg="bg-green-50"  iconColor="text-green-500"  icon={CheckCircle2} />
              <StatCard label="Urgentes"            value={stats.urgentes}    iconBg="bg-red-50"    iconColor="text-red-500"    icon={AlertCircle}  />
              <StatCard label="No ha lugar"         value={stats.noHaLugar}   iconBg="bg-slate-50"  iconColor="text-slate-500"  icon={MinusCircle}  />
            </div>
          )}

          {/* Clientes view */}
          {view === 'clientes' && (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap py-3 sticky top-0 bg-white z-10">
                <div className="relative flex-1 min-w-48">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar folio, cliente, solicitud..."
                    className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
                </div>
                <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                  <option value="Todos">Todos los estados</option>
                  {ESTADOS_SIAU.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
                  className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
                  <option value="Todos">Todos los clientes</option>
                  {clienteNames.map(c => <option key={c} value={c}>{c.split(' ').slice(0,2).join(' ')}</option>)}
                </select>
                {hasFilters && (
                  <button onClick={() => { setSearch(''); setFilterEstado('Todos'); setFilterCliente('Todos') }}
                    className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                    <X size={11} /> Limpiar
                  </button>
                )}
              </div>
              {/* Client list */}
              <div className="space-y-2">
                {filteredClientes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <Gavel size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
                    <p className="text-[13px]">No se encontraron registros</p>
                  </div>
                ) : filteredClientes.map(cl => {
                  const allRegs = cl.causasGrupos.flatMap(g => g.registros)
                  const urgentes   = allRegs.filter(r => r.estado === 'Urgente').length
                  const pendientes = allRegs.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta' || r.estado === 'Urgente').length
                  const respondidas = allRegs.filter(r => r.estado === 'Respondida').length
                  return (
                    <div key={cl.clienteNombre}
                      onClick={() => { setSelectedCliente(cl.clienteNombre); setView('causas') }}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-4 cursor-pointer hover:shadow-sm hover:border-gray-200 transition-all group">
                      <div className="flex items-start gap-3">
                        <ChevronRight size={14} className="flex-shrink-0 mt-0.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <p className="text-[14px] font-semibold text-gray-900 leading-none">{cl.clienteNombre}</p>
                            {urgentes > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {cl.causasGrupos.map(g => {
                              const hU = g.registros.some(r => r.estado === 'Urgente')
                              const hP = g.registros.some(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta')
                              return (
                                <span key={g.causa_rit || 'sin'} className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-700">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hU ? 'bg-red-400' : hP ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                  {g.causa_rit ? <span className="font-mono text-[10px] text-violet-700 font-semibold">{g.causa_rit}</span> : <span className="text-gray-400 text-[10px]">sin RIT</span>}
                                  {g.causaInfo?.materia && <span className="text-gray-500 text-[10px] max-w-[140px] truncate">· {g.causaInfo.materia}</span>}
                                  <span className="text-[10px] text-gray-400 font-medium">{g.registros.length} sol.</span>
                                </span>
                              )
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[10px] text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded-full">
                            {cl.causasGrupos.length} causa{cl.causasGrupos.length !== 1 ? 's' : ''}
                          </span>
                          {urgentes   > 0 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{urgentes} urg.</span>}
                          {pendientes > 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{pendientes} pend.</span>}
                          {respondidas > 0 && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{respondidas} resp.</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'causas' && currentClienteData && (
            <CausasClienteView
              clienteNombre={currentClienteData.clienteNombre}
              causasGrupos={currentClienteData.causasGrupos}
              onSelectCausa={g => { setSelectedCausaGrupo(g); setView('registros') }}
              onBack={() => { setView('clientes'); setSelectedCliente(null) }}
            />
          )}

          {view === 'registros' && currentCausaGrupo && (
            <RegistrosView
              causa={currentCausaGrupo}
              allRegistros={registros}
              onUpdate={handleUpdate}
              onAdd={handleAdd}
              causasInfo={allCausas}
              onBack={() => { setView('causas'); setSelectedCausaGrupo(null) }}
              onBackToClientes={() => { setView('clientes'); setSelectedCliente(null); setSelectedCausaGrupo(null) }}
            />
          )}
        </>
      )}

      {/* Global Nueva Solicitud Modal */}
      {showNuevaSolicitud && (
        <FormNuevaSolicitud
          globalMode
          causasInfo={allCausas}
          onSave={async (data) => {
            const { data: inserted, error } = await supabase.from('siau').insert([data]).select().single()
            if (error) { alert('Error: ' + error.message); return }
            handleAdd(mapRow(inserted))
            setShowNuevaSolicitud(false)
          }}
          onClose={() => setShowNuevaSolicitud(false)}
        />
      )}

      {showCargaMasiva && (
        <CargaMasivaModal
          modulo="siau"
          allCausas={allCausas}
          onClose={() => setShowCargaMasiva(false)}
          onSuccess={insertedRows => {
            setRegistros(prev => [...insertedRows.map(r => ({ ...r, estado: r.estado || 'Pendiente' })), ...prev])
          }}
        />
      )}
    </div>
  )
}
