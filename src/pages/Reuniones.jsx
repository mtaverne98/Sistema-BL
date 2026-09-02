import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Calendar, ChevronDown, Plus, X, Check, MessageSquare,
  CheckCircle2, RotateCcw, Loader2, Trash2, Scale, Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pushReunion, deleteReunionGEvent } from '../lib/googleCalendar'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

// ── Constants ─────────────────────────────────────────────────────────────────

const QUIEN = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Andrea B.',   color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

const TEMA_ESTADO = {
  pendiente:  { label: 'Pendiente',  dot: 'bg-amber-400',  text: 'text-amber-700', bg: 'bg-amber-50',  icon: null         },
  discutido:  { label: 'Discutido',  dot: 'bg-green-500',  text: 'text-green-700', bg: 'bg-green-50',  icon: Check        },
  postergado: { label: 'Postergado', dot: 'bg-slate-400',  text: 'text-slate-600', bg: 'bg-slate-100', icon: RotateCcw    },
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MESES_LARGO = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

// ── Date helpers ──────────────────────────────────────────────────────────────


function fmtLarga(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} ${d.getFullYear()}`
}

function getCountdown(fechaJueves) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const thu   = new Date(fechaJueves + 'T00:00:00')
  const diff  = Math.round((thu - today) / 86400000)
  if (diff === 0) return { label: '¡Hoy!',            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', isToday: true  }
  if (diff === 1) return { label: 'Mañana',            cls: 'bg-amber-50   text-amber-700   border-amber-200',  isToday: false }
  if (diff >  0) return { label: `En ${diff} días`,    cls: 'bg-blue-50    text-blue-700    border-blue-200',   isToday: false }
  if (diff === -1) return { label: 'Ayer',             cls: 'bg-gray-100   text-gray-500    border-gray-200',   isToday: false }
  return              { label: `Hace ${-diff} días`,   cls: 'bg-gray-100   text-gray-500    border-gray-200',   isToday: false }
}

// ── QuienBadge ────────────────────────────────────────────────────────────────
function QuienBadge({ quien }) {
  const q = QUIEN[quien] || { nombre: quien, color: '#94a3b8' }
  return (
    <span title={q.nombre}
      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 select-none"
      style={{ backgroundColor: q.color }}>
      {quien}
    </span>
  )
}

// ── TemaRow ───────────────────────────────────────────────────────────────────
function TemaRow({ tema, onToggle, onDelete, onSaveAcuerdos, readOnly = false }) {
  const [hov,          setHov]          = useState(false)
  const [acuerdos,     setAcuerdos]     = useState(tema.acuerdos ?? '')
  const [showAcuerdos, setShowAcuerdos] = useState(!!tema.acuerdos)
  const timerRef = useRef(null)

  const cfg      = TEMA_ESTADO[tema.estado] || TEMA_ESTADO.pendiente
  const NEXT     = { pendiente: 'discutido', discutido: 'postergado', postergado: 'pendiente' }
  const IconComp = cfg.icon

  function handleAcuerdosChange(val) {
    setAcuerdos(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSaveAcuerdos?.(tema.id, val), 800)
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`rounded-xl border transition-all ${
        tema.estado === 'discutido'
          ? 'bg-green-50/50 border-green-100'
          : tema.estado === 'postergado'
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
      }`}>

      {/* Top row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Toggle button */}
        {readOnly ? (
          <div className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.dot}`}>
            {IconComp && <IconComp size={8} className="text-white" strokeWidth={3}/>}
          </div>
        ) : (
          <button
            onClick={() => onToggle(tema.id, NEXT[tema.estado] || 'pendiente')}
            title={`→ ${TEMA_ESTADO[NEXT[tema.estado]]?.label}`}
            className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all hover:scale-110 ${
              tema.estado === 'discutido'
                ? 'bg-green-500 border-green-500'
                : tema.estado === 'postergado'
                ? 'bg-slate-300 border-slate-300'
                : 'border-amber-400 hover:bg-amber-50'
            }`}>
            {IconComp && <IconComp size={8} className="text-white" strokeWidth={3}/>}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] leading-snug ${
            tema.estado === 'discutido'  ? 'text-gray-400 line-through' :
            tema.estado === 'postergado' ? 'text-gray-400' :
            'text-gray-800'
          }`}>
            {tema.descripcion}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {tema.causa_rit && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                <Scale size={8}/> {tema.causa_rit}
              </span>
            )}
            {tema.cliente_nombre && (
              <span className="text-[10px] font-medium text-[#1a2e4a] bg-[#1a2e4a]/5 px-1.5 py-0.5 rounded uppercase">
                {tema.cliente_nombre}
              </span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <QuienBadge quien={tema.agregado_por}/>
          {!readOnly && hov && (
            <button onClick={() => onDelete(tema.id)}
              className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12}/>
            </button>
          )}
        </div>
      </div>

      {/* Acuerdos */}
      {!readOnly && (
        <div className="px-4 pb-3 ml-7">
          {showAcuerdos ? (
            <textarea
              value={acuerdos}
              onChange={e => handleAcuerdosChange(e.target.value)}
              rows={2}
              placeholder="Acuerdos y decisiones…"
              className="w-full text-[12px] text-gray-700 placeholder:text-gray-300 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#2570BA]/40 leading-relaxed"
            />
          ) : (
            <button
              onClick={() => setShowAcuerdos(true)}
              className="text-[11px] text-gray-300 hover:text-[#2570BA] transition-colors">
              + Acuerdo
            </button>
          )}
        </div>
      )}
      {readOnly && tema.acuerdos && (
        <div className="px-4 pb-3 ml-7">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Acuerdos</p>
          <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">{tema.acuerdos}</p>
        </div>
      )}
    </div>
  )
}

