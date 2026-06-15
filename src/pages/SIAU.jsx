import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronDown, ChevronLeft, Search, Plus, ArrowLeft,
  FileText, Clock, AlertCircle, CheckCircle2, X, Check, Edit2, Loader2, Scale, Table2, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import CargaMasivaModal from '../components/CargaMasivaModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import { useNavigation } from '../context/NavigationContext'
import useResizableColumns from '../hooks/useResizableColumns'

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const DB_FIELDS = new Set([
  'estado','notas','fecha','folio','causa_rit','causa_ruc',
  'cliente_nombre','solicitud','respuesta','documento_nombre','tiene_documento','fecha_respuesta',
  'tipo_solicitud',
])

const TIPO_CONFIG = {
  'Copia de carpeta investigativa': 'bg-sky-50 text-sky-700 border-sky-100',
  'Solicitud de entrevista':        'bg-violet-50 text-violet-700 border-violet-100',
  'Solicitud de diligencias':       'bg-amber-50 text-amber-700 border-amber-100',
  'Solicitud de información':       'bg-blue-50 text-blue-700 border-blue-100',
  'Solicitud de documento':         'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Otro':                           'bg-gray-100 text-gray-500 border-gray-200',
}
const TIPO_OPTS = Object.keys(TIPO_CONFIG)

