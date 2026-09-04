import { useState, useEffect, useMemo, useCallback } from 'react'
import { Inbox, Plus, X, Search, Loader2, ChevronDown, Copy, Check, Clock, Phone, User, Calendar, ChevronRight, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Estado config ─────────────────────────────────────────────────────────────
const ESTADOS = ['Por contactar', 'En gestión', 'Vencida', 'Cumplida']

const ESTADO_CFG = {
  'Por contactar': { chip: 'bg-amber-50 text-amber-700 border-amber-200',   border: 'border-l-[#C8862B]' },
  'En gestión':    { chip: 'bg-blue-50 text-blue-700 border-blue-200',      border: 'border-l-[#2570BA]' },
  'Vencida':       { chip: 'bg-red-50 text-red-700 border-red-200',         border: 'border-l-[#C0392B]' },
  'Cumplida':      { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-l-[#1E9E6A]' },
}

const GESTIONES_VIA = ['Llamada', 'SIAU', 'Correo', 'Pide-cuenta']

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function diasDesde(iso) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000))
}

function diasHasta(iso) {
  if (!iso) return null
  return Math.floor((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000)
}

// Calcula el texto del reloj: pide-cuenta vencida, o días sin cumplir
function clockInfo(dil) {
  if (dil.estado === 'Cumplida') return null
  if (dil.pide_cuenta) {
    const restantes = diasHasta(dil.pide_cuenta)
    if (restantes < 0) return { texto: `pide-cuenta vencido ${-restantes}d`, urgente: true }
    if (restantes <= 7) return { texto: `pide-cuenta en ${restantes}d`, urgente: false }
  }
  const base = dil.fecha_oi || dil.created_at?.slice(0, 10)
  if (base) {
    const d = diasDesde(base)
    return { texto: `${d}d sin cumplir`, urgente: d > 60 }
  }
  return null
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function doCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button onClick={doCopy} title="Copiar"
      className="ml-1 text-gray-300 hover:text-[#2570BA] transition-colors flex-shrink-0 no-touch-min">
      {copied ? <Check size={11} className="text-emerald-500"/> : <Copy size={11}/>}
    </button>
  )
}

// ── InlineText: edición al hacer clic, guarda en blur/Enter ──────────────────
function InlineText({ id, field, value, placeholder = '—', multi = false, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? '')

  // Sincronizar draft cuando value cambia externamente
  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  function commit() {
    setEditing(false)
    const v = draft.trim() || null
    if (v === (value?.trim() || null)) return
    onSave(id, field, v)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); return }
    if (!multi && e.key === 'Enter') { e.preventDefault(); commit() }
  }

  if (editing) {
    const cls = 'w-full text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none text-gray-700'
    return multi
      ? <textarea autoFocus rows={3} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={handleKeyDown}
          className={cls}/>
      : <input autoFocus value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={handleKeyDown}
          className={cls}/>
  }

  return (
    <span onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      className={`cursor-text text-xs rounded px-0.5 ${value ? 'text-gray-700' : 'text-gray-300 italic'} hover:bg-gray-50`}>
      {value || placeholder}
    </span>
  )
}

