import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, ChevronRight, Scale } from 'lucide-react'
import { supabase } from '../lib/supabase'

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES[parseInt(m,10)-1]} ${y}`
}

const TIPO_CLS = {
  'Entrevista': 'bg-violet-50 text-violet-700 border-violet-200',
  'Llamada':    'bg-blue-50 text-blue-700 border-blue-200',
  'Reunión':    'bg-teal-50 text-teal-700 border-teal-200',
}

export default function Entrevistas() {
  const navigate   = useNavigate()
  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('todas')

  useEffect(() => {
    setLoading(true)
    supabase
      .from('entrevistas')
      .select('*, causas(id, ruc, materia, cliente_nombre)')
      .order('fecha', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'todas') return rows
    const map = { entrevistas: 'Entrevista', llamadas: 'Llamada', reuniones: 'Reunión' }
    return rows.filter(r => r.tipo === map[filter])
  }, [rows, filter])

  const counts = useMemo(() => ({
    todas:       rows.length,
    entrevistas: rows.filter(r => r.tipo === 'Entrevista').length,
    llamadas:    rows.filter(r => r.tipo === 'Llamada').length,
    reuniones:   rows.filter(r => r.tipo === 'Reunión').length,
  }), [rows])

  function goToCausa(causaId) {
    navigate('/causas', { state: { openCausaId: causaId, openTab: 'entrevistas' } })
  }

  const FILTERS = [
    { key: 'todas',       label: 'Todas' },
    { key: 'entrevistas', label: 'Entrevistas' },
    { key: 'llamadas',    label: 'Llamadas' },
    { key: 'reuniones',   label: 'Reuniones' },
  ]

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare size={20} className="text-[#2570BA]" />
          <h1 className="text-[18px] font-bold text-[#1A2E4A]">Entrevistas</h1>
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
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[#2570BA] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <MessageSquare size={32} className="text-gray-200 mb-3" />
            <p className="text-[14px] text-gray-400 font-medium">Sin entrevistas registradas</p>
            <p className="text-[12px] text-gray-400 mt-1">
              Registra entrevistas, llamadas y reuniones desde la ficha de cada causa
            </p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="grid grid-cols-[90px_90px_1fr_1fr_1fr_1fr_24px] gap-4 px-8 py-2 border-b border-gray-100 bg-gray-50">
              {['Fecha','Tipo','Persona','Cargo','Institución','Causa'].map(h => (
                <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
              ))}
              <span />
            </div>

            {filtered.map(e => {
              const causa = e.causas
              return (
                <button key={e.id} onClick={() => goToCausa(e.causa_id)}
                  className="w-full grid grid-cols-[90px_90px_1fr_1fr_1fr_1fr_24px] gap-4 px-8 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left items-center">
                  <span className="text-[11px] text-gray-500 tabular-nums">{fmtFecha(e.fecha)}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold w-fit ${TIPO_CLS[e.tipo] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {e.tipo || '—'}
                  </span>
                  <span className="text-[12px] font-medium text-gray-800 truncate">{e.persona || <span className="text-gray-300 italic">Sin nombre</span>}</span>
                  <span className="text-[11px] text-gray-500 truncate">{e.cargo || '—'}</span>
                  <span className="text-[11px] text-gray-500 truncate">{e.institucion || '—'}</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <Scale size={10} className="text-gray-300 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500 truncate">
                      {causa?.ruc || causa?.materia || '—'}
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
