// DiligenciasTab — Vista A: dentro de la ficha de causa
import { useState, useEffect, useCallback, Fragment } from 'react'
import { Plus, Inbox, Clock, User, Phone, Calendar, AlertTriangle, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { EQUIPO_SELECT } from '../../lib/equipo'

// ── Constantes ─────────────────────────────────────────────────────────────────
const ESTADOS  = ['Por contactar', 'Endosada', 'En gestión', 'Parcial', 'Sin resultado', 'Cumplida', 'Vencida']
const TIPOS    = ['OI', 'IP', 'Exhorto', 'Pericia', 'Solicitud organismo', 'Otro']
const VIA_GES  = ['Llamada', 'SIAU', 'Correo', 'Pide-cuenta']
const CICLO    = ['Despachada', 'Recibida', 'Endosada', 'En gestión', 'Cumplida']

const ESTADO_CFG = {
  'Por contactar': { chip: 'bg-amber-50 text-amber-700 border-amber-200',   border: '#C8862B' },
  'Endosada':      { chip: 'bg-orange-50 text-orange-600 border-orange-200', border: '#E07A2F' },
  'En gestión':    { chip: 'bg-blue-50 text-blue-700 border-blue-200',      border: '#2570BA' },
  'Parcial':       { chip: 'bg-purple-50 text-purple-700 border-purple-200', border: '#8E7CC3' },
  'Sin resultado': { chip: 'bg-red-50 text-red-600 border-red-200',         border: '#C0392B' },
  'Cumplida':      { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: '#1E9E6A' },
  'Vencida':       { chip: 'bg-red-50 text-red-700 border-red-300',         border: '#C0392B' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function diasDesde(iso) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000))
}

function calcCiclo(dil) {
  const e = dil.estado || 'Por contactar'
  const vencida = e === 'Vencida'
  const done = [
    true,
    e !== 'Por contactar',
    !!dil.funcionario,
    ['En gestión', 'Parcial', 'Sin resultado', 'Cumplida'].includes(e),
    e === 'Cumplida',
  ]
  let activeIdx = done.findIndex(v => !v)
  if (activeIdx === -1) activeIdx = 5
  return { done, activeIdx, vencida }
}

// ── Barra de ciclo ─────────────────────────────────────────────────────────────
function BarraCiclo({ dil }) {
  const { activeIdx, vencida } = calcCiclo(dil)

  function dotCls(i) {
    if (i < activeIdx) return 'w-2.5 h-2.5 rounded-full bg-[#2570BA] border-2 border-[#2570BA]'
    if (i === activeIdx) {
      if (vencida) return 'w-2.5 h-2.5 rounded-full bg-[#C0392B] border-2 border-[#C0392B] shadow-[0_0_0_3px_rgba(192,57,43,0.18)]'
      return 'w-2.5 h-2.5 rounded-full bg-white border-[3px] border-[#2570BA] shadow-[0_0_0_3px_rgba(37,112,186,0.15)]'
    }
    return 'w-2.5 h-2.5 rounded-full bg-gray-100 border-2 border-gray-200'
  }

  function lblCls(i) {
    if (i < activeIdx) return 'text-[#2570BA] font-semibold'
    if (i === activeIdx) return vencida ? 'text-[#C0392B] font-bold' : 'text-[#1A2E4A] font-bold'
    return 'text-gray-300'
  }

  function getLabel(i) {
    if (i === 2 && i === activeIdx && vencida && !dil.funcionario) return 'Sin endosar'
    return CICLO[i]
  }

  return (
    <div className="flex items-center my-2.5">
      {CICLO.map((_, i) => (
        <Fragment key={i}>
          <div className="flex flex-col items-center gap-1 min-w-[60px]">
            <div className={dotCls(i)}/>
            <span className={`text-[9px] tracking-wide uppercase text-center leading-tight ${lblCls(i)}`}>
              {getLabel(i)}
            </span>
          </div>
          {i < 4 && (
            <div className={`h-0.5 flex-1 mb-[14px] ${i + 1 < activeIdx ? 'bg-[#2570BA]' : 'bg-gray-200'}`}/>
          )}
        </Fragment>
      ))}
    </div>
  )
}

