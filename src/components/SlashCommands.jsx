import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckSquare, Gavel, Clock, MessageSquare,
  RefreshCw, FileText, Database, Shield, Scale, Users,
} from 'lucide-react'

const COMMANDS = [
  { key: 'tarea',      Icon: CheckSquare,   label: 'Nueva tarea',      desc: 'Acción o pendiente',          alias: ['ta', 'tar']  },
  { key: 'audiencia',  Icon: Gavel,         label: 'Nueva audiencia',  desc: 'Vista, formalización, etc.',  alias: ['au', 'aud']  },
  { key: 'plazo',      Icon: Clock,         label: 'Nuevo plazo',      desc: 'Vencimiento o fecha límite',  alias: ['pl', 'pla']  },
  { key: 'reunion',    Icon: MessageSquare, label: 'Nueva reunión',    desc: 'De equipo o con cliente',     alias: ['re', 'reu']  },
  { key: 'revision',   Icon: RefreshCw,     label: 'Seguimiento',      desc: 'Nota de seguimiento semanal', alias: ['se', 'seg']  },
  { key: 'siau',       Icon: Database,      label: 'Solicitud SIAU',   desc: 'Oficio o folio SIAU',         alias: ['si']         },
  { key: 'pjud',       Icon: Shield,        label: 'Movimiento PJUD',  desc: 'Escrito o resolución',        alias: ['pj']         },
  { key: 'documento',  Icon: FileText,      label: 'Nuevo documento',  desc: 'Archivo o escrito',           alias: ['do', 'doc']  },
  { key: 'causa',      Icon: Scale,         label: 'Nueva causa',      desc: 'Expediente o RIT nuevo',      alias: ['ca']         },
  { key: 'cliente',    Icon: Users,         label: 'Nuevo cliente',    desc: 'Persona natural o empresa',   alias: ['cl']         },
]

function matchesQuery(cmd, q) {
  if (!q) return true
  const lower = q.toLowerCase()
  return cmd.key.startsWith(lower) ||
    cmd.label.toLowerCase().includes(lower) ||
    cmd.alias.some(a => a.startsWith(lower))
}

// Uses the native value setter to update a React-controlled input/textarea
function setNativeValue(el, val) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) {
    setter.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    el.value = val
  }
}

export default function SlashCommands() {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const [idx,   setIdx]   = useState(0)
  const [pos,   setPos]   = useState({ top: 0, left: 0 })

  const targetRef   = useRef(null)
  const slashPos    = useRef(0)
  const menuRef     = useRef(null)

  const filtered = COMMANDS.filter(c => matchesQuery(c, query))
  const safeIdx  = Math.min(idx, Math.max(0, filtered.length - 1))

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setIdx(0)
    targetRef.current = null
  }, [])

  const select = useCallback((cmd) => {
    const el = targetRef.current
    if (el) {
      const val = el.value
      const start = slashPos.current
      const end   = el.selectionStart
      const newVal = val.slice(0, start) + val.slice(end)
      setNativeValue(el, newVal)
      el.selectionStart = el.selectionEnd = start
    }
    window.dispatchEvent(new CustomEvent('quick-add:open', { detail: { type: cmd.key } }))
    close()
  }, [close])

  // Detect '/' being typed in any text input/textarea
  useEffect(() => {
    const handleInput = (e) => {
      const el = e.target
      if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return
      if (['date', 'number', 'checkbox', 'radio', 'file'].includes(el.type)) return

      const val    = el.value
      const curPos = el.selectionStart

      if (open && targetRef.current === el) {
        // Close if '/' was deleted or cursor moved before it
        if (val[slashPos.current] !== '/' || curPos <= slashPos.current) {
          close(); return
        }
        const q = val.slice(slashPos.current + 1, curPos)
        // Close if space/newline typed (user abandoned the command)
        if (q.includes(' ') || q.includes('\n')) { close(); return }
        setQuery(q)
        setIdx(0)
        return
      }

      // Detect fresh '/' at word-start (preceded by whitespace or at position 0)
      if (!open && curPos > 0 && val[curPos - 1] === '/') {
        const before = curPos >= 2 ? val[curPos - 2] : '\n'
        if (before === ' ' || before === '\n' || curPos === 1) {
          const rect = el.getBoundingClientRect()
          const top  = Math.min(rect.bottom + 8, window.innerHeight - 280)
          const left = Math.min(rect.left, window.innerWidth - 290)
          setPos({ top, left })
          targetRef.current = el
          slashPos.current  = curPos - 1
          setQuery('')
          setIdx(0)
          setOpen(true)
        }
      }
    }

    document.addEventListener('input', handleInput)
    return () => document.removeEventListener('input', handleInput)
  }, [open, close])

  // Keyboard navigation inside the menu
  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIdx(i => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && filtered[safeIdx]) {
        e.preventDefault()
        select(filtered[safeIdx])
        return
      }
    }
    window.addEventListener('keydown', fn, true)
    return () => window.removeEventListener('keydown', fn, true)
  }, [open, filtered, safeIdx, select, close])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const fn = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) close()
    }
    setTimeout(() => document.addEventListener('mousedown', fn), 50)
    return () => document.removeEventListener('mousedown', fn)
  }, [open, close])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white rounded-xl shadow-2xl shadow-black/15 border border-gray-100 overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: 280 }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Comandos</span>
        {query && (
          <span className="text-[11px] text-[#2570ba] font-mono font-bold">/{query}</span>
        )}
      </div>

      {/* Commands */}
      {filtered.length === 0 ? (
        <div className="px-4 py-3 text-[11px] text-gray-400">Sin resultados para «/{query}»</div>
      ) : (
        <div className="py-1">
          {filtered.map((cmd, i) => {
            const { Icon } = cmd
            const active = i === safeIdx
            return (
              <button
                key={cmd.key}
                onClick={() => select(cmd)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  active ? 'bg-[#2570ba]/[0.06]' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-[#2570ba] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-medium leading-tight ${active ? 'text-[#1a2e4a]' : 'text-gray-700'}`}>
                    {cmd.label}
                  </div>
                  <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{cmd.desc}</div>
                </div>
                <kbd className="flex-shrink-0 text-[9px] text-gray-300 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                  /{cmd.key.slice(0, 4)}
                </kbd>
              </button>
            )
          })}
        </div>
      )}

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-gray-50 flex items-center gap-3 text-[9px] text-gray-300">
        <span>↑↓ navegar</span>
        <span>↩ seleccionar</span>
        <span>Esc cerrar</span>
      </div>
    </div>
  )
}
