import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Plus, X, CheckSquare, Gavel, Clock, MessageSquare,
  Scale, Users, Database, Shield, RefreshCw, FileText,
  Check, ChevronDown, Loader2, Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useQuickAdd } from '../context/QuickAddContext'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Entity config ─────────────────────────────────────────────────────────────
const ENTITY_CFG = [
  { key: 'tarea',     Icon: CheckSquare,   label: 'Nueva tarea',           sub: 'Acción o pendiente',         c: 'emerald' },
  { key: 'audiencia', Icon: Gavel,         label: 'Nueva audiencia',       sub: 'Vista, formalización, etc.', c: 'blue'    },
  { key: 'plazo',     Icon: Clock,         label: 'Nuevo plazo',           sub: 'Vencimiento o fecha límite', c: 'amber'   },
  { key: 'reunion',   Icon: MessageSquare, label: 'Nueva reunión',         sub: 'De equipo o con cliente',    c: 'violet'  },
  { key: 'causa',     Icon: Scale,         label: 'Nueva causa',           sub: 'Expediente o RIT nuevo',     c: 'navy'    },
  { key: 'cliente',   Icon: Users,         label: 'Nuevo cliente',         sub: 'Persona natural o empresa',  c: 'sky'     },
  { key: 'siau',      Icon: Database,      label: 'Solicitud SIAU',        sub: 'Oficio o folio SIAU',        c: 'teal'    },
  { key: 'pjud',      Icon: Shield,        label: 'Movimiento PJUD',       sub: 'Escrito o resolución',       c: 'indigo'  },
  { key: 'revision',  Icon: RefreshCw,     label: 'Revisión semanal',      sub: 'Nota y próxima acción',      c: 'rose'    },
  { key: 'documento', Icon: FileText,      label: 'Nuevo documento',       sub: 'Archivo o escrito',          c: 'slate'   },
]

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50',    dot: 'bg-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  blue:    { icon: 'text-blue-600',    bg: 'bg-blue-50',       dot: 'bg-blue-400',    btn: 'bg-blue-600 hover:bg-blue-700'       },
  amber:   { icon: 'text-amber-600',   bg: 'bg-amber-50',      dot: 'bg-amber-400',   btn: 'bg-amber-600 hover:bg-amber-700'     },
  violet:  { icon: 'text-violet-600',  bg: 'bg-violet-50',     dot: 'bg-violet-400',  btn: 'bg-violet-600 hover:bg-violet-700'   },
  navy:    { icon: 'text-[#1a2e4a]',   bg: 'bg-[#1a2e4a]/[0.06]', dot: 'bg-[#1a2e4a]/40', btn: 'bg-[#1a2e4a] hover:bg-[#243d5e]' },
  sky:     { icon: 'text-sky-600',     bg: 'bg-sky-50',        dot: 'bg-sky-400',     btn: 'bg-sky-600 hover:bg-sky-700'         },
  teal:    { icon: 'text-teal-600',    bg: 'bg-teal-50',       dot: 'bg-teal-400',    btn: 'bg-teal-600 hover:bg-teal-700'       },
  indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-50',     dot: 'bg-indigo-400',  btn: 'bg-indigo-600 hover:bg-indigo-700'   },
  rose:    { icon: 'text-rose-600',    bg: 'bg-rose-50',       dot: 'bg-rose-400',    btn: 'bg-rose-600 hover:bg-rose-700'       },
  slate:   { icon: 'text-slate-500',   bg: 'bg-slate-100',     dot: 'bg-slate-400',   btn: 'bg-slate-600 hover:bg-slate-700'     },
}