// ── Inline edit — texto ────────────────────────────────────────────────────────
function IText({ id, field, value, placeholder = '—', multi = false, onSave, flash }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  const isFlash = flash === `${id}:${field}`

  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  function commit() {
    setEditing(false)
    const v = draft.trim() || null
    if (v === (value?.trim() || null)) return
    onSave(id, field, v)
  }

  if (editing) {
    const cls = 'w-full text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none text-gray-700'
    return multi
      ? <textarea autoFocus rows={3} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
          className={cls}/>
      : <input autoFocus value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
          }}
          className={cls}/>
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true) }}
      className={`cursor-text text-xs rounded px-0.5 py-0.5 transition-colors ${
        isFlash
          ? 'border border-emerald-400 bg-emerald-50 text-emerald-700'
          : value
            ? 'text-gray-700 hover:bg-gray-50'
            : 'text-gray-300 italic hover:bg-gray-50'
      }`}>
      {value || placeholder}
    </span>
  )
}

// ── Inline edit — select ───────────────────────────────────────────────────────
function ISelect({ id, field, value, options, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? options[0])
  useEffect(() => { if (!editing) setDraft(value ?? options[0]) }, [value, editing])

  if (editing) {
    return (
      <select autoFocus value={draft}
        onChange={e => { const v = e.target.value; setDraft(v); setEditing(false); onSave(id, field, v) }}
        onBlur={() => setEditing(false)}
        className="text-xs bg-white border border-blue-300 rounded px-1 py-0.5 outline-none">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }

  const cfg = ESTADO_CFG[value]
  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? options[0]); setEditing(true) }}
      className={`cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${
        cfg?.chip || 'bg-gray-50 text-gray-500 border-gray-200'
      }`}>
      {value || '—'}
    </span>
  )
}

// ── Inline edit — responsable (opciones {value, label}) ───────────────────────
function ISelectResp({ id, field, value, options, onSave, flash }) {
  const [editing, setEditing] = useState(false)
  const isFlash = flash === `${id}:${field}`
  const opt = options.find(o => o.value === value)

  if (editing) {
    return (
      <select autoFocus value={value ?? ''}
        onChange={e => { const v = e.target.value || null; setEditing(false); onSave(id, field, v) }}
        onBlur={() => setEditing(false)}
        className="text-xs bg-white border border-blue-300 rounded px-1 py-0.5 outline-none">
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className={`cursor-pointer text-xs rounded px-1 py-0.5 transition-colors ${
        isFlash ? 'border border-emerald-400 bg-emerald-50 text-emerald-700'
        : value ? 'font-medium text-gray-700 hover:bg-gray-50'
        : 'text-gray-300 italic hover:bg-gray-50'
      }`}>
      {opt ? opt.label : (value || '—')}
    </span>
  )
}

// ── Inline edit — fecha ────────────────────────────────────────────────────────
function IDate({ id, field, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  if (editing) {
    return (
      <input autoFocus type="date" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); const v = draft || null; if (v !== value) onSave(id, field, v) }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
        }}
        className="text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none"/>
    )
  }
  return (
    <span
      onClick={e => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true) }}
      className={`cursor-text text-xs rounded px-0.5 hover:bg-gray-50 ${value ? 'text-gray-700' : 'text-gray-300 italic'}`}>
      {value ? fmt(value) : '—'}
    </span>
  )
}

