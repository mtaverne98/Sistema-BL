import { useState, useEffect } from 'react'
import {
  Settings, Link2, RefreshCw, CheckCircle, XCircle,
  ChevronDown, ExternalLink, AlertCircle, Calendar,
  Loader, Unlink, Info,
} from 'lucide-react'
import {
  GCal, getAuthUrl, listCalendars,
  createEvent, updateEvent,
} from '../lib/googleCalendar'
import { supabase } from '../lib/supabase'

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[#1a2e4a]">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  )
}

// ── Google Calendar integration card ─────────────────────────────────────────
function GoogleCalendarCard() {
  const [connected,     setConnected]     = useState(false)
  const [calendars,     setCalendars]     = useState([])
  const [loadingCals,   setLoadingCals]   = useState(false)
  const [calError,      setCalError]      = useState('')
  const [selectedCalId, setSelectedCalId] = useState('primary')
  const [syncStatus,    setSyncStatus]    = useState(null) // 'syncing'|'done'|'error'
  const [syncMsg,       setSyncMsg]       = useState('')
  const [showCalList,   setShowCalList]   = useState(false)

  // Init
  useEffect(() => {
    const ok = GCal.isConnected()
    setConnected(ok)
    setSelectedCalId(GCal.getCalendarId())
    if (ok) loadCalendars()
  }, [])

  async function loadCalendars() {
    setLoadingCals(true)
    setCalError('')
    try {
      const items = await listCalendars()
      setCalendars(items)
    } catch (e) {
      setCalError(e.message)
    } finally {
      setLoadingCals(false)
    }
  }

  function handleConnect() {
    window.location.href = getAuthUrl()
  }

  function handleDisconnect() {
    GCal.clearTokens()
    setConnected(false)
    setCalendars([])
    setSyncStatus(null)
    setSyncMsg('')
  }

  function handleCalendarSelect(id) {
    GCal.setCalendarId(id)
    setSelectedCalId(id)
    setShowCalList(false)
  }

  async function handleSyncAll() {
    setSyncStatus('syncing')
    setSyncMsg('Sincronizando audiencias…')
    try {
      const { data: audiencias } = await supabase
        .from('audiencias')
        .select('id, tipo, fecha, hora, tribunal, sala, estado, notas, cliente_nombre, causa_rit')
        .neq('estado', 'Suspendida')

      if (!audiencias?.length) {
        setSyncStatus('done')
        setSyncMsg('No hay audiencias para sincronizar')
        setTimeout(() => { setSyncStatus(null); setSyncMsg('') }, 3000)
        return
      }

      const cal = selectedCalId
      let count = 0
      for (const a of audiencias) {
        if (!a.fecha) continue
        const existing = GCal.getEventId(a.id)
        if (existing) {
          await updateEvent(a, cal)
        } else {
          await createEvent(a, cal)
        }
        count++
      }

      setSyncStatus('done')
      setSyncMsg(`${count} audiencia${count !== 1 ? 's' : ''} sincronizada${count !== 1 ? 's' : ''}`)
      setTimeout(() => { setSyncStatus(null); setSyncMsg('') }, 4000)
    } catch (e) {
      setSyncStatus('error')
      setSyncMsg(e.message)
      setTimeout(() => { setSyncStatus(null); setSyncMsg('') }, 5000)
    }
  }

  const selectedCal = calendars.find(c => c.id === selectedCalId)

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {/* Google icon */}
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a2e4a]">Google Calendar</p>
            <p className="text-xs text-gray-400">Sincronización bidireccional de audiencias</p>
          </div>
        </div>

        {/* Status badge */}
        {connected ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-100 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            Sin conectar
          </span>
        )}
      </div>

      {/* Not connected state */}
      {!connected && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3">
            <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 leading-relaxed space-y-1">
              <p className="font-semibold">¿Cómo funciona?</p>
              <ul className="space-y-0.5 text-blue-600">
                <li>· Las audiencias del sistema se sincronizan automáticamente a tu Google Calendar</li>
                <li>· Los eventos de Google Calendar externos se muestran en el módulo Calendario</li>
                <li>· Se agrega recordatorio de 24 horas a cada audiencia</li>
              </ul>
            </div>
          </div>
          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2.5 bg-[#1a2e4a] text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-[#2570ba] transition-colors shadow-sm"
          >
            <Link2 size={15} />
            Conectar Google Calendar
          </button>
        </div>
      )}

      {/* Connected state */}
      {connected && (
        <div className="space-y-4">

          {/* Calendar selector */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Calendario de destino</p>
            <div className="relative">
              <button
                onClick={() => setShowCalList(v => !v)}
                className="w-full flex items-center justify-between gap-2 border border-gray-100 rounded-xl px-3 py-2.5 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: selectedCal?.backgroundColor || '#1a73e8' }}
                  />
                  <span className="text-xs font-medium text-gray-700 truncate">
                    {selectedCal?.summary || (selectedCalId === 'primary' ? 'Calendario principal' : selectedCalId)}
                  </span>
                </div>
                {loadingCals
                  ? <Loader size={12} className="text-gray-300 animate-spin flex-shrink-0" />
                  : <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {showCalList && calendars.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden max-h-[200px] overflow-y-auto">
                  {calendars.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleCalendarSelect(c.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                        c.id === selectedCalId ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: c.backgroundColor || '#1a73e8' }}
                      />
                      <span className="text-xs text-gray-700 truncate flex-1">{c.summary}</span>
                      {c.id === selectedCalId && (
                        <CheckCircle size={12} className="text-blue-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {calError && (
                <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {calError}
                </p>
              )}
            </div>
          </div>

          {/* Sync actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleSyncAll}
              disabled={syncStatus === 'syncing'}
              className="flex items-center justify-center gap-2 bg-[#1a2e4a] text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-[#2570ba] transition-colors disabled:opacity-50 shadow-sm"
            >
              {syncStatus === 'syncing'
                ? <Loader size={13} className="animate-spin" />
                : <RefreshCw size={13} />
              }
              Sincronizar audiencias
            </button>

            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(selectedCalId)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-gray-50 border border-gray-100 text-gray-500 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={13} />
              Abrir en Google
            </a>
          </div>

          {/* Sync status */}
          {syncStatus && (
            <div className={`flex items-center gap-2 text-xs font-medium px-3.5 py-2.5 rounded-xl ${
              syncStatus === 'done'    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              syncStatus === 'error'   ? 'bg-red-50 text-red-600 border border-red-100' :
              'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              {syncStatus === 'syncing' && <Loader size={12} className="animate-spin flex-shrink-0" />}
              {syncStatus === 'done'    && <CheckCircle size={12} className="flex-shrink-0" />}
              {syncStatus === 'error'   && <XCircle size={12} className="flex-shrink-0" />}
              {syncMsg}
            </div>
          )}

          {/* Disconnect */}
          <div className="pt-2 border-t border-gray-50">
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
            >
              <Unlink size={12} />
              Desconectar Google Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 px-5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-xs text-gray-700 font-semibold">{value}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Configuracion() {
  return (
    <div className="h-full overflow-y-auto bg-[#fafafa]">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#1a2e4a]/10 flex items-center justify-center flex-shrink-0">
            <Settings size={17} className="text-[#1a2e4a]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1a2e4a]">Configuración</h1>
            <p className="text-xs text-gray-400">Ajustes del sistema y conexiones externas</p>
          </div>
        </div>

        {/* Sistema */}
        <Section title="Sistema" description="Información general del sistema">
          <InfoRow label="Sistema"  value="Bianchi Leiva – Sistema BL" />
          <InfoRow label="Versión"  value="2.0.0" />
          <InfoRow label="Base de datos" value="Supabase PostgreSQL" />
        </Section>

        {/* Integraciones */}
        <Section
          title="Integraciones"
          description="Conecta Google Calendar para sincronizar audiencias automáticamente"
        >
          <GoogleCalendarCard />
        </Section>

        {/* Notificaciones (placeholder) */}
        <Section title="Notificaciones" description="Configura alertas y recordatorios">
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-gray-300 font-medium">Próximamente</p>
          </div>
        </Section>

      </div>
    </div>
  )
}
