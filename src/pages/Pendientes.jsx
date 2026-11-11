import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Plus, X, Pencil, ExternalLink, FileText,
  ChevronDown, Check,
} from 'lucide-react'

const TIPOS = ['Escrito', 'Revisión', 'Gestión', 'Envío', 'Otro']
const ASIGNADAS = ['MT', 'AB']

const CHIP_TIPO = {
  Escrito:  'bg-blue-50 text-blue-700',
  Revisión: 'bg-violet-50 text-violet-700',
  Gestión:  'bg-teal-50 text-teal-700',
  Envío:    'bg-amber-50 text-amber-800',
  Otro:     'bg-gray-100 text-gray-600',
}
const CHIP_ASIG = {
  MT: 'bg-orange-50 text-orange-700',
  AB: 'bg-purple-50 text-purple-700',
}

function today() { return new Date().toISOString().slice(0, 10) }
function sunday() {
  const d = new Date()
  const diff = 7 - d.getDay() // getDay() 0=sun, so wrap: if sun stay sun
  if (d.getDay() === 0) return d.toISOString().slice(0, 10)
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}
function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function driveName(url) {
  if (!url) return 'Ver en Drive'
  try {
    const parts = new URL(url).pathname.split('/')
    const last = parts[parts.length - 1] || parts[parts.length - 2]
    return decodeURIComponent(last) || 'Ver en Drive'
  } catch { return 'Ver en Drive' }
}