// ── Registro de gestiones ──────────────────────────────────────────────────────
function GestionesLog({ diligenciaId }) {
  const [gestiones, setGestiones] = useState(null)
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ fecha: new Date().toISOString().slice(0, 10), via: 'Llamada', detalle: '' })
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    supabase.from('diligencia_gestiones').select('*')
      .eq('diligencia_id', diligenciaId)
      .order('fecha', { ascending: false })
      .then(({ data }) => setGestiones(data || []))
  }, [diligenciaId])

  async function save() {
    if (!form.detalle.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('diligencia_gestiones')
      .insert({ diligencia_id: diligenciaId, ...form }).select('*').single()
    setSaving(false)
    if (!error && data) {
      setGestiones(prev => [data, ...prev])
      setForm({ fecha: new Date().toISOString().slice(0, 10), via: 'Llamada', detalle: '' })
      setAdding(false)
    }
  }

  if (gestiones === null) return <p className="text-[11px] text-gray-400 py-1">Cargando gestiones…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Gestiones</span>
        <button onClick={() => setAdding(a => !a)}
          className="text-[10px] text-[#2570BA] hover:underline">
          {adding ? 'Cancelar' : '+ Agregar gestión'}
        </button>
      </div>

      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
          <div className="flex gap-2">
            <input type="date" value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2570BA]"/>
            <select value={form.via}
              onChange={e => setForm(f => ({ ...f, via: e.target.value }))}
              className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2570BA]">
              {VIA_GES.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <textarea rows={2} value={form.detalle} placeholder="¿Qué pasó? ¿Qué te dijeron?"
            onChange={e => setForm(f => ({ ...f, detalle: e.target.value }))}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save() }}
            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-[#2570BA] resize-none"/>
          <button onClick={save} disabled={saving || !form.detalle.trim()}
            className="text-[11px] bg-[#1A2E4A] text-white px-3 py-1 rounded hover:opacity-80 disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {gestiones.length === 0
        ? <p className="text-[11px] text-gray-300 italic py-1">Sin gestiones registradas</p>
        : gestiones.map(g => (
          <div key={g.id} className="flex gap-3 text-[11px] py-0.5">
            <span className="text-gray-400 tabular-nums whitespace-nowrap flex-shrink-0">{fmt(g.fecha)}</span>
            <span className="text-[#2570BA] font-medium flex-shrink-0">{g.via}</span>
            <span className="text-gray-600">{g.detalle || '—'}</span>
          </div>
        ))
      }
    </div>
  )
}

