import { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, Gavel, CheckSquare, Users, AlertTriangle,
  Clock, MapPin, Check, Circle, ChevronRight,
  FileText, Bell, RefreshCw, FolderOpen,
  Receipt, ArrowRight, Wifi, WifiOff,
} from 'lucide-react'
import { supabase, verificarConexion } from '../lib/supabase'
import { useUser } from '../context/UserContext'

// ── helpers ───────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

function calcDias(f) {
  return Math.round((new Date(f + 'T00:00:00') - new Date(TODAY + 'T00:00:00')) / 86400000)
}
function getUrgencia(p) {
  if (p.estado !== 'Activo') return null
  const d = calcDias(p.fecha_vencimiento)
  if (d < 0)   return 'vencido'
  if (d <= 1)  return 'critico'
  if (d <= 4)  return 'urgente'
  if (d <= 14) return 'proximo'
  return 'normal'
}
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
function formatFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const diff = calcDias(iso)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

const RESP_COLOR = { MT: '#2570ba', AB: '#059669', CL: '#7c3aed' }
const RESP_NAME  = { MT: 'Macarena T.', AB: 'Angélica B.', CL: 'Catalina L.' }

function Avatar({ quien, size = 20 }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5, backgroundColor: RESP_COLOR[quien] || '#94a3b8' }}
    >
      {quien}
    </span>
  )
}

