import { useEffect } from 'react'
import {
  CheckCircle2, Undo2, Circle, Plus,
  CalendarDays, ArrowRight, ListTodo,
} from 'lucide-react'

const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
function dowShort(d) { return DIAS_CORTO[new Date(d + 'T00:00:00').getDay()] }
function dayNum(d) { return new Date(d + 'T00:00:00').getDate() }

// ── PendientesItem ────────────────────────────────────────────────────────────
export function PendientesItem({
  p, isResolving, isEditing, editDraft,
  weekDays, showMoverMenu, simpleMode,
  onEditDraftChange, onToggle, onUndo, onStartEdit, onSaveEdit, onCancelEdit,
  onToggleMoverMenu, onMover, onConvertTarea, onConvertSeguimiento,
}) {
  const isChild = !!p.parent_id

  useEffect(() => {
    if (!showMoverMenu || simpleMode) return
    const t  = setTimeout(() => onToggleMoverMenu?.(null), 6000)
    const fn = e => { if (e.key === 'Escape') onToggleMoverMenu?.(null) }
    window.addEventListener('keydown', fn)
    return () => { clearTimeout(t); window.removeEventListener('keydown', fn) }
  }, [showMoverMenu, onToggleMoverMenu, simpleMode])

  if (isResolving) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
        <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
        <span className="text-xs text-gray-300 line-through flex-1 truncate">{p.texto}</span>
        <button onClick={() => onUndo(p)}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#2570BA] hover:underline flex-shrink-0 no-touch-min">
          <Undo2 size={11} /> Deshacer
        </button>
      </div>
    )
  }

  const dias  = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
  const isOld = !isChild && dias > 7

  return (
    <div className="group relative px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-2">
        <button onClick={() => onToggle(p)}
          className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-emerald-500 transition-colors no-touch-min">
          <Circle size={isChild ? 11 : 13} />
        </button>

        {isEditing ? (
          <input
            autoFocus
            value={editDraft}
            onChange={e => onEditDraftChange(e.target.value)}
            onBlur={() => onSaveEdit(p)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(p) }
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="flex-1 text-xs text-gray-700 bg-white border border-blue-300 rounded-md px-1.5 py-0.5 outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => onStartEdit(p)}
            className={`flex-1 text-xs leading-relaxed cursor-text ${isOld ? 'text-gray-300' : 'text-gray-700'}`}>
            {p.texto}
          </span>
        )}

        {isOld && !isEditing && (
          <span className="text-[9px] text-gray-300 flex-shrink-0 mt-0.5 tabular-nums">{dias}d</span>
        )}
      </div>

      {!simpleMode && !isEditing && !isChild && (
        <div className="flex items-center gap-1 mt-1 ml-[21px] opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button onClick={() => onToggleMoverMenu?.(p.id)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-200 rounded-md hover:text-gray-600 transition-colors no-touch-min">
              <CalendarDays size={10} /> Mover
            </button>
            {showMoverMenu && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 flex flex-col min-w-[110px]">
                {(weekDays || []).map(date => (
                  <button key={date} onClick={() => onMover?.(p, date)}
                    className="text-left px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors no-touch-min">
                    {dowShort(date)} {dayNum(date)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onConvertTarea?.(p)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[#1A2E4A] text-white rounded-md hover:opacity-80 transition-opacity no-touch-min">
            <ArrowRight size={9} />Tarea
          </button>
          <button onClick={() => onConvertSeguimiento?.(p)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[#2570BA]/10 text-[#2570BA] border border-[#2570BA]/20 rounded-md hover:bg-[#2570BA]/20 transition-colors no-touch-min">
            <ArrowRight size={9} />Seguimiento
          </button>
        </div>
      )}
    </div>
  )
}

// ── PendienteGroup ────────────────────────────────────────────────────────────
export function PendienteGroup({
  parent, children, resolvingIds, editingId, editDraft,
  weekDays, showMoverMenu, isAddingChild, childInput, simpleMode,
  onEditDraftChange, onToggle, onUndo, onStartEdit, onSaveEdit, onCancelEdit,
  onToggleMoverMenu, onMover, onConvertTarea, onConvertSeguimiento,
  onStartAddChild, onChildInputChange, onAddChild, onCancelAddChild,
}) {
  const shared = {
    editingId, editDraft, weekDays, showMoverMenu, simpleMode,
    onEditDraftChange, onToggle, onUndo, onStartEdit, onSaveEdit, onCancelEdit,
    onToggleMoverMenu, onMover, onConvertTarea, onConvertSeguimiento,
  }
  return (
    <div>
      <PendientesItem p={parent} isResolving={resolvingIds.has(parent.id)}
        isEditing={editingId === parent.id} {...shared} />
      <div className="ml-[29px]">
        {children.map(c => (
          <PendientesItem key={c.id} p={c} isResolving={resolvingIds.has(c.id)}
            isEditing={editingId === c.id} {...shared} />
        ))}
        {isAddingChild ? (
          <input
            autoFocus
            value={childInput}
            onChange={e => onChildInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onAddChild(parent.id) }
              if (e.key === 'Escape') onCancelAddChild()
            }}
            placeholder="Punto… (Enter)"
            className="w-full text-xs text-gray-700 bg-white border border-blue-200 rounded-md px-2 py-1 mt-0.5 outline-none focus:border-[#2570BA] transition-colors"
          />
        ) : (
          <button onClick={() => onStartAddChild(parent.id)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-300 hover:text-[#2570BA] transition-colors no-touch-min">
            <Plus size={10} /> Agregar punto
          </button>
        )}
      </div>
    </div>
  )
}

// ── PendientesPanel ───────────────────────────────────────────────────────────
// variant='sidebar' (default) → panel lateral fijo de 300px
// variant='section' → sección de ancho completo dentro de una pestaña
export function PendientesPanel({
  parents, childrenByParent, resolvingIds,
  weekDays, moverMenuId,
  input, onInputChange, onAddPendiente,
  editingId, editDraft, onEditDraftChange,
  onToggle, onUndo, onStartEdit, onSaveEdit, onCancelEdit,
  onToggleMoverMenu, onMover, onConvertTarea, onConvertSeguimiento,
  addingChildParentId, childInput,
  onStartAddChild, onChildInputChange, onAddChild, onCancelAddChild,
  simpleMode, variant,
}) {
  const isSidebar = variant !== 'section'

  return (
    <div className={isSidebar
      ? 'w-[300px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden'
      : 'flex flex-col h-full'
    }>
      <div className={`px-4 py-4 flex-shrink-0 ${isSidebar ? 'border-b border-gray-100' : 'pb-3'}`}>
        {isSidebar && (
          <div className="flex items-center gap-2 mb-3">
            <ListTodo size={14} className="text-[#2570BA]" />
            <h2 className="text-sm font-bold text-[#1a2e4a]">Pendientes</h2>
            {parents.length > 0 && (
              <span className="ml-auto text-[10px] font-semibold text-gray-300 tabular-nums">{parents.length}</span>
            )}
          </div>
        )}
        <input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddPendiente() } }}
          placeholder="Agregar pendiente… (Enter)"
          className="w-full text-xs text-gray-700 placeholder:text-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2570BA] focus:bg-white transition-colors"
        />
      </div>

      <div className={`${isSidebar ? 'flex-1 overflow-y-auto' : ''} px-2 py-2`}>
        {parents.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs text-gray-300">Sin pendientes</p>
          </div>
        ) : (
          <div className="space-y-1">
            {parents.map(p => (
              <PendienteGroup
                key={p.id}
                parent={p}
                children={childrenByParent[p.id] || []}
                resolvingIds={resolvingIds}
                editingId={editingId}
                editDraft={editDraft}
                weekDays={weekDays}
                showMoverMenu={!simpleMode && moverMenuId === p.id}
                isAddingChild={addingChildParentId === p.id}
                childInput={childInput}
                simpleMode={simpleMode}
                onEditDraftChange={onEditDraftChange}
                onToggle={onToggle}
                onUndo={onUndo}
                onStartEdit={onStartEdit}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                onToggleMoverMenu={onToggleMoverMenu}
                onMover={onMover}
                onConvertTarea={onConvertTarea}
                onConvertSeguimiento={onConvertSeguimiento}
                onStartAddChild={onStartAddChild}
                onChildInputChange={onChildInputChange}
                onAddChild={onAddChild}
                onCancelAddChild={onCancelAddChild}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
