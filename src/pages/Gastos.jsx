import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, ChevronLeft, ChevronRight, X, Trash2, Download, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  'TAG','Bencina','Estacionamiento','Uber','Peaje',
  'Notificación','Trámite','Fotocopias','Notaría','Audiencia','Otros',
]

const CAT_META = {
  TAG:             { dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50'   },
  Bencina:         { dot: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50' },
  Estacionamiento: { dot: 'bg-indigo-400', text: 'text-indigo-600', bg: 'bg-indigo-50' },
  Uber:            { dot: 'bg-gray-500',   text: 'text-gray-600',   bg: 'bg-gray-100'  },
  Peaje:           { dot: 'bg-teal-400',   text: 'text-teal-600',   bg: 'bg-teal-50'   },
  Notificación:    { dot: 'bg-rose-400',   text: 'text-rose-600',   bg: 'bg-rose-50'   },
  Trámite:         { dot: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-100' },
  Fotocopias:      { dot: 'bg-cyan-500',   text: 'text-cyan-700',   bg: 'bg-cyan-50'   },
  Notaría:         { dot: 'bg-purple-400', text: 'text-purple-600', bg: 'bg-purple-50' },
  Audiencia:       { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50'  },
  Otros:           { dot: 'bg-gray-400',   text: 'text-gray-500',   bg: 'bg-gray-100'  },
}

const ESTADO_META = {
  pendiente: { label: 'Pendiente', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50'  },
  cobrado:   { label: 'Cobrado',   dot: 'bg-blue-400',  text: 'text-blue-600',  bg: 'bg-blue-50'   },
  pagado:    { label: 'Pagado',    dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50'  },
}

const MESES        = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const TODAY         = new Date().toISOString().slice(0, 10)
const CURRENT_MONTH = TODAY.slice(0, 7)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMonto(n) {
  if (!n && n !== 0) return '$0'
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatFechaCorta(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}-${MESES[d.getMonth()]}`
}

function getMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return MESES_LARGOS[m - 1] + ' ' + y
}

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function genId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function CategoriaBadge({ cat }) {
  const m = CAT_META[cat] || CAT_META.Otros
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {cat}
    </span>
  )
}

function EstadoBadge({ estado, onClick }) {
  const m = ESTADO_META[estado] || ESTADO_META.pendiente
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${m.bg} ${m.text} hover:opacity-75 transition-opacity select-none`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </button>
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ gastos, month }) {
  const mes       = gastos.filter(g => g.fecha.startsWith(month))
  const pendientes = mes.filter(g => g.estado === 'pendiente')
  const cobrados   = mes.filter(g => g.estado === 'cobrado')
  const pagados    = mes.filter(g => g.estado === 'pagado')

  const totalPendiente = pendientes.reduce((s, g) => s + g.monto, 0)
  const totalCobrado   = cobrados.reduce((s, g) => s + g.monto, 0)
  const totalPagado    = pagados.reduce((s, g) => s + g.monto, 0)
  const totalMes       = mes.reduce((s, g) => s + g.monto, 0)

  const byCat = {}
  mes.forEach(g => { byCat[g.categoria] = (byCat[g.categoria] || 0) + g.monto })
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (mes.length === 0) {
    return (
      <div className="mx-6 mb-4 px-5 py-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
        <p className="text-[12px] text-gray-400 text-center">
          Sin gastos en {getMonthLabel(month).toLowerCase()}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-6 mb-4 rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
      <div className="flex items-start justify-between px-6 pt-4 pb-4">
        {/* Total destacado */}
        <div>
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">
            Total a cobrar
          </p>
          <p className="text-[32px] font-bold text-gray-900 leading-none tracking-tight">
            {formatMonto(totalPendiente)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {mes.length} gasto{mes.length !== 1 ? 's' : ''} · {getMonthLabel(month)}
          </p>
        </div>

        {/* Breakdown por estado */}
        <div className="flex flex-col gap-1.5 items-end pt-0.5">
          {pendientes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</span>
              <span className="text-[12px] font-semibold text-amber-700 tabular-nums">{formatMonto(totalPendiente)}</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            </div>
          )}
          {cobrados.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{cobrados.length} cobrado{cobrados.length !== 1 ? 's' : ''}</span>
              <span className="text-[12px] font-semibold text-blue-600 tabular-nums">{formatMonto(totalCobrado)}</span>
              <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            </div>
          )}
          {pagados.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{pagados.length} pagado{pagados.length !== 1 ? 's' : ''}</span>
              <span className="text-[12px] font-semibold text-green-700 tabular-nums">{formatMonto(totalPagado)}</span>
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Breakdown por categoría */}
      {topCats.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-2.5 flex items-center gap-5 flex-wrap">
          {topCats.map(([cat, amt]) => {
            const m = CAT_META[cat] || CAT_META.Otros
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
                <span className="text-[11px] text-gray-500">{cat}</span>
                <span className="text-[11.5px] font-semibold text-gray-700 tabular-nums">{formatMonto(amt)}</span>
              </div>
            )
          })}
          {totalMes !== totalPendiente && (
            <span className="ml-auto text-[11px] text-gray-400 tabular-nums">
              Total mes: <span className="font-semibold text-gray-600">{formatMonto(totalMes)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal agregar gasto ───────────────────────────────────────────────────────
function ModalAgregarGasto({ onSave, onClose }) {
  const [montoRaw,  setMontoRaw]  = useState('')
  const [categoria, setCategoria] = useState('TAG')
  const [notas,     setNotas]     = useState('')
  const [fecha,     setFecha]     = useState(TODAY)
  const montoRef = useRef(null)

  const montoNum = parseInt(montoRaw, 10) || 0

  function handleSave() {
    if (montoNum <= 0) return
    onSave({ id: genId(), fecha, categoria, notas: notas.trim(), monto: montoNum, estado: 'pendiente' })
    setMontoRaw('')
    setNotas('')
    setTimeout(() => montoRef.current?.focus(), 50)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-[14px] font-semibold text-gray-900">Agregar gasto</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Monto — campo grande */}
          <div>
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">Monto</p>
            <div className="flex items-baseline border-b-2 border-gray-200 focus-within:border-[#1a2e4a] transition-colors pb-1">
              <span className="text-[28px] font-bold text-gray-300 mr-1 leading-none select-none">$</span>
              <input
                ref={montoRef}
                autoFocus
                type="text"
                inputMode="numeric"
                value={montoRaw}
                onChange={e => setMontoRaw(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="0"
                className="flex-1 text-[28px] font-bold text-gray-900 outline-none bg-transparent placeholder-gray-200 leading-none"
              />
            </div>
            {montoNum > 0 && (
              <p className="text-[11px] text-gray-400 mt-1 tabular-nums">{formatMonto(montoNum)}</p>
            )}
          </div>

          {/* Categoría — pills rápidas */}
          <div>
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">Categoría</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map(cat => {
                const m = CAT_META[cat] || CAT_META.Otros
                const active = categoria === cat
                return (
                  <button key={cat} type="button" onClick={() => setCategoria(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all border ${
                      active
                        ? `${m.bg} ${m.text} border-transparent shadow-sm`
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                    }`}>
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notas + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Notas</p>
              <input value={notas} onChange={e => setNotas(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Ej: Fiscalía Ñuñoa"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none text-gray-700 placeholder-gray-300 focus:border-gray-300 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Fecha</p>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none text-gray-700 focus:border-gray-300 transition-colors" />
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center justify-between">
          <p className="text-[10px] text-gray-300">Enter para guardar · ESC para cerrar</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={montoNum <= 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1a2e4a] text-white text-[12px] font-medium rounded-lg hover:bg-[#243d61] disabled:opacity-40 transition-colors">
              <Plus size={12} /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const COL_GRID = '68px 126px 1fr 92px 104px 32px'

export default function Gastos() {
  const [gastos,       setGastos]       = useState([])
  const [viewMonth,    setViewMonth]    = useState(CURRENT_MONTH)
  const [filtroEstado, setFiltroEstado] = useState(null)
  const [filtroCat,    setFiltroCat]    = useState(null)
  const [showModal,    setShowModal]    = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('gastos')
      .select('*')
      .order('fecha', { ascending: false })
      .then(({ data }) => setGastos(data || []))
  }, [])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function addGasto(gasto) {
    const { id: _id, ...payload } = gasto // remove client-generated id
    const { data, error } = await supabase.from('gastos').insert([{
      fecha:     payload.fecha,
      categoria: payload.categoria,
      notas:     payload.notas || null,
      monto:     payload.monto,
      estado:    payload.estado || 'pendiente',
    }]).select().single()
    if (error) { console.error('Error al guardar gasto:', error.message); return }
    setGastos(prev => [data, ...prev])
  }

  async function updateGasto(id, changes) {
    setGastos(prev => prev.map(g => g.id === id ? { ...g, ...changes } : g))
    const allowed = new Set(['fecha','categoria','notas','monto','estado'])
    const payload = Object.fromEntries(Object.entries(changes).filter(([k]) => allowed.has(k)))
    if (Object.keys(payload).length) {
      const { error } = await supabase.from('gastos').update(payload).eq('id', id)
      if (error) console.error('Error al actualizar gasto:', error.message)
    }
  }

  async function deleteGasto(id) {
    setGastos(prev => prev.filter(g => g.id !== id))
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) console.error('Error al eliminar gasto:', error.message)
  }

  const allGastos = gastos

  const filtered = useMemo(() => {
    return allGastos
      .filter(g => g.fecha.startsWith(viewMonth))
      .filter(g => !filtroEstado || g.estado === filtroEstado)
      .filter(g => !filtroCat    || g.categoria === filtroCat)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
  }, [allGastos, viewMonth, filtroEstado, filtroCat])

  const totalFiltered = filtered.reduce((s, g) => s + g.monto, 0)

  function cycleEstado(gasto) {
    const keys = Object.keys(ESTADO_META)
    const next = keys[(keys.indexOf(gasto.estado) + 1) % keys.length]
    updateGasto(gasto.id, { estado: next })
  }

  function exportCSV() {
    const rows = [
      ['Fecha', 'Categoría', 'Notas', 'Monto', 'Estado'],
      ...filtered.map(g => [g.fecha, g.categoria, `"${g.notas}"`, g.monto, ESTADO_META[g.estado]?.label || g.estado]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `gastos_${viewMonth}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full overflow-hidden flex flex-col bg-white">

      {showModal && (
        <ModalAgregarGasto
          onSave={addGasto}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900">Gastos</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Gastos personales a reembolsar por Bianchi Leiva</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-[12px] rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={12} /> Exportar
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-[12px] rounded-lg hover:bg-gray-50 transition-colors">
            <Printer size={12} /> Imprimir
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1a2e4a] text-white text-[12px] font-medium rounded-lg hover:bg-[#243d61] transition-colors">
            <Plus size={13} /> Agregar gasto
          </button>
        </div>
      </div>

      {/* ── Month nav ── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-6 pt-4 pb-2">
        <button onClick={() => setViewMonth(prevMonth(viewMonth))}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <h2 className="text-[14px] font-semibold text-gray-800 tracking-wide px-2 min-w-[164px] text-center select-none">
          {getMonthLabel(viewMonth).toUpperCase()}
        </h2>
        <button onClick={() => setViewMonth(nextMonth(viewMonth))}
          disabled={viewMonth >= CURRENT_MONTH}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Summary ── */}
      <SummaryCard gastos={allGastos} month={viewMonth} />

      {/* ── Filters ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 pb-3 flex-wrap">
        {[null, 'pendiente', 'cobrado', 'pagado'].map(e => {
          const active = filtroEstado === e
          return (
            <button key={e ?? 'all'} onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
                active
                  ? 'bg-[#1a2e4a] text-white border-[#1a2e4a]'
                  : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 bg-white'
              }`}>
              {e ? ESTADO_META[e].label : 'Todos'}
            </button>
          )
        })}

        <div className="w-px h-4 bg-gray-200 mx-0.5" />

        <select value={filtroCat || ''} onChange={e => setFiltroCat(e.target.value || null)}
          className="text-[11px] border border-gray-200 rounded-full px-3 py-1 bg-white text-gray-500 outline-none hover:border-gray-300 cursor-pointer transition-colors">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>

        {(filtroEstado || filtroCat) && (
          <button onClick={() => { setFiltroEstado(null); setFiltroCat(null) }}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
            <X size={9} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-hidden flex flex-col mx-6 mb-6 rounded-2xl border border-gray-100">

        {/* Header */}
        <div className="flex-shrink-0 grid items-center px-4 py-2 bg-gray-50/60 border-b border-gray-100 gap-3"
          style={{ gridTemplateColumns: COL_GRID }}>
          {['Fecha','Categoría','Notas','Monto','Estado',''].map((h, i) => (
            <p key={i}
              className={`text-[9.5px] font-bold uppercase tracking-widest text-gray-300 ${h === 'Monto' ? 'text-right' : ''}`}>
              {h}
            </p>
          ))}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <p className="text-[12px] text-gray-400">
                {filtroEstado || filtroCat ? 'Sin gastos con estos filtros' : 'Sin gastos este mes'}
              </p>
              <button onClick={() => setShowModal(true)}
                className="mt-2 text-[11px] text-[#2570ba] hover:text-[#1a2e4a] transition-colors">
                + Agregar primer gasto
              </button>
            </div>
          ) : (
            filtered.map(gasto => (
              <div key={gasto.id}
                className="group grid items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors gap-3"
                style={{ gridTemplateColumns: COL_GRID }}>

                <span className="text-[11.5px] text-gray-500 font-mono tabular-nums">
                  {formatFechaCorta(gasto.fecha)}
                </span>

                <div><CategoriaBadge cat={gasto.categoria} /></div>

                <span className="text-[12px] text-gray-600 truncate">
                  {gasto.notas || <span className="text-gray-200">—</span>}
                </span>

                <span className="text-[13px] font-semibold text-gray-900 text-right tabular-nums">
                  {formatMonto(gasto.monto)}
                </span>

                <EstadoBadge estado={gasto.estado} onClick={() => cycleEstado(gasto)} />

                <div className="flex justify-end">
                  <button onClick={() => deleteGasto(gasto.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer total */}
        {filtered.length > 0 && (
          <div className="flex-shrink-0 grid items-center px-4 py-3 border-t border-gray-100 bg-gray-50/50 gap-3"
            style={{ gridTemplateColumns: COL_GRID }}>
            <div /><div />
            <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">
              {filtered.length} gasto{filtered.length !== 1 ? 's' : ''}
            </p>
            <p className="text-[15px] font-bold text-gray-900 text-right tabular-nums">
              {formatMonto(totalFiltered)}
            </p>
            <div /><div />
          </div>
        )}
      </div>
    </div>
  )
}
