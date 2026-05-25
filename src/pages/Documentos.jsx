import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronDown, ChevronRight,
  Plus, Search, Star, Clock, FileText, Scale,
  AlertCircle, RotateCcw, ClipboardList, BookOpen, Mail,
  File, Layout, Lock, Tag, MessageSquare, History, Info,
  Copy, X, FolderOpen, Layers, Gavel, CheckSquare,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { PLANTILLAS_INIT } from '../context/SistemaContext'
import { supabase } from '../lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const RESPONSABLE_INFO = {
  MT: { nombre: 'Macarena T.',  color: '#2570ba', initials: 'MT' },
  AB: { nombre: 'Angélica B.', color: '#059669', initials: 'AB' },
  CL: { nombre: 'Catalina L.', color: '#7c3aed', initials: 'CL' },
}

const CATEGORIAS = [
  { id: 'Escritos',     color: 'text-blue-600',   bg: 'bg-blue-50',    dot: 'bg-blue-400'   },
  { id: 'Resoluciones', color: 'text-indigo-600',  bg: 'bg-indigo-50',  dot: 'bg-indigo-400' },
  { id: 'Evidencia',    color: 'text-orange-600',  bg: 'bg-orange-50',  dot: 'bg-orange-400' },
  { id: 'Contratos',    color: 'text-green-700',   bg: 'bg-green-50',   dot: 'bg-green-500'  },
  { id: 'Audiencias',   color: 'text-purple-600',  bg: 'bg-purple-50',  dot: 'bg-purple-400' },
  { id: 'SIAU',         color: 'text-pink-600',    bg: 'bg-pink-50',    dot: 'bg-pink-400'   },
  { id: 'PJUD',         color: 'text-teal-700',    bg: 'bg-teal-50',    dot: 'bg-teal-500'   },
  { id: 'Pericias',     color: 'text-cyan-700',    bg: 'bg-cyan-50',    dot: 'bg-cyan-500'   },
  { id: 'Poderes',      color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-500'  },
  { id: 'Otros',        color: 'text-gray-500',    bg: 'bg-gray-100',   dot: 'bg-gray-400'   },
]
const CAT_META = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]))

const TIPOS_DOC = [
  'Escrito judicial','Demanda','Querella','Recurso','Minuta',
  'Contrato','Informe','Correo','PDF','Interno','Otro',
]

const TIPO_META = {
  'Escrito judicial': { icon: Scale,        color: 'text-blue-500',   bg: 'bg-blue-50'   },
  'Demanda':          { icon: FileText,      color: 'text-indigo-500', bg: 'bg-indigo-50' },
  'Querella':         { icon: AlertCircle,   color: 'text-red-500',    bg: 'bg-red-50'    },
  'Recurso':          { icon: RotateCcw,     color: 'text-orange-500', bg: 'bg-orange-50' },
  'Minuta':           { icon: ClipboardList, color: 'text-teal-500',   bg: 'bg-teal-50'   },
  'Contrato':         { icon: BookOpen,      color: 'text-green-600',  bg: 'bg-green-50'  },
  'Informe':          { icon: Layers,        color: 'text-cyan-600',   bg: 'bg-cyan-50'   },
  'Correo':           { icon: Mail,          color: 'text-pink-500',   bg: 'bg-pink-50'   },
  'PDF':              { icon: File,          color: 'text-gray-500',   bg: 'bg-gray-100'  },
  'Plantilla':        { icon: Layout,        color: 'text-purple-500', bg: 'bg-purple-50' },
  'Interno':          { icon: Lock,          color: 'text-gray-400',   bg: 'bg-gray-100'  },
  'Otro':             { icon: File,          color: 'text-gray-400',   bg: 'bg-gray-100'  },
}

