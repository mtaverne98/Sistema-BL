import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Calendar, ChevronDown, Plus, X, Check,
  CheckCircle2, RotateCcw, Loader2, Trash2,
  ArrowRight, Users, Scale, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pushReunion, deleteReunionGEvent } from '../lib/googleCalendar'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

// ── Constants ────────────────────────────────────────────────────────────────

const QUIEN = {
  MT: { nombre: 'Macarena T.',  color: '#1a2e4a' },
  AB: { nombre: 'María A. B.',  color: '#2570ba' },
  CL: { nombre: 'Claudia L.',   color: '#059669' },
}

const TEMA_ESTADO = {
  pendiente:  { label: 'Pendiente',  dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50',  icon: null      },
  discutido:  { label: 'Discutido',  dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  icon: Check     },
  postergado: { label: 'Postergado', dot: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-100', icon: RotateCcw },
}

const MESES      = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS       = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const TODAY_ISO  = new Date().toISOString().split('T')[0]

// ── Date helpers ─────────────────────────────────────────────────────────────

function fmtLarga(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} ${d.getFullYear()}`
}

function getCountdown(fecha) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d     = new Date(fecha + 'T00:00:00')
  const diff  = Math.round((d - today) / 86400000)
  if (diff === 0)  return { label: '¡Hoy!',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', isToday: true  }
  if (diff === 1)  return { label: 'Mañana',          cls: 'bg-amber-50   text-amber-700   border-amber-200',  isToday: false }
  if (diff >  0)   return { label: `En ${diff} días`, cls: 'bg-blue-50    text-blue-700    border-blue-200',   isToday: false }
  if (diff === -1) return { label: 'Ayer',            cls: 'bg-gray-100   text-gray-500    border-gray-200',   isToday: false }
  return               { label: `Hace ${-diff} días`, cls: 'bg-gray-100   text-gray-500    border-gray-200',   isToday: false }
}

// ── QuienBadge ───────────────────────────────────────────────────────────────

function QuienBadge({ quien, size = 'sm' }) {
  const q  = QUIEN[quien] || { nombre: quien, color: '#94a3b8' }
  const sz = size === 'lg' ? 'w-6 h-6 text-[10px]' : 'w-5 h-5 text-[9px]'
  return (
    <span title={q.nombre}
      className={`${sz} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none`}
      style={{ backgroundColor: q.color }}>
      {quien}
    </span>
  )
}

// ── TareaChip ────────────────────────────────────────────────────────────────

function TareaChip({ tarea }) {
  const completada = tarea.estado === 'Completada'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
      completada
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through opacity-70'
        : 'bg-blue-50 text-[#2570ba] border-blue-200'
    }`}>
      {completada ? <Check size={8} strokeWidth={3}/> : <Clock size={8}/>}
      {tarea.titulo}
    </span>
  )
}

// ── CrearTareaForm ───────────────────────────────────────────────────────────

