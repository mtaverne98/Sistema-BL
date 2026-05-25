import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search, Plus, X, Scale, Gavel, FileText,
  CheckSquare, BookOpen, Clock, Filter,
  LayoutList, Layers, User, Hash, Pencil,
  ChevronDown, ChevronRight, MessageSquare,
  Mail, Target, Send, Briefcase, AlignLeft,
  Loader2, AlertTriangle, RefreshCw, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Exportación vacía para compatibilidad con CMD+K en MainLayout ──────────
export const CAUSAS = []

// ── Categorías de timeline ────────────────────────────────────────────────
const TIMELINE_CAT = {
  'Presentación': { bg: 'bg-blue-50',    text: 'text-blue-600',    bar: 'bg-blue-400',    Icon: Send      },
  'Resolución':   { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-400', Icon: Scale     },
  'Audiencia':    { bg: 'bg-purple-50',  text: 'text-purple-600',  bar: 'bg-purple-400',  Icon: Gavel     },
  'Oficio':       { bg: 'bg-amber-50',   text: 'text-amber-600',   bar: 'bg-amber-400',   Icon: Mail      },
  'Diligencia':   { bg: 'bg-orange-50',  text: 'text-orange-600',  bar: 'bg-orange-400',  Icon: Briefcase },
  'Documento':    { bg: 'bg-slate-50',   text: 'text-slate-500',   bar: 'bg-slate-400',   Icon: FileText  },
}

// ── Estilos ───────────────────────────────────────────────────────────────
const ESTADO_STYLES = {
  'En tramitación': { badge: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-400'    },
  'Abierta':        { badge: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400' },
  'Terminada':      { badge: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-400'   },
  'Archivada':      { badge: 'bg-gray-100 text-gray-400',      dot: 'bg-gray-300'    },
  'Suspendida':     { badge: 'bg-amber-50 text-amber-600',     dot: 'bg-amber-400'   },
}
const AREA_STYLES = {
  'Laboral':      'bg-violet-50 text-violet-600',
  'Civil':        'bg-sky-50 text-sky-600',
  'Familia':      'bg-rose-50 text-rose-500',
  'Penal':        'bg-red-50 text-red-600',
  'Comercial':    'bg-orange-50 text-orange-600',
  'Inmobiliario': 'bg-teal-50 text-teal-600',
  'Societario':   'bg-indigo-50 text-indigo-600',
}

const ESTADOS = ['En tramitación', 'Abierta', 'Terminada', 'Archivada', 'Suspendida']
const AREAS   = ['Laboral', 'Civil', 'Familia', 'Penal', 'Comercial', 'Inmobiliario', 'Societario']

// ── Helpers ───────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES['Abierta']
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {estado}
    </span>
  )
}
function AreaBadge({ area }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${AREA_STYLES[area] ?? 'bg-gray-100 text-gray-500'}`}>
      {area}
    </span>
  )
}
function initials(nombre) {
  return (nombre || 'CS').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
function parteOpciones(area) {
  return area === 'Penal' ? ['Imputado', 'Querellante'] : ['Demandante', 'Demandado']
}
function formatFecha(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

/** Convierte fila Supabase → objeto UI */
function mapCausa(row) {
  return {
    id:              row.id,
    cliente_id:      row.cliente_id      ?? null,
    cliente_nombre:  row.cliente_nombre  ?? '',
    parte:           row.parte           ?? 'Demandante',
    rit:             row.rit             ?? null,
    ruc:             row.ruc             ?? null,
    tribunal:        row.tribunal        ?? '',
    fiscalia:        row.fiscalia        ?? null,
    area:            row.area            ?? '',
    materia:         row.materia         ?? '',
    estado:          row.estado          ?? 'Abierta',
    observaciones:   row.observaciones   ?? '',
    fecha_inicio:    row.fecha_inicio    ?? null,
    created_at:      row.created_at      ?? null,
    // Campos derivados (sin columna en DB)
    etapa_procesal:  null,
    historial:       [],
    tareas:          [],
    audiencias:      [],
    documentos:      [],
    escritos:        [],
    reuniones:       [],
  }
}

/** Convierte formulario → payload Supabase */
function mapToDb(form) {
  return {
    cliente_nombre: form.cliente_nombre.trim(),
    rit:            form.rit.trim()            || null,
    ruc:            form.ruc.trim()            || null,
    tribunal:       form.tribunal.trim(),
    fiscalia:       form.fiscalia.trim()       || null,
    area:           form.area,
    materia:        form.materia.trim(),
    parte:          form.parte,
    estado:         form.estado,
    observaciones:  form.observaciones.trim()  || null,
  }
}

// ── Carga ─────────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
      <Loader2 size={22} className="animate-spin text-gray-300" />
      <span className="text-sm">Cargando causas…</span>
    </div>
  )
}

// ── Formulario nueva / editar causa ──────────────────────────────────────
const FORM_FIELDS_CAUSA = [
  { key: 'cliente_nombre', label: 'Cliente *',      placeholder: 'Nombre del cliente' },
  { key: 'materia',        label: 'Materia *',      placeholder: 'Ej: Despido injustificado' },
  { key: 'tribunal',       label: 'Tribunal *',     placeholder: 'Ej: Juzgado del Trabajo N°1' },
  { key: 'rit',            label: 'RIT',            placeholder: 'Ej: O-1234-2025' },
  { key: 'ruc',            label: 'RUC',            placeholder: 'Ej: 0-1234-2025-0' },
  { key: 'fiscalia',       label: 'Fiscalía',       placeholder: 'Fiscalía correspondiente' },
]

function FormCausa({ inicial, onClose, onGuardar, guardando }) {
  const esEdicion = !!inicial?.id
  const [form, setForm] = useState({
    cliente_nombre: '', materia: '', tribunal: '',
    rit: '', ruc: '', fiscalia: '',
    area: 'Laboral', parte: 'Demandante',
    estado: 'Abierta', observaciones: '',
    ...inicial,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="w-[340px] flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{esEdicion ? 'Editar causa' : 'Nueva causa'}</p>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {FORM_FIELDS_CAUSA.map(f => (
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

        {/* Área */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Área</label>
          <select value={form.area} onChange={e => set('area', e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] bg-white text-gray-700">
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>

        {/* Parte */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Parte</label>
          <div className="flex gap-2">
            {parteOpciones(form.area).map(p => (
              <button key={p} onClick={() => set('parte', p)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  form.parte === p ? 'border-[#1a2e4a] bg-[#1a2e4a] text-white' : 'border-gray-200 text-gray-500'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Estado</label>
          <select value={form.estado} onChange={e => set('estado', e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] bg-white text-gray-700">
            {ESTADOS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
            rows={3} placeholder="Notas internas…"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] focus:ring-1 focus:ring-[#2570ba]/20 transition-all placeholder:text-gray-300 resize-none" />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
        <button onClick={onClose} disabled={guardando}
          className="flex-1 px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          Cancelar
        </button>
        <button onClick={() => onGuardar(form)}
          disabled={guardando || !form.cliente_nombre.trim() || !form.materia.trim() || !form.tribunal.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1a2e4a' }}>
          {guardando && <Loader2 size={11} className="animate-spin" />}
          {esEdicion ? 'Guardar cambios' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Panel de detalle ──────────────────────────────────────────────────────
const PANEL_TABS = [
  { key: 'resumen',    label: 'Resumen',    Icon: AlignLeft     },
  { key: 'audiencias', label: 'Audiencias', Icon: Gavel         },
  { key: 'tareas',     label: 'Tareas',     Icon: CheckSquare   },
  { key: 'documentos', label: 'Docs',       Icon: FileText      },
  { key: 'notas',      label: 'Notas',      Icon: BookOpen      },
]

function PanelDetalle({ causa, onClose, onEdit, onDelete }) {
  const [tab, setTab]                 = useState('resumen')
  const [audiencias, setAudiencias]   = useState([])
  const [tareas, setTareas]           = useState([])
  const [loadingRel, setLoadingRel]   = useState(false)
  const [confirmDelete, setConfirm]   = useState(false)

  // Cargar audiencias y tareas relacionadas
  useEffect(() => {
    if (!causa?.id) return
    setLoadingRel(true)
    Promise.all([
      supabase.from('audiencias').select('*').eq('causa_id', causa.id).order('fecha'),
      supabase.from('tareas').select('*').eq('causa_id', causa.id).order('fecha_vencimiento'),
    ]).then(([{ data: a }, { data: t }]) => {
      setAudiencias(a ?? [])
      setTareas(t ?? [])
      setLoadingRel(false)
    })
  }, [causa?.id])

  const tareasPendientes = tareas.filter(t => t.estado !== 'Completada').length

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-gray-100 flex flex-col bg-white">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <AreaBadge area={causa.area} />
            <EstadoBadge estado={causa.estado} />
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={onEdit}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Editar">
              <Pencil size={13} />
            </button>
            <button onClick={() => setConfirm(true)}
              className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
              <Trash2 size={13} />
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
        <h2 className="text-[15px] font-semibold text-gray-900 leading-snug">{causa.materia}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{causa.cliente_nombre}</p>

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 space-y-2">
            <p className="font-medium">¿Eliminar esta causa?</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirm(false)}
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
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {PANEL_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
              tab === t.key ? 'border-[#1a2e4a] text-[#1a2e4a]' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            <t.Icon size={11} />{t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div className="px-6 py-5 space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-3">Información del caso</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Parte</p>
                  <p className="text-xs text-gray-700">{causa.parte}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Área</p>
                  <AreaBadge area={causa.area} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">RIT</p>
                  <p className="text-xs font-mono text-gray-700">{causa.rit ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">RUC</p>
                  <p className="text-xs font-mono text-gray-700">{causa.ruc ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Fiscalía</p>
                  <p className="text-xs text-gray-600">{causa.fiscalia ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Fecha inicio</p>
                  <p className="text-xs text-gray-600">{formatFecha(causa.fecha_inicio ?? causa.created_at)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400 mb-1">Tribunal</p>
                  <p className="text-xs text-gray-600 leading-snug">{causa.tribunal}</p>
                </div>
              </div>
            </div>

            {/* Stats en vivo */}
            <div className="flex items-center gap-5 py-3 border-t border-b border-gray-50">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Gavel size={12} className="text-gray-300" />
                {loadingRel ? '…' : audiencias.length} audiencia{audiencias.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <CheckSquare size={12} className="text-gray-300" />
                {loadingRel ? '…' : tareasPendientes} tarea{tareasPendientes !== 1 ? 's' : ''} pendiente{tareasPendientes !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Observaciones */}
            {causa.observaciones && (
              <div>
                <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">Observaciones</p>
                <p className="text-xs text-gray-700 leading-relaxed">{causa.observaciones}</p>
              </div>
            )}
          </div>
        )}

        {/* AUDIENCIAS */}
        {tab === 'audiencias' && (
          <div>
            <div className="px-6 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">{audiencias.length} audiencia{audiencias.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-4">
              {loadingRel ? (
                <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
              ) : audiencias.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-10">Sin audiencias programadas</p>
              ) : (
                <div className="space-y-3">
                  {audiencias.map(a => (
                    <div key={a.id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-gray-900">{a.tipo ?? 'Audiencia'}</p>
                        <EstadoBadge estado={a.estado ?? 'Próxima'} />
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Clock size={10} className="text-gray-300" />
                          {formatFecha(a.fecha)}{a.hora ? ` · ${a.hora}` : ''}
                        </span>
                        {a.tribunal && (
                          <span className="flex items-center gap-1.5">
                            <Gavel size={10} className="text-gray-300" />{a.tribunal}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAREAS */}
        {tab === 'tareas' && (
          <div>
            <div className="px-6 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {tareas.filter(t => t.estado === 'Completada').length}/{tareas.length} completadas
              </p>
            </div>
            <div>
              {loadingRel ? (
                <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
              ) : tareas.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-10">Sin tareas asociadas</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {tareas.map(t => (
                    <div key={t.id} className="px-6 py-3.5 flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 ${
                        t.estado === 'Completada' ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300'
                      }`}>
                        {t.estado === 'Completada' && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                      </div>
                      <p className={`text-xs flex-1 leading-snug ${t.estado === 'Completada' ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                        {t.titulo}
                      </p>
                      {t.fecha_vencimiento && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                          t.estado === 'Completada' ? 'bg-gray-50 text-gray-300' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {formatFecha(t.fecha_vencimiento)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DOCUMENTOS */}
        {tab === 'documentos' && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText size={28} className="text-gray-200 mb-3" />
            <p className="text-xs">Los documentos se conectarán próximamente</p>
          </div>
        )}

        {/* NOTAS */}
        {tab === 'notas' && (
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-4">Observaciones internas</p>
            {causa.observaciones ? (
              <p className="text-sm text-gray-700 leading-relaxed">{causa.observaciones}</p>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <BookOpen size={26} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400">Sin observaciones</p>
                <button onClick={onEdit} className="mt-3 text-xs text-[#2570ba] hover:underline">+ Agregar</button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sidebar de navegación interna ─────────────────────────────────────────
function CausasSidebar({ causas, clienteActivo, onSelect, busquedaSidebar, setBusquedaSidebar }) {
  const clientes = useMemo(() => {
    const map = {}
    causas.forEach(c => {
      const key = (c.cliente_nombre || '').trim()
      if (!map[key]) map[key] = { nombre: key, total: 0, activas: 0 }
      map[key].total += 1
      if (c.estado === 'En tramitación' || c.estado === 'Abierta') map[key].activas += 1
    })
    return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [causas])

  const filtrados = useMemo(() => {
    const q = busquedaSidebar.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      causas.some(ca =>
        ca.cliente_nombre === c.nombre &&
        ((ca.rit ?? '').toLowerCase().includes(q) || (ca.ruc ?? '').toLowerCase().includes(q))
      )
    )
  }, [busquedaSidebar, clientes, causas])

  return (
    <div className="flex-shrink-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden" style={{ width: 200 }}>
      <div className="px-3 pt-4 pb-3 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={busquedaSidebar}
            onChange={e => setBusquedaSidebar(e.target.value)}
            placeholder="Cliente, RIT…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300"
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <button onClick={() => onSelect(null)}
          className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-colors ${
            clienteActivo === null ? 'bg-[#1a2e4a] text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}>
          <div className="flex items-center gap-2">
            <Scale size={12} className={clienteActivo === null ? 'text-white/70' : 'text-gray-400'} />
            <span>Todas las causas</span>
          </div>
          <span className={`text-[10px] font-medium tabular-nums ${clienteActivo === null ? 'text-white/60' : 'text-gray-400'}`}>
            {causas.length}
          </span>
        </button>
        <div className="mx-4 my-2 border-t border-gray-100" />
        {filtrados.map(c => (
          <button key={c.nombre} onClick={() => onSelect(c.nombre)}
            className={`w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors group ${
              clienteActivo === c.nombre ? 'bg-[#e8f0fb] text-[#1a2e4a]' : 'text-gray-600 hover:bg-gray-50'
            }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                style={{ backgroundColor: clienteActivo === c.nombre ? '#1a2e4a' : '#cbd5e1' }}>
                {initials(c.nombre)}
              </div>
              <span className="text-xs truncate leading-snug">{c.nombre.split(' ')[0]}</span>
            </div>
            <span className={`text-[10px] tabular-nums font-medium flex-shrink-0 ml-1 ${
              clienteActivo === c.nombre ? 'text-[#2570ba]' : 'text-gray-300 group-hover:text-gray-500'
            }`}>{c.total}</span>
          </button>
        ))}
        {filtrados.length === 0 && <p className="px-4 py-6 text-[11px] text-gray-400 text-center">Sin resultados</p>}
      </nav>
    </div>
  )
}