// ── AddTemaForm (inline) ──────────────────────────────────────────────────────
function AddTemaForm({ onSave, onCancel }) {
  const [desc,   setDesc]   = useState('')
  const [quien,  setQuien]  = useState('MT')
  const [causa,  setCausa]  = useState('')
  const [cliente,setCliente]= useState('')
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  function handleSave() {
    if (!desc.trim()) return
    onSave({
      descripcion:    desc.trim(),
      agregado_por:   quien,
      causa_rit:      causa.trim()   || null,
      cliente_nombre: cliente.trim() || null,
      estado:         'pendiente',
    })
  }

  return (
    <div className="rounded-xl border border-[#1a2e4a]/15 bg-[#1a2e4a]/[0.025] p-4 space-y-3">
      <textarea
        ref={ref}
        value={desc}
        onChange={e => setDesc(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        rows={2}
        placeholder="¿Qué tema hay que discutir en la reunión?"
        className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:border-[#1a2e4a]/40 placeholder:text-gray-300"
      />

      <div className="flex items-center gap-4 flex-wrap">
        {/* Quién agrega */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Agrega</span>
          <div className="flex gap-1">
            {Object.keys(QUIEN).map(q => (
              <button
                key={q}
                onClick={() => setQuien(q)}
                title={QUIEN[q].nombre}
                className={`w-6 h-6 rounded-full text-[9px] font-bold text-white transition-all ${
                  quien === q ? 'ring-2 ring-offset-1 scale-110' : 'opacity-40 hover:opacity-70'
                }`}
                style={{ backgroundColor: QUIEN[q].color, ringColor: QUIEN[q].color }}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* RIT */}
        <input
          value={causa}
          onChange={e => setCausa(e.target.value)}
          placeholder="RIT (opcional)"
          className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-28 font-mono"
        />

        {/* Cliente */}
        <input
          value={cliente}
          onChange={e => setCliente(e.target.value)}
          placeholder="Cliente (opcional)"
          className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-36"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!desc.trim()}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-lg hover:bg-[#2570BA]/90 disabled:opacity-40 transition-colors">
          <Plus size={12}/> Agregar tema
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-400 px-3.5 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── HistorialItem (accordion) ─────────────────────────────────────────────────
function HistorialItem({ reunion, temas, onDeleteReunion, onSelect }) {
  const [open, setOpen] = useState(false)
  const ts   = temas.filter(t => t.fecha_jueves === reunion.fecha_jueves)
  const disc = ts.filter(t => t.estado === 'discutido').length
  const post = ts.filter(t => t.estado === 'postergado').length
  const pend = ts.filter(t => t.estado === 'pendiente').length
  const d    = new Date(reunion.fecha_jueves + 'T12:00:00')

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
          open ? 'bg-[#1a2e4a]/[0.03]' : 'bg-white hover:bg-gray-50'
        }`}>

        {/* Calendar mini */}
        <div className="w-11 h-11 rounded-xl bg-[#1a2e4a]/8 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-[#1a2e4a] leading-none">{d.getDate()}</span>
          <span className="text-[9px] text-[#1a2e4a]/60 leading-none mt-0.5 uppercase">{MESES[d.getMonth()]}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1a2e4a]">{fmtLarga(reunion.fecha_jueves)}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] text-gray-400">{ts.length} tema{ts.length !== 1 ? 's' : ''}</span>
            {disc > 0 && <span className="text-[11px] text-green-600 font-medium">✓ {disc} discutido{disc !== 1 ? 's' : ''}</span>}
            {post > 0 && <span className="text-[11px] text-slate-500">↷ {post} postergado{post !== 1 ? 's' : ''}</span>}
            {pend > 0 && <span className="text-[11px] text-amber-600">● {pend} pendiente{pend !== 1 ? 's' : ''}</span>}
            {reunion.acuerdos && (
              <span className="text-[11px] text-[#2570ba] font-medium flex items-center gap-1">
                <MessageSquare size={9}/> Acuerdos
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {reunion.estado === 'realizada' && (
            <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
              <CheckCircle2 size={9}/> Realizada
            </span>
          )}
          {onSelect && (
            <button
              onClick={e => { e.stopPropagation(); onSelect() }}
              className="text-[10px] font-semibold text-[#2570BA] hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              title="Ver reunión activa">
              Ver
            </button>
          )}
          {onDeleteReunion && (
            <button
              onClick={e => { e.stopPropagation(); onDeleteReunion(reunion) }}
              className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              title="Eliminar reunión">
              <Trash2 size={13}/>
            </button>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 bg-[#fafafa] px-5 py-4 space-y-3">
          {ts.length === 0 ? (
            <p className="text-[12px] text-gray-400 italic py-2">Sin temas registrados</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const conCliente = ts.filter(t => t.cliente_nombre)
                const sinCliente = ts.filter(t => !t.cliente_nombre)
                const byLetter   = {}
                conCliente.forEach(t => {
                  const l = t.cliente_nombre.trim().charAt(0).toUpperCase() || '#'
                  if (!byLetter[l]) byLetter[l] = []
                  byLetter[l].push(t)
                })
                const sections  = Object.entries(byLetter).sort(([a], [b]) => a.localeCompare(b))
                const hasGroups = sections.length > 0
                return (
                  <>
                    {sections.map(([letra, lista]) => (
                      <div key={letra} className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest pt-1 pb-0.5">{letra}</p>
                        {lista.map(t => (
                          <TemaRow key={t.id} tema={t} readOnly onToggle={() => {}} onDelete={() => {}}/>
                        ))}
                      </div>
                    ))}
                    {sinCliente.length > 0 && (
                      <div className="space-y-2">
                        {hasGroups && <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest pt-1 pb-0.5">Sin cliente</p>}
                        {sinCliente.map(t => (
                          <TemaRow key={t.id} tema={t} readOnly onToggle={() => {}} onDelete={() => {}}/>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {reunion.acuerdos && (
            <div className="mt-1 rounded-xl border border-[#1a2e4a]/10 bg-white p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <MessageSquare size={10}/> Acuerdos y decisiones
              </p>
              <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{reunion.acuerdos}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Reuniones() {
  const [reuniones,      setReuniones]      = useState([])
  const [temas,          setTemas]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState('actual')   // 'actual' | 'historial'
  const [showAdd,        setShowAdd]        = useState(false)
  const [acuerdosDraft,  setAcuerdosDraft]  = useState('')
  const [savingAcuerdos, setSavingAcuerdos] = useState(false)
  const [savedFlash,     setSavedFlash]     = useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [activeDate,     setActiveDate]     = useState(null)   // null = sin reunión seleccionada
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [newDateDraft,   setNewDateDraft]   = useState('')

  const countdown = useMemo(() => activeDate ? getCountdown(activeDate) : null, [activeDate])

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: reuns }, { data: tms }] = await Promise.all([
      supabase.from('reuniones').select('*').order('fecha_jueves', { ascending: false }),
      supabase.from('reunion_temas').select('*').order('created_at'),
    ])
    const listaReuns = reuns || []
    setReuniones(listaReuns)
    setTemas(tms || [])
    // Seleccionar automáticamente la reunión más reciente si no hay ninguna activa
    if (!activeDate && listaReuns.length > 0) {
      setActiveDate(listaReuns[0].fecha_jueves)
    }
    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived ──
  const reunionActual = useMemo(
    () => activeDate ? (reuniones.find(r => r.fecha_jueves === activeDate) || null) : null,
    [reuniones, activeDate],
  )

  const temasActuales = useMemo(
    () => activeDate
      ? temas.filter(t => t.fecha_jueves === activeDate).sort((a, b) => a.created_at > b.created_at ? 1 : -1)
      : [],
    [temas, activeDate],
  )

  const historial = useMemo(
    () => reuniones
      .filter(r => r.fecha_jueves !== activeDate)
      .sort((a, b) => b.fecha_jueves.localeCompare(a.fecha_jueves)),
    [reuniones, activeDate],
  )

  // Stats
  const stats = useMemo(() => ({
    total:    temasActuales.length,
    disc:     temasActuales.filter(t => t.estado === 'discutido').length,
    post:     temasActuales.filter(t => t.estado === 'postergado').length,
    pend:     temasActuales.filter(t => t.estado === 'pendiente').length,
  }), [temasActuales])

  // Sync acuerdos draft
  useEffect(() => {
    if (reunionActual?.acuerdos != null) setAcuerdosDraft(reunionActual.acuerdos)
  }, [reunionActual?.id]) // eslint-disable-line

  // ── Handlers ──

  async function handleCrearReunion() {
    if (!newDateDraft) return
    const { data } = await supabase
      .from('reuniones')
      .insert([{ fecha_jueves: newDateDraft, estado: 'pendiente' }])
      .select()
      .single()
    if (data) {
      setReuniones(prev => [data, ...prev].sort((a, b) => b.fecha_jueves.localeCompare(a.fecha_jueves)))
      setActiveDate(newDateDraft)
    }
    setShowDatePicker(false)
    setNewDateDraft('')
    setTab('actual')
  }

  async function ensureReunion() {
    if (reunionActual) return reunionActual.id
    if (!activeDate) return null
    const { data } = await supabase
      .from('reuniones')
      .insert([{ fecha_jueves: activeDate, estado: 'pendiente' }])
      .select()
      .single()
    setReuniones(prev => [data, ...prev])
    pushReunion(data, supabase).then(gcalId => {
      if (gcalId) setReuniones(prev => prev.map(r => r.id === data.id ? { ...r, google_event_id: gcalId } : r))
    }).catch(() => {})
    return data.id
  }

  async function handleAddTema(draft) {
    const reunion_id = await ensureReunion()
    if (!reunion_id || !activeDate) return
    const { data } = await supabase
      .from('reunion_temas')
      .insert([{ ...draft, fecha_jueves: activeDate, reunion_id }])
      .select()
      .single()
    if (data) setTemas(prev => [...prev, data])
    setShowAdd(false)
  }

  async function handleToggle(temaId, nuevoEstado) {
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, estado: nuevoEstado } : t))
    await supabase.from('reunion_temas').update({ estado: nuevoEstado }).eq('id', temaId)
  }

  async function handleDelete(temaId) {
    setTemas(prev => prev.filter(t => t.id !== temaId))
    await supabase.from('reunion_temas').delete().eq('id', temaId)
  }

  async function handleSaveAcuerdos(temaId, value) {
    const trimmed = value.trim() || null
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, acuerdos: trimmed } : t))
    await supabase.from('reunion_temas').update({ acuerdos: trimmed }).eq('id', temaId)
  }

  async function handleDeleteReunion() {
    if (!deleteTarget) return
    const reunion = reuniones.find(r => r.id === deleteTarget.id)
    if (reunion?.google_event_id) {
      deleteReunionGEvent(reunion.google_event_id, supabase).catch(() => {})
    }
    await supabase.from('reuniones').delete().eq('id', deleteTarget.id)
    setReuniones(prev => prev.filter(r => r.id !== deleteTarget.id))
    setTemas(prev => prev.filter(t => t.fecha_jueves !== deleteTarget.fecha_jueves))
    setDeleteTarget(null)
  }

  async function handleSaveAcuerdos(marcarRealizada = false) {
    setSavingAcuerdos(true)
    const rid = await ensureReunion()
    const upd = { acuerdos: acuerdosDraft }
    if (marcarRealizada) upd.estado = 'realizada'
    await supabase.from('reuniones').update(upd).eq('id', rid)
    setReuniones(prev => prev.map(r => r.id === rid ? { ...r, ...upd } : r))
    setSavingAcuerdos(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#1a2e4a]">Reuniones de equipo</h1>
            <p className="text-xs text-gray-400 mt-0.5">{reuniones.length} reunión{reuniones.length !== 1 ? 'es' : ''} registrada{reuniones.length !== 1 ? 's' : ''}</p>
          </div>
          {showDatePicker ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newDateDraft}
                onChange={e => setNewDateDraft(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#2570BA]"
                autoFocus
              />
              <button onClick={handleCrearReunion} disabled={!newDateDraft}
                className="text-xs font-semibold bg-[#2570BA] text-white px-3 py-2 rounded-lg hover:bg-[#2570BA]/90 disabled:opacity-40 transition-colors">
                Crear
              </button>
              <button onClick={() => { setShowDatePicker(false); setNewDateDraft('') }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={13}/>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowDatePicker(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
              <Plus size={13}/> Nueva reunión
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'actual',   label: 'Esta semana'    },
            { id: 'historial', label: `Historial${historial.length ? ` · ${historial.length}` : ''}` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                tab === t.id ? 'bg-[#2570BA] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 fab-clear">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300"/>
          </div>
        ) : tab === 'actual' ? (
          // ───────── Esta semana ─────────
          <div className="max-w-2xl space-y-5">

            {/* Sin reunión activa */}
            {!activeDate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 text-center">
                <Calendar size={28} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-400 font-medium">No hay reunión activa</p>
                <p className="text-[12px] text-gray-300 mt-1 mb-4">Crea una nueva reunión eligiendo la fecha</p>
                <button onClick={() => setShowDatePicker(true)}
                  className="text-xs font-semibold text-[#2570BA] hover:underline">
                  + Nueva reunión
                </button>
              </div>
            )}

            {/* Meeting info card */}
            {activeDate && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#2570BA] flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-white"/>
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-bold text-[#1a2e4a]">{fmtLarga(activeDate)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {stats.total > 0
                    ? <>
                        {stats.total} tema{stats.total !== 1 ? 's' : ''}
                        {stats.disc > 0 && <span className="text-green-600 ml-2">· {stats.disc} discutido{stats.disc !== 1 ? 's' : ''}</span>}
                        {stats.pend > 0 && <span className="text-amber-600 ml-2">· {stats.pend} pendiente{stats.pend !== 1 ? 's' : ''}</span>}
                        {stats.post > 0 && <span className="text-slate-500 ml-2">· {stats.post} postergado{stats.post !== 1 ? 's' : ''}</span>}
                      </>
                    : 'Sin temas aún'}
                </p>
              </div>
              {countdown && <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${countdown.cls}`}>
                {countdown.label}
              </span>}
              {reunionActual?.estado === 'realizada' && (
                <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 size={10}/> Realizada
                </span>
              )}
            </div>}

            {/* ── Temas y acuerdos (solo si hay reunión activa) ── */}
            {activeDate && <><div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-bold text-[#1a2e4a]">Temas para discutir</h2>
                  {stats.pend > 0 && (
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      {stats.pend} pendiente{stats.pend !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowAdd(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
                  <Plus size={13}/> Agregar tema
                </button>
              </div>

              <div className="p-4 space-y-2">
                {/* Empty state */}
                {temasActuales.length === 0 && !showAdd && (
                  <div className="py-10 text-center">
                    <div className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare size={18} className="text-gray-300"/>
                    </div>
                    <p className="text-[13px] text-gray-400 font-medium">Sin temas anotados aún</p>
                    <p className="text-[11px] text-gray-300 mt-1">Agrega los temas que quieras discutir el jueves</p>
                    <button
                      onClick={() => setShowAdd(true)}
                      className="mt-3 text-[12px] text-[#2570ba] hover:underline font-medium">
                      + Anotar primer tema
                    </button>
                  </div>
                )}

                {/* Lista de temas A-Z por cliente */}
                {(() => {
                  const conCliente  = temasActuales.filter(t => t.cliente_nombre)
                  const sinCliente  = temasActuales.filter(t => !t.cliente_nombre)
                  const byLetter    = {}
                  conCliente.forEach(t => {
                    const l = t.cliente_nombre.trim().charAt(0).toUpperCase() || '#'
                    if (!byLetter[l]) byLetter[l] = []
                    byLetter[l].push(t)
                  })
                  const sections = Object.entries(byLetter).sort(([a], [b]) => a.localeCompare(b))
                  const hasGroups = sections.length > 0
                  return (
                    <>
                      {sections.map(([letra, lista]) => (
                        <div key={letra} className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest pt-1 pb-0.5">{letra}</p>
                          {lista.map(t => (
                            <TemaRow key={t.id} tema={t} onToggle={handleToggle} onDelete={handleDelete} onSaveAcuerdos={handleSaveAcuerdos} />
                          ))}
                        </div>
                      ))}
                      {sinCliente.length > 0 && (
                        <div className="space-y-2">
                          {hasGroups && <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest pt-1 pb-0.5">Sin cliente</p>}
                          {sinCliente.map(t => (
                            <TemaRow key={t.id} tema={t} onToggle={handleToggle} onDelete={handleDelete} onSaveAcuerdos={handleSaveAcuerdos} />
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Inline add form */}
                {showAdd && (
                  <AddTemaForm
                    onSave={handleAddTema}
                    onCancel={() => setShowAdd(false)}
                  />
                )}
              </div>

              {/* Pill legend */}
              {temasActuales.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-4 bg-gray-50/40">
                  <span className="text-[10px] text-gray-400 font-medium">Haz clic en el círculo para cambiar estado:</span>
                  {Object.values(TEMA_ESTADO).map(cfg => (
                    <span key={cfg.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}/>
                      {cfg.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Acuerdos ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-[#1a2e4a]"/>
                  <h2 className="text-[13px] font-bold text-[#1a2e4a]">Acuerdos y decisiones</h2>
                </div>
                {countdown?.isToday && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Reunión activa
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                <textarea
                  value={acuerdosDraft}
                  onChange={e => setAcuerdosDraft(e.target.value)}
                  rows={4}
                  placeholder="Anota los acuerdos, decisiones y compromisos tomados en la reunión…"
                  className="w-full text-[13px] border border-gray-200 rounded-xl px-3.5 py-3 resize-none focus:outline-none focus:border-[#1a2e4a]/30 bg-gray-50/50 placeholder:text-gray-300 leading-relaxed"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveAcuerdos(false)}
                    disabled={savingAcuerdos}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-4 py-2 rounded-xl hover:bg-[#2570BA]/90 disabled:opacity-40 transition-colors shadow-sm">
                    {savingAcuerdos
                      ? <Loader2 size={12} className="animate-spin"/>
                      : savedFlash
                      ? <Check size={12}/>
                      : null}
                    {savedFlash ? 'Guardado' : 'Guardar acuerdos'}
                  </button>

                  {reunionActual?.estado !== 'realizada' && (
                    <button
                      onClick={() => handleSaveAcuerdos(true)}
                      disabled={savingAcuerdos}
                      className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 px-4 py-2 rounded-xl hover:bg-green-100 disabled:opacity-40 transition-colors">
                      <CheckCircle2 size={12}/> Marcar como realizada
                    </button>
                  )}
                </div>

                {reunionActual?.estado === 'realizada' && (
                  <p className="text-[11px] text-green-600 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={11}/> Reunión marcada como realizada
                  </p>
                )}
              </div>
            </div></>}
          </div>

        ) : (
          // ───────── Historial ─────────
          <div className="max-w-2xl space-y-3">
            {historial.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <Calendar size={22} strokeWidth={1.5} className="text-gray-300"/>
                </div>
                <p className="text-sm text-gray-400 font-medium">Sin reuniones anteriores</p>
                <p className="text-[12px] text-gray-300 mt-1">Las reuniones pasadas aparecerán aquí</p>
              </div>
            ) : (
              historial.map(r => (
                <HistorialItem key={r.id} reunion={r} temas={temas}
                  onSelect={() => { setActiveDate(r.fecha_jueves); setTab('actual') }}
                  onDeleteReunion={r => setDeleteTarget({ id: r.id, fecha_jueves: r.fecha_jueves, name: `la reunión del ${fmtLarga(r.fecha_jueves)}` })}
                />
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        warning="Los temas de esta reunión también se eliminarán."
        onConfirm={handleDeleteReunion}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
