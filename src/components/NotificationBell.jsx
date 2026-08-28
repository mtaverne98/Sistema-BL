import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertCircle, Gavel, CheckSquare, ClipboardCheck, Clock, ChevronRight } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

const TYPE_CFG = {
  plazo:     { label: 'Plazos',     Icon: AlertCircle,    dot: 'bg-red-400',    text: 'text-red-500',    bg: 'bg-red-50'    },
  audiencia: { label: 'Audiencias', Icon: Gavel,          dot: 'bg-orange-400', text: 'text-orange-500', bg: 'bg-orange-50' },
  tarea:     { label: 'Tareas',     Icon: CheckSquare,    dot: 'bg-amber-400',  text: 'text-amber-600',  bg: 'bg-amber-50'  },
  revision:  { label: 'Revisión',   Icon: ClipboardCheck, dot: 'bg-blue-400',   text: 'text-blue-500',   bg: 'bg-blue-50'   },
  pendiente: { label: 'Pendientes', Icon: Clock,          dot: 'bg-purple-400', text: 'text-purple-500', bg: 'bg-purple-50' },
}

const TYPE_ORDER = ['plazo', 'audiencia', 'tarea', 'revision', 'pendiente']

function urgencyDot(urgency) {
  if (urgency === 'high')   return 'w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0'
  if (urgency === 'medium') return 'w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0'
  return 'w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0'
}

export default function NotificationBell({ collapsed = false, side = 'right' }) {
  const { notifications, permission, requestPermission } = useNotifications()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [panelStyle, setPanelStyle] = useState({})
  const btnRef   = useRef(null)
  const panelRef = useRef(null)

  const total = notifications.length

  useEffect(() => {
    try {
      const asked = localStorage.getItem('notif-perm-asked')
      if (!asked && Notification.permission === 'default') setShowBanner(true)
    } catch {}
  }, [])

  // Position panel when opening
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const W = window.innerWidth
    const H = window.innerHeight
    const panelW = 340
    const panelH = Math.min(500, H - 80)

    let left, top
    if (side === 'right') {
      left = rect.right + 8
      if (left + panelW > W - 8) left = rect.left - panelW - 8
    } else {
      left = rect.left - panelW - 8
      if (left < 8) left = rect.right + 8
    }
    top = rect.top
    if (top + panelH > H - 8) top = H - panelH - 8
    top = Math.max(8, top)

    setPanelStyle({ top, left, width: panelW, maxHeight: panelH })
  }, [open, side])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleActivate() {
    try { localStorage.setItem('notif-perm-asked', '1') } catch {}
    setShowBanner(false)
    await requestPermission()
  }

  function dismissBanner() {
    try { localStorage.setItem('notif-perm-asked', '1') } catch {}
    setShowBanner(false)
  }

  function handleClick(notif) {
    setOpen(false)
    navigate(notif.navigateTo, notif.navigateState ? { state: notif.navigateState } : undefined)
  }

  // Grouped by type
  const grouped = TYPE_ORDER
    .map(type => ({ type, cfg: TYPE_CFG[type], items: notifications.filter(n => n.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="relative w-full">

      {/* Permission banner — only when sidebar expanded */}
      {showBanner && !collapsed && (
        <div className="mx-1 mb-1 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-[10px] text-amber-200/80 leading-snug mb-1.5">
            Activa las notificaciones del navegador para recibir avisos de plazos y audiencias urgentes.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleActivate}
              className="text-[9px] font-bold px-2 py-0.5 rounded transition-colors"
              style={{ background: 'rgba(251,191,36,0.3)', color: '#fde68a' }}
            >
              Activar
            </button>
            <button
              onClick={dismissBanner}
              className="text-[9px] transition-colors"
              style={{ color: 'rgba(253,230,138,0.45)' }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        title={collapsed ? `Notificaciones${total > 0 ? ` (${total})` : ''}` : undefined}
        className={`relative flex items-center rounded-md text-[13px] transition-all duration-150 group select-none ${
          collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-2.5 px-2.5 py-1.5 w-full'
        } ${
          open
            ? 'bg-white/15 text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        {/* Bell icon + badge */}
        <div className="relative flex-shrink-0">
          <Bell
            size={14}
            strokeWidth={1.75}
            className={open || total > 0 ? 'text-white/90' : 'text-white/50 group-hover:text-white/80'}
          />
          {total > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center bg-red-400 text-white leading-none">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </div>

        {!collapsed && <span className="truncate leading-none flex-1">Notificaciones</span>}
        {!collapsed && total > 0 && (
          <span className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-red-400 text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[9980] bg-white rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden flex flex-col"
          style={panelStyle}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-[#1a2e4a]" />
              <span className="text-[13px] font-bold text-[#1a2e4a]">Notificaciones</span>
            </div>
            {total > 0 && (
              <span className="text-[11px] text-gray-400 tabular-nums">{total} activo{total !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {total === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Bell size={28} className="text-gray-200 mb-3" />
                <p className="text-[13px] font-medium text-gray-400">Sin avisos</p>
                <p className="text-[11px] text-gray-300 mt-1">Todo en orden por ahora</p>
              </div>
            ) : (
              grouped.map(({ type, cfg, items }) => {
                const { Icon } = cfg
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/80 border-b border-gray-50">
                      <Icon size={11} className={cfg.text} />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{cfg.label}</span>
                      <span className="ml-auto text-[9px] text-gray-300 tabular-nums">{items.length}</span>
                    </div>
                    {items.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className="w-full flex items-start gap-2.5 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left group/item"
                      >
                        <span className={`mt-1.5 ${urgencyDot(n.urgency)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-gray-800 leading-tight">{n.title}</p>
                          {n.subtitle && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.subtitle}</p>
                          )}
                        </div>
                        <ChevronRight size={12} className="text-gray-200 group-hover/item:text-gray-400 mt-0.5 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer — permission state */}
          {permission !== 'granted' && (
            <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              <span className="text-[10px] text-gray-400 flex-1">
                {permission === 'denied'
                  ? 'Notificaciones del navegador bloqueadas'
                  : 'Notificaciones del navegador desactivadas'}
              </span>
              {permission === 'default' && (
                <button
                  onClick={async () => { await requestPermission(); setShowBanner(false); try { localStorage.setItem('notif-perm-asked', '1') } catch {} }}
                  className="text-[9px] font-semibold text-[#2570BA] hover:underline flex-shrink-0"
                >
                  Activar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