// ── Autocomplete causas ───────────────────────────────────────────────────────
function BuscadorCausas({ value, onChange, onSelect, locked }) {
  const [q, setQ] = useState(value?.label || '')
  const [resultados, setResultados] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (locked) return
    if (q.trim().length < 2) { setResultados([]); setOpen(false); return }
    const s = q.trim()
    supabase.from('causas').select('id, rit, ruc, cliente_nombre, cliente_id')
      .or(`rit.ilike.%${s}%,ruc.ilike.%${s}%,cliente_nombre.ilike.%${s}%`)
      .limit(8)
      .then(({ data }) => { setResultados(data || []); setOpen((data || []).length > 0) })
  }, [q, locked])

  if (locked && value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
        <span className="font-mono font-semibold text-violet-700">{value.rit || value.ruc}</span>
        <span className="text-gray-500">{value.cliente_nombre}</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={value ? (value.rit || value.ruc || '') + (value.cliente_nombre ? ' · ' + value.cliente_nombre : '') : q}
        onChange={e => { setQ(e.target.value); if (value) { onChange(null); setQ(e.target.value) } }}
        onFocus={() => { if (resultados.length) setOpen(true) }}
        placeholder="Buscar por RIT, RUC o cliente…"
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] placeholder:text-gray-300"
      />
      {value && (
        <button onClick={() => { onChange(null); setQ('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
          <X size={11}/>
        </button>
      )}
      {open && resultados.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {resultados.map(c => (
            <button key={c.id}
              onClick={() => { onSelect(c); setQ(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg">
              <span className="font-mono font-semibold text-violet-700">{c.rit || c.ruc}</span>
              {c.cliente_nombre && <span className="text-gray-500 ml-2">{c.cliente_nombre}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal nuevo / editar ──────────────────────────────────────────────────────
function ModalPendiente({ initial, causaFija, onSave, onClose }) {
  const [form, setForm] = useState({
    descripcion: initial?.descripcion || '',
    tipo:        initial?.tipo        || 'Gestión',
    asignada:    initial?.asignada    || 'MT',
    fecha_limite: initial?.fecha_limite || '',
    drive_url:   initial?.drive_url   || '',
    causa:       initial?._causa      || causaFija || null,
  })
  const [guardando, setGuardando] = useState(false)
  const descRef = useRef(null)
  useEffect(() => { descRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.descripcion.trim()) return
    setGuardando(true)
    await onSave({
      descripcion:  form.descripcion.trim(),
      tipo:         form.tipo,
      asignada:     form.asignada,
      fecha_limite: form.fecha_limite || null,
      drive_url:    form.drive_url.trim() || null,
      causa_id:     form.causa?.id || null,
    })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">{initial ? 'Editar pendiente' : 'Nuevo pendiente'}</p>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={15}/></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Descripción *</label>
            <textarea ref={descRef} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={3} placeholder="¿Qué hay que hacer?"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] bg-white">
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Asignada a *</label>
              <div className="flex gap-2">
                {ASIGNADAS.map(a => (
                  <button key={a} type="button"
                    onClick={() => setForm(f => ({ ...f, asignada: a }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      form.asignada === a
                        ? a === 'MT' ? 'bg-orange-500 text-white border-orange-500' : 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Causa vinculada</label>
            {causaFija ? (
              <BuscadorCausas value={form.causa} locked={true} onChange={() => {}} onSelect={() => {}} />
            ) : (
              <BuscadorCausas
                value={form.causa}
                onChange={v => setForm(f => ({ ...f, causa: v }))}
                onSelect={c => setForm(f => ({ ...f, causa: c }))}
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Link de Drive</label>
            <input value={form.drive_url} onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))}
              placeholder="https://docs.google.com/…"
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba]" />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Fecha límite</label>
            <input type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#2570ba] bg-white" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!form.descripcion.trim() || guardando}
              className="flex-1 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#2570BA' }}>
              {guardando ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear pendiente'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────
function TarjetaPendiente({ p, onToggle, onEdit, showCausa, onCausaClick }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border border-gray-100 rounded-xl bg-white transition-opacity ${p.listo ? 'opacity-50' : ''}`}>
      {/* Checkbox */}
      <button onClick={() => onToggle(p)}
        className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
          p.listo ? 'bg-[#1E9E6A] border-[#1E9E6A]' : 'border-gray-300 hover:border-[#2570BA]'
        }`}>
        {p.listo && <Check size={10} className="text-white" strokeWidth={3}/>}
      </button>

      <div className="flex-1 min-w-0">
        {/* Descripción */}
        <p className={`text-xs text-gray-800 leading-relaxed ${p.listo ? 'line-through text-gray-400' : ''}`}>
          {p.descripcion}
        </p>

        {/* Chips + links */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${CHIP_TIPO[p.tipo] || 'bg-gray-100 text-gray-600'}`}>
            {p.tipo}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${CHIP_ASIG[p.asignada] || 'bg-gray-100 text-gray-600'}`}>
            {p.asignada}
          </span>
          {showCausa && p._causa && (
            <button onClick={() => onCausaClick(p._causa)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors">
              {p._causa.rit || p._causa.ruc}
              {p._causa.cliente_nombre && <span className="text-violet-500">· {p._causa.cliente_nombre}</span>}
            </button>
          )}
          {p.drive_url && (
            <a href={p.drive_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
              <FileText size={9}/>
              {driveName(p.drive_url)}
              <ExternalLink size={8}/>
            </a>
          )}
          {p.fecha_limite && (
            <span className={`text-[10px] ${p.fecha_limite < today() && !p.listo ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {p.fecha_limite.split('-').reverse().join('-')}
            </span>
          )}
        </div>
      </div>

      {/* Editar */}
      <button onClick={() => onEdit(p)} className="text-gray-300 hover:text-gray-500 mt-0.5 flex-shrink-0">
        <Pencil size={12}/>
      </button>
    </div>
  )
}

// ── Sección con título ────────────────────────────────────────────────────────
function Seccion({ titulo, items, onToggle, onEdit, showCausa, onCausaClick }) {
  if (!items.length) return null
  const [listos, noListos] = [items.filter(p => p.listo), items.filter(p => !p.listo)]
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{titulo}</p>
      <div className="space-y-2">
        {noListos.map(p => <TarjetaPendiente key={p.id} p={p} onToggle={onToggle} onEdit={onEdit} showCausa={showCausa} onCausaClick={onCausaClick}/>)}
        {listos.map(p => <TarjetaPendiente key={p.id} p={p} onToggle={onToggle} onEdit={onEdit} showCausa={showCausa} onCausaClick={onCausaClick}/>)}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Pendientes({ causaId: causaIdProp, causaFija, mostrarEncabezado = true }) {
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuevo' | pendiente (editar)

  // Filtros
  const [filtroAsig, setFiltroAsig] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('Todos')

  // Cargar
  useEffect(() => {
    setCargando(true)
    let q = supabase.from('pendientes')
      .select('*, causas(id, rit, ruc, cliente_nombre, cliente_id)')
      .order('created_at', { ascending: true })
    if (causaIdProp) q = q.eq('causa_id', causaIdProp)
    q.then(({ data, error }) => {
      if (!error && data) {
        setPendientes(data.map(p => ({ ...p, _causa: p.causas || null })))
      }
      setCargando(false)
    })
  }, [causaIdProp])

  // Guardar nuevo
  async function handleSave(payload) {
    if (causaIdProp && !payload.causa_id) payload.causa_id = causaIdProp
    if (modal === 'nuevo') {
      const { data, error } = await supabase.from('pendientes').insert([payload]).select('*, causas(id, rit, ruc, cliente_nombre, cliente_id)').single()
      if (!error && data) setPendientes(prev => [...prev, { ...data, _causa: data.causas || null }])
    } else {
      const { data, error } = await supabase.from('pendientes').update(payload).eq('id', modal.id).select('*, causas(id, rit, ruc, cliente_nombre, cliente_id)').single()
      if (!error && data) setPendientes(prev => prev.map(p => p.id === modal.id ? { ...data, _causa: data.causas || null } : p))
    }
    setModal(null)
  }

  // Toggle listo
  async function handleToggle(p) {
    const listo = !p.listo
    setPendientes(prev => prev.map(x => x.id === p.id ? { ...x, listo } : x))
    await supabase.from('pendientes').update({ listo }).eq('id', p.id)
  }

  function handleCausaClick(causa) {
    if (!causa?.cliente_id) return
    try { sessionStorage.setItem('ps.clientes', JSON.stringify({ selectedId: causa.cliente_id })) } catch {}
    navigate('/clientes')
  }

  // Filtrar
  const filtrados = useMemo(() => pendientes.filter(p => {
    if (filtroAsig !== 'Todos' && p.asignada !== filtroAsig) return false
    if (filtroTipo !== 'Todos' && p.tipo !== filtroTipo) return false
    return true
  }), [pendientes, filtroAsig, filtroTipo])

  // Agrupar
  const tod = today(), tmr = tomorrow(), sun = sunday()
  const hoy        = filtrados.filter(p => p.fecha_limite === tod)
  const semana     = filtrados.filter(p => p.fecha_limite && p.fecha_limite >= tmr && p.fecha_limite <= sun)
  const sinFecha   = filtrados.filter(p => !p.fecha_limite)
  const conFecha   = filtrados.filter(p => p.fecha_limite && (p.fecha_limite < tod || p.fecha_limite > sun))

  const total = filtrados.filter(p => !p.listo).length

  if (cargando && mostrarEncabezado) return <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Cargando…</div>

  const contenido = (
    <>
      {hoy.length > 0     && <Seccion titulo="Hoy"          items={hoy}      onToggle={handleToggle} onEdit={p => setModal(p)} showCausa={!causaIdProp} onCausaClick={handleCausaClick}/>}
      {semana.length > 0  && <Seccion titulo="Esta semana"  items={semana}   onToggle={handleToggle} onEdit={p => setModal(p)} showCausa={!causaIdProp} onCausaClick={handleCausaClick}/>}
      {sinFecha.length > 0 && <Seccion titulo="Sin fecha"   items={sinFecha} onToggle={handleToggle} onEdit={p => setModal(p)} showCausa={!causaIdProp} onCausaClick={handleCausaClick}/>}
      {conFecha.length > 0 && <Seccion titulo="Otras fechas" items={conFecha} onToggle={handleToggle} onEdit={p => setModal(p)} showCausa={!causaIdProp} onCausaClick={handleCausaClick}/>}
      {filtrados.length === 0 && !cargando && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-gray-400">Sin pendientes{filtroAsig !== 'Todos' || filtroTipo !== 'Todos' ? ' con estos filtros' : ''}</p>
        </div>
      )}
    </>
  )

  // Vista embebida en causa
  if (!mostrarEncabezado) {
    return (
      <div className="space-y-1">
        <div className="flex justify-end mb-3">
          <button onClick={() => setModal('nuevo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#2570BA' }}>
            <Plus size={12}/> Agregar
          </button>
        </div>
        {contenido}
        {modal && (
          <ModalPendiente
            initial={modal === 'nuevo' ? null : { ...modal, _causa: modal._causa }}
            causaFija={causaFija}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    )
  }

  // Vista de página completa
  return (
    <div className="flex h-full">
      {/* Sidebar filtros */}
      <aside className="w-48 flex-shrink-0 border-r border-gray-100 bg-[#F5F6F8] p-4 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Asignada</p>
          {['Todos', 'MT', 'AB'].map(a => (
            <button key={a} onClick={() => setFiltroAsig(a)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors mb-0.5 ${
                filtroAsig === a ? 'bg-white text-[#1A2E4A] font-semibold shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {a}
            </button>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Tipo</p>
          {['Todos', ...TIPOS].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors mb-0.5 ${
                filtroTipo === t ? 'bg-white text-[#1A2E4A] font-semibold shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-[#1A2E4A]">Pendientes</h1>
            {total > 0 && (
              <span className="px-2 py-0.5 bg-[#2570BA] text-white text-[10px] font-semibold rounded-full">{total}</span>
            )}
          </div>
          <button onClick={() => setModal('nuevo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#2570BA' }}>
            <Plus size={12}/> Nuevo pendiente
          </button>
        </div>

        <div className="px-6 pt-5">
          {contenido}
        </div>
      </div>

      {modal && (
        <ModalPendiente
          initial={modal === 'nuevo' ? null : { ...modal, _causa: modal._causa }}
          causaFija={null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