// ── Tarjeta de diligencia ──────────────────────────────────────────────────────
function DilCard({ dil, expanded, onToggle, onSave, setTab }) {
  const cfg      = ESTADO_CFG[dil.estado] || { chip: 'bg-gray-50 text-gray-500 border-gray-200', border: '#9CA3AF' }
  const numero   = dil.oficio || dil.folio
  const titulo   = numero ? `${dil.tipo_diligencia || 'OI'} ${numero}` : 'Sin número · gestión propia'
  const [flash, setFlash] = useState('')

  const baseIso  = dil.fecha_oi || dil.fecha_solicitud || dil.created_at?.slice(0, 10)
  const dias     = diasDesde(baseIso)
  const urgente  = dil.estado === 'Vencida' || (dias !== null && dias > 60)

  async function handleSave(id, field, value) {
    await onSave(id, field, value)
    setFlash(`${id}:${field}`)
    setTimeout(() => setFlash(''), 1500)
  }

  const sp = { onSave: handleSave, flash }

  return (
    <div
      className="rounded-lg border border-[#E3E7EC] bg-white shadow-sm overflow-hidden mb-3 hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${cfg.border}` }}>

      {/* Header */}
      <div className="px-4 pt-3 pb-1 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className={`text-[13px] font-bold ${numero ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {titulo}
              </span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.chip}`}>
                {dil.estado || '—'}
              </span>
            </div>
            {(dil.descripcion || dil.instruccion) && (
              <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
                {dil.descripcion || dil.instruccion}
              </p>
            )}
          </div>
          <ChevronRight size={14} className={`text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`}/>
        </div>

        {/* Barra ciclo */}
        <BarraCiclo dil={dil}/>

        {/* Footer */}
        <div className="flex items-center gap-2 flex-wrap pb-1.5">
          {(dil.fecha_oi || dil.fecha_solicitud) && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Calendar size={9}/>{fmt(dil.fecha_oi || dil.fecha_solicitud)}
            </span>
          )}
          {(dil.organismo_direccion || dil.organismo) && (
            <span className="text-[10px] text-gray-500 font-medium truncate max-w-[160px]">
              {dil.organismo_direccion || dil.organismo}
            </span>
          )}
          {dil.funcionario ? (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <User size={9}/>{dil.funcionario}
              {dil.funcionario_telefono && (
                <span className="flex items-center gap-0.5 ml-1"><Phone size={9}/>{dil.funcionario_telefono}</span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
              <AlertTriangle size={9}/>sin endosar — averiguar a quién se asignó
            </span>
          )}
          {dias !== null && (
            <span className={`ml-auto text-[10px] font-semibold tabular-nums flex items-center gap-0.5 ${urgente ? 'text-red-500' : 'text-gray-400'}`}>
              <Clock size={9}/>{dias}d sin cumplir
            </span>
          )}
        </div>
      </div>

      {/* Vista expandida */}
      {expanded && (
        <div className="border-t border-dashed border-[#E3E7EC] px-4 py-4 bg-[#F5F6F8]/60">
          {/* Grid editable — 3 col */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-[11px] mb-4">
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">N° oficio / OI</span>
              <IText id={dil.id} field="oficio" value={dil.oficio} placeholder="Ej: 2026-1502-9426" {...sp}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Estado</span>
              <ISelect id={dil.id} field="estado" value={dil.estado} options={ESTADOS} onSave={handleSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Tipo</span>
              <ISelect id={dil.id} field="tipo_diligencia" value={dil.tipo_diligencia} options={TIPOS} onSave={handleSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Fecha OI</span>
              <IDate id={dil.id} field="fecha_oi" value={dil.fecha_oi} onSave={handleSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Fecha límite</span>
              <IDate id={dil.id} field="fecha_limite" value={dil.fecha_limite} onSave={handleSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Pide-cuenta</span>
              <IDate id={dil.id} field="pide_cuenta" value={dil.pide_cuenta} onSave={handleSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Organismo</span>
              <IText id={dil.id} field="organismo_direccion" value={dil.organismo_direccion} placeholder="Ej: PDI BRIDEC" {...sp}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Funcionario</span>
              <IText id={dil.id} field="funcionario" value={dil.funcionario} placeholder="Nombre…" {...sp}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Teléfono</span>
              <IText id={dil.id} field="funcionario_telefono" value={dil.funcionario_telefono} placeholder="+56 9…" {...sp}/>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <span className="text-gray-400 font-medium block mb-0.5">Correo contacto</span>
              <IText id={dil.id} field="correo_contacto" value={dil.correo_contacto} placeholder="correo@ejemplo.cl" {...sp}/>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <span className="text-gray-400 font-medium block mb-0.5">Próximo paso</span>
              <IText id={dil.id} field="proximo_paso" value={dil.proximo_paso} placeholder="¿Qué sigue?" {...sp}/>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <span className="text-gray-400 font-medium block mb-0.5">Responsable</span>
              <ISelectResp id={dil.id} field="responsable" value={dil.responsable} options={EQUIPO_SELECT} {...sp}/>
            </div>
          </div>

          {/* Descripción */}
          <div className="mb-4">
            <span className="text-gray-400 font-medium text-[11px] block mb-1">Descripción / Instrucción</span>
            <IText id={dil.id} field="descripcion" value={dil.descripcion} placeholder="Describe la instrucción…" multi {...sp}/>
          </div>

          <div className="border-t border-dashed border-[#E3E7EC] my-3"/>

          {/* Gestiones */}
          <div className="mb-4">
            <GestionesLog diligenciaId={dil.id}/>
          </div>

          <div className="border-t border-dashed border-[#E3E7EC] my-3"/>

          {/* Notas */}
          <div className="mb-4">
            <span className="text-gray-400 font-medium text-[11px] block mb-1">Notas</span>
            <IText id={dil.id} field="notas" value={dil.notas} placeholder="Notas internas…" multi {...sp}/>
          </div>

          {/* Recuadro referencia al análisis IA */}
          {setTab && (
            <div className="rounded-lg border border-[#2570BA]/25 bg-[#EBF2FA] p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#1A2E4A]">Esta diligencia puede provenir del análisis IA</p>
                <p className="text-[11px] text-[#2570BA]/80 mt-0.5">Ver contexto completo, brechas y contradicciones</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setTab('analisis') }}
                className="text-[11px] text-[#2570BA] border border-[#2570BA]/40 rounded px-2.5 py-1 hover:bg-[#2570BA] hover:text-white transition-colors whitespace-nowrap flex-shrink-0">
                Ir a Análisis →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function DiligenciasTab({ causa, diligencias, setDiligencias, setTab }) {
  const [filter,     setFilter]     = useState('todas')
  const [expandedId, setExpandedId] = useState(null)

  const counts = {
    todas:         diligencias.length,
    vencidas:      diligencias.filter(d => d.estado === 'Vencida').length,
    por_contactar: diligencias.filter(d => d.estado === 'Por contactar').length,
    sin_endosar:   diligencias.filter(d => !d.funcionario && d.estado !== 'Cumplida').length,
    en_gestion:    diligencias.filter(d => d.estado === 'En gestión').length,
    cumplidas:     diligencias.filter(d => d.estado === 'Cumplida').length,
  }

  const filtered =
    filter === 'vencidas'      ? diligencias.filter(d => d.estado === 'Vencida')
    : filter === 'por_contactar' ? diligencias.filter(d => d.estado === 'Por contactar')
    : filter === 'sin_endosar'   ? diligencias.filter(d => !d.funcionario && d.estado !== 'Cumplida')
    : filter === 'en_gestion'    ? diligencias.filter(d => d.estado === 'En gestión')
    : filter === 'cumplidas'     ? diligencias.filter(d => d.estado === 'Cumplida')
    : diligencias

  const onSave = useCallback(async (id, field, value) => {
    setDiligencias(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
    await supabase.from('diligencias').update({ [field]: value }).eq('id', id)
  }, [setDiligencias])

  async function handleAdd() {
    if (!causa?.id) return
    const { data, error } = await supabase.from('diligencias')
      .insert({ causa_id: causa.id, nombre: 'Nueva diligencia', estado: 'Por contactar' })
      .select().single()
    if (!error && data) {
      setDiligencias(prev => [data, ...prev])
      setExpandedId(data.id)
    }
  }

  const FILTERS = [
    { key: 'todas',         label: 'Todas',         cnt: counts.todas,         red: false },
    { key: 'vencidas',      label: 'Vencidas',      cnt: counts.vencidas,      red: true  },
    { key: 'por_contactar', label: 'Por contactar', cnt: counts.por_contactar, red: false },
    { key: 'sin_endosar',   label: 'Sin endosar',   cnt: counts.sin_endosar,   red: true  },
    { key: 'en_gestion',    label: 'En gestión',    cnt: counts.en_gestion,    red: false },
    { key: 'cumplidas',     label: 'Cumplidas',     cnt: counts.cumplidas,     red: false },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Barra de filtros */}
      <div className="px-5 py-3 border-b border-[#E2E5EA] flex items-center gap-2 flex-wrap bg-[#F7F8FA] flex-shrink-0">
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f.key
                  ? f.red ? 'bg-[#C0392B] text-white' : 'bg-[#1A2E4A] text-white'
                  : f.red && f.cnt > 0
                    ? 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-gray-500 hover:bg-gray-200'
              }`}>
              {f.label}{' '}<span className="opacity-60 tabular-nums">({f.cnt})</span>
            </button>
          ))}
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#1A2E4A] text-white text-[11px] font-semibold rounded-lg hover:opacity-80 transition-opacity flex-shrink-0">
          <Plus size={12}/> Nueva
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox size={28} className="text-gray-200 mb-3"/>
            <p className="text-[13px] text-gray-400 font-medium">
              {diligencias.length === 0 ? 'Sin diligencias registradas' : 'Sin resultados con ese filtro'}
            </p>
            {diligencias.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">
                Registra OIs y diligencias vinculadas a esta causa
              </p>
            )}
          </div>
        ) : (
          filtered.map(dil => (
            <DilCard
              key={dil.id}
              dil={dil}
              expanded={expandedId === dil.id}
              onToggle={() => setExpandedId(expandedId === dil.id ? null : dil.id)}
              onSave={onSave}
              setTab={setTab}
            />
          ))
        )}
      </div>
    </div>
  )
}