// ── sub-components ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, delta, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3 transition-shadow ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
          <Icon size={15} style={{ color }} strokeWidth={2} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-semibold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span className="text-xs text-gray-400 pb-0.5">{delta}</span>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, count, linkLabel, onLink }) {
  return (
    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
      <Icon size={14} className="text-gray-400" />
      <h2 className="text-sm font-semibold text-gray-900 flex-1">{title}</h2>
      {count != null && (
        <span className="text-xs text-gray-400">{count}</span>
      )}
      {onLink && (
        <button onClick={onLink}
          className="text-xs text-[#2570ba] hover:text-[#1a2e4a] flex items-center gap-1 font-medium transition-colors">
          {linkLabel || 'Ver todos'} <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  // ── Estado ─────────────────────────────────────────────────────────────────
  const [dbStatus,       setDbStatus]       = useState(null) // null | 'ok' | 'error'
  const [tareas,         setTareas]         = useState([])
  const [audiencias,     setAudiencias]     = useState([])
  const [plazos,         setPlazos]         = useState([])
  const [documentos,     setDocumentos]     = useState([])
  const [pjudRows,       setPjudRows]       = useState([])
  const [siauRows,       setSiauRows]       = useState([])
  const [causasCount,    setCausasCount]    = useState(0)
  const [clientesCount,  setClientesCount]  = useState(0)

  // ── Fetch inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    verificarConexion().then(({ ok }) => setDbStatus(ok ? 'ok' : 'error'))

    supabase.from('tareas')
      .select('id, titulo, estado, prioridad, notas, fecha_vencimiento, causa_rit, cliente_nombre')
      .then(({ data }) => setTareas(data || []))

    supabase.from('audiencias')
      .select('id, tipo, fecha, hora, tribunal, sala, estado, modalidad, cliente_nombre, causa_rit')
      .then(({ data }) => setAudiencias(data || []))

    supabase.from('plazos')
      .select('id, titulo, fecha_vencimiento, estado, tipo, causa_rit, causas(cliente_nombre)')
      .then(({ data }) => setPlazos((data || []).map(r => ({ ...r, cliente_nombre: r.causas?.cliente_nombre || '' }))))

    supabase.from('documentos')
      .select('id, nombre, cliente, responsable, fecha_creacion, causa_rit')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setDocumentos(data || []))

    supabase.from('pjud')
      .select('id, cliente_nombre, causa_rit, fecha, solicitud, estado, notas')
      .then(({ data }) => setPjudRows(data || []))

    supabase.from('siau')
      .select('id, cliente_nombre, causa_rit, fecha, folio, solicitud, estado, notas')
      .then(({ data }) => setSiauRows(data || []))

    supabase.from('causas').select('id', { count: 'exact', head: true })
      .then(({ count }) => setCausasCount(count || 0))

    supabase.from('clientes').select('id', { count: 'exact', head: true })
      .then(({ count }) => setClientesCount(count || 0))
  }, [])

  // ── métricas reales ────────────────────────────────────────────────────────
  const today = TODAY
  const thisWeekEnd = (() => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })()

  const audienciasEstaSemanaCnt = audiencias.filter(a => a.fecha >= today && a.fecha <= thisWeekEnd).length
  const tareasPendientesCnt     = tareas.filter(t => t.estado !== 'Completada').length
  const plazosRealesCnt         = plazos.filter(p => { const u = getUrgencia(p); return u === 'critico' || u === 'vencido' }).length
  const tareasHoy               = tareas.filter(t => t.fecha_vencimiento === today && t.estado !== 'Completada').length

  const metricas = useMemo(() => [
    { label: 'Causas activas',        value: causasCount,             icon: Scale,         delta: `${causasCount} total`,              color: '#2570ba', path: '/causas'     },
    { label: 'Audiencias esta semana', value: audienciasEstaSemanaCnt, icon: Gavel,         delta: `${audienciasEstaSemanaCnt} eventos`, color: '#1a2e4a', path: '/audiencias' },
    { label: 'Tareas pendientes',     value: tareasPendientesCnt,     icon: CheckSquare,   delta: `${tareasHoy} vencen hoy`,            color: '#d97706', path: '/tareas'     },
    { label: 'Clientes activos',      value: clientesCount,           icon: Users,         delta: `${clientesCount} registrados`,       color: '#059669', path: '/clientes'   },
    { label: 'Plazos críticos',       value: plazosRealesCnt,         icon: AlertTriangle, delta: 'Próximas 48 h',                      color: '#dc2626', path: '/plazos'     },
  ], [causasCount, clientesCount, audienciasEstaSemanaCnt, tareasPendientesCnt, tareasHoy, plazosRealesCnt])

  // ── próximas audiencias (reales, ordenadas) ─────────────────────────────────
  const proximasAudiencias = useMemo(() =>
    audiencias
      .filter(a => a.fecha >= today)
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
      .slice(0, 6),
    [audiencias, today]
  )

  // ── tareas pendientes (ordenadas por urgencia) ─────────────────────────────
  const tareasDestacadas = useMemo(() =>
    tareas
      .filter(t => t.estado !== 'Completada')
      .sort((a, b) => {
        const pa = a.prioridad === 'Alta' ? 0 : a.prioridad === 'Media' ? 1 : 2
        const pb = b.prioridad === 'Alta' ? 0 : b.prioridad === 'Media' ? 1 : 2
        if (pa !== pb) return pa - pb
        return (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || '')
      })
      .slice(0, 6),
    [tareas]
  )

  // ── plazos críticos ────────────────────────────────────────────────────────
  const plazosDestacados = useMemo(() =>
    plazos
      .filter(p => { const u = getUrgencia(p); return u === 'critico' || u === 'vencido' || u === 'urgente' })
      .sort((a, b) => calcDias(a.fecha_vencimiento) - calcDias(b.fecha_vencimiento))
      .slice(0, 5),
    [plazos]
  )

  // ── actividad reciente ─────────────────────────────────────────────────────
  const actividadReciente = useMemo(() => {
    const items = []
    documentos.slice(0, 6).forEach(d => items.push({
      icon: FolderOpen, texto: `Documento: ${d.nombre}`,
      sub: d.cliente || d.causa_rit || '', quien: d.responsable || 'MT',
      ts: d.fecha_creacion || '',
    }))
    return items.slice(0, 6)
  }, [documentos])

  // ── alertas PJUD (desde rows planos) ──────────────────────────────────────
  const pjudAlertas = useMemo(() => {
    const items = []
    pjudRows.forEach(row => {
      if (!row.fecha) return
      const dias = Math.round((new Date(TODAY + 'T00:00:00') - new Date(row.fecha + 'T00:00:00')) / 86400000)
      const urg  = row.estado === 'Urgente'
      const sinR = (row.estado === 'Pendiente' || row.estado === 'Sin respuesta') && dias >= 5
      if (urg || sinR) items.push({
        causa: { causa_rit: row.causa_rit || '', cliente: row.cliente_nombre || '' },
        mov:   { id: row.id, solicitud: row.solicitud || '', estado: row.estado, responsable: 'MT', accion_requerida: row.notas || '' },
        dias, urg,
      })
    })
    return items.sort((a, b) => b.urg - a.urg || b.dias - a.dias).slice(0, 4)
  }, [pjudRows])

  // ── alertas SIAU (desde rows planos) ──────────────────────────────────────
  const siauAlertas = useMemo(() => {
    const items = []
    siauRows.forEach(row => {
      if (!row.fecha) return
      const dias = Math.round((new Date(TODAY + 'T00:00:00') - new Date(row.fecha + 'T00:00:00')) / 86400000)
      const urg  = row.estado === 'Urgente'
      const sinR = (row.estado === 'Pendiente' || row.estado === 'Sin respuesta') && dias >= 7
      if (urg || sinR) items.push({
        causa: { causa_rit: row.causa_rit || '', cliente: row.cliente_nombre || '' },
        sol:   { id: row.id, folio: row.folio || '', solicitud: row.solicitud || '', estado: row.estado, notas: row.notas || '', responsable: 'MT' },
        dias, urg,
      })
    })
    return items.sort((a, b) => b.urg - a.urg || b.dias - a.dias).slice(0, 4)
  }, [siauRows])

  const { user } = useUser()
  const nombre   = user?.nombre || 'Macarena'
  const greeting = getGreeting()
  const hoy      = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-full bg-white">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100">
        <p className="text-sm text-gray-400 capitalize">{hoy}</p>
        <div className="flex items-end justify-between mt-0.5">
          <h1 className="text-2xl font-semibold text-gray-900">{greeting}, {nombre}</h1>
          <div className="flex items-center gap-2 pb-0.5">
            {/* Badge conexión Supabase */}
            {dbStatus === 'ok' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-medium">
                <Wifi size={11} />
                Supabase conectado
              </span>
            )}
            {dbStatus === 'error' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[11px] font-medium">
                <WifiOff size={11} />
                Sin conexión DB
              </span>
            )}
            {plazosRealesCnt > 0 && (
              <button onClick={() => navigate('/plazos')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                <AlertTriangle size={12} />
                {plazosRealesCnt} plazo{plazosRealesCnt !== 1 ? 's' : ''} crítico{plazosRealesCnt !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* Métricas */}
        <div className="grid grid-cols-5 gap-4">
          {metricas.map(m => (
            <MetricCard key={m.label} {...m} onClick={() => navigate(m.path)} />
          ))}
        </div>

        {/* Fila principal: audiencias + tareas + actividad */}
        <div className="grid grid-cols-3 gap-5">

          {/* Próximas audiencias */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <SectionHeader icon={Gavel} title="Próximas audiencias"
              count={`${proximasAudiencias.length} eventos`}
              linkLabel="Ver todas" onLink={() => navigate('/audiencias')} />
            <div className="divide-y divide-gray-50">
              {proximasAudiencias.length === 0 ? (
                <p className="px-5 py-6 text-xs text-gray-400 text-center">Sin audiencias próximas</p>
              ) : proximasAudiencias.map(a => (
                <div key={a.id} onClick={() => navigate('/audiencias')}
                  className="px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 text-right" style={{ minWidth: 52 }}>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        a.fecha === today ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {formatFecha(a.fecha)}
                      </span>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <Clock size={9} className="text-gray-300" />
                        <span className="text-[10px] text-gray-400 tabular-nums">{a.hora}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{a.cliente_nombre}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={9} className="text-gray-300 flex-shrink-0" />
                        <p className="text-[11px] text-gray-400 truncate">{a.tribunal}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        <span className="font-mono text-violet-500">{a.causa_rit}</span>
                        <span>· {a.tipo}</span>
                      </span>
                    </div>
                    <Avatar quien="MT" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tareas pendientes */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <SectionHeader icon={CheckSquare} title="Tareas pendientes"
              count={`${tareasDestacadas.length} activas`}
              linkLabel="Ver todas" onLink={() => navigate('/tareas')} />
            <div className="divide-y divide-gray-50">
              {tareasDestacadas.map(t => {
                const dias = calcDias(t.fecha_vencimiento || '')
                const esUrgente = t.prioridad === 'Alta' || dias <= 0
                return (
                  <div key={t.id} onClick={() => navigate('/tareas')}
                    className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="mt-0.5 flex-shrink-0">
                      <Circle size={14} className="text-gray-300" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 leading-snug truncate">{t.titulo}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{t.cliente_nombre} · {t.causa_rit}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Avatar quien={t.responsable || 'MT'} size={16} />
                      {t.fecha_vencimiento && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          esUrgente ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {formatFecha(t.fecha_vencimiento)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <SectionHeader icon={FileText} title="Actividad reciente" />
            <div className="divide-y divide-gray-50">
              {actividadReciente.map((a, i) => (
                <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <a.icon size={12} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-snug truncate">{a.texto}</p>
                    {a.sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{a.sub}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar quien={a.quien} size={14} />
                      <span className="text-[10px] text-gray-400">{RESP_NAME[a.quien] || a.quien}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plazos críticos */}
        {plazosDestacados.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <SectionHeader icon={AlertTriangle} title="Plazos críticos y urgentes"
              count={plazosRealesCnt > 0 ? <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{plazosRealesCnt}</span> : null}
              linkLabel="Ver todos" onLink={() => navigate('/plazos')} />
            <div className="divide-y divide-gray-50">
              {plazosDestacados.map(p => {
                const dias = calcDias(p.fecha_vencimiento)
                const urg  = getUrgencia(p)
                const barColor = urg === 'vencido' ? '#b91c1c' : urg === 'critico' ? '#dc2626' : '#d97706'
                const diasLabel = dias === 0 ? 'Vence HOY' : dias === 1 ? 'Vence mañana'
                  : dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias} días`
                const diasColor = urg === 'vencido' ? 'text-red-800' : dias <= 0 ? 'text-red-500' : dias <= 1 ? 'text-amber-500' : 'text-amber-600'
                return (
                  <div key={p.id} onClick={() => navigate('/plazos')}
                    className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{p.titulo}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {p.cliente_nombre} · <span className="font-mono text-violet-500">{p.causa_rit}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className={`text-[11px] font-semibold ${diasColor}`}>{diasLabel}</p>
                      <Avatar quien={p.responsable || 'MT'} size={20} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PJUD + SIAU en grid */}
        {(pjudAlertas.length > 0 || siauAlertas.length > 0) && (
          <div className={`grid gap-5 ${pjudAlertas.length > 0 && siauAlertas.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>

            {pjudAlertas.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <SectionHeader icon={Scale} title="PJUD — Requieren atención"
                  count={<span className="text-[10px] font-bold bg-[#1a2e4a] text-white px-1.5 py-0.5 rounded-full">{pjudAlertas.length}</span>}
                  linkLabel="Ver PJUD" onLink={() => navigate('/pjud')} />
                <div className="divide-y divide-gray-50">
                  {pjudAlertas.map(({ causa, mov, dias, urg }) => (
                    <div key={mov.id} onClick={() => navigate('/pjud')}
                      className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${urg ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${urg ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            {urg ? 'Urgente' : `${dias}d sin respuesta`}
                          </span>
                          <span className="text-[9px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{causa.causa_rit}</span>
                        </div>
                        <p className="text-[12px] font-medium text-gray-900 truncate">{causa.cliente || '—'}</p>
                        <p className="text-[11px] text-gray-400 truncate">{mov.solicitud}</p>
                        {mov.accion_requerida && (
                          <p className="text-[11px] text-amber-700 mt-0.5 truncate flex items-center gap-1">
                            <Bell size={9} /> {mov.accion_requerida}
                          </p>
                        )}
                      </div>
                      <Avatar quien={mov.responsable} size={18} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {siauAlertas.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <SectionHeader icon={Gavel} title="SIAU — Requieren atención"
                  count={<span className="text-[10px] font-bold bg-[#1a2e4a] text-white px-1.5 py-0.5 rounded-full">{siauAlertas.length}</span>}
                  linkLabel="Ver SIAU" onLink={() => navigate('/siau')} />
                <div className="divide-y divide-gray-50">
                  {siauAlertas.map(({ causa, sol, dias, urg }) => (
                    <div key={sol.id} onClick={() => navigate('/siau')}
                      className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${urg ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${urg ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            {urg ? 'Urgente' : `${dias}d sin respuesta`}
                          </span>
                          <span className="text-[9px] text-gray-400">{sol.folio}</span>
                        </div>
                        <p className="text-[12px] font-medium text-gray-900 truncate">{causa.cliente || '—'}</p>
                        <p className="text-[11px] text-gray-400 truncate">{sol.solicitud}</p>
                        {sol.notas?.trim() && (
                          <p className="text-[11px] text-amber-700 mt-0.5 truncate">{sol.notas}</p>
                        )}
                      </div>
                      <Avatar quien={sol.responsable} size={18} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
