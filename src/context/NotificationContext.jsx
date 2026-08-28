import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TODAY = new Date().toISOString().slice(0, 10)
const LS_SETTINGS = 'notif-settings'
const LS_SENT     = `notif-sent-${TODAY}`

function daysDiff(isoDate) {
  if (!isoDate) return null
  return Math.round((new Date(isoDate + 'T00:00:00') - new Date(TODAY + 'T00:00:00')) / 86400000)
}

function daysSinceISO(isoString) {
  if (!isoString) return null
  return Math.round((Date.now() - new Date(isoString).getTime()) / 86400000)
}

function defaultSettings() {
  return {
    browserEnabled: true,
    tipos: { plazo: true, audiencia: true, tarea: true, revision: true, pendiente: true },
  }
}

function loadSettings() {
  const d = defaultSettings()
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}')
    return { ...d, ...s, tipos: { ...d.tipos, ...(s.tipos || {}) } }
  } catch { return d }
}

function getSentToday() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SENT) || '[]')) }
  catch { return new Set() }
}

function markSent(id) {
  try {
    const s = getSentToday(); s.add(id)
    localStorage.setItem(LS_SENT, JSON.stringify([...s]))
  } catch {}
}

const NotificationCtx = createContext(null)
export const useNotifications = () => useContext(NotificationCtx)