// ── Vista agrupada ────────────────────────────────────────────────────────
function GrupoCliente({ nombre, lista, seleccionada, onSelect }) {
  const [abierto, setAbierto] = useState(true)
  return (
    <div>
      <button onClick={() => setAbierto(p => !p)}
        className="w-full flex items-center gap-3 px-7 py-2.5 hover:bg-gray-50 transition-colors text-left">
        {abierto ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        <span className="text-sm font-semibold text-gray-800">{nombre}</span>
        <span className="text-xs text-gray-400">{lista.length} causa{lista.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-1 ml-1">
          {lista.map(c => <span key={c.id} className={`w-1.5 h-1.5 rounded-full ${ESTADO_STYLES[c.estado]?.dot ?? 'bg-gray-300'}`} />)}
        </div>
      </button>
      {abierto && (
        <div className="ml-7 border-l border-gray-100">
          {lista.map(c => (
            <div key={c.id}
              onClick={() => onSelect(seleccionada?.id === c.id ? null : c)}
              className={`flex items-center gap-4 px-5 py-2.5 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${
                seleccionada?.id === c.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'
              }`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 truncate">{c.materia}</p>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">{c.rit ?? '—'}</p>
              </div>
              <AreaBadge area={c.area} />
              <EstadoBadge estado={c.estado} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Causas() {
  const [causas, setCausas]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [guardando, setGuardando]     = useState(false)

  const [clienteActivo, setCliente]   = useState(null)
  const [busquedaSidebar, setSidebar] = useState('')
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setEstado]     = useState('')
  const [filtroArea, setArea]         = useState('')
  const [vista, setVista]             = useState('tabla')
  const [seleccionada, setSeleccionada] = useState(null)
  const [mostrarFiltros, setFiltros]  = useState(false)
  const [formulario, setFormulario]   = useState(null) // null | 'nueva' | objeto causa para editar

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchCausas = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('causas')
      .select('*')
      .order('cliente_nombre', { ascending: true })
    if (err) {
      setError('No se pudo cargar las causas: ' + err.message)
    } else {
      setCausas((data ?? []).map(mapCausa))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchCausas() }, [fetchCausas])

  // ── Guardar (crear / editar) ─────────────────────────────────────────────
  const handleGuardar = async (form) => {
    setGuardando(true)
    const payload = mapToDb(form)

    if (formulario === 'nueva') {
      const { data, error: err } = await supabase.from('causas').insert([payload]).select().single()
      if (err) { alert('Error al guardar: ' + err.message) }
      else {
        const nueva = mapCausa(data)
        setCausas(prev => [...prev, nueva].sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es')))
        setFormulario(null)
        setSeleccionada(nueva)
      }
    } else {
      const { data, error: err } = await supabase.from('causas').update(payload).eq('id', formulario.id).select().single()
      if (err) { alert('Error al actualizar: ' + err.message) }
      else {
        const actualizada = mapCausa(data)
        setCausas(prev => prev.map(c => c.id === actualizada.id ? actualizada : c))
        setFormulario(null)
        setSeleccionada(actualizada)
      }
    }
    setGuardando(false)
  }

  // ── Eliminar ────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!seleccionada) return
    const { error: err } = await supabase.from('causas').delete().eq('id', seleccionada.id)
    if (err) { alert('Error al eliminar: ' + err.message) }
    else {
      setCausas(prev => prev.filter(c => c.id !== seleccionada.id))
      setSeleccionada(null)
    }
  }

  // ── Filtrado ────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return causas.filter(c => {
      const matchCliente = !clienteActivo || c.cliente_nombre === clienteActivo
      const matchQ = !q ||
        c.cliente_nombre.toLowerCase().includes(q) ||
        c.materia.toLowerCase().includes(q) ||
        c.tribunal.toLowerCase().includes(q) ||
        (c.rit ?? '').toLowerCase().includes(q)
      const matchEstado = !filtroEstado || c.estado === filtroEstado
      const matchArea   = !filtroArea   || c.area   === filtroArea
      return matchCliente && matchQ && matchEstado && matchArea
    })
  }, [causas, clienteActivo, busqueda, filtroEstado, filtroArea])

  const ordenadas = useMemo(() =>
    [...filtradas].sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre, 'es'))
  , [filtradas])

  const hayFiltros = filtroEstado || filtroArea
  const tituloVista = clienteActivo
    ? clienteActivo.split(' ').slice(0, 2).join(' ')
    : 'Todas las causas'

  const panelAbierto = seleccionada || formulario

  return (
    <div className="flex h-full min-h-screen">
      <CausasSidebar
        causas={causas}
        clienteActivo={clienteActivo}
        onSelect={n => { setCliente(n); setSeleccionada(null); setBusqueda('') }}
        busquedaSidebar={busquedaSidebar}
        setBusquedaSidebar={setSidebar}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="px-7 pt-7 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{tituloVista}</h1>
              <p className="mt-0.5 text-xs text-gray-400">
                {loading ? 'Cargando…'
                  : `${ordenadas.filter(c => c.estado === 'En tramitación' || c.estado === 'Abierta').length} activas · ${ordenadas.length} ${clienteActivo ? 'causas' : 'total'}`}
              </p>
            </div>
            <button
              onClick={() => { setSeleccionada(null); setFormulario('nueva') }}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#1a2e4a' }}>
              <Plus size={13} />Nueva causa
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar materia, tribunal, RIT…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] transition-all placeholder:text-gray-300" />
            </div>
            <button onClick={() => setFiltros(p => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                hayFiltros ? 'border-[#2570ba] text-[#2570ba] bg-blue-50' : 'border-gray-200 text-gray-500 hover:text-gray-900'
              }`}>
              <Filter size={11} />Filtros
              {hayFiltros && <span className="w-1.5 h-1.5 rounded-full bg-[#2570ba]" />}
            </button>
            <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
              <button onClick={() => setVista('tabla')}
                className={`p-1.5 rounded transition-colors ${vista === 'tabla' ? 'bg-[#1a2e4a] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                <LayoutList size={12} />
              </button>
              <button onClick={() => setVista('agrupado')}
                className={`p-1.5 rounded transition-colors ${vista === 'agrupado' ? 'bg-[#1a2e4a] text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                <Layers size={12} />
              </button>
            </div>
          </div>
          {mostrarFiltros && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Filtrar por:</span>
              <select value={filtroEstado} onChange={e => setEstado(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-600 bg-white">
                <option value="">Todos los estados</option>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
              <select value={filtroArea} onChange={e => setArea(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] text-gray-600 bg-white">
                <option value="">Todas las áreas</option>
                {AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
              {hayFiltros && (
                <button onClick={() => { setEstado(''); setArea('') }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X size={11} />Limpiar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-7 mt-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={fetchCausas} className="flex items-center gap-1.5 font-medium hover:underline">
              <RefreshCw size={11} /> Reintentar
            </button>
          </div>
        )}

        {/* Tabla / agrupado */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingState />
          ) : ordenadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Scale size={28} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">
                {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin causas registradas'}
              </p>
              {!busqueda && (
                <button onClick={() => { setSeleccionada(null); setFormulario('nueva') }}
                  className="mt-3 text-xs text-[#2570ba] hover:underline">
                  + Agregar primera causa
                </button>
              )}
            </div>
          ) : vista === 'tabla' ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  {(clienteActivo
                    ? ['Parte', 'RUC', 'RIT', 'Tribunal', 'Fiscalía', 'Área', 'Materia', 'Estado']
                    : ['Cliente', 'Parte', 'RUC', 'RIT', 'Tribunal', 'Fiscalía', 'Área', 'Materia', 'Estado']
                  ).map(col => (
                    <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide first:pl-7">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map(c => (
                  <tr key={c.id}
                    onClick={() => { setSeleccionada(seleccionada?.id === c.id ? null : c); setFormulario(null) }}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      seleccionada?.id === c.id ? 'bg-blue-50/40' : 'hover:bg-gray-50/60'
                    }`}>
                    {!clienteActivo && (
                      <td className="pl-7 pr-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: '#2570ba' }}>
                            {initials(c.cliente_nombre)}
                          </div>
                          <span className="text-xs text-gray-800 whitespace-nowrap">{c.cliente_nombre}</span>
                        </div>
                      </td>
                    )}
                    <td className={`${clienteActivo ? 'pl-7' : ''} px-3 py-2.5`}>
                      <span className="text-xs text-gray-600">{c.parte}</span>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-xs font-mono text-gray-400">{c.ruc ?? '—'}</span></td>
                    <td className="px-3 py-2.5"><span className="text-xs font-mono text-gray-500">{c.rit ?? '—'}</span></td>
                    <td className="px-3 py-2.5 max-w-[140px]"><p className="text-xs text-gray-600 truncate">{c.tribunal.split('—')[0]?.trim()}</p></td>
                    <td className="px-3 py-2.5"><span className="text-xs text-gray-400">{c.fiscalia ?? '—'}</span></td>
                    <td className="px-3 py-2.5"><AreaBadge area={c.area} /></td>
                    <td className="px-3 py-2.5 max-w-[140px]"><p className="text-xs text-gray-700 truncate">{c.materia}</p></td>
                    <td className="px-3 py-2.5"><EstadoBadge estado={c.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="divide-y divide-gray-50">
              {(() => {
                const grupos = {}
                ordenadas.forEach(c => {
                  if (!grupos[c.cliente_nombre]) grupos[c.cliente_nombre] = []
                  grupos[c.cliente_nombre].push(c)
                })
                return Object.entries(grupos).map(([nombre, lista]) => (
                  <GrupoCliente key={nombre} nombre={nombre} lista={lista}
                    seleccionada={seleccionada} onSelect={c => { setSeleccionada(c); setFormulario(null) }} />
                ))
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Paneles laterales */}
      {seleccionada && !formulario && (
        <PanelDetalle
          causa={seleccionada}
          onClose={() => setSeleccionada(null)}
          onEdit={() => setFormulario(seleccionada)}
          onDelete={handleEliminar}
        />
      )}
      {formulario && (
        <FormCausa
          inicial={formulario === 'nueva' ? null : formulario}
          onClose={() => setFormulario(null)}
          onGuardar={handleGuardar}
          guardando={guardando}
        />
      )}
    </div>
  )
}
