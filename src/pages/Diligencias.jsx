import { useState, useEffect, useMemo } from 'react'
import { Inbox, Plus, X, Search, Scale } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── helpers ───────────────────────────────────────────────────────────────────
const ESTADOS = ['Recibida', 'Solicitada', 'No recibida']

const ESTADO_CLS = {
  'Recibida':    'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Solicitada':  'bg-amber-50 text-amber-700 border-amber-200',
  'No recibida': 'bg-red-50 text-red-600 border-red-200',
}

function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── inline-edit components ────────────────────────────────────────────────────
function IText({ rowId, field, value, placeholder = '—', multi = false, ec, setEc, draft, setDraft, commit }) {
  const active = ec?.id === rowId && ec?.field === field
  if (active) {
    const p = {
      autoFocus: true,
      value: draft,
      onChange: e => setDraft(e.target.value),
      onFocus: e => e.target.select(),
      onBlur: () => commit(rowId, field, draft),
      onKeyDown: e => {
        if (!multi && e.key === 'Enter') { e.preventDefault(); commit(rowId, field, draft) }
        if (e.key === 'Escape') setEc(null)
      },
      className: 'w-full text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none text-gray-700',
    }
    return multi ? <textarea rows={3} {...p} /> : <input {...p} />
  }
  return (
    <span
      onClick={() => { setEc({ id: rowId, field }); setDraft(value ?? '') }}
      className={`cursor-text text-xs rounded px-0.5 ${value ? 'text-gray-700' : 'text-gray-300 italic'} hover:bg-gray-50`}
    >
      {value || placeholder}
    </span>
  )
}

function ISel({ rowId, field, value, ec, setEc, draft, setDraft, commit }) {
  const active = ec?.id === rowId && ec?.field === field
  if (active) {
    return (
      <select
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(rowId, field, draft)}
        className="text-xs bg-white border border-blue-300 rounded px-1 py-0.5 outline-none"
      >
        {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )
  }
  return (
    <span
      onClick={() => { setEc({ id: rowId, field }); setDraft(value ?? 'Solicitada') }}
      className={`cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${ESTADO_CLS[value] || 'bg-gray-50 text-gray-500 border-gray-200'}`}
    >
      {value || 'Sin estado'}
    </span>
  )
}

