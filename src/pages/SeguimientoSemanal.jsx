import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, Search, Plus, ArrowLeft,
  X, Check, Edit2, Loader2, Scale,
  CheckCircle2, Clock, AlertCircle, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const ESTADO_CONFIG = {
  'Pendiente':   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  'En proceso':  { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  'Completado':  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'Bloqueado':   { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400'     },
}
const ESTADO_OPTS = Object.keys(ESTADO_CONFIG)

const DB_FIELDS = new Set([
  'fecha', 'por_hacer', 'estado', 'que_se_hizo', 'proxima_accion', 'notas',
  'causa_rit', 'cliente_nombre', 'causa_id', 'cliente_id',
])

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

function mapRow(row) {
  return {
    id:             row.id,
    created_at:     row.created_at,
    fecha:          row.fecha          || TODAY,
    por_hacer:      row.por_hacer      || '',
    estado:         row.estado         || 'Pendiente',
    que_se_hizo:    row.que_se_hizo    || '',
    proxima_accion: row.proxima_accion || '',
    notas:          row.notas          || '',
    causa_rit:      row.causa_rit      || '',
    cliente_nombre: row.cliente_nombre || '',
    causa_id:       row.causa_id       || null,
    cliente_id:     row.cliente_id     || null,
  }
}

// ── EstadoBadge ───────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Pendiente']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{estado}
    </span>
  )
}

