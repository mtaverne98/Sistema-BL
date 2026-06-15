import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronDown, Search, Plus, ArrowLeft,
  FileText, Clock, CheckCircle2, AlertCircle, X, Check, Edit2, Loader2,
  Scale, Table2, Trash2, Target, ExternalLink, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigation } from '../context/NavigationContext'
import CargaMasivaModal from '../components/CargaMasivaModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import CopyValue from '../components/CopyValue'

// ─── Constantes ───────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

// ─── Revisado Esta Semana ─────────────────────────────────────────────────────
const SEMANA_LS_KEY = 'semana-revisado-inicio'

function getSemanaInicio() {
  try {
    const v = localStorage.getItem(SEMANA_LS_KEY)
    if (v?.match(/^\d{4}-\d{2}-\d{2}$/)) return v
  } catch {}
  try { localStorage.setItem(SEMANA_LS_KEY, TODAY) } catch {}
  return TODAY
}

function mkSemanaKey(inicio) { return `W-${inicio}` }

const REV_SEM_OPTS = [
  { value: 'SI', label: 'SI', bg: '#dcfce7', color: '#166534' },
  { value: 'NO', label: 'NO', bg: '#fee2e2', color: '#991b1b' },
  { value: null, label: '—',  bg: '#f3f4f6', color: '#9ca3af' },
]

