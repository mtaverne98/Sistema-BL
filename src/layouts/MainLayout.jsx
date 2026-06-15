import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users, Scale, UserSearch,
  Gavel, Calendar, AlertCircle,
  Shield, Database, ClipboardCheck, CheckSquare, MessageSquare, FolderOpen, Receipt,
  BookOpen, LogOut, Settings,
  Search, Plus, Command, ArrowRight, ChevronRight, ChevronLeft,
  FileText, Clock, RefreshCw, Star, Hash,
  CheckCircle2, CalendarCheck,
  Menu, X,
} from 'lucide-react'
import { useSistema } from '../context/SistemaContext'
import { CAUSAS }    from '../pages/Causas'
import { CLIENTES }  from '../pages/Clientes'
import { useUser }   from '../context/UserContext'
import QuickAdd      from '../components/QuickAdd'
import SlashCommands from '../components/SlashCommands'

// ── helpers ───────────────────────────────────────────────────────────────────
const TODAY_LAYOUT = new Date().toISOString().slice(0, 10)

function calcDiasLayout(fecha) {
  return Math.round((new Date(fecha + 'T00:00:00') - new Date(TODAY_LAYOUT + 'T00:00:00')) / 86400000)
}
function getUrgenciaLayout(p) {
  if (p.estado !== 'Activo') return null
  const d = calcDiasLayout(p.fecha_vencimiento)
  if (d < 0)  return 'vencido'
  if (d <= 1) return 'critico'
  return null
}

// ── sidebar structure (4 secciones colapsables) ───────────────────────────────
// Dashboard va solo, arriba de todo — separado de las secciones
const DASHBOARD_ITEM = { to: '/', icon: LayoutDashboard, label: 'Dashboard' }

const SECTIONS = [
  { key: 'causas', label: 'Causas', items: [
    { to: '/clientes',    icon: Users,       label: 'Clientes'   },
    { to: '/causas',      icon: Scale,       label: 'Causas',     state: { fromSidebar: true } },
    { to: '/prospectos',  icon: UserSearch,  label: 'Prospectos' },
  ]},
  { key: 'agenda', label: 'Agenda', items: [
    { to: '/audiencias',  icon: Gavel,         label: 'Audiencias' },
    { to: '/calendario',  icon: Calendar,      label: 'Calendario' },
    { to: '/tareas',      icon: CheckSquare,   label: 'Tareas'     },
    { to: '/plazos',      icon: AlertCircle,   label: 'Plazos'     },
    { to: '/reuniones',   icon: MessageSquare, label: 'Reuniones'  },
  ]},
  { key: 'gestion', label: 'Gestión', items: [
    { to: '/revision',      icon: ClipboardCheck, label: 'Revisión de causas' },
    { to: '/siau',          icon: Database,       label: 'SIAU'               },
    { to: '/pjud',          icon: Shield,         label: 'PJUD'               },
    { to: '/documentos',    icon: FolderOpen,     label: 'Documentos'         },
    { to: '/configuracion', icon: Settings,       label: 'Configuración'      },
  ]},
  { key: 'notas', label: 'Notas', items: [
    { to: '/apuntes',     icon: BookOpen,  label: 'Agenda diaria' },
    { to: '/gastos',      icon: Receipt,   label: 'Gastos'        },
  ]},
]

// Flat list for CMD+K
const ALL_NAV = [
  DASHBOARD_ITEM,
  ...SECTIONS.flatMap(s => s.items),
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
]

