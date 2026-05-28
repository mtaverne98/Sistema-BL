import { useState, useMemo, useEffect } from 'react'
import {
  ChevronRight, ChevronLeft, Search, Check, X,
  FileText, Plus, Edit2, History, ArrowRight, Scale,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Week helpers ───────────────────────────────────────────────────────────────
function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return { year: date.getUTCFullYear(), week: weekNo }
}
function getWeekKey(dateStr) {
  const { year, week } = getISOWeek(dateStr)
  return `${year}-W${String(week).padStart(2, '0')}`
}
function parseWeekKey(key) {
  const [year, w] = key.split('-W')
  return { year: Number(year), week: Number(w) }
}
function getWeekDates(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay() || 7
  const monday = new Date(simple)
  monday.setUTCDate(simple.getUTCDate() - dow + 1)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) }
}
function adjWeekKey(key, delta) {
  const { year, week } = parseWeekKey(key)
  const { start } = getWeekDates(year, week)
  const d = new Date(start + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return getWeekKey(d.toISOString().slice(0, 10))
}
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtRange(start, end) {
  const [,ms,ds] = start.split('-').map(Number)
  const [,me,de] = end.split('-').map(Number)
  if (ms === me) return `${ds} – ${de} de ${MESES[ms-1]}`
  return `${ds} de ${MESES[ms-1]} – ${de} de ${MESES[me-1]}`
}
function fmtCorta(iso) {
  if (!iso) return '—'
  const [,m,d] = iso.split('-').map(Number)
  return `${d} ${MESES[m-1]}`
}

const CURRENT_WEEK_KEY = getWeekKey(TODAY)

// ── Constants ──────────────────────────────────────────────────────────────────
const PROXIMAS_ACCIONES = [
  'Revisar PJUD', 'Revisar SIAU', 'Llamar cliente', 'Esperar resolución',
  'Preparar escrito', 'Presentar escrito', 'Insistir fiscalía',
  'Solicitar antecedentes', 'Agendar reunión', 'Revisar documentación',
  'Seguimiento interno', 'Otro',
]

const AREA_STYLES = {
  'Penal':                { bg: 'bg-[#1a2e4a]/10', text: 'text-[#1a2e4a]'  },
  'Familia':              { bg: 'bg-blue-50',       text: 'text-blue-400'   },
  'Laboral':              { bg: 'bg-sky-100',       text: 'text-sky-700'    },
  'Civil':                { bg: 'bg-blue-100',      text: 'text-blue-600'   },
  'JPL':                  { bg: 'bg-blue-50',       text: 'text-blue-500'   },
  'Administrativo':       { bg: 'bg-slate-100',     text: 'text-slate-600'  },
  'Corte de Apelaciones': { bg: 'bg-blue-200',      text: 'text-blue-800'   },
  'Corte Suprema':        { bg: 'bg-blue-900/10',   text: 'text-blue-900'   },
  // legacy aliases kept for data already in DB
  'Inmobiliario':         { bg: 'bg-sky-50',        text: 'text-sky-600'    },
  'Societario':           { bg: 'bg-blue-50',       text: 'text-blue-600'   },
  'Comercial':            { bg: 'bg-slate-50',      text: 'text-slate-500'  },
}

const ACCION_STYLES = {
  'Revisar PJUD':           { bg: 'bg-violet-50',  text: 'text-violet-700'  },
  'Revisar SIAU':           { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  'Llamar cliente':         { bg: 'bg-amber-50',   text: 'text-amber-700'   },
  'Esperar resolución':     { bg: 'bg-gray-100',   text: 'text-gray-500'    },
  'Preparar escrito':       { bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
  'Presentar escrito':      { bg: 'bg-green-50',   text: 'text-green-700'   },
  'Insistir fiscalía':      { bg: 'bg-red-50',     text: 'text-red-700'     },
  'Solicitar antecedentes': { bg: 'bg-orange-50',  text: 'text-orange-600'  },
  'Agendar reunión':        { bg: 'bg-cyan-50',    text: 'text-cyan-700'    },
  'Revisar documentación':  { bg: 'bg-slate-50',   text: 'text-slate-600'   },
  'Seguimiento interno':    { bg: 'bg-gray-100',   text: 'text-gray-500'    },
  'Otro':                   { bg: 'bg-gray-50',    text: 'text-gray-400'    },
}

const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Andrea B.',   color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

const CATEGORIAS_TAREA = [
  'Escrito', 'Audiencia', 'PJUD', 'SIAU', 'Documento',
  'Administrativo', 'Reunión', 'Seguimiento cliente', 'Cobranza', 'Otro',
]

const CLIENT_RUTS = {}   // Not stored in causas table — populated dynamically if available

// ── Atoms ──────────────────────────────────────────────────────────────────────
function AreaBadge({ area }) {
  const s = AREA_STYLES[area] || { bg: 'bg-gray-50', text: 'text-gray-500' }
  return (
    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
      {area}
    </span>
  )
}

function AccionBadge({ accion }) {
  if (!accion) return null
  const s = ACCION_STYLES[accion] || ACCION_STYLES['Otro']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.bg} ${s.text} whitespace-nowrap`}>
      <ArrowRight size={8} />
      {accion}
    </span>
  )
}

function RespAvatar({ resp }) {
  const info = RESPONSABLE_INFO[resp]
  if (!info) return null
  return (
    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
      style={{ backgroundColor: info.color }} title={info.nombre}>
      {resp}
    </div>
  )
}

// ── ModalCrearTarea ────────────────────────────────────────────────────────────
function ModalCrearTarea({ causa, semanaKey, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo: `Gestión — ${causa.materia}`,
    categoria: 'Escrito',
    prioridad: 'Media',
    fecha_vencimiento: '',
    responsable: 'MT',
    notas: '',
  })
  const valid = form.titulo.trim() && form.fecha_vencimiento

  function handleSave() {
    if (!valid) return
    onSave({
      id: `ta_${Date.now()}`,
      titulo: form.titulo.trim(),
      cliente: causa.cliente_nombre,
      causa_rit: causa.rit || '',
      causa_ruc: causa.ruc || '',
      categoria: form.categoria,
      prioridad: form.prioridad,
      fecha_vencimiento: form.fecha_vencimiento,
      responsable: form.responsable,
      estado: 'Pendiente',
      notas: form.notas.trim(),
      subtareas: [],
      actividad: [{ id: 'a1', fecha: TODAY, hora: '00:00', autor: form.responsable, tipo: 'creacion', desc: `Creada desde Revisión Semanal ${semanaKey}` }],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[480px] overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-900">Crear tarea</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {causa.cliente_nombre}
              {causa.rit && <><span className="mx-1.5 text-gray-200">·</span><span className="font-mono">{causa.rit}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3.5">
          {/* Título */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Título *</label>
            <input type="text" value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400 transition-colors"
              placeholder="¿Qué hay que hacer?" />
          </div>

          {/* Categoría + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Categoría</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                {CATEGORIAS_TAREA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Prioridad</label>
              <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                {['Alta', 'Media', 'Baja'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha + Responsable */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Fecha límite *</label>
              <input type="date" value={form.fecha_vencimiento}
                onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Responsable</label>
              <select value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Causa info read-only */}
          <div className="rounded-lg bg-gray-50/80 border border-gray-100 px-3 py-2.5 space-y-1.5">
            {[
              ['Cliente', causa.cliente_nombre],
              ['RIT',     causa.rit || '—'],
              ['Materia', causa.materia],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-12 flex-shrink-0">{lbl}</span>
                <span className={`text-[12px] text-gray-700 ${lbl === 'RIT' ? 'font-mono' : ''}`}>{val}</span>
              </div>
            ))}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} placeholder="Contexto adicional..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none bg-white focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="text-[12px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button disabled={!valid} onClick={handleSave}
            className={`text-[12px] px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              valid ? 'bg-[#1a2e4a] text-white hover:bg-[#243d5e]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            <Check size={12} /> Crear tarea
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CausaModal ─────────────────────────────────────────────────────────────────
function CausaModal({ causa, semanaKey, revisionData, allRevisiones, onMarcar, onDesmarcar, onCrearTarea, onClose }) {
  const revisada = revisionData?.revisada || false
  const [editing,  setEditing]  = useState(!revisada)
  const [showNota, setShowNota] = useState(revisada)
  const [showModal, setShowModal] = useState(false)
  const [draft, setDraft] = useState({
    nota: revisionData?.nota || '',
    proxima_accion: revisionData?.proxima_accion || 'Esperar resolución',
    responsable: revisionData?.responsable || 'MT',
  })

  function handleGuardar() {
    onMarcar(semanaKey, causa.id, {
      nota: draft.nota.trim(),
      proxima_accion: draft.proxima_accion,
      responsable: draft.responsable,
      fecha: new Date().toISOString().slice(0, 10),
    })
    setEditing(false)
    setShowNota(true)
  }

  const histCount = Object.entries(allRevisiones).filter(([k, d]) => d[causa.id]?.revisada && k !== semanaKey).length

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <AreaBadge area={causa.area} />
              {causa.rit && <span className="font-mono text-[11px] text-gray-500">{causa.rit}</span>}
            </div>
            <h2 className="text-[16px] font-bold text-gray-900 leading-snug">{causa.materia}</h2>
            {causa.tribunal && <p className="text-[11px] text-gray-400 mt-0.5">{causa.tribunal}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-3 flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1 py-2.5">
            <button className="text-[12px] font-semibold text-[#1a2e4a] border-b-2 border-[#1a2e4a] pb-0.5 px-1">
              Revisión semanal
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Estado revisión */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (revisada) { onDesmarcar(semanaKey, causa.id); setShowNota(false); setEditing(true) }
                else { setEditing(true) }
              }}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                revisada ? 'bg-green-500 border-green-500 hover:bg-green-600' : 'border-gray-300 hover:border-[#1a2e4a]'
              }`}
            >
              {revisada && <Check size={12} className="text-white" strokeWidth={2.5} />}
            </button>
            <p className={`text-[14px] font-medium ${revisada ? 'text-green-700' : 'text-gray-500'}`}>
              {revisada ? 'Revisada esta semana' : 'Sin revisar esta semana'}
            </p>
            {revisada && revisionData?.proxima_accion && <AccionBadge accion={revisionData.proxima_accion} />}
          </div>

          {/* Editing form */}
          {!revisada || editing ? (
            <div className="space-y-3.5 bg-gray-50/50 rounded-xl p-4 border border-gray-100">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  ¿Qué se vio en esta causa?
                </label>
                <textarea
                  value={draft.nota}
                  onChange={e => setDraft(d => ({ ...d, nota: e.target.value }))}
                  rows={4}
                  autoFocus
                  placeholder="Estado actual, novedades, pendientes, decisiones tomadas..."
                  className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-blue-400 bg-white transition-colors leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Próxima acción</label>
                  <select value={draft.proxima_accion}
                    onChange={e => setDraft(d => ({ ...d, proxima_accion: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                    {PROXIMAS_ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Revisado por</label>
                  <select value={draft.responsable}
                    onChange={e => setDraft(d => ({ ...d, responsable: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                    {Object.entries(RESPONSABLE_INFO).map(([k, v]) => (
                      <option key={k} value={k}>{v.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleGuardar}
                  className="text-[12px] px-4 py-2 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] flex items-center gap-1.5 font-medium transition-colors">
                  <Check size={12} /> Guardar revisión
                </button>
                {revisada && (
                  <button onClick={() => setEditing(false)}
                    className="text-[12px] px-3 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                )}
                <button onClick={() => setShowModal(true)}
                  className="ml-auto text-[11px] px-2.5 py-2 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:border-gray-300 hover:text-gray-600 flex items-center gap-1.5 transition-colors">
                  <Plus size={11} /> Crear tarea
                </button>
              </div>
            </div>
          ) : (
            /* Show saved note */
            revisionData?.nota && (
              <div className="rounded-xl bg-green-50/40 border border-green-100 px-4 py-3.5">
                <p className="text-[12px] text-gray-700 leading-relaxed">{revisionData.nota}</p>
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-green-100">
                  <div className="flex items-center gap-2">
                    {revisionData.proxima_accion && <AccionBadge accion={revisionData.proxima_accion} />}
                    {revisionData.responsable && <RespAvatar resp={revisionData.responsable} />}
                  </div>
                  <button onClick={() => {
                    setDraft({ nota: revisionData.nota || '', proxima_accion: revisionData.proxima_accion || 'Esperar resolución', responsable: revisionData.responsable || 'MT' })
                    setEditing(true)
                  }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                    <Edit2 size={10} /> Editar
                  </button>
                </div>
              </div>
            )
          )}

          {/* Historial */}
          {histCount > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Historial de revisiones anteriores ({histCount})
              </p>
              <TimelineRevisions causaId={causa.id} allRevisiones={allRevisiones} currentKey={semanaKey} />
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <ModalCrearTarea
          causa={causa}
          semanaKey={semanaKey}
          onSave={tarea => { onCrearTarea(tarea); setShowModal(false) }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ── ClienteDrawer ──────────────────────────────────────────────────────────────
function ClienteDrawer({ clienteNombre, rut, causas, semanaKey, semanaData, onMarcar, onDesmarcar, onCrearTarea, allRevisiones, onClose }) {
  const [selectedCausa, setSelectedCausa] = useState(null)

  const total    = causas.length
  const revisadas = causas.filter(c => semanaData?.[c.id]?.revisada).length
  const pct      = total > 0 ? (revisadas / total) * 100 : 0
  const allDone  = revisadas === total && total > 0

  const sortedCausas = useMemo(() =>
    [...causas].sort((a, b) => {
      const ra = semanaData?.[a.id]?.revisada ? 1 : 0
      const rb = semanaData?.[b.id]?.revisada ? 1 : 0
      return ra - rb
    }),
    [causas, semanaData]
  )

  return (
    <>
      <div className="fixed inset-0 z-[100] flex">
        {/* Backdrop */}
        <div className="w-[22%] bg-black/25 backdrop-blur-[2px] cursor-pointer" onClick={onClose} />

        {/* Panel */}
        <div className="flex-1 bg-white flex flex-col shadow-2xl border-l border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Cliente</p>
              <h2 className="text-[18px] font-bold text-gray-900">{clienteNombre}</h2>
              {rut && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{rut}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Progress */}
          <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-400">{revisadas} de {total} causas revisadas</span>
              <span className={`text-[12px] font-bold tabular-nums ${allDone ? 'text-green-600' : revisadas > 0 ? 'text-[#1a2e4a]' : 'text-gray-400'}`}>
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-green-500' : 'bg-[#1a2e4a]'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Causes list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {sortedCausas.map(causa => {
              const rev = semanaData?.[causa.id]
              const revisada = rev?.revisada || false
              return (
                <div
                  key={causa.id}
                  className={`rounded-xl border transition-all ${revisada ? 'border-green-100 bg-green-50/20' : 'border-gray-100 bg-white'}`}
                >
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    {/* Check circle */}
                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      revisada ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {revisada && <Check size={11} className="text-white" strokeWidth={2.5} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium leading-snug ${revisada ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {causa.materia}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <AreaBadge area={causa.area} />
                        {causa.rit && <span className="text-[10px] font-mono text-gray-400">{causa.rit}</span>}
                        {causa.tribunal && <span className="text-[10px] text-gray-400 truncate max-w-[180px]">{causa.tribunal}</span>}
                      </div>
                      {revisada && rev?.proxima_accion && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <AccionBadge accion={rev.proxima_accion} />
                          <RespAvatar resp={rev.responsable} />
                        </div>
                      )}
                    </div>

                    {/* Ver detalle button */}
                    <button
                      onClick={() => setSelectedCausa(causa)}
                      className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#1a2e4a] border border-[#1a2e4a]/20 hover:border-[#1a2e4a]/40 hover:bg-[#1a2e4a]/5 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Revisar <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selectedCausa && (
        <CausaModal
          causa={selectedCausa}
          semanaKey={semanaKey}
          revisionData={semanaData?.[selectedCausa.id]}
          allRevisiones={allRevisiones}
          onMarcar={onMarcar}
          onDesmarcar={onDesmarcar}
          onCrearTarea={onCrearTarea}
          onClose={() => setSelectedCausa(null)}
        />
      )}
    </>
  )
}

// ── TimelineRevisions ──────────────────────────────────────────────────────────
function TimelineRevisions({ causaId, allRevisiones, currentKey }) {
  const history = useMemo(() => {
    return Object.entries(allRevisiones)
      .filter(([key, data]) => data[causaId]?.revisada && key !== currentKey)
      .map(([key, data]) => {
        const { year, week } = parseWeekKey(key)
        const { start, end } = getWeekDates(year, week)
        return { key, week, start, end, ...data[causaId] }
      })
      .sort((a, b) => b.key.localeCompare(a.key))
  }, [causaId, allRevisiones, currentKey])

  if (!history.length) {
    return <p className="text-[11px] text-gray-400 italic py-1">Sin revisiones anteriores registradas.</p>
  }

  return (
    <div className="space-y-3 pt-1">
      {history.map((rev, i) => (
        <div key={rev.key} className="relative pl-4">
          {i < history.length - 1 && (
            <div className="absolute left-[5px] top-3 bottom-[-8px] w-px bg-gray-100" />
          )}
          <div className="absolute left-0 top-[5px] w-2.5 h-2.5 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Sem. {rev.week}
            </span>
            <span className="text-[10px] text-gray-400">{fmtRange(rev.start, rev.end)}</span>
            {rev.responsable && (
              <div className="flex items-center gap-1">
                <RespAvatar resp={rev.responsable} />
                <span className="text-[10px] text-gray-400">{fmtCorta(rev.fecha)}</span>
              </div>
            )}
            {rev.proxima_accion && <AccionBadge accion={rev.proxima_accion} />}
          </div>
          {rev.nota && (
            <p className="text-[11px] text-gray-600 leading-relaxed">{rev.nota}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── CausaRow ───────────────────────────────────────────────────────────────────
function CausaRow({ causa, semanaKey, revisionData, onMarcar, onDesmarcar, onCrearTarea, allRevisiones }) {
  const revisada = revisionData?.revisada || false

  const [editing,     setEditing]     = useState(false)
  const [showNota,    setShowNota]    = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [draft, setDraft] = useState({
    nota: '', proxima_accion: 'Esperar resolución', responsable: 'MT',
  })

  function handleCheck() {
    if (revisada || editing) return
    setDraft({ nota: '', proxima_accion: 'Esperar resolución', responsable: 'MT' })
    setEditing(true)
  }

  function handleGuardar() {
    onMarcar(semanaKey, causa.id, {
      nota: draft.nota.trim(),
      proxima_accion: draft.proxima_accion,
      responsable: draft.responsable,
      fecha: TODAY,
    })
    setEditing(false)
    setShowNota(true)
  }

  function handleCancelar() {
    setEditing(false)
  }

  function handleUncheck() {
    if (editing) return
    onDesmarcar(semanaKey, causa.id)
    setShowNota(false)
    setShowHistory(false)
  }

  function handleEditNota() {
    setDraft({
      nota: revisionData?.nota || '',
      proxima_accion: revisionData?.proxima_accion || 'Esperar resolución',
      responsable: revisionData?.responsable || 'MT',
    })
    setEditing(true)
    setShowNota(false)
  }

  const histCount = useMemo(() =>
    Object.entries(allRevisiones).filter(([k, d]) => d[causa.id]?.revisada && k !== semanaKey).length,
    [allRevisiones, causa.id, semanaKey]
  )

  return (
    <>
      <div className={`transition-colors ${editing ? 'bg-[#1a2e4a]/[0.018]' : revisada ? 'bg-green-50/20' : 'bg-white'}`}>

        {/* Main row */}
        <div className="flex items-start gap-3 px-4 py-3">

          {/* Circle */}
          <button
            onClick={revisada ? handleUncheck : handleCheck}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              revisada
                ? 'bg-green-500 border-green-500 hover:bg-green-600'
                : editing
                  ? 'border-[#1a2e4a] bg-[#1a2e4a]/8'
                  : 'border-gray-300 hover:border-[#1a2e4a]/60 hover:bg-gray-50'
            }`}
          >
            {revisada && <Check size={11} className="text-white" strokeWidth={2.5} />}
            {editing && !revisada && <div className="w-1.5 h-1.5 rounded-full bg-[#1a2e4a]/40" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium leading-snug transition-all ${
                  revisada ? 'text-gray-400 line-through' : 'text-gray-800'
                }`}>
                  {causa.materia}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <AreaBadge area={causa.area} />
                  {causa.rit && <span className="text-[10px] font-mono text-gray-400">{causa.rit}</span>}
                  <span className="text-gray-200 text-[10px]">·</span>
                  <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{causa.tribunal}</span>
                  {causa.etapa_procesal && (
                    <>
                      <span className="text-gray-200 text-[10px]">·</span>
                      <span className="text-[10px] text-gray-400">{causa.etapa_procesal}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                {revisada && revisionData?.nota && (
                  <button onClick={() => setShowNota(v => !v)}
                    className={`p-1 rounded-md transition-colors ${showNota ? 'bg-blue-50 text-blue-500' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
                    title="Ver nota">
                    <FileText size={13} />
                  </button>
                )}
                {revisada && (
                  <button onClick={() => setShowModal(true)}
                    className="p-1 rounded-md text-gray-300 hover:text-[#1a2e4a] hover:bg-gray-50 transition-colors"
                    title="Crear tarea desde esta revisión">
                    <Plus size={13} />
                  </button>
                )}
                {histCount > 0 && (
                  <button onClick={() => setShowHistory(v => !v)}
                    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md transition-colors ${
                      showHistory ? 'bg-gray-100 text-gray-600' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Historial de revisiones">
                    <History size={11} />
                    <span>{histCount}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Estado revisada: inline proxima accion */}
            {revisada && !showNota && !editing && (
              <div className="flex items-center gap-2 mt-1.5">
                {revisionData?.proxima_accion && <AccionBadge accion={revisionData.proxima_accion} />}
                {revisionData?.responsable && (
                  <div className="flex items-center gap-1">
                    <RespAvatar resp={revisionData.responsable} />
                    <span className="text-[10px] text-gray-400">{fmtCorta(revisionData.fecha)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Nota expandida */}
            {revisada && showNota && !editing && revisionData?.nota && (
              <div className="mt-2 rounded-xl bg-white border border-green-100 px-3.5 py-2.5">
                <p className="text-[12px] text-gray-700 leading-relaxed">{revisionData.nota}</p>
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-green-50">
                  <div className="flex items-center gap-2">
                    {revisionData.proxima_accion && <AccionBadge accion={revisionData.proxima_accion} />}
                    {revisionData.responsable && (
                      <div className="flex items-center gap-1">
                        <RespAvatar resp={revisionData.responsable} />
                        <span className="text-[10px] text-gray-400">{fmtCorta(revisionData.fecha)}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={handleEditNota}
                    className="p-1 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Edit2 size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* Editing panel */}
            {editing && (
              <div className="mt-2.5 space-y-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    ¿Qué se vio en esta causa hoy?
                  </label>
                  <textarea value={draft.nota}
                    onChange={e => setDraft(d => ({ ...d, nota: e.target.value }))}
                    rows={3} autoFocus
                    placeholder="Estado actual, novedades, pendientes, decisiones tomadas..."
                    className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-blue-400 bg-white transition-colors leading-relaxed" />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Próxima acción
                    </label>
                    <select value={draft.proxima_accion}
                      onChange={e => setDraft(d => ({ ...d, proxima_accion: e.target.value }))}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                      {PROXIMAS_ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Revisado por
                    </label>
                    <select value={draft.responsable}
                      onChange={e => setDraft(d => ({ ...d, responsable: e.target.value }))}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                      {Object.entries(RESPONSABLE_INFO).map(([k, v]) => (
                        <option key={k} value={k}>{v.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button onClick={handleGuardar}
                    className="text-[12px] px-3.5 py-1.5 bg-[#1a2e4a] text-white rounded-lg hover:bg-[#243d5e] flex items-center gap-1.5 transition-colors font-medium">
                    <Check size={11} /> Guardar revisión
                  </button>
                  <button onClick={handleCancelar}
                    className="text-[12px] px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={() => setShowModal(true)}
                    className="ml-auto text-[11px] px-2.5 py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:border-gray-300 hover:text-gray-600 flex items-center gap-1.5 transition-colors">
                    <Plus size={11} /> Crear tarea
                  </button>
                </div>
              </div>
            )}

            {/* Historial */}
            {showHistory && (
              <div className="mt-3 pt-2.5 border-t border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
                  Historial de revisiones
                </p>
                <TimelineRevisions causaId={causa.id} allRevisiones={allRevisiones} currentKey={semanaKey} />
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <ModalCrearTarea
          causa={causa}
          semanaKey={semanaKey}
          onSave={tarea => { onCrearTarea(tarea); setShowModal(false) }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

// ── ClienteBlock ───────────────────────────────────────────────────────────────
function ClienteBlock({ clienteNombre, rut, causas, semanaKey, semanaData, onMarcar, onDesmarcar, onCrearTarea, allRevisiones, onOpenPanel }) {
  const [open, setOpen] = useState(false)

  const total    = causas.length
  const revisadas = causas.filter(c => semanaData?.[c.id]?.revisada).length
  const allDone  = revisadas === total && total > 0
  const pct      = total > 0 ? (revisadas / total) * 100 : 0

  const sortedCausas = useMemo(() =>
    [...causas].sort((a, b) => {
      const ra = semanaData?.[a.id]?.revisada ? 1 : 0
      const rb = semanaData?.[b.id]?.revisada ? 1 : 0
      return ra - rb
    }),
    [causas, semanaData]
  )

  return (
    <div className={`border border-gray-100 rounded-xl overflow-hidden transition-shadow ${open ? 'shadow-sm' : ''}`}>

      {/* Header */}
      <div
        onClick={() => onOpenPanel ? onOpenPanel() : setOpen(o => !o)}
        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors ${
          open ? 'bg-white border-b border-gray-100' : allDone ? 'bg-green-50/20' : 'bg-white hover:bg-gray-50/60'
        }`}
      >
        <ChevronRight size={13}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-gray-900 uppercase tracking-[0.04em] leading-none">
            {clienteNombre}
          </p>
          {rut && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{rut}</p>}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Mini progress bar */}
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-green-500' : 'bg-[#1a2e4a]'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-[12px] font-semibold tabular-nums min-w-[28px] text-right ${
            allDone ? 'text-green-600' : revisadas > 0 ? 'text-[#1a2e4a]' : 'text-gray-400'
          }`}>
            {revisadas}/{total}
          </span>
        </div>
      </div>

      {/* Causas list */}
      {open && (
        <div className="divide-y divide-gray-50">
          {sortedCausas.map(causa => (
            <CausaRow
              key={causa.id}
              causa={causa}
              semanaKey={semanaKey}
              revisionData={semanaData?.[causa.id]}
              onMarcar={onMarcar}
              onDesmarcar={onDesmarcar}
              onCrearTarea={onCrearTarea}
              allRevisiones={allRevisiones}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RevisionCausas() {
  const [causasDB,   setCausasDB]   = useState([])
  const [revRows,    setRevRows]    = useState([])  // flat rows from revisiones table
  const [cargando,   setCargando]   = useState(true)
  const [semanaKey,  setSemanaKey]  = useState(CURRENT_WEEK_KEY)
  const [search,     setSearch]     = useState('')
  const [selectedCliente, setSelectedCliente] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      const [{ data: causasData }, { data: revData }] = await Promise.all([
        // etapa_procesal may not exist yet — select without it, add later via SQL
        supabase
          .from('causas')
          .select('id, rit, ruc, materia, area, tribunal, estado, cliente_nombre, cliente_id')
          .in('estado', ['En tramitación', 'Abierta']),
        supabase.from('revisiones').select('*'),
      ])
      setCausasDB(causasData || [])
      // Only use team-review rows (semana_key present, never SEG- which are personal seguimiento)
      setRevRows((revData || []).filter(r => r.semana_key != null && !r.semana_key.startsWith('SEG-')))
      setCargando(false)
    }
    fetchAll()
  }, [])

  // Shape causas for the UI
  const causasActivas = useMemo(() =>
    causasDB.map(c => ({
      id:             String(c.id),
      rit:            c.rit            || '',
      ruc:            c.ruc            || '',
      materia:        c.materia        || '',
      area:           c.area           || c.materia || '',
      tribunal:       c.tribunal       || '',
      etapa_procesal: c.etapa_procesal || '',
      estado:         c.estado         || '',
      cliente_nombre: c.cliente_nombre || '',
      cliente_id:     String(c.cliente_id || c.id),
    }))
  , [causasDB])

  // Transform flat revisiones into nested: revisionesSemana[semanaKey][causaId]
  const revisionesSemana = useMemo(() => {
    const map = {}
    revRows.forEach(r => {
      if (!map[r.semana_key]) map[r.semana_key] = {}
      map[r.semana_key][String(r.causa_id)] = {
        revisada:       r.revisada,
        nota:           r.nota           || '',
        proxima_accion: r.proxima_accion || '',
        responsable:    r.responsable    || 'MT',
        fecha:          r.fecha          || TODAY,
      }
    })
    return map
  }, [revRows])

  async function marcarRevision(key, causaId, datos) {
    // Optimistic update (works even before schema migration runs)
    setRevRows(prev => {
      const exists = prev.find(r => r.semana_key === key && String(r.causa_id) === String(causaId))
      if (exists) {
        return prev.map(r =>
          r.semana_key === key && String(r.causa_id) === String(causaId)
            ? { ...r, ...datos, revisada: true }
            : r
        )
      }
      return [...prev, { id: `tmp_${Date.now()}`, semana_key: key, causa_id: causaId, revisada: true, ...datos }]
    })
    // Persist — requires semana_key column (added via supabase_schema_additions.sql)
    const payload = { semana_key: key, causa_id: causaId, revisada: true, ...datos }
    const { error } = await supabase
      .from('revisiones')
      .upsert(payload, { onConflict: 'semana_key,causa_id' })
    if (error) {
      // If column missing (before migration), fall back to plain insert
      if (error.message?.includes('does not exist')) {
        console.warn('Revisiones: ejecuta supabase_schema_additions.sql para persistir revisiones')
      } else {
        console.error('Error al marcar revisión:', error.message)
      }
    }
  }

  async function desmarcarRevision(key, causaId) {
    setRevRows(prev => prev.map(r =>
      r.semana_key === key && String(r.causa_id) === String(causaId)
        ? { ...r, revisada: false }
        : r
    ))
    const { error } = await supabase.from('revisiones')
      .update({ revisada: false })
      .eq('semana_key', key)
      .eq('causa_id', causaId)
    if (error && !error.message?.includes('does not exist'))
      console.error('Error al desmarcar revisión:', error.message)
  }

  async function addTarea(tarea) {
    const { error } = await supabase.from('tareas').insert([{
      titulo:           tarea.titulo,
      cliente:          tarea.cliente,
      causa_rit:        tarea.causa_rit,
      causa_ruc:        tarea.causa_ruc,
      categoria:        tarea.categoria,
      prioridad:        tarea.prioridad,
      fecha_vencimiento:tarea.fecha_vencimiento,
      responsable:      tarea.responsable,
      estado:           'Pendiente',
      notas:            tarea.notas || '',
    }])
    if (error) console.error('Error al crear tarea:', error.message)
  }

  const { year, week } = parseWeekKey(semanaKey)
  const { start, end } = getWeekDates(year, week)
  const semanaData     = revisionesSemana[semanaKey] || {}
  const isCurrentWeek  = semanaKey === CURRENT_WEEK_KEY
  const totalCausas    = causasActivas.length
  const revisadasCount = causasActivas.filter(c => semanaData[c.id]?.revisada).length
  const pctGlobal      = totalCausas > 0 ? (revisadasCount / totalCausas) * 100 : 0

  const clienteGroups = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = causasActivas.filter(c =>
      !q ||
      c.cliente_nombre.toLowerCase().includes(q) ||
      (c.rit || '').toLowerCase().includes(q) ||
      c.materia.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q)
    )
    const map = new Map()
    filtered.forEach(c => {
      if (!map.has(c.cliente_id)) map.set(c.cliente_id, [])
      map.get(c.cliente_id).push(c)
    })
    return [...map.entries()]
      .map(([cid, cs]) => ({
        clienteId:     cid,
        clienteNombre: cs[0].cliente_nombre,
        rut:           CLIENT_RUTS[cid] || null,
        causas:        cs,
      }))
      .sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre, 'es'))
  }, [causasActivas, search])

  if (cargando) return (
    <div className="flex items-center justify-center h-full text-[13px] text-gray-400">
      Cargando causas…
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-6">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">
              Revisión de Causas
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[12px] text-gray-400">
                Semana {week} de {year}
                <span className="mx-1.5 text-gray-200">·</span>
                {fmtRange(start, end)}
              </p>
              {!isCurrentWeek && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                  Semana anterior
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${pctGlobal === 100 ? 'bg-green-500' : 'bg-[#1a2e4a]'}`}
                  style={{ width: `${pctGlobal}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">{Math.round(pctGlobal)}% completado</span>
                <span className="text-[10px] text-gray-400">{totalCausas - revisadasCount} pendientes</span>
              </div>
            </div>
          </div>

          {/* Right: Counter */}
          <div className="text-right flex-shrink-0">
            <p className="leading-none">
              <span className="text-[36px] font-bold text-gray-900 tabular-nums">{revisadasCount}</span>
              <span className="text-[24px] font-light text-gray-300 tabular-nums">/{totalCausas}</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">causas revisadas</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 px-6 py-2.5 flex items-center gap-2 border-b border-gray-100">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, RIT, materia, área..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setSemanaKey(k => adjWeekKey(k, -1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setSemanaKey(CURRENT_WEEK_KEY)}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              isCurrentWeek ? 'bg-[#1a2e4a] text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            Semana actual
          </button>
          <button onClick={() => setSemanaKey(k => adjWeekKey(k, 1))}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {clienteGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Scale size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
            <p className="text-[13px]">No se encontraron causas activas</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {clienteGroups.map(({ clienteId, clienteNombre, rut, causas }) => (
              <ClienteBlock
                key={clienteId}
                clienteNombre={clienteNombre}
                rut={rut}
                causas={causas}
                semanaKey={semanaKey}
                semanaData={semanaData}
                onMarcar={marcarRevision}
                onDesmarcar={desmarcarRevision}
                onCrearTarea={addTarea}
                allRevisiones={revisionesSemana}
                onOpenPanel={() => setSelectedCliente({ clienteNombre, rut, causas })}
              />
            ))}
          </div>
        )}
      </div>

      {selectedCliente && (
        <ClienteDrawer
          clienteNombre={selectedCliente.clienteNombre}
          rut={selectedCliente.rut}
          causas={selectedCliente.causas}
          semanaKey={semanaKey}
          semanaData={semanaData}
          onMarcar={marcarRevision}
          onDesmarcar={desmarcarRevision}
          onCrearTarea={addTarea}
          allRevisiones={revisionesSemana}
          onClose={() => setSelectedCliente(null)}
        />
      )}
    </div>
  )
}
