import { useState, useEffect, useRef } from 'react'

export default function SaveStatusBadge({ collapsed = false }) {
  const [status, setStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const timerRef = useRef(null)

  useEffect(() => {
    function onStart() {
      clearTimeout(timerRef.current)
      setStatus('saving')
    }
    function onEnd(e) {
      clearTimeout(timerRef.current)
      if (e.detail?.ok) {
        setStatus('saved')
        timerRef.current = setTimeout(() => setStatus(null), 3000)
      } else {
        setStatus('error')
        timerRef.current = setTimeout(() => setStatus(null), 6000)
      }
    }
    window.addEventListener('save:start', onStart)
    window.addEventListener('save:end', onEnd)
    return () => {
      window.removeEventListener('save:start', onStart)
      window.removeEventListener('save:end', onEnd)
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!status) return null

  const cfg = {
    saving: { dot: 'bg-blue-400 animate-pulse', text: 'Guardando…',  color: 'text-white/50' },
    saved:  { dot: 'bg-emerald-400',             text: '✓ Guardado',  color: 'text-emerald-300' },
    error:  { dot: 'bg-red-400',                 text: '⚠ Error',     color: 'text-red-300' },
  }[status]

  if (collapsed) {
    return (
      <div className="flex justify-center py-1">
        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} title={cfg.text} />
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium ${cfg.color}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.text}
    </div>
  )
}