function InlineSelect({ id, field, value, options, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? options[0])
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
  const cfg = ESTADO_CFG[value] || {}
  return (
    <span onClick={() => { setDraft(value ?? options[0]); setEditing(true) }}
      className={`cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${cfg.chip || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {value || '—'}
    </span>
  )
}

function InlineDate({ id, field, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? '')
  useEffect(() => { if (!editing) setDraft(value ?? '') }, [value, editing])

  if (editing) {
    return (
      <input autoFocus type="date" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); const v = draft || null; if (v !== value) onSave(id, field, v) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) } }}
        className="text-xs bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none"/>
    )
  }
  return (
    <span onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      className={`cursor-text text-xs rounded px-0.5 ${value ? 'text-gray-700' : 'text-gray-300 italic'} hover:bg-gray-50`}>
      {value ? fmt(value) : '—'}
    </span>
  )
}

// ── Gestiones log ─────────────────────────────────────────────────────────────
function GestionesLog({ diligenciaId }) {
  const [gestiones, setGestiones] = useState(null)
  const [adding,    setAdding]    = useState(false)
  const [form,      setForm]      = useState({ fecha: new Date().toISOString().slice(0, 10), via: 'Llamada', detalle: '' })
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    supabase.from('diligencia_gestiones')
      .select('*')
      .eq('diligencia_id', diligenciaId)
      .order('fecha', { ascending: false })
      .then(({ data }) => setGestiones(data || []))
  }, [diligenciaId])

  async function handleAdd() {
    if (!form.detalle.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('diligencia_gestiones')
      .insert({ diligencia_id: diligenciaId, ...form })
      .select('*').single()
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
          className="text-[10px] text-[#2570BA] hover:underline no-touch-min">
          {adding ? 'Cancelar' : '+ Agregar gestión'}
        </button>
      </div>

      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
          <div className="flex gap-2">
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2570BA]"/>
            <select value={form.via} onChange={e => setForm(f => ({ ...f, via: e.target.value }))}
              className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#2570BA]">
              {GESTIONES_VIA.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <textarea rows={2} value={form.detalle} placeholder="¿Qué pasó? ¿Qué te dijeron?"
            onChange={e => setForm(f => ({ ...f, detalle: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd() }}
            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-[#2570BA] resize-none"/>
          <button onClick={handleAdd} disabled={saving || !form.detalle.trim()}
            className="text-[11px] bg-[#1A2E4A] text-white px-3 py-1 rounded hover:opacity-80 disabled:opacity-40 no-touch-min">
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

// ── Modal nueva diligencia ────────────────────────────────────────────────────
function ModalNueva({ causas, onSave, onClose }) {
  const [causaId, setCausaId] = useState('')
  const [oficio,  setOficio]  = useState('')
  const [q,       setQ]       = useState('')
  const [saving,  setSaving]  = useState(false)

  const lista = useMemo(() => {
    if (!q) return causas
    const lq = q.toLowerCase()
    return causas.filter(c =>
      (c.ruc || '').toLowerCase().includes(lq) ||
      (c.rit || '').toLowerCase().includes(lq) ||
      (c.materia || '').toLowerCase().includes(lq) ||
      (c.cliente_nombre || '').toLowerCase().includes(lq)
    )
  }, [causas, q])

  async function handleCreate() {
    if (!causaId) return
    setSaving(true)
    const { data, error } = await supabase.from('diligencias')
      .insert({ causa_id: causaId, oficio: oficio || null, nombre: 'Nueva diligencia', estado: 'Por contactar' })
      .select('*, causas(id,ruc,rit,materia,cliente_nombre)')
      .single()
    setSaving(false)
    if (!error && data) onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-5 w-[420px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-[#1A2E4A]">Nueva diligencia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 no-touch-min"><X size={16}/></button>
        </div>

        <label className="text-[11px] font-semibold text-gray-500 block mb-1">N° de OI u oficio (opcional)</label>
        <input value={oficio} onChange={e => setOficio(e.target.value)} placeholder="Ej: OI 11471-2025 · Oficio 2026-1502-14435"
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#2570BA] mb-3"/>

        <label className="text-[11px] font-semibold text-gray-500 block mb-1.5">Causa <span className="text-red-400">*</span></label>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por RUC, RIT, materia o cliente…"
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#2570BA] mb-2"/>
        <div className="flex-1 min-h-0 max-h-48 overflow-y-auto border border-gray-100 rounded-lg mb-4">
          {lista.length === 0
            ? <p className="text-[11px] text-gray-400 text-center py-4">Sin resultados</p>
            : lista.map(c => (
                <button key={c.id} onClick={() => setCausaId(c.id)}
                  className={`w-full text-left px-3 py-2 text-[11px] border-b border-gray-50 last:border-b-0 transition-colors ${causaId === c.id ? 'bg-blue-50 text-[#2570BA] font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                  <span className="font-medium">{c.ruc || c.rit || '—'}</span>
                  {c.materia && <span className="text-gray-400 ml-2 text-[10px]">{c.materia}</span>}
                  {c.cliente_nombre && <span className="text-gray-400 block text-[10px] mt-0.5 uppercase">{c.cliente_nombre}</span>}
                </button>
              ))
          }
        </div>
        <button onClick={handleCreate} disabled={!causaId || saving}
          className="w-full py-2 bg-[#1A2E4A] text-white text-[12px] font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
          {saving ? 'Guardando…' : 'Crear diligencia'}
        </button>
      </div>
    </div>
  )
}

