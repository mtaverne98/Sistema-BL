import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Loader2, CheckSquare, Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TODAY = new Date().toISOString().slice(0, 10)

function fmt(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

// ── TareaFila (compact mode row) ──────────────────────────────────────────────
function TareaFila({ t, editingId, editDraft, setEditDraft, onCheck, onStartEdit, onCommit, onCancelEdit }) {
  if (editingId === t.id) {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <div className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded border border-gray-200" />
        <input
          autoFocus
          value={editDraft}
          onChange={e => setEditDraft(e.target.value)}
          onBlur={() => onCommit(t.id)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onCommit(t.id) }
            if (e.key === 'Escape') onCancelEdit()
          }}
          className="flex-1 text-[11px] text-gray-700 border border-blue-300 rounded px-1.5 py-0.5 outline-none bg-white"
        />
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 py-0.5 group">
      <button
        type="button"
        onClick={() => onCheck(t)}
        className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 rounded border border-gray-300 hover:border-[#2570BA] hover:bg-blue-50 transition-colors cursor-pointer"
        title="Marcar como completada"
      />
      <span
        onDoubleClick={() => onStartEdit(t)}
        className="flex-1 text-[11px] text-gray-700 leading-snug cursor-text hover:bg-gray-50 rounded px-0.5"
        title="Doble clic para editar"
      >
        {t.titulo || '—'}
      </span>
    </div>
  )
}

// ── TareasLista ───────────────────────────────────────────────────────────────
/**
 * Componente unificado de tareas. Sirve para:
 *  - Ficha cliente (modo='compact'): filtra por clienteId + causaIds, agrupa por causa
 *  - Pestaña Tareas de una causa (modo='full'): filtra por causaId, split pendientes/completadas
 *
 * Props:
 *   causaId         — string  — filtrar por causa única (modo full)
 *   causaIds        — array   — causa IDs del cliente para fallback de query (modo compact)
 *   clienteId       — string  — filtrar por cliente_id (modo compact)
 *   clienteNombre   — string  — para crear tareas
 *   causa           — object  — causa activa (para crear tareas en modo full)
 *   causas          — array   — lista de causas del cliente (para headers compactos)
 *   modo            — 'compact' | 'full'
 *   initialTareas   — array   — si se da, omite el fetch inicial
 *   onTareasChange  — fn(tareas) — callback cuando la lista cambia
 */
