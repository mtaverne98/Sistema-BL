import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronLeft, Plus, Search, Calendar, Clock, CheckCircle2,
  Circle, FileText, Target, ArrowRight, Gavel, ChevronDown,
  Edit2, ClipboardList, BookOpen, MessageSquare, Filter,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#2570ba', initials: 'MT' },
  AB: { nombre: 'Angélica B.', color: '#059669', initials: 'AB' },
  CL: { nombre: 'Catalina L.', color: '#7c3aed', initials: 'CL' },
}

const MESES     = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS_CORTOS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DIAS_LARGOS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

const TIPO_TEMA_STYLES = {
  causa:          { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Causa'          },
  urgente:        { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Urgente'        },
  administrativo: { bg: 'bg-gray-100',  text: 'text-gray-600',   label: 'Admin.'         },
  audiencia:      { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Audiencia'      },
  general:        { bg: 'bg-green-50',  text: 'text-green-700',  label: 'General'        },
}

const ESTADO_REUNION_STYLES = {
  'Programada': 'bg-blue-50 text-blue-700 border-blue-200',
  'En curso':   'bg-amber-50 text-amber-700 border-amber-200',
  'Finalizada': 'bg-green-50 text-green-700 border-green-200',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFechaLarga(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function formatFechaCorta(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0,3)}`
}

function getNextWeekRange(fechaReunion) {
  const d = new Date(fechaReunion + 'T00:00:00')
  const start = new Date(d); start.setDate(d.getDate() + 1)
  const end   = new Date(d); end.setDate(d.getDate() + 7)
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  }
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

const TODAY = new Date().toISOString().slice(0, 10)

// ── Shared Components ─────────────────────────────────────────────────────────
function Avatar({ code, size = 'sm' }) {
  const info = RESPONSABLE_INFO[code] || { initials: code, color: '#94a3b8' }
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'md' ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-[12px]'
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ backgroundColor: info.color }}
      title={info.nombre}
    >
      {info.initials}
    </div>
  )
}

function EstadoBadge({ estado, onClick }) {
  const cls = ESTADO_REUNION_STYLES[estado] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cls} ${onClick ? 'cursor-pointer hover:opacity-80 select-none' : ''}`}
      onClick={onClick}
    >
      {estado}
      {onClick && <ChevronDown size={10} />}
    </span>
  )
}

// Section wrapper used in detail view
function Section({ id, title, icon: Icon, count, children, action }) {
  return (
    <div id={id} className="py-6 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gray-400" strokeWidth={1.8} />
          <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-widest">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-semibold">{count}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── LIST VIEW ─────────────────────────────────────────────────────────────────
function ReunionCard({ reunion, onClick }) {
  const pendientes          = reunion.bandeja.filter(b => !b.discutido).length
  const decisiones          = reunion.decisiones.length
  const decisionesOk        = reunion.decisiones.filter(d => d.completada).length
  const isPast              = reunion.estado === 'Finalizada'
  const d                   = new Date(reunion.fecha + 'T00:00:00')

  return (
    <div
      onClick={onClick}
      className="group flex gap-4 p-4 border border-gray-100 rounded-xl bg-white hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all duration-150"
    >
      {/* Date block */}
      <div className="flex-shrink-0 w-11 text-center pt-0.5">
        <p className={`text-[22px] font-bold leading-none ${isPast ? 'text-gray-300' : 'text-[#1a2e4a]'}`}>{d.getDate()}</p>
        <p className={`text-[9px] font-bold tracking-widest mt-0.5 uppercase ${isPast ? 'text-gray-300' : 'text-[#2570ba]'}`}>{MESES[d.getMonth()].slice(0,3)}</p>
      </div>

      {/* Divider */}
      <div className={`w-px self-stretch flex-shrink-0 ${isPast ? 'bg-gray-100' : 'bg-gray-200'}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-[13px] font-medium leading-tight ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
              {DIAS_LARGOS[d.getDay()].charAt(0).toUpperCase() + DIAS_LARGOS[d.getDay()].slice(1)} · {reunion.hora_inicio}
              {reunion.hora_fin ? ` – ${reunion.hora_fin}` : ''}
            </p>
            <p className={`text-[11px] mt-0.5 ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>{reunion.tipo}</p>
          </div>
          <EstadoBadge estado={reunion.estado} />
        </div>

        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {pendientes > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <ClipboardList size={10} strokeWidth={2} /> {pendientes} temas
            </span>
          )}
          {decisiones > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Target size={10} strokeWidth={2} /> {decisionesOk}/{decisiones}
            </span>
          )}
          {reunion.causas_discutidas.length > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <FileText size={10} strokeWidth={2} /> {reunion.causas_discutidas.length} causas
            </span>
          )}
          <div className="flex -space-x-1.5 ml-auto">
            {reunion.participantes.map(p => <Avatar key={p} code={p} size="sm" />)}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalNuevaReunion({ onSave, onClose }) {
  const [fecha,      setFecha]      = useState('')
  const [hora,       setHora]       = useState('09:00')
  const [tipo,       setTipo]       = useState('Reunión semanal')
  const [partics,    setPartics]    = useState(['MT', 'AB', 'CL'])

  function togglePartic(code) {
    setPartics(prev => prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code])
  }

  function handleSave() {
    if (!fecha) return
    onSave({
      id: genId('ru'),
      fecha, hora_inicio: hora, hora_fin: null,
      estado: 'Programada', tipo,
      participantes: partics,
      bandeja: [], causas_discutidas: [], decisiones: [], tareas_ids: [],
      proxima_accion: '', proxima_reunion: null, minuta: '',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Nueva reunión</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[#2570ba]" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[#2570ba]" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[#2570ba] bg-white">
                <option>Reunión semanal</option>
                <option>Reunión extraordinaria</option>
                <option>Reunión de equipo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Participantes</label>
            <div className="mt-1.5 flex gap-2">
              {Object.entries(RESPONSABLE_INFO).map(([code, info]) => (
                <button
                  key={code}
                  onClick={() => togglePartic(code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all ${
                    partics.includes(code)
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-400 bg-white hover:border-gray-300'
                  }`}
                  style={partics.includes(code) ? { backgroundColor: info.color } : {}}
                >
                  {info.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="text-[12px] text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!fecha || partics.length === 0}
            className="text-[12px] bg-[#1a2e4a] text-white px-4 py-1.5 rounded-lg font-medium hover:bg-[#243d61] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Crear reunión
          </button>
        </div>
      </div>
    </div>
  )
}

function ListViewPage({ reuniones, onSelect, onAdd }) {
  const [query,       setQuery]       = useState('')
  const [filtroEstado, setFiltro]     = useState('Todas')
  const [showModal,   setShowModal]   = useState(false)

  const filtered = useMemo(() => {
    let list = [...reuniones].sort((a, b) => b.fecha.localeCompare(a.fecha))
    if (filtroEstado !== 'Todas') list = list.filter(r => r.estado === filtroEstado)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(r =>
        r.tipo.toLowerCase().includes(q) ||
        r.fecha.includes(q) ||
        r.bandeja.some(b => b.texto.toLowerCase().includes(q)) ||
        r.causas_discutidas.some(c => c.cliente.toLowerCase().includes(q) || c.rit.toLowerCase().includes(q))
      )
    }
    return list
  }, [reuniones, filtroEstado, query])

  const proximas  = filtered.filter(r => r.estado !== 'Finalizada')
  const historial = filtered.filter(r => r.estado === 'Finalizada')

  return (
    <div className="p-8 max-w-3xl">
      {showModal && <ModalNuevaReunion onSave={onAdd} onClose={() => setShowModal(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">Reuniones</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Historial y trazabilidad de reuniones del estudio</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1a2e4a] text-white text-[12px] font-medium rounded-lg hover:bg-[#243d61] transition-colors"
        >
          <Plus size={13} /> Nueva reunión
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por tipo, causa o cliente..."
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg bg-white outline-none text-gray-700 placeholder-gray-300 focus:border-gray-300 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {['Todas', 'Programada', 'En curso', 'Finalizada'].map(e => (
            <button
              key={e}
              onClick={() => setFiltro(e)}
              className={`px-3 py-1.5 text-[11px] rounded-md font-medium transition-all ${
                filtroEstado === e ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Próximas */}
      {proximas.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2.5">Próximas</p>
          <div className="space-y-2">
            {proximas.map(r => <ReunionCard key={r.id} reunion={r} onClick={() => onSelect(r.id)} />)}
          </div>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2.5">Historial</p>
          <div className="space-y-2">
            {historial.map(r => <ReunionCard key={r.id} reunion={r} onClick={() => onSelect(r.id)} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-300">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-[13px]">Sin reuniones que coincidan</p>
        </div>
      )}
    </div>
  )
}

// ── DETAIL VIEW SECTIONS ──────────────────────────────────────────────────────

// 1. Bandeja pre-reunión
function BandejaPrerreunion({ reunion, onAddTema, onToggleTema }) {
  const [showForm, setShowForm] = useState(false)
  const [texto,    setTexto]    = useState('')
  const [tipo,     setTipo]     = useState('general')
  const [autor,    setAutor]    = useState('MT')

  const pendientes = useMemo(() => reunion.bandeja.filter(b => !b.discutido), [reunion.bandeja])
  const discutidos = useMemo(() => reunion.bandeja.filter(b => b.discutido),  [reunion.bandeja])

  function handleAdd() {
    if (!texto.trim()) return
    onAddTema(reunion.id, {
      id: genId('b'), texto: texto.trim(), tipo, autor,
      fecha: TODAY, discutido: false,
    })
    setTexto(''); setShowForm(false)
  }

  return (
    <Section
      id="bandeja"
      title="Bandeja pre-reunión"
      icon={ClipboardList}
      count={pendientes.length}
      action={
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-[11px] text-[#2570ba] hover:text-[#1a2e4a] font-medium transition-colors"
        >
          <Plus size={12} /> Agregar tema
        </button>
      }
    >
      {showForm && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Describe el tema a tratar..."
            className="w-full text-[13px] bg-transparent border-0 outline-none text-gray-900 placeholder-gray-400 mb-2"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-600 outline-none">
              <option value="general">General</option>
              <option value="causa">Causa</option>
              <option value="urgente">Urgente</option>
              <option value="administrativo">Administrativo</option>
              <option value="audiencia">Audiencia</option>
            </select>
            <select value={autor} onChange={e => setAutor(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-600 outline-none">
              {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </select>
            <div className="ml-auto flex gap-2">
              <button onClick={handleAdd}
                className="text-[11px] bg-[#1a2e4a] text-white px-3 py-1 rounded-lg font-medium hover:bg-[#243d61] transition-colors">
                Guardar
              </button>
              <button onClick={() => setShowForm(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {reunion.bandeja.length === 0 && !showForm && (
        <p className="text-[12px] text-gray-300 italic">Sin temas en la bandeja todavía</p>
      )}

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div className="space-y-2 mb-3">
          {pendientes.map(tema => {
            const st = TIPO_TEMA_STYLES[tema.tipo] || TIPO_TEMA_STYLES.general
            return (
              <div key={tema.id} className="flex items-start gap-2.5">
                <button
                  onClick={() => onToggleTema(reunion.id, tema.id)}
                  className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                >
                  <Circle size={15} strokeWidth={1.8} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-700 leading-snug">{tema.texto}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                    <span className="text-[10px] text-gray-400">{RESPONSABLE_INFO[tema.autor]?.nombre}</span>
                    <span className="text-[10px] text-gray-300">{formatFechaCorta(tema.fecha)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Discutidos */}
      {discutidos.length > 0 && (
        <div className="space-y-1.5 opacity-45">
          {discutidos.map(tema => (
            <div key={tema.id} className="flex items-start gap-2.5">
              <button
                onClick={() => onToggleTema(reunion.id, tema.id)}
                className="mt-0.5 flex-shrink-0 text-green-500"
              >
                <CheckCircle2 size={15} strokeWidth={1.8} />
              </button>
              <p className="text-[12px] text-gray-400 line-through leading-snug">{tema.texto}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// 2. Audiencias próxima semana
function AudioenciasProxSemana({ reunion, audiencias }) {
  const { start, end } = useMemo(() => getNextWeekRange(reunion.fecha), [reunion.fecha])

  const prox = useMemo(() =>
    audiencias
      .filter(a => a.fecha >= start && a.fecha <= end)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)),
    [audiencias, start, end]
  )

  const startD = new Date(start + 'T00:00:00')
  const endD   = new Date(end   + 'T00:00:00')
  const rango  = `${startD.getDate()} – ${endD.getDate()} de ${MESES[endD.getMonth()]}`

  return (
    <Section id="audiencias" title="Audiencias próxima semana" icon={Gavel} count={prox.length}>
      <p className="text-[11px] text-gray-400 -mt-2 mb-3">{rango}</p>
      {prox.length === 0 ? (
        <p className="text-[12px] text-gray-300 italic">Sin audiencias programadas para la próxima semana</p>
      ) : (
        <div className="space-y-2">
          {prox.map(a => {
            const ad = new Date(a.fecha + 'T00:00:00')
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50/70 rounded-xl border border-gray-100">
                <div className="flex-shrink-0 text-center w-9">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{DIAS_CORTOS[ad.getDay()]}</p>
                  <p className="text-[18px] font-bold text-[#1a2e4a] leading-tight">{ad.getDate()}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-900">{a.tipo}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{a.cliente} · {a.causa_rit}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{a.hora} · {a.tribunal}</p>
                </div>
                <div className="flex -space-x-1 flex-shrink-0">
                  {a.asiste.map(r => <Avatar key={r} code={r} size="sm" />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// 3. Causas revisadas
function CausasRevisadas({ reunion, onAddCausa }) {
  const [showForm,    setShowForm]    = useState(false)
  const [rit,         setRit]         = useState('')
  const [cliente,     setCliente]     = useState('')
  const [materia,     setMateria]     = useState('')
  const [nota,        setNota]        = useState('')
  const [responsable, setResponsable] = useState('MT')

  function handleAdd() {
    if (!rit.trim()) return
    onAddCausa(reunion.id, {
      id: genId('cd'), rit: rit.trim(), cliente: cliente.trim(),
      materia: materia.trim(), nota: nota.trim(), responsable,
    })
    setRit(''); setCliente(''); setMateria(''); setNota('')
    setShowForm(false)
  }

  return (
    <Section
      id="causas"
      title="Causas revisadas"
      icon={FileText}
      count={reunion.causas_discutidas.length}
      action={
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-[11px] text-[#2570ba] hover:text-[#1a2e4a] font-medium transition-colors"
        >
          <Plus size={12} /> Agregar causa
        </button>
      }
    >
      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={rit} onChange={e => setRit(e.target.value)} placeholder="RIT (ej: P-321-2025)"
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none text-gray-900 placeholder-gray-400" autoFocus />
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del cliente"
              className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none text-gray-900 placeholder-gray-400" />
          </div>
          <input value={materia} onChange={e => setMateria(e.target.value)} placeholder="Materia (ej: Laboral — despido injustificado)"
            className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none text-gray-900 placeholder-gray-400" />
          <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Notas de la discusión..." rows={2}
            className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none text-gray-900 placeholder-gray-400 resize-none" />
          <div className="flex items-center gap-2">
            <select value={responsable} onChange={e => setResponsable(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-600 outline-none">
              {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </select>
            <div className="ml-auto flex gap-2">
              <button onClick={handleAdd}
                className="text-[11px] bg-[#1a2e4a] text-white px-3 py-1 rounded-lg font-medium hover:bg-[#243d61] transition-colors">
                Guardar
              </button>
              <button onClick={() => setShowForm(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {reunion.causas_discutidas.length === 0 && !showForm ? (
        <p className="text-[12px] text-gray-300 italic">Sin causas discutidas registradas</p>
      ) : (
        <div className="space-y-3">
          {reunion.causas_discutidas.map(cd => (
            <div key={cd.id} className="flex gap-3 p-3 border border-gray-100 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[11px] font-mono font-semibold text-[#2570ba]">{cd.rit}</span>
                  <span className="text-[11px] text-gray-300">·</span>
                  <span className="text-[13px] font-medium text-gray-900">{cd.cliente}</span>
                </div>
                {cd.materia && <p className="text-[11px] text-gray-400 mb-1.5">{cd.materia}</p>}
                {cd.nota && <p className="text-[13px] text-gray-600 leading-relaxed">{cd.nota}</p>}
              </div>
              <Avatar code={cd.responsable} size="sm" />
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// 4. Decisiones tomadas
function DecisionRow({ decision, reunionId, onToggle }) {
  const isVencida = !decision.completada && decision.fecha_limite && decision.fecha_limite < TODAY
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ${decision.completada ? 'opacity-45' : 'hover:bg-gray-50/80'}`}>
      <button
        onClick={() => onToggle(reunionId, decision.id)}
        className={`mt-0.5 flex-shrink-0 transition-colors ${decision.completada ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}
      >
        {decision.completada
          ? <CheckCircle2 size={15} strokeWidth={1.8} />
          : <Circle       size={15} strokeWidth={1.8} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${decision.completada ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {decision.texto}
        </p>
        {decision.fecha_limite && (
          <p className={`text-[10px] mt-0.5 ${isVencida ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {isVencida ? '⚠ vencida · ' : ''}{formatFechaCorta(decision.fecha_limite)}
          </p>
        )}
      </div>
      <Avatar code={decision.responsable} size="sm" />
    </div>
  )
}

function DecisionesTomadas({ reunion, onAddDecision, onToggleDecision }) {
  const [showForm,    setShowForm]    = useState(false)
  const [texto,       setTexto]       = useState('')
  const [responsable, setResponsable] = useState('MT')
  const [fechaLimite, setFechaLimite] = useState('')

  const pendientes  = useMemo(() => reunion.decisiones.filter(d => !d.completada), [reunion.decisiones])
  const completadas = useMemo(() => reunion.decisiones.filter(d => d.completada),  [reunion.decisiones])

  function handleAdd() {
    if (!texto.trim()) return
    onAddDecision(reunion.id, {
      id: genId('d'), texto: texto.trim(), responsable,
      fecha_limite: fechaLimite, completada: false,
    })
    setTexto(''); setFechaLimite('')
    setShowForm(false)
  }

  return (
    <Section
      id="decisiones"
      title="Decisiones tomadas"
      icon={Target}
      count={pendientes.length > 0 ? pendientes.length : undefined}
      action={
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1 text-[11px] text-[#2570ba] hover:text-[#1a2e4a] font-medium transition-colors"
        >
          <Plus size={12} /> Agregar decisión
        </button>
      }
    >
      {showForm && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Describe la decisión tomada..."
            className="w-full text-[13px] bg-transparent border-0 outline-none text-gray-900 placeholder-gray-400"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select value={responsable} onChange={e => setResponsable(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-600 outline-none">
              {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </select>
            <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-600 outline-none" />
            <div className="ml-auto flex gap-2">
              <button onClick={handleAdd}
                className="text-[11px] bg-[#1a2e4a] text-white px-3 py-1 rounded-lg font-medium hover:bg-[#243d61] transition-colors">
                Guardar
              </button>
              <button onClick={() => setShowForm(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {reunion.decisiones.length === 0 && !showForm ? (
        <p className="text-[12px] text-gray-300 italic">Sin decisiones registradas</p>
      ) : (
        <div>
          {pendientes.map(d => <DecisionRow key={d.id} decision={d} reunionId={reunion.id} onToggle={onToggleDecision} />)}
          {completadas.map(d => <DecisionRow key={d.id} decision={d} reunionId={reunion.id} onToggle={onToggleDecision} />)}
        </div>
      )}
    </Section>
  )
}

// 5. Tareas generadas
function TareasGeneradas({ reunion, tareas }) {
  const reunionTareas = useMemo(() =>
    tareas.filter(t => reunion.tareas_ids.includes(t.id)),
    [tareas, reunion.tareas_ids]
  )

  const ESTADO_STYLES = {
    'Pendiente':              'bg-gray-100 text-gray-500',
    'En progreso':            'bg-blue-50 text-blue-600',
    'En revisión':            'bg-amber-50 text-amber-600',
    'Lista para envío':       'bg-purple-50 text-purple-600',
    'Esperando antecedentes': 'bg-orange-50 text-orange-600',
    'Completada':             'bg-green-50 text-green-700',
  }

  return (
    <Section id="tareas" title="Tareas generadas" icon={CheckCircle2} count={reunionTareas.length}>
      {reunionTareas.length === 0 ? (
        <p className="text-[12px] text-gray-300 italic">Sin tareas vinculadas a esta reunión</p>
      ) : (
        <div className="space-y-2">
          {reunionTareas.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-xl hover:bg-gray-50/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-800 truncate">{t.titulo}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{t.cliente} · {t.causa_rit}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_STYLES[t.estado] || 'bg-gray-100 text-gray-500'}`}>
                {t.estado}
              </span>
              <Avatar code={t.responsable} size="sm" />
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// 6. Próxima acción
function ProximaAccionSection({ reunion, onUpdate }) {
  const [editing,    setEditing]    = useState(false)
  const [accion,     setAccion]     = useState(reunion.proxima_accion || '')
  const [proxReunion,setProxReunion]= useState(reunion.proxima_reunion || '')

  useEffect(() => {
    setAccion(reunion.proxima_accion || '')
    setProxReunion(reunion.proxima_reunion || '')
  }, [reunion.proxima_accion, reunion.proxima_reunion])

  function handleSave() {
    onUpdate(reunion.id, { proxima_accion: accion, proxima_reunion: proxReunion })
    setEditing(false)
  }

  return (
    <Section id="proxima" title="Próxima acción" icon={ArrowRight}>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={accion}
            onChange={e => setAccion(e.target.value)}
            rows={3}
            placeholder="¿Qué sigue? ¿Qué debe pasar antes de la próxima reunión?"
            className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none text-gray-900 placeholder-gray-400 resize-none focus:border-gray-300"
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-gray-400">Próxima reunión:</label>
            <input type="date" value={proxReunion} onChange={e => setProxReunion(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-700 outline-none" />
            <div className="ml-auto flex gap-2">
              <button onClick={handleSave}
                className="text-[11px] bg-[#1a2e4a] text-white px-3 py-1 rounded-lg font-medium hover:bg-[#243d61] transition-colors">
                Guardar
              </button>
              <button onClick={() => setEditing(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            {reunion.proxima_accion ? (
              <p className="text-[13px] text-gray-700 leading-relaxed">{reunion.proxima_accion}</p>
            ) : (
              <p className="text-[12px] text-gray-300 italic">Sin próxima acción definida</p>
            )}
            {reunion.proxima_reunion && (
              <p className="text-[11px] text-[#2570ba] mt-1.5 flex items-center gap-1.5">
                <Calendar size={11} /> Próxima reunión: <span className="font-medium capitalize">{formatFechaLarga(reunion.proxima_reunion)}</span>
              </p>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors">
            <Edit2 size={13} />
          </button>
        </div>
      )}
    </Section>
  )
}

// 7. Minuta
function MinutaSection({ reunion, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [minuta,  setMinuta]  = useState(reunion.minuta || '')

  useEffect(() => setMinuta(reunion.minuta || ''), [reunion.minuta])

  function handleSave() {
    onUpdate(reunion.id, { minuta })
    setEditing(false)
  }

  return (
    <Section id="minuta" title="Minuta" icon={BookOpen}>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={minuta}
            onChange={e => setMinuta(e.target.value)}
            rows={5}
            placeholder="Redacta la minuta de la reunión..."
            className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none text-gray-900 placeholder-gray-400 resize-none leading-relaxed focus:border-gray-300"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={handleSave}
              className="text-[11px] bg-[#1a2e4a] text-white px-3 py-1 rounded-lg font-medium hover:bg-[#243d61] transition-colors">
              Guardar
            </button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            {reunion.minuta ? (
              <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">{reunion.minuta}</p>
            ) : (
              <p className="text-[12px] text-gray-300 italic">Sin minuta redactada</p>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors">
            <Edit2 size={13} />
          </button>
        </div>
      )}
    </Section>
  )
}

// ── DETAIL VIEW ───────────────────────────────────────────────────────────────
function DetailView({
  reunion, audiencias, tareas, onBack, onUpdate,
  onAddTema, onToggleTema, onAddCausa, onAddDecision, onToggleDecision,
}) {
  const [showEstadoMenu, setShowEstadoMenu] = useState(false)

  const d = new Date(reunion.fecha + 'T00:00:00')

  function changeEstado(nuevoEstado) {
    const cambios = { estado: nuevoEstado }
    if (nuevoEstado === 'En curso'  && !reunion.hora_inicio) cambios.hora_inicio = new Date().toTimeString().slice(0, 5)
    if (nuevoEstado === 'Finalizada' && !reunion.hora_fin)   cambios.hora_fin    = new Date().toTimeString().slice(0, 5)
    onUpdate(reunion.id, cambios)
    setShowEstadoMenu(false)
  }

  const navItems = [
    { id: 'bandeja',    label: 'Bandeja',     badge: reunion.bandeja.filter(b => !b.discutido).length },
    { id: 'audiencias', label: 'Audiencias',  badge: 0 },
    { id: 'causas',     label: 'Causas',      badge: reunion.causas_discutidas.length },
    { id: 'decisiones', label: 'Decisiones',  badge: reunion.decisiones.filter(d => !d.completada).length },
    { id: 'tareas',     label: 'Tareas',      badge: reunion.tareas_ids.length },
    { id: 'proxima',    label: 'Próxima',     badge: 0 },
    { id: 'minuta',     label: 'Minuta',      badge: 0 },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-6 pb-0 border-b border-gray-100">
        {/* Breadcrumb */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors mb-4"
        >
          <ChevronLeft size={14} strokeWidth={2} /> Reuniones
        </button>

        {/* Title + meta */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-[20px] font-semibold text-gray-900 leading-tight">
              {DIAS_LARGOS[d.getDay()].charAt(0).toUpperCase() + DIAS_LARGOS[d.getDay()].slice(1)}{' '}
              {d.getDate()} de {MESES[d.getMonth()]} {d.getFullYear()}
            </h1>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {reunion.tipo}
              {reunion.hora_inicio && ` · ${reunion.hora_inicio}`}
              {reunion.hora_fin    && ` – ${reunion.hora_fin}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex -space-x-1.5">
              {reunion.participantes.map(p => <Avatar key={p} code={p} size="md" />)}
            </div>

            <div className="relative">
              <EstadoBadge estado={reunion.estado} onClick={() => setShowEstadoMenu(s => !s)} />
              {showEstadoMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowEstadoMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
                    {['Programada', 'En curso', 'Finalizada'].map(e => (
                      <button
                        key={e}
                        onClick={() => changeEstado(e)}
                        className={`w-full text-left px-3.5 py-2 text-[12px] hover:bg-gray-50 transition-colors ${e === reunion.estado ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex items-center gap-0">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] text-gray-400 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-200 transition-all -mb-px"
            >
              {item.label}
              {item.badge > 0 && (
                <span className="bg-gray-100 text-gray-500 text-[9px] rounded-full px-1.5 py-0.5 font-bold leading-none">{item.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-8 pb-12">
          <BandejaPrerreunion reunion={reunion} onAddTema={onAddTema} onToggleTema={onToggleTema} />
          <AudioenciasProxSemana reunion={reunion} audiencias={audiencias} />
          <CausasRevisadas reunion={reunion} onAddCausa={onAddCausa} />
          <DecisionesTomadas reunion={reunion} onAddDecision={onAddDecision} onToggleDecision={onToggleDecision} />
          <TareasGeneradas reunion={reunion} tareas={tareas} />
          <ProximaAccionSection reunion={reunion} onUpdate={onUpdate} />
          <MinutaSection reunion={reunion} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  )
}

// ── Mapper ────────────────────────────────────────────────────────────────────
function mapReunionRow(row) {
  return {
    id:                String(row.id),
    fecha:             row.fecha             || '',
    hora_inicio:       row.hora_inicio       || '09:00',
    hora_fin:          row.hora_fin          || null,
    estado:            row.estado            || 'Programada',
    tipo:              row.tipo              || 'Reunión semanal',
    participantes:     Array.isArray(row.participantes)     ? row.participantes     : ['MT','AB','CL'],
    bandeja:           Array.isArray(row.bandeja)           ? row.bandeja           : [],
    causas_discutidas: Array.isArray(row.causas_discutidas) ? row.causas_discutidas : [],
    decisiones:        Array.isArray(row.decisiones)        ? row.decisiones        : [],
    tareas_ids:        Array.isArray(row.tareas_ids)        ? row.tareas_ids        : [],
    proxima_accion:    row.proxima_accion    || '',
    proxima_reunion:   row.proxima_reunion   || null,
    minuta:            row.minuta            || '',
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Reuniones() {
  const [reuniones,  setReuniones]  = useState([])
  const [audiencias, setAudiencias] = useState([])
  const [tareas,     setTareas]     = useState([])
  const [view,       setView]       = useState('list')
  const [selectedId, setSelectedId] = useState(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('reuniones')
      .select('*')
      .order('fecha', { ascending: false })
      .then(({ data }) => setReuniones((data || []).map(mapReunionRow)))
    supabase.from('audiencias')
      .select('id, tipo, fecha, hora, causa_rit, estado, cliente_nombre')
      .then(({ data }) => setAudiencias(data || []))
    supabase.from('tareas')
      .select('id, titulo, fecha_vencimiento, estado, causa_rit, cliente_nombre')
      .then(({ data }) => setTareas(data || []))
  }, [])

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const addReunion = useCallback(async (reunion) => {
    const payload = {
      fecha:             reunion.fecha || new Date().toISOString().slice(0,10),
      hora_inicio:       reunion.hora_inicio       || '09:00',
      estado:            reunion.estado            || 'Programada',
      tipo:              reunion.tipo              || 'Reunión semanal',
      participantes:     reunion.participantes     || ['MT','AB','CL'],
      bandeja:           reunion.bandeja           || [],
      causas_discutidas: reunion.causas_discutidas || [],
      decisiones:        reunion.decisiones        || [],
      tareas_ids:        reunion.tareas_ids        || [],
      proxima_accion:    reunion.proxima_accion    || '',
      minuta:            reunion.minuta            || '',
    }
    const { data, error } = await supabase.from('reuniones').insert([payload]).select().single()
    if (error) { console.error('Error al crear reunión:', error.message); return }
    setReuniones(prev => [mapReunionRow(data), ...prev])
  }, [])

  const updateReunion = useCallback(async (reunionId, changes) => {
    setReuniones(prev => prev.map(r => r.id === reunionId ? { ...r, ...changes } : r))
    const allowed = new Set(['fecha','hora_inicio','hora_fin','estado','tipo','participantes',
      'bandeja','causas_discutidas','decisiones','tareas_ids','proxima_accion','proxima_reunion','minuta'])
    const payload = Object.fromEntries(Object.entries(changes).filter(([k]) => allowed.has(k)))
    if (Object.keys(payload).length) {
      const { error } = await supabase.from('reuniones').update(payload).eq('id', reunionId)
      if (error) console.error('Error al actualizar reunión:', error.message)
    }
  }, [])

  const addTemaReunion = useCallback((reunionId, tema) => {
    setReuniones(prev => {
      const reunion = prev.find(r => r.id === reunionId)
      if (!reunion) return prev
      const newBandeja = [...reunion.bandeja, tema]
      supabase.from('reuniones').update({ bandeja: newBandeja }).eq('id', reunionId)
        .then(({ error }) => { if (error) console.error('addTema:', error.message) })
      return prev.map(r => r.id === reunionId ? { ...r, bandeja: newBandeja } : r)
    })
  }, [])

  const toggleTemaDiscutido = useCallback((reunionId, temaId) => {
    setReuniones(prev => {
      const reunion = prev.find(r => r.id === reunionId)
      if (!reunion) return prev
      const newBandeja = reunion.bandeja.map(t => t.id === temaId ? { ...t, discutido: !t.discutido } : t)
      supabase.from('reuniones').update({ bandeja: newBandeja }).eq('id', reunionId)
        .then(({ error }) => { if (error) console.error('toggleTema:', error.message) })
      return prev.map(r => r.id === reunionId ? { ...r, bandeja: newBandeja } : r)
    })
  }, [])

  const addCausaDiscutida = useCallback((reunionId, causa) => {
    setReuniones(prev => {
      const reunion = prev.find(r => r.id === reunionId)
      if (!reunion) return prev
      const newCausas = [...reunion.causas_discutidas, causa]
      supabase.from('reuniones').update({ causas_discutidas: newCausas }).eq('id', reunionId)
        .then(({ error }) => { if (error) console.error('addCausa:', error.message) })
      return prev.map(r => r.id === reunionId ? { ...r, causas_discutidas: newCausas } : r)
    })
  }, [])

  const addDecisionReunion = useCallback((reunionId, decision) => {
    setReuniones(prev => {
      const reunion = prev.find(r => r.id === reunionId)
      if (!reunion) return prev
      const newDecisiones = [...reunion.decisiones, decision]
      supabase.from('reuniones').update({ decisiones: newDecisiones }).eq('id', reunionId)
        .then(({ error }) => { if (error) console.error('addDecision:', error.message) })
      return prev.map(r => r.id === reunionId ? { ...r, decisiones: newDecisiones } : r)
    })
  }, [])

  const toggleDecisionCompletada = useCallback((reunionId, decisionId) => {
    setReuniones(prev => {
      const reunion = prev.find(r => r.id === reunionId)
      if (!reunion) return prev
      const newDecisiones = reunion.decisiones.map(d =>
        d.id === decisionId ? { ...d, completada: !d.completada } : d
      )
      supabase.from('reuniones').update({ decisiones: newDecisiones }).eq('id', reunionId)
        .then(({ error }) => { if (error) console.error('toggleDecision:', error.message) })
      return prev.map(r => r.id === reunionId ? { ...r, decisiones: newDecisiones } : r)
    })
  }, [])

  const selectedReunion = useMemo(
    () => (reuniones || []).find(r => r.id === selectedId),
    [reuniones, selectedId]
  )

  function handleSelect(id) {
    setSelectedId(id)
    setView('detail')
  }

  if (view === 'detail' && selectedReunion) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <DetailView
          reunion={selectedReunion}
          audiencias={audiencias || []}
          tareas={tareas || []}
          onBack={() => setView('list')}
          onUpdate={updateReunion}
          onAddTema={addTemaReunion}
          onToggleTema={toggleTemaDiscutido}
          onAddCausa={addCausaDiscutida}
          onAddDecision={addDecisionReunion}
          onToggleDecision={toggleDecisionCompletada}
        />
      </div>
    )
  }

  return (
    <ListViewPage
      reuniones={reuniones || []}
      onSelect={handleSelect}
      onAdd={addReunion}
    />
  )
}
