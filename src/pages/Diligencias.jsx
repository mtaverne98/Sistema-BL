import { useState, useEffect, useMemo, useCallback } from 'react'
import { Inbox, Plus, X, Search, Loader2, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── constants ─────────────────────────────────────────────────────────────────
const ESTADOS = ['Solicitada', 'En curso', 'Recibida', 'No recibida']

const ESTADO_CLS = {
  'Solicitada':   'bg-amber-50 text-amber-700 border-amber-200',
  'En curso':     'bg-orange-50 text-orange-700 border-orange-200',
  'Recibida':     'bg-emerald-50 text-emerald-700 border-emerald-200',
  'No recibida':  'bg-red-50 text-red-600 border-red-200',
}

function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── inline-edit components ────────────────────────────────────────────────────
function IText({ rowId, field, value, placeholder = '—', multi = false, ec, setEc, commit }) {
  const active = ec?.id === rowId && ec?.field === field
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { if (!active) setDraft(value ?? '') }, [value, active])

  if (active) {
    const p = {
      autoFocus: true, value: draft,
      onChange: e => setDraft(e.target.value),
      onFocus: e => e.target.select(),
      onBlur: () => commit(rowId, field, draft),
      onKeyDown: e => {
        if (!multi && e.key === 'Enter') { e.preventDefault(); commit(rowId, field, draft) }
        if (e.key === 'Escape') { setDraft(value ?? ''); setEc(null) }
      },
      className: 'w-full text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none text-gray-700',
    }
    return multi ? <textarea rows={3} {...p} /> : <input {...p} />
  }
  return (
    <span onClick={() => setEc({ id: rowId, field })}
      className={`cursor-text text-xs rounded px-0.5 ${value ? 'text-gray-700' : 'text-gray-300 italic'} hover:bg-gray-50`}>
      {value || placeholder}
    </span>
  )
}