// ── DiligenciaCard ────────────────────────────────────────────────────────────
function DiligenciaCard({ dil, expanded, onToggle, onSave }) {
  const causa = dil.causas
  const cfg   = ESTADO_CFG[dil.estado] || { chip: 'bg-gray-50 text-gray-500 border-gray-200', border: 'border-l-gray-200' }
  const clock = clockInfo(dil)

  const titulo = dil.oficio || 'Sin número · gestión propia'
  const tieneOficio = !!dil.oficio

  const [lastGestion, setLastGestion] = useState(null)
  useEffect(() => {
    supabase.from('diligencia_gestiones')
      .select('fecha, via')
      .eq('diligencia_id', dil.id)
      .order('fecha', { ascending: false })
      .limit(1)
      .then(({ data }) => { if (data?.[0]) setLastGestion(data[0]) })
  }, [dil.id])

  return (
    <div className={`border border-[#E3E7EC] rounded-xl bg-white mb-3 border-l-4 ${cfg.border} overflow-hidden shadow-sm hover:shadow transition-shadow`}>
      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* Título + estado + reloj */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[13px] font-bold ${tieneOficio ? 'text-gray-800' : 'text-gray-400 italic'}`}>{titulo}</span>
              {tieneOficio && <CopyBtn text={dil.oficio}/>}
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${cfg.chip}`}>
                {dil.estado || '—'}
              </span>
              {clock && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${clock.urgente ? 'text-red-500' : 'text-gray-400'}`}>
                  <Clock size={9}/>{clock.texto}
                </span>
              )}
            </div>
            {/* Descripción */}
            {dil.nombre && dil.nombre !== 'Nueva diligencia' && (
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">{dil.nombre}</p>
            )}
          </div>
          <ChevronRight size={14} className={`text-gray-300 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`}/>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {dil.fecha_oi && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Calendar size={9}/>{fmt(dil.fecha_oi)}
            </span>
          )}
          {dil.organismo && (
            <span className="text-[10px] text-gray-500 font-medium">{dil.organismo}</span>
          )}
          {dil.funcionario ? (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <User size={9}/>{dil.funcionario}
              {dil.funcionario_telefono && (
                <span className="flex items-center gap-0.5 ml-1">
                  <Phone size={9}/>{dil.funcionario_telefono}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
              <AlertTriangle size={9}/>sin endosar — averiguar a quién se asignó
            </span>
          )}
          {lastGestion && (
            <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">
              Últ. gestión: {fmt(lastGestion.fecha)} · {lastGestion.via}
            </span>
          )}
          {causa && (
            <span className="text-[10px] text-[#2570BA] font-mono ml-auto">{causa.ruc || causa.rit || '—'}</span>
          )}
        </div>
      </div>

      {/* Vista expandida */}
      {expanded && (
        <div className="border-t border-dashed border-[#E3E7EC] px-4 py-4 bg-[#F5F6F8]/60">
          {/* Grid de propiedades */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-[11px] mb-4">
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">N° oficio / OI</span>
              <InlineText id={dil.id} field="oficio" value={dil.oficio} placeholder="Agregar…" onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Estado</span>
              <InlineSelect id={dil.id} field="estado" value={dil.estado} options={ESTADOS} onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Pide cuenta</span>
              <div className="flex items-center gap-1.5">
                <InlineDate id={dil.id} field="pide_cuenta" value={dil.pide_cuenta} onSave={onSave}/>
                {dil.pide_cuenta && diasHasta(dil.pide_cuenta) < 0 && (
                  <span className="text-[10px] text-red-500 font-semibold">vencido {-diasHasta(dil.pide_cuenta)}d</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Fecha OI</span>
              <InlineDate id={dil.id} field="fecha_oi" value={dil.fecha_oi} onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Organismo</span>
              <InlineText id={dil.id} field="organismo" value={dil.organismo} onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Dirección</span>
              <InlineText id={dil.id} field="organismo_direccion" value={dil.organismo_direccion} onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Funcionario</span>
              <InlineText id={dil.id} field="funcionario" value={dil.funcionario} onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Teléfono</span>
              <InlineText id={dil.id} field="funcionario_telefono" value={dil.funcionario_telefono} onSave={onSave}/>
            </div>
            <div>
              <span className="text-gray-400 font-medium block mb-0.5">Próximo paso</span>
              <InlineText id={dil.id} field="proximo_paso" value={dil.proximo_paso} onSave={onSave}/>
            </div>
            {causa && (
              <div className="col-span-2 sm:col-span-3">
                <span className="text-gray-400 font-medium block mb-0.5">Causa</span>
                <span className="text-[11px] text-gray-600">{causa.ruc || causa.rit} — <span className="uppercase">{causa.cliente_nombre}</span></span>
              </div>
            )}
          </div>

          {/* Instrucción / descripción */}
          <div className="mb-4">
            <span className="text-gray-400 font-medium text-[11px] block mb-1">Descripción de la instrucción</span>
            <InlineText id={dil.id} field="nombre" value={dil.nombre !== 'Nueva diligencia' ? dil.nombre : ''} placeholder="Describe la instrucción…" multi onSave={onSave}/>
          </div>

          <div className="border-t border-dashed border-[#E3E7EC] my-3"/>

          {/* Gestiones */}
          <div className="mb-4">
            <GestionesLog diligenciaId={dil.id}/>
          </div>

          <div className="border-t border-dashed border-[#E3E7EC] my-3"/>

          {/* Notas */}
          <div>
            <span className="text-gray-400 font-medium text-[11px] block mb-1">Notas</span>
            <InlineText id={dil.id} field="notas" value={dil.notas} placeholder="Agregar notas…" multi onSave={onSave}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Diligencias() {
  const [rows,      setRows]      = useState([])
  const [causas,    setCausas]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  const [fEstado,   setFEstado]   = useState('todas')
  const [fCausaId,  setFCausaId]  = useState('')
  const [fBusqueda, setFBusqueda] = useState('')
  const [expId,     setExpId]     = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('diligencias')
        .select('*, causas(id,ruc,rit,materia,cliente_nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('causas')
        .select('id,ruc,rit,materia,cliente_nombre')
        .order('cliente_nombre'),
    ]).then(([{ data: rs }, { data: cs }]) => {
      setRows(rs || [])
      setCausas(cs || [])
      setLoading(false)
    })
  }, [])

  const onSave = useCallback(async (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await supabase.from('diligencias').update({ [field]: value }).eq('id', id)
  }, [])

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    todas:          rows.length,
    'Por contactar': rows.filter(r => r.estado === 'Por contactar').length,
    'En gestión':    rows.filter(r => r.estado === 'En gestión').length,
    'Vencida':       rows.filter(r => r.estado === 'Vencida').length,
    'Cumplida':      rows.filter(r => r.estado === 'Cumplida').length,
  }), [rows])

  // ── Filtered ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = rows
    if (fEstado !== 'todas') r = r.filter(x => x.estado === fEstado)
    if (fCausaId) r = r.filter(x => x.causa_id === fCausaId)
    if (fBusqueda) {
      const lq = fBusqueda.toLowerCase()
      r = r.filter(x =>
        (x.oficio || '').toLowerCase().includes(lq) ||
        (x.nombre || '').toLowerCase().includes(lq) ||
        (x.organismo || '').toLowerCase().includes(lq) ||
        (x.funcionario || '').toLowerCase().includes(lq) ||
        (x.proximo_paso || '').toLowerCase().includes(lq) ||
        (x.causas?.ruc || '').toLowerCase().includes(lq) ||
        (x.causas?.rit || '').toLowerCase().includes(lq) ||
        (x.causas?.cliente_nombre || '').toLowerCase().includes(lq)
      )
    }
    return r
  }, [rows, fEstado, fCausaId, fBusqueda])

  const causasConDil = useMemo(() => {
    const ids = new Set(rows.map(r => r.causa_id).filter(Boolean))
    return causas.filter(c => ids.has(c.id))
  }, [causas, rows])

  function handleSave(data) {
    setRows(prev => [data, ...prev])
    setShowModal(false)
    setExpId(data.id)
  }

  const FILTER_TABS = [
    { key: 'todas',          label: 'Todas',         urgent: false },
    { key: 'Por contactar',  label: 'Por contactar', urgent: false },
    { key: 'En gestión',     label: 'En gestión',    urgent: false },
    { key: 'Vencida',        label: 'Vencidas',      urgent: true  },
    { key: 'Cumplida',       label: 'Cumplidas',     urgent: false },
  ]

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-[#E3E7EC] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Inbox size={18} className="text-[#2570BA]"/>
            <h1 className="text-lg font-bold text-[#1a2e4a]">Diligencias</h1>
            <span className="text-[11px] text-gray-400 tabular-nums">{rows.length} total</span>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#2570BA] text-white px-4 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors shadow-sm no-touch-min">
            <Plus size={14}/> Nueva diligencia
          </button>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_TABS.map(f => (
              <button key={f.key} onClick={() => setFEstado(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors no-touch-min ${
                  fEstado === f.key
                    ? f.urgent ? 'bg-[#C0392B] text-white' : 'bg-[#1A2E4A] text-white'
                    : f.urgent && counts['Vencida'] > 0
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {f.label}
                {' '}<span className="opacity-70 tabular-nums">({counts[f.key] ?? 0})</span>
              </button>
            ))}
          </div>

          {/* Causa dropdown */}
          <div className="relative">
            <select value={fCausaId} onChange={e => setFCausaId(e.target.value)}
              className="appearance-none text-[11px] text-gray-600 bg-white border border-[#E3E7EC] rounded-lg pl-3 pr-7 py-1 outline-none hover:border-gray-300 max-w-[200px] truncate cursor-pointer">
              <option value="">Todas las causas</option>
              {causasConDil.map(c => (
                <option key={c.id} value={c.id}>{c.ruc || c.rit} — {c.cliente_nombre}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"/>
            <input value={fBusqueda} onChange={e => setFBusqueda(e.target.value)} placeholder="Buscar…"
              className="text-[11px] text-gray-600 bg-white border border-[#E3E7EC] rounded-lg pl-6 pr-6 py-1 outline-none hover:border-gray-300 w-32 focus:w-44 transition-all"/>
            {fBusqueda && (
              <button onClick={() => setFBusqueda('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 no-touch-min">
                <X size={10}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de tarjetas */}
      <div className="flex-1 overflow-auto px-5 py-4 fab-clear">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Inbox size={32} className="text-gray-200 mb-3"/>
            <p className="text-[14px] text-gray-400">
              {rows.length === 0 ? 'Sin diligencias registradas' : 'Sin resultados con ese filtro'}
            </p>
          </div>
        ) : filtered.map(dil => (
          <DiligenciaCard
            key={dil.id}
            dil={dil}
            expanded={expId === dil.id}
            onToggle={() => setExpId(expId === dil.id ? null : dil.id)}
            onSave={onSave}
          />
        ))}
      </div>

      {showModal && (
        <ModalNueva causas={causas} onSave={handleSave} onClose={() => setShowModal(false)}/>
      )}
    </div>
  )
}
