// Diligencias — Vista C: módulo global, dos columnas
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { Inbox, Clock, User, Phone, AlertTriangle, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constantes ─────────────────────────────────────────────────────────────────
const CICLO   = ['Despachada', 'Recibida', 'Endosada', 'En gestión', 'Cumplida']
const VIA_GES = ['Llamada', 'SIAU', 'Correo', 'Pide-cuenta']

const ESTADO_CFG = {
  'Por contactar': { chip: 'bg-amber-50 text-amber-700 border-amber-200',       border: '#C8862B' },
  'Endosada':      { chip: 'bg-orange-50 text-orange-600 border-orange-200',     border: '#E07A2F' },
  'En gestión':    { chip: 'bg-blue-50 text-blue-700 border-blue-200',          border: '#2570BA' },
  'Parcial':       { chip: 'bg-purple-50 text-purple-700 border-purple-200',     border: '#8E7CC3' },
  'Sin resultado': { chip: 'bg-red-50 text-red-600 border-red-200',             border: '#C0392B' },
  'Cumplida':      { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',  border: '#1E9E6A' },
  'Vencida':       { chip: 'bg-red-50 text-red-700 border-red-300',             border: '#C0392B' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function diasDesde(iso) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000))
}

function calcCiclo(dil) {
  const e = dil.estado || 'Por contactar'
  const vencida = e === 'Vencida'
  const done = [
    true,
    e !== 'Por contactar',
    !!dil.funcionario,
    ['En gestión', 'Parcial', 'Sin resultado', 'Cumplida'].includes(e),
    e === 'Cumplida',
  ]
  let activeIdx = done.findIndex(v => !v)
  if (activeIdx === -1) activeIdx = 5
  return { done, activeIdx, vencida }
}

// ── Ciclo inline (texto) ───────────────────────────────────────────────────────
function CicloInline({ dil }) {
  const { activeIdx, vencida } = calcCiclo(dil)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {CICLO.map((label, i) => {
        const isDone   = i < activeIdx
        const isActive = i === activeIdx
        const getLabel = () => {
          if (i === 2 && isActive && vencida && !dil.funcionario) return 'Sin endosar'
          return label
        }
        return (
          <Fragment key={i}>
            <span className={`text-[10px] font-medium ${
              isDone   ? 'text-[#1E9E6A]' :
              isActive ? (vencida ? 'text-[#C0392B] font-bold' : 'text-[#2570BA] font-bold') :
              'text-gray-300'
            }`}>
              {isDone ? '✓ ' : ''}{getLabel()}
            </span>
            {i < 4 && <span className="text-gray-200 text-[9px]">›</span>}
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Formulario inline para nueva gestión ──────────────────────────────────────
function GestionForm({ diligenciaId, onAdded, onCancel }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    via: 'Llamada',
    detalle: '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.detalle.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('diligencia_gestiones')
      .insert({ diligencia_id: diligenciaId, ...form }).select('*').single()
    setSaving(false)
    if (!error && data) onAdded(data)
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 space-y-2">
      <div className="flex gap-2">
        <input type="date" value={form.fecha}
          onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
          className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2570BA]"/>
        <select value={form.via}
          onChange={e => setForm(f => ({ ...f, via: e.target.value }))}
          className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2570BA]">
          {VIA_GES.map(v => <option key={v}>{v}</option>)}
        </select>
      </div>
      <textarea rows={2} value={form.detalle} placeholder="¿Qué pasó?"
        onChange={e => setForm(f => ({ ...f, detalle: e.target.value }))}
        onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save() }}
        className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-[#2570BA] resize-none"/>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.detalle.trim()}
          className="text-[11px] bg-[#1A2E4A] text-white px-3 py-1 rounded hover:opacity-80 disabled:opacity-40">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="text-[11px] text-gray-500 hover:text-gray-700">Cancelar</button>
      </div>
    </div>
  )
}

// ── Nodo OI en el árbol ────────────────────────────────────────────────────────
function NodoOI({ dil, expanded, onToggle, gestiones, addGestion }) {
  const [showForm, setShowForm] = useState(false)
  const cfg    = ESTADO_CFG[dil.estado] || { chip: 'bg-gray-50 text-gray-500 border-gray-200', border: '#9CA3AF' }
  const numero = dil.oficio || dil.folio
  const titulo = numero ? `${dil.tipo_diligencia || 'OI'} ${numero}` : 'Sin número · gestión propia'
  const baseIso = dil.fecha_oi || dil.fecha_solicitud || dil.created_at?.slice(0, 10)
  const dias   = diasDesde(baseIso)
  const urgente = dil.estado === 'Vencida' || (dias !== null && dias > 60)
  const lastGes = gestiones?.[0]

  return (
    <div className="rounded-lg border border-[#E3E7EC] bg-white mb-2.5 overflow-hidden"
      style={{ borderLeft: `3px solid ${cfg.border}` }}>

      {/* Header del nodo */}
      <div className="px-4 py-3 cursor-pointer select-none flex items-start gap-2" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          {/* Título + estado */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[12px] font-bold truncate ${numero ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {titulo}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.chip}`}>
              {dil.estado || '—'}
            </span>
          </div>

          {/* Ciclo */}
          <CicloInline dil={dil}/>

          {/* Info rápida */}
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {dil.funcionario
              ? <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                  <User size={9}/>{dil.funcionario}
                  {dil.funcionario_telefono && (
                    <span className="flex items-center gap-0.5 ml-1 text-gray-400">
                      <Phone size={9}/>{dil.funcionario_telefono}
                    </span>
                  )}
                </span>
              : <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                  <AlertTriangle size={9}/>sin endosar
                </span>
            }
            {dias !== null && dil.estado !== 'Cumplida' && (
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${urgente ? 'text-red-500' : 'text-gray-400'}`}>
                <Clock size={9}/>{dias}d
              </span>
            )}
            {dil.estado === 'Cumplida' && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#1E9E6A]">
                <CheckCircle2 size={9}/>Cumplida
              </span>
            )}
            {lastGes && (
              <span className="text-[10px] text-gray-400 ml-auto">
                Últ. gestión: {fmt(lastGes.fecha)} · {lastGes.via}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={13} className={`text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`}/>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="border-t border-dashed border-[#E3E7EC] px-4 py-3 bg-[#F5F6F8]/60">
          {/* Descripción */}
          {(dil.descripcion || dil.instruccion) && (
            <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">
              {dil.descripcion || dil.instruccion}
            </p>
          )}

          {/* Historial de gestiones */}
          {gestiones && gestiones.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Gestiones</span>
              {gestiones.map(g => (
                <div key={g.id} className="flex gap-2.5 text-[11px] py-0.5">
                  <span className="text-gray-400 tabular-nums whitespace-nowrap flex-shrink-0">{fmt(g.fecha)}</span>
                  <span className="text-[#2570BA] font-medium flex-shrink-0">{g.via}</span>
                  <span className="text-gray-600">{g.detalle || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Botón agregar gestión */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-[11px] text-[#2570BA] border border-[#2570BA]/40 rounded px-2.5 py-1 hover:bg-[#EBF2FA] transition-colors">
              + Registrar gestión
            </button>
          ) : (
            <GestionForm
              diligenciaId={dil.id}
              onAdded={g => { setShowForm(false); addGestion(dil.id, g) }}
              onCancel={() => setShowForm(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Diligencias() {
  const [rows,       setRows]       = useState([])
  const [gestiones,  setGestiones]  = useState({})    // { diligencia_id: [ges...] }
  const [loading,    setLoading]    = useState(true)
  const [selCausaId, setSelCausaId] = useState(null)
  const [filter,     setFilter]     = useState('todas')
  const [expandedId, setExpandedId] = useState(null)

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from('diligencias')
        .select('*, causa:causas(id, ruc, rit, cliente_nombre, materia)')
        .order('created_at', { ascending: false }),
      supabase.from('diligencia_gestiones')
        .select('*')
        .order('fecha', { ascending: false }),
    ]).then(([{ data: rs }, { data: gs }]) => {
      const rowData = rs || []
      setRows(rowData)

      // Agrupar gestiones por diligencia_id
      const gesMap = {}
      for (const g of (gs || [])) {
        if (!gesMap[g.diligencia_id]) gesMap[g.diligencia_id] = []
        gesMap[g.diligencia_id].push(g)
      }
      setGestiones(gesMap)

      // Autoseleccionar primera causa con diligencias
      if (rowData.length > 0 && !selCausaId) {
        setSelCausaId(rowData[0].causa_id)
      }

      setLoading(false)
    })
  }, [])

  // ── Agrupar por causa (panel izquierdo) ─────────────────────────────────────
  const causaGroups = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const cid = row.causa_id
      if (!map.has(cid)) map.set(cid, { causa: row.causa, causa_id: cid, dils: [] })
      map.get(cid).dils.push(row)
    }
    return Array.from(map.values())
      .filter(g => g.causa)
      .sort((a, b) => (a.causa?.cliente_nombre || '').localeCompare(b.causa?.cliente_nombre || ''))
  }, [rows])

  // ── Diligencias de la causa seleccionada ────────────────────────────────────
  const selDils = useMemo(() => {
    const g = causaGroups.find(g => g.causa_id === selCausaId)
    return g?.dils || []
  }, [causaGroups, selCausaId])

  const filteredDils = useMemo(() => {
    if (filter === 'vencidas')    return selDils.filter(d => d.estado === 'Vencida')
    if (filter === 'sin_endosar') return selDils.filter(d => !d.funcionario && d.estado !== 'Cumplida')
    if (filter === 'en_gestion')  return selDils.filter(d => d.estado === 'En gestión')
    return selDils
  }, [selDils, filter])

  const selCounts = useMemo(() => ({
    todas:       selDils.length,
    vencidas:    selDils.filter(d => d.estado === 'Vencida').length,
    sin_endosar: selDils.filter(d => !d.funcionario && d.estado !== 'Cumplida').length,
    en_gestion:  selDils.filter(d => d.estado === 'En gestión').length,
  }), [selDils])

  function addGestion(dilId, g) {
    setGestiones(prev => ({ ...prev, [dilId]: [g, ...(prev[dilId] || [])] }))
  }

  const FILTROS = [
    { key: 'todas',       label: 'Todas',       red: false },
    { key: 'vencidas',    label: 'Vencidas',    red: true  },
    { key: 'sin_endosar', label: 'Sin endosar', red: true  },
    { key: 'en_gestion',  label: 'En gestión',  red: false },
  ]

  // ── Panel izquierdo: cada causa ──────────────────────────────────────────────
  function CausaItem({ g }) {
    const activas  = g.dils.filter(d => d.estado !== 'Cumplida').length
    const vencidas = g.dils.filter(d => d.estado === 'Vencida').length
    const isSel    = g.causa_id === selCausaId
    const causa    = g.causa

    return (
      <div
        onClick={() => { setSelCausaId(g.causa_id); setFilter('todas'); setExpandedId(null) }}
        className={`px-4 py-3 cursor-pointer border-b border-[#E8EBF0] transition-colors ${
          isSel
            ? 'bg-[#EBF2FA] border-l-[3px] border-l-[#2570BA]'
            : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
        }`}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={`text-[12px] font-bold truncate ${isSel ? 'text-[#1A2E4A]' : 'text-gray-700'}`}>
              {causa?.cliente_nombre || '—'}
            </p>
            <p className="text-[10px] text-gray-400 truncate mt-0.5">
              {causa?.ruc || causa?.rit || '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {activas > 0 && (
              <span className="text-[9px] font-semibold bg-[#EBF2FA] text-[#2570BA] border border-[#C9DEF2] px-1.5 py-0.5 rounded-full">
                {activas} activa{activas > 1 ? 's' : ''}
              </span>
            )}
            {vencidas > 0 && (
              <span className="text-[9px] font-semibold bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">
                {vencidas} vencida{vencidas > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#F5F6F8]">

      {/* ── Panel izquierdo: lista de causas ──────────────────────────────── */}
      <div className="w-[280px] flex-shrink-0 bg-white border-r border-[#E3E7EC] flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#E8EBF0] flex items-center gap-2">
          <Inbox size={15} className="text-[#2570BA]"/>
          <h2 className="text-[13px] font-bold text-[#1A2E4A]">Diligencias</h2>
          <span className="text-[10px] text-gray-400 tabular-nums ml-auto">{rows.length} total</span>
        </div>

        {/* Lista causas */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-300"/>
            </div>
          ) : causaGroups.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-4">
              <Inbox size={24} className="text-gray-200 mb-2"/>
              <p className="text-[11px] text-gray-400">Sin diligencias registradas</p>
            </div>
          ) : (
            causaGroups.map(g => <CausaItem key={g.causa_id} g={g}/>)
          )}
        </div>
      </div>

      {/* ── Panel derecho: árbol de diligencias ────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {!selCausaId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Inbox size={28} className="text-gray-200 mb-3"/>
            <p className="text-[13px] text-gray-400">Selecciona una causa</p>
          </div>
        ) : (
          <>
            {/* Header del árbol */}
            {(() => {
              const g = causaGroups.find(g => g.causa_id === selCausaId)
              const c = g?.causa
              return (
                <div className="bg-white border-b border-[#E3E7EC] px-5 py-3.5 flex-shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold text-[#1A2E4A]">{c?.cliente_nombre || '—'}</p>
                      <p className="text-[11px] text-gray-400">{c?.ruc || c?.rit || '—'}{c?.materia ? ` · ${c.materia}` : ''}</p>
                    </div>
                  </div>

                  {/* Filtros */}
                  <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                    {FILTROS.map(f => (
                      <button key={f.key} onClick={() => setFilter(f.key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                          filter === f.key
                            ? f.red ? 'bg-[#C0392B] text-white' : 'bg-[#1A2E4A] text-white'
                            : f.red && selCounts[f.key] > 0
                              ? 'text-red-600 bg-red-50 hover:bg-red-100'
                              : 'text-gray-500 hover:bg-gray-100'
                        }`}>
                        {f.label} <span className="opacity-60 tabular-nums">({selCounts[f.key] ?? 0})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Árbol de OIs */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {filteredDils.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Inbox size={24} className="text-gray-200 mb-2"/>
                  <p className="text-[12px] text-gray-400">
                    {selDils.length === 0 ? 'Sin diligencias en esta causa' : 'Sin resultados con ese filtro'}
                  </p>
                </div>
              ) : (
                filteredDils.map(dil => (
                  <NodoOI
                    key={dil.id}
                    dil={dil}
                    expanded={expandedId === dil.id}
                    onToggle={() => setExpandedId(expandedId === dil.id ? null : dil.id)}
                    gestiones={gestiones[dil.id] || []}
                    addGestion={addGestion}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
