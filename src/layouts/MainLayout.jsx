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
} from 'lucide-react'
import { useSistema } from '../context/SistemaContext'
import { CAUSAS }    from '../pages/Causas'
import { CLIENTES }  from '../pages/Clientes'
import { useUser }   from '../context/UserContext'
import QuickAdd      from '../components/QuickAdd'

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
const SECTIONS = [
  { key: 'trabajo', label: 'Trabajo', items: [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
    { to: '/clientes',   icon: Users,           label: 'Clientes'   },
    { to: '/causas',     icon: Scale,           label: 'Causas'     },
    { to: '/prospectos', icon: UserSearch,      label: 'Prospectos' },
  ]},
  { key: 'agenda', label: 'Agenda', items: [
    { to: '/audiencias', icon: Gavel,           label: 'Audiencias' },
    { to: '/calendario', icon: Calendar,        label: 'Calendario' },
    { to: '/tareas',     icon: CheckSquare,     label: 'Tareas'     },
    { to: '/plazos',     icon: AlertCircle,     label: 'Plazos'     },
    { to: '/reuniones',  icon: MessageSquare,   label: 'Reuniones'  },
  ]},
  { key: 'tramitacion', label: 'Tramitación', items: [
    { to: '/seguimiento', icon: CalendarCheck,  label: 'Seguimiento semanal' },
    { to: '/pjud',        icon: Shield,         label: 'PJUD'                },
    { to: '/siau',        icon: Database,       label: 'SIAU'                },
    { to: '/revision',    icon: ClipboardCheck, label: 'Revisión de causas'  },
    { to: '/documentos',  icon: FolderOpen,     label: 'Documentos'          },
  ]},
  { key: 'notas', label: 'Notas', items: [
    { to: '/apuntes', icon: BookOpen, label: 'Agenda diaria' },
    { to: '/gastos',  icon: Receipt,  label: 'Gastos'        },
  ]},
]

// Flat list for CMD+K and recent nav lookup
const ALL_NAV = [
  ...SECTIONS.flatMap(s => s.items),
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
]

// currentUser ahora viene de UserContext

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, badge, collapsed = false }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
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
      <div className="w-[580px] bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden flex flex-col"
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
  const { plazos } = useSistema()
  const { user, setUser } = useUser()
  const location = useLocation()
  const [cmdOpen, setCmdOpen] = useState(false)

  // Sidebar state — persisted in localStorage
  const [sbCollapsed, setSbCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sb-collapsed') ?? 'false') } catch { return false }
  })
  const [closedSections, setClosedSections] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sb-closed-sections') ?? '[]')) } catch { return new Set() }
  })
  const [recentNav, setRecentNav] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sb-recent-nav') ?? '[]')
      // Los íconos no se pueden serializar a JSON — re-asociarlos desde ALL_NAV
      return stored.map(item => {
        const navItem = ALL_NAV.find(n => n.to === item.to)
        return navItem ? { ...navItem } : null
      }).filter(Boolean)
    } catch { return [] }
  })

  const plazosAlerta = plazos.filter(p => !!getUrgenciaLayout(p)).length

  // Track recent navigation
  useEffect(() => {
    const current = ALL_NAV.find(item =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    )
    if (!current) return
    setRecentNav(prev => {
      const filtered = prev.filter(n => n.to !== current.to)
      const next = [current, ...filtered].slice(0, 3)
      try { localStorage.setItem('sb-recent-nav', JSON.stringify(next)) } catch {}
      return next
    })
  }, [location.pathname])

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

  // Global CMD+K shortcut
  useEffect(() => {
    const fn = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Sidebar ── */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200"
        style={{ width: sbCollapsed ? 56 : 224, backgroundColor: '#1A2E4A' }}
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', padding: sbCollapsed ? '8px 4px' : '8px 6px' }}>

          {/* Recientes (solo expandido) */}
          {!sbCollapsed && recentNav.length > 0 && (
            <div className="mb-3">
              <p className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-widest select-none text-white/20">
                Recientes
              </p>
              <div className="space-y-0.5">
                {recentNav.map(item => (
                  <NavItem key={`recent-${item.to}`} {...item} badge={item.to === '/plazos' ? plazosAlerta : 0} collapsed={false} />
                ))}
              </div>
            </div>
          )}

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
                          badge={item.to === '/plazos' ? plazosAlerta : 0}
                          collapsed={sbCollapsed}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Configuración siempre al fondo */}
            <div className="pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
              <NavItem to="/configuracion" icon={Settings} label="Configuración" collapsed={sbCollapsed} />
            </div>
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

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto bg-white min-w-0">
        <Outlet />
      </main>

      {/* ── Global CMD+K ── */}
      <GlobalCmdK open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ── Quick Add global ── */}
      <QuickAdd />
    </div>
  )
}
