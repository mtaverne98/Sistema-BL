import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users, Scale, UserSearch,
  Gavel, Calendar, AlertCircle,
  Shield, Database, ClipboardCheck, CheckSquare, MessageSquare, FolderOpen, Receipt,
  BookOpen, LogOut,
  Search, Plus, Command, ArrowRight, ChevronRight,
  FileText, Clock, RefreshCw, Star, Hash,
  CheckCircle2,
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

// ── sidebar structure ─────────────────────────────────────────────────────────
const sections = [
  { label: null,       items: [{ to: '/',          icon: LayoutDashboard, label: 'Dashboard'         }] },
  { label: 'Principal',items: [
    { to: '/clientes',   icon: Users,       label: 'Clientes'   },
    { to: '/causas',     icon: Scale,       label: 'Causas'     },
    { to: '/prospectos', icon: UserSearch,  label: 'Prospectos' },
  ]},
  { label: 'Agenda',   items: [
    { to: '/audiencias', icon: Gavel,       label: 'Audiencias' },
    { to: '/calendario', icon: Calendar,    label: 'Calendario' },
    { to: '/plazos',     icon: AlertCircle, label: 'Plazos'     },
  ]},
  { label: 'Gestión',  items: [
    { to: '/pjud',       icon: Shield,         label: 'PJUD'              },
    { to: '/siau',       icon: Database,       label: 'SIAU'              },
    { to: '/revision',   icon: ClipboardCheck, label: 'Revisión de causas'},
    { to: '/tareas',     icon: CheckSquare,    label: 'Tareas'            },
    { to: '/reuniones',  icon: MessageSquare,  label: 'Reuniones'         },
    { to: '/documentos', icon: FolderOpen,     label: 'Documentos'        },
    { to: '/gastos',     icon: Receipt,        label: 'Gastos'            },
  ]},
  { label: 'Notas',    items: [{ to: '/apuntes', icon: BookOpen, label: 'Agenda diaria' }] },
]

// currentUser ahora viene de UserContext

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 group select-none ${
          isActive ? 'bg-[#1a2e4a] text-white font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={14} strokeWidth={isActive ? 2.2 : 1.75}
            className={isActive ? 'text-white/90 flex-shrink-0' : 'text-gray-400 group-hover:text-gray-500 flex-shrink-0'} />
          <span className="truncate leading-none flex-1">{label}</span>
          {badge > 0 && (
            <span className={`flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
              isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
            }`}>{badge}</span>
          )}
        </>
      )}
    </NavLink>
  )
}

// ── GlobalCmdK ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard',          path: '/',           icon: LayoutDashboard },
  { label: 'Clientes',           path: '/clientes',   icon: Users           },
  { label: 'Causas',             path: '/causas',     icon: Scale           },
  { label: 'Prospectos',         path: '/prospectos', icon: UserSearch      },
  { label: 'Audiencias',         path: '/audiencias', icon: Gavel           },
  { label: 'Calendario',         path: '/calendario', icon: Calendar        },
  { label: 'Plazos',             path: '/plazos',     icon: AlertCircle     },
  { label: 'PJUD',               path: '/pjud',       icon: Shield          },
  { label: 'SIAU',               path: '/siau',       icon: Database        },
  { label: 'Revisión de causas', path: '/revision',   icon: ClipboardCheck  },
  { label: 'Tareas',             path: '/tareas',     icon: CheckSquare     },
  { label: 'Reuniones',          path: '/reuniones',  icon: MessageSquare   },
  { label: 'Documentos',         path: '/documentos', icon: FolderOpen      },
  { label: 'Gastos',             path: '/gastos',     icon: Receipt         },
  { label: 'Agenda diaria',      path: '/apuntes',    icon: BookOpen        },
]

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
    const navMatches = NAV_ITEMS.filter(n => n.label.toLowerCase().includes(lq))
    navMatches.forEach(n => items.push({ group: 'MÓDULO', type: 'nav', label: n.label, path: n.path, icon: n.icon }))

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
  const [cmdOpen, setCmdOpen] = useState(false)
  const plazosAlerta = plazos.filter(p => !!getUrgenciaLayout(p)).length

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
      <aside className="flex-shrink-0 flex flex-col bg-white border-r border-gray-100" style={{ width: 224 }}>

        {/* Logo */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <img
            src="/logo.jpg"
            alt="Bianchi Leiva Abogadas"
            className="w-full object-contain"
            style={{ maxHeight: 56 }}
          />
        </div>

        {/* CMD+K search bar */}
        <div className="px-3 py-2.5 border-b border-gray-50">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200 transition-all text-left group"
          >
            <Search size={12} className="text-gray-400 flex-shrink-0" />
            <span className="text-[12px] text-gray-400 flex-1">Buscar...</span>
            <div className="flex items-center gap-0.5">
              <kbd className="text-[9px] text-gray-300 bg-white border border-gray-200 rounded px-1 py-0.5 font-mono">⌘</kbd>
              <kbd className="text-[9px] text-gray-300 bg-white border border-gray-200 rounded px-1 py-0.5 font-mono">K</kbd>
            </div>
          </button>
        </div>

        {/* Quick Add hint */}
        <div className="px-3 py-2 border-b border-gray-50">
          <div className="flex items-center justify-between px-2.5">
            <span className="text-[10px] text-gray-400">Crear nuevo</span>
            <div className="flex items-center gap-0.5">
              <kbd className="text-[9px] text-gray-300 bg-gray-50 border border-gray-100 rounded px-1 py-0.5 font-mono">⌘</kbd>
              <kbd className="text-[9px] text-gray-300 bg-gray-50 border border-gray-100 rounded px-1 py-0.5 font-mono">⇧N</kbd>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {sections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="px-2.5 mb-1 text-[10px] font-semibold text-gray-300 uppercase tracking-widest select-none">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavItem
                    key={item.to}
                    {...item}
                    badge={item.to === '/plazos' ? plazosAlerta : 0}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-2 pb-4 pt-2 border-t border-gray-100">
          <button
            onClick={() => setUser(null)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-gray-50 cursor-pointer group transition-colors"
            title="Cambiar usuario"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: user?.color || '#2570ba' }}>
              {user?.id || 'MT'}
            </div>
            <span className="text-[13px] text-gray-600 flex-1 truncate text-left">
              {user ? `${user.nombre} ${user.apellido}` : 'Macarena T.'}
            </span>
            <LogOut size={13} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
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
