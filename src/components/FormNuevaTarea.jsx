import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Check, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { EQUIPO, EQUIPO_OPTS } from '../lib/equipo'

const TODAY = new Date().toISOString().split('T')[0]

// ── Constantes exportadas ─────────────────────────────────────────────────────
export const PRIORIDAD_STYLES = {
  'Alta':  { badge: 'bg-rose-50 text-rose-600',   dot: 'bg-rose-400',  border: 'border-l-rose-400'  },
  'Media': { badge: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400', border: 'border-l-amber-300' },
  'Baja':  { badge: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-300',  border: 'border-l-gray-200'  },
}

export const ESTADO_STYLES = {
  'Pendiente':              { badge: 'bg-gray-100 text-gray-500',        dot: 'bg-gray-400'     },
  'En progreso':            { badge: 'bg-blue-50 text-blue-600',         dot: 'bg-blue-400'     },
  'Esperando antecedentes': { badge: 'bg-orange-50 text-orange-600',     dot: 'bg-orange-400'   },
  'En revisión':            { badge: 'bg-amber-50 text-amber-700',       dot: 'bg-amber-400'    },
  'Bloqueada':              { badge: 'bg-rose-50 text-rose-600',         dot: 'bg-rose-500'     },
  'Lista para envío':       { badge: 'bg-indigo-50 text-indigo-600',     dot: 'bg-indigo-400'   },
  'Completada':             { badge: 'bg-emerald-50 text-emerald-600',   dot: 'bg-emerald-400'  },
  'Cancelada':              { badge: 'bg-gray-100 text-gray-400',        dot: 'bg-gray-300'     },
  'Vencida':                { badge: 'bg-red-50 text-red-600',           dot: 'bg-red-500'      },
}

export const CATEGORIA_STYLES = {
  'Escrito':             { badge: 'bg-indigo-50 text-indigo-600',  dot: 'bg-indigo-400' },
  'Audiencia':           { badge: 'bg-purple-50 text-purple-600',  dot: 'bg-purple-400' },
  'SIAU':                { badge: 'bg-teal-50 text-teal-600',      dot: 'bg-teal-400'   },
  'PJUD':                { badge: 'bg-blue-50 text-blue-600',      dot: 'bg-blue-400'   },
  'Reunión':             { badge: 'bg-violet-50 text-violet-600',  dot: 'bg-violet-400' },
  'Administrativo':      { badge: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400'  },
  'Cobranza':            { badge: 'bg-amber-50 text-amber-600',    dot: 'bg-amber-400'  },
  'Seguimiento cliente': { badge: 'bg-sky-50 text-sky-600',        dot: 'bg-sky-400'    },
  'Documento':           { badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400'   },
  'Otro':                { badge: 'bg-gray-50 text-gray-400',      dot: 'bg-gray-300'   },
}

export const MATERIA_CAUSA_COLORS = {
  'Familia': 'bg-rose-50 text-rose-500',
  'Penal':   'bg-red-50 text-red-600',
  'Civil':   'bg-sky-50 text-sky-600',
  'Laboral': 'bg-violet-50 text-violet-600',
  'Otro':    'bg-gray-100 text-gray-500',
}

export const ESTADO_OPTIONS    = ['Pendiente','En progreso','Esperando antecedentes','En revisión','Bloqueada','Lista para envío','Completada','Cancelada','Vencida']
export const PRIORIDAD_OPTIONS = ['Alta','Media','Baja']
export const RESPONSABLE_OPT   = EQUIPO_OPTS
export const CATEGORIA_OPTIONS = ['Escrito','Audiencia','SIAU','PJUD','Reunión','Administrativo','Cobranza','Seguimiento cliente','Documento','Otro']
export const ABOGADAS          = EQUIPO.map(({ iniciales, nombre, bg, text, dot }) => ({ key: iniciales, nombre, bg, text, dot }))

// ── DropdownSelect ────────────────────────────────────────────────────────────
export function DropdownSelect({ value, onChange, options, getStyle, label, compact = false }) {
  const [open, setOpen]     = useState(false)
  const [coords, setCoords] = useState({ top:0, left:0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = e => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleOpen = e => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 230))
      setCoords({ top: r.bottom + 4, left })
    }
    setOpen(p => !p)
  }

  const s = getStyle ? getStyle(value) : {}

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-80 select-none ${
          compact
            ? `text-[10px] font-medium px-2 py-0.5 rounded-full ${s.badge || 'bg-gray-100 text-gray-500'}`
            : `text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-100 hover:border-gray-200 text-gray-700 bg-white`
        }`}
      >
        {s.dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />}
        <span>{value || '—'}</span>
        <ChevronDown size={9} className="opacity-30 flex-shrink-0" />
      </button>
      {open && (
        <div ref={menuRef} className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top:coords.top, left:coords.left, minWidth:210 }}>
          <div className="px-3 pt-2 pb-1.5 border-b border-gray-50">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">{label}</p>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map(opt => {
              const os  = getStyle ? getStyle(opt) : {}
              const sel = value === opt
              return (
                <button key={opt}
                  onClick={e => { e.stopPropagation(); onChange(opt); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${sel ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}
                >
                  {os.dot && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${os.dot}`} />}
                  <span className={`text-xs flex-1 ${sel ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{opt}</span>
                  {sel && <Check size={11} className="text-emerald-500 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ClienteSelect ─────────────────────────────────────────────────────────────
export function ClienteSelect({ value, onChange, clientesLista = [], locked = false }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState({ top:0, left:0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)
  const inputRef= useRef(null)

  const filtered = clientesLista.filter(c => c.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const close = e => {
      if (btnRef.current  && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const handleOpen = e => {
    e.stopPropagation()
    if (locked) return
    if (!open && btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 290))
      setCoords({ top: r.bottom + 4, left })
    }
    setOpen(p => !p)
    setSearch('')
  }

  const select = cliente => { onChange(cliente); setOpen(false); setSearch('') }
  const clear  = e => { e.stopPropagation(); onChange('') }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 text-xs border rounded-xl px-3 py-2 transition-all ${
          locked
            ? 'border-gray-100 text-gray-700 bg-gray-50/60 cursor-default'
            : value
              ? 'border-gray-200 text-gray-800 bg-white hover:border-gray-300'
              : 'border-gray-100 text-gray-400 bg-gray-50/50 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value ? (
            <>
              <span className="w-5 h-5 rounded-full bg-[#1a2e4a]/8 text-[#1a2e4a] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {value[0]}
              </span>
              <span className="truncate font-medium">{value}</span>
            </>
          ) : (
            <span className="text-gray-400">Seleccionar cliente...</span>
          )}
        </div>
        {!locked && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span onClick={clear} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded">
                <X size={11} />
              </span>
            )}
            <ChevronDown size={10} className="text-gray-300" />
          </div>
        )}
      </button>

      {open && !locked && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top: coords.top, left: coords.left, minWidth: 280 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pt-2 pb-2 border-b border-gray-50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-7 pr-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50/60 border border-gray-100 rounded-lg focus:outline-none focus:border-blue-200"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">Sin resultados</p>
            ) : filtered.map(c => (
              <button
                key={c}
                onClick={() => select(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${value === c ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}
              >
                <span className="w-6 h-6 rounded-full bg-[#1a2e4a]/8 text-[#1a2e4a] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {c[0]}
                </span>
                <span className={`text-xs flex-1 ${value === c ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{c}</span>
                {value === c && <Check size={11} className="text-emerald-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CausaSelect ───────────────────────────────────────────────────────────────
export function CausaSelect({ ritValue, onChange, clienteSeleccionado, allCausas = [], locked = false }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState({ top:0, left:0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)
  const inputRef= useRef(null)

  const disabled = !clienteSeleccionado
  const causas   = allCausas.filter(c => c.cliente_nombre === clienteSeleccionado)
  const filtered = causas.filter(c =>
    (c.rit || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.materia || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.tribunal || '').toLowerCase().includes(search.toLowerCase())
  )
  const selected = causas.find(c => c.rit === ritValue)

  useEffect(() => {
    const close = e => {
      if (btnRef.current  && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const handleOpen = e => {
    e.stopPropagation()
    if (disabled || locked) return
    if (!open && btnRef.current) {
      const r    = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 310))
      setCoords({ top: r.bottom + 4, left })
    }
    setOpen(p => !p)
    setSearch('')
  }

  const select = causa => {
    onChange(causa.rit, causa.id, causa.cliente_id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 text-xs border rounded-xl px-3 py-2 transition-all ${
          locked
            ? 'border-gray-100 text-gray-700 bg-gray-50/60 cursor-default'
            : disabled
              ? 'border-gray-100 text-gray-300 bg-gray-50/30 cursor-not-allowed'
              : ritValue
                ? 'border-gray-200 text-gray-800 bg-white hover:border-gray-300'
                : 'border-gray-100 text-gray-400 bg-gray-50/50 hover:border-gray-300 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {disabled && !locked && <span className="text-[10px] text-gray-300 italic">Selecciona un cliente primero</span>}
          {!disabled && !ritValue && <span className="text-gray-400">Seleccionar causa...</span>}
          {ritValue && selected && (
            <>
              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{selected.rit}</span>
              {selected.materia && (
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${MATERIA_CAUSA_COLORS[selected.materia] || 'bg-gray-100 text-gray-400'}`}>
                  {selected.materia}
                </span>
              )}
            </>
          )}
          {ritValue && !selected && (
            <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{ritValue}</span>
          )}
        </div>
        {!disabled && !locked && <ChevronDown size={10} className="text-gray-300 flex-shrink-0" />}
      </button>

      {open && !disabled && !locked && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top: coords.top, left: coords.left, minWidth: 310 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pt-2 pb-2 border-b border-gray-50">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">
              Causas · {clienteSeleccionado.split(' ')[0]}
            </p>
            {causas.length > 2 && (
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar RIT, materia..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50/60 border border-gray-100 rounded-lg focus:outline-none"
                />
              </div>
            )}
          </div>
          <div className="py-1 max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-4">Sin causas para este cliente</p>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => select(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${ritValue === c.rit ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">{c.rit}</span>
                    {c.materia && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${MATERIA_CAUSA_COLORS[c.materia] || 'bg-gray-100 text-gray-400'}`}>
                        {c.materia}
                      </span>
                    )}
                  </div>
                  {c.tribunal && (
                    <span className="text-[10px] text-gray-400 truncate block">{c.tribunal}</span>
                  )}
                </div>
                {ritValue === c.rit && <Check size={11} className="text-emerald-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FormNuevaTarea (panel, para usar en Tareas.jsx) ───────────────────────────
// initialValues: { cliente_id, cliente_nombre, causa_id, causa_rit }
export default function FormNuevaTarea({ onClose, onSave, clientesLista = [], allCausas = [], initialValues = {} }) {
  const [saving, setSaving] = useState(false)
  const clienteLocked = !!initialValues.cliente_id
  const causaLocked   = !!initialValues.causa_id

  const [tareaGeneral, setTareaGeneral] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    cliente_nombre: initialValues.cliente_nombre || '',
    causa_rit:      initialValues.causa_rit      || '',
    causa_id:       initialValues.causa_id       || null,
    cliente_id:     initialValues.cliente_id     || null,
    categoria: 'Escrito', prioridad: 'Media',
    fecha_vencimiento: TODAY, responsable: 'MT',
    estado: 'Pendiente', notas: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const canSave = form.titulo.trim() && (tareaGeneral || causaLocked || !!form.causa_id)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const payload = tareaGeneral
      ? { ...form, causa_id: null, causa_rit: '', cliente_nombre: '', cliente_id: null }
      : form
    onSave(payload)
  }

  const saveRef = useRef(null)
  saveRef.current = handleSave
  const canSaveRef = useRef(false)
  canSaveRef.current = canSave
  useEffect(() => {
    const fn = () => { if (canSaveRef.current) saveRef.current?.() }
    window.addEventListener('global:save', fn)
    return () => window.removeEventListener('global:save', fn)
  }, [])

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-[#1a2e4a]/20" />
          <h2 className="text-sm font-bold text-[#1a2e4a]">Nueva tarea</h2>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded-lg hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <FormFields
          form={form} f={f}
          clientesLista={clientesLista} allCausas={allCausas}
          clienteLocked={clienteLocked} causaLocked={causaLocked}
          tareaGeneral={tareaGeneral} setTareaGeneral={setTareaGeneral}
          canSave={canSave}
        />
      </div>

      <div className="border-t border-gray-100 px-6 py-3.5 flex gap-2 flex-shrink-0 bg-gray-50/30">
        <button onClick={onClose} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-2.5 rounded-xl hover:bg-gray-100 transition-colors font-medium">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex-1 text-xs bg-[#2570BA] text-white py-2.5 rounded-xl hover:bg-[#2570BA]/90 transition-colors font-semibold disabled:opacity-40 shadow-sm shadow-[#1a2e4a]/20"
        >
          {saving ? 'Guardando...' : 'Crear tarea'}
        </button>
      </div>
    </div>
  )
}

// ── FormFields (contenido del formulario, reutilizable) ───────────────────────
function FormFields({ form, f, clientesLista, allCausas, clienteLocked, causaLocked, tareaGeneral, setTareaGeneral, canSave }) {
  return (
    <>
      <div>
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Título *</p>
        <input
          type="text"
          value={form.titulo}
          onChange={e => f('titulo', e.target.value)}
          autoFocus
          placeholder="¿Qué hay que hacer?"
          className="w-full text-sm text-gray-800 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/50 font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Categoría</p>
          <DropdownSelect value={form.categoria} onChange={v=>f('categoria',v)} options={CATEGORIA_OPTIONS}
            getStyle={v=>CATEGORIA_STYLES[v]||{}} label="Categoría" compact />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Prioridad</p>
          <DropdownSelect value={form.prioridad} onChange={v=>f('prioridad',v)} options={PRIORIDAD_OPTIONS}
            getStyle={v=>PRIORIDAD_STYLES[v]||{}} label="Prioridad" compact />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Responsable</p>
          <DropdownSelect value={form.responsable} onChange={v=>f('responsable',v)} options={RESPONSABLE_OPT}
            getStyle={v=>{ const a=ABOGADAS.find(ab=>ab.key===v); return a?{badge:`${a.bg} ${a.text}`,dot:a.dot}:{} }}
            label="Responsable" compact />
        </div>
        <div>
          <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Estado</p>
          <DropdownSelect value={form.estado} onChange={v=>f('estado',v)} options={ESTADO_OPTIONS}
            getStyle={v=>ESTADO_STYLES[v]||{}} label="Estado" compact />
        </div>
      </div>

      <div>
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Fecha límite</p>
        <input type="date" value={form.fecha_vencimiento} onChange={e=>f('fecha_vencimiento',e.target.value)}
          className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-200 bg-gray-50/50" />
      </div>

      <div>
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Cliente</p>
        <ClienteSelect
          value={form.cliente_nombre}
          clientesLista={clientesLista}
          locked={clienteLocked}
          onChange={nuevoCliente => {
            f('cliente_nombre', nuevoCliente)
            if (!clienteLocked) {
              f('causa_rit', '')
              f('causa_id', null)
            }
          }}
        />
      </div>

      <div>
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Causa asociada {!causaLocked && !tareaGeneral && '*'}</p>
        <CausaSelect
          ritValue={form.causa_rit}
          clienteSeleccionado={form.cliente_nombre}
          allCausas={allCausas}
          locked={causaLocked}
          onChange={(rit, causaId, clienteId) => {
            f('causa_rit', rit)
            f('causa_id', causaId)
            if (!clienteLocked) f('cliente_id', clienteId)
            if (causaId) setTareaGeneral(false)
          }}
        />
        {!causaLocked && (
          <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tareaGeneral}
              onChange={e => {
                setTareaGeneral(e.target.checked)
                if (e.target.checked) {
                  f('causa_rit', '')
                  f('causa_id', null)
                  if (!clienteLocked) { f('cliente_nombre', ''); f('cliente_id', null) }
                }
              }}
              className="w-3.5 h-3.5 rounded accent-[#2570BA]"
            />
            <span className="text-xs text-gray-500">Tarea general del estudio (sin causa)</span>
          </label>
        )}
        {!form.causa_id && !tareaGeneral && !causaLocked && form.titulo.trim() && (
          <p className="text-[10px] text-amber-500 mt-1">Selecciona una causa o marca "tarea general"</p>
        )}
      </div>

      <div>
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Notas internas</p>
        <textarea value={form.notas} onChange={e=>f('notas',e.target.value)} rows={3}
          placeholder="Instrucciones, contexto, referencias..."
          className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/50 resize-none" />
      </div>
    </>
  )
}

// ── FormNuevaTareaModal (modal overlay, para TareasLista y otros contextos) ───
// Carga sus propios datos (allCausas) para ser autosuficiente.
// initialValues: { cliente_id, cliente_nombre, causa_id, causa_rit }
export function FormNuevaTareaModal({ onClose, onSave, initialValues = {} }) {
  const [allCausas, setAllCausas] = useState([])

  useEffect(() => {
    supabase.from('causas')
      .select('id, rit, materia, tribunal, cliente_nombre, cliente_id')
      .order('rit')
      .then(({ data }) => setAllCausas(data || []))
  }, [])

  const clientesLista = useMemo(() => {
    const nombres = [...new Set(allCausas.map(c => c.cliente_nombre).filter(Boolean))]
    return nombres.sort()
  }, [allCausas])

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSave = async (payload) => {
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        titulo:           payload.titulo,
        estado:           payload.estado           || 'Pendiente',
        prioridad:        payload.prioridad         || 'Media',
        categoria:        payload.categoria         || null,
        responsable:      payload.responsable       || null,
        fecha_vencimiento:payload.fecha_vencimiento || null,
        notas:            payload.notas             || null,
        cliente_nombre:   payload.cliente_nombre    || null,
        causa_rit:        payload.causa_rit         || null,
        cliente_id:       payload.cliente_id        || null,
        causa_id:         payload.causa_id          || null,
      })
      .select('*')
      .single()

    if (!error && data) {
      window.dispatchEvent(new CustomEvent('tareas:updated'))
      onSave?.(data)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        className="relative z-10 w-[480px] max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <ModalContent
          onClose={onClose}
          onSave={handleSave}
          clientesLista={clientesLista}
          allCausas={allCausas}
          initialValues={initialValues}
        />
      </div>
    </div>
  )
}

// ── Contenido del modal ───────────────────────────────────────────────────────
function ModalContent({ onClose, onSave, clientesLista, allCausas, initialValues }) {
  const [saving, setSaving] = useState(false)
  const clienteLocked = !!initialValues.cliente_id
  const causaLocked   = !!initialValues.causa_id

  const [tareaGeneral, setTareaGeneral] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    cliente_nombre: initialValues.cliente_nombre || '',
    causa_rit:      initialValues.causa_rit      || '',
    causa_id:       initialValues.causa_id       || null,
    cliente_id:     initialValues.cliente_id     || null,
    categoria: 'Escrito', prioridad: 'Media',
    fecha_vencimiento: TODAY, responsable: 'MT',
    estado: 'Pendiente', notas: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const canSave = form.titulo.trim() && (tareaGeneral || causaLocked || !!form.causa_id)

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload = tareaGeneral
      ? { ...form, causa_id: null, causa_rit: '', cliente_nombre: '', cliente_id: null }
      : form
    await onSave(payload)
  }

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <>
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-[#1a2e4a]/20" />
          <h2 className="text-sm font-bold text-[#1a2e4a]">Nueva tarea</h2>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded-lg hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <FormFields
          form={form} f={f}
          clientesLista={clientesLista} allCausas={allCausas}
          clienteLocked={clienteLocked} causaLocked={causaLocked}
          tareaGeneral={tareaGeneral} setTareaGeneral={setTareaGeneral}
          canSave={canSave}
        />
      </div>

      <div className="border-t border-gray-100 px-6 py-3.5 flex gap-2 flex-shrink-0 bg-gray-50/30">
        <button onClick={onClose} className="flex-1 text-xs text-gray-400 hover:text-gray-600 py-2.5 rounded-xl hover:bg-gray-100 transition-colors font-medium">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="flex-1 text-xs bg-[#2570BA] text-white py-2.5 rounded-xl hover:bg-[#2570BA]/90 transition-colors font-semibold disabled:opacity-40 shadow-sm shadow-[#1a2e4a]/20"
        >
          {saving ? 'Guardando...' : 'Crear tarea'}
        </button>
      </div>
    </>
  )
}