function EstadoDropdown({ estado, onChange }) {
  const [open, setOpen] = useState(false)
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Pendiente']
  return (
    <div className="relative inline-flex" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap hover:opacity-80 cursor-pointer ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />{estado}
        <ChevronDown size={9} className="opacity-50 -mr-0.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[160px] py-1">
          {ESTADO_OPTS.map(e => {
            const c = ESTADO_CONFIG[e]
            return (
              <button key={e} onClick={() => { onChange(e); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 ${e === estado ? 'bg-gray-50/80' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className={`text-[11px] font-medium ${e === estado ? c.text : 'text-gray-600'}`}>{e}</span>
                {e === estado && <Check size={10} className="ml-auto text-gray-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── FormNuevoRegistro (modal) ─────────────────────────────────────────────────
function FormNuevoRegistro({ causa, causasInfo, globalMode, onSave, onClose }) {
  const [selCliente, setSelCliente] = useState(globalMode ? '' : (causa?.cliente_nombre || ''))
  const [selRit,     setSelRit]     = useState(globalMode ? '' : (causa?.rit || ''))
  const [form, setForm] = useState({
    fecha: TODAY, por_hacer: '', estado: 'Pendiente',
    que_se_hizo: '', proxima_accion: '', notas: '',
  })
  const [saving, setSaving] = useState(false)

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
  const valid = form.por_hacer.trim() && (globalMode ? !!causaFinal : true)

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    const payload = {
      fecha:          form.fecha,
      por_hacer:      form.por_hacer.trim() || null,
      estado:         form.estado,
      que_se_hizo:    form.que_se_hizo.trim() || null,
      proxima_accion: form.proxima_accion.trim() || null,
      notas:          form.notas.trim() || null,
      causa_rit:      causaFinal?.rit || causaFinal?.causa_rit || '',
      cliente_nombre: causaFinal?.cliente_nombre || '',
      causa_id:       causaFinal?.id || null,
      cliente_id:     causaFinal?.cliente_id || null,
    }
    const { data, error } = await supabase.from('seguimiento').insert([payload]).select().single()
    if (!error && data) onSave(mapRow(data))
    setSaving(false)
    onClose()
  }

  const L = ({ c }) => <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{c}</p>
  const inp = 'w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-[#1a2e4a]">Nuevo registro · Seguimiento Semanal</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100"><X size={15}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {globalMode && (
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-gray-50">
              <div>
                <L c="Cliente" />
                <select value={selCliente} onChange={e => { setSelCliente(e.target.value); setSelRit('') }}
                  className={inp + ' bg-white'}>
                  <option value="">Seleccionar…</option>
                  {clientes.map(cl => <option key={cl}>{cl}</option>)}
                </select>
              </div>
              <div>
                <L c="Causa (RIT)" />
                <select value={selRit} onChange={e => setSelRit(e.target.value)}
                  disabled={!selCliente}
                  className={inp + ' bg-white disabled:opacity-40'}>
                  <option value="">Seleccionar…</option>
                  {causasOpts.map(c => <option key={c.id} value={c.rit}>{c.rit}{c.materia ? ` — ${c.materia}` : ''}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <L c="Fecha" />
              <input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} className={inp} />
            </div>
            <div>
              <L c="Estado" />
              <select value={form.estado} onChange={e => f('estado', e.target.value)} className={inp + ' bg-white'}>
                {ESTADO_OPTS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <L c="Por hacer *" />
            <textarea value={form.por_hacer} onChange={e => f('por_hacer', e.target.value)}
              rows={3} placeholder="¿Qué hay que hacer esta semana?…"
              className={inp + ' resize-none'} />
          </div>

          <div>
            <L c="Qué se hizo" />
            <textarea value={form.que_se_hizo} onChange={e => f('que_se_hizo', e.target.value)}
              rows={2} placeholder="Avances realizados…"
              className={inp + ' resize-none'} />
          </div>

          <div>
            <L c="Próxima acción" />
            <textarea value={form.proxima_accion} onChange={e => f('proxima_accion', e.target.value)}
              rows={2} placeholder="¿Qué viene después?…"
              className={inp + ' resize-none'} />
          </div>

          <div>
            <L c="Notas internas" />
            <textarea value={form.notas} onChange={e => f('notas', e.target.value)}
              rows={2} placeholder="Observaciones…"
              className={inp + ' resize-none'} />
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-gray-100 flex gap-2 bg-gray-50/30 flex-shrink-0">
          <button onClick={onClose} className="flex-1 text-xs text-gray-400 py-2.5 rounded-xl hover:bg-gray-100 font-medium">Cancelar</button>
          <button onClick={handleSave}
            disabled={!valid || saving}
            className="flex-1 text-xs bg-[#2570BA] text-white py-2.5 rounded-xl hover:bg-[#2570BA]/90 font-semibold disabled:opacity-40 shadow-sm">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RegistrosTable ─────────────────────────────────────────────────────────────
function RegistrosTable({ grupo, registrosAll, onUpdate, onAdd, onDelete, causasInfo, onBack, clienteNombre }) {
  const registros = useMemo(() =>
    registrosAll
      .filter(r => r.causa_rit === grupo.causa_rit && r.cliente_nombre === clienteNombre)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [registrosAll, grupo.causa_rit, clienteNombre])

  const [expandedId,   setExpandedId]   = useState(null)
  const [editingId,    setEditingId]    = useState(null)
  const [editDraft,    setEditDraft]    = useState({})
  const [showForm,     setShowForm]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('seguimiento').delete().eq('id', deleteTarget.id)
    onDelete && onDelete(deleteTarget.id)
    setDeleteTarget(null)
  }

  const toggleRow  = id => { if (editingId === id) return; setExpandedId(p => p === id ? null : id) }
  const startEdit  = (r, e) => { e.stopPropagation(); setEditingId(r.id); setEditDraft({ ...r }); setExpandedId(null) }
  const cancelEdit = e => { e.stopPropagation(); setEditingId(null) }
  const saveEdit   = async e => {
    e.stopPropagation()
    await onUpdate(editingId, editDraft)
    setEditingId(null)
  }
  const ed = (k, v) => setEditDraft(p => ({ ...p, [k]: v }))

  const counts = {
    total:      registros.length,
    pendientes: registros.filter(r => r.estado === 'Pendiente').length,
    completados: registros.filter(r => r.estado === 'Completado').length,
  }

  const COLS = ['Fecha','Por hacer','Estado','Qué se hizo','Próx. acción','Notas','']

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <nav className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3">
          <button onClick={() => onBack('clientes')} className="hover:text-[#1a2e4a] font-medium transition-colors">Clientes</button>
          <ChevronRight size={10} className="text-gray-300"/>
          <button onClick={() => onBack('causas')} className="hover:text-[#1a2e4a] font-medium transition-colors truncate max-w-[160px]">{clienteNombre}</button>
          <ChevronRight size={10} className="text-gray-300"/>
          <span className="font-mono font-semibold text-[#1a2e4a]">{grupo.causa_rit || 'Sin RIT'}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => onBack('causas')}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#1a2e4a] transition-colors">
              <ArrowLeft size={13}/> Volver
            </button>
            <div className="w-px h-4 bg-gray-200"/>
            <div>
              <h2 className="text-sm font-bold text-[#1a2e4a] font-mono">{grupo.causa_rit || 'Sin RIT'}</h2>
              {grupo.causaInfo?.materia && <p className="text-[11px] text-gray-400 mt-0.5">{grupo.causaInfo.materia}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="font-semibold text-gray-800 tabular-nums">{counts.total} registros</span>
              {counts.completados > 0 && <span className="text-emerald-700">{counts.completados} completados</span>}
              {counts.pendientes  > 0 && <span className="text-amber-700">{counts.pendientes} pendientes</span>}
            </div>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-3.5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm">
              <Plus size={13}/> Nuevo registro
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <CheckCircle2 size={32} className="text-gray-200 mb-3"/>
            <p className="text-sm text-gray-400 font-medium">Sin registros de seguimiento</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-[#2570ba] hover:underline font-medium">
              + Agregar primer registro
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_1px_0_#f3f4f6]">
              <tr>
                {COLS.map(col => (
                  <th key={col} className="px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap first:pl-6 last:pr-4">
                    {col}
                  </th>
                ))}
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
                            <textarea value={editDraft.por_hacer||''} onChange={e=>ed('por_hacer',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[160px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <select value={editDraft.estado||'Pendiente'} onChange={e=>ed('estado',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-300 bg-white">
                              {ESTADO_OPTS.map(o=><option key={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={editDraft.que_se_hizo||''} onChange={e=>ed('que_se_hizo',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[140px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={editDraft.proxima_accion||''} onChange={e=>ed('proxima_accion',e.target.value)}
                              onClick={e=>e.stopPropagation()} rows={2}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:border-blue-300 bg-white min-w-[140px]"/>
                          </td>
                          <td className="px-3 py-2">
                            <input value={editDraft.notas||''} onChange={e=>ed('notas',e.target.value)}
                              onClick={e=>e.stopPropagation()}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:border-blue-300 bg-white min-w-[100px]"/>
                          </td>
                          <td className="px-3 py-2 pr-4">
                            <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                              <button onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={11}/></button>
                              <button onClick={cancelEdit} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100"><X size={11}/></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 first:pl-6 whitespace-nowrap">
                            <span className="text-[11px] text-gray-500">{fmtFechaCorta(r.fecha)}</span>
                          </td>
                          <td className="px-3 py-3 max-w-[200px]">
                            <p className={`text-xs text-gray-700 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {r.por_hacer || '—'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <EstadoDropdown estado={r.estado} onChange={e => onUpdate(r.id, { estado: e })} />
                          </td>
                          <td className="px-3 py-3 max-w-[180px]">
                            <p className={`text-xs text-gray-500 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {r.que_se_hizo || <span className="text-gray-300 italic">—</span>}
                            </p>
                          </td>
                          <td className="px-3 py-3 max-w-[160px]">
                            <p className={`text-xs text-gray-500 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              {r.proxima_accion || <span className="text-gray-300 italic">—</span>}
                            </p>
                          </td>
                          <td className="px-3 py-3 max-w-[120px]">
                            <p className="text-[11px] text-gray-400 truncate">{r.notas || '—'}</p>
                          </td>
                          <td className="px-3 py-3 pr-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={e => startEdit(r, e)}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                                <Edit2 size={11}/>
                              </button>
                              <button onClick={e => { e.stopPropagation(); setDeleteTarget({ id: r.id, name: `el registro del ${fmtFechaCorta(r.fecha)}` }) }}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                                <Trash2 size={11}/>
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && !isEditing && (
                      <tr key={`${r.id}_exp`} className={altRow ? 'bg-gray-50/60' : 'bg-white'}>
                        <td colSpan={7} className="px-6 pb-5 pt-1">
                          <div className="rounded-2xl border border-[#1a2e4a]/8 bg-[#1a2e4a]/[0.025] p-5 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Por hacer</p>
                              <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{r.por_hacer || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Qué se hizo</p>
                              <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{r.que_se_hizo || <span className="text-gray-300 italic">Sin registrar</span>}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Próxima acción</p>
                              <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{r.proxima_accion || <span className="text-gray-300 italic">Sin definir</span>}</p>
                              {r.notas && (
                                <div className="mt-3 pt-3 border-t border-[#1a2e4a]/10">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notas</p>
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
        <FormNuevoRegistro
          causa={grupo.causaInfo
            ? { ...grupo.causaInfo, rit: grupo.causa_rit }
            : { rit: grupo.causa_rit, cliente_nombre: clienteNombre, id: null, cliente_id: null }}
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
    </div>
  )
}

// ── CausaCard ─────────────────────────────────────────────────────────────────
function CausaCard({ grupo, registrosAll, clienteNombre, onClick }) {
  const regs       = registrosAll.filter(r => r.causa_rit === grupo.causa_rit && r.cliente_nombre === clienteNombre)
  const pendientes = regs.filter(r => r.estado === 'Pendiente').length

  return (
    <button onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#1a2e4a]/5 transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-[#1a2e4a]/8 flex items-center justify-center flex-shrink-0">
        <Scale size={14} className="text-[#1a2e4a]/50"/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-mono text-[#1a2e4a] group-hover:text-[#2570ba] transition-colors">
            {grupo.causa_rit || 'Sin RIT'}
          </span>
          {grupo.causaInfo?.ruc && (
            <span className="text-[10px] font-mono text-gray-400">· RUC {grupo.causaInfo.ruc}</span>
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
        <span className="text-[10px] text-gray-400">{regs.length} reg.</span>
        <ChevronRight size={13} className="text-gray-300 group-hover:text-[#2570ba] transition-colors"/>
      </div>
    </button>
  )
}

// ── ClienteRow ────────────────────────────────────────────────────────────────
function ClienteRow({ grupo, registrosAll, isExpanded, onToggle, onSelectCausa }) {
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
        <div className="w-9 h-9 rounded-full bg-[#2570BA] flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold select-none">
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1a2e4a] truncate">{clienteNombre}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {causasGrupos.length} causa{causasGrupos.length !== 1 ? 's' : ''}
            {total > 0 && <span className="ml-1.5">· {total} registro{total !== 1 ? 's' : ''}</span>}
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
            <CausaCard key={g.causa_rit || 'sinrit'}
              grupo={g} registrosAll={registrosAll} clienteNombre={clienteNombre}
              onClick={() => onSelectCausa(clienteNombre, g)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SeguimientoSemanal() {
  const [registros,     setRegistros]     = useState([])
  const [allCausas,     setAllCausas]     = useState([])
  const [cargando,      setCargando]      = useState(true)
  const [expandedSet,   setExpanded]      = useState(new Set())
  const [search,        setSearch]        = useState('')
  const [showForm,      setShowForm]      = useState(false)

  // Navigation
  const [view,        setView]       = useState('clientes')
  const [selCliente,  setSelCliente] = useState(null)
  const [selCausaRit, setSelCausaRit] = useState(null)

  const fetchRegistros = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase.from('seguimiento').select('*').order('fecha', { ascending: false })
    setRegistros((data || []).map(mapRow))
    setCargando(false)
  }, [])

  const fetchCausas = useCallback(async () => {
    const { data } = await supabase
      .from('causas')
      .select('id,rit,ruc,materia,area,tribunal,cliente_nombre,cliente_id')
      .in('estado', ['En tramitación', 'Abierta'])
      .order('rit')
    setAllCausas(data || [])
  }, [])

  useEffect(() => { fetchRegistros(); fetchCausas() }, [fetchRegistros, fetchCausas])

  const handleUpdate = useCallback(async (id, cambios) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...cambios } : r))
    const dbCambios = Object.fromEntries(Object.entries(cambios).filter(([k]) => DB_FIELDS.has(k)))
    if (Object.keys(dbCambios).length) await supabase.from('seguimiento').update(dbCambios).eq('id', id)
  }, [])

  const handleAdd = useCallback((newReg) => setRegistros(prev => [newReg, ...prev]), [])

  const handleDeleteReg = useCallback((id) => setRegistros(prev => prev.filter(r => r.id !== id)), [])

  // Build client → causas tree
  const clienteGrupos = useMemo(() => {
    const clienteSet = new Set()
    allCausas.forEach(c => { if (c.cliente_nombre) clienteSet.add(c.cliente_nombre) })

    return [...clienteSet].sort().map(clienteNombre => {
      const causasCliente = allCausas.filter(c => c.cliente_nombre === clienteNombre)
      const grupos = causasCliente.map(ci => ({
        causa_rit: ci.rit || null,
        causaInfo: ci,
        cliente_nombre: clienteNombre,
      })).sort((a, b) => (a.causa_rit||'').localeCompare(b.causa_rit||''))
      return { clienteNombre, causasGrupos: grupos }
    })
  }, [allCausas])

  // Filter by search
  const filteredGrupos = useMemo(() => {
    if (!search.trim()) return clienteGrupos
    const q = search.toLowerCase()
    return clienteGrupos.filter(cl =>
      cl.clienteNombre.toLowerCase().includes(q) ||
      cl.causasGrupos.some(g =>
        (g.causa_rit||'').toLowerCase().includes(q) ||
        (g.causaInfo?.materia||'').toLowerCase().includes(q)
      )
    )
  }, [clienteGrupos, search])

  // A-Z grouping
  const byLetter = useMemo(() => {
    const map = {}
    filteredGrupos.forEach(cl => {
      const l = cl.clienteNombre.charAt(0).toUpperCase() || '#'
      if (!map[l]) map[l] = []
      map[l].push(cl)
    })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
  }, [filteredGrupos])

  const selectedGrupo = useMemo(() => {
    if (!selCausaRit || !selCliente) return null
    const cl = clienteGrupos.find(g => g.clienteNombre === selCliente)
    return cl?.causasGrupos.find(g => g.causa_rit === selCausaRit) || null
  }, [clienteGrupos, selCausaRit, selCliente])

  function handleSelectCausa(clienteNombre, grupo) {
    setSelCliente(clienteNombre)
    setSelCausaRit(grupo.causa_rit)
    setView('tabla')
  }

  function handleBack(to) {
    setView('clientes')
    if (to === 'clientes') { setSelCliente(null); setSelCausaRit(null) }
  }

  const toggleExpanded = nombre => setExpanded(prev => {
    const next = new Set(prev); next.has(nombre) ? next.delete(nombre) : next.add(nombre); return next
  })

  const stats = useMemo(() => ({
    clientes:    clienteGrupos.length,
    registros:   registros.length,
    pendientes:  registros.filter(r => r.estado === 'Pendiente').length,
    completados: registros.filter(r => r.estado === 'Completado').length,
  }), [clienteGrupos, registros])

  // ── Tabla view ──
  if (view === 'tabla' && selectedGrupo) {
    return (
      <RegistrosTable
        grupo={selectedGrupo}
        registrosAll={registros}
        onUpdate={handleUpdate}
        onAdd={handleAdd}
        onDelete={handleDeleteReg}
        causasInfo={allCausas}
        onBack={handleBack}
        clienteNombre={selCliente}
      />
    )
  }

  // ── Client list view ──
  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#1a2e4a]">Seguimiento Semanal</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {cargando ? 'Cargando…' : (
                <>
                  {stats.clientes} cliente{stats.clientes !== 1 ? 's' : ''} · {stats.registros} registros
                  {stats.pendientes > 0 && <span className="text-amber-600"> · {stats.pendientes} pendientes</span>}
                  {stats.completados > 0 && <span className="text-emerald-600"> · {stats.completados} completados</span>}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#2570BA] text-white text-[13px] font-medium rounded-lg hover:bg-[#2570BA]/90 transition-colors">
              <Plus size={14} /> Nuevo registro
            </button>
          </div>
        </div>

        {/* Stats */}
        {!cargando && (
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              { label: 'Registros totales', value: stats.registros,   bg: 'bg-gray-50',    ic: 'text-gray-500',   Icon: CheckCircle2 },
              { label: 'Pendientes',         value: stats.pendientes,  bg: 'bg-amber-50',   ic: 'text-amber-500',  Icon: Clock        },
              { label: 'Completados',        value: stats.completados, bg: 'bg-emerald-50', ic: 'text-emerald-500',Icon: Check        },
            ].map(({ label, value, bg, ic, Icon }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={14} className={ic} />
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
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <FormNuevoRegistro
          causa={null} causasInfo={allCausas} globalMode
          onSave={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}

    </div>
  )
}