function CrearTareaForm({ tema, onSave, onCancel }) {
  const [titulo,         setTitulo]        = useState(tema.acuerdos?.trim() || '')
  const [responsable,    setResponsable]   = useState(tema.agregado_por === 'AB' ? 'AB' : 'MT')
  const [fechaLimite,    setFechaLimite]   = useState('')
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function handleSave() {
    if (!titulo.trim()) return
    onSave({ titulo: titulo.trim(), responsable, fecha_vencimiento: fechaLimite || null })
  }

  return (
    <div className="mt-2 rounded-xl border border-[#2570ba]/20 bg-[#2570ba]/[0.025] p-3 space-y-2.5">
      <textarea
        ref={ref}
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        rows={2}
        placeholder="Descripción de la tarea…"
        className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:border-[#2570ba]/40 placeholder:text-gray-300"
      />
      <div className="flex items-center gap-3 flex-wrap">
        {/* Responsable */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Responsable</span>
          <div className="flex gap-1">
            {['MT', 'AB'].map(q => (
              <button key={q} onClick={() => setResponsable(q)} title={QUIEN[q]?.nombre}
                className={`w-6 h-6 rounded-full text-[9px] font-bold text-white transition-all ${
                  responsable === q ? 'ring-2 ring-offset-1 opacity-100 scale-110' : 'opacity-40 hover:opacity-70'
                }`}
                style={{ backgroundColor: QUIEN[q]?.color, ringColor: QUIEN[q]?.color }}>
                {q}
              </button>
            ))}
          </div>
        </div>
        {/* Fecha límite */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Límite</span>
          <input
            type="date"
            value={fechaLimite}
            min={TODAY_ISO}
            onChange={e => setFechaLimite(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue-300"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!titulo.trim()}
          className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#2570ba] text-white px-3 py-1.5 rounded-lg hover:bg-[#2570ba]/90 disabled:opacity-40 transition-colors">
          <Check size={11}/> Crear tarea
        </button>
        <button onClick={onCancel}
          className="text-[11px] text-gray-400 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── TemaRow ──────────────────────────────────────────────────────────────────

function TemaRow({ tema, mode, onToggle, onDelete, onSaveNotas, onCrearTarea, tareasDelTema = [] }) {
  const [hov,          setHov]          = useState(false)
  const [notas,        setNotas]        = useState(tema.acuerdos ?? '')
  const [showForm,     setShowForm]     = useState(false)
  const [guardando,    setGuardando]    = useState(false)
  const timerRef = useRef(null)

  // Sync notas if tema changes (e.g. after refetch)
  useEffect(() => { setNotas(tema.acuerdos ?? '') }, [tema.id]) // eslint-disable-line

  const cfg  = TEMA_ESTADO[tema.estado] || TEMA_ESTADO.pendiente
  const NEXT = { pendiente: 'discutido', discutido: 'postergado', postergado: 'pendiente' }
  const Icon = cfg.icon

  function handleNotasChange(val) {
    setNotas(val)
    clearTimeout(timerRef.current)
    setGuardando(true)
    timerRef.current = setTimeout(async () => {
      await onSaveNotas?.(tema.id, val)
      setGuardando(false)
    }, 800)
  }

  const isReadonly = mode === 'readonly'
  const isTrabajo  = mode === 'trabajo'

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
        {/* Toggle */}
        {isReadonly ? (
          <div className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${cfg.dot}`}>
            {Icon && <Icon size={8} className="text-white" strokeWidth={3}/>}
          </div>
        ) : (
          <button
            onClick={() => onToggle(tema.id, NEXT[tema.estado] || 'pendiente')}
            title={`→ ${TEMA_ESTADO[NEXT[tema.estado]]?.label}`}
            className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all hover:scale-110 ${
              tema.estado === 'discutido'  ? 'bg-green-500 border-green-500'  :
              tema.estado === 'postergado' ? 'bg-slate-300 border-slate-300'  :
              'border-amber-400 hover:bg-amber-50'
            }`}>
            {Icon && <Icon size={8} className="text-white" strokeWidth={3}/>}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] leading-snug ${
            tema.estado === 'discutido'  ? 'text-gray-400 line-through' :
            tema.estado === 'postergado' ? 'text-gray-400' : 'text-gray-800'
          }`}>
            {tema.descripcion}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {tema.causa_rit && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                <Scale size={8}/>{tema.causa_rit}
              </span>
            )}
            {tema.cliente_nombre && (
              <span className="text-[10px] font-medium text-[#1a2e4a] bg-[#1a2e4a]/5 px-1.5 py-0.5 rounded uppercase">
                {tema.cliente_nombre}
              </span>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <QuienBadge quien={tema.agregado_por}/>
          {!isReadonly && hov && (
            <button onClick={() => onDelete(tema.id)}
              className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={12}/>
            </button>
          )}
        </div>
      </div>

      {/* Notas + tarea creation (trabajo mode) */}
      {(isTrabajo || isReadonly) && (
        <div className="px-4 pb-3 ml-7 space-y-2">
          {/* Notas textarea */}
          {isReadonly ? (
            notas && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Apuntes</p>
                <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">{notas}</p>
              </div>
            )
          ) : (
            <div className="relative">
              <textarea
                value={notas}
                onChange={e => handleNotasChange(e.target.value)}
                rows={notas ? Math.max(2, notas.split('\n').length) : 2}
                placeholder="Apuntes, instrucciones y acuerdos de este tema…"
                className="w-full text-[12px] text-gray-700 placeholder:text-gray-300 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#2570ba]/40 leading-relaxed"
              />
              {guardando && (
                <span className="absolute bottom-2 right-2 text-[10px] text-gray-300">guardando…</span>
              )}
            </div>
          )}

          {/* Tareas chips */}
          {tareasDelTema.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tareasDelTema.map(t => <TareaChip key={t.id} tarea={t}/>)}
            </div>
          )}

          {/* Crear tarea button / form */}
          {isTrabajo && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-[#2570ba] hover:text-[#2570ba]/80 transition-colors">
              <ArrowRight size={10}/> Crear tarea
            </button>
          )}
          {isTrabajo && showForm && (
            <CrearTareaForm
              tema={tema}
              onSave={async (vals) => {
                await onCrearTarea?.(tema, vals)
                setShowForm(false)
              }}
              onCancel={() => setShowForm(false)}
            />
          )}
        </div>
      )}

      {/* Acuerdos label for preparacion mode (legacy, hidden) */}
    </div>
  )
}

// ── AddTemaForm ──────────────────────────────────────────────────────────────

function AddTemaForm({ onSave, onCancel }) {
  const [desc,    setDesc]    = useState('')
  const [quien,   setQuien]   = useState('MT')
  const [causa,   setCausa]   = useState('')
  const [cliente, setCliente] = useState('')
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
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Agrega</span>
          <div className="flex gap-1">
            {Object.keys(QUIEN).map(q => (
              <button key={q} onClick={() => setQuien(q)} title={QUIEN[q].nombre}
                className={`w-6 h-6 rounded-full text-[9px] font-bold text-white transition-all ${
                  quien === q ? 'ring-2 ring-offset-1 scale-110' : 'opacity-40 hover:opacity-70'
                }`}
                style={{ backgroundColor: QUIEN[q].color, ringColor: QUIEN[q].color }}>
                {q}
              </button>
            ))}
          </div>
        </div>
        <input value={causa} onChange={e => setCausa(e.target.value)}
          placeholder="RIT (opcional)"
          className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-28 font-mono"/>
        <input value={cliente} onChange={e => setCliente(e.target.value)}
          placeholder="Cliente (opcional)"
          className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-36"/>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!desc.trim()}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570ba] text-white px-3.5 py-2 rounded-lg hover:bg-[#2570ba]/90 disabled:opacity-40 transition-colors">
          <Plus size={12}/> Agregar tema
        </button>
        <button onClick={onCancel}
          className="text-xs text-gray-400 px-3.5 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── SeguimientoTareas ────────────────────────────────────────────────────────

function SeguimientoTareas({ tareas }) {
  if (tareas.length === 0) return null
  const completadas = tareas.filter(t => t.estado === 'Completada').length
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-[#1a2e4a]">Seguimiento de tareas</h2>
        <span className="text-[11px] text-gray-400">
          {completadas}/{tareas.length} completada{tareas.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {tareas.map(t => (
          <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              t.estado === 'Completada' ? 'bg-emerald-500' : 'bg-amber-400'
            }`}/>
            <p className={`flex-1 text-[12px] ${
              t.estado === 'Completada' ? 'text-gray-400 line-through' : 'text-gray-700'
            }`}>{t.titulo}</p>
            {t.cliente_nombre && (
              <span className="text-[10px] text-[#1a2e4a] bg-[#1a2e4a]/5 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                {t.cliente_nombre}
              </span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
              t.estado === 'Completada' ? 'bg-emerald-50 text-emerald-700' :
              t.estado === 'Vencida'    ? 'bg-red-50 text-red-600'         :
              'bg-amber-50 text-amber-700'
            }`}>{t.estado}</span>
            {t.responsable && (
              <QuienBadge quien={t.responsable}/>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HistorialItem ─────────────────────────────────────────────────────────────

function HistorialItem({ reunion, temas, tareas, onDeleteReunion }) {
  const [open, setOpen] = useState(false)
  const ts  = temas.filter(t => t.fecha_jueves === reunion.fecha_jueves)
  const temaIds = new Set(ts.map(t => t.id))
  const txs = tareas.filter(t => temaIds.has(t.reunion_tema_id))
  const completadas = txs.filter(t => t.estado === 'Completada').length
  const d   = new Date(reunion.fecha_jueves + 'T12:00:00')

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div
        onClick={() => setOpen(o => !o)}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o) }}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors cursor-pointer select-none ${
          open ? 'bg-[#1a2e4a]/[0.03]' : 'bg-white hover:bg-gray-50'
        }`}>

        <div className="w-11 h-11 rounded-xl bg-[#1a2e4a]/8 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-bold text-[#1a2e4a] leading-none">{d.getDate()}</span>
          <span className="text-[9px] text-[#1a2e4a]/60 leading-none mt-0.5 uppercase">{MESES[d.getMonth()]}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1a2e4a]">{fmtLarga(reunion.fecha_jueves)}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-[11px] text-gray-400">{ts.length} tema{ts.length !== 1 ? 's' : ''}</span>
            {txs.length > 0 && (
              <span className="text-[11px] text-[#2570ba]">
                {txs.length} tarea{txs.length !== 1 ? 's' : ''} · {completadas} completada{completadas !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
            <CheckCircle2 size={9}/> Realizada
          </span>
          {onDeleteReunion && (
            <button onClick={e => { e.stopPropagation(); onDeleteReunion(reunion) }}
              className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors no-touch-min">
              <Trash2 size={13}/>
            </button>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}/>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-[#fafafa] px-5 py-4 space-y-3">
          {ts.length === 0 ? (
            <p className="text-[12px] text-gray-400 italic">Sin temas registrados</p>
          ) : (
            <div className="space-y-2">
              {ts.map(t => (
                <TemaRow
                  key={t.id} tema={t} mode="readonly"
                  onToggle={() => {}} onDelete={() => {}} onSaveNotas={() => {}}
                  tareasDelTema={tareas.filter(tx => tx.reunion_tema_id === t.id)}
                />
              ))}
            </div>
          )}
          {txs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tareas creadas en esta reunión</p>
              <div className="space-y-1">
                {txs.map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      t.estado === 'Completada' ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}/>
                    <p className={`text-[12px] flex-1 ${t.estado === 'Completada' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.titulo}</p>
                    <span className={`text-[9px] font-medium px-1.5 py-px rounded ${
                      t.estado === 'Completada' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>{t.estado}</span>
                  </div>
                ))}
              </div>
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
  const [tareas,         setTareas]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [tab,            setTab]            = useState('proxima')  // 'proxima' | 'historial'
  const [showAdd,        setShowAdd]        = useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [newDateDraft,   setNewDateDraft]   = useState('')
  const [iniciando,      setIniciando]      = useState(false)

  // ── Derived ──

  // "Próxima" = most recent non-realizada reunion (or most recent if all done)
  const reunionProxima = useMemo(() => {
    const noRealizadas = reuniones.filter(r => r.estado !== 'realizada')
    return noRealizadas.length > 0 ? noRealizadas[0] : (reuniones[0] || null)
  }, [reuniones])

  const historial = useMemo(() =>
    reuniones
      .filter(r => r.estado === 'realizada')
      .sort((a, b) => b.fecha_jueves.localeCompare(a.fecha_jueves)),
    [reuniones],
  )

  const temasProxima = useMemo(() =>
    reunionProxima
      ? temas.filter(t => t.fecha_jueves === reunionProxima.fecha_jueves)
             .sort((a, b) => a.created_at > b.created_at ? 1 : -1)
      : [],
    [temas, reunionProxima],
  )

  const tareasProxima = useMemo(() => {
    const ids = new Set(temasProxima.map(t => t.id))
    return tareas.filter(t => ids.has(t.reunion_tema_id))
  }, [tareas, temasProxima])

  const countdown = useMemo(() =>
    reunionProxima ? getCountdown(reunionProxima.fecha_jueves) : null,
    [reunionProxima],
  )

  // mode: 'preparacion' | 'trabajo' | 'readonly'
  const mode = reunionProxima
    ? (reunionProxima.estado === 'realizada' ? 'readonly'
      : reunionProxima.iniciada_at            ? 'trabajo'
      : 'preparacion')
    : null

  const stats = useMemo(() => ({
    total: temasProxima.length,
    disc:  temasProxima.filter(t => t.estado === 'discutido').length,
    pend:  temasProxima.filter(t => t.estado === 'pendiente').length,
    post:  temasProxima.filter(t => t.estado === 'postergado').length,
  }), [temasProxima])

  // ── Fetch ──

  const fetchTareas = useCallback(async (temasList) => {
    const list = temasList || temas
    if (list.length === 0) { setTareas([]); return }
    const { data } = await supabase
      .from('tareas')
      .select('id, titulo, estado, reunion_tema_id, cliente_nombre, fecha_vencimiento, responsable')
      .in('reunion_tema_id', list.map(t => t.id))
    setTareas(data || [])
  }, [temas])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: reuns }, { data: tms }] = await Promise.all([
      supabase.from('reuniones').select('*').order('fecha_jueves', { ascending: false }),
      supabase.from('reunion_temas').select('*').order('created_at'),
    ])
    const listaReuns = reuns || []
    const listaTemas = tms  || []
    setReuniones(listaReuns)
    setTemas(listaTemas)

    if (listaTemas.length > 0) {
      const { data: txs } = await supabase
        .from('tareas')
        .select('id, titulo, estado, reunion_tema_id, cliente_nombre, fecha_vencimiento, responsable')
        .in('reunion_tema_id', listaTemas.map(t => t.id))
      setTareas(txs || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Handlers ──

  async function handleCrearReunion() {
    if (!newDateDraft) return
    const { data } = await supabase
      .from('reuniones')
      .insert([{ fecha_jueves: newDateDraft, estado: 'pendiente' }])
      .select().single()
    if (data) {
      setReuniones(prev => [data, ...prev].sort((a, b) => b.fecha_jueves.localeCompare(a.fecha_jueves)))
    }
    setShowDatePicker(false)
    setNewDateDraft('')
    setTab('proxima')
  }

  async function ensureReunion() {
    if (reunionProxima) return reunionProxima.id
    return null
  }

  async function handleIniciarReunion() {
    if (!reunionProxima) return
    setIniciando(true)
    const iniciada_at = new Date().toISOString()
    await supabase.from('reuniones').update({ iniciada_at }).eq('id', reunionProxima.id)
    setReuniones(prev => prev.map(r => r.id === reunionProxima.id ? { ...r, iniciada_at } : r))
    setIniciando(false)
  }

  async function handleFinalizarReunion() {
    if (!reunionProxima) return
    await supabase.from('reuniones').update({ estado: 'realizada' }).eq('id', reunionProxima.id)
    setReuniones(prev => prev.map(r => r.id === reunionProxima.id ? { ...r, estado: 'realizada' } : r))
  }

  async function handleAddTema(draft) {
    const reunion_id = await ensureReunion()
    if (!reunion_id || !reunionProxima?.fecha_jueves) return
    const { data } = await supabase
      .from('reunion_temas')
      .insert([{ ...draft, fecha_jueves: reunionProxima.fecha_jueves, reunion_id }])
      .select().single()
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

  async function handleSaveNotas(temaId, value) {
    const trimmed = value.trim() || null
    setTemas(prev => prev.map(t => t.id === temaId ? { ...t, acuerdos: trimmed } : t))
    await supabase.from('reunion_temas').update({ acuerdos: trimmed }).eq('id', temaId)
  }

  async function handleCrearTarea(tema, { titulo, responsable, fecha_vencimiento }) {
    const payload = {
      titulo,
      estado:           'Pendiente',
      prioridad:        'Media',
      cliente_nombre:   tema.cliente_nombre || null,
      causa_rit:        tema.causa_rit      || null,
      fecha_vencimiento: fecha_vencimiento  || null,
      responsable:      responsable         || 'MT',
      reunion_tema_id:  tema.id,
    }
    const { data } = await supabase.from('tareas').insert([payload]).select().single()
    if (!data) return
    setTareas(prev => [...prev, data])

    // Registrar en seguimiento de la causa si tiene causa_rit o cliente
    if (tema.causa_rit || tema.cliente_nombre) {
      await supabase.from('revisiones').insert([{
        causa_rit:      tema.causa_rit      || null,
        cliente_nombre: tema.cliente_nombre || null,
        fecha_revision: TODAY_ISO,
        por_hacer:      `Reunión de equipo — ${titulo}`,
        que_se_hizo:    'Pendiente',
        semana_key:     null,
      }])
    }
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#1a2e4a] flex items-center gap-2">
              <Users size={16} className="text-[#2570ba]"/> Reuniones de equipo
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">MT · AB — dos veces por semana</p>
          </div>
          {showDatePicker ? (
            <div className="flex items-center gap-2">
              <input type="date" value={newDateDraft} onChange={e => setNewDateDraft(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#2570ba]" autoFocus/>
              <button onClick={handleCrearReunion} disabled={!newDateDraft}
                className="text-xs font-semibold bg-[#2570ba] text-white px-3 py-2 rounded-lg hover:bg-[#2570ba]/90 disabled:opacity-40 transition-colors">
                Crear
              </button>
              <button onClick={() => { setShowDatePicker(false); setNewDateDraft('') }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={13}/>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowDatePicker(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570ba] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570ba]/90 transition-colors shadow-sm">
              <Plus size={13}/> Nueva reunión
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'proxima',   label: 'Próxima' },
            { id: 'historial', label: `Historial${historial.length ? ` · ${historial.length}` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                tab === t.id ? 'bg-[#2570ba] text-white' : 'text-gray-500 hover:bg-gray-100'
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
        ) : tab === 'proxima' ? (

          // ─── PRÓXIMA ────────────────────────────────────────────────────────
          <div className="max-w-2xl space-y-4">

            {/* Empty state */}
            {!reunionProxima && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-10 text-center">
                <Calendar size={28} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-400 font-medium">Sin reunión programada</p>
                <p className="text-[12px] text-gray-300 mt-1 mb-4">Crea una nueva reunión eligiendo la fecha</p>
                <button onClick={() => setShowDatePicker(true)}
                  className="text-xs font-semibold text-[#2570ba] hover:underline">
                  + Nueva reunión
                </button>
              </div>
            )}

            {reunionProxima && (<>

              {/* Meeting card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    mode === 'trabajo'   ? 'bg-emerald-500' :
                    mode === 'readonly'  ? 'bg-gray-400'    :
                    'bg-[#2570ba]'
                  }`}>
                    <Calendar size={18} className="text-white"/>
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-[#1a2e4a]">{fmtLarga(reunionProxima.fecha_jueves)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {mode === 'preparacion' && 'En preparación'}
                      {mode === 'trabajo'     && 'En curso'}
                      {mode === 'readonly'    && 'Finalizada'}
                      {stats.total > 0 && (
                        <>
                          {' · '}{stats.total} tema{stats.total !== 1 ? 's' : ''}
                          {stats.disc > 0 && <span className="text-green-600"> · {stats.disc} discutido{stats.disc !== 1 ? 's' : ''}</span>}
                          {stats.pend > 0 && <span className="text-amber-600"> · {stats.pend} pendiente{stats.pend !== 1 ? 's' : ''}</span>}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {countdown && (
                      <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border whitespace-nowrap ${countdown.cls}`}>
                        {countdown.label}
                      </span>
                    )}
                    {mode === 'preparacion' && (
                      <button
                        onClick={handleIniciarReunion}
                        disabled={iniciando}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 text-white px-3.5 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60">
                        {iniciando ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
                        Iniciar reunión
                      </button>
                    )}
                    {mode === 'trabajo' && (
                      <button onClick={handleFinalizarReunion}
                        className="flex items-center gap-1.5 text-xs font-semibold text-green-700 border border-green-200 bg-green-50 px-3.5 py-2 rounded-xl hover:bg-green-100 transition-colors">
                        <Check size={12}/> Finalizar
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget({ id: reunionProxima.id, fecha_jueves: reunionProxima.fecha_jueves, name: `la reunión del ${fmtLarga(reunionProxima.fecha_jueves)}` })}
                      className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>

                {/* Mode banner */}
                {mode === 'preparacion' && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
                      Preparación — agrega los temas antes de la reunión. Cuando empiece, haz clic en <strong>"Iniciar reunión"</strong>.
                    </p>
                  </div>
                )}
                {mode === 'trabajo' && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>
                      Reunión en curso — anota apuntes por tema y crea tareas directamente desde aquí.
                    </p>
                  </div>
                )}
              </div>

              {/* Temas */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="text-[13px] font-bold text-[#1a2e4a]">
                      {mode === 'preparacion' ? 'Agenda' : mode === 'trabajo' ? 'Apuntes e instrucciones' : 'Temas tratados'}
                    </h2>
                    {mode === 'preparacion' && stats.pend > 0 && (
                      <p className="text-[11px] text-amber-600 mt-0.5">{stats.pend} pendiente{stats.pend !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  {mode !== 'readonly' && (
                    <button onClick={() => setShowAdd(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570ba] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570ba]/90 transition-colors shadow-sm">
                      <Plus size={13}/> Agregar tema
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  {temasProxima.length === 0 && !showAdd && (
                    <div className="py-10 text-center">
                      <Calendar size={24} className="text-gray-200 mx-auto mb-3"/>
                      <p className="text-[13px] text-gray-400 font-medium">Sin temas anotados aún</p>
                      <p className="text-[11px] text-gray-300 mt-1">Agrega los temas que quieres discutir</p>
                      <button onClick={() => setShowAdd(true)}
                        className="mt-3 text-[12px] text-[#2570ba] hover:underline font-medium">
                        + Anotar primer tema
                      </button>
                    </div>
                  )}

                  {temasProxima.map(t => (
                    <TemaRow
                      key={t.id} tema={t} mode={mode}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onSaveNotas={handleSaveNotas}
                      onCrearTarea={handleCrearTarea}
                      tareasDelTema={tareas.filter(tx => tx.reunion_tema_id === t.id)}
                    />
                  ))}

                  {showAdd && (
                    <AddTemaForm
                      onSave={handleAddTema}
                      onCancel={() => setShowAdd(false)}
                    />
                  )}
                </div>

                {temasProxima.length > 0 && mode !== 'readonly' && (
                  <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-4 bg-gray-50/40">
                    <span className="text-[10px] text-gray-400 font-medium">Círculo → cambiar estado:</span>
                    {Object.values(TEMA_ESTADO).map(cfg => (
                      <span key={cfg.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}/>
                        {cfg.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Seguimiento de tareas */}
              {tareasProxima.length > 0 && (
                <SeguimientoTareas tareas={tareasProxima}/>
              )}

            </>)}
          </div>

        ) : (

          // ─── HISTORIAL ──────────────────────────────────────────────────────
          <div className="max-w-2xl space-y-3">
            {historial.length === 0 ? (
              <div className="text-center py-20">
                <Calendar size={22} strokeWidth={1.5} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-400 font-medium">Sin reuniones finalizadas</p>
                <p className="text-[12px] text-gray-300 mt-1">Las reuniones aparecerán aquí al finalizarlas</p>
              </div>
            ) : (
              historial.map(r => (
                <HistorialItem
                  key={r.id} reunion={r} temas={temas} tareas={tareas}
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