// currentUser ahora viene de UserContext

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, badge, collapsed = false, state }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      state={state}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `relative flex items-center rounded-md text-[13px] transition-all duration-150 group select-none ${
          collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-2.5 px-2.5 py-1.5'
        } ${
          isActive
            ? 'bg-[#2570BA] text-white font-medium shadow-sm'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={14} strokeWidth={isActive ? 2.2 : 1.75}
            className={isActive ? 'text-white/90 flex-shrink-0' : 'text-white/50 group-hover:text-white/80 flex-shrink-0'} />
          {!collapsed && <span className="truncate leading-none flex-1">{label}</span>}
          {!collapsed && badge > 0 && (
            <span className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-red-400 text-white">
              {badge}
            </span>
          )}
          {collapsed && badge > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  )
}

// ── GlobalCmdK ───────────────────────────────────────────────────────────────
// NAV_ITEMS alias (para GlobalCmdK usa ALL_NAV directamente)
const NAV_ITEMS = ALL_NAV

const RESP_COLOR = { MT: '#2570ba', AB: '#059669', CL: '#7c3aed' }
const RESP_NAME  = { MT: 'Macarena', AB: 'Angélica', CL: 'Catalina' }

function Avatar({ quien, size = 16 }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.55, backgroundColor: RESP_COLOR[quien] || '#94a3b8' }}
    >
      {quien}
    </span>
  )
}

function GlobalCmdK({ open, onClose }) {
  const navigate = useNavigate()
  const { tareas, audiencias, plazos, documentos, addToRevisarJueves } = useSistema()
  const [q, setQ]             = useState('')
  const [selIdx, setSelIdx]   = useState(0)
  const [feedback, setFeedback] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQ(''); setSelIdx(0); setFeedback(''); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  // ── build results ──────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const lq = q.trim().toLowerCase()
    const items = []

    if (!lq) {
      // Default: navegación + quick actions
      items.push({ group: 'NAVEGACIÓN', type: 'nav', label: 'Dashboard',     path: '/',           icon: LayoutDashboard })
      items.push({ group: 'NAVEGACIÓN', type: 'nav', label: 'Causas',         path: '/causas',     icon: Scale           })
      items.push({ group: 'NAVEGACIÓN', type: 'nav', label: 'Tareas',         path: '/tareas',     icon: CheckSquare     })
      items.push({ group: 'NAVEGACIÓN', type: 'nav', label: 'Audiencias',     path: '/audiencias', icon: Gavel           })
      items.push({ group: 'NAVEGACIÓN', type: 'nav', label: 'Agenda diaria',  path: '/apuntes',    icon: BookOpen        })
      items.push({ group: 'ACCIONES',   type: 'action', label: 'Agregar a revisar el jueves',  icon: RefreshCw, action: 'addJueves' })
      return items
    }

    // Navegación
    const navMatches = ALL_NAV.filter(n => n.label.toLowerCase().includes(lq))
    navMatches.forEach(n => items.push({ group: 'MÓDULO', type: 'nav', label: n.label, path: n.to ?? n.path, icon: n.icon }))

    // Clientes
    CLIENTES.filter(c => {
      const full = `${c.nombre} ${c.apellido}`.toLowerCase()
      return full.includes(lq) || c.rut?.toLowerCase().includes(lq)
    }).slice(0, 4).forEach(c => items.push({
      group: 'CLIENTES', type: 'cliente', label: `${c.nombre} ${c.apellido}`,
      sub: c.rut, path: '/clientes', icon: Users, data: c,
    }))

    // Causas
    CAUSAS.filter(c =>
      c.cliente_nombre?.toLowerCase().includes(lq) ||
      c.rit?.toLowerCase().includes(lq) ||
      c.materia?.toLowerCase().includes(lq)
    ).slice(0, 4).forEach(c => items.push({
      group: 'CAUSAS', type: 'causa', label: c.rit,
      sub: `${c.cliente_nombre} · ${c.materia}`, path: '/causas', icon: Scale, data: c,
    }))

    // Tareas
    tareas.filter(t =>
      t.titulo?.toLowerCase().includes(lq) ||
      t.cliente?.toLowerCase().includes(lq) ||
      t.causa_rit?.toLowerCase().includes(lq)
    ).slice(0, 4).forEach(t => items.push({
      group: 'TAREAS', type: 'tarea', label: t.titulo,
      sub: `${t.causa_rit} · ${t.cliente}`, path: '/tareas', icon: CheckSquare,
      resp: t.responsable, estado: t.estado, data: t,
    }))

    // Audiencias
    audiencias.filter(a =>
      a.cliente?.toLowerCase().includes(lq) ||
      a.causa_rit?.toLowerCase().includes(lq) ||
      a.tipo?.toLowerCase().includes(lq)
    ).slice(0, 3).forEach(a => items.push({
      group: 'AUDIENCIAS', type: 'audiencia', label: `${a.tipo} · ${a.causa_rit}`,
      sub: `${a.cliente} · ${a.fecha} ${a.hora}`, path: '/audiencias', icon: Gavel,
      resp: a.asiste?.[0], data: a,
    }))

    // Plazos
    plazos.filter(p =>
      p.titulo?.toLowerCase().includes(lq) ||
      p.cliente?.toLowerCase().includes(lq)
    ).slice(0, 3).forEach(p => items.push({
      group: 'PLAZOS', type: 'plazo', label: p.titulo,
      sub: `${p.cliente} · vence ${p.fecha_vencimiento}`, path: '/plazos', icon: AlertCircle,
      resp: p.responsable, data: p,
    }))

    // Documentos
    documentos.filter(d =>
      d.nombre?.toLowerCase().includes(lq) ||
      d.cliente?.toLowerCase().includes(lq) ||
      d.causa_rit?.toLowerCase().includes(lq)
    ).slice(0, 3).forEach(d => items.push({
      group: 'DOCUMENTOS', type: 'documento', label: d.nombre,
      sub: d.cliente || d.causa_rit || '', path: '/documentos', icon: FileText, data: d,
    }))

    // Acción "agregar a revisar jueves" si busca algo
    if (lq.length >= 3) {
      items.push({
        group: 'ACCIONES', type: 'action',
        label: `Agregar "${q.trim()}" al revisar del jueves`,
        icon: RefreshCw, action: 'addJueves', payload: q.trim(),
      })
    }

    return items
  }, [q, tareas, audiencias, plazos, documentos])

  // group results
  const grouped = useMemo(() => {
    const map = {}
    results.forEach(r => {
      if (!map[r.group]) map[r.group] = []
      map[r.group].push(r)
    })
    return map
  }, [results])

  // flat list for keyboard navigation
  const flat = results

  useEffect(() => { setSelIdx(0) }, [q])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, flat.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      const item = flat[selIdx]
      if (item) execute(item)
    }
  }

  function execute(item) {
    if (item.type === 'action' && item.action === 'addJueves') {
      const txt = item.payload || q.trim()
      if (!txt) return
      addToRevisarJueves(txt)
      setFeedback(`✓ Agregado al jueves: "${txt}"`)
      setTimeout(() => { setFeedback(''); onClose() }, 1400)
      return
    }
    if (item.path) {
      navigate(item.path)
      onClose()
    }
  }

  if (!open) return null

  let globalIdx = -1

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh]"
      style={{ background: 'rgba(15,20,30,0.35)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[580px] mx-4 sm:mx-auto bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden flex flex-col"
        style={{ maxHeight: '72vh' }}>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes, causas, tareas, audiencias…"
            className="flex-1 text-[15px] text-gray-800 placeholder-gray-300 bg-transparent border-none outline-none"
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <kbd className="text-[10px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">↑↓</kbd>
            <kbd className="text-[10px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">↵</kbd>
            <kbd className="text-[10px] text-gray-300 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">ESC</kbd>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="px-4 py-2.5 bg-green-50 border-b border-green-100">
            <p className="text-[13px] text-green-700 font-medium">{feedback}</p>
          </div>
        )}

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {Object.keys(grouped).length === 0 && (
            <p className="px-5 py-8 text-[13px] text-gray-400 text-center">Sin resultados para "{q}"</p>
          )}

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">{group}</span>
              </div>
              {items.map(item => {
                globalIdx++
                const idx = globalIdx
                const isActive = idx === selIdx
                return (
                  <button
                    key={`${group}-${idx}`}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelIdx(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-[#1a2e4a]/[0.06]' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-[#1a2e4a]/10' : 'bg-gray-100'
                    }`}>
                      <item.icon size={13} className={isActive ? 'text-[#1a2e4a]' : 'text-gray-500'} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${isActive ? 'text-[#1a2e4a]' : 'text-gray-800'}`}>
                        {item.label}
                      </p>
                      {item.sub && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.sub}</p>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.resp && <Avatar quien={item.resp} />}
                      {item.estado && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{item.estado}</span>
                      )}
                      {item.type === 'action' && (
                        <span className="text-[10px] text-[#1a2e4a]/60 bg-[#1a2e4a]/08 px-1.5 py-0.5 rounded-full font-medium">acción</span>
                      )}
                      <ChevronRight size={12} className="text-gray-200" />
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center gap-4 bg-gray-50/50">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <Command size={10} />
            <span>K para abrir</span>
          </div>
          <span className="text-gray-200">·</span>
          <span className="text-[10px] text-gray-400">Busca en causas, clientes, tareas, audiencias, documentos y plazos</span>
          <span className="ml-auto text-[10px] text-gray-300">{flat.length} resultado{flat.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

// ── MainLayout ────────────────────────────────────────────────────────────────
export default function MainLayout() {
  const { plazos, tareas } = useSistema()
  const { user, setUser } = useUser()
  const [cmdOpen, setCmdOpen] = useState(false)
  const location = useLocation()

  // Mobile / responsive state
  const [mobileOpen, setMobileOpen] = useState(false)
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth)
  const isMobile = screenWidth < 768

  useEffect(() => {
    function onResize() { setScreenWidth(window.innerWidth) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Sidebar state — persisted in localStorage
  const [sbCollapsed, setSbCollapsed] = useState(() => {
    try {
      // Auto-collapse on tablet (768–1279px) on first load
      if (window.innerWidth < 1280 && window.innerWidth >= 768) return true
      return JSON.parse(localStorage.getItem('sb-collapsed') ?? 'false')
    } catch { return false }
  })
  const [sbWidth, setSbWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('sb-width') ?? '240', 10) } catch { return 240 }
  })
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef({ active: false, startX: 0, startWidth: 0, lastWidth: 240 })

  const [closedSections, setClosedSections] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sb-closed-sections') ?? '[]')) } catch { return new Set() }
  })

  // Limpiar clave legacy de recientes (si existía de versiones anteriores)
  useEffect(() => { try { localStorage.removeItem('sb-recent-nav') } catch {} }, [])

  // ── Resize drag listeners ──────────────────────────────────────────────────
  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.active) return
      const delta = e.clientX - dragRef.current.startX
      const w = Math.min(320, Math.max(180, dragRef.current.startWidth + delta))
      dragRef.current.lastWidth = w
      setSbWidth(w)
    }
    function onUp() {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      try { localStorage.setItem('sb-width', String(dragRef.current.lastWidth)) } catch {}
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleResizeMouseDown(e) {
    if (sbCollapsed) return
    e.preventDefault()
    dragRef.current = { active: true, startX: e.clientX, startWidth: sbWidth, lastWidth: sbWidth }
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const plazosAlerta  = plazos.filter(p => !!getUrgenciaLayout(p)).length
  const tareasAlerta  = tareas ? tareas.filter(t => t.estado !== 'Completada').length : 0

  function toggleSection(key) {
    setClosedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem('sb-closed-sections', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  function toggleCollapsed() {
    setSbCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sb-collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const currentSbWidth = isMobile ? 280 : (sbCollapsed ? 56 : sbWidth)

  // Global shortcuts
  useEffect(() => {
    const fn = e => {
      // Esc → close active modal / panel (no modifier needed)
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('modal:close'))
        return
      }

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
        return
      }

      if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        // Try module-specific handler first via data-cmd-n button, then open QuickAdd
        const moduleBtn = document.querySelector('[data-cmd-n]')
        if (moduleBtn) {
          moduleBtn.click()
        } else {
          window.dispatchEvent(new CustomEvent('quick-add:open'))
        }
        window.dispatchEvent(new CustomEvent('cmd-n'))
        return
      }

      // Cmd+Enter → submit active form
      if (e.key === 'Enter') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('global:save'))
        return
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Mobile backdrop ── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-[59] bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`flex-shrink-0 flex flex-col overflow-hidden ${
          isMobile
            ? `fixed inset-y-0 left-0 z-[60] transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'relative'
        }`}
        style={{
          width: currentSbWidth,
          backgroundColor: '#1A2E4A',
          transition: isResizing ? 'none' : isMobile ? undefined : 'width 0.2s ease',
        }}
      >

        {/* Logo row + colapsar */}
        <div
          className="flex-shrink-0 flex items-center"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: sbCollapsed ? '10px 8px' : '10px 8px 10px 14px',
            gap: 6,
            minHeight: 56,
          }}
        >
          {!sbCollapsed && (
            <img src="/logo.jpg" alt="Bianchi Leiva Abogadas"
              className="flex-1 object-contain rounded-lg min-w-0"
              style={{ maxHeight: 40 }}
            />
          )}
          {sbCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mx-auto flex-shrink-0">
              <Scale size={14} className="text-white/70" />
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={sbCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/10 transition-colors"
          >
            {sbCollapsed
              ? <ChevronRight size={12} className="text-white/35" />
              : <ChevronLeft  size={12} className="text-white/35" />
            }
          </button>
        </div>

        {/* CMD+K */}
        <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: sbCollapsed ? '8px 6px' : '8px 10px' }}>
          {!sbCollapsed ? (
            <button
              onClick={() => setCmdOpen(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-left"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Search size={12} className="text-white/40 flex-shrink-0" />
              <span className="text-[12px] text-white/40 flex-1">Buscar...</span>
              <kbd className="text-[9px] text-white/20 rounded px-1 py-0.5 font-mono" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>⌘K</kbd>
            </button>
          ) : (
            <button onClick={() => setCmdOpen(true)} title="Buscar (⌘K)"
              className="w-9 h-7 flex items-center justify-center mx-auto rounded-md hover:bg-white/10 transition-colors">
              <Search size={13} className="text-white/40" />
            </button>
          )}
        </div>

        {/* ── Resize handle ── */}
        <div
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={toggleCollapsed}
          title="Arrastrar para redimensionar · Doble clic para colapsar"
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center group/resize"
          style={{ width: 6, cursor: sbCollapsed ? 'default' : 'col-resize' }}
        >
          <div
            className="h-full w-px transition-colors duration-150"
            style={{
              backgroundColor: isResizing
                ? 'rgba(255,255,255,0.35)'
                : undefined,
            }}
          />
          {/* Línea visible al hover */}
          <div
            className="absolute inset-y-0 right-0 w-px opacity-0 group-hover/resize:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', padding: sbCollapsed ? '8px 4px' : '8px 6px' }}>

          {/* Dashboard — solo, arriba de todo */}
          <div className="mb-1">
            <NavItem {...DASHBOARD_ITEM} collapsed={sbCollapsed} />
          </div>
          {!sbCollapsed && (
            <div className="mx-2 mb-2" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          )}
          {sbCollapsed && <div style={{ height: 4 }} />}

          {/* Secciones colapsables */}
          <div className="space-y-0.5">
            {SECTIONS.map(section => {
              const isClosed = closedSections.has(section.key)
              return (
                <div key={section.key} className="mb-1">
                  {/* Section header — solo visible cuando expandido */}
                  {!sbCollapsed && (
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors group select-none"
                    >
                      <ChevronRight
                        size={10}
                        className={`text-white/20 transition-transform duration-150 flex-shrink-0 group-hover:text-white/35 ${isClosed ? '' : 'rotate-90'}`}
                      />
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-white/25 group-hover:text-white/40 transition-colors">
                        {section.label}
                      </span>
                    </button>
                  )}

                  {/* Items — siempre visibles cuando colapsado */}
                  {(!isClosed || sbCollapsed) && (
                    <div className="space-y-0.5 mt-0.5">
                      {section.items.map(item => (
                        <NavItem
                          key={item.to}
                          {...item}
                          badge={
                            item.to === '/plazos' ? plazosAlerta :
                            item.to === '/tareas' ? tareasAlerta : 0
                          }
                          collapsed={sbCollapsed}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

          </div>
        </nav>

        {/* User */}
        <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: sbCollapsed ? '8px 4px' : '8px 6px' }}>
          <button
            onClick={() => setUser(null)}
            title={sbCollapsed ? `${user?.nombre || 'Usuario'} — Cambiar` : 'Cambiar usuario'}
            className={`w-full flex items-center rounded-md cursor-pointer group transition-colors hover:bg-white/10 ${
              sbCollapsed ? 'justify-center p-1.5' : 'gap-2.5 px-2.5 py-2'
            }`}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: user?.color || '#2570BA' }}>
              {user?.id || 'MT'}
            </div>
            {!sbCollapsed && (
              <>
                <span className="text-[13px] text-white/70 flex-1 truncate text-left">
                  {user ? `${user.nombre} ${user.apellido}` : 'Macarena T.'}
                </span>
                <LogOut size={13} className="text-white/25 group-hover:text-white/50 flex-shrink-0 transition-colors" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Content wrapper ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Mobile top bar ── */}
        {isMobile && (
          <header className="flex-shrink-0 h-14 flex items-center gap-3 px-3"
            style={{ backgroundColor: '#1A2E4A' }}>
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="p-2 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            >
              {mobileOpen
                ? <X size={18} className="text-white/70" />
                : <Menu size={18} className="text-white/70" />
              }
            </button>
            <img src="/logo.jpg" alt="Bianchi Leiva" className="h-8 object-contain rounded-md flex-1 min-w-0" style={{ maxWidth: 160 }} />
            <button
              onClick={() => setCmdOpen(true)}
              className="p-2 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <Search size={16} className="text-white/60" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('quick-add:open'))}
              className="p-2 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <Plus size={16} className="text-white/60" />
            </button>
          </header>
        )}

        {/* ── Main content ── */}
        <main className={`flex-1 overflow-y-auto bg-white min-w-0 ${isMobile ? 'pb-14' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <nav className="fixed bottom-0 inset-x-0 z-50 h-14 flex items-center justify-around px-2"
          style={{ backgroundColor: '#1A2E4A', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { to: '/',           icon: LayoutDashboard, label: 'Inicio'    },
            { to: '/causas',     icon: Scale,           label: 'Causas',    state: { fromSidebar: true } },
            { to: '/tareas',     icon: CheckSquare,     label: 'Tareas'    },
            { to: '/audiencias', icon: Gavel,           label: 'Audiencias'},
            { to: '/revision',   icon: ClipboardCheck,  label: 'Revisión'  },
          ].map(({ to, icon: Icon, label, state }) => (
            <NavLink key={to} to={to} end={to === '/'} state={state}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive ? 'text-white' : 'text-white/40'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
                  <span className="text-[9px] font-medium leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {/* ── Global CMD+K ── */}
      <GlobalCmdK open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ── Quick Add global ── */}
      <QuickAdd />

      {/* ── Slash commands palette ── */}
      <SlashCommands />
    </div>
  )
}
