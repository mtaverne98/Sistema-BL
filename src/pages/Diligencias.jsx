import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, ChevronRight, Scale, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES[parseInt(m,10)-1]} ${y}`
}

function daysSince(isoDate) {
  if (!isoDate) return null
  return Math.round((Date.now() - new Date(isoDate + 'T00:00:00').getTime()) / 86400000)
}

const ESTADO_CLS = {
  'Recibida':    'bg-green-50 text-green-700 border-green-200',
  'Solicitada':  'bg-amber-50 text-amber-700 border-amber-200',
  'No recibida': 'bg-gray-50 text-gray-500 border-gray-200',
}

const FILTERS = [
  { key: 'todas',       label: 'Todas'       },
  { key: 'solicitadas', label: 'Solicitadas' },
  { key: 'recibidas',   label: 'Recibidas'   },
  { key: 'no_recibidas',label: 'No recibidas'},
]

const ESTADO_MAP = {
  solicitadas:  'Solicitada',
  recibidas:    'Recibida',
  no_recibidas: 'No recibida',
}

export default function Diligencias() {
  const navigate  = useNavigate()
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('todas')

  useEffect(() => {
    setLoading(true)
    supabase
      .from('diligencias')
      .select('*, causas(id, ruc, rit, materia, cliente_nombre)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'todas') return rows
    const estado = ESTADO_MAP[filter]
    return rows.filter(r => r.estado === estado)
  }, [rows, filter])

  const counts = useMemo(() => ({
    todas:       rows.length,
    solicitadas: rows.filter(r => r.estado === 'Solicitada').length,
    recibidas:   rows.filter(r => r.estado === 'Recibida').length,
    no_recibidas:rows.filter(r => r.estado === 'No recibida').length,
  }), [rows])

  function goToCausa(causaId) {
    navigate('/causas', { state: { openCausaId: causaId, openTab: 'diligencias' } })
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <Inbox size={20} className="text-[#2570BA]" />
          <h1 className="text-[18px] font-bold text-[#1A2E4A]">Diligencias</h1>
          <span className="text-[12px] text-gray-400 tabular-nums">{rows.length} total</span>
        </div>
        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                filter === f.key ? 'bg-[#1A2E4A] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {f.label} <span className="opacity-60 tabular-nums">({counts[f.key]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto fab-clear">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[#2570BA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <Inbox size={32} className="text-gray-200 mb-3" />
            <p className="text-[14px] text-gray-400 font-medium">Sin diligencias registradas</p>
            <p className="text-[12px] text-gray-400 mt-1">
              Registra OIs y diligencias desde la ficha de cada causa
            </p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_90px_110px_110px_1fr_24px] gap-4 px-8 py-2 border-b border-gray-100 bg-gray-50">
              {['Diligencia / Organismo','Estado','Solicitada','Recibida','Causa'].map(h => (
                <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
              ))}
              <span />
            </div>

            {filtered.map(d => {
              const causa    = d.causas
              const alerta   = d.estado === 'Solicitada' && daysSince(d.fecha_solicitud) > 60
              return (
                <button key={d.id} onClick={() => goToCausa(d.causa_id)}
                  className="w-full grid grid-cols-[1fr_90px_110px_110px_1fr_24px] gap-4 px-8 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left items-center">

                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 truncate">
                      {d.nombre || <span className="text-gray-300 italic">Sin nombre</span>}
                    </p>
                    {d.organismo && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{d.organismo}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold w-fit ${ESTADO_CLS[d.estado] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      {d.estado || '—'}
                    </span>
                    {alerta && (
                      <AlertCircle size={11} className="text-amber-500 flex-shrink-0" title="Más de 60 días solicitada sin respuesta" />
                    )}
                  </div>

                  <span className="text-[11px] text-gray-500 tabular-nums">{fmtFecha(d.fecha_solicitud)}</span>
                  <span className="text-[11px] text-gray-500 tabular-nums">{fmtFecha(d.fecha_recepcion)}</span>

                  <div className="flex items-center gap-1 min-w-0">
                    <Scale size={10} className="text-gray-300 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500 truncate">
                      {causa?.ruc || causa?.rit || causa?.materia || causa?.cliente_nombre || '—'}
                    </span>
                  </div>

                  <ChevronRight size={13} className="text-gray-300" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
