import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../context/NavigationContext'
import {
  Search, Plus, X, Phone, Mail, FileText,
  Clock, Circle, CheckCircle2,
  User, Pencil, Scale, AlertCircle, Trash2,
  Loader2, AlertTriangle, RefreshCw, ChevronDown, Check,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import InlineField from '../components/InlineField'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

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

/** Convierte una fila de Supabase al objeto que usa la UI.
 *  Campos opcionales (rut, telefono, etc.) se almacenan como string vacío
 *  para que el formulario los muestre en blanco y no reescriba '–' en la BD. */
function mapCliente(row) {
  return {
    id:            row.id,
    nombre:        row.nombre        ?? '',
    rut:           row.rut           ?? '',
    claveUnica:    row.clave_unica   ?? '',
    telefono:      row.telefono      ?? '',
    email:         row.email         ?? '',
    direccion:     row.direccion     ?? '',
    observaciones: row.observaciones ?? '',
    estado:        row.estado        ?? 'Activo',
    createdAt:     row.created_at    ?? null,
    causasActivas: row.causas_activas ?? 0,
  }
}

/** Convierte el formulario al payload para Supabase.
 *  Campos vacíos o con el placeholder '–' se envían como null para no contaminar la BD. */
function mapToDb(form) {
  const clean = v => {
    const s = (v ?? '').trim()
    return s === '' || s === '–' ? null : s
  }
  return {
    nombre:        form.nombre.trim(),
    rut:           clean(form.rut),
    clave_unica:   clean(form.claveUnica),
    telefono:      clean(form.telefono),
    email:         clean(form.email),
    direccion:     clean(form.direccion),
    observaciones: clean(form.observaciones),
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
function PanelCliente({ cliente, hasActiveCausas, onClose, onEstadoCambiar, onInlineSave, onRequestDelete }) {
  const navigate = useNavigate()
  const { setActiveCausa } = useNavigation()
  const [tab, setTab]                   = useState('causas')
  const [causas, setCausas]             = useState([])
  const [loadingCausas, setLoadingCausas] = useState(false)

  useEffect(() => {
    setLoadingCausas(true)
    supabase
      .from('causas')
      .select('id, rit, ruc, materia, tribunal, estado')
      .eq('cliente_id', cliente.id)
      .then(({ data, error }) => {
        if (!error && data) setCausas(data)
        setLoadingCausas(false)
      })
  }, [cliente.id])

  const ini = iniciales(cliente.nombre)

  // Inline save helper — llama al padre con (id, campo, valor)
  const save = (field) => async (value) => onInlineSave?.(cliente.id, field, value)

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: hasActiveCausas ? '#2570ba' : '#9ca3af' }}
            >
              {ini}
            </div>
            <div className="min-w-0 flex-1">
              {/* Nombre editable inline */}
              <InlineField
                value={cliente.nombre}
                onSave={save('nombre')}
                placeholder="Nombre del cliente"
                textClassName="text-sm font-semibold text-gray-900"
                inputClassName="text-sm font-semibold w-full"
              />
              {/* RUT editable inline */}
              <InlineField
                value={cliente.rut}
                onSave={save('rut')}
                placeholder="Agregar RUT"
                textClassName="text-xs text-gray-400 font-mono"
                inputClassName="text-xs font-mono w-24"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onRequestDelete?.(cliente, causas.length)}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
            title="Eliminar cliente"
          >
            <Trash2 size={13} />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Propiedades — estilo Notion (icon + campo inline editable) */}
      <div className="px-5 py-3 border-b border-gray-50 space-y-1.5">
        {/* Teléfono */}
        <div className="flex items-center gap-2.5 group/prop">
          <Phone size={11} className="text-gray-300 flex-shrink-0" />
          <span className="text-[10px] text-gray-300 w-14 flex-shrink-0">Teléfono</span>
          <InlineField
            value={cliente.telefono}
            onSave={save('telefono')}
            placeholder="Agregar"
            textClassName="text-xs text-gray-600"
            inputClassName="text-xs w-40"
          />
        </div>
        {/* Email */}
        <div className="flex items-center gap-2.5 group/prop">
          <Mail size={11} className="text-gray-300 flex-shrink-0" />
          <span className="text-[10px] text-gray-300 w-14 flex-shrink-0">Email</span>
          <InlineField
            value={cliente.email}
            onSave={save('email')}
            placeholder="Agregar"
            textClassName="text-xs text-gray-600"
            inputClassName="text-xs w-44"
          />
        </div>
        {/* Dirección */}
        <div className="flex items-center gap-2.5 group/prop">
          <Circle size={11} className="text-gray-300 flex-shrink-0" />
          <span className="text-[10px] text-gray-300 w-14 flex-shrink-0">Dirección</span>
          <InlineField
            value={cliente.direccion}
            onSave={save('direccion')}
            placeholder="Agregar"
            textClassName="text-xs text-gray-500"
            inputClassName="text-xs w-44"
          />
        </div>
        {/* Clave Única */}
        <div className="flex items-center gap-2.5 group/prop">
          <AlertCircle size={11} className="text-gray-300 flex-shrink-0" />
          <span className="text-[10px] text-gray-300 w-14 flex-shrink-0">Clave Única</span>
          <InlineField
            value={cliente.claveUnica}
            onSave={save('claveUnica')}
            placeholder="Agregar"
            textClassName="text-xs text-gray-500 font-mono"
            inputClassName="text-xs font-mono w-28"
          />
        </div>
        {/* Estado */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: avatarColor(cliente.estado), marginLeft: 1 }} />
          <span className="text-[10px] text-gray-300 w-14 flex-shrink-0">Estado</span>
          <ClienteEstadoDropdown estado={cliente.estado} onCambiar={onEstadoCambiar} />
          {!loadingCausas && (
            <span className="text-[10px] text-gray-300 ml-1">
              · {causas.filter(c => c.estado === 'En tramitación' || c.estado === 'Activa').length} activa{causas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5">
        {[{ key: 'causas', label: 'Causas' }, { key: 'notas', label: 'Notas' }].map(t => (
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
              <div key={c.id}
                className="px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  setActiveCausa({
                    id:             c.id,
                    rit:            c.rit || null,
                    ruc:            c.ruc || null,
                    materia:        c.materia || '',
                    cliente_nombre: cliente.nombre || '',
                    cliente_id:     cliente.id,
                  })
                  navigate('/causas')
                }}
              >
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
            {/* Observaciones — textarea inline editable con auto-save */}
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">Observaciones internas</p>
            <InlineField
              value={cliente.observaciones}
              onSave={save('observaciones')}
              type="textarea"
              placeholder="Agrega notas internas sobre este cliente…"
              debounce={1200}
              textClassName="text-xs text-gray-600 leading-relaxed whitespace-pre-line"
              inputClassName="text-xs"
            />
            {cliente.createdAt && (
              <p className="text-[10px] text-gray-300 mt-4">
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

const ESTADOS_VALIDOS = new Set(['Activo', 'Inactivo'])

function FormCliente({ inicial, onClose, onGuardar, guardando, errorMsg }) {
  const esEdicion = !!inicial?.id
  const [form, setForm] = useState(() => {
    const base = {
      nombre: '', rut: '', claveUnica: '', telefono: '',
      email: '', direccion: '', observaciones: '', estado: 'Activo',
      ...inicial,
    }
    // Si el estado no es reconocido (ej: 'Cerrado'), lo dejamos para que el usuario elija
    // pero lo guardamos en el form tal cual para mostrarlo como advertencia
    return base
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Cmd+Enter submits this form
  const saveRef = useRef(null)
  saveRef.current = () => onGuardar(form)
  useEffect(() => {
    const fn = () => saveRef.current?.()
    window.addEventListener('global:save', fn)
    return () => window.removeEventListener('global:save', fn)
  }, [])

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
        {/* Banner de error inline — reemplaza el alert() */}
        {errorMsg && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-snug">{errorMsg}</p>
          </div>
        )}

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
                    ? 'border-[#2570BA] bg-[#2570BA] text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                {e}
              </button>
            ))}
          </div>
          {/* Si el cliente tiene un estado desconocido (ej: 'Cerrado'), mostrarlo */}
          {form.estado && form.estado !== 'Activo' && form.estado !== 'Inactivo' && (
            <p className="mt-1.5 text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
              Estado actual: <strong>{form.estado}</strong> — al guardar se reemplazará por el seleccionado arriba.
            </p>
          )}
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
          style={{ backgroundColor: '#2570BA' }}>
          {guardando && <Loader2 size={11} className="animate-spin" />}
          {esEdicion ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Clientes() {
  const [_ps] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ps.clientes') ?? 'null') ?? {} }
    catch { return {} }
  })

  const [clientes, setClientes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [busqueda, setBusqueda]   = useState(_ps.busqueda ?? '')
  // Multi-select: Set vacío = sin filtro (muestra todos)
  const [filtros, setFiltros]     = useState(new Set(_ps.filtros ?? []))
  const [clienteSeleccionado, setSeleccionado] = useState(null)
  // Set de IDs de clientes que tienen al menos una causa Abierta o Revisar
  const [clienteHasActiveCausasSet, setClienteHasActiveCausasSet] = useState(new Set())
  const [formulario, setFormulario] = useState(null) // null | 'nuevo' | objeto cliente
  const [formError, setFormError] = useState(null)   // error del formulario modal
  const [deleteModal, setDeleteModal] = useState(null) // null | { cliente, causasCount }

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

  useEffect(() => {
    fetchClientes()
    supabase.from('causas').select('cliente_id, estado').in('estado', ['Abierta', 'Revisar'])
      .then(({ data }) => {
        setClienteHasActiveCausasSet(new Set((data || []).map(c => c.cliente_id).filter(Boolean)))
      })
  }, [fetchClientes])

  // Restore selected client after data loads
  useEffect(() => {
    if (loading || !_ps.selectedId) return
    const found = clientes.find(c => c.id === _ps.selectedId)
    if (found) setSeleccionado(found)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll ref for persistence
  const scrollRef = useRef()

  // Restore scroll after data loads
  useEffect(() => {
    if (!loading && _ps.scrollTop && scrollRef.current) {
      const el = scrollRef.current
      requestAnimationFrame(() => { el.scrollTop = _ps.scrollTop })
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep state ref synced for the unmount closure
  const _stRef = useRef({})
  useEffect(() => {
    _stRef.current = { busqueda, filtros: [...filtros], selectedId: clienteSeleccionado?.id }
  }, [busqueda, filtros, clienteSeleccionado])

  // Save on unmount
  useEffect(() => () => {
    sessionStorage.setItem('ps.clientes', JSON.stringify({
      ..._stRef.current,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes open form or panel (form takes priority)
  useEffect(() => {
    const fn = () => {
      if (formulario) setFormulario(null)
      else if (clienteSeleccionado) setSeleccionado(null)
    }
    window.addEventListener('modal:close', fn)
    return () => window.removeEventListener('modal:close', fn)
  }, [formulario, clienteSeleccionado])

  // ── Crear / Editar via formulario modal ────────────────────────────────
  const handleGuardar = async (form) => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    setFormError(null)
    const payload = mapToDb(form)

    /** Traduce errores de Postgres a mensajes legibles */
    function traducirError(err) {
      if (err.code === '23505') {
        if (err.message.includes('nombre')) return 'Ya existe otro cliente con ese nombre.'
        if (err.message.includes('rut'))    return 'Ya existe otro cliente con ese RUT.'
        return 'Valor duplicado — ya existe otro registro con este dato.'
      }
      if (err.code === '23502') return 'Falta un campo obligatorio.'
      if (err.code === '42501') return 'Sin permisos para editar. Contacta al administrador.'
      return err.message
    }

    if (formulario === 'nuevo') {
      const { data, error: err } = await supabase
        .from('clientes').insert([payload]).select().single()
      if (err) {
        setFormError(traducirError(err))
      } else {
        const nuevo = mapCliente(data)
        setClientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
        setFormulario(null)
        setFormError(null)
        setSeleccionado(nuevo)
      }
    } else {
      // Editar — usamos .update() sin .select() para evitar errores de RLS en SELECT
      const { error: err } = await supabase
        .from('clientes').update(payload).eq('id', formulario.id)
      if (err) {
        setFormError(traducirError(err))
      } else {
        // Reconstruimos el objeto actualizado combinando los datos previos con el payload
        const actualizado = {
          ...formulario,
          nombre:        payload.nombre        ?? formulario.nombre,
          rut:           payload.rut           ?? '',
          claveUnica:    payload.clave_unica   ?? '',
          telefono:      payload.telefono      ?? '',
          email:         payload.email         ?? '',
          direccion:     payload.direccion     ?? '',
          observaciones: payload.observaciones ?? '',
          estado:        payload.estado        ?? formulario.estado,
        }
        setClientes(prev =>
          prev.map(c => c.id === actualizado.id ? actualizado : c)
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        )
        setFormulario(null)
        setFormError(null)
        setSeleccionado(actualizado)
      }
    }
    setGuardando(false)
  }

  // ── Eliminar ────────────────────────────────────────────────────────────
  /** Abre el modal de confirmación (llamado desde PanelCliente) */
  const handleRequestDelete = useCallback((cliente, causasCount = 0) => {
    setDeleteModal({ cliente, causasCount })
  }, [])

  /** Elimina el cliente + tablas sin FK (siau, pjud, revisiones) */
  const handleEliminar = async () => {
    const { cliente } = deleteModal
    if (!cliente) return
    const nombre = cliente.nombre

    // 1. Borrar registros sin FK en siau / pjud / revisiones por nombre
    await Promise.all([
      supabase.from('siau').delete().eq('cliente_nombre', nombre),
      supabase.from('pjud').delete().eq('cliente_nombre', nombre),
      supabase.from('revisiones').delete().eq('cliente_nombre', nombre),
    ])

    // 2. Borrar cliente (cascade elimina causas, audiencias, tareas, plazos, documentos)
    const { error: err } = await supabase
      .from('clientes').delete().eq('id', cliente.id)

    if (err) {
      setDeleteModal(null)
      setFormError('Error al eliminar: ' + err.message)
      return
    }

    setClientes(prev => prev.filter(c => c.id !== cliente.id))
    if (clienteSeleccionado?.id === cliente.id) setSeleccionado(null)
    setDeleteModal(null)
  }

  /** Archiva el cliente (pasa a Inactivo sin borrar datos) */
  const handleArchivar = async () => {
    const { cliente } = deleteModal
    if (!cliente) return
    const { error: err } = await supabase
      .from('clientes').update({ estado: 'Inactivo' }).eq('id', cliente.id)
    if (!err) {
      setClientes(prev => prev.map(c =>
        c.id === cliente.id ? { ...c, estado: 'Inactivo' } : c
      ))
      if (clienteSeleccionado?.id === cliente.id)
        setSeleccionado(prev => ({ ...prev, estado: 'Inactivo' }))
    }
    setDeleteModal(null)
  }

  // ── Edición inline de campo individual ─────────────────────────────────
  const handleInlineSave = useCallback(async (id, field, value) => {
    const fieldMap = {
      nombre: 'nombre', rut: 'rut', claveUnica: 'clave_unica',
      telefono: 'telefono', email: 'email', direccion: 'direccion',
      observaciones: 'observaciones',
    }
    const dbField = fieldMap[field]
    if (!dbField) return

    // Validación básica: nombre no puede quedar vacío
    if (field === 'nombre' && !(value ?? '').trim()) {
      throw new Error('El nombre no puede estar vacío.')
    }

    const clean = v => { const s = (v ?? '').trim(); return s === '' ? null : s }

    const { error: err } = await supabase
      .from('clientes').update({ [dbField]: clean(value) }).eq('id', id)

    if (err) {
      // Traducir errores comunes de Supabase/Postgres a mensajes legibles
      let msg = err.message
      if (err.code === '23505') {
        if (err.message.includes('nombre'))
          msg = 'Ya existe otro cliente con ese nombre.'
        else if (err.message.includes('rut'))
          msg = 'Ya existe otro cliente con ese RUT.'
        else
          msg = 'Valor duplicado — ya existe otro registro con este dato.'
      } else if (err.code === '23502') {
        msg = 'Este campo es obligatorio.'
      } else if (err.code === '42501') {
        msg = 'Sin permisos para editar. Contacta al administrador.'
      }
      // Lanzar para que InlineField muestre el error inline y permanezca abierto
      throw new Error(msg)
    }

    // Éxito — actualizar estado local
    const patch = { [field]: value }
    setClientes(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    setSeleccionado(prev => prev?.id === id ? { ...prev, ...patch } : prev)
  }, [])

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
    <>
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
              onClick={() => { setSeleccionado(null); setFormulario('nuevo'); setFormError(null) }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: '#2570BA' }}>
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
                  onClick={() => { setSeleccionado(null); setFormulario('nuevo'); setFormError(null) }}
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
                        className={`group border-b border-gray-50 cursor-pointer transition-colors ${
                          clienteSeleccionado?.id === c.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                        } ${c.estado === 'Inactivo' ? 'opacity-60' : ''}`}>
                        <td className="pl-8 pr-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ backgroundColor: clienteHasActiveCausasSet.has(c.id) ? '#2570ba' : '#9ca3af' }}>
                              {iniciales(c.nombre)}
                            </div>
                            <span className={`text-sm font-medium ${c.estado === 'Inactivo' ? 'text-gray-400' : 'text-gray-900'}`}>{c.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{c.rut || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.telefono || '–'}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[160px]">{c.email || '–'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[c.estado] ?? 'bg-gray-100 text-gray-400'}`}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            {formatFecha(c.createdAt)}
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                handleRequestDelete(c, 0)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                              title="Eliminar cliente">
                              <Trash2 size={11} />
                            </button>
                          </div>
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
          hasActiveCausas={clienteHasActiveCausasSet.has(clienteSeleccionado.id)}
          onClose={() => setSeleccionado(null)}
          onEstadoCambiar={handleEstadoCambiar}
          onInlineSave={handleInlineSave}
          onRequestDelete={handleRequestDelete}
        />
      )}
      {formulario && (
        <FormCliente
          inicial={formulario === 'nuevo' ? null : formulario}
          onClose={() => { setFormulario(null); setFormError(null) }}
          onGuardar={handleGuardar}
          guardando={guardando}
          errorMsg={formError}
        />
      )}
    </div>

    {/* ── Modal eliminar cliente ── */}
    <ConfirmDeleteModal
      open={!!deleteModal}
      title={deleteModal?.cliente?.nombre}
      warning={
        deleteModal?.causasCount > 0
          ? `Este cliente tiene ${deleteModal.causasCount} causa${deleteModal.causasCount !== 1 ? 's' : ''} que también se eliminarán.`
          : null
      }
      onCancel={() => setDeleteModal(null)}
      onConfirm={handleEliminar}
      onArchive={handleArchivar}
      archiveLabel="Marcar inactivo"
    />
    </>
  )
}