const ESTADO_CONFIG = {
  'Pendiente':           { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  'En proceso':          { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  'Respondida':          { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500'   },
  'Sin respuesta':       { bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400'    },
  'Urgente':             { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  'No ha lugar':         { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'   },
  'Entrevista agendada': { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  'Fiscal contactó':     { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500'  },
  'Archivado':           { bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400'    },
}
const ESTADO_OPTS = Object.keys(ESTADO_CONFIG)

// ── Helpers ───────────────────────────────────────────────────────────────────
function mapRow(row) {
  return {
    id:               row.id,
    created_at:       row.created_at,
    estado:           row.estado            || 'Pendiente',
    tipo_solicitud:   row.tipo_solicitud    || '',
    notas:            row.notas             || '',
    fecha:            row.fecha             || '',
    folio:            row.folio             || '',
    solicitud:        row.solicitud         || '',
    respuesta:        row.respuesta         || '',
    fecha_respuesta:  row.fecha_respuesta   || null,
    documento_nombre: row.documento_nombre  || '',
    tiene_documento:  row.tiene_documento   || false,
    causa_rit:        row.causa_rit         || '',
    causa_ruc:        row.causa_ruc         || '',
    cliente_nombre:   row.cliente_nombre    || '',
  }
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m-1]} ${y}`
}
function fmtFechaCorta(iso) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m-1]}`
}

// ── CausaIdentChip — muestra RIT (violeta) o RUC (celeste) o "Sin RIT/RUC" ───
function CausaIdentChip({ causa_rit, causa_ruc, size = 'md' }) {
  const cls = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 rounded'
    : 'text-[11px] px-2 py-0.5 rounded-lg'
  if (causa_rit) return (
    <span className={`font-mono font-bold border whitespace-nowrap bg-violet-50 text-violet-700 border-violet-100 ${cls}`}>
      {causa_rit}
    </span>
  )
  if (causa_ruc) return (
    <span className={`font-mono font-bold border whitespace-nowrap bg-sky-50 text-sky-700 border-sky-100 ${cls}`}>
      RUC {causa_ruc}
    </span>
  )
  return <span className={`text-gray-400 font-medium ${cls}`}>Sin RIT/RUC</span>
}

/** Filtra registros de una causa considerando RIT → RUC → sin identificador */
function matchCausa(r, grupo, clienteNombre) {
  if (r.cliente_nombre !== clienteNombre) return false
  if (grupo.causa_rit)  return r.causa_rit  === grupo.causa_rit
  if (grupo.causa_ruc)  return r.causa_ruc  === grupo.causa_ruc
  return !r.causa_rit && !r.causa_ruc
}

// ── TipoBadge ─────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }) {
  const cls = TIPO_CONFIG[tipo] || TIPO_CONFIG['Otro']
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {tipo || 'Otro'}
    </span>
  )
}

// ── EstadoBadge ───────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Pendiente']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}/>
      {estado || 'Pendiente'}
    </span>
  )
}

// ── Form: nueva solicitud (modal) ─────────────────────────────────────────────
function FormNuevaSolicitud({ causa, causasInfo, globalMode, onSave, onClose }) {
  const [form, setForm] = useState({
    fecha: TODAY, folio: '', solicitud: '', respuesta: '',
    fecha_respuesta: '', documento_nombre: '', tiene_documento: false,
    notas: '', estado: 'Pendiente', tipo_solicitud: '',
  })
  const [saving, setSaving]         = useState(false)
  const [selCliente, setSelCliente] = useState('')
  const [selRit, setSelRit]         = useState('')
  const [saveError, setSaveError]   = useState(null)

  const clientes = useMemo(() =>
    [...new Set((causasInfo || []).map(c => c.cliente_nombre).filter(Boolean))].sort(),
    [causasInfo])
  const causasOpts = useMemo(() =>
    (causasInfo || []).filter(c => c.cliente_nombre === selCliente),
    [causasInfo, selCliente])
  const causaFinal = globalMode
    ? causasInfo?.find(c => c.rit === selRit) || null
    : causa

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.solicitud.trim() || !causaFinal) {
      console.warn('SIAU save blocked — solicitud:', form.solicitud, '| causaFinal:', causaFinal)
      return
    }
    setSaving(true)
    setSaveError(null)
    // Payload estrictamente mapeado a las columnas reales de Supabase
    const payload = {
      fecha:            form.fecha                    || null,
      folio:            form.folio.trim()             || null,
      solicitud:        form.solicitud.trim(),
      respuesta:        form.respuesta.trim()         || null,
      fecha_respuesta:  form.fecha_respuesta          || null,
      documento_nombre: form.documento_nombre.trim()  || null,
      tiene_documento:  !!form.documento_nombre.trim(),
      notas:            form.notas.trim()             || null,
      estado:           form.estado,
      tipo_solicitud:   form.tipo_solicitud           || null,
      causa_rit:        causaFinal.rit || causaFinal.causa_rit || '',
      causa_ruc:        causaFinal.ruc || causaFinal.causa_ruc || null,
      cliente_nombre:   causaFinal.cliente_nombre    || '',
    }
    console.log('SIAU inserting payload:', payload)
    const { data, error } = await supabase.from('siau').insert([payload]).select().single()
    if (error) {
      console.error('SIAU insert error:', error)
      // Mensaje amigable para errores comunes
      let msg = error.message
      if (error.code === '23505' && error.message.includes('folio')) {
        msg = `El folio "${payload.folio}" ya existe en la base de datos. Verifica el número o deja el campo vacío.`
      } else if (error.code === '23505') {
        msg = 'Ya existe un registro con ese valor. Revisa los datos ingresados.'
      } else if (error.code === '42501') {
        msg = 'Sin permisos para guardar. Contacta al administrador.'
      }
      setSaveError(msg)
      setSaving(false)
      return
    }
    console.log('SIAU insert success:', data)
    if (data) onSave(mapRow(data))
    setSaving(false)
    onClose()
  }

  // Cmd+Enter submits this form
  const saveRef = useRef(null)
  saveRef.current = handleSave
  useEffect(() => {
    const fn = () => saveRef.current?.()
    window.addEventListener('global:save', fn)
    return () => window.removeEventListener('global:save', fn)
  }, [])

  const L = ({ c }) => <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{c}</p>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-2xl shadow-2xl w-[540px] max-h-[90vh] flex flex-col border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-[#1a2e4a]">Nueva solicitud SIAU</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={15}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {globalMode && (
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-50">
              <div>
                <L c="Cliente" />
                <select value={selCliente} onChange={e => { setSelCliente(e.target.value); setSelRit('') }}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300">
                  <option value="">Seleccionar…</option>
                  {clientes.map(cl => <option key={cl}>{cl}</option>)}
                </select>
              </div>
              <div>
                <L c="Causa (RIT)" />
                <select value={selRit} onChange={e => setSelRit(e.target.value)}
                  disabled={!selCliente}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300 disabled:opacity-40">
                  <option value="">Seleccionar…</option>
                  {causasOpts.map(c => <option key={c.id} value={c.rit}>{c.rit}{c.materia ? ` — ${c.materia}` : ''}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <L c="Fecha" />
              <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300" />
            </div>
            <div>
              <L c="Folio" />
              <input type="text" value={form.folio} onChange={e => f('folio', e.target.value)}
                placeholder="00000"
                className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300" />
            </div>
            <div>
              <L c="Estado" />
              <select value={form.estado} onChange={e => f('estado', e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300">
                {ESTADO_OPTS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <L c="Tipo de solicitud" />
            <div className="flex flex-wrap gap-1.5">
              {TIPO_OPTS.map(t => (
                <button key={t} onClick={() => f('tipo_solicitud', t)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    form.tipo_solicitud === t
                      ? (TIPO_CONFIG[t] || TIPO_CONFIG['Otro']) + ' border-current'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <L c="Solicitud *" />
            <textarea value={form.solicitud} onChange={e => f('solicitud', e.target.value)}
              rows={3} placeholder="Descripción de la solicitud…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-blue-300" />
          </div>

          <div>
            <L c="Respuesta" />
            <textarea value={form.respuesta} onChange={e => f('respuesta', e.target.value)}
              rows={2} placeholder="Respuesta recibida…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-blue-300" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <L c="Fecha respuesta" />
              <input type="date" value={form.fecha_respuesta} onChange={e => f('fecha_respuesta', e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300" />
            </div>
            <div>
              <L c="Nombre documento" />
              <input type="text" value={form.documento_nombre} onChange={e => f('documento_nombre', e.target.value)}
                placeholder="ej: Carpeta investigativa"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300" />
            </div>
          </div>

          <div>
            <L c="Notas internas" />
            <textarea value={form.notas} onChange={e => f('notas', e.target.value)}
              rows={2} placeholder="Notas internas…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none focus:outline-none focus:border-blue-300" />
          </div>
        </div>

        {saveError && (
          <div className="px-6 pb-2">
            <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ Error: {saveError}</p>
          </div>
        )}

        <div className="px-6 py-3.5 border-t border-gray-100 flex gap-2 bg-gray-50/30 flex-shrink-0">
          <button onClick={onClose} className="flex-1 text-xs text-gray-400 py-2.5 rounded-xl hover:bg-gray-100 font-medium">Cancelar</button>
          <button onClick={handleSave}
            disabled={!form.solicitud.trim() || (globalMode && !causaFinal) || saving}
            className="flex-1 text-xs bg-[#2570BA] text-white py-2.5 rounded-xl hover:bg-[#2570BA]/90 font-semibold disabled:opacity-40 shadow-sm">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tabla de solicitudes ──────────────────────────────────────────────────────
export function SolicitudesTable({ grupo, registrosAll, onUpdate, onAdd, onDelete, causasInfo, onBack, clienteNombre, embedded = false }) {
  const registros  = useMemo(() =>
    registrosAll
      .filter(r => matchCausa(r, grupo, clienteNombre))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [registrosAll, grupo.causa_rit, grupo.causa_ruc, clienteNombre])

  const [expandedId,      setExpandedId]      = useState(null)
  const [editingId,       setEditingId]       = useState(null)
  const [editDraft,       setEditDraft]       = useState({})
  const [showForm,        setShowForm]        = useState(false)
  const [showCargaMasiva, setShowCargaMasiva] = useState(false)
  const [deleteTarget,    setDeleteTarget]    = useState(null)

  const { widths: siauW, getResizerProps: siauResizer } = useResizableColumns('cols-siau', [90, 80, 110, 200, 200, 90, 100, 140, 120, 50])
  const siauMinWidth = siauW.reduce((s, w) => s + w, 0)

  // Esc closes open form
  useEffect(() => {
    const fn = () => { if (showForm) setShowForm(false) }
    window.addEventListener('modal:close', fn)
    return () => window.removeEventListener('modal:close', fn)
  }, [showForm])

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('siau').delete().eq('id', deleteTarget.id)
    onDelete && onDelete(deleteTarget.id)
    setDeleteTarget(null)
  }

  const toggleRow   = (id) => { if (editingId === id) return; setExpandedId(p => p === id ? null : id) }
  const startEdit   = (r, e) => { e.stopPropagation(); setEditingId(r.id); setEditDraft({ ...r }); setExpandedId(null) }
  const cancelEdit  = (e) => { e.stopPropagation(); setEditingId(null) }
  const saveEdit    = async (e) => {
    e.stopPropagation()
    await onUpdate(editingId, editDraft)
    setEditingId(null)
  }
  const ed = (k, v) => setEditDraft(p => ({ ...p, [k]: v }))

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      {embedded ? (
        <div className="px-6 py-3.5 border-b border-gray-50 flex items-center justify-between flex-shrink-0 bg-white">
          <span className="text-[11px] text-gray-400">{registros.length} solicitud{registros.length !== 1 ? 'es' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCargaMasiva(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <Table2 size={13}/> Carga masiva
            </button>
            <button onClick={() => setShowForm(true)} data-cmd-n
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
              <Plus size={13}/> Nueva solicitud
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3">
            <button onClick={() => onBack('clientes')} className="hover:text-[#1a2e4a] font-medium transition-colors">Clientes</button>
            <ChevronRight size={10} className="text-gray-300"/>
            <button onClick={() => onBack('causas')} className="hover:text-[#1a2e4a] font-medium transition-colors truncate max-w-[160px]">{clienteNombre}</button>
            <ChevronRight size={10} className="text-gray-300"/>
            <CausaIdentChip causa_rit={grupo.causa_rit} causa_ruc={grupo.causa_ruc} size="sm"/>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => onBack('causas')}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#1a2e4a] transition-colors">
                <ArrowLeft size={13}/> Volver
              </button>
              <div className="w-px h-4 bg-gray-200"/>
              <div>
                <div className="flex items-center gap-2">
                  <CausaIdentChip causa_rit={grupo.causa_rit} causa_ruc={grupo.causa_ruc}/>
                </div>
                {grupo.causaInfo?.materia && <p className="text-[11px] text-gray-400 mt-0.5">{grupo.causaInfo.materia}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400">{registros.length} solicitud{registros.length !== 1 ? 'es' : ''}</span>
              <button onClick={() => setShowCargaMasiva(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <Table2 size={13}/> Carga masiva
              </button>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
                <Plus size={13}/> Nueva solicitud
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <FileText size={32} className="text-gray-200 mb-3"/>
            <p className="text-sm text-gray-400 font-medium">Sin solicitudes registradas</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-[#2570ba] hover:underline font-medium">
              + Agregar primera solicitud
            </button>
          </div>
        ) : (
          <table className="text-left border-collapse" style={{ tableLayout: 'fixed', width: siauMinWidth }}>
            <colgroup>
              <col style={{ width: siauW[0] }} />
              <col style={{ width: siauW[1] }} />
              <col style={{ width: siauW[2] }} />
              <col style={{ width: siauW[3] }} />
              <col style={{ width: siauW[4] }} />
              <col style={{ width: siauW[5] }} />
              <col style={{ width: siauW[6] }} />
              <col style={{ width: siauW[7] }} />
              <col style={{ width: siauW[8] }} />
              <col style={{ width: siauW[9] }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_1px_0_#f3f4f6]">
              <tr>
                {['Fecha','Folio','Tipo solicitud','Solicitud','Respuesta','F. Respuesta','Documentos','Notas','Estado'].map((col, i) => (
                  <th key={col} className="px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap first:pl-6 relative select-none">
                    {col}
                    <div {...siauResizer(i)} className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center z-10" onClick={e=>e.stopPropagation()}>
                      <div className="w-px h-4 bg-[#2570ba]/30 opacity-0 hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 last:pr-4" />
              </tr>
            </thead>
            <tbody>
              {registros.map((r, idx) => {
                const isExpanded = expandedId === r.id
                const isEditing  = editingId  === r.id
                const altRow     = idx % 2 === 1

                return (
                  <>
                    <tr key={r.id}
                      onClick={() => !isEditing && toggleRow(r.id)}
                      className={`border-b border-gray-50 transition-colors group ${
                        isEditing  ? 'bg-blue-50/20' :
                        isExpanded ? 'bg-[#1a2e4a]/[0.03]' :
                        altRow     ? 'bg-gray-50/60 hover:bg-gray-100/60' :
                        'bg-white hover:bg-gray-50'
                      } ${!isEditing ? 'cursor-pointer' : ''}`}>

                      {isEditing ? (
                        <>
                          <td className="px-3 py-2 first:pl-6">
                            <input type="date" value={editDraft.fecha||''} onChange={e=>ed('fecha',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editDraft.folio||''} onChange={e=>ed('folio',e.target.value)}
                              onClick={e=>e.stopPropagation()} placeholder="folio"
                              className="text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-[11px] text-gray-400">—</span>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={editDraft.solicitud||''} onChange={e=>ed('solicitud',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[160px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={editDraft.respuesta||''} onChange={e=>ed('respuesta',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[160px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" value={editDraft.fecha_respuesta||''} onChange={e=>ed('fecha_respuesta',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-32 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editDraft.documento_nombre||''} onChange={e=>ed('documento_nombre',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:border-blue-300 bg-white"/>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={editDraft.notas||''} onChange={e=>ed('notas',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:border-blue-300 bg-white min-w-[120px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <select value={editDraft.estado||'Pendiente'} onChange={e=>ed('estado',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-32">
                              {ESTADO_OPTS.map(o => <option key={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 pr-4">
                            <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                              <button onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"><Check size={11}/></button>
                              <button onClick={cancelEdit} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"><X size={11}/></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 first:pl-6 whitespace-nowrap">
                            <span className="text-[11px] text-gray-500">{fmtFecha(r.fecha)}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-[11px] font-mono font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{r.folio || '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <TipoBadge tipo={r.tipo_solicitud}/>
                          </td>
                          <td className="px-3 py-3">
                            <p className={`text-xs text-gray-700 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {r.solicitud || '—'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className={`text-xs text-gray-500 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {r.respuesta || <span className="text-gray-300 italic">—</span>}
                            </p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-[11px] text-gray-500">{fmtFechaCorta(r.fecha_respuesta)}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="text-[11px] text-gray-400">{r.documento_nombre || '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-[11px] text-gray-400 line-clamp-2">{r.notas || '—'}</p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <EstadoBadge estado={r.estado || 'Pendiente'}/>
                          </td>
                          <td className="px-3 py-3 pr-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={e => startEdit(r, e)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                                <Edit2 size={11}/>
                              </button>
                              <button onClick={e => { e.stopPropagation(); setDeleteTarget({ id: r.id, name: `la solicitud del ${fmtFecha(r.fecha)}` }) }}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                                <Trash2 size={11}/>
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && !isEditing && (
                      <tr key={`${r.id}_exp`} className={altRow ? 'bg-gray-50/60' : 'bg-white'}>
                        <td colSpan={9} className="px-6 pb-5 pt-1">
                          <div className="rounded-2xl border border-[#1a2e4a]/8 bg-[#1a2e4a]/[0.025] p-5 grid grid-cols-2 gap-5">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Solicitud completa</p>
                              <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{r.solicitud || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Respuesta completa</p>
                              <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">{r.respuesta || <span className="italic text-gray-300">Sin respuesta</span>}</p>
                              {r.notas && (
                                <div className="mt-3 pt-3 border-t border-[#1a2e4a]/10">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notas internas</p>
                                  <p className="text-[12px] text-gray-500 leading-relaxed">{r.notas}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <FormNuevaSolicitud
          causa={grupo.causaInfo
            ? { ...grupo.causaInfo, rit: grupo.causa_rit, ruc: grupo.causa_ruc }
            : { rit: grupo.causa_rit, ruc: grupo.causa_ruc, cliente_nombre: clienteNombre, id: null, cliente_id: null }}
          causasInfo={causasInfo}
          globalMode={false}
          onSave={onAdd}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {showCargaMasiva && (
        <CargaMasivaModal
          modulo="siau"
          causaObj={{
            rit:            grupo.causaInfo?.rit   || grupo.causa_rit,
            ruc:            grupo.causaInfo?.ruc   || null,
            cliente_nombre: clienteNombre,
            id:             grupo.causaInfo?.id    || null,
            cliente_id:     grupo.causaInfo?.cliente_id || null,
            materia:        grupo.causaInfo?.materia || '',
          }}
          onClose={() => setShowCargaMasiva(false)}
          onSuccess={rows => rows.forEach(r => onAdd(mapRow(r)))}
        />
      )}
    </div>
  )
}

// ── Causa card ────────────────────────────────────────────────────────────────
function CausaCard({ grupo, registrosAll, clienteNombre, onClick, onOpenCausa }) {
  const count      = registrosAll.filter(r => matchCausa(r, grupo, clienteNombre)).length
  const pendientes = registrosAll.filter(r => matchCausa(r, grupo, clienteNombre) && r.estado === 'Pendiente').length

  return (
    <div className="group/card flex items-center gap-1 rounded-xl hover:bg-[#1a2e4a]/5 transition-colors">
      <button onClick={onClick}
        className="flex-1 text-left flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-[#1a2e4a]/8 flex items-center justify-center flex-shrink-0">
          <Scale size={14} className="text-[#1a2e4a]/50"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CausaIdentChip causa_rit={grupo.causa_rit} causa_ruc={grupo.causa_ruc} size="sm"/>
          </div>
          {grupo.causaInfo?.materia && (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{grupo.causaInfo.materia}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pendientes > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              {pendientes} pend.
            </span>
          )}
          <span className="text-[10px] text-gray-400">{count} sol.</span>
          <ChevronRight size={13} className="text-gray-300 group-hover/card:text-[#2570ba] transition-colors"/>
        </div>
      </button>
      {/* Link "Ver causa" */}
      {onOpenCausa && grupo.causa_key && (
        <button
          onClick={e => { e.stopPropagation(); onOpenCausa(grupo) }}
          className="opacity-0 group-hover/card:opacity-100 flex-shrink-0 px-2 py-1 mr-2 text-[9px] font-semibold text-[#2570ba] hover:underline transition-opacity"
          title="Abrir ficha de la causa"
        >
          Ver causa →
        </button>
      )}
    </div>
  )
}

// ── Cliente accordion row ─────────────────────────────────────────────────────
function ClienteRow({ grupo, registrosAll, isExpanded, onToggle, onSelectCausa, onOpenCausa, hasActiveCausas }) {
  const { clienteNombre, causasGrupos } = grupo
  const total      = registrosAll.filter(r => r.cliente_nombre === clienteNombre).length
  const pendientes = registrosAll.filter(r => r.cliente_nombre === clienteNombre && r.estado === 'Pendiente').length
  const ini        = clienteNombre.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()

  return (
    <div className={`border border-gray-100 rounded-2xl overflow-hidden transition-shadow ${isExpanded ? 'shadow-sm' : ''}`}>
      <button onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
          isExpanded ? 'bg-[#1a2e4a]/[0.04]' : 'bg-white hover:bg-gray-50'
        }`}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold select-none"
          style={{ backgroundColor: hasActiveCausas ? '#2570BA' : '#9CA3AF' }}>
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold truncate ${hasActiveCausas ? 'text-[#1a2e4a]' : 'text-gray-400'}`}>{clienteNombre}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {causasGrupos.length} causa{causasGrupos.length !== 1 ? 's' : ''}
            {total > 0 && <span className="ml-1.5">· {total} solicitud{total !== 1 ? 'es' : ''}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pendientes > 0 && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown size={15} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}/>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-white px-3 py-2 space-y-0.5">
          {causasGrupos.map(g => (
            <CausaCard key={g.causa_key}
              grupo={g} registrosAll={registrosAll} clienteNombre={clienteNombre}
              onClick={() => onSelectCausa(clienteNombre, g)}
              onOpenCausa={onOpenCausa}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SIAU() {
  const navigate = useNavigate()
  const { activeCausa, setActiveCausa } = useNavigation()

  const [_ps] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ps.siau') ?? 'null') ?? {} }
    catch { return {} }
  })

  const [registros,  setRegistros]  = useState([])
  const [allCausas,  setAllCausas]  = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [clienteHasActiveCausasMap, setClienteHasActiveCausasMap] = useState({})
  const [expandedSet,    setExpanded]       = useState(new Set())
  const [search,         setSearch]         = useState(_ps.search ?? '')
  const [showForm,       setShowForm]       = useState(false)

  // Navigation
  const [view,           setView]            = useState(_ps.view ?? 'clientes')
  const [selCliente,     setSelCliente]      = useState(_ps.selCliente ?? null) // string
  const [selCausaKey,    setSelCausaKey]     = useState(_ps.selCausaKey ?? null) // UUID (causa.id)
  const [fromCausa,      setFromCausa]       = useState(false)

  const fetchRegistros = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase.from('siau').select('*').order('fecha', { ascending: false })
    setRegistros((data || []).map(mapRow))
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id,rit,ruc,materia,area,fiscalia,tribunal,cliente_nombre,cliente_id,estado')
      .order('rit')
    const activas = (data || []).filter(c => c.estado === 'Abierta' || c.estado === 'En tramitación')
    setAllCausas(activas)
    // Mapa nombre→hasActiveCausas para color de avatar
    const map = {}
    ;(data || []).forEach(c => {
      if (!c.cliente_nombre) return
      if (!map[c.cliente_nombre]) map[c.cliente_nombre] = false
      if (c.estado === 'Abierta' || c.estado === 'Revisar') map[c.cliente_nombre] = true
    })
    setClienteHasActiveCausasMap(map)
  }, [])

  useEffect(() => { fetchRegistros(); fetchCausas() }, [fetchRegistros, fetchCausas])

  // Esc closes open form
  useEffect(() => {
    const fn = () => { if (showForm) setShowForm(false) }
    window.addEventListener('modal:close', fn)
    return () => window.removeEventListener('modal:close', fn)
  }, [showForm])

  const handleUpdate = useCallback(async (id, cambios) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(Object.entries(cambios).filter(([k]) => DB_FIELDS.has(k)))
    if (Object.keys(dbCambios).length) await supabase.from('siau').update(dbCambios).eq('id', id)
  }, [])

  const handleAdd = useCallback((newReg) => setRegistros(prev => [newReg, ...prev]), [])
  const handleDeleteReg = useCallback((id) => setRegistros(prev => prev.filter(r => r.id !== id)), [])

  // Build client → causas tree
  const clienteGrupos = useMemo(() => {
    const clienteSet = new Set()
    allCausas.forEach(c => { if (c.cliente_nombre) clienteSet.add(c.cliente_nombre) })

    return [...clienteSet].sort().map(clienteNombre => {
      const causasCliente = allCausas.filter(c => c.cliente_nombre === clienteNombre)
      const byId = {}
      registros.filter(r => r.cliente_nombre === clienteNombre).forEach(r => {
        let cid = r.causa_id
        if (!cid && r.causa_rit) cid = causasCliente.find(c => c.rit === r.causa_rit)?.id || null
        if (cid) { if (!byId[cid]) byId[cid] = []; byId[cid].push(r) }
      })
      const grupos = causasCliente.map(ci => ({
        causa_rit: ci.rit || null,
        causa_ruc: ci.ruc || null,
        causa_key: ci.id,
        causaInfo: ci,
        cliente_nombre: clienteNombre,
      })).sort((a, b) => (a.causa_rit||'').localeCompare(b.causa_rit||''))
      return { clienteNombre, causasGrupos: grupos }
    })
  }, [registros, allCausas])

  // Filter by search
  const filteredGrupos = useMemo(() => {
    if (!search.trim()) return clienteGrupos
    const q = search.toLowerCase()
    return clienteGrupos.filter(cl =>
      cl.clienteNombre.toLowerCase().includes(q) ||
      cl.causasGrupos.some(g =>
        (g.causa_rit||'').toLowerCase().includes(q) ||
        (g.causa_ruc||'').toLowerCase().includes(q) ||
        (g.causaInfo?.materia||'').toLowerCase().includes(q)
      )
    )
  }, [clienteGrupos, search])

  // Group A-Z
  const byLetter = useMemo(() => {
    const map = {}
    filteredGrupos.forEach(cl => {
      const l = cl.clienteNombre.charAt(0).toUpperCase() || '#'
      if (!map[l]) map[l] = []
      map[l].push(cl)
    })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
  }, [filteredGrupos])

  // Selected grupo (derived)
  const selectedGrupo = useMemo(() => {
    if (!selCausaKey || !selCliente) return null
    const cl = clienteGrupos.find(g => g.clienteNombre === selCliente)
    return cl?.causasGrupos.find(g => g.causa_key === selCausaKey) || null
  }, [clienteGrupos, selCausaKey, selCliente])

  // ── Auto-seleccionar causa al venir desde CausaView ──────────────────────
  useEffect(() => {
    if (!activeCausa?.id || !clienteGrupos.length) return
    if (selCausaKey === activeCausa.id) return // ya seleccionada
    const grupo = clienteGrupos.find(g => g.clienteNombre === activeCausa.cliente_nombre)
    const causaGrupo = grupo?.causasGrupos.find(g => g.causa_key === activeCausa.id)
    if (grupo && causaGrupo) {
      setSelCliente(activeCausa.cliente_nombre)
      setSelCausaKey(activeCausa.id)
      setView('tabla')
      setFromCausa(true)
    }
  }, [clienteGrupos, activeCausa?.id])  // eslint-disable-line

  function handleSelectCausa(clienteNombre, grupo) {
    setSelCliente(clienteNombre)
    setSelCausaKey(grupo.causa_key)
    setView('tabla')
  }

  /** Navega directamente a la ficha de la causa */
  function handleOpenCausa(grupo) {
    if (!grupo.causa_key) return
    setActiveCausa({
      id:             grupo.causa_key,
      rit:            grupo.causa_rit || null,
      ruc:            grupo.causa_ruc || null,
      materia:        grupo.causaInfo?.materia || '',
      cliente_nombre: grupo.causaInfo?.cliente_nombre || selCliente || '',
      cliente_id:     grupo.causaInfo?.cliente_id || null,
      causa_key:      grupo.causa_key,
    })
    navigate('/causas')
  }

  function handleBack(to) {
    setView('clientes')
    if (to === 'clientes') { setSelCliente(null); setSelCausaKey(null) }
  }

  // Keep state ref synced for the unmount closure
  const _stRef = useRef({})
  useEffect(() => {
    _stRef.current = { search, view, selCliente, selCausaKey }
  }, [search, view, selCliente, selCausaKey])

  // Save on unmount
  useEffect(() => () => {
    sessionStorage.setItem('ps.siau', JSON.stringify(_stRef.current))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = (nombre) => setExpanded(prev => {
    const next = new Set(prev); next.has(nombre) ? next.delete(nombre) : next.add(nombre); return next
  })

  const stats = useMemo(() => ({
    clientes:    clienteGrupos.length,
    solicitudes: registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente').length,
    respondidas: registros.filter(r => r.estado === 'Respondida').length,
    urgentes:    registros.filter(r => r.estado === 'Urgente').length,
  }), [clienteGrupos, registros])

  // ── Tabla view ──
  if (view === 'tabla' && selectedGrupo) {
    return (
      <div className="flex flex-col h-full">
        {/* Breadcrumb de retorno a causa */}
        {fromCausa && activeCausa && (
          <div className="bg-white border-b border-gray-100 px-5 py-2 flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => navigate('/causas')}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-[#2570ba] transition-colors group"
            >
              <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Causa</span>
            </button>
            <span className="text-gray-200 text-[12px]">›</span>
            <span className="text-[12px] text-gray-500 truncate max-w-[280px]" title={activeCausa.materia}>
              {activeCausa.materia}
            </span>
            <span className="text-gray-200 mx-0.5">›</span>
            <span className="text-[12px] font-semibold text-[#1a2e4a]">SIAU</span>
          </div>
        )}
        <div className="flex-1 min-h-0">
      <SolicitudesTable
        grupo={selectedGrupo}
        registrosAll={registros}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDeleteReg}
        causasInfo={allCausas}
        onBack={handleBack}
        clienteNombre={selCliente}
      />
        </div>
      </div>
    )
  }

  // ── Client list view ──
  return (
    <div className="flex flex-col h-full bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-[#1a2e4a]">SIAU</h1>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-4 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
            <Plus size={14}/> Nueva solicitud
          </button>
        </div>

        {/* Stat cards */}
        {!cargando && (
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {[
              { label: 'Solicitudes',  value: stats.solicitudes, bg: 'bg-gray-50',    ic: 'text-gray-500',    Icon: FileText     },
              { label: 'Pendientes',   value: stats.pendientes,  bg: 'bg-amber-50',   ic: 'text-amber-500',   Icon: Clock        },
              { label: 'Respondidas',  value: stats.respondidas, bg: 'bg-green-50',   ic: 'text-green-500',   Icon: CheckCircle2 },
              { label: 'Urgentes',     value: stats.urgentes,    bg: 'bg-red-50',     ic: 'text-red-500',     Icon: AlertCircle  },
            ].map(({ label, value, bg, ic, Icon }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={14} className={ic}/>
                </div>
                <div>
                  <p className="text-[22px] font-bold text-gray-900 leading-none tabular-nums">{value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, RIT, materia…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300 bg-white"/>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300"/>
          </div>
        ) : byLetter.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400">{search ? `Sin resultados para "${search}"` : 'Sin clientes con causas activas'}</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {byLetter.map(([letra, grupos]) => (
              <div key={letra}>
                <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-2.5 px-1">{letra}</p>
                <div className="space-y-2">
                  {grupos.map(grupo => (
                    <ClienteRow key={grupo.clienteNombre}
                      grupo={grupo} registrosAll={registros}
                      isExpanded={expandedSet.has(grupo.clienteNombre)}
                      onToggle={() => toggleExpanded(grupo.clienteNombre)}
                      onSelectCausa={handleSelectCausa}
                      onOpenCausa={handleOpenCausa}
                      hasActiveCausas={clienteHasActiveCausasMap[grupo.clienteNombre] ?? true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <FormNuevaSolicitud
          causa={null} causasInfo={allCausas} globalMode
          onSave={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}

    </div>
  )
}