function ISel({ rowId, field, value, ec, setEc, commit }) {
  const active = ec?.id === rowId && ec?.field === field
  const [draft, setDraft] = useState(value ?? 'Solicitada')
  useEffect(() => { if (!active) setDraft(value ?? 'Solicitada') }, [value, active])

  if (active) {
    return (
      <select autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(rowId, field, draft)}
        className="text-xs bg-white border border-blue-300 rounded px-1 py-0.5 outline-none">
        {ESTADOS.map(s => <option key={s}>{s}</option>)}
      </select>
    )
  }
  return (
    <span onClick={() => setEc({ id: rowId, field })}
      className={`cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${ESTADO_CLS[value] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {value || '—'}
    </span>
  )
}

function IDate({ rowId, field, value, ec, setEc, commit }) {
  const active = ec?.id === rowId && ec?.field === field
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { if (!active) setDraft(value ?? '') }, [value, active])

  if (active) {
    return (
      <input autoFocus type="date" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(rowId, field, draft)}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value ?? ''); setEc(null) } }}
        className="text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none" />
    )
  }
  return (
    <span onClick={() => setEc({ id: rowId, field })}
      className={`cursor-text text-xs rounded px-0.5 ${value ? 'text-gray-700' : 'text-gray-300 italic'} hover:bg-gray-50`}>
      {value ? fmt(value) : '—'}
    </span>
  )
}

// ── Modal: nueva diligencia ───────────────────────────────────────────────────
function ModalNueva({ causas, onSave, onClose }) {
  const [causaId, setCausaId] = useState('')
  const [q,       setQ]       = useState('')
  const [saving,  setSaving]  = useState(false)

  const lista = useMemo(() => {
    if (!q) return causas
    const lq = q.toLowerCase()
    return causas.filter(c =>
      (c.ruc || '').toLowerCase().includes(lq) ||
      (c.rit || '').toLowerCase().includes(lq) ||
      (c.materia || '').toLowerCase().includes(lq) ||
      (c.cliente_nombre || '').toLowerCase().includes(lq)
    )
  }, [causas, q])

  async function handleCreate() {
    if (!causaId) return
    setSaving(true)
    const { data, error } = await supabase.from('diligencias')
      .insert({ causa_id: causaId, nombre: 'Nueva diligencia', estado: 'Solicitada' })
      .select('*, causas(id,ruc,rit,materia,cliente_nombre)')
      .single()
    setSaving(false)
    if (!error && data) onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-5 w-[420px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-[#1A2E4A]">Nueva diligencia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
        <label className="text-[11px] font-semibold text-gray-500 block mb-1.5">Causa <span className="text-red-400">*</span></label>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por RUC, RIT, materia o cliente…"
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#2570BA] mb-2"/>
        <div className="flex-1 min-h-0 max-h-56 overflow-y-auto border border-gray-100 rounded-lg mb-4">
          {lista.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-4">Sin resultados</p>
          ) : lista.map(c => (
            <button key={c.id} onClick={() => setCausaId(c.id)}
              className={`w-full text-left px-3 py-2 text-[11px] border-b border-gray-50 last:border-b-0 transition-colors ${causaId === c.id ? 'bg-blue-50 text-[#2570BA] font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
              <span className="font-medium">{c.ruc || c.rit || '—'}</span>
              {c.materia && <span className="text-gray-400 ml-2 text-[10px]">{c.materia}</span>}
              {c.cliente_nombre && <span className="text-gray-400 block text-[10px] mt-0.5">{c.cliente_nombre}</span>}
            </button>
          ))}
        </div>
        <button onClick={handleCreate} disabled={!causaId || saving}
          className="w-full py-2 bg-[#1A2E4A] text-white text-[12px] font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
          {saving ? 'Guardando…' : 'Crear diligencia'}
        </button>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Diligencias() {
  const [rows,     setRows]     = useState([])
  const [causas,   setCausas]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [fEstado,  setFEstado]  = useState('todas')
  const [fCausaId, setFCausaId] = useState('')
  const [fOrg,     setFOrg]     = useState('')

  const [expId, setExpId] = useState(null)
  const [ec,    setEc]    = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('diligencias')
        .select('*, causas(id,ruc,rit,materia,cliente_nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('causas')
        .select('id,ruc,rit,materia,cliente_nombre')
        .order('cliente_nombre'),
    ]).then(([{ data: rs }, { data: cs }]) => {
      setRows(rs || [])
      setCausas(cs || [])
      setLoading(false)
    })
  }, [])

  // ── Commit field ──────────────────────────────────────────────────────────
  const commit = useCallback(async (id, field, value) => {
    setEc(null)
    const v = typeof value === 'string' ? (value.trim() || null) : value
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: v } : r))
    await supabase.from('diligencias').update({ [field]: v }).eq('id', id)
  }, [])

  const ep = { ec, setEc, commit }

  // ── Counts for filter tabs ────────────────────────────────────────────────
  const counts = useMemo(() => ({
    todas:        rows.length,
    solicitadas:  rows.filter(r => r.estado === 'Solicitada').length,
    recibidas:    rows.filter(r => r.estado === 'Recibida').length,
    no_recibidas: rows.filter(r => r.estado === 'No recibida').length,
  }), [rows])

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const ESTADO_MAP = { solicitadas: 'Solicitada', recibidas: 'Recibida', no_recibidas: 'No recibida' }
    return rows.filter(r => {
      if (fEstado !== 'todas' && r.estado !== ESTADO_MAP[fEstado]) return false
      if (fCausaId && r.causa_id !== fCausaId) return false
      if (fOrg && !(r.organismo || '').toLowerCase().includes(fOrg.toLowerCase())) return false
      return true
    })
  }, [rows, fEstado, fCausaId, fOrg])

  // ── Causa selector options ────────────────────────────────────────────────
  const causasConDil = useMemo(() => {
    const ids = new Set(rows.map(r => r.causa_id).filter(Boolean))
    return causas.filter(c => ids.has(c.id))
  }, [causas, rows])

  function handleSave(data) {
    setRows(prev => [data, ...prev])
    setShowModal(false)
    setExpId(data.id)
    setEc({ id: data.id, field: 'nombre' })
  }

  const FILTER_TABS = [
    { key: 'todas',        label: 'Todas'        },
    { key: 'solicitadas',  label: 'Solicitadas'  },
    { key: 'recibidas',    label: 'Recibidas'    },
    { key: 'no_recibidas', label: 'No recibidas' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Inbox size={18} className="text-[#2570BA]"/>
            <h1 className="text-lg font-bold text-[#1a2e4a]">Diligencias</h1>
            <span className="text-[11px] text-gray-400 tabular-nums">{rows.length} total</span>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-4 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
            <Plus size={14}/> Nueva diligencia
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Estado tabs */}
          <div className="flex items-center gap-1">
            {FILTER_TABS.map(f => (
              <button key={f.key} onClick={() => setFEstado(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${fEstado === f.key ? 'bg-[#1A2E4A] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {f.label} <span className="opacity-60 tabular-nums">({counts[f.key]})</span>
              </button>
            ))}
          </div>

          {/* Causa dropdown */}
          <div className="relative">
            <select value={fCausaId} onChange={e => setFCausaId(e.target.value)}
              className="appearance-none text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-1 outline-none hover:border-gray-300 max-w-[200px] truncate cursor-pointer">
              <option value="">Todas las causas</option>
              {causasConDil.map(c => (
                <option key={c.id} value={c.id}>
                  {c.ruc || c.rit} — {c.cliente_nombre}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>

          {/* Organismo search */}
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"/>
            <input value={fOrg} onChange={e => setFOrg(e.target.value)} placeholder="Organismo…"
              className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg pl-6 pr-6 py-1 outline-none hover:border-gray-300 w-32 focus:w-44 transition-all"/>
            {fOrg && <button onClick={() => setFOrg('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={10}/></button>}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Inbox size={32} className="text-gray-200 mb-3"/>
            <p className="text-[14px] text-gray-400">
              {rows.length === 0 ? 'Sin diligencias registradas' : 'Sin resultados con ese filtro'}
            </p>
          </div>
        ) : (
          <div className="min-w-[700px]">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_160px_110px_90px_90px_130px] gap-3 px-6 py-2.5 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
              {['Nombre', 'Organismo', 'Estado', 'Solicitada', 'Recibida', 'Causa'].map(h => (
                <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
              ))}
            </div>

            {filtered.map(dil => {
              const isExp = expId === dil.id
              const causa = dil.causas
              const alertDays = dil.estado === 'Solicitada' && dil.fecha_solicitud &&
                Math.round((Date.now() - new Date(dil.fecha_solicitud + 'T00:00:00').getTime()) / 86400000) > 60
                ? Math.round((Date.now() - new Date(dil.fecha_solicitud + 'T00:00:00').getTime()) / 86400000)
                : null

              return (
                <div key={dil.id}
                  className={`border-b border-gray-100 ${isExp ? 'bg-white border-l-2 border-[#2570BA]' : 'hover:bg-gray-50/60 border-l-2 border-transparent'}`}>
                  {/* Row */}
                  <div className="grid grid-cols-[1fr_160px_110px_90px_90px_130px] gap-3 px-6 py-3 cursor-pointer select-none items-center"
                    onClick={() => setExpId(isExp ? null : dil.id)}>
                    <span className="text-[13px] font-semibold text-gray-800 truncate"
                      onDoubleClick={e => { e.stopPropagation(); setExpId(dil.id); setEc({ id: dil.id, field: 'nombre' }) }}>
                      {dil.nombre || '—'}
                    </span>
                    <span className="text-[11px] text-gray-500 truncate">{dil.organismo || '—'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${ESTADO_CLS[dil.estado] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {dil.estado || '—'}
                      </span>
                      {alertDays && <span className="text-[9px] text-amber-600 font-bold tabular-nums">{alertDays}d</span>}
                    </div>
                    <span className="text-[11px] text-gray-500 tabular-nums">{fmt(dil.fecha_solicitud)}</span>
                    <span className="text-[11px] text-gray-500 tabular-nums">{fmt(dil.fecha_recepcion)}</span>
                    <span className="text-[10px] font-mono text-gray-400 truncate">{causa?.ruc || causa?.rit || '—'}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div className="ml-6 mr-5 mb-4 border-l-2 border-[#2570BA] pl-4 bg-white rounded-r-lg shadow-sm">
                      <div className="pt-3 pb-2">
                        <div className="mb-3 text-[13px] font-semibold text-gray-800">
                          <IText rowId={dil.id} field="nombre" value={dil.nombre} placeholder="Nombre de la diligencia" {...ep}/>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Organismo</span>
                            <IText rowId={dil.id} field="organismo" value={dil.organismo} {...ep}/>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Instrucción</span>
                            <IText rowId={dil.id} field="instruccion" value={dil.instruccion} {...ep}/>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Solicitada</span>
                            <IDate rowId={dil.id} field="fecha_solicitud" value={dil.fecha_solicitud} {...ep}/>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Estado</span>
                            <ISel rowId={dil.id} field="estado" value={dil.estado} {...ep}/>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Recepción</span>
                            <IDate rowId={dil.id} field="fecha_recepcion" value={dil.fecha_recepcion} {...ep}/>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Folio</span>
                            <IText rowId={dil.id} field="folio" value={dil.folio} {...ep}/>
                          </div>
                          {causa && (
                            <div className="col-span-2">
                              <span className="text-gray-400 font-medium block mb-0.5">Causa</span>
                              <span className="text-[11px] text-gray-600">{causa.ruc || causa.rit} — {causa.cliente_nombre}</span>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-dashed border-gray-200 my-3"/>
                        <div>
                          <span className="text-gray-400 font-medium text-[11px] block mb-1">Notas</span>
                          <IText rowId={dil.id} field="notas" value={dil.notas} placeholder="Agregar notas…" multi {...ep}/>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ModalNueva causas={causas} onSave={handleSave} onClose={() => setShowModal(false)}/>
      )}
    </div>
  )
}