const ESTADO_STYLES = {
  borrador:   { bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-400',  label: 'Borrador'    },
  revision:   { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400', label: 'En revisión' },
  finalizado: { bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-400',  label: 'Finalizado'  },
  presentado: { bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500', label: 'Presentado'  },
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const TODAY = new Date().toISOString().slice(0, 10)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFecha(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function formatFechaCorta(dateStr) {
  if (!dateStr) return ''
  const d   = new Date(dateStr + 'T00:00:00')
  const now = new Date(TODAY + 'T00:00:00')
  const diff = Math.round((now - d) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7)  return `${diff}d`
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
}

function mapRow(row) {
  const dateStr = row.fecha_modificacion || (row.created_at ? row.created_at.slice(0,10) : TODAY)
  return {
    id:                 row.id,
    nombre:             row.nombre                       || '',
    tipo:               row.tipo                         || 'Otro',
    fecha_creacion:     row.fecha_creacion               || (row.created_at ? row.created_at.slice(0,10) : TODAY),
    fecha_modificacion: dateStr,
    estado:             row.estado                       || 'borrador',
    causa_rit:          row.causa_rit                    || '',
    causa_ruc:          row.causa_ruc                    || '',
    cliente:            row.cliente || row.cliente_nombre || '',
    tribunal:           row.tribunal                     || '',
    responsable:        row.responsable                  || 'MT',
    favorito:           !!row.favorito,
    contenido:          row.contenido                    || '',
    etiquetas:          Array.isArray(row.etiquetas)     ? row.etiquetas   : [],
    versiones:          Array.isArray(row.versiones)     ? row.versiones   : [],
    comentarios:        Array.isArray(row.comentarios)   ? row.comentarios : [],
    relaciones:         row.relaciones || { reunion_ids: [], tarea_ids: [], audiencia_ids: [] },
    categoria:          row.categoria                    || null,
  }
}

function deriveCategoria(doc) {
  if (doc.categoria) return doc.categoria
  const tipo = doc.tipo || ''
  const tags = (doc.etiquetas || []).join(' ').toLowerCase()
  if (tags.includes('siau')) return 'SIAU'
  if (tags.includes('pjud')) return 'PJUD'
  if (tipo === 'Contrato') return 'Contratos'
  if (tipo === 'Minuta') return 'Audiencias'
  if (tipo === 'Informe') return 'Otros'
  return 'Escritos'
}

function getRitMateria(rit) {
  if (!rit) return null
  const p = rit.charAt(0).toUpperCase()
  return { F: 'Familia', O: 'Laboral', P: 'Penal', C: 'Penal' }[p] || null
}

function buildClientTree(docs) {
  const map = {}
  docs.forEach(doc => {
    const cl = doc.cliente || 'Sin cliente'
    if (!map[cl]) map[cl] = {}
    const rit = doc.causa_rit || 'Sin causa'
    if (!map[cl][rit]) map[cl][rit] = 0
    map[cl][rit]++
  })
  return map
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Avatar({ code }) {
  const info = RESPONSABLE_INFO[code] || { initials: code, color: '#94a3b8' }
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
      style={{ backgroundColor: info.color }} title={info.nombre}>
      {info.initials}
    </div>
  )
}

function DocTypeIcon({ tipo, size = 14, className = '' }) {
  const meta = TIPO_META[tipo] || TIPO_META['Otro']
  const Icon = meta.icon
  return <Icon size={size} className={`${meta.color} ${className} flex-shrink-0`} strokeWidth={1.8} />
}

function EstadoBadge({ estado, onClick }) {
  const s = ESTADO_STYLES[estado] || ESTADO_STYLES.borrador
  return (
    <span onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text} ${onClick ? 'cursor-pointer hover:opacity-80 select-none' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
      {onClick && <ChevronDown size={8} />}
    </span>
  )
}

function CategoriaBadge({ categoria }) {
  const meta = CAT_META[categoria] || CAT_META['Otros']
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${meta.bg} ${meta.color}`}>
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${meta.dot}`} />
      {categoria}
    </span>
  )
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────
function LeftSidebar({
  docs, activeView, onView,
  selectedCliente, onCliente,
  selectedCausa, onCausa,
  selectedCategoria, onCategoria,
  selectedEstado, onEstado,
}) {
  const [expandedClientes, setExpandedClientes] = useState({})

  const clientTree = useMemo(() => buildClientTree(docs), [docs])

  const categoryCounts = useMemo(() => {
    const m = {}
    docs.forEach(d => {
      const cat = deriveCategoria(d)
      m[cat] = (m[cat] || 0) + 1
    })
    return m
  }, [docs])

  const estadoCounts = useMemo(() => {
    const m = {}
    docs.forEach(d => { m[d.estado] = (m[d.estado] || 0) + 1 })
    return m
  }, [docs])

  function toggleExpandCliente(cl) {
    setExpandedClientes(prev => ({ ...prev, [cl]: !prev[cl] }))
  }

  function handleClickCliente(cl) {
    if (selectedCliente === cl) { onCliente(null); onCausa(null) }
    else { onCliente(cl); onCausa(null) }
    onView('all')
  }

  function handleClickCausa(rit) {
    onCausa(selectedCausa === rit ? null : rit)
    onView('all')
  }

  function clearAll() { onView('all'); onCliente(null); onCausa(null); onCategoria(null); onEstado(null) }

  const isNavActive = id => activeView === id && !selectedCliente && !selectedCausa && !selectedCategoria && !selectedEstado

  function NavBtn({ id, icon: Icon, label, count }) {
    const active = isNavActive(id)
    return (
      <button onClick={() => { clearAll(); onView(id) }}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-all select-none ${
          active ? 'bg-[#1a2e4a] text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
        }`}>
        <Icon size={12} strokeWidth={1.75} className="flex-shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        {count > 0 && (
          <span className={`text-[10px] rounded-full px-1.5 font-semibold ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="flex-shrink-0 flex flex-col border-r border-gray-100 py-3 px-2 overflow-y-auto"
      style={{ width: 208 }}>

      {/* Vistas */}
      <div className="space-y-0.5 mb-4">
        <NavBtn id="all"        icon={FolderOpen} label="Todos"      count={docs.length} />
        <NavBtn id="recientes"  icon={Clock}      label="Recientes"  count={0} />
        <NavBtn id="favoritos"  icon={Star}       label="Favoritos"  count={docs.filter(d => d.favorito).length} />
        <NavBtn id="plantillas" icon={Layout}     label="Plantillas" count={PLANTILLAS_INIT.length} />
      </div>

      {/* Clientes tree */}
      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-2.5 mb-1.5">Clientes</p>
      <div className="space-y-0.5 mb-4">
        {Object.entries(clientTree).map(([cl, causas]) => {
          const total = Object.values(causas).reduce((s, n) => s + n, 0)
          const isExpanded = !!expandedClientes[cl]
          const isActive = selectedCliente === cl
          const parts = cl.split(' ')
          const shortName = parts.length >= 3
            ? parts[0] + ' ' + parts[1] + ' ' + parts[2].charAt(0) + '.'
            : cl
          return (
            <div key={cl}>
              <div className="flex items-center gap-0 rounded-md">
                <button onClick={() => toggleExpandCliente(cl)}
                  className="flex-shrink-0 w-5 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors">
                  {isExpanded
                    ? <ChevronDown size={9} />
                    : <ChevronRight size={9} />}
                </button>
                <button onClick={() => handleClickCliente(cl)}
                  className={`flex-1 flex items-center gap-1 px-1 py-1 rounded-md text-[11.5px] transition-all text-left select-none min-w-0 ${
                    isActive ? 'text-[#1a2e4a] font-semibold' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}>
                  <span className="truncate">{shortName}</span>
                  <span className={`ml-auto flex-shrink-0 text-[10px] font-semibold px-1 ${isActive ? 'text-[#2570ba]' : 'text-gray-300'}`}>{total}</span>
                </button>
              </div>

              {isExpanded && (
                <div className="ml-5 mt-0.5 space-y-0.5">
                  {Object.entries(causas).map(([rit, count]) => {
                    const materia = getRitMateria(rit)
                    const isRitActive = selectedCausa === rit
                    return (
                      <button key={rit} onClick={() => handleClickCausa(rit)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-all ${
                          isRitActive
                            ? 'bg-blue-50 text-[#2570ba] font-medium'
                            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                        }`}>
                        <span className="text-[10.5px] font-mono truncate">{rit}</span>
                        {materia && <span className="text-[9px] text-gray-300 flex-shrink-0">{materia}</span>}
                        <span className="ml-auto text-[9px] text-gray-300 flex-shrink-0">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Categorías */}
      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-2.5 mb-1.5">Categoría</p>
      <div className="space-y-0.5 mb-4">
        {CATEGORIAS.filter(c => categoryCounts[c.id] > 0).map(c => {
          const active = selectedCategoria === c.id
          return (
            <button key={c.id}
              onClick={() => { onCategoria(active ? null : c.id); onView('all'); onCliente(null); onCausa(null); onEstado(null) }}
              className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] transition-all ${
                active ? `${c.bg} ${c.color} font-medium` : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
              <span className="flex-1 text-left">{c.id}</span>
              <span className={`text-[10px] font-semibold ${active ? c.color : 'text-gray-300'}`}>{categoryCounts[c.id]}</span>
            </button>
          )
        })}
      </div>

      {/* Estado */}
      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-2.5 mb-1.5">Estado</p>
      <div className="space-y-0.5">
        {Object.entries(estadoCounts).map(([estado, count]) => {
          const s = ESTADO_STYLES[estado]
          const active = selectedEstado === estado
          return (
            <button key={estado}
              onClick={() => { onEstado(active ? null : estado); onView('all'); onCliente(null); onCausa(null); onCategoria(null) }}
              className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-[11.5px] transition-all ${
                active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s?.dot || 'bg-gray-400'}`} />
              <span className="flex-1 text-left">{s?.label || estado}</span>
              <span className="text-[10px] text-gray-300 font-semibold">{count}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

// ── Quick Access Strip ────────────────────────────────────────────────────────
function MiniCard({ doc, onSelect }) {
  const meta = TIPO_META[doc.tipo] || TIPO_META['Otro']
  return (
    <button onClick={() => onSelect(doc.id)}
      className="flex-shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all text-left group"
      style={{ width: 176 }}>
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.bg}`}>
        <DocTypeIcon tipo={doc.tipo} size={11} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-800 truncate leading-snug group-hover:text-[#1a2e4a]">{doc.nombre}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {doc.causa_rit && <span className="text-[9px] font-mono text-[#2570ba]">{doc.causa_rit}</span>}
          <span className="text-[9px] text-gray-300">{formatFechaCorta(doc.fecha_modificacion)}</span>
        </div>
      </div>
    </button>
  )
}

function QuickAccessStrip({ docs, onSelect }) {
  const recent  = useMemo(() =>
    [...docs].sort((a, b) => b.fecha_modificacion.localeCompare(a.fecha_modificacion)).slice(0, 5)
  , [docs])
  const starred = useMemo(() => docs.filter(d => d.favorito), [docs])

  if (recent.length === 0) return null

  return (
    <div className="flex-shrink-0 border-b border-gray-100 px-5 pt-3.5 pb-3 space-y-2.5">
      <div>
        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Recientes</p>
        <div className="flex gap-2" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
          {recent.map(doc => <MiniCard key={doc.id} doc={doc} onSelect={onSelect} />)}
        </div>
      </div>
      {starred.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Star size={8} className="text-amber-400" fill="currentColor" /> Destacados
          </p>
          <div className="flex gap-2" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
            {starred.map(doc => <MiniCard key={doc.id} doc={doc} onSelect={onSelect} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Table View ────────────────────────────────────────────────────────────────
const GRID = '28px 1fr 86px 94px 120px 84px 58px 28px'

function TableView({ docs, onSelect, onToggleFav, sortBy, sortDir, onSort }) {
  function SortBtn({ col, label }) {
    const active = sortBy === col
    return (
      <button onClick={() => onSort(col)}
        className={`flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors select-none ${
          active ? 'text-gray-700' : 'text-gray-300 hover:text-gray-500'
        }`}>
        {label}
        {active && (sortDir === 'asc' ? <ArrowUp size={8} strokeWidth={2.5} /> : <ArrowDown size={8} strokeWidth={2.5} />)}
      </button>
    )
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-gray-300">
        <FileText size={26} className="mb-3 opacity-30" />
        <p className="text-[12px]">Sin documentos</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 grid items-center px-4 py-2 border-b border-gray-100 bg-gray-50/50 gap-2"
        style={{ gridTemplateColumns: GRID }}>
        <div />
        <SortBtn col="nombre"             label="Documento" />
        <SortBtn col="categoria"          label="Categoría" />
        <SortBtn col="causa_rit"          label="RIT" />
        <SortBtn col="cliente"            label="Cliente" />
        <SortBtn col="estado"             label="Estado" />
        <SortBtn col="fecha_modificacion" label="Modif." />
        <div />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {docs.map(doc => {
          const cat = deriveCategoria(doc)
          return (
            <div key={doc.id}
              onClick={() => onSelect(doc.id)}
              className="grid items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer group transition-colors gap-2"
              style={{ gridTemplateColumns: GRID }}>

              {/* Type icon */}
              <div className="flex items-center justify-center">
                <DocTypeIcon tipo={doc.tipo} size={13} />
              </div>

              {/* Nombre */}
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[12.5px] font-medium text-gray-800 truncate group-hover:text-[#1a2e4a] transition-colors leading-snug">
                  {doc.nombre}
                </span>
                {doc.favorito && <Star size={10} className="text-amber-400 flex-shrink-0" fill="currentColor" />}
              </div>

              {/* Categoría */}
              <div className="flex items-center">
                <CategoriaBadge categoria={cat} />
              </div>

              {/* RIT */}
              <div className="min-w-0">
                {doc.causa_rit
                  ? <span className="text-[10.5px] font-mono text-[#2570ba] font-semibold">{doc.causa_rit}</span>
                  : <span className="text-[10px] text-gray-200">—</span>}
              </div>

              {/* Cliente */}
              <div className="min-w-0">
                <span className="text-[11px] text-gray-500 truncate block">{doc.cliente || '—'}</span>
              </div>

              {/* Estado */}
              <div className="flex items-center">
                <EstadoBadge estado={doc.estado} />
              </div>

              {/* Fecha */}
              <div>
                <span className="text-[10.5px] text-gray-400">{formatFechaCorta(doc.fecha_modificacion)}</span>
              </div>

              {/* Responsable */}
              <div className="flex items-center justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                <Avatar code={doc.responsable} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main content area (search + strip + table) ────────────────────────────────
function MainContent({
  docs, view,
  selectedCliente, selectedCausa, selectedCategoria, selectedEstado,
  onView, onCliente, onCausa, onCategoria, onEstado,
  onSelect, onToggleFav, sortBy, sortDir, onSort,
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let list = [...docs]

    if (view === 'recientes') {
      list = [...docs].sort((a, b) => b.fecha_modificacion.localeCompare(a.fecha_modificacion)).slice(0, 10)
    } else if (view === 'favoritos') {
      list = docs.filter(d => d.favorito)
    }

    if (selectedCliente)   list = list.filter(d => d.cliente === selectedCliente)
    if (selectedCausa)     list = list.filter(d => d.causa_rit === selectedCausa)
    if (selectedCategoria) list = list.filter(d => deriveCategoria(d) === selectedCategoria)
    if (selectedEstado)    list = list.filter(d => d.estado === selectedEstado)

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(d =>
        d.nombre?.toLowerCase().includes(q) ||
        d.cliente?.toLowerCase().includes(q) ||
        d.causa_rit?.toLowerCase().includes(q) ||
        d.tipo?.toLowerCase().includes(q) ||
        d.etiquetas?.some(t => t.includes(q)) ||
        d.contenido?.toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      const va = (a[sortBy] || '').toString()
      const vb = (b[sortBy] || '').toString()
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [docs, view, selectedCliente, selectedCausa, selectedCategoria, selectedEstado, query, sortBy, sortDir])

  const activeFilters = [
    selectedCliente   && { key: 'cl', label: selectedCliente.split(' ').slice(0, 2).join(' '),  onRemove: () => { onCliente(null); onCausa(null) } },
    selectedCausa     && { key: 'ca', label: selectedCausa,                                     onRemove: () => onCausa(null) },
    selectedCategoria && { key: 'ct', label: selectedCategoria,                                 onRemove: () => onCategoria(null) },
    selectedEstado    && { key: 'es', label: ESTADO_STYLES[selectedEstado]?.label,              onRemove: () => onEstado(null) },
  ].filter(Boolean)

  const noFilters = !selectedCliente && !selectedCausa && !selectedCategoria && !selectedEstado && !query && view === 'all'

  const viewLabel = view === 'recientes' ? 'Recientes'
    : view === 'favoritos' ? 'Favoritos'
    : selectedCausa ? selectedCausa
    : selectedCliente ? selectedCliente.split(' ').slice(0, 2).join(' ')
    : selectedCategoria || (selectedEstado && ESTADO_STYLES[selectedEstado]?.label)
    || 'Todos los documentos'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="relative mb-2">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre, cliente, RIT, contenido..."
            className="w-full pl-8 pr-8 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white outline-none text-gray-700 placeholder-gray-300 focus:border-gray-300 transition-colors" />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Breadcrumb + filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-gray-700">{viewLabel}</span>
          <span className="text-[10px] text-gray-200">·</span>
          <span className="text-[11px] text-gray-400">{filtered.length} doc{filtered.length !== 1 ? 's' : ''}</span>
          {activeFilters.map(f => (
            <span key={f.key} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-[#2570ba] font-medium">
              {f.label}
              <button onClick={f.onRemove} className="hover:text-red-400 transition-colors ml-0.5"><X size={8} /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Quick access strip (no filters active) */}
      {noFilters && <QuickAccessStrip docs={docs} onSelect={onSelect} />}

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <TableView
          docs={filtered}
          onSelect={onSelect}
          onToggleFav={onToggleFav}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </div>
  )
}

// ── Templates View ────────────────────────────────────────────────────────────
function TemplatesView({ onUseTemplate }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
        <h2 className="text-[15px] font-semibold text-gray-900">Plantillas jurídicas</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Variables dinámicas · Reutilización rápida</p>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          {PLANTILLAS_INIT.map(tmpl => {
            const meta = TIPO_META[tmpl.tipo] || TIPO_META['Otro']
            const Icon = meta.icon
            return (
              <div key={tmpl.id} onClick={() => onUseTemplate(tmpl)}
                className="group flex flex-col gap-2.5 p-4 border border-gray-100 rounded-xl bg-white hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                    <Icon size={16} className={meta.color} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 leading-tight">{tmpl.nombre}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{tmpl.categoria}</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{tmpl.descripcion}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {tmpl.variables.slice(0, 3).map(v => (
                    <span key={v} className="text-[9px] font-mono bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">{v}</span>
                  ))}
                  {tmpl.variables.length > 3 && <span className="text-[9px] text-gray-300">+{tmpl.variables.length - 3} más</span>}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#2570ba] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <Copy size={11} /> Usar plantilla
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Metadata Panel ────────────────────────────────────────────────────────────
function MetadataPanel({ doc, activeTab, onTabChange, onUpdate, onAddComentario, onAddVersion, reuniones, tareas, audiencias }) {
  const [showEstadoMenu,  setShowEstadoMenu]  = useState(false)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [autorComentario, setAutorComentario] = useState('MT')
  const [etiquetaInput,   setEtiquetaInput]   = useState('')

  const MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  function handleAddComentario() {
    if (!nuevoComentario.trim()) return
    onAddComentario(doc.id, {
      id: genId('c'), autor: autorComentario,
      fecha: TODAY, hora: new Date().toTimeString().slice(0, 5),
      texto: nuevoComentario.trim(),
    })
    setNuevoComentario('')
  }

  function handleEtiqueta(e) {
    if (e.key !== 'Enter') return
    const tag = etiquetaInput.trim().toLowerCase()
    if (tag && !doc.etiquetas.includes(tag))
      onUpdate(doc.id, { etiquetas: [...doc.etiquetas, tag] })
    setEtiquetaInput('')
  }

  const relReuniones  = (reuniones  || []).filter(r => doc.relaciones?.reunion_ids?.includes(r.id))
  const relTareas     = (tareas     || []).filter(t => doc.relaciones?.tarea_ids?.includes(t.id))
  const relAudiencias = (audiencias || []).filter(a => doc.relaciones?.audiencia_ids?.includes(a.id))

  return (
    <div className="flex-shrink-0 w-60 border-l border-gray-100 flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-gray-100 flex-shrink-0">
        {[['info','Info',Info],['versiones','Ver.',History],['comentarios','Com.',MessageSquare]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => onTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] border-b-2 transition-all ${
              activeTab === id ? 'border-[#1a2e4a] text-[#1a2e4a] font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            <Icon size={10} strokeWidth={2} />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* INFO */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Estado</p>
              <div className="relative inline-block">
                <EstadoBadge estado={doc.estado} onClick={() => setShowEstadoMenu(s => !s)} />
                {showEstadoMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEstadoMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[130px]">
                      {Object.keys(ESTADO_STYLES).map(e => (
                        <button key={e} onClick={() => { onUpdate(doc.id, { estado: e }); setShowEstadoMenu(false) }}
                          className={`w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors ${e === doc.estado ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                          {ESTADO_STYLES[e].label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {[
              ['Categoría',  deriveCategoria(doc)],
              ['Tipo',       doc.tipo],
              ['Responsable',RESPONSABLE_INFO[doc.responsable]?.nombre],
              ['Cliente',    doc.cliente],
              ['RIT',        doc.causa_rit],
              ['Tribunal',   doc.tribunal],
              ['Creado',     formatFecha(doc.fecha_creacion)],
              ['Modificado', formatFecha(doc.fecha_modificacion)],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">{k}</p>
                <p className="text-[12px] text-gray-700">{v}</p>
              </div>
            ))}

            <div>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1.5">Etiquetas</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {doc.etiquetas.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500 font-medium">
                    {t}
                    <button onClick={() => onUpdate(doc.id, { etiquetas: doc.etiquetas.filter(e => e !== t) })}
                      className="text-gray-300 hover:text-red-400 transition-colors"><X size={9} /></button>
                  </span>
                ))}
              </div>
              <input value={etiquetaInput} onChange={e => setEtiquetaInput(e.target.value)} onKeyDown={handleEtiqueta}
                placeholder="+ Etiqueta (Enter)"
                className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-gray-700 placeholder-gray-300 focus:border-gray-300" />
            </div>

            {(relReuniones.length > 0 || relTareas.length > 0 || relAudiencias.length > 0) && (
              <div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Relaciones</p>
                <div className="space-y-1.5">
                  {relReuniones.map(r => {
                    const rd = new Date(r.fecha + 'T00:00:00')
                    return (
                      <div key={r.id} className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                        <MessageSquare size={10} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">Reunión {rd.getDate()} {MESES_L[rd.getMonth()]}</span>
                      </div>
                    )
                  })}
                  {relTareas.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                      <CheckSquare size={10} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{t.titulo}</span>
                    </div>
                  ))}
                  {relAudiencias.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                      <Gavel size={10} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{a.tipo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VERSIONES */}
        {activeTab === 'versiones' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{doc.versiones.length} versiones</p>
              <button
                onClick={() => onAddVersion(doc.id, {
                  id: genId('v'), numero: doc.versiones.length + 1,
                  fecha: TODAY, autor: doc.responsable,
                  nota: 'Versión guardada', contenido: doc.contenido,
                })}
                className="text-[10px] text-[#2570ba] hover:text-[#1a2e4a] font-medium flex items-center gap-1 transition-colors">
                <Plus size={10} /> Guardar
              </button>
            </div>
            <div className="space-y-2">
              {[...doc.versiones].reverse().map((v, i) => (
                <div key={v.id} className={`p-2.5 rounded-xl border ${i === 0 ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[11px] font-semibold ${i === 0 ? 'text-[#2570ba]' : 'text-gray-600'}`}>v{v.numero}</span>
                    <Avatar code={v.autor} />
                  </div>
                  <p className="text-[10px] text-gray-400">{formatFecha(v.fecha)}</p>
                  {v.nota && <p className="text-[11px] text-gray-600 mt-1 leading-snug">{v.nota}</p>}
                  {i !== 0 && (
                    <button onClick={() => onUpdate(doc.id, { contenido: v.contenido })}
                      className="text-[10px] text-gray-400 hover:text-[#2570ba] mt-1 transition-colors">
                      Restaurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMENTARIOS */}
        {activeTab === 'comentarios' && (
          <div>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-3">Comentarios internos</p>
            {doc.comentarios.length === 0 && (
              <p className="text-[11px] text-gray-300 italic mb-4">Sin comentarios todavía</p>
            )}
            <div className="space-y-3 mb-4">
              {doc.comentarios.map(c => (
                <div key={c.id} className="flex gap-2">
                  <Avatar code={c.autor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[11px] font-medium text-gray-700">{RESPONSABLE_INFO[c.autor]?.nombre}</span>
                      <span className="text-[9px] text-gray-300">{c.hora} · {formatFechaCorta(c.fecha)}</span>
                    </div>
                    <p className="text-[12px] text-gray-600 leading-relaxed">{c.texto}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <select value={autorComentario} onChange={e => setAutorComentario(e.target.value)}
                className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 outline-none w-full">
                {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
              <textarea value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} rows={2}
                placeholder="Escribe un comentario..."
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-[12px] outline-none text-gray-700 placeholder-gray-300 resize-none focus:border-gray-300"
                onKeyDown={e => e.key === 'Enter' && e.metaKey && handleAddComentario()} />
              <button onClick={handleAddComentario}
                className="w-full text-[11px] bg-[#1a2e4a] text-white py-1.5 rounded-lg font-medium hover:bg-[#243d61] transition-colors">
                Comentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Detail / Editor View ──────────────────────────────────────────────────────
function DetailView({ doc, onBack, onUpdate, onAddComentario, onAddVersion, onToggleFav, reuniones, tareas, audiencias }) {
  const [metaTab,    setMetaTab]    = useState('info')
  const [editNombre, setEditNombre] = useState(false)
  const [nombre,     setNombre]     = useState(doc.nombre)
  const [contenido,  setContenido]  = useState(doc.contenido)
  const [dirty,      setDirty]      = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    setNombre(doc.nombre)
    setContenido(doc.contenido)
    setDirty(false)
  }, [doc.id])

  useEffect(() => {
    if (!dirty) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onUpdate(doc.id, { contenido, nombre })
      setDirty(false)
    }, 1500)
    return () => clearTimeout(saveTimer.current)
  }, [contenido, nombre, dirty])

  function handleNombreBlur() {
    setEditNombre(false)
    if (nombre.trim() !== doc.nombre) onUpdate(doc.id, { nombre: nombre.trim() })
  }

  const meta = TIPO_META[doc.tipo] || TIPO_META['Otro']

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 bg-white">
        <button onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
          <ChevronLeft size={14} strokeWidth={2} /> Documentos
        </button>
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
          <DocTypeIcon tipo={doc.tipo} size={13} />
        </div>
        {editNombre ? (
          <input value={nombre} onChange={e => { setNombre(e.target.value); setDirty(true) }}
            onBlur={handleNombreBlur} onKeyDown={e => e.key === 'Enter' && handleNombreBlur()}
            className="flex-1 text-[14px] font-semibold text-gray-900 outline-none border-b border-[#2570ba] bg-transparent" autoFocus />
        ) : (
          <h1 onClick={() => setEditNombre(true)}
            className="flex-1 text-[14px] font-semibold text-gray-900 truncate cursor-text hover:text-[#1a2e4a] transition-colors">
            {doc.nombre}
          </h1>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] transition-opacity ${dirty ? 'text-amber-400 animate-pulse' : 'text-gray-200'}`}>
            {dirty ? 'Guardando...' : 'Guardado ✓'}
          </span>
          <button onClick={() => onToggleFav(doc.id)}
            className={`transition-colors ${doc.favorito ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}>
            {doc.favorito ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
          </button>
          <EstadoBadge estado={doc.estado} onClick={() => {
            const keys = Object.keys(ESTADO_STYLES)
            onUpdate(doc.id, { estado: keys[(keys.indexOf(doc.estado) + 1) % keys.length] })
          }} />
        </div>
      </div>

      {/* Body: editor + metadata */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex-shrink-0 flex items-center gap-0.5 px-5 py-1.5 border-b border-gray-100 bg-gray-50/50">
            {[['B','bold'],['I','italic'],['U','underline']].map(([label]) => (
              <button key={label} className="w-6 h-6 flex items-center justify-center text-[11px] text-gray-500 hover:bg-gray-200 rounded font-medium transition-colors">{label}</button>
            ))}
            <div className="w-px h-3.5 bg-gray-200 mx-1" />
            {['H1','H2'].map(h => (
              <button key={h} className="px-1.5 h-6 text-[10px] text-gray-400 hover:bg-gray-200 rounded font-bold transition-colors">{h}</button>
            ))}
            <div className="w-px h-3.5 bg-gray-200 mx-1" />
            {[['≡','Lista'],['1.','Lista num.'],['□','Checklist']].map(([icon, title]) => (
              <button key={title} title={title} className="w-6 h-6 flex items-center justify-center text-[12px] text-gray-500 hover:bg-gray-200 rounded transition-colors">{icon}</button>
            ))}
            <div className="w-px h-3.5 bg-gray-200 mx-1" />
            <button title="Citar" className="w-6 h-6 flex items-center justify-center text-[13px] text-gray-500 hover:bg-gray-200 rounded transition-colors">"</button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[10px] text-gray-300">{contenido.length} chars</span>
              <button className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
                <Copy size={10} /> Duplicar
              </button>
            </div>
          </div>

          {/* Document area */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-2xl mx-auto px-16 py-8">
              {doc.etiquetas.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-5">
                  {doc.etiquetas.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500 font-medium">
                      <Tag size={8} /> {t}
                    </span>
                  ))}
                </div>
              )}
              {(doc.cliente || doc.causa_rit) && (
                <p className="text-[11px] text-gray-400 mb-6">
                  {doc.causa_rit && <span className="font-mono font-semibold text-[#2570ba] mr-2">{doc.causa_rit}</span>}
                  {doc.cliente && <span>{doc.cliente}</span>}
                  {doc.tribunal && <span className="ml-2 text-gray-300">· {doc.tribunal}</span>}
                </p>
              )}
              <textarea
                value={contenido}
                onChange={e => { setContenido(e.target.value); setDirty(true) }}
                placeholder="Empieza a redactar el documento..."
                className="w-full min-h-[520px] text-[13.5px] text-gray-800 leading-[1.85] outline-none resize-none placeholder-gray-200 bg-transparent"
                style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
              />
            </div>
          </div>
        </div>

        {/* Metadata panel */}
        <MetadataPanel
          doc={doc}
          activeTab={metaTab}
          onTabChange={setMetaTab}
          onUpdate={onUpdate}
          onAddComentario={onAddComentario}
          onAddVersion={onAddVersion}
          reuniones={reuniones}
          tareas={tareas}
          audiencias={audiencias}
        />
      </div>
    </div>
  )
}

// ── Modal crear documento ─────────────────────────────────────────────────────
function ModalCrearDoc({ plantilla, onSave, onClose }) {
  const [nombre,      setNombre]      = useState(plantilla ? `${plantilla.nombre} — borrador` : '')
  const [tipo,        setTipo]        = useState(plantilla?.tipo || 'Escrito judicial')
  const [categoria,   setCategoria]   = useState(() => deriveCategoria({ tipo: plantilla?.tipo || 'Escrito judicial', etiquetas: [], contenido: '' }))
  const [responsable, setResponsable] = useState('MT')
  const [cliente,     setCliente]     = useState('')
  const [causaRit,    setCausaRit]    = useState('')
  const [contenido,   setContenido]   = useState(plantilla?.contenido || '')

  function handleSave() {
    if (!nombre.trim()) return
    onSave({
      id: genId('doc'),
      nombre: nombre.trim(), tipo, categoria, responsable, cliente,
      causa_rit: causaRit, causa_ruc: '', tribunal: '',
      fecha_creacion: TODAY, fecha_modificacion: TODAY,
      estado: 'borrador', etiquetas: [], favorito: false, contenido,
      versiones: [{ id: genId('v'), numero: 1, fecha: TODAY, autor: responsable, nota: 'Versión inicial', contenido }],
      comentarios: [],
      relaciones: { reunion_ids: [], tarea_ids: [], audiencia_ids: [] },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {plantilla ? `Usar plantilla: ${plantilla.nombre}` : 'Nuevo documento'}
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Nombre del documento</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
              placeholder="Ej: Escrito de contestación demanda laboral"
              className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-gray-300 text-gray-900 placeholder-gray-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none bg-white text-gray-700 focus:border-gray-300">
                {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Categoría</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none bg-white text-gray-700 focus:border-gray-300">
                {CATEGORIAS.map(c => <option key={c.id}>{c.id}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Responsable</label>
              <select value={responsable} onChange={e => setResponsable(e.target.value)}
                className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none bg-white text-gray-700 focus:border-gray-300">
                {Object.entries(RESPONSABLE_INFO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">RIT / Causa</label>
              <input value={causaRit} onChange={e => setCausaRit(e.target.value)} placeholder="Ej: O-234-2025"
                className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none text-gray-700 placeholder-gray-300 focus:border-gray-300" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Cliente</label>
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del cliente"
              className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none text-gray-700 placeholder-gray-300 focus:border-gray-300" />
          </div>
          {plantilla && (
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Contenido desde plantilla</label>
              <textarea value={contenido} onChange={e => setContenido(e.target.value)} rows={7}
                className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-[11px] outline-none text-gray-700 resize-none font-mono leading-relaxed focus:border-gray-300" />
              <p className="text-[10px] text-gray-300 mt-1">Reemplaza {`{{CLIENTE}}`}, {`{{RIT}}`}, etc. con los datos reales.</p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onClose} className="text-[12px] text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!nombre.trim()}
            className="text-[12px] bg-[#1a2e4a] text-white px-4 py-1.5 rounded-lg font-medium hover:bg-[#243d61] disabled:opacity-40 transition-colors">
            Crear documento
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Documentos() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const [view,              setView]              = useState('all')
  const [selectedId,        setSelectedId]        = useState(null)
  const [selectedCliente,   setSelectedCliente]   = useState(null)
  const [selectedCausa,     setSelectedCausa]     = useState(null)
  const [selectedCategoria, setSelectedCategoria] = useState(null)
  const [selectedEstado,    setSelectedEstado]    = useState(null)
  const [sortBy,            setSortBy]            = useState('fecha_modificacion')
  const [sortDir,           setSortDir]           = useState('desc')
  const [showModal,         setShowModal]         = useState(false)
  const [plantillaActiva,   setPlantilla]         = useState(null)

  useEffect(() => {
    async function fetchDocs() {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) { setError(error.message); setLoading(false); return }
      setRows((data || []).map(mapRow))
      setLoading(false)
    }
    fetchDocs()
  }, [])

  const docs     = rows
  const selected = docs.find(d => d.id === selectedId)

  // Columns that always exist in the documentos table
  // Extended columns (tipo, estado, etc.) are added via supabase_schema_additions.sql
  const DOC_ALWAYS_COLS = new Set(['nombre','cliente_nombre','causa_rit','categoria','url','notas','causa_id','cliente_id'])
  const DOC_EXTENDED_COLS = new Set([
    'tipo','estado','responsable','favorito','contenido','etiquetas',
    'versiones','comentarios','relaciones','fecha_creacion','fecha_modificacion',
    'causa_ruc','tribunal','cliente',
  ])

  function filterDocPayload(obj) {
    // Keep base columns + any extended column that won't fail (we try all, Supabase ignores unknown in insert)
    return Object.fromEntries(Object.entries(obj).filter(([k]) =>
      DOC_ALWAYS_COLS.has(k) || DOC_EXTENDED_COLS.has(k)
    ))
  }

  async function addDocumento(nuevo) {
    setRows(prev => [nuevo, ...prev])
    setSelectedId(nuevo.id)
    const payload = filterDocPayload({
      id: nuevo.id, nombre: nuevo.nombre, tipo: nuevo.tipo,
      categoria: nuevo.categoria, responsable: nuevo.responsable,
      cliente: nuevo.cliente, cliente_nombre: nuevo.cliente,
      causa_rit: nuevo.causa_rit, causa_ruc: nuevo.causa_ruc,
      tribunal: nuevo.tribunal, fecha_creacion: nuevo.fecha_creacion,
      fecha_modificacion: nuevo.fecha_modificacion, estado: nuevo.estado,
      etiquetas: nuevo.etiquetas, favorito: nuevo.favorito, contenido: nuevo.contenido,
      versiones: nuevo.versiones, comentarios: nuevo.comentarios, relaciones: nuevo.relaciones,
    })
    const { error } = await supabase.from('documentos').insert([payload])
    if (error) console.error('Error al crear documento:', error.message)
  }

  async function updateDocumento(id, cambios) {
    const hoy = new Date().toISOString().slice(0, 10)
    const full = { ...cambios, fecha_modificacion: hoy }
    setRows(prev => prev.map(d => d.id === id ? { ...d, ...full } : d))
    const payload = filterDocPayload(full)
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('documentos').update(payload).eq('id', id)
      if (error) console.error('Error al actualizar documento:', error.message)
    }
  }

  async function addVersionDocumento(docId, version) {
    const doc = rows.find(d => d.id === docId)
    if (!doc) return
    const hoy = new Date().toISOString().slice(0, 10)
    const newVersiones = [...doc.versiones, version]
    setRows(prev => prev.map(d =>
      d.id === docId ? { ...d, versiones: newVersiones, fecha_modificacion: hoy } : d
    ))
    const payload = filterDocPayload({ versiones: newVersiones, fecha_modificacion: hoy })
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('documentos').update(payload).eq('id', docId)
      if (error) console.error('Error al guardar versión:', error.message)
    }
  }

  async function addComentarioDocumento(docId, comentario) {
    const doc = rows.find(d => d.id === docId)
    if (!doc) return
    const newComentarios = [...doc.comentarios, comentario]
    setRows(prev => prev.map(d =>
      d.id === docId ? { ...d, comentarios: newComentarios } : d
    ))
    const payload = filterDocPayload({ comentarios: newComentarios })
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('documentos').update(payload).eq('id', docId)
      if (error) console.error('Error al guardar comentario:', error.message)
    }
  }

  async function toggleFavoritoDocumento(docId) {
    const doc = rows.find(d => d.id === docId)
    if (!doc) return
    const newFav = !doc.favorito
    setRows(prev => prev.map(d => d.id === docId ? { ...d, favorito: newFav } : d))
    const payload = filterDocPayload({ favorito: newFav })
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('documentos').update(payload).eq('id', docId)
      if (error) console.error('Error al actualizar favorito:', error.message)
    }
  }

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-[13px] text-gray-400">
      Cargando documentos…
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-full text-[13px] text-red-400">
      Error: {error}
    </div>
  )

  if (selected) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <DetailView
          doc={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={updateDocumento}
          onAddComentario={addComentarioDocumento}
          onAddVersion={addVersionDocumento}
          onToggleFav={toggleFavoritoDocumento}
          reuniones={[]}
          tareas={[]}
          audiencias={[]}
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {(showModal || plantillaActiva) && (
        <ModalCrearDoc
          plantilla={plantillaActiva}
          onSave={addDocumento}
          onClose={() => { setShowModal(false); setPlantilla(null) }}
        />
      )}

      {/* Page header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900">Documentos</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Centro documental jurídico del estudio</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1a2e4a] text-white text-[12px] font-medium rounded-lg hover:bg-[#243d61] transition-colors">
          <Plus size={13} /> Nuevo documento
        </button>
      </div>

      {/* Sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          docs={docs}
          activeView={view}
          onView={setView}
          selectedCliente={selectedCliente}
          onCliente={setSelectedCliente}
          selectedCausa={selectedCausa}
          onCausa={setSelectedCausa}
          selectedCategoria={selectedCategoria}
          onCategoria={setSelectedCategoria}
          selectedEstado={selectedEstado}
          onEstado={setSelectedEstado}
        />

        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'plantillas' ? (
            <TemplatesView onUseTemplate={tmpl => setPlantilla(tmpl)} />
          ) : (
            <MainContent
              docs={docs}
              view={view}
              selectedCliente={selectedCliente}
              selectedCausa={selectedCausa}
              selectedCategoria={selectedCategoria}
              selectedEstado={selectedEstado}
              onView={setView}
              onCliente={setSelectedCliente}
              onCausa={setSelectedCausa}
              onCategoria={setSelectedCategoria}
              onEstado={setSelectedEstado}
              onSelect={id => setSelectedId(id)}
              onToggleFav={toggleFavoritoDocumento}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}
        </div>
      </div>
    </div>
  )
}