export default function TareasLista({
  causaId,
  causaIds,
  clienteId,
  clienteNombre,
  causa,
  causas = [],
  modo = 'full',
  initialTareas,
  onTareasChange,
}) {
  const [tareas,     setTareas]     = useState(initialTareas ?? null)
  const [loading,    setLoading]    = useState(!initialTareas)
  const [editingId,  setEditingId]  = useState(null)
  const [editDraft,  setEditDraft]  = useState('')
  const [showComp,   setShowComp]   = useState(false)
  const [resolviendo, setResolviendo] = useState({}) // { id: true } mientras desaparece
  const undoTimers = useRef({})
  const skipEvent  = useRef(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTareas = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tareas').select('*')
    if (causaId) {
      q = q.eq('causa_id', causaId)
    } else if (clienteId) {
      if (causaIds?.length) {
        q = q.or(`cliente_id.eq.${clienteId},causa_id.in.(${causaIds.join(',')})`)
      } else {
        q = q.eq('cliente_id', clienteId)
      }
    }
    q = q.order('created_at', { ascending: true })
    const { data } = await q
    const list = data ?? []
    setTareas(list)
    onTareasChange?.(list)
    setLoading(false)
  }, [causaId, clienteId, causaIds, onTareasChange])

  useEffect(() => {
    if (initialTareas != null) {
      setTareas(initialTareas)
      return
    }
    fetchTareas()
  }, [fetchTareas, initialTareas])

  // Escuchar cambios externos para refrescar
  useEffect(() => {
    const handler = () => {
      if (skipEvent.current) return
      if (initialTareas != null) return // estado manejado externamente
      fetchTareas()
    }
    window.addEventListener('tareas:updated', handler)
    return () => window.removeEventListener('tareas:updated', handler)
  }, [fetchTareas, initialTareas])

  function dispatch() {
    skipEvent.current = true
    window.dispatchEvent(new CustomEvent('tareas:updated'))
    setTimeout(() => { skipEvent.current = false }, 100)
  }

  function updateList(fn) {
    setTareas(prev => {
      const next = fn(prev ?? [])
      onTareasChange?.(next)
      return next
    })
  }

  // ── Marcar completada ──────────────────────────────────────────────────────
  function handleCheck(t) {
    if (modo === 'full') {
      // optimistic
      updateList(prev => prev.map(x => x.id === t.id
        ? { ...x, estado: 'Completada', fecha_completada: TODAY }
        : x
      ))
      supabase.from('tareas')
        .update({ estado: 'Completada', fecha_completada: TODAY })
        .eq('id', t.id)
        .then(({ error }) => {
          if (error) {
            updateList(prev => prev.map(x => x.id === t.id ? t : x))
          } else {
            dispatch()
          }
        })
    } else {
      // compact: disappear + undo (3 s)
      setResolviendo(prev => ({ ...prev, [t.id]: true }))
      const timer = setTimeout(async () => {
        updateList(prev => prev.filter(x => x.id !== t.id))
        setResolviendo(prev => { const n = { ...prev }; delete n[t.id]; return n })
        await supabase.from('tareas')
          .update({ estado: 'Completada', fecha_completada: TODAY })
          .eq('id', t.id)
        dispatch()
      }, 3000)
      undoTimers.current[t.id] = timer
    }
  }

  function handleUndo(id) {
    clearTimeout(undoTimers.current[id])
    delete undoTimers.current[id]
    setResolviendo(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  useEffect(() => () => {
    Object.values(undoTimers.current).forEach(clearTimeout)
  }, [])

  // ── Edición inline ─────────────────────────────────────────────────────────
  function startEdit(t) { setEditingId(t.id); setEditDraft(t.titulo) }

  async function commitEdit(id) {
    const v = editDraft.trim()
    setEditingId(null)
    if (!v) return
    updateList(prev => prev.map(x => x.id === id ? { ...x, titulo: v } : x))
    const { error } = await supabase.from('tareas').update({ titulo: v }).eq('id', id)
    if (error) {
      updateList(prev => prev.map(x => x.id === id ? { ...x, titulo: x.titulo } : x))
    } else {
      dispatch()
    }
  }

  // ── Nueva tarea ────────────────────────────────────────────────────────────
  async function handleNueva(causaCtx) {
    const titulo = 'Nueva tarea'
    const { data, error } = await supabase.from('tareas')
      .insert({
        titulo,
        estado: 'Pendiente',
        prioridad: 'Media',
        causa_id:      causaCtx?.id   ?? causaId ?? null,
        causa_rit:     causaCtx?.rit  ?? causa?.rit  ?? null,
        cliente_id:    clienteId      ?? causa?.cliente_id ?? null,
        cliente_nombre:clienteNombre  ?? causa?.cliente_nombre ?? null,
      })
      .select('*')
      .single()
    if (!error && data) {
      updateList(prev => [...prev, data])
      setEditingId(data.id)
      setEditDraft(titulo)
      dispatch()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading || tareas === null) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={14} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (modo === 'compact') return <CompactMode {...{ tareas, causas, clienteId, editingId, editDraft, setEditDraft, resolviendo, handleCheck, handleUndo, startEdit, commitEdit, setEditingId, handleNueva }} />
  return <FullMode {...{ tareas, editingId, editDraft, setEditDraft, showComp, setShowComp, handleCheck, startEdit, commitEdit, setEditingId, handleNueva, causa }} />
}

// ── Compact mode (FichaCliente) ───────────────────────────────────────────────
function CompactMode({ tareas, causas, editingId, editDraft, setEditDraft, resolviendo, handleCheck, handleUndo, startEdit, commitEdit, setEditingId, handleNueva }) {
  const pendientes = tareas.filter(t => !['Completada', 'Cancelada'].includes(t.estado))

  const grouped = {}
  for (const t of pendientes) {
    const key = t.causa_id || '__sin_causa__'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  }

  // also include tasks that are being resolved (undo window)
  const resolviendoIds = Object.keys(resolviendo)
  const resolviendoTareas = tareas.filter(t => resolviendoIds.includes(t.id))

  return (
    <div>
      {pendientes.length === 0 && resolviendoTareas.length === 0 && (
        <p className="text-[11px] text-gray-300 italic">Sin tareas pendientes</p>
      )}

      {/* Undo items */}
      {resolviendoTareas.map(t => (
        <div key={`undo-${t.id}`} className="flex items-center gap-2 py-0.5 mb-1">
          <div className="w-3.5 h-3.5 flex-shrink-0 rounded border border-emerald-400 bg-emerald-400 flex items-center justify-center">
            <Check size={8} className="text-white" />
          </div>
          <span className="flex-1 text-[11px] text-gray-300 line-through">{t.titulo}</span>
          <button
            onClick={() => handleUndo(t.id)}
            className="flex items-center gap-1 text-[10px] font-medium text-[#2570BA] hover:underline flex-shrink-0"
          >
            <Undo2 size={9} /> Deshacer
          </button>
        </div>
      ))}

      {/* Grouped by causa */}
      {causas.map(c => {
        const grupo = grouped[c.id] || []
        if (grupo.length === 0) return null
        return (
          <div key={c.id} className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate flex-1 mr-2">
                {c.materia || c.rit || c.ruc || 'Sin materia'}
              </p>
              <button onClick={() => handleNueva(c)} className="flex-shrink-0 text-[10px] text-[#2570BA] hover:underline">
                + Nueva
              </button>
            </div>
            <div className="space-y-1">
              {grupo.map(t => (
                <TareaFila key={t.id} t={t} editingId={editingId} editDraft={editDraft}
                  setEditDraft={setEditDraft} onCheck={handleCheck}
                  onStartEdit={startEdit} onCommit={commitEdit}
                  onCancelEdit={() => setEditingId(null)} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Sin causa */}
      {grouped['__sin_causa__']?.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sin causa</p>
            <button onClick={() => handleNueva(null)} className="flex-shrink-0 text-[10px] text-[#2570BA] hover:underline">
              + Nueva
            </button>
          </div>
          <div className="space-y-1">
            {grouped['__sin_causa__'].map(t => (
              <TareaFila key={t.id} t={t} editingId={editingId} editDraft={editDraft}
                setEditDraft={setEditDraft} onCheck={handleCheck}
                onStartEdit={startEdit} onCommit={commitEdit}
                onCancelEdit={() => setEditingId(null)} />
            ))}
          </div>
        </div>
      )}

      {/* Nueva tarea cuando no hay causas */}
      {causas.length === 0 && (
        <button onClick={() => handleNueva(null)} className="text-[11px] text-[#2570BA] hover:underline mt-1">
          + Nueva tarea
        </button>
      )}
    </div>
  )
}

// ── Full mode (CausaView pestaña Tareas) ──────────────────────────────────────
function FullMode({ tareas, editingId, editDraft, setEditDraft, showComp, setShowComp, handleCheck, startEdit, commitEdit, setEditingId, handleNueva, causa }) {
  const pend = tareas.filter(t => !['Completada', 'Cancelada'].includes(t.estado))
  const comp = tareas.filter(t =>  ['Completada', 'Cancelada'].includes(t.estado))
    .sort((a, b) => (b.fecha_completada || '').localeCompare(a.fecha_completada || ''))

  if (tareas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <CheckSquare size={28} className="text-gray-200 mb-3" />
        <p className="text-[13px] text-gray-400">Sin tareas asociadas a esta causa</p>
        <button
          onClick={() => handleNueva(causa)}
          className="mt-4 text-xs text-[#2570BA] hover:underline"
        >
          + Nueva tarea
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Pendientes */}
      <div className="space-y-2 mb-4">
        {pend.length === 0 && comp.length > 0 && (
          <p className="text-[11px] text-gray-300 text-center py-2">Todas las tareas completadas</p>
        )}
        {pend.map(t => (
          <div key={t.id} className={`flex items-center gap-3 p-3.5 rounded-xl border bg-white transition-colors ${
            editingId === t.id ? 'border-emerald-400' : 'border-gray-100 hover:border-gray-200'
          }`}>
            <button
              type="button"
              onClick={() => handleCheck(t)}
              className="w-4 h-4 rounded-[4px] border border-gray-300 hover:border-[#2570BA] hover:bg-blue-50 transition-colors flex-shrink-0"
              title="Marcar como completada"
            />
            {editingId === t.id ? (
              <input
                autoFocus
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onBlur={() => commitEdit(t.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(t.id) }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 text-[12px] text-gray-700 border border-blue-300 rounded px-1.5 py-0.5 outline-none bg-white"
              />
            ) : (
              <p
                className="text-[12px] text-gray-700 flex-1 leading-snug cursor-text"
                onDoubleClick={() => startEdit(t)}
                title="Doble clic para editar"
              >
                {t.titulo}
              </p>
            )}
            {t.fuente === 'ia' && editingId !== t.id && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2570BA] text-white font-bold flex-shrink-0">IA</span>
            )}
            {t.prioridad && editingId !== t.id && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                t.prioridad === 'Alta' ? 'bg-red-50 text-red-600' :
                t.prioridad === 'Media' ? 'bg-amber-50 text-amber-600' :
                'bg-gray-100 text-gray-400'
              }`}>{t.prioridad}</span>
            )}
            {t.fecha_vencimiento && editingId !== t.id && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                t.fecha_vencimiento < TODAY ? 'bg-red-50 text-red-500 font-medium' : 'bg-amber-50 text-amber-600'
              }`}>
                {fmt(t.fecha_vencimiento)}
              </span>
            )}
          </div>
        ))}
        {/* Nueva tarea */}
        <button
          onClick={() => handleNueva(causa)}
          className="w-full text-left text-[11px] text-gray-300 hover:text-[#2570BA] hover:underline px-1 transition-colors"
        >
          + Nueva tarea
        </button>
      </div>

      {/* Completadas */}
      {comp.length > 0 && (
        <div className="border-t border-dashed border-gray-100 pt-3">
          <button
            onClick={() => setShowComp(v => !v)}
            className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors mb-2"
          >
            <span>{showComp ? '▾' : '▸'}</span>
            Mostrar {comp.length} completada{comp.length !== 1 ? 's' : ''}
          </button>
          {showComp && (
            <div className="space-y-1.5">
              {comp.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-50 bg-gray-50/40">
                  <div className="w-4 h-4 rounded-[4px] border border-emerald-400 bg-emerald-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-bold leading-none">✓</span>
                  </div>
                  <p className="text-[12px] text-gray-300 line-through flex-1 leading-snug">{t.titulo}</p>
                  {t.fecha_completada && (
                    <span className="text-[10px] text-gray-300 flex-shrink-0 tabular-nums">
                      {fmt(t.fecha_completada)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
