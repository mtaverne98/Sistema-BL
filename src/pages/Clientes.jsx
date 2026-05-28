import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Search, Plus, X, Phone, Mail, FileText,
  Clock, Circle, CheckCircle2,
  User, Pencil, Scale, AlertCircle, Trash2,
  Loader2, AlertTriangle, RefreshCw, ChevronDown, Check,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Exportación vacía para compatibilidad con CMD+K en MainLayout ──────────
export const CLIENTES = []

// ── helpers ───────────────────────────────────────────────────────────────
// Esquema real de la tabla clientes en Supabase:
// id, nombre, rut, telefono, email, direccion, estado,
// observaciones, clave_unica, created_at

const ESTADO_BADGE = {
  Activo:   'bg-emerald-50 text-emerald-600',
  Inactivo: 'bg-gray-100 text-gray-400',
}

/** Color del avatar según estado del cliente — gris para cualquier estado no-Activo */
function avatarColor(estado) {
  return estado === 'Activo' ? '#2570ba' : '#9ca3af'
}

/** Dropdown minimalista para cambiar estado de cliente */
function ClienteEstadoDropdown({ estado, onCambiar }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)
  useEffect(() => {
    const h = e => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

  const badgeCls = ESTADO_BADGE[estado] ?? 'bg-gray-100 text-gray-400'
  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-75 ${badgeCls}`}
        title="Cambiar estado"
      >
        {estado}
        <ChevronDown size={9} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-[140px]"
        >
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-1 pb-1.5">Estado</p>
          {['Activo', 'Inactivo'].map(e => (
            <button
              key={e}
              onClick={() => { if (e !== estado) onCambiar(e); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors text-left hover:bg-gray-50 ${e === estado ? 'bg-gray-50/60' : ''}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: avatarColor(e) }} />
              <span className={`text-[12px] flex-1 ${e === estado ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>{e}</span>
              {e === estado && <Check size={11} className="text-gray-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Toma las iniciales de un nombre completo (ej: "Carmen Contreras Muñoz" → "CC") */
function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0]?.toUpperCase() ?? '?'
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

/** Primera letra para agrupar A–Z */
function primeraLetra(nombre = '') {
  return nombre.trim().charAt(0).toUpperCase() || '#'
}

/** Convierte una fila de Supabase al objeto que usa la UI */
function mapCliente(row) {
  return {
    id:            row.id,
    nombre:        row.nombre        ?? '',
    rut:           row.rut           ?? '–',
    claveUnica:    row.clave_unica   ?? '',
    telefono:      row.telefono      ?? '–',
    email:         row.email         ?? '–',
    direccion:     row.direccion     ?? '–',
    observaciones: row.observaciones ?? '',
    estado:        row.estado        ?? 'Activo',
    createdAt:     row.created_at    ?? null,
    // causasActivas se obtiene de la relación con causas (ver PanelCliente)
    causasActivas: row.causas_activas ?? 0,
  }
}

/** Convierte el formulario al payload para Supabase */
function mapToDb(form) {
  return {
    nombre:        form.nombre.trim(),
    rut:           form.rut.trim(),
    clave_unica:   form.claveUnica.trim(),
    telefono:      form.telefono.trim(),
    email:         form.email.trim(),
    direccion:     form.direccion.trim(),
    observaciones: form.observaciones.trim(),
    estado:        form.estado || 'Activo',
  }
}

function formatFecha(iso) {
  if (!iso) return '–'
  try {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

// ── Estado de carga ────────────────────────────────────────────────────────
function LoadingRows() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
      <Loader2 size={28} className="animate-spin text-gray-300" />
      <p className="text-sm">Cargando clientes…</p>
    </div>
  )
}

function ErrorBanner({ mensaje, onRetry }) {
  return (
    <div className="mx-8 mt-8 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
      <AlertTriangle size={15} className="flex-shrink-0" />
      <span className="flex-1 text-xs">{mensaje}</span>
      <button onClick={onRetry} className="flex items-center gap-1.5 text-xs font-medium hover:underline whitespace-nowrap">
        <RefreshCw size={11} /> Reintentar
      </button>
    </div>
  )
}

// ── Panel lateral – detalle cliente ───────────────────────────────────────
function PanelCliente({ cliente, onClose, onEdit, onDelete, onEstadoCambiar }) {
  const [tab, setTab]                   = useState('causas')
  const [causas, setCausas]             = useState([])
  const [loadingCausas, setLoadingCausas] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setLoadingCausas(true)
    supabase
      .from('causas')
      .select('id, rit, materia, tribunal, estado')
      .eq('cliente_id', cliente.id)
      .then(({ data, error }) => {
        if (!error && data) setCausas(data)
        setLoadingCausas(false)
      })
  }, [cliente.id])

  const ini = iniciales(cliente.nombre)

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: avatarColor(cliente.estado) }}
            >
              {ini}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{cliente.nombre}</p>
              <p className="text-xs text-gray-400">{cliente.rut}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Eliminar">
            <Trash2 size={13} />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="mx-4 my-3 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 space-y-2">
          <p className="font-medium">¿Eliminar a {cliente.nombre}?</p>
          <p className="text-red-500">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 px-2 py-1.5 border border-red-200 rounded-md hover:bg-red-100 transition-colors">
              Cancelar
            </button>
            <button onClick={onDelete}
              className="flex-1 px-2 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium">
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Datos generales */}
      <div className="px-5 py-4 border-b border-gray-50 space-y-2.5">
        {cliente.telefono !== '–' && (
          <div className="flex items-center gap-2.5">
            <Phone size={12} className="text-gray-300 flex-shrink-0" />
            <span className="text-xs text-gray-600">{cliente.telefono}</span>
          </div>
        )}
        {cliente.email !== '–' && (
          <div className="flex items-center gap-2.5">
            <Mail size={12} className="text-gray-300 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate">{cliente.email}</span>
          </div>
        )}
        {cliente.direccion !== '–' && (
          <div className="flex items-start gap-2.5">
            <Circle size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-gray-500 leading-snug">{cliente.direccion}</span>
          </div>
        )}
        {cliente.claveUnica && (
          <div className="flex items-center gap-2.5">
            <AlertCircle size={12} className="text-gray-300 flex-shrink-0" />
            <span className="text-xs text-gray-500 font-mono">{cliente.claveUnica}</span>
            <span className="text-[10px] text-gray-400">Clave Única</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <ClienteEstadoDropdown
            estado={cliente.estado}
            onCambiar={onEstadoCambiar}
          />
          {!loadingCausas && (
            <span className="text-[11px] text-gray-400">
              {causas.filter(c => c.estado === 'En tramitación' || c.estado === 'Activa').length} causa{causas.length !== 1 ? 's' : ''} activa{causas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5">
        {[{ key: 'causas', label: 'Causas' }, { key: 'notas', label: 'Observaciones' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`py-2.5 mr-4 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-[#1a2e4a] text-[#1a2e4a]' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'causas' && (
          <div className="divide-y divide-gray-50">
            {loadingCausas ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : causas.length === 0 ? (
              <p className="px-5 py-6 text-xs text-gray-400 text-center">Sin causas registradas</p>
            ) : causas.map(c => (
              <div key={c.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-400 tabular-nums">{c.rit}</p>
                    <p className="text-xs text-gray-800 mt-0.5 leading-snug">{c.materia}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{c.tribunal}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${
                    c.estado === 'En tramitación' || c.estado === 'Activa'
                      ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {c.estado === 'En tramitación' || c.estado === 'Activa' ? 'Activa' : c.estado ?? 'Cerrada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'notas' && (
          <div className="px-5 py-4">
            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
              {cliente.observaciones || 'Sin observaciones.'}
            </p>
            {cliente.createdAt && (
              <p className="text-[11px] text-gray-300 mt-4">
                Registrado el {formatFecha(cliente.createdAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Formulario (crear y editar) ───────────────────────────────────────────
const FORM_FIELDS = [
  { key: 'nombre',     label: 'Nombre completo *', placeholder: 'Ej: Carmen Contreras Muñoz' },
  { key: 'rut',        label: 'RUT',               placeholder: 'Ej: 12.456.789-K' },
  { key: 'claveUnica', label: 'Clave Única',        placeholder: 'Número de serie' },
  { key: 'telefono',   label: 'Teléfono',           placeholder: '+56 9 XXXX XXXX' },
  { key: 'email',      label: 'Email',              placeholder: 'correo@dominio.cl' },
  { key: 'direccion',  label: 'Dirección',          placeholder: 'Calle, N°, Ciudad' },
]

function FormCliente({ inicial, onClose, onGuardar, guardando }) {
  const esEdicion = !!inicial?.id
  const [form, setForm] = useState({
    nombre: '', rut: '', claveUnica: '', telefono: '',
    email: '', direccion: '', observaciones: '', estado: 'Activo',
    ...inicial,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {esEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        </p>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {FORM_FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">{f.label}</label>
            <input
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300"
            />
          </div>
        ))}

        {/* Estado */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Estado</label>
          <div className="flex gap-2">
            {['Activo', 'Inactivo'].map(e => (
              <button key={e} onClick={() => set('estado', e)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  form.estado === e
                    ? 'border-[#1a2e4a] bg-[#1a2e4a] text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)}
            rows={3}
            placeholder="Notas internas…"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300 resize-none"
          />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        <button onClick={onClose} disabled={guardando}
          className="flex-1 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          Cancelar
        </button>
        <button
          onClick={() => onGuardar(form)}
          disabled={guardando || !form.nombre.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1a2e4a' }}>
          {guardando && <Loader2 size={11} className="animate-spin" />}
          {esEdicion ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Clientes() {
  const [clientes, setClientes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [busqueda, setBusqueda]   = useState('')
  // Multi-select: Set vacío = sin filtro (muestra todos)
  const [filtros, setFiltros]     = useState(new Set())
  const [clienteSeleccionado, setSeleccionado] = useState(null)
  const [formulario, setFormulario] = useState(null) // null | 'nuevo' | objeto cliente

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchClientes = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true })
    if (err) {
      setError('No se pudo cargar los clientes: ' + err.message)
    } else {
      setClientes((data ?? []).map(mapCliente))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchClientes() }, [fetchClientes])

  // ── Crear ───────────────────────────────────────────────────────────────
  const handleGuardar = async (form) => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    const payload = mapToDb(form)

    if (formulario === 'nuevo') {
      const { data, error: err } = await supabase
        .from('clientes').insert([payload]).select().single()
      if (err) {
        alert('Error al guardar: ' + err.message)
      } else {
        const nuevo = mapCliente(data)
        setClientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
        setFormulario(null)
        setSeleccionado(nuevo)
      }
    } else {
      // Editar
      const { data, error: err } = await supabase
        .from('clientes').update(payload).eq('id', formulario.id).select().single()
      if (err) {
        alert('Error al actualizar: ' + err.message)
      } else {
        const actualizado = mapCliente(data)
        setClientes(prev =>
          prev.map(c => c.id === actualizado.id ? actualizado : c)
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        )
        setFormulario(null)
        setSeleccionado(actualizado)
      }
    }
    setGuardando(false)
  }

  // ── Eliminar ────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!clienteSeleccionado) return
    const { error: err } = await supabase
      .from('clientes').delete().eq('id', clienteSeleccionado.id)
    if (err) {
      alert('Error al eliminar: ' + err.message)
    } else {
      setClientes(prev => prev.filter(c => c.id !== clienteSeleccionado.id))
      setSeleccionado(null)
    }
  }

  // ── Cambio rápido de estado ─────────────────────────────────────────────
  const handleEstadoCambiar = useCallback(async (nuevoEstado) => {
    if (!clienteSeleccionado) return
    const { data, error: err } = await supabase
      .from('clientes').update({ estado: nuevoEstado }).eq('id', clienteSeleccionado.id).select().single()
    if (!err && data) {
      const actualizado = mapCliente(data)
      setClientes(prev => prev.map(c => c.id === actualizado.id ? actualizado : c))
      setSeleccionado(actualizado)
    }
  }, [clienteSeleccionado])

  // ── Filtros / búsqueda ──────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return clientes.filter(c => {
      const matchBusqueda = !q ||
        c.nombre.toLowerCase().includes(q) ||
        c.rut.replace(/\./g, '').toLowerCase().includes(q.replace(/\./g, '')) ||
        c.email.toLowerCase().includes(q) ||
        c.telefono.includes(q)
      // Set vacío = todos; si hay selección, solo muestra los estados seleccionados
      const matchFiltro = filtros.size === 0 || filtros.has(c.estado)
      return matchBusqueda && matchFiltro
    })
  }, [busqueda, filtros, clientes])

  // Agrupar A–Z por primera letra del nombre
  const agrupados = useMemo(() => {
    const grupos = {}
    filtrados.forEach(c => {
      const letra = primeraLetra(c.nombre)
      if (!grupos[letra]) grupos[letra] = []
      grupos[letra].push(c)
    })
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [filtrados])

  return (
    <div className="flex h-full min-h-screen">

      {/* ── Área principal ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Header */}
        <div className="px-8 pt-8 pb-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
              <p className="mt-0.5 text-sm text-gray-400">
                {loading
                  ? 'Cargando…'
                  : `${clientes.filter(c => c.estado === 'Activo').length} activos · ${clientes.length} total`}
              </p>
            </div>
            <button
              onClick={() => { setSeleccionado(null); setFormulario('nuevo') }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: '#1a2e4a' }}>
              <Plus size={15} />
              Nuevo cliente
            </button>
          </div>

          {/* Búsqueda + Filtros */}
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, RUT, email…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {/* Chip Activos */}
              <button
                onClick={() => setFiltros(prev => {
                  const next = new Set(prev)
                  next.has('Activo') ? next.delete('Activo') : next.add('Activo')
                  return next
                })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  filtros.has('Activo')
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${filtros.has('Activo') ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                Activos
                {filtros.has('Activo') && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-1 rounded">
                    {clientes.filter(c => c.estado === 'Activo').length}
                  </span>
                )}
              </button>

              {/* Chip Inactivos */}
              <button
                onClick={() => setFiltros(prev => {
                  const next = new Set(prev)
                  next.has('Inactivo') ? next.delete('Inactivo') : next.add('Inactivo')
                  return next
                })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  filtros.has('Inactivo')
                    ? 'bg-gray-100 text-gray-600 border-gray-300'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${filtros.has('Inactivo') ? 'bg-gray-400' : 'bg-gray-300'}`} />
                Inactivos
                {filtros.has('Inactivo') && (
                  <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-1 rounded">
                    {clientes.filter(c => c.estado !== 'Activo').length}
                  </span>
                )}
              </button>

              {/* Reset — solo visible cuando hay filtros activos */}
              {filtros.size > 0 && (
                <button
                  onClick={() => setFiltros(new Set())}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Ver todos">
                  <X size={11} /> Todos
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <ErrorBanner mensaje={error} onRetry={fetchClientes} />}

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingRows />
          ) : agrupados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search size={32} className="mb-3 text-gray-200" />
              <p className="text-sm">
                {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay clientes registrados'}
              </p>
              {!busqueda && (
                <button
                  onClick={() => { setSeleccionado(null); setFormulario('nuevo') }}
                  className="mt-3 text-xs text-[#2570ba] hover:underline">
                  + Agregar primer cliente
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  {['Nombre', 'RUT', 'Teléfono', 'Email', 'Estado', 'Registrado'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide first:pl-8">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agrupados.map(([letra, grupo]) => (
                  <>
                    <tr key={`letra-${letra}`}>
                      <td colSpan={6} className="pl-8 pt-5 pb-1.5">
                        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">{letra}</span>
                      </td>
                    </tr>
                    {grupo.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => { setSeleccionado(c); setFormulario(null) }}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${
                          clienteSeleccionado?.id === c.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                        } ${c.estado === 'Inactivo' ? 'opacity-60' : ''}`}>
                        <td className="pl-8 pr-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ backgroundColor: avatarColor(c.estado) }}>
                              {iniciales(c.nombre)}
                            </div>
                            <span className={`text-sm font-medium ${c.estado === 'Inactivo' ? 'text-gray-400' : 'text-gray-900'}`}>{c.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{c.rut}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.telefono}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[160px]">{c.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[c.estado] ?? 'bg-gray-100 text-gray-400'}`}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {formatFecha(c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Panel lateral ── */}
      {clienteSeleccionado && !formulario && (
        <PanelCliente
          cliente={clienteSeleccionado}
          onClose={() => setSeleccionado(null)}
          onEdit={() => setFormulario(clienteSeleccionado)}
          onDelete={handleEliminar}
          onEstadoCambiar={handleEstadoCambiar}
        />
      )}
      {formulario && (
        <FormCliente
          inicial={formulario === 'nuevo' ? null : formulario}
          onClose={() => setFormulario(null)}
          onGuardar={handleGuardar}
          guardando={guardando}
        />
      )}
    </div>
  )
}