// ── Default form values per entity ────────────────────────────────────────────
function defaultForm(type, ctx) {
  const link = {
    causa_rit:      ctx?.causaRit     || '',
    cliente_nombre: ctx?.clienteNombre || '',
    causa_id:       ctx?.causaId      || null,
  }
  switch (type) {
    case 'tarea':     return { titulo: '', prioridad: 'Media', fecha_vencimiento: '', responsable: 'MT', ...link }
    case 'audiencia': return { tipo: '', fecha: '', hora: '09:00', tribunal: '', ...link }
    case 'plazo':     return { titulo: '', fecha_vencimiento: '', tipo: 'Procesal', responsable: 'MT', ...link }
    case 'reunion':   return { tipo: 'Reunión de equipo', fecha: '', hora_inicio: '09:00', responsable: 'MT' }
    case 'causa':     return { cliente_nombre: ctx?.clienteNombre || '', area: 'Civil', tribunal: '', rit: '', estado: 'En tramitación' }
    case 'cliente':   return { nombre: '', rut: '', email: '', telefono: '' }
    case 'siau':      return { solicitud: '', fecha: TODAY, folio: '', estado: 'Pendiente', ...link }
    case 'pjud':      return { solicitud: '', fecha: TODAY, folio: '', estado: 'Pendiente', ...link }
    case 'revision':  return { nota: '', proxima_accion: '', responsable: 'MT', causa_id: ctx?.causaId || null }
    case 'documento': return { nombre: '', descripcion: '', responsable: 'MT', ...link }
    default:          return {}
  }
}

// ── Save to Supabase ──────────────────────────────────────────────────────────
async function saveEntity(type, form) {
  const trim = (s) => (s || '').trim()
  switch (type) {
    case 'tarea': {
      const { data, error } = await supabase.from('tareas').insert({
        titulo:            trim(form.titulo),
        prioridad:         form.prioridad,
        fecha_vencimiento: form.fecha_vencimiento || null,
        responsable:       form.responsable,
        causa_rit:         form.causa_rit || null,
        causa_id:          form.causa_id  || null,
        cliente_nombre:    form.cliente_nombre || null,
        estado:            'Pendiente',
        categoria:         'Otro',
      }).select().single()
      if (error) throw error
      return data
    }
    case 'audiencia': {
      const { data, error } = await supabase.from('audiencias').insert({
        tipo:           trim(form.tipo),
        fecha:          form.fecha,
        hora:           form.hora     || null,
        tribunal:       trim(form.tribunal) || null,
        causa_rit:      form.causa_rit || null,
        causa_id:       form.causa_id  || null,
        cliente_nombre: form.cliente_nombre || null,
        estado:         'Programada',
      }).select().single()
      if (error) throw error
      return data
    }
    case 'plazo': {
      const { data, error } = await supabase.from('plazos').insert({
        titulo:            trim(form.titulo),
        fecha_vencimiento: form.fecha_vencimiento,
        tipo:              form.tipo        || null,
        responsable:       form.responsable,
        causa_rit:         form.causa_rit   || null,
        causa_id:          form.causa_id    || null,
        estado:            'Activo',
      }).select().single()
      if (error) throw error
      return data
    }
    case 'reunion': {
      const { data, error } = await supabase.from('reuniones').insert({
        tipo:        trim(form.tipo),
        fecha:       form.fecha,
        hora_inicio: form.hora_inicio || null,
        responsable: form.responsable,
        estado:      'Programada',
        bandeja:           [],
        decisiones:        [],
        causas_discutidas: [],
      }).select().single()
      if (error) throw error
      return data
    }
    case 'causa': {
      const { data, error } = await supabase.from('causas').insert({
        cliente_nombre: trim(form.cliente_nombre),
        area:           form.area,
        tribunal:       trim(form.tribunal) || null,
        rit:            trim(form.rit)      || null,
        estado:         form.estado,
      }).select().single()
      if (error) throw error
      return data
    }
    case 'cliente': {
      const parts    = trim(form.nombre).split(' ')
      const nombre   = parts[0]   || ''
      const apellido = parts.slice(1).join(' ') || ''
      const { data, error } = await supabase.from('clientes').insert({
        nombre,
        apellido,
        rut:      trim(form.rut)      || null,
        email:    trim(form.email)    || null,
        telefono: trim(form.telefono) || null,
      }).select().single()
      if (error) throw error
      return data
    }
    case 'siau': {
      const { data, error } = await supabase.from('siau').insert({
        solicitud:      trim(form.solicitud),
        fecha:          form.fecha,
        folio:          trim(form.folio)          || null,
        estado:         form.estado,
        causa_rit:      form.causa_rit             || null,
        cliente_nombre: form.cliente_nombre        || null,
      }).select().single()
      if (error) throw error
      return data
    }
    case 'pjud': {
      const { data, error } = await supabase.from('pjud').insert({
        solicitud:      trim(form.solicitud),
        fecha:          form.fecha,
        folio:          trim(form.folio)          || null,
        estado:         form.estado,
        causa_rit:      form.causa_rit             || null,
        cliente_nombre: form.cliente_nombre        || null,
      }).select().single()
      if (error) throw error
      return data
    }
    case 'revision': {
      const isoWeek = (d) => {
        const dt = new Date(d); dt.setHours(0,0,0,0)
        dt.setDate(dt.getDate() + 3 - (dt.getDay() + 6) % 7)
        const w1 = new Date(dt.getFullYear(), 0, 4)
        return 1 + Math.round(((dt - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)
      }
      const wn  = isoWeek(TODAY)
      const yr  = new Date().getFullYear()
      const key = `${yr}-W${String(wn).padStart(2, '0')}`
      const { data, error } = await supabase.from('revisiones').insert({
        nota:           trim(form.nota),
        proxima_accion: trim(form.proxima_accion) || null,
        responsable:    form.responsable,
        causa_id:       form.causa_id || null,
        fecha:          TODAY,
        semana_key:     key,
        revisada:       true,
        urgente:        false,
      }).select().single()
      if (error) throw error
      return data
    }
    case 'documento': {
      const { data, error } = await supabase.from('documentos').insert({
        nombre:         trim(form.nombre),
        descripcion:    trim(form.descripcion) || null,
        responsable:    form.responsable,
        causa_rit:      form.causa_rit      || null,
        cliente:        form.cliente_nombre || null,
        fecha_creacion: TODAY,
      }).select().single()
      if (error) throw error
      return data
    }
    default: throw new Error('Unknown entity type: ' + type)
  }
}

// ── Form field primitives ─────────────────────────────────────────────────────
function QInput({ label, type = 'text', value, onChange, placeholder, autoFocus, required }) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 60)
  }, [autoFocus])
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1a2e4a]/40 focus:bg-white transition-all placeholder-gray-300"
      />
    </div>
  )
}

function QSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-[#1a2e4a]/40 focus:bg-white transition-all appearance-none"
        >
          {options.map(o => (
            <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
              {typeof o === 'string' ? o : o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

const RESP_OPTS = [
  { value: 'MT', label: 'Macarena T.' },
  { value: 'AB', label: 'Angélica B.' },
  { value: 'CL', label: 'Catalina L.' },
]

// ── Form fields per entity ────────────────────────────────────────────────────
function FormFields({ type, form, setForm }) {
  const f = key => form[key] ?? ''
  const s = key => val => setForm(prev => ({ ...prev, [key]: val }))
  const hasCtx = !!(form.causa_rit || form.causa_id)

  const RITField = (
    <QInput label="RIT / Causa" value={f('causa_rit')} onChange={s('causa_rit')} placeholder="F-1234-2025" />
  )
  const ClienteField = (
    <QInput label="Cliente" value={f('cliente_nombre')} onChange={s('cliente_nombre')} placeholder="Nombre del cliente" />
  )

  switch (type) {
    case 'tarea':
      return (
        <div className="space-y-3">
          <QInput label="Título" value={f('titulo')} onChange={s('titulo')}
            placeholder="ej. Preparar escrito de apelación" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Prioridad" value={f('prioridad')} onChange={s('prioridad')}
              options={['Alta', 'Media', 'Baja']} />
            <QInput label="Vence" type="date" value={f('fecha_vencimiento')} onChange={s('fecha_vencimiento')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Responsable" value={f('responsable')} onChange={s('responsable')} options={RESP_OPTS} />
            {!hasCtx && RITField}
          </div>
        </div>
      )

    case 'audiencia':
      return (
        <div className="space-y-3">
          <QInput label="Tipo de audiencia" value={f('tipo')} onChange={s('tipo')}
            placeholder="ej. Formalización, Vista en cuenta" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QInput label="Fecha" type="date" value={f('fecha')} onChange={s('fecha')} required />
            <QInput label="Hora" type="time" value={f('hora')} onChange={s('hora')} />
          </div>
          <QInput label="Tribunal" value={f('tribunal')} onChange={s('tribunal')}
            placeholder="ej. 7° Juzgado de Garantía Santiago" />
          {!hasCtx && (
            <div className="grid grid-cols-2 gap-3">{RITField}{ClienteField}</div>
          )}
        </div>
      )

    case 'plazo':
      return (
        <div className="space-y-3">
          <QInput label="Título" value={f('titulo')} onChange={s('titulo')}
            placeholder="ej. Contestar traslado" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QInput label="Fecha límite" type="date" value={f('fecha_vencimiento')} onChange={s('fecha_vencimiento')} required />
            <QSelect label="Tipo" value={f('tipo')} onChange={s('tipo')}
              options={['Procesal', 'Legal', 'Convencional', 'Otro']} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Responsable" value={f('responsable')} onChange={s('responsable')} options={RESP_OPTS} />
            {!hasCtx && RITField}
          </div>
        </div>
      )

    case 'reunion':
      return (
        <div className="space-y-3">
          <QInput label="Tipo de reunión" value={f('tipo')} onChange={s('tipo')}
            placeholder="ej. Reunión de equipo, Reunión con cliente" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QInput label="Fecha" type="date" value={f('fecha')} onChange={s('fecha')} required />
            <QInput label="Hora" type="time" value={f('hora_inicio')} onChange={s('hora_inicio')} />
          </div>
          <QSelect label="Responsable" value={f('responsable')} onChange={s('responsable')} options={RESP_OPTS} />
        </div>
      )

    case 'causa':
      return (
        <div className="space-y-3">
          <QInput label="Nombre del cliente" value={f('cliente_nombre')} onChange={s('cliente_nombre')}
            placeholder="ej. Juan Pablo Muñoz Soto" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Área" value={f('area')} onChange={s('area')}
              options={['Penal', 'Familia', 'Laboral', 'Civil', 'JPL', 'Administrativo', 'Corte de Apelaciones', 'Corte Suprema']} />
            <QSelect label="Estado" value={f('estado')} onChange={s('estado')}
              options={['En tramitación', 'Abierta', 'Suspendida', 'Terminada', 'Archivada']} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QInput label="RIT" value={f('rit')} onChange={s('rit')} placeholder="F-1234-2025" />
            <QInput label="Tribunal" value={f('tribunal')} onChange={s('tribunal')} placeholder="Juzgado..." />
          </div>
        </div>
      )

    case 'cliente':
      return (
        <div className="space-y-3">
          <QInput label="Nombre completo" value={f('nombre')} onChange={s('nombre')}
            placeholder="ej. María González Rojas" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QInput label="RUT" value={f('rut')} onChange={s('rut')} placeholder="12.345.678-9" />
            <QInput label="Teléfono" value={f('telefono')} onChange={s('telefono')} placeholder="+56 9 1234 5678" />
          </div>
          <QInput label="Email" type="email" value={f('email')} onChange={s('email')} placeholder="correo@dominio.cl" />
        </div>
      )

    case 'siau':
      return (
        <div className="space-y-3">
          <QInput label="Solicitud" value={f('solicitud')} onChange={s('solicitud')}
            placeholder="ej. Solicitar acta de imputado" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QInput label="Fecha" type="date" value={f('fecha')} onChange={s('fecha')} required />
            <QInput label="Folio" value={f('folio')} onChange={s('folio')} placeholder="N°..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Estado" value={f('estado')} onChange={s('estado')}
              options={['Pendiente', 'Respondida', 'Sin respuesta', 'Urgente', 'Archivado']} />
            {!hasCtx && RITField}
          </div>
        </div>
      )

    case 'pjud':
      return (
        <div className="space-y-3">
          <QInput label="Solicitud / Escrito" value={f('solicitud')} onChange={s('solicitud')}
            placeholder="ej. Presentar escrito de contestación" autoFocus required />
          <div className="grid grid-cols-2 gap-3">
            <QInput label="Fecha" type="date" value={f('fecha')} onChange={s('fecha')} required />
            <QInput label="Folio" value={f('folio')} onChange={s('folio')} placeholder="N°..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Estado" value={f('estado')} onChange={s('estado')}
              options={['Pendiente', 'Respondido', 'Escrito presentado', 'Resolución pendiente', 'Proveído', 'Urgente']} />
            {!hasCtx && RITField}
          </div>
        </div>
      )

    case 'revision':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
              Nota / Resumen<span className="text-red-400 ml-0.5">*</span>
            </label>
            <textarea
              value={f('nota')}
              onChange={e => s('nota')(e.target.value)}
              placeholder="ej. Audiencia de formalización próxima, preparar defensa..."
              rows={3}
              autoFocus
              className="w-full text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1a2e4a]/40 focus:bg-white transition-all placeholder-gray-300 resize-none"
            />
          </div>
          <QInput label="Próxima acción" value={f('proxima_accion')} onChange={s('proxima_accion')}
            placeholder="ej. Esperar resolución del tribunal" />
          <QSelect label="Responsable" value={f('responsable')} onChange={s('responsable')} options={RESP_OPTS} />
        </div>
      )

    case 'documento':
      return (
        <div className="space-y-3">
          <QInput label="Nombre del documento" value={f('nombre')} onChange={s('nombre')}
            placeholder="ej. Demanda de alimentos — González" autoFocus required />
          <QInput label="Descripción" value={f('descripcion')} onChange={s('descripcion')}
            placeholder="Breve descripción o referencia" />
          <div className="grid grid-cols-2 gap-3">
            <QSelect label="Responsable" value={f('responsable')} onChange={s('responsable')} options={RESP_OPTS} />
            {!hasCtx && RITField}
          </div>
        </div>
      )

    default:
      return null
  }
}

// ── Validation ────────────────────────────────────────────────────────────────
function isFormValid(type, form) {
  const t = s => (s || '').trim().length > 0
  switch (type) {
    case 'tarea':     return t(form.titulo)
    case 'audiencia': return t(form.tipo) && t(form.fecha)
    case 'plazo':     return t(form.titulo) && t(form.fecha_vencimiento)
    case 'reunion':   return t(form.tipo) && t(form.fecha)
    case 'causa':     return t(form.cliente_nombre)
    case 'cliente':   return t(form.nombre)
    case 'siau':      return t(form.solicitud) && t(form.fecha)
    case 'pjud':      return t(form.solicitud) && t(form.fecha)
    case 'revision':  return t(form.nota)
    case 'documento': return t(form.nombre)
    default:          return false
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuickAdd() {
  const { ctx } = useQuickAdd()

  // phase: 'idle' | 'picker' | 'form' | 'success'
  const [phase,      setPhase]      = useState('idle')
  const [entityType, setEntityType] = useState(null)
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)

  const pickerRef = useRef(null)
  const cfg       = ENTITY_CFG.find(e => e.key === entityType)

  // ── Reset form when entity changes ──
  useEffect(() => {
    if (entityType) {
      setForm(defaultForm(entityType, ctx))
      setError(null)
    }
  }, [entityType, ctx])

  // ── ESC to close / ⌘+Shift+N / ⌘+N to open ──
  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') {
        if (phase === 'form')   { setPhase('idle'); setEntityType(null) }
        if (phase === 'picker') { setPhase('idle') }
        return
      }
      // ⌘+Shift+N → toggle picker
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault()
        setPhase(p => p === 'idle' || p === 'success' ? 'picker' : 'idle')
        setEntityType(null)
        return
      }
      // ⌘+Enter → submit form
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && phase === 'form') {
        e.preventDefault()
        if (isFormValid(entityType, form)) handleSave()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [phase, entityType, form])

  // ── Listen for programmatic open (slash commands, Cmd+N fallback) ──
  useEffect(() => {
    const fn = (e) => {
      const type = e.detail?.type
      if (type && ENTITY_CFG.find(c => c.key === type)) {
        setEntityType(type)
        setPhase('form')
      } else {
        setPhase(p => p === 'idle' || p === 'success' ? 'picker' : 'idle')
        setEntityType(null)
      }
    }
    window.addEventListener('quick-add:open', fn)
    return () => window.removeEventListener('quick-add:open', fn)
  }, [])

  // ── Close picker on outside click ──
  useEffect(() => {
    if (phase !== 'picker') return
    const fn = e => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPhase('idle')
      }
    }
    setTimeout(() => document.addEventListener('mousedown', fn), 50)
    return () => document.removeEventListener('mousedown', fn)
  }, [phase])

  // ── Select entity ──
  function selectEntity(key) {
    setEntityType(key)
    setPhase('form')
  }

  // ── Close / reset ──
  function close() {
    setPhase('idle')
    setEntityType(null)
    setForm({})
    setError(null)
  }

  // ── Save ──
  async function handleSave() {
    if (!isFormValid(entityType, form)) return
    setSaving(true)
    setError(null)
    try {
      await saveEntity(entityType, form)
      setPhase('success')
      setTimeout(close, 1600)
    } catch (err) {
      console.error('QuickAdd save error:', err)
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const valid = isFormValid(entityType, form)

  return (
    <>
      {/* ── Entity picker (floating above button) ── */}
      {phase === 'picker' && (
        <div
          ref={pickerRef}
          className="fixed bottom-[72px] right-6 z-[110] w-72 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden"
          style={{ animation: 'quickAddSlideUp 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={11} className="text-[#1a2e4a]/40" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quick Add</span>
            </div>
            {ctx && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {ctx.causaRit}
              </span>
            )}
          </div>

          {/* Entity list */}
          <div className="py-1.5" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {ENTITY_CFG.map(e => (
              <button
                key={e.key}
                onClick={() => selectEntity(e.key)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 text-left transition-colors group"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${C[e.c].bg} transition-transform group-hover:scale-105`}>
                  <e.Icon size={14} className={C[e.c].icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 leading-none">{e.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{e.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
            <span className="text-[10px] text-gray-400">
              <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono">⌘</kbd>{' '}
              <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono">⇧N</kbd>{' '}
              para abrir · <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono">ESC</kbd> para cerrar
            </span>
          </div>
        </div>
      )}

      {/* ── Quick form modal ── */}
      {(phase === 'form' || phase === 'success') && cfg && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center"
          style={{ paddingTop: '11vh', background: 'rgba(10,15,25,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div
            className="w-[460px] bg-white rounded-2xl shadow-[0_32px_100px_rgba(0,0,0,0.22)] border border-gray-100 overflow-hidden"
            style={{ animation: 'quickAddModalIn 0.2s cubic-bezier(0.34,1.3,0.64,1)' }}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${C[cfg.c].bg}`}>
                <cfg.Icon size={16} className={C[cfg.c].icon} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[14px] font-semibold text-gray-900 leading-none">{cfg.label}</h2>
                {ctx ? (
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    Vinculado a {ctx.causaRit}
                    {ctx.clienteNombre && <span className="text-gray-400">· {ctx.clienteNombre}</span>}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-0.5">{cfg.sub}</p>
                )}
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Success state */}
            {phase === 'success' ? (
              <div className="flex flex-col items-center justify-center py-14">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4"
                  style={{ animation: 'quickAddBounce 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
                  <Check size={24} className="text-emerald-500" strokeWidth={2.5} />
                </div>
                <p className="text-[15px] font-semibold text-gray-800">¡Creado con éxito!</p>
                <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Sincronizado en toda la plataforma
                </p>
              </div>
            ) : (
              <>
                {/* Form fields */}
                <div className="px-5 py-5">
                  <FormFields type={entityType} form={form} setForm={setForm} />
                  {error && (
                    <p className="mt-3 text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono">⌘</kbd>
                    <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono">↵</kbd>
                    <span>para guardar</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={close}
                      className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !valid}
                      className={`px-4 py-1.5 rounded-lg text-white text-[12px] font-semibold flex items-center gap-1.5 transition-all ${
                        C[cfg.c].btn
                      } disabled:opacity-40 disabled:cursor-not-allowed shadow-sm`}
                    >
                      {saving && <Loader2 size={12} className="animate-spin" />}
                      Crear {cfg.label.replace('Nueva ', '').replace('Nuevo ', '').replace('Nueva', '').replace('Nuevo', '')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Floating button ── */}
      <div className="fixed bottom-6 right-6 z-[100]">
        <button
          onClick={() => {
            if (phase === 'form' || phase === 'success') return
            setPhase(p => p === 'picker' ? 'idle' : 'picker')
            setEntityType(null)
          }}
          title="Quick Add (⌘⇧N)"
          className={`flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full bg-[#2570BA] text-white
            shadow-lg shadow-[#1a2e4a]/30
            hover:bg-[#243d5e] hover:shadow-xl hover:shadow-[#1a2e4a]/35
            active:scale-95
            transition-all duration-200 select-none ${
              phase === 'picker' ? 'bg-[#243d5e] shadow-xl scale-95' : 'hover:scale-[1.03]'
            }`}
        >
          <Plus
            size={16}
            strokeWidth={2.5}
            className={`transition-transform duration-200 ${phase === 'picker' ? 'rotate-45' : ''}`}
          />
          <span className="text-[13px] font-semibold tracking-[-0.01em]">Nuevo</span>
        </button>
      </div>

      {/* ── Keyframe animations (injected once) ── */}
      <style>{`
        @keyframes quickAddSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes quickAddModalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes quickAddBounce {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1);   }
        }
      `}</style>
    </>
  )
}
