import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Check, X, Plus, Edit2, ExternalLink,
  FileText, Scale, ChevronDown, ChevronRight, ArrowRight,
  RefreshCw, History, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigation } from '../context/NavigationContext'
import CopyValue from '../components/CopyValue'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Helpers de fecha ───────────────────────────────────────────────────────────
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function toDateStr(iso) {
  if (!iso || typeof iso !== 'string') return null
  return iso.slice(0, 10)
}
function fmtDate(iso) {
  const s = toDateStr(iso)
  if (!s) return '—'
  const parts = s.split('-').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return '—'
  const [, m, d] = parts
  return `${d} ${MESES[m - 1]}`
}
function fmtDateFull(iso) {
  const s = toDateStr(iso)
  if (!s) return '—'
  const parts = s.split('-').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return '—'
  const [y, m, d] = parts
  return `${d}-${String(m).padStart(2,'0')}-${y}`
}
function addDays(isoDate, n) {
  const s = toDateStr(isoDate) || isoDate
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function daysSince(isoDate) {
  const s = toDateStr(isoDate)
  if (!s) return null
  return Math.max(0, Math.floor((new Date(TODAY + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000))
}

// ── Período de revisión (Supabase) ────────────────────────────────────────────
// El period_start se guarda en la tabla revision_periodos (una fila activa a la vez).
// Ningún estado local efímero — persiste entre recargas, browsers y sesiones.

// ── semana_key para el período actual ─────────────────────────────────────────
function periodKey(start) {
  return `RC-${start}`
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const PROXIMAS_ACCIONES = [
  'Revisar PJUD', 'Revisar SIAU', 'Llamar cliente', 'Esperar resolución',
  'Preparar escrito', 'Presentar escrito', 'Insistir fiscalía',
  'Solicitar antecedentes', 'Preparar audiencia', 'Agendar reunión',
  'Revisar documentación', 'Solicitar carpeta investigativa',
  'Coordinar reunión', 'Seguimiento interno', 'Otro',
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
}

const ACCION_STYLES = {
  'Revisar PJUD':                    { bg: 'bg-violet-50', text: 'text-violet-700' },
  'Revisar SIAU':                    { bg: 'bg-blue-50',   text: 'text-blue-700'   },
  'Llamar cliente':                  { bg: 'bg-amber-50',  text: 'text-amber-700'  },
  'Esperar resolución':              { bg: 'bg-gray-100',  text: 'text-gray-500'   },
  'Preparar escrito':                { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  'Presentar escrito':               { bg: 'bg-green-50',  text: 'text-green-700'  },
  'Insistir fiscalía':               { bg: 'bg-red-50',    text: 'text-red-700'    },
  'Solicitar antecedentes':          { bg: 'bg-orange-50', text: 'text-orange-600' },
  'Preparar audiencia':              { bg: 'bg-purple-50', text: 'text-purple-700' },
  'Agendar reunión':                 { bg: 'bg-cyan-50',   text: 'text-cyan-700'   },
  'Revisar documentación':           { bg: 'bg-slate-50',  text: 'text-slate-600'  },
  'Solicitar carpeta investigativa': { bg: 'bg-orange-50', text: 'text-orange-700' },
  'Coordinar reunión':               { bg: 'bg-cyan-50',   text: 'text-cyan-700'   },
  'Seguimiento interno':             { bg: 'bg-gray-100',  text: 'text-gray-500'   },
  'Otro':                            { bg: 'bg-gray-50',   text: 'text-gray-400'   },
}

const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Angélica B.', color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

const CATEGORIAS_TAREA = [
  'Escrito', 'Audiencia', 'PJUD', 'SIAU', 'Documento',
  'Administrativo', 'Reunión', 'Seguimiento cliente', 'Cobranza', 'Otro',
]

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
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${s.bg} ${s.text}`}>
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
function ModalCrearTarea({ causa, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo: '',
    categoria: 'Escrito', prioridad: 'Media',
    fecha_vencimiento: '', responsable: 'MT', notas: '',
  })
  const valid = form.titulo.trim() && form.fecha_vencimiento

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[480px] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-900">Crear tarea</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {causa.cliente_nombre}
              {causa.rit && <><span className="mx-1.5 text-gray-200">·</span><CopyValue value={causa.rit} className="text-[11px] text-gray-400" /></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={14} /></button>
        </div>
        <div className="px-6 py-4 space-y-3.5">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400" placeholder="¿Qué hay que hacer?" />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Fecha límite *</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
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
          <div className="rounded-lg bg-gray-50/80 border border-gray-100 px-3 py-2.5 space-y-1">
            {[['Cliente', causa.cliente_nombre, false], ['RIT', causa.rit || null, true], ['Materia', causa.materia, false]].map(([lbl, val, mono]) => (
              <div key={lbl} className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-12 flex-shrink-0">{lbl}</span>
                {mono && val
                  ? <CopyValue value={val} className="text-[12px] text-gray-700" />
                  : <span className="text-[12px] text-gray-700">{val || '—'}</span>
                }
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} placeholder="Contexto adicional..."
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none bg-white focus:outline-none focus:border-blue-400" />
          </div>
        </div>
        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
          <button disabled={!valid} onClick={() => {
            if (!valid) return
            onSave({ titulo: form.titulo.trim(), cliente_nombre: causa.cliente_nombre, causa_id: causa.id || null,
              causa_rit: causa.rit || '', causa_ruc: causa.ruc || '',
              categoria: form.categoria, prioridad: form.prioridad, fecha_vencimiento: form.fecha_vencimiento,
              responsable: form.responsable, estado: 'Pendiente', notas: form.notas.trim() })
          }} className={`text-[12px] px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${valid ? 'bg-[#2570BA] text-white hover:bg-[#2570BA]/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <Check size={12} /> Crear tarea
          </button>
        </div>
      </div>
    </div>
  )
}

// ── HistorialTimeline ──────────────────────────────────────────────────────────
function HistorialTimeline({ history }) {
  if (!history.length) return (
    <p className="text-[11px] text-gray-400 italic">Sin revisiones anteriores registradas.</p>
  )
  return (
    <div className="space-y-3">
      {history.map((rev, i) => (
        <div key={i} className="relative pl-4">
          {i < history.length - 1 && <div className="absolute left-[5px] top-3 bottom-[-8px] w-px bg-gray-100" />}
          <div className="absolute left-0 top-[5px] w-2.5 h-2.5 rounded-full bg-gray-200" />
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-600">{fmtDateFull(rev.fecha)}</span>
            {rev.responsable && <RespAvatar resp={rev.responsable} />}
            {rev.proxima_accion && <AccionBadge accion={rev.proxima_accion} />}
          </div>
          {rev.nota && <p className="text-[11px] text-gray-600 leading-relaxed">{rev.nota}</p>}
        </div>
      ))}
    </div>
  )
}

// ── ModalConfirmarReset ────────────────────────────────────────────────────────
function ModalConfirmarReset({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[420px] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={16} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">¿Iniciar nueva revisión?</h3>
            <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Esto marcará todas las causas como no revisadas y comenzará un nuevo período de 14 días desde hoy.
              Los registros anteriores se conservan en el historial.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-[12px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="text-[12px] px-4 py-2 rounded-lg font-medium bg-[#1a2e4a] text-white hover:bg-[#1a2e4a]/90 flex items-center gap-1.5">
            <RefreshCw size={12} /> Iniciar nueva revisión
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CausaRow ───────────────────────────────────────────────────────────────────
function CausaRow({ causa, revData, pKey, onMarcar, onDesmarcar, onCrearTarea }) {
  const revisada = revData?.revisada || false

  const [expanded,    setExpanded]    = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [draft, setDraft] = useState({
    nota: revData?.nota || '',
    proxima_accion: revData?.proxima_accion || 'Esperar resolución',
    responsable: revData?.responsable || 'MT',
  })

  const navigate = useNavigate()
  const { setActiveCausa, setActiveTab } = useNavigation()

  function openFicha(e) {
    e.stopPropagation()
    setActiveCausa(causa)
    setActiveTab('resumen')
    navigate('/causas')
  }

  // Marcar/desmarcar con un clic — sin formulario, acción inmediata
  function handleCheck(e) {
    e.stopPropagation()
    if (revisada) {
      onDesmarcar(causa.id)
    } else {
      onMarcar(causa.id, { nota: '', proxima_accion: 'Esperar resolución', responsable: 'MT', fecha: TODAY })
    }
  }

  async function handleGuardar() {
    setSaving(true)
    await onMarcar(causa.id, { ...draft, fecha: TODAY })
    setSaving(false)
    setExpanded(false)
  }

  const histCount = (revData?.history || []).filter(h => h.revisada && h.semana_key !== pKey).length

  return (
    <>
      <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? 'shadow-sm' : ''} ${
        revisada ? 'border-green-200 bg-green-50/30' : 'border-gray-100 bg-white'
      }`}>

        {/* Main row */}
        <div className="flex items-center gap-3 px-4 py-3.5">

          {/* Checkbox — grande y visible, un solo clic */}
          <button onClick={handleCheck}
            title={revisada ? 'Desmarcar revisión' : 'Marcar como revisada'}
            className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-150 ${
              revisada
                ? 'bg-green-500 border-green-500 hover:bg-green-600 shadow-sm'
                : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50'
            }`}>
            {revisada && <Check size={13} className="text-white" strokeWidth={2.5} />}
          </button>

          {/* Content — clic en el texto abre la causa */}
          <div className="flex-1 min-w-0">
            <button onClick={openFicha}
              className={`text-left text-[13px] font-medium leading-snug w-full hover:underline transition-colors ${
                revisada ? 'text-gray-400' : 'text-gray-800 hover:text-[#2570ba]'
              }`}>
              {causa.materia}
            </button>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <AreaBadge area={causa.area} />
              {causa.rit && <CopyValue value={causa.rit} className="text-[10px] text-gray-400" />}
              {causa.tribunal && <span className="text-[10px] text-gray-400 truncate max-w-[180px]">{causa.tribunal}</span>}
            </div>
            {revisada && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {revData?.proxima_accion && <AccionBadge accion={revData.proxima_accion} />}
                {revData?.responsable && <RespAvatar resp={revData.responsable} />}
                {revData?.fecha && (
                  <span className="text-[10px] text-green-600 font-medium">✓ {fmtDateFull(revData.fecha)}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {histCount > 0 && (
              <button onClick={e => { e.stopPropagation(); setExpanded(true); setShowHistory(true) }}
                className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded-md hover:bg-gray-100"
                title="Ver historial">
                <History size={11} />
                <span>{histCount}</span>
              </button>
            )}
            <button onClick={openFicha}
              className="p-1.5 rounded-md text-gray-300 hover:text-[#1a2e4a] hover:bg-gray-100 transition-colors"
              title="Abrir ficha de la causa">
              <ExternalLink size={12} />
            </button>
            <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="p-1.5 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <ChevronDown size={13} className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-gray-100 px-4 pt-4 pb-4 space-y-4 bg-white/70">

            {/* Show saved review */}
            {revisada && revData?.nota && (
              <div className="rounded-xl bg-green-50/60 border border-green-100 px-3.5 py-3">
                <p className="text-[12px] text-gray-700 leading-relaxed">{revData.nota}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {revData.proxima_accion && <AccionBadge accion={revData.proxima_accion} />}
                    {revData.responsable && <RespAvatar resp={revData.responsable} />}
                  </div>
                  <button onClick={() => { setDraft({ nota: revData.nota || '', proxima_accion: revData.proxima_accion || 'Esperar resolución', responsable: revData.responsable || 'MT' }); onDesmarcar(causa.id) }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Edit2 size={10} /> Editar
                  </button>
                </div>
              </div>
            )}

            {/* Form for new review */}
            {!revisada && (
              <div className="space-y-3 bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    ¿Qué se revisó? ¿Qué se conversó?
                  </label>
                  <textarea value={draft.nota} onChange={e => setDraft(d => ({ ...d, nota: e.target.value }))}
                    rows={3} autoFocus
                    placeholder="Estado actual, novedades, pendientes, decisiones tomadas..."
                    className="w-full text-[12px] border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-blue-400 bg-white transition-colors leading-relaxed" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Próxima acción</label>
                    <select value={draft.proxima_accion} onChange={e => setDraft(d => ({ ...d, proxima_accion: e.target.value }))}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                      {PROXIMAS_ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Revisado por</label>
                    <select value={draft.responsable} onChange={e => setDraft(d => ({ ...d, responsable: e.target.value }))}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                      {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <button onClick={handleGuardar} disabled={saving}
                    className="text-[12px] px-3.5 py-1.5 bg-[#2570BA] text-white rounded-lg hover:bg-[#2570BA]/90 flex items-center gap-1.5 font-medium disabled:opacity-60">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Guardar revisión
                  </button>
                  <button onClick={() => setExpanded(false)}
                    className="text-[12px] px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button onClick={e => { e.stopPropagation(); setShowModal(true) }}
                    className="ml-auto text-[11px] px-2.5 py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:border-gray-300 hover:text-gray-600 flex items-center gap-1.5">
                    <Plus size={11} /> Crear tarea
                  </button>
                </div>
              </div>
            )}

            {revisada && (
              <button onClick={e => { e.stopPropagation(); setShowModal(true) }}
                className="text-[11px] px-3 py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:border-gray-300 hover:text-gray-600 flex items-center gap-1.5">
                <Plus size={11} /> Crear tarea desde esta revisión
              </button>
            )}

            {/* Historial */}
            {histCount > 0 && (
              <div>
                <button onClick={() => setShowHistory(v => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 hover:text-gray-600">
                  <History size={11} />
                  Revisiones anteriores ({histCount})
                  <ChevronDown size={10} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>
                {showHistory && (
                  <HistorialTimeline history={(revData?.history || []).filter(h => h.revisada && h.semana_key !== pKey)} />
                )}
              </div>
            )}

            <button onClick={openFicha}
              className="flex items-center gap-1.5 text-[11px] text-[#2570ba] hover:underline">
              <ExternalLink size={11} /> Abrir ficha completa de la causa
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <ModalCrearTarea causa={causa}
          onSave={tarea => { onCrearTarea(tarea); setShowModal(false) }}
          onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

// ── ClienteBlock ───────────────────────────────────────────────────────────────
function ClienteBlock({ clienteNombre, clienteEstado, causas, reviewMap, pKey, onMarcar, onDesmarcar, onCrearTarea }) {
  const [open, setOpen] = useState(false)
  // Gris si el cliente no tiene ninguna causa activa (Abierta/Revisar)
  const isInactivo = causas.length === 0

  const revisadas = causas.filter(c => reviewMap[String(c.id)]?.revisada).length
  const allDone = revisadas === causas.length && causas.length > 0

  const sortedCausas = useMemo(() =>
    [...causas].sort((a, b) => {
      const ra = reviewMap[String(a.id)]?.revisada ? 1 : 0
      const rb = reviewMap[String(b.id)]?.revisada ? 1 : 0
      return ra - rb
    }),
    [causas, reviewMap]
  )

  return (
    <div className={`border border-gray-100 rounded-xl overflow-hidden ${open ? 'shadow-sm' : ''}`}>
      <button onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
          open ? 'bg-white border-b border-gray-100' : allDone ? 'bg-green-50/20' : 'bg-white hover:bg-gray-50/60'
        }`}>
        <ChevronRight size={13} className={`flex-shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
          style={{ backgroundColor: isInactivo ? '#9ca3af' : '#2570ba' }}>
          {clienteNombre.trim().charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-bold leading-none ${isInactivo ? 'text-gray-400' : 'text-gray-900'}`}>{clienteNombre}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{causas.length} causa{causas.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mini progress bar */}
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-green-500' : 'bg-[#2570BA]'}`}
              style={{ width: `${causas.length > 0 ? (revisadas / causas.length) * 100 : 0}%` }} />
          </div>
          <span className={`text-[11px] font-semibold tabular-nums min-w-[28px] text-right ${
            allDone ? 'text-green-600' : revisadas > 0 ? 'text-[#1a2e4a]' : 'text-gray-400'
          }`}>{revisadas}/{causas.length}</span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-50 bg-white">
          {sortedCausas.map(causa => (
            <CausaRow key={causa.id} causa={causa}
              revData={reviewMap[String(causa.id)]}
              pKey={pKey}
              onMarcar={onMarcar}
              onDesmarcar={onDesmarcar}
              onCrearTarea={onCrearTarea} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function RevisionCausas() {
  const [causasDB,    setCausasDB]    = useState([])
  const [revRows,     setRevRows]     = useState([])
  const [clientesDB,  setClientesDB]  = useState([])
  const [cargando,    setCargando]    = useState(true)
  const [search,      setSearch]      = useState('')
  const [filtroClEst, setFiltroClEst] = useState('')
  const [showReset,   setShowReset]   = useState(false)

  // Período activo — persiste en Supabase (tabla revision_periodos)
  const [periodStart, setPeriodStart] = useState(TODAY)
  const [periodId,    setPeriodId]    = useState(null)
  const periodEnd     = addDays(periodStart, 14)
  const pKey          = periodKey(periodStart)
  const periodExpired = TODAY > periodEnd

  useEffect(() => {
    async function fetchAll() {
      const [
        { data: causasData },
        { data: revData },
        { data: clientesData },
        { data: periodos },
      ] = await Promise.all([
        supabase.from('causas')
          .select('id, rit, ruc, materia, area, tribunal, estado, cliente_nombre, cliente_id')
          .in('estado', ['Abierta', 'Revisar']),
        supabase.from('revisiones').select('*'),
        supabase.from('clientes').select('id, estado'),
        supabase.from('revision_periodos')
          .select('id, period_start')
          .eq('activa', true)
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      setCausasDB(causasData || [])
      setClientesDB(clientesData || [])
      setRevRows((revData || []).filter(r => r.semana_key != null && !r.semana_key.startsWith('SEG-')))

      if (periodos?.length > 0) {
        setPeriodStart(periodos[0].period_start.slice(0, 10))
        setPeriodId(periodos[0].id)
      } else {
        // Primera vez: crear el período inicial en Supabase
        const { data: newP } = await supabase
          .from('revision_periodos')
          .insert({ period_start: TODAY, activa: true })
          .select('id')
          .single()
        setPeriodStart(TODAY)
        if (newP?.id) setPeriodId(newP.id)
      }

      setCargando(false)
    }
    fetchAll()
  }, [])

  const clienteEstadoMap = useMemo(() => {
    const m = {}
    clientesDB.forEach(c => {
      m[String(c.id)] = c.estado ?? 'Activo'
      m[(c.nombre || '').trim().toLowerCase()] = c.estado ?? 'Activo'
    })
    return m
  }, [clientesDB])

  const causasActivas = useMemo(() =>
    causasDB.map(c => ({
      id:             String(c.id),
      rit:            c.rit      || '',
      ruc:            c.ruc      || '',
      materia:        c.materia  || '',
      area:           c.area     || '',
      tribunal:       c.tribunal || '',
      estado:         c.estado   || '',
      cliente_nombre: c.cliente_nombre || '',
      cliente_id:     c.cliente_id ? String(c.cliente_id) : null,
    })), [causasDB])

  // ── Mapa de revisiones del período actual ──────────────────────────────────
  const reviewMap = useMemo(() => {
    const map = {}
    // Current period rows
    revRows.filter(r => r.semana_key === pKey).forEach(r => {
      const cid = String(r.causa_id)
      map[cid] = {
        revisada:       r.revisada || false,
        nota:           r.nota           || '',
        proxima_accion: r.proxima_accion || '',
        responsable:    r.responsable    || 'MT',
        fecha:          r.fecha          || TODAY,
        semana_key:     r.semana_key,
        history:        [],
      }
    })
    // Build history (all other periods)
    revRows.filter(r => r.semana_key !== pKey && r.revisada).forEach(r => {
      const cid = String(r.causa_id)
      if (!map[cid]) map[cid] = { revisada: false, nota: '', proxima_accion: '', responsable: 'MT', fecha: null, semana_key: null, history: [] }
      map[cid].history.push({
        fecha: r.fecha || null,
        semana_key: r.semana_key,
        nota: r.nota || '',
        proxima_accion: r.proxima_accion || '',
        responsable: r.responsable || 'MT',
        revisada: r.revisada,
      })
    })
    // Sort history descending
    Object.values(map).forEach(m => m.history?.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')))
    return map
  }, [revRows, pKey])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const marcarRevision = useCallback(async (causaId, datos) => {
    const payload = { semana_key: pKey, causa_id: causaId, revisada: true, ...datos }
    setRevRows(prev => {
      const exists = prev.find(r => r.semana_key === pKey && String(r.causa_id) === String(causaId))
      if (exists) return prev.map(r => r.semana_key === pKey && String(r.causa_id) === String(causaId) ? { ...r, ...datos, revisada: true } : r)
      return [...prev, { id: `tmp_${Date.now()}`, semana_key: pKey, causa_id: causaId, revisada: true, ...datos }]
    })
    const { error } = await supabase.from('revisiones').upsert(payload, { onConflict: 'semana_key,causa_id' })
    if (error && !error.message?.includes('does not exist')) console.error('Error al marcar revisión:', error.message)
  }, [pKey])

  const desmarcarRevision = useCallback(async (causaId) => {
    setRevRows(prev => prev.map(r =>
      r.semana_key === pKey && String(r.causa_id) === String(causaId) ? { ...r, revisada: false } : r
    ))
    const { error } = await supabase.from('revisiones').update({ revisada: false }).eq('semana_key', pKey).eq('causa_id', causaId)
    if (error && !error.message?.includes('does not exist')) console.error('Error al desmarcar revisión:', error.message)
  }, [pKey])

  const addTarea = useCallback(async (tarea) => {
    const payload = {
      titulo:           tarea.titulo,
      cliente_nombre:   tarea.cliente_nombre,
      causa_id:         tarea.causa_id         || null,
      causa_rit:        tarea.causa_rit         || null,
      estado:           'Pendiente',
      prioridad:        tarea.prioridad         || 'Media',
      fecha_vencimiento:tarea.fecha_vencimiento || null,
      categoria:        tarea.categoria         || null,
      responsable:      tarea.responsable       || null,
      notas:            tarea.notas             || null,
    }
    const { error } = await supabase.from('tareas').insert([payload])
    if (error) {
      console.error('Error al crear tarea:', error.message, error.details)
      alert(`Error al guardar la tarea: ${error.message}`)
    } else {
      window.dispatchEvent(new CustomEvent('tareas:updated'))
    }
  }, [])

  async function handleReset() {
    // Cerrar período activo
    if (periodId) {
      await supabase.from('revision_periodos').update({ activa: false }).eq('id', periodId)
    }
    // Crear nuevo período desde hoy
    const { data: newP } = await supabase
      .from('revision_periodos')
      .insert({ period_start: TODAY, activa: true })
      .select('id')
      .single()
    setPeriodStart(TODAY)
    if (newP?.id) setPeriodId(newP.id)
    setShowReset(false)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const revisadasCount = causasActivas.filter(c => reviewMap[String(c.id)]?.revisada).length
  const totalCausas = causasActivas.length
  const pctRevisadas = totalCausas > 0 ? Math.round((revisadasCount / totalCausas) * 100) : 0

  // ── Agrupación ────────────────────────────────────────────────────────────
  const clienteGroups = useMemo(() => {
    const q = search.toLowerCase()

    function estadoDeCliente(c) {
      return c.cliente_id
        ? (clienteEstadoMap[c.cliente_id] ?? clienteEstadoMap[(c.cliente_nombre || '').trim().toLowerCase()] ?? 'Activo')
        : (clienteEstadoMap[(c.cliente_nombre || '').trim().toLowerCase()] ?? 'Activo')
    }

    const filtered = causasActivas.filter(c => {
      const matchQ = !q ||
        c.cliente_nombre.toLowerCase().includes(q) ||
        (c.rit || '').toLowerCase().includes(q) ||
        c.materia.toLowerCase().includes(q)
      const estadoCl = estadoDeCliente(c)
      const matchClEst = !filtroClEst ||
        (filtroClEst === 'Inactivo' ? estadoCl !== 'Activo' : estadoCl === filtroClEst)
      return matchQ && matchClEst
    })

    const map = new Map()
    filtered.forEach(c => {
      const key = (c.cliente_nombre || '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(c)
    })

    return [...map.entries()]
      .map(([nombreKey, cs]) => {
        const clienteId = cs.find(c => c.cliente_id)?.cliente_id ?? nombreKey
        const estadoCl = clienteEstadoMap[clienteId] ?? clienteEstadoMap[nombreKey.toLowerCase()] ?? 'Activo'
        return { clienteNombre: cs[0].cliente_nombre, clienteEstado: estadoCl, causas: cs }
      })
      .sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre, 'es'))
  }, [causasActivas, search, filtroClEst, clienteEstadoMap])

  if (cargando) return (
    <div className="flex items-center justify-center h-full text-[13px] text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Cargando causas…
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* ── Banner período vencido ── */}
      {periodExpired && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
          <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
          <p className="text-[12px] text-amber-800 flex-1">
            El período de revisión terminó el <strong>{fmtDateFull(periodEnd)}</strong>.
            ¿Deseas iniciar una nueva revisión?
          </p>
          <button onClick={() => setShowReset(true)}
            className="text-[12px] font-semibold px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 flex items-center gap-1.5 flex-shrink-0">
            <RefreshCw size={12} /> Iniciar nueva revisión
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight leading-none">Revisión de Causas</h1>
            {/* Período */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                periodExpired ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                Período: {fmtDateFull(periodStart)} → {fmtDateFull(periodEnd)}
              </span>
              {!periodExpired && (
                <span className="text-[11px] text-gray-400">
                  {14 - (daysSince(periodStart) ?? 0)} día{14 - (daysSince(periodStart) ?? 0) !== 1 ? 's' : ''} restante{14 - (daysSince(periodStart) ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Counter */}
            <div className="text-right">
              <p className="leading-none">
                <span className="text-[36px] font-bold text-gray-900 tabular-nums">{revisadasCount}</span>
                <span className="text-[24px] font-light text-gray-300 tabular-nums">/{totalCausas}</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">causas revisadas</p>
            </div>
            {/* Reset button */}
            <button onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <RefreshCw size={13} /> Nueva revisión
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
          <div className={`h-full rounded-full transition-all duration-700 ${pctRevisadas === 100 ? 'bg-green-500' : 'bg-[#2570BA]'}`}
            style={{ width: `${pctRevisadas}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{pctRevisadas}% completado</span>
          <span className="text-[10px] text-gray-400">{totalCausas - revisadasCount} pendientes</span>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 px-6 py-2.5 flex items-center gap-2 border-b border-gray-100 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, RIT, materia..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {[['', 'Todos'], ['Activo', 'Activos'], ['Inactivo', 'Inactivos']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltroClEst(val)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
                filtroClEst === val
                  ? val === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : val === 'Inactivo' ? 'bg-gray-100 text-gray-600 border-gray-300'
                    : 'bg-[#2570BA] text-white border-[#2570BA]'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${val === 'Activo' ? 'bg-emerald-400' : val === 'Inactivo' ? 'bg-gray-400' : 'bg-white/50'}`} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {clienteGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Scale size={28} strokeWidth={1.5} className="mb-2 opacity-30" />
            <p className="text-[13px]">No se encontraron causas</p>
          </div>
        ) : (
          <div className="space-y-1 max-w-4xl">
            {(() => {
              const byLetter = {}
              clienteGroups.forEach(g => {
                const l = g.clienteNombre.trim().charAt(0).toUpperCase() || '#'
                if (!byLetter[l]) byLetter[l] = []
                byLetter[l].push(g)
              })
              return Object.entries(byLetter)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letra, grupos]) => (
                  <div key={letra}>
                    <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest px-1 pt-3 pb-1.5">{letra}</p>
                    <div className="space-y-2">
                      {grupos.map(({ clienteNombre, clienteEstado, causas }) => (
                        <ClienteBlock key={clienteNombre}
                          clienteNombre={clienteNombre}
                          clienteEstado={clienteEstado}
                          causas={causas}
                          reviewMap={reviewMap}
                          pKey={pKey}
                          onMarcar={marcarRevision}
                          onDesmarcar={desmarcarRevision}
                          onCrearTarea={addTarea} />
                      ))}
                    </div>
                  </div>
                ))
            })()}
          </div>
        )}
      </div>

      {showReset && (
        <ModalConfirmarReset
          onConfirm={handleReset}
          onCancel={() => setShowReset(false)} />
      )}
    </div>
  )
}