function IDate({ rowId, field, value, placeholder = '—', ec, setEc, draft, setDraft, commit }) {
  const active = ec?.id === rowId && ec?.field === field
  if (active) {
    return (
      <input
        autoFocus
        type="date"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(rowId, field, draft)}
        onKeyDown={e => { if (e.key === 'Escape') setEc(null) }}
        className="text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none"
      />
    )
  }
  return (
    <span
      onClick={() => { setEc({ id: rowId, field }); setDraft(value ?? '') }}
      className={`cursor-text text-xs rounded px-0.5 ${value ? 'text-gray-700' : 'text-gray-300 italic'} hover:bg-gray-50`}
    >
      {value ? fmt(value) : placeholder}
    </span>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Diligencias() {
  const [rows,      setRows]      = useState([])
  const [causas,    setCausas]    = useState([])
  const [loading,   setLoading]   = useState(true)

  // filters
  const [fEstado,   setFEstado]   = useState('todas')
  const [fCausaId,  setFCausaId]  = useState('')
  const [fOrg,      setFOrg]      = useState('')

  // expand / inline edit
  const [expId,     setExpId]     = useState(null)
  const [ec,        setEc]        = useState(null)
  const [draft,     setDraft]     = useState('')

  // new-diligencia modal
  const [newModal,  setNewModal]  = useState(false)
  const [newCausaId,setNewCausaId]= useState('')
  const [causaQ,    setCausaQ]    = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase
        .from('diligencias')
        .select('*, causas(id, ruc, rit, materia, cliente_nombre)')
        .order('created_at', { ascending: false }),
      supabase
        .from('causas')
        .select('id, ruc, rit, materia, cliente_nombre')
        .order('cliente_nombre'),
    ]).then(([{ data: dils }, { data: cs }]) => {
      setRows(dils || [])
      setCausas(cs || [])
      setLoading(false)
    })
  }, [])

  const baseFiltered = useMemo(() =>
    rows.filter(r =>
      (!fCausaId || r.causa_id === fCausaId) &&
      (!fOrg || (r.organismo || '').toLowerCase().includes(fOrg.toLowerCase()))
    ),
    [rows, fCausaId, fOrg]
  )

  const filtered = useMemo(() => {
    if (fEstado === 'todas') return baseFiltered
    const map = { solicitadas: 'Solicitada', recibidas: 'Recibida', no_recibidas: 'No recibida' }
    return baseFiltered.filter(r => r.estado === map[fEstado])
  }, [baseFiltered, fEstado])

  const counts = useMemo(() => ({
    todas:       baseFiltered.length,
    solicitadas: baseFiltered.filter(r => r.estado === 'Solicitada').length,
    recibidas:   baseFiltered.filter(r => r.estado === 'Recibida').length,
    no_recibidas:baseFiltered.filter(r => r.estado === 'No recibida').length,
  }), [baseFiltered])

  async function commitField(id, field, value) {
    setEc(null)
    const v = typeof value === 'string' ? (value.trim() || null) : value
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: v } : r))
    await supabase.from('diligencias').update({ [field]: v }).eq('id', id)
  }

  const causasFiltradas = useMemo(() => {
    if (!causaQ) return causas
    const q = causaQ.toLowerCase()
    return causas.filter(c =>
      (c.ruc || '').toLowerCase().includes(q) ||
      (c.rit || '').toLowerCase().includes(q) ||
      (c.materia || '').toLowerCase().includes(q) ||
      (c.cliente_nombre || '').toLowerCase().includes(q)
    )
  }, [causas, causaQ])

  async function handleCreate() {
    if (!newCausaId) return
    const blank = {
      causa_id: newCausaId,
      nombre: 'Nueva diligencia',
      organismo: null, instruccion: null,
      estado: 'Solicitada',
      fecha_solicitud: null, fecha_recepcion: null,
      folio: null, notas: null,
    }
    const { data, error } = await supabase
      .from('diligencias')
      .insert(blank)
      .select('*, causas(id, ruc, rit, materia, cliente_nombre)')
      .single()
    if (!error && data) {
      setRows(prev => [data, ...prev])
      setExpId(data.id)
      setEc({ id: data.id, field: 'nombre' })
      setDraft('Nueva diligencia')
      setNewModal(false)
      setNewCausaId('')
      setCausaQ('')
      setFEstado('todas')
      setFCausaId('')
      setFOrg('')
    }
  }

  const ep = { ec, setEc, draft, setDraft, commit: commitField }

  const FILTER_TABS = [
    { key: 'todas',       label: 'Todas'       },
    { key: 'solicitadas', label: 'Solicitadas' },
    { key: 'recibidas',   label: 'Recibidas'   },
    { key: 'no_recibidas',label: 'No recibidas'},
  ]

  function causaLabel(c) {
    if (!c) return '—'
    return c.ruc || c.rit || c.materia || c.cliente_nombre || '—'
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Inbox size={18} className="text-[#2570BA]" />
            <h1 className="text-[17px] font-bold text-[#1A2E4A]">Diligencias</h1>
            <span className="text-[11px] text-gray-400 tabular-nums">{rows.length} total</span>
          </div>
          <button
            onClick={() => setNewModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1A2E4A] text-white text-[11px] font-semibold rounded-lg hover:opacity-80 transition-opacity"
          >
            <Plus size={12} /> Nueva
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {FILTER_TABS.map(f => (
              <button key={f.key} onClick={() => setFEstado(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  fEstado === f.key ? 'bg-[#1A2E4A] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {f.label} <span className="opacity-60 tabular-nums">({counts[f.key]})</span>
              </button>
            ))}
          </div>

          {/* Causa filter */}
          <select
            value={fCausaId}
            onChange={e => setFCausaId(e.target.value)}
            className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none hover:border-gray-300 max-w-[200px]"
          >
            <option value="">Todas las causas</option>
            {causas.map(c => (
              <option key={c.id} value={c.id}>
                {c.ruc || c.rit || c.materia || c.cliente_nombre || c.id}
              </option>
            ))}
          </select>

          {/* Organismo filter */}
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              value={fOrg}
              onChange={e => setFOrg(e.target.value)}
              placeholder="Organismo…"
              className="text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg pl-6 pr-6 py-1 outline-none hover:border-gray-300 w-32 focus:w-44 transition-all"
            />
            {fOrg && (
              <button onClick={() => setFOrg('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Column headers */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-[1fr_120px_92px_88px_88px_1fr] gap-3 px-6 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          {['Nombre', 'Organismo', 'Estado', 'Solicitada', 'Recibida', 'Causa'].map(h => (
            <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[#2570BA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <Inbox size={32} className="text-gray-200 mb-3" />
            <p className="text-[14px] text-gray-400 font-medium">Sin diligencias</p>
            <p className="text-[12px] text-gray-400 mt-1">
              Registra OIs y diligencias desde la ficha de cada causa o usa el botón Nueva
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(dil => {
              const isExp = expId === dil.id
              const causa = dil.causas
              const alertDays = dil.estado === 'Solicitada' && dil.fecha_solicitud &&
                Math.round((Date.now() - new Date(dil.fecha_solicitud + 'T00:00:00').getTime()) / 86400000) > 60
                ? Math.round((Date.now() - new Date(dil.fecha_solicitud + 'T00:00:00').getTime()) / 86400000)
                : null

              return (
                <div key={dil.id} className={`border-b border-gray-100 transition-colors ${isExp ? 'bg-gray-50/60 border-l-2 border-[#2570BA]' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}>
                  {/* Row */}
                  <div
                    className="grid grid-cols-[1fr_120px_92px_88px_88px_1fr] gap-3 px-6 py-3 cursor-pointer select-none items-center"
                    onClick={() => setExpId(isExp ? null : dil.id)}
                  >
                    <span
                      className="text-[12px] font-semibold text-gray-800 truncate"
                      onClick={e => e.stopPropagation()}
                      onDoubleClick={e => {
                        e.stopPropagation()
                        setExpId(dil.id)
                        setEc({ id: dil.id, field: 'nombre' })
                        setDraft(dil.nombre ?? '')
                      }}
                    >
                      {dil.nombre || '—'}
                    </span>
                    <span className="text-[11px] text-gray-500 truncate">{dil.organismo || '—'}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${ESTADO_CLS[dil.estado] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {dil.estado || '—'}
                      </span>
                      {alertDays && (
                        <span className="text-[9px] text-amber-600 font-bold tabular-nums">{alertDays}d</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 tabular-nums">{fmt(dil.fecha_solicitud)}</span>
                    <span className="text-[11px] text-gray-500 tabular-nums">{fmt(dil.fecha_recepcion)}</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <Scale size={10} className="text-gray-300 flex-shrink-0" />
                      <span className="text-[11px] text-gray-500 truncate">{causaLabel(causa)}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div className="ml-6 mr-5 mb-4 border-l-2 border-[#2570BA] pl-4 bg-white rounded-r-lg shadow-sm">
                      <div className="pt-3 pb-2">
                        {/* Nombre editable */}
                        <div className="mb-3 text-[13px] font-semibold text-gray-800">
                          <IText rowId={dil.id} field="nombre" value={dil.nombre} placeholder="Nombre de la diligencia" {...ep} />
                        </div>

                        {/* 2-col grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Organismo</span>
                            <IText rowId={dil.id} field="organismo" value={dil.organismo} {...ep} />
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Instrucción</span>
                            <IText rowId={dil.id} field="instruccion" value={dil.instruccion} {...ep} />
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Solicitada</span>
                            <IDate rowId={dil.id} field="fecha_solicitud" value={dil.fecha_solicitud} {...ep} />
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Estado</span>
                            <ISel rowId={dil.id} field="estado" value={dil.estado} {...ep} />
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Recepción</span>
                            <IDate rowId={dil.id} field="fecha_recepcion" value={dil.fecha_recepcion} {...ep} />
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium block mb-0.5">Folio</span>
                            <IText rowId={dil.id} field="folio" value={dil.folio} {...ep} />
                          </div>
                        </div>

                        {/* Notas */}
                        <div className="border-t border-dashed border-gray-200 my-3" />
                        <div>
                          <span className="text-gray-400 font-medium text-[11px] block mb-1">Notas</span>
                          <IText rowId={dil.id} field="notas" value={dil.notas} placeholder="Agregar notas…" multi {...ep} />
                        </div>

                        {/* Causa reference */}
                        <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                          <Scale size={10} className="text-gray-300 flex-shrink-0" />
                          <span className="text-[11px] text-gray-500">
                            {causaLabel(causa)}
                            {causa?.cliente_nombre && causa?.ruc && ` · ${causa.cliente_nombre}`}
                          </span>
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

      {/* New diligencia modal */}
      {newModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => { setNewModal(false); setNewCausaId(''); setCausaQ('') }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-5 w-[420px] max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-bold text-[#1A2E4A]">Nueva diligencia</h2>
              <button
                onClick={() => { setNewModal(false); setNewCausaId(''); setCausaQ('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <label className="text-[11px] font-semibold text-gray-500 block mb-1.5">
              Causa <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={causaQ}
              onChange={e => setCausaQ(e.target.value)}
              placeholder="Buscar por RUC, RIT, materia o cliente…"
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#2570BA] mb-2"
            />
            <div className="flex-1 min-h-0 max-h-60 overflow-y-auto border border-gray-100 rounded-lg mb-4">
              {causasFiltradas.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">Sin resultados</p>
              ) : (
                causasFiltradas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setNewCausaId(c.id)}
                    className={`w-full text-left px-3 py-2 text-[11px] border-b border-gray-50 last:border-b-0 transition-colors ${
                      newCausaId === c.id
                        ? 'bg-blue-50 text-[#2570BA] font-semibold'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">{c.ruc || c.rit || '—'}</span>
                    {c.materia && <span className="text-gray-400 ml-2 text-[10px]">{c.materia}</span>}
                    {c.cliente_nombre && (
                      <span className="text-gray-400 block text-[10px] mt-0.5">{c.cliente_nombre}</span>
                    )}
                  </button>
                ))
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={!newCausaId}
              className="w-full py-2 bg-[#1A2E4A] text-white text-[12px] font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Crear diligencia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
