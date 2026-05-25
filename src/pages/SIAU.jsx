import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, Search, Plus, ExternalLink,
  FileText, Clock, CheckCircle2,
  X, Check, Edit2, Gavel, Loader2, AlertCircle,
  MinusCircle, Scale,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Configs ────────────────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  Respondida:      { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  Pendiente:       { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  Urgente:         { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
  'Sin respuesta': { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400'   },
  'No ha lugar':   { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400'  },
}

// DB fields
const DB_FIELDS = new Set(['estado','notas','fecha','folio','causa_id','cliente_id','causa_rit','cliente_nombre','solicitud','respuesta','documentos'])

function mapRow(row) {
  return {
    id:             row.id,
    created_at:     row.created_at,
    estado:         row.estado         || 'Pendiente',
    notas:          row.notas          || '',
    fecha:          row.fecha          || '',
    folio:          row.folio          || '',
    solicitud:      row.solicitud      || '',
    respuesta:      row.respuesta      || '',
    documentos:     row.documentos     || '',
    causa_rit:      row.causa_rit      || '',
    cliente_nombre: row.cliente_nombre || '',
    causa_id:       row.causa_id       || null,
    cliente_id:     row.cliente_id     || null,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${M[m-1]} ${y}`
}

function fmtFechaCorta(iso) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-').map(Number)
  const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d} ${M[m-1]}`
}

// ── Atoms ──────────────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Sin respuesta']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {estado}
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

function ErrorBanner({ mensaje, onRetry }) {
  return (
    <div className="flex items-center gap-3 mx-6 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
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

// ── RegistroRow ────────────────────────────────────────────────────────────────
function RegistroRow({ reg, index, onUpdate }) {
  const [expanded,    setExpanded]    = useState(false)
  const [editNota,    setEditNota]    = useState(false)
  const [notaDraft,   setNotaDraft]   = useState(reg.notas)
  const [saving,      setSaving]      = useState(false)

  const saveNota = async () => {
    setSaving(true)
    await onUpdate(reg.id, { notas: notaDraft })
    setEditNota(false)
    setSaving(false)
  }

  const changeEstado = (e) => {
    e.stopPropagation()
    const estados = Object.keys(ESTADO_CONFIG)
    const next = estados[(estados.indexOf(reg.estado) + 1) % estados.length]
    onUpdate(reg.id, { estado: next })
  }

  return (
    <div
      className={`border-b border-gray-50 transition-colors ${
        expanded ? 'bg-[#1a2e4a]/[0.015]' : index % 2 !== 0 ? 'bg-gray-50/30' : 'bg-white'
      }`}
    >
      {/* Compact row: Fecha | Folio | Causa | Estado | Notas */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="grid items-center px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors gap-2"
        style={{ gridTemplateColumns: '80px 100px 1fr 1fr 90px 1fr 28px' }}
      >
        {/* Fecha */}
        <div>
          <p className="text-[11px] text-gray-600 font-medium">{fmtFechaCorta(reg.fecha)}</p>
          <p className="text-[10px] text-gray-400">{reg.fecha?.slice(0,4)}</p>
        </div>

        {/* Folio */}
        <div>
          <span className="inline-flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold tracking-tight">
            {reg.folio || '—'}
          </span>
          {reg.causa_rit && (
            <p className="text-[10px] text-violet-500 mt-0.5 font-medium">{reg.causa_rit}</p>
          )}
        </div>

        {/* Solicitud */}
        <div className="min-w-0 pr-2">
          {reg.solicitud?.trim() ? (
            <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{reg.solicitud}</p>
          ) : (
            <span className="text-[11px] text-gray-300">—</span>
          )}
        </div>

        {/* Respuesta */}
        <div className="min-w-0 pr-2">
          <div onClick={e => e.stopPropagation()} className="mb-0.5">
            <button onClick={changeEstado} title="Click para cambiar estado">
              <EstadoBadge estado={reg.estado} />
            </button>
          </div>
          {reg.respuesta?.trim() && (
            <p className="text-[10px] text-gray-500 line-clamp-1 leading-snug">{reg.respuesta}</p>
          )}
        </div>

        {/* Documentos */}
        <div className="min-w-0">
          {reg.documentos?.trim() ? (
            <p className="text-[11px] text-blue-600 truncate">{reg.documentos}</p>
          ) : (
            <span className="text-[11px] text-gray-300">—</span>
          )}
        </div>

        {/* Notas */}
        <div className="min-w-0">
          {reg.notas?.trim() ? (
            <p className="text-[11px] text-gray-500 truncate">{reg.notas}</p>
          ) : (
            <span className="text-[11px] text-gray-300">—</span>
          )}
        </div>

        {/* Expand */}
        <div className="flex justify-end">
          <ChevronRight
            size={13}
            className={`text-gray-300 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-6 pb-5 pt-3 space-y-4 bg-white border-t border-gray-100" onClick={e => e.stopPropagation()}>

          <div className="flex items-center gap-3 flex-wrap">
            <EstadoBadge estado={reg.estado} />
            {reg.folio && (
              <span className="font-mono text-[11px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded font-semibold">
                {reg.folio}
              </span>
            )}
            {reg.causa_rit && (
              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                RIT {reg.causa_rit}
              </span>
            )}
            <span className="text-[11px] text-gray-400">{fmtFecha(reg.fecha)}</span>

            {/* Cambiar estado */}
            <div className="ml-auto flex items-center gap-1.5">
              {Object.keys(ESTADO_CONFIG).filter(e => e !== reg.estado).map(e => (
                <button
                  key={e}
                  onClick={() => onUpdate(reg.id, { estado: e })}
                  className="text-[10px] text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  → {e}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Notas internas</p>
              {!editNota && (
                <button
                  onClick={() => { setEditNota(true); setNotaDraft(reg.notas) }}
                  className="text-[10px] text-[#1a2e4a] hover:text-[#243d5e] flex items-center gap-1 transition-colors"
                >
                  <Edit2 size={9} /> Editar
                </button>
              )}
            </div>
            {editNota ? (
              <div className="space-y-1.5">
                <textarea
                  value={notaDraft}
                  onChange={e => setNotaDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNota}
                    disabled={saving}
                    className="text-[11px] px-2.5 py-1 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] flex items-center gap-1 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={10} />} Guardar
                  </button>
                  <button
                    onClick={() => { setEditNota(false); setNotaDraft(reg.notas) }}
                    className="text-[11px] px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
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

// ── ClienteCard — un cliente con resumen de causas ─────────────────────────────
function ClienteCard({ clienteNombre, registros, allCausas, onSelect }) {
  // Agrupar registros por causa
  // Fuente primaria: allCausas filtrado por cliente → garantiza que todas las causas aparezcan
  const porCausa = useMemo(() => {
    const causasCliente = allCausas.filter(c => c.cliente_nombre === clienteNombre)

    // Asignar cada registro a una causa: primero por causa_id, luego por causa_rit
    const byId = {}
    const sinCausa = []
    registros.forEach(r => {
      let asignadaId = r.causa_id || null
      if (!asignadaId && r.causa_rit) {
        const ci = causasCliente.find(c => c.rit === r.causa_rit)
        if (ci) asignadaId = ci.id
      }
      if (asignadaId) {
        if (!byId[asignadaId]) byId[asignadaId] = []
        byId[asignadaId].push(r)
      } else {
        sinCausa.push(r)
      }
    })

    if (causasCliente.length > 0) {
      const result = causasCliente.map(ci => ({
        causa_rit: ci.rit || null,
        materia:   ci.materia   || '',
        fiscalia:  ci.fiscalia  || '',
        registros: byId[ci.id] || [],
      }))
      if (sinCausa.length > 0) {
        result.push({ causa_rit: null, materia: '', fiscalia: '', registros: sinCausa })
      }
      return result.sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))
    }

    // Fallback: agrupar por causa_rit desde registros
    const map = {}
    registros.forEach(r => {
      const key = r.causa_rit || 'sin_causa'
      if (!map[key]) {
        const ci = allCausas.find(c => c.rit === r.causa_rit)
        map[key] = { causa_rit: r.causa_rit || null, materia: ci?.materia || '', fiscalia: ci?.fiscalia || '', registros: [] }
      }
      map[key].registros.push(r)
    })
    return Object.values(map).sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))
  }, [registros, allCausas, clienteNombre])

  const urgentes   = registros.filter(r => r.estado === 'Urgente').length
  const pendientes = registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta' || r.estado === 'Urgente').length
  const respondidas = registros.filter(r => r.estado === 'Respondida').length

  return (
    <div
      onClick={() => onSelect(clienteNombre)}
      className="border border-gray-100 rounded-xl px-4 py-4 cursor-pointer hover:shadow-sm hover:border-gray-200 transition-all group bg-white"
    >
      <div className="flex items-start gap-3">
        <ChevronRight size={14} className="flex-shrink-0 mt-0.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <p className="text-[14px] font-semibold text-gray-900 leading-none">{clienteNombre}</p>
            {urgentes > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Urgente
              </span>
            )}
          </div>
          {/* Causa chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {porCausa.map(g => {
              const hasUrg  = g.registros.some(r => r.estado === 'Urgente')
              const hasPend = g.registros.some(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta')
              return (
                <span key={g.causa_rit || 'sin'}
                  className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-700"
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    hasUrg ? 'bg-red-400' : hasPend ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  {g.causa_rit
                    ? <span className="font-mono text-[10px] text-violet-700 font-semibold">{g.causa_rit}</span>
                    : <span className="text-gray-400 text-[10px]">sin RIT</span>}
                  {g.materia && (
                    <span className="text-gray-500 text-[10px] max-w-[140px] truncate">· {g.materia}</span>
                  )}
                  <span className="text-[10px] text-gray-400 font-medium">{g.registros.length} sol.</span>
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="text-[10px] text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded-full">
            {porCausa.length} causa{porCausa.length !== 1 ? 's' : ''}
          </span>
          {urgentes > 0 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{urgentes} urg.</span>}
          {pendientes > 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{pendientes} pend.</span>}
          {respondidas > 0 && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">{respondidas} resp.</span>}
        </div>
      </div>
    </div>
  )
}

// ── CausaBlockSIAU — bloque de una causa dentro del drawer ────────────────────
function CausaBlockSIAU({ causaRit, causaInfo, registros, defaultOpen, onUpdate, onAdd, clienteNombre, allCausas, onAddRegistro }) {
  const [open,     setOpen]     = useState(defaultOpen)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ fecha: TODAY, folio: '', solicitud: '', respuesta: '', documentos: '', estado: 'Pendiente', notas: '' })
  const [saving,   setSaving]   = useState(false)

  const counts = {
    total:       registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta' || r.estado === 'Urgente').length,
    respondidas: registros.filter(r => r.estado === 'Respondida').length,
    urgentes:    registros.filter(r => r.estado === 'Urgente').length,
  }

  const handleAdd = async () => {
    if (!form.folio.trim() || !form.fecha) return
    setSaving(true)
    const causa = allCausas.find(c => c.rit === causaRit)
    const payload = {
      fecha:          form.fecha,
      folio:          form.folio.trim(),
      solicitud:      form.solicitud.trim() || null,
      respuesta:      form.respuesta.trim() || null,
      documentos:     form.documentos.trim() || null,
      causa_rit:      causaRit || null,
      estado:         form.estado,
      notas:          form.notas || null,
      cliente_nombre: clienteNombre,
      causa_id:       causa?.id         || null,
      cliente_id:     causa?.cliente_id || null,
    }
    const { data, error } = await supabase.from('siau').insert([payload]).select().single()
    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      onAddRegistro(mapRow(data))
      setForm({ fecha: TODAY, folio: '', solicitud: '', respuesta: '', documentos: '', estado: 'Pendiente', notas: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      {/* Header de causa */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/70 hover:bg-gray-50 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          {open
            ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />}
          {causaRit ? (
            <span className="font-mono text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-semibold whitespace-nowrap">
              RIT {causaRit}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">Sin causa vinculada</span>
          )}
          {causaInfo?.ruc && (
            <span className="font-mono text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
              RUC {causaInfo.ruc}
            </span>
          )}
          {causaInfo?.materia && (
            <span className="text-[13px] font-semibold text-gray-800 truncate">{causaInfo.materia}</span>
          )}
          {causaInfo?.fiscalia && (
            <span className="text-[11px] text-gray-400 whitespace-nowrap">· Fiscalía {causaInfo.fiscalia}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {counts.urgentes > 0 && (
            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{counts.urgentes} urg.</span>
          )}
          {counts.pendientes > 0 && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{counts.pendientes} pend.</span>
          )}
          <span className="text-[11px] text-gray-400">{counts.total} sol.</span>
        </div>
      </button>

      {open && (
        <>
          {/* Cabecera de tabla */}
          <div
            className="grid px-5 py-2 bg-gray-50/40 border-t border-b border-gray-100 gap-2"
            style={{ gridTemplateColumns: '80px 100px 1fr 1fr 90px 1fr 28px' }}
          >
            {['Fecha','Folio','Solicitud','Respuesta','Documentos','Notas',''].map((h, i) => (
              <p key={i} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">{h}</p>
            ))}
          </div>

          {/* Registros */}
          <div>
            {registros.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <p className="text-[12px]">Sin solicitudes SIAU para esta causa</p>
              </div>
            ) : (
              registros.map((reg, i) => (
                <RegistroRow key={reg.id} reg={reg} index={i} onUpdate={onUpdate} />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <p className="text-[11px] text-gray-400">
              {counts.total} {counts.total === 1 ? 'solicitud' : 'solicitudes'} · {counts.respondidas} respondidas
            </p>
            <button
              onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} /> Nueva solicitud
            </button>
          </div>

          {/* Form nueva solicitud */}
          {showForm && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/20 space-y-3">
              <p className="text-[12px] font-semibold text-gray-700 flex items-center gap-1.5">
                <Plus size={11} className="text-[#1a2e4a]" /> Nueva solicitud
                {causaRit && <span className="font-mono text-[10px] text-violet-600">— {causaRit}</span>}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Fecha *</label>
                  <input type="date" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Folio SIAU *</label>
                  <input type="text" value={form.folio}
                    onChange={e => setForm(f => ({ ...f, folio: e.target.value }))}
                    placeholder="Ej: SIAU-2026-001"
                    className="w-full text-[12px] font-mono border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                    {Object.keys(ESTADO_CONFIG).map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Solicitud</label>
                <input type="text" value={form.solicitud}
                  onChange={e => setForm(f => ({ ...f, solicitud: e.target.value }))}
                  placeholder="Descripción de la solicitud..."
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Respuesta</label>
                  <input type="text" value={form.respuesta}
                    onChange={e => setForm(f => ({ ...f, respuesta: e.target.value }))}
                    placeholder="Respuesta recibida..."
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Documentos</label>
                  <input type="text" value={form.documentos}
                    onChange={e => setForm(f => ({ ...f, documentos: e.target.value }))}
                    placeholder="Documentos adjuntos..."
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleAdd} disabled={!form.folio.trim() || saving}
                  className="text-[11px] px-3 py-1.5 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] disabled:opacity-50 flex items-center gap-1.5">
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Guardar
                </button>
                <button onClick={() => setShowForm(false)}
                  className="text-[11px] px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── ClienteDrawer — panel completo de un cliente con todas sus causas ────────
function ClienteDrawer({ clienteNombre, registros, onClose, onUpdate, onAdd, allCausas }) {
  // Agrupar registros por causa
  // Fuente primaria: allCausas filtrado por cliente → muestra TODAS las causas, incluso las sin solicitudes
  const porCausa = useMemo(() => {
    const causasCliente = allCausas.filter(c => c.cliente_nombre === clienteNombre)

    // Asignar cada registro a una causa: primero por causa_id, luego por causa_rit
    const byId = {}
    const sinCausa = []
    registros.forEach(r => {
      let asignadaId = r.causa_id || null
      if (!asignadaId && r.causa_rit) {
        const ci = causasCliente.find(c => c.rit === r.causa_rit)
        if (ci) asignadaId = ci.id
      }
      if (asignadaId) {
        if (!byId[asignadaId]) byId[asignadaId] = []
        byId[asignadaId].push(r)
      } else {
        sinCausa.push(r)
      }
    })

    if (causasCliente.length > 0) {
      const result = causasCliente.map(ci => ({
        causa_rit: ci.rit || null,
        causaInfo: ci,
        registros: byId[ci.id] || [],
      }))
      if (sinCausa.length > 0) {
        result.push({ causa_rit: null, causaInfo: null, registros: sinCausa })
      }
      return result.sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))
    }

    // Fallback: agrupar por causa_rit desde registros
    const map = {}
    registros.forEach(r => {
      const key = r.causa_rit || 'sin_causa'
      if (!map[key]) {
        const ci = allCausas.find(c => c.rit === r.causa_rit)
        map[key] = { causa_rit: r.causa_rit || null, causaInfo: ci || null, registros: [] }
      }
      map[key].registros.push(r)
    })
    return Object.values(map).sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))
  }, [registros, allCausas, clienteNombre])

  const counts = {
    total:       registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta' || r.estado === 'Urgente').length,
    respondidas: registros.filter(r => r.estado === 'Respondida').length,
    urgentes:    registros.filter(r => r.estado === 'Urgente').length,
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="w-[8%] bg-black/25 backdrop-blur-[2px] cursor-pointer" onClick={onClose} />

      {/* Panel */}
      <div className="flex-1 bg-[#f8f9fb] flex flex-col shadow-2xl border-l border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">SIAU — Fiscalía de Chile</p>
            <h2 className="text-[18px] font-bold text-gray-900 leading-tight">{clienteNombre}</h2>
            <p className="text-[12px] text-gray-400 mt-1">
              {porCausa.length} causa{porCausa.length !== 1 ? 's' : ''} · {registros.length} solicitudes totales
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href="https://www.siau.fiscaliadechile.cl/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-3 py-1.5 rounded-lg transition-colors">
              <Gavel size={12} /> Abrir SIAU <ExternalLink size={10} className="opacity-60" />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats globales */}
        <div className="flex items-center gap-5 px-6 py-2.5 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</span>
            <span className="text-[14px] font-bold text-gray-800 tabular-nums">{counts.total}</span>
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
          {counts.urgentes > 0 && (
            <>
              <span className="text-gray-200">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Urgentes</span>
                <span className="text-[14px] font-bold text-red-700 tabular-nums">{counts.urgentes}</span>
              </div>
            </>
          )}
        </div>

        {/* Bloques por causa */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {porCausa.map((grupo, i) => (
            <CausaBlockSIAU
              key={grupo.causa_rit || 'sin'}
              causaRit={grupo.causa_rit}
              causaInfo={grupo.causaInfo}
              registros={grupo.registros}
              defaultOpen={porCausa.length === 1 || i === 0}
              onUpdate={onUpdate}
              onAddRegistro={onAdd}
              clienteNombre={clienteNombre}
              allCausas={allCausas}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main SIAU ──────────────────────────────────────────────────────────────────
export default function SIAU() {
  const [registros,      setRegistros]      = useState([])
  const [allCausas,      setAllCausas]      = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [error,          setError]          = useState(null)
  const [search,         setSearch]         = useState('')
  const [filterEstado,   setFilterEstado]   = useState('Todos')
  const [filterCliente,  setFilterCliente]  = useState('Todos')
  const [selectedCliente, setSelectedCliente] = useState(null)

  const fetchRegistros = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('siau')
      .select('*')
      .order('fecha', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setRegistros((data || []).map(mapRow))
    }
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id, rit, ruc, materia, fiscalia, tribunal, cliente_nombre, cliente_id')
      .order('rit')
    setAllCausas(data || [])
  }, [])

  useEffect(() => {
    fetchRegistros()
    fetchCausas()
  }, [fetchRegistros, fetchCausas])

  // Update a record
  const handleUpdate = useCallback(async (id, cambios) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(Object.entries(cambios).filter(([k]) => DB_FIELDS.has(k)))
    if (Object.keys(dbCambios).length === 0) return
    const { error: err } = await supabase.from('siau').update(dbCambios).eq('id', id)
    if (err) console.error('Error actualizando SIAU:', err.message)
  }, [])

  // Add a new record (already inserted, just update local state)
  const handleAdd = useCallback((newReg) => {
    setRegistros(prev => [newReg, ...prev])
  }, [])

  // Stats
  const stats = useMemo(() => ({
    total:        registros.length,
    pendientes:   registros.filter(r => r.estado === 'Pendiente' || r.estado === 'Sin respuesta').length,
    respondidas:  registros.filter(r => r.estado === 'Respondida').length,
    urgentes:     registros.filter(r => r.estado === 'Urgente').length,
    noHaLugar:    registros.filter(r => r.estado === 'No ha lugar').length,
  }), [registros])

  // Filter and group by cliente
  const filteredAndGrouped = useMemo(() => {
    let r = registros
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(reg =>
        (reg.folio          || '').toLowerCase().includes(q) ||
        (reg.cliente_nombre || '').toLowerCase().includes(q) ||
        (reg.causa_rit      || '').toLowerCase().includes(q) ||
        (reg.notas          || '').toLowerCase().includes(q)
      )
    }
    if (filterEstado !== 'Todos') r = r.filter(reg => reg.estado === filterEstado)
    if (filterCliente !== 'Todos') r = r.filter(reg => reg.cliente_nombre === filterCliente)

    // Group by cliente_nombre
    const grupos = {}
    r.forEach(reg => {
      const key = reg.cliente_nombre || '(sin cliente)'
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(reg)
    })

    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [registros, search, filterEstado, filterCliente])

  const clientes = useMemo(() =>
    [...new Set(registros.map(r => r.cliente_nombre).filter(Boolean))].sort(),
    [registros]
  )

  const hasFilters = search || filterEstado !== 'Todos' || filterCliente !== 'Todos'

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">SIAU</h1>
            <p className="text-[12px] text-gray-400 mt-1">
              {cargando ? 'Cargando...' : `Fiscalía de Chile · ${clientes.length} clientes · ${registros.length} solicitudes`}
            </p>
          </div>
          <a href="https://www.siau.fiscaliadechile.cl/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 border border-[#1a2e4a]/20 text-[#1a2e4a] text-[13px] font-medium rounded-lg hover:bg-[#1a2e4a]/5 hover:border-[#1a2e4a]/40 transition-colors">
            <Gavel size={14} />
            Portal SIAU
            <ExternalLink size={11} className="opacity-60" />
          </a>
        </div>
      </div>

      {/* Stats */}
      {!cargando && !error && (
        <div className="flex-shrink-0 px-6 pb-3 grid grid-cols-5 gap-2">
          <StatCard label="Total solicitudes"  value={stats.total}       iconBg="bg-gray-50"   iconColor="text-gray-500"   icon={FileText}     />
          <StatCard label="Pendientes"          value={stats.pendientes}  iconBg="bg-amber-50"  iconColor="text-amber-500"  icon={Clock}        />
          <StatCard label="Respondidas"         value={stats.respondidas} iconBg="bg-green-50"  iconColor="text-green-500"  icon={CheckCircle2} />
          <StatCard label="Urgentes"            value={stats.urgentes}    iconBg="bg-red-50"    iconColor="text-red-500"    icon={AlertCircle}  />
          <StatCard label="No ha lugar"         value={stats.noHaLugar}   iconBg="bg-slate-50"  iconColor="text-slate-500"  icon={MinusCircle}  />
        </div>
      )}

      {/* Error */}
      {error && <ErrorBanner mensaje={`Error al cargar: ${error}`} onRetry={fetchRegistros} />}

      {/* Loading */}
      {cargando && (
        <div className="flex items-center justify-center py-20 text-gray-300">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* Filters */}
          <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar folio, cliente, causa, notas..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
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

            <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-blue-400 cursor-pointer">
              <option value="Todos">Todos los clientes</option>
              {clientes.map(c => <option key={c} value={c}>{c.split(' ').slice(0,2).join(' ')}</option>)}
            </select>

            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFilterEstado('Todos'); setFilterCliente('Todos') }}
                className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                <X size={11} /> Limpiar
              </button>
            )}
          </div>

          {/* Lista de clientes */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
            {filteredAndGrouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Gavel size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
                <p className="text-[13px]">No se encontraron registros con los filtros actuales</p>
              </div>
            ) : (
              filteredAndGrouped.map(([cliente, regs]) => (
                <ClienteCard
                  key={cliente}
                  clienteNombre={cliente}
                  registros={regs}
                  allCausas={allCausas}
                  onSelect={setSelectedCliente}
                />
              ))
            )}
          </div>
        </>
      )}

      {selectedCliente && (() => {
        const regsCliente = registros.filter(r => r.cliente_nombre === selectedCliente)
        return (
          <ClienteDrawer
            clienteNombre={selectedCliente}
            registros={regsCliente}
            onClose={() => setSelectedCliente(null)}
            onUpdate={handleUpdate}
            onAdd={reg => { handleAdd(reg) }}
            allCausas={allCausas}
          />
        )
      })()}
    </div>
  )
}