function RevisadoSemanaCell({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const opt = REV_SEM_OPTS.find(o => o.value === (value ?? null)) ?? REV_SEM_OPTS[2]
  return (
    <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        title="Revisado esta semana"
        style={{ backgroundColor: opt.bg, color: opt.color }}
        className="text-[11px] font-bold px-2.5 py-1 rounded-lg min-w-[46px] text-center transition-all">
        {opt.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-30 overflow-hidden min-w-[72px]">
            {REV_SEM_OPTS.map(o => (
              <button key={String(o.value)}
                onClick={e => { e.stopPropagation(); onChange(o.value); setOpen(false) }}
                style={{ backgroundColor: o.bg, color: o.color }}
                className="block w-full text-left px-4 py-2.5 text-[12px] font-bold hover:brightness-95 transition-all">
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ModalNuevaSemana({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[400px] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={16} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">¿Iniciar nueva semana?</h3>
            <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Todos los valores SI/NO se limpiarán y comenzará una nueva semana desde hoy. Los registros anteriores quedan guardados.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-[12px] px-4 py-2 rounded-lg text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="text-[12px] px-4 py-2 rounded-lg font-medium bg-[#1a2e4a] text-white hover:bg-[#1a2e4a]/90 flex items-center gap-1.5">
            <RefreshCw size={12} /> Nueva semana
          </button>
        </div>
      </div>
    </div>
  )
}

const SEG_ESTADO = {
  'Pendiente':     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  border: 'border-amber-200'  },
  'En progreso':   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400',   border: 'border-blue-200'   },
  'Listo':         { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400',  border: 'border-green-200'  },
  'Sin novedades': { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   border: 'border-gray-200'   },
}
const ESTADO_OPTS = Object.keys(SEG_ESTADO)

const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.', color: '#1a2e4a' },
  AB: { nombre: 'Angélica B.', color: '#2570ba' },
  CL: { nombre: 'Claudia L.',  color: '#059669' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts.map(Number)
  return `${d}-${String(m).padStart(2,'0')}-${y}`
}

// ─── Mapeo desde tabla revisiones ─────────────────────────────────────────────
function mapRow(row) {
  return {
    id:             row.id,
    created_at:     row.created_at,
    fecha:          row.fecha_revision || row.fecha || TODAY,
    por_hacer:      row.por_hacer      || row.nota  || '',
    estado:         row.que_se_hizo    || 'Pendiente',
    notas:          row.notas          || row.nota  || '',
    responsable:    row.responsable    || 'MT',
    causa_rit:      row.causa_rit      || '',
    cliente_nombre: row.cliente_nombre || '',
    causa_id:       row.causa_id       ? String(row.causa_id) : null,
    cliente_id:     row.cliente_id     || null,
    revisado:       row.revisado       || false,
  }
}

function toRevisionesPayload(fields, causaObj) {
  return {
    fecha_revision: fields.fecha        || TODAY,
    por_hacer:      fields.por_hacer?.trim()  || null,
    que_se_hizo:    fields.estado       || 'Pendiente',
    notas:          fields.notas?.trim() || null,
    responsable:    fields.responsable  || 'MT',
    causa_rit:      causaObj.rit        || null,
    causa_id:       causaObj.id         || null,
    cliente_nombre: causaObj.cliente_nombre || null,
    cliente_id:     causaObj.cliente_id || null,
    semana_key:     null,
    revisada:       false,
    revisado:       false,
  }
}

function toUpdatePayload(cambios) {
  const p = {}
  if (cambios.fecha       !== undefined) p.fecha_revision = cambios.fecha
  if (cambios.por_hacer   !== undefined) p.por_hacer      = cambios.por_hacer
  if (cambios.estado      !== undefined) p.que_se_hizo    = cambios.estado
  if (cambios.notas       !== undefined) p.notas          = cambios.notas
  if (cambios.responsable !== undefined) p.responsable    = cambios.responsable
  if (cambios.revisado    !== undefined) p.revisado       = cambios.revisado
  return p
}

// ─── EstadoBadge & Select ─────────────────────────────────────────────────────
const SEG_ESTADO_FALLBACK = { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', border: 'border-gray-200' }

function EstadoBadge({ v }) {
  const c = SEG_ESTADO[v] || SEG_ESTADO_FALLBACK
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`}/>
      {v || 'Pendiente'}
    </span>
  )
}

function EstadoInput({ value, onChange }) {
  return (
    <input type="text" value={value || ''}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      placeholder="Ej: Pendiente, Listo…"
      className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-full" />
  )
}

function RespBadge({ resp }) {
  const info = RESPONSABLE_INFO[resp]
  if (!info) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: info.color + '18', color: info.color }}>
      {resp}
    </span>
  )
}

function RespSelect({ value, onChange }) {
  return (
    <select value={value || 'MT'} onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-full">
      {Object.entries(RESPONSABLE_INFO).map(([k, v]) => (
        <option key={k} value={k}>{v.nombre}</option>
      ))}
    </select>
  )
}

// ─── RegistrosTable ───────────────────────────────────────────────────────────
function RegistrosTable({ grupo, registrosAll, causaObj, onUpdate, onAdd, onDelete, onBack, clienteNombre }) {
  const navigate = useNavigate()
  const { setActiveCausa, setActiveTab } = useNavigation()

  // Filter by causa_id when available, fallback to causa_rit + cliente_nombre
  const registros = useMemo(() =>
    registrosAll
      .filter(r => {
        if (causaObj.id && r.causa_id) return r.causa_id === causaObj.id
        return r.causa_rit === grupo.causa_rit && r.cliente_nombre === clienteNombre
      })
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [registrosAll, causaObj.id, grupo.causa_rit, clienteNombre])

  const [newRow,          setNewRow]          = useState(null)
  const [editingId,       setEditingId]       = useState(null)
  const [editDraft,       setEditDraft]       = useState({})
  const [savingNew,       setSavingNew]       = useState(false)
  const [showCargaMasiva, setShowCargaMasiva] = useState(false)
  const [deleteTarget,    setDeleteTarget]    = useState(null)

  const COLS = ['', 'Fecha', 'Gestión / Observación', 'Estado', 'Responsable', 'Notas', '']

  async function toggleRevisado(row, e) {
    e.stopPropagation()
    const next = !row.revisado
    onUpdate(row.id, { revisado: next })
    await supabase.from('revisiones').update({ revisado: next }).eq('id', row.id)
  }

  function openFicha() {
    if (!causaObj.id) return
    setActiveCausa(causaObj)
    setActiveTab('resumen')
    navigate('/causas')
  }

  // ── Add inline ──
  async function handleSaveNew() {
    if (!newRow?.por_hacer?.trim()) return
    setSavingNew(true)
    const { data, error } = await supabase
      .from('revisiones')
      .insert([toRevisionesPayload(newRow, causaObj)])
      .select().single()
    if (!error && data) { onAdd(mapRow(data)) }
    setNewRow(null)
    setSavingNew(false)
  }

  // ── Edit ──
  const startEdit  = (r, e) => { e.stopPropagation(); setEditingId(r.id); setEditDraft({ ...r }) }
  const cancelEdit = e => { e.stopPropagation(); setEditingId(null) }
  const saveEdit   = async e => {
    e.stopPropagation()
    const dbPayload = toUpdatePayload(editDraft)
    if (Object.keys(dbPayload).length) {
      await supabase.from('revisiones').update(dbPayload).eq('id', editingId)
    }
    onUpdate(editingId, editDraft)
    setEditingId(null)
  }
  const ed = (k, v) => setEditDraft(p => ({ ...p, [k]: v }))

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('revisiones').delete().eq('id', deleteTarget.id)
    onDelete(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <nav className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3">
          <button onClick={() => onBack('clientes')} className="hover:text-[#1a2e4a] font-medium transition-colors">Clientes</button>
          <ChevronRight size={10} className="text-gray-300"/>
          <button onClick={() => onBack('causas')} className="hover:text-[#1a2e4a] font-medium transition-colors truncate max-w-[160px]">{clienteNombre}</button>
          <ChevronRight size={10} className="text-gray-300"/>
          {grupo.causa_rit
            ? <CopyValue value={grupo.causa_rit} className="font-semibold text-[#1a2e4a]" />
            : <span className="font-mono font-semibold text-[#1a2e4a]">{causaObj.materia || 'Sin RIT'}</span>
          }
        </nav>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => onBack('causas')}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#1a2e4a] transition-colors">
              <ArrowLeft size={13}/> Volver
            </button>
            <div className="w-px h-4 bg-gray-200"/>
            <div>
              <h2 className="text-sm font-bold text-[#1a2e4a] font-mono">
                {grupo.causa_rit || 'Sin RIT'}
              </h2>
              {causaObj?.materia && <p className="text-[11px] text-gray-400 mt-0.5">{causaObj.materia}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {causaObj.id && (
              <button onClick={openFicha}
                className="flex items-center gap-1.5 text-[11px] font-medium text-[#2570ba] hover:underline transition-colors">
                <ExternalLink size={12}/> Abrir ficha
              </button>
            )}
            <span className="text-[11px] text-gray-400">{registros.length} entrada{registros.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setShowCargaMasiva(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              <Table2 size={13}/> Carga masiva
            </button>
            <button
              onClick={() => { setNewRow({ fecha: TODAY, por_hacer: '', estado: 'Pendiente', notas: '', responsable: 'MT' }); setEditingId(null) }}
              disabled={!!newRow}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 disabled:opacity-40 transition-colors shadow-sm">
              <Plus size={13}/> Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              {COLS.map(col => (
                <th key={col} className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ── Inline add row ── */}
            {newRow && (
              <tr className="bg-[#1a2e4a]/[0.025] border-b border-gray-100">
                <td className="px-3 py-2.5 text-center" style={{ width: 40 }}>
                  <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white mx-auto" />
                </td>
                <td className="px-4 py-2.5" style={{ width: 120 }}>
                  <input type="date" value={newRow.fecha}
                    onChange={e => setNewRow(p => ({ ...p, fecha: e.target.value }))}
                    className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-full"/>
                </td>
                <td className="px-4 py-2.5">
                  <textarea value={newRow.por_hacer} onChange={e => setNewRow(p => ({ ...p, por_hacer: e.target.value }))}
                    rows={2} autoFocus
                    placeholder="Ej: Revisado PJUD. Sin movimientos. / Llamado al cliente. / Preparar recurso…"
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-300 bg-white placeholder:text-gray-300"/>
                </td>
                <td className="px-4 py-2.5" style={{ width: 150 }}>
                  <EstadoInput value={newRow.estado} onChange={v => setNewRow(p => ({ ...p, estado: v }))}/>
                </td>
                <td className="px-4 py-2.5" style={{ width: 130 }}>
                  <RespSelect value={newRow.responsable} onChange={v => setNewRow(p => ({ ...p, responsable: v }))}/>
                </td>
                <td className="px-4 py-2.5">
                  <textarea value={newRow.notas} onChange={e => setNewRow(p => ({ ...p, notas: e.target.value }))}
                    rows={2} placeholder="Notas adicionales…"
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-300 bg-white placeholder:text-gray-300"/>
                </td>
                <td className="px-4 py-2.5" style={{ width: 72 }}>
                  <div className="flex items-center gap-1">
                    <button onClick={handleSaveNew} disabled={savingNew || !newRow.por_hacer?.trim()}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-colors">
                      {savingNew ? <Loader2 size={11} className="animate-spin"/> : <Check size={11}/>}
                    </button>
                    <button onClick={() => setNewRow(null)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                      <X size={11}/>
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* ── Empty state ── */}
            {!newRow && registros.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="py-16 text-center">
                    <Target size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-200"/>
                    <p className="text-[13px] text-gray-400 font-medium">Sin entradas de seguimiento</p>
                    <p className="text-[11px] text-gray-300 mt-1 max-w-xs mx-auto">
                      Registra revisiones de PJUD, SIAU, llamadas, reuniones, análisis de carpeta y cualquier gestión realizada.
                    </p>
                    <button onClick={() => setNewRow({ fecha: TODAY, por_hacer: '', estado: 'Pendiente', notas: '', responsable: 'MT' })}
                      className="mt-3 text-[12px] text-[#2570ba] hover:underline font-medium">
                      + Agregar primera entrada
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* ── Data rows ── */}
            {registros.map((row, idx) => {
              const isEditing = editingId === row.id
              const altRow    = idx % 2 === 1

              if (isEditing) return (
                <tr key={row.id} className="bg-blue-50/20 border-b border-gray-100">
                  <td className="px-3 py-2.5 text-center" style={{ width: 40 }}>
                    <div className={`w-4 h-4 rounded border-2 mx-auto flex items-center justify-center cursor-pointer transition-colors ${
                      editDraft.revisado ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'
                    }`} onClick={e => { e.stopPropagation(); ed('revisado', !editDraft.revisado) }}>
                      {editDraft.revisado && <Check size={10} className="text-white" strokeWidth={3}/>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5" style={{ width: 120 }}>
                    <input type="date" value={editDraft.fecha || ''}
                      onChange={e => ed('fecha', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-300 w-full"/>
                  </td>
                  <td className="px-4 py-2.5">
                    <textarea value={editDraft.por_hacer || ''} onChange={e => ed('por_hacer', e.target.value)}
                      rows={2} onClick={e => e.stopPropagation()}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-300 bg-white"/>
                  </td>
                  <td className="px-4 py-2.5" style={{ width: 150 }}>
                    <EstadoInput value={editDraft.estado} onChange={v => ed('estado', v)}/>
                  </td>
                  <td className="px-4 py-2.5" style={{ width: 130 }}>
                    <RespSelect value={editDraft.responsable} onChange={v => ed('responsable', v)}/>
                  </td>
                  <td className="px-4 py-2.5">
                    <textarea value={editDraft.notas || ''} onChange={e => ed('notas', e.target.value)}
                      rows={2} onClick={e => e.stopPropagation()}
                      className="w-full text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-300 bg-white"/>
                  </td>
                  <td className="px-4 py-2.5" style={{ width: 72 }}>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"><Check size={11}/></button>
                      <button onClick={cancelEdit} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"><X size={11}/></button>
                    </div>
                  </td>
                </tr>
              )

              const done = row.revisado
              return (
                <tr key={row.id}
                  onClick={() => { setEditingId(row.id); setEditDraft({ ...row }); setNewRow(null) }}
                  className={`border-b border-gray-50 cursor-pointer transition-all group ${
                    done
                      ? 'bg-green-50/30 hover:bg-green-50/50 opacity-60'
                      : altRow ? 'bg-gray-50/60 hover:bg-gray-100/60' : 'bg-white hover:bg-gray-50'
                  }`}>
                  <td className="px-3 py-3 text-center" style={{ width: 40 }}>
                    <button
                      onClick={e => toggleRevisado(row, e)}
                      title={done ? 'Desmarcar' : 'Marcar como revisado'}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center mx-auto transition-all duration-150 flex-shrink-0 ${
                        done ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600' : 'border-gray-300 bg-white hover:border-emerald-400'
                      }`}>
                      {done && <Check size={10} className="text-white" strokeWidth={3}/>}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ width: 120 }}>
                    <span className={`text-[12px] font-mono ${done ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{fmtDate(row.fecha)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className={`text-[12px] leading-relaxed whitespace-pre-wrap ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{row.por_hacer || '—'}</p>
                  </td>
                  <td className="px-4 py-3" style={{ width: 150 }}>
                    <span className={done ? 'opacity-50' : ''}><EstadoBadge v={row.estado}/></span>
                  </td>
                  <td className="px-4 py-3" style={{ width: 130 }}>
                    <span className={done ? 'opacity-50' : ''}><RespBadge resp={row.responsable}/></span>
                  </td>
                  <td className="px-4 py-3">
                    <p className={`text-[12px] leading-relaxed whitespace-pre-wrap ${done ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{row.notas || '—'}</p>
                  </td>
                  <td className="px-4 py-3" style={{ width: 72 }}>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget({ id: row.id, name: `la entrada del ${fmtDate(row.fecha)}` }) }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 size={11}/>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {showCargaMasiva && (
        <CargaMasivaModal
          modulo="seguimiento_rev"
          causaObj={causaObj}
          onClose={() => setShowCargaMasiva(false)}
          onSuccess={rows => rows.forEach(r => onAdd(mapRow(r)))}
        />
      )}
    </div>
  )
}

// ─── CausaCard ─────────────────────────────────────────────────────────────────
function CausaCard({ grupo, registrosAll, clienteNombre, onClick, revisadoSemana, onUpdateRevisadoSemana }) {
  const regs = registrosAll.filter(r => {
    if (grupo.causaInfo?.id && r.causa_id) return r.causa_id === String(grupo.causaInfo.id)
    return r.causa_rit === grupo.causa_rit && r.cliente_nombre === clienteNombre
  })
  const pendientes = regs.filter(r => r.estado === 'Pendiente').length
  const enProgreso = regs.filter(r => r.estado === 'En progreso').length

  return (
    <div onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#1a2e4a]/5 transition-colors group cursor-pointer">
      <div className="w-8 h-8 rounded-lg bg-[#1a2e4a]/8 flex items-center justify-center flex-shrink-0">
        <Scale size={14} className="text-[#1a2e4a]/50"/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {grupo.causa_rit
            ? <CopyValue value={grupo.causa_rit} className="text-xs font-bold text-[#1a2e4a] group-hover:text-[#2570ba] transition-colors" />
            : <span className="text-xs font-bold font-mono text-[#1a2e4a]">Sin RIT</span>
          }
          {grupo.causaInfo?.ruc && (
            <><span className="text-[10px] text-gray-300">·</span><CopyValue value={grupo.causaInfo.ruc} prefix="RUC" className="text-[10px] text-gray-400" /></>
          )}
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
        {enProgreso > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            {enProgreso} progreso
          </span>
        )}
        <span className="text-[10px] text-gray-400">{regs.length} entr.</span>
        <RevisadoSemanaCell value={revisadoSemana} onChange={v => onUpdateRevisadoSemana?.(grupo.causaInfo?.id, v)} />
        <ChevronRight size={13} className="text-gray-300 group-hover:text-[#2570ba] transition-colors"/>
      </div>
    </div>
  )
}

// ─── ClienteRow ───────────────────────────────────────────────────────────────
function ClienteRow({ grupo, registrosAll, isExpanded, onToggle, onSelectCausa, revisadoSemanaMap, onUpdateRevisadoSemana }) {
  const { clienteNombre, causasGrupos } = grupo
  const total      = registrosAll.filter(r => r.cliente_nombre === clienteNombre).length
  const pendientes = registrosAll.filter(r => r.cliente_nombre === clienteNombre && r.estado === 'Pendiente').length
  const ini        = clienteNombre.trim().split(/\s+/).slice(0,2).map(w => w[0] || '').join('').toUpperCase()

  return (
    <div className={`border border-gray-100 rounded-2xl overflow-hidden transition-shadow ${isExpanded ? 'shadow-sm' : ''}`}>
      <button onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
          isExpanded ? 'bg-[#1a2e4a]/[0.04]' : 'bg-white hover:bg-gray-50'
        }`}>
        <div className="w-9 h-9 rounded-full bg-[#2570BA] flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold select-none">
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1a2e4a] truncate">{clienteNombre}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {causasGrupos.length} causa{causasGrupos.length !== 1 ? 's' : ''}
            {total > 0 && <span className="ml-1.5">· {total} entrada{total !== 1 ? 's' : ''}</span>}
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
            <CausaCard key={g.causaInfo?.id || g.causa_rit || 'sinrit'}
              grupo={g} registrosAll={registrosAll} clienteNombre={clienteNombre}
              onClick={() => onSelectCausa(clienteNombre, g)}
              revisadoSemana={revisadoSemanaMap?.[String(g.causaInfo?.id)] ?? null}
              onUpdateRevisadoSemana={onUpdateRevisadoSemana}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function SeguimientoSemanal() {
  const [registros,   setRegistros]  = useState([])
  const [allCausas,   setAllCausas]  = useState([])
  const [cargando,    setCargando]   = useState(true)
  const [expandedSet, setExpanded]   = useState(new Set())
  const [search,      setSearch]     = useState('')

  const [semanaInicio,      setSemanaInicio]      = useState(getSemanaInicio)
  const [revisadoSemanaMap, setRevisadoSemanaMap] = useState({})
  const [showNuevaSemana,   setShowNuevaSemana]   = useState(false)

  // Navigation
  const [view,        setView]       = useState('clientes')
  const [selCliente,  setSelCliente] = useState(null)
  const [selCausaId,  setSelCausaId] = useState(null)   // usa ID, no RIT

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchRegistros = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase
      .from('revisiones')
      .select('*')
      .or('semana_key.is.null,semana_key.like.SEG-%')
      .order('fecha_revision', { ascending: false })
    setRegistros((data || []).map(mapRow))
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id,rit,ruc,materia,area,tribunal,cliente_nombre,cliente_id')
      .in('estado', ['En tramitación', 'Abierta'])
      .order('cliente_nombre')
    setAllCausas(data || [])
  }, [])

  useEffect(() => { fetchRegistros(); fetchCausas() }, [fetchRegistros, fetchCausas])

  useEffect(() => {
    async function fetchSemana() {
      const sKey = mkSemanaKey(semanaInicio)
      const { data } = await supabase
        .from('revisiones')
        .select('causa_id, revisado_semana')
        .eq('semana_key', sKey)
        .not('revisado_semana', 'is', null)
      const m = {}
      ;(data || []).forEach(r => { m[String(r.causa_id)] = r.revisado_semana })
      setRevisadoSemanaMap(m)
    }
    fetchSemana()
  }, [semanaInicio])

  const updateRevisadoSemana = useCallback(async (causaId, valor) => {
    if (!causaId) return
    setRevisadoSemanaMap(prev => {
      if (valor === null) { const { [String(causaId)]: _rm, ...rest } = prev; return rest }
      return { ...prev, [String(causaId)]: valor }
    })
    const sKey = mkSemanaKey(semanaInicio)
    await supabase.from('revisiones')
      .upsert({ semana_key: sKey, causa_id: causaId, revisado_semana: valor, revisada: false },
        { onConflict: 'semana_key,causa_id' })
  }, [semanaInicio])

  function handleNuevaSemana() {
    try { localStorage.setItem(SEMANA_LS_KEY, TODAY) } catch {}
    setSemanaInicio(TODAY)
    setRevisadoSemanaMap({})
    setShowNuevaSemana(false)
  }

  // ── CRUD local ───────────────────────────────────────────────────────────────
  const handleUpdate = useCallback((id, cambios) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
  }, [])

  const handleAdd    = useCallback((newReg) => setRegistros(prev => [newReg, ...prev]), [])
  const handleDelete = useCallback((id)    => setRegistros(prev => prev.filter(r => r.id !== id)), [])

  // ── Build client → causas tree ───────────────────────────────────────────────
  const clienteGrupos = useMemo(() => {
    const clienteSet = new Set()
    allCausas.forEach(c => { if (c.cliente_nombre) clienteSet.add(c.cliente_nombre) })

    return [...clienteSet].sort().map(clienteNombre => {
      const causasCliente = allCausas.filter(c => c.cliente_nombre === clienteNombre)
      const grupos = causasCliente.map(ci => ({
        causa_rit:      ci.rit || null,
        causaInfo:      ci,
        cliente_nombre: clienteNombre,
      })).sort((a, b) => (a.causa_rit || '').localeCompare(b.causa_rit || ''))
      return { clienteNombre, causasGrupos: grupos }
    })
  }, [allCausas])

  // ── A-Z filter ───────────────────────────────────────────────────────────────
  const filteredGrupos = useMemo(() => {
    if (!search.trim()) return clienteGrupos
    const q = search.toLowerCase()
    return clienteGrupos.filter(cl =>
      cl.clienteNombre.toLowerCase().includes(q) ||
      cl.causasGrupos.some(g =>
        (g.causa_rit || '').toLowerCase().includes(q) ||
        (g.causaInfo?.materia || '').toLowerCase().includes(q)
      )
    )
  }, [clienteGrupos, search])

  const byLetter = useMemo(() => {
    const map = {}
    filteredGrupos.forEach(cl => {
      const l = cl.clienteNombre.charAt(0).toUpperCase() || '#'
      if (!map[l]) map[l] = []
      map[l].push(cl)
    })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
  }, [filteredGrupos])

  // ── Selected grupo ───────────────────────────────────────────────────────────
  const selectedGrupo = useMemo(() => {
    if (!selCausaId || !selCliente) return null
    const cl = clienteGrupos.find(g => g.clienteNombre === selCliente)
    return cl?.causasGrupos.find(g => String(g.causaInfo?.id) === selCausaId) || null
  }, [clienteGrupos, selCausaId, selCliente])

  const selectedCausaObj = useMemo(() => {
    if (!selectedGrupo) return null
    const ci = selectedGrupo.causaInfo
    return {
      rit:            ci?.rit            || selectedGrupo.causa_rit,
      ruc:            ci?.ruc            || null,
      cliente_nombre: selCliente,
      id:             ci?.id ? String(ci.id) : null,
      cliente_id:     ci?.cliente_id     || null,
      materia:        ci?.materia        || '',
      tribunal:       ci?.tribunal       || '',
      area:           ci?.area           || '',
    }
  }, [selectedGrupo, selCliente])

  function handleSelectCausa(clienteNombre, grupo) {
    setSelCliente(clienteNombre)
    setSelCausaId(String(grupo.causaInfo?.id || ''))
    setView('tabla')
  }

  function handleBack(to) {
    setView('clientes')
    if (to === 'clientes') { setSelCliente(null); setSelCausaId(null) }
  }

  const toggleExpanded = nombre => setExpanded(prev => {
    const next = new Set(prev); next.has(nombre) ? next.delete(nombre) : next.add(nombre); return next
  })

  const stats = useMemo(() => ({
    clientes:    clienteGrupos.length,
    entradas:    registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente').length,
    enProgreso:  registros.filter(r => r.estado === 'En progreso').length,
    listos:      registros.filter(r => r.estado === 'Listo').length,
  }), [clienteGrupos, registros])

  // ── Vista tabla ──────────────────────────────────────────────────────────────
  if (view === 'tabla' && selectedGrupo && selectedCausaObj) {
    return (
      <RegistrosTable
        grupo={selectedGrupo}
        registrosAll={registros}
        causaObj={selectedCausaObj}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onBack={handleBack}
        clienteNombre={selCliente}
      />
    )
  }

  // ── Vista lista clientes ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-[#1a2e4a]">Seguimiento semanal</h1>
          <button onClick={() => setShowNuevaSemana(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 px-3.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-shrink-0">
            <RefreshCw size={13} /> Nueva semana
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          Bitácora de gestiones operativas diarias — revisiones, llamadas, reuniones, escritos y observaciones
        </p>

        {/* Stat cards */}
        {!cargando && (
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {[
              { label: 'Entradas',    value: stats.entradas,   bg: 'bg-gray-50',   ic: 'text-gray-500',  Icon: FileText     },
              { label: 'Pendientes',  value: stats.pendientes, bg: 'bg-amber-50',  ic: 'text-amber-500', Icon: Clock        },
              { label: 'En progreso', value: stats.enProgreso, bg: 'bg-blue-50',   ic: 'text-blue-500',  Icon: AlertCircle  },
              { label: 'Listos',      value: stats.listos,     bg: 'bg-green-50',  ic: 'text-green-500', Icon: CheckCircle2 },
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
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12}/>
            </button>
          )}
        </div>
      </div>

      {showNuevaSemana && (
        <ModalNuevaSemana
          onConfirm={handleNuevaSemana}
          onCancel={() => setShowNuevaSemana(false)} />
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300"/>
          </div>
        ) : byLetter.length === 0 ? (
          <div className="text-center py-20">
            <Scale size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-200"/>
            <p className="text-sm text-gray-400">{search ? `Sin resultados para "${search}"` : 'Sin causas activas'}</p>
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
                      revisadoSemanaMap={revisadoSemanaMap}
                      onUpdateRevisadoSemana={updateRevisadoSemana}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