export function NotificationProvider({ children }) {
  const [plazos,     setPlazos]     = useState([])
  const [audiencias, setAudiencias] = useState([])
  const [tareas,     setTareas]     = useState([])
  const [causas,     setCausas]     = useState([])
  const [pendientes, setPendientes] = useState([])
  const [settings,   setSettingsState] = useState(loadSettings)
  const [permission, setPermission] = useState(() => {
    try { return Notification.permission } catch { return 'default' }
  })
  const initialLoaded  = useRef(false)
  const prevUrgentIds  = useRef(new Set())

  async function fetchData() {
    const [
      { data: p },
      { data: a },
      { data: t },
      { data: c },
      { data: pend },
    ] = await Promise.all([
      supabase.from('plazos')
        .select('id, titulo, fecha_vencimiento, estado, cliente')
        .eq('estado', 'Activo'),
      supabase.from('audiencias')
        .select('id, tipo, fecha, causa_rit, cliente'),
      supabase.from('tareas')
        .select('id, titulo, fecha, estado')
        .neq('estado', 'Completada'),
      supabase.from('causas')
        .select('id, ruc, rit, materia, cliente_nombre, revision_activa, fecha_inicio')
        .eq('revision_activa', true),
      supabase.from('agenda_pendientes')
        .select('id, texto, created_at, causa_id')
        .eq('resuelto', false),
    ])
    setPlazos(p || [])
    setAudiencias(a || [])
    setTareas(t || [])
    setCausas(c || [])
    setPendientes(pend || [])
  }

  useEffect(() => {
    fetchData().then(() => { initialLoaded.current = true })
  }, [])

  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const notifications = useMemo(() => {
    const items = []

    if (settings.tipos.plazo) {
      plazos.forEach(p => {
        const d = daysDiff(p.fecha_vencimiento)
        if (d === null) return
        if (d === 0) {
          items.push({ id: `plazo-${p.id}-hoy`, type: 'plazo', urgency: 'high',
            title: 'Plazo vence hoy',
            subtitle: [p.titulo, p.cliente].filter(Boolean).join(' · '),
            navigateTo: '/plazos' })
        } else if (d > 0 && d <= 3) {
          items.push({ id: `plazo-${p.id}-${d}d`, type: 'plazo', urgency: 'medium',
            title: `Plazo en ${d} día${d !== 1 ? 's' : ''}`,
            subtitle: [p.titulo, p.cliente].filter(Boolean).join(' · '),
            navigateTo: '/plazos' })
        }
      })
    }

    if (settings.tipos.audiencia) {
      audiencias.forEach(a => {
        const d = daysDiff(a.fecha)
        if (d === null) return
        if (d === 0) {
          items.push({ id: `aud-${a.id}-hoy`, type: 'audiencia', urgency: 'high',
            title: 'Audiencia hoy',
            subtitle: [a.tipo, a.causa_rit, a.cliente].filter(Boolean).join(' · '),
            navigateTo: '/audiencias' })
        } else if (d === 1) {
          items.push({ id: `aud-${a.id}-manana`, type: 'audiencia', urgency: 'high',
            title: 'Audiencia mañana',
            subtitle: [a.tipo, a.causa_rit, a.cliente].filter(Boolean).join(' · '),
            navigateTo: '/audiencias' })
        } else if (d > 1 && d <= 7) {
          items.push({ id: `aud-${a.id}-semana`, type: 'audiencia', urgency: 'medium',
            title: `Audiencia en ${d} días`,
            subtitle: [a.tipo, a.causa_rit, a.cliente].filter(Boolean).join(' · '),
            navigateTo: '/audiencias' })
        }
      })
    }

    if (settings.tipos.tarea) {
      tareas.forEach(t => {
        if (!t.fecha) return
        const d = daysDiff(t.fecha)
        if (d === null) return
        if (d < 0) {
          items.push({ id: `tarea-${t.id}-vencida`, type: 'tarea', urgency: 'high',
            title: `Tarea vencida (${Math.abs(d)} día${Math.abs(d) !== 1 ? 's' : ''})`,
            subtitle: t.titulo || '',
            navigateTo: '/tareas' })
        } else if (d === 0) {
          items.push({ id: `tarea-${t.id}-hoy`, type: 'tarea', urgency: 'high',
            title: 'Tarea vence hoy', subtitle: t.titulo || '',
            navigateTo: '/tareas' })
        } else if (d <= 2) {
          items.push({ id: `tarea-${t.id}-${d}d`, type: 'tarea', urgency: 'medium',
            title: `Tarea en ${d} día${d !== 1 ? 's' : ''}`, subtitle: t.titulo || '',
            navigateTo: '/tareas' })
        }
      })
    }

    if (settings.tipos.revision) {
      causas.forEach(c => {
        if (!c.fecha_inicio) return
        const d = daysSinceISO(c.fecha_inicio + 'T00:00:00')
        if (d === null || d < 14) return
        items.push({ id: `rev-${c.id}`, type: 'revision', urgency: 'medium',
          title: `Período de revisión vencido (${d} días)`,
          subtitle: [c.ruc || c.rit, c.materia, c.cliente_nombre].filter(Boolean).join(' · '),
          navigateTo: '/revision' })
      })
    }

    if (settings.tipos.pendiente) {
      pendientes.forEach(p => {
        const d = daysSinceISO(p.created_at)
        if (d === null || d < 4) return
        items.push({ id: `pend-${p.id}`, type: 'pendiente', urgency: 'low',
          title: `Pendiente sin resolver (${d} día${d !== 1 ? 's' : ''})`,
          subtitle: (p.texto || '').slice(0, 70),
          navigateTo: '/apuntes' })
      })
    }

    return items
  }, [plazos, audiencias, tareas, causas, pendientes, settings])

  // Browser notifications
  useEffect(() => {
    if (!settings.browserEnabled) return
    if (permission !== 'granted') return
    if (!initialLoaded.current) return
    if (notifications.length === 0) return

    const sent = getSentToday()
    const summaryKey = `summary-${TODAY}`

    if (!sent.has(summaryKey)) {
      try {
        new Notification('Sistema BL', {
          body: `Tienes ${notifications.length} aviso${notifications.length !== 1 ? 's' : ''} pendiente${notifications.length !== 1 ? 's' : ''}`,
          icon: '/logo.jpg',
          tag: summaryKey,
        })
      } catch {}
      markSent(summaryKey)
    }

    // Urgentes durante sesión: audiencias hoy/mañana + plazos hoy
    const urgentNow = notifications.filter(n =>
      (n.type === 'audiencia' && n.urgency === 'high') ||
      (n.type === 'plazo' && n.id.endsWith('-hoy'))
    )

    urgentNow.forEach(n => {
      if (!sent.has(n.id) && !prevUrgentIds.current.has(n.id)) {
        try {
          new Notification('Sistema BL — Aviso urgente', {
            body: `${n.title}: ${n.subtitle}`,
            icon: '/logo.jpg',
            tag: n.id,
          })
        } catch {}
        markSent(n.id)
      }
    })

    prevUrgentIds.current = new Set(urgentNow.map(n => n.id))
  }, [notifications, permission, settings.browserEnabled])

  async function requestPermission() {
    if (!('Notification' in window)) return 'not-supported'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }

  function saveSettings(patch) {
    const next = { ...settings, ...patch, tipos: { ...settings.tipos, ...(patch.tipos || {}) } }
    setSettingsState(next)
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)) } catch {}
  }

  return (
    <NotificationCtx.Provider value={{ notifications, permission, requestPermission, settings, saveSettings }}>
      {children}
    </NotificationCtx.Provider>
  )
}
