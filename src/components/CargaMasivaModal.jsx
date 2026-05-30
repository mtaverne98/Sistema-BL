import { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Plus, Trash2, Upload, Check, Loader2,
  ChevronDown, Table2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const ESTADO_SEG_OPTS = ['Pendiente', 'En proceso', 'Completado', 'Bloqueado']

function emptyRow(modulo) {
  if (modulo === 'seguimiento') {
    return { fecha: TODAY, por_hacer: '', estado: 'Pendiente', notas: '' }
  }
  return { fecha: TODAY, folio: '', solicitud: '', respuesta: '', documento: false, notas: '' }
}

function makeRows(n, modulo) {
  return Array.from({ length: n }, () => emptyRow(modulo))
}

function isRowEmpty(row, modulo) {
  if (modulo === 'seguimiento') {
    return !row.por_hacer?.trim() && !row.notas?.trim()
  }
  return !row.folio.trim() && !row.solicitud.trim() && !row.respuesta.trim() && !row.notas.trim()
}

function isValidDate(str) {
  if (!str) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str + 'T00:00:00').getTime())
}

// Parse a TSV/CSV line from Excel paste (handles quoted fields)
function parseTsvRow(line) {
  const cells = []
  let cell = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === '\t' && !inQuote) {
      cells.push(cell); cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells
}

// Try to parse a date string from various formats → YYYY-MM-DD or original
function normalizeDate(str) {
  if (!str) return TODAY
  const s = str.trim()
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or D/M/YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // MM/DD/YYYY
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (m2) return `20${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`
  return s
}

// ── SearchDropdown ─────────────────────────────────────────────────────────────
function SearchDropdown({ label, value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )
  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setQuery('') }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[13px] transition-colors text-left ${
          disabled
            ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
            : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 cursor-pointer'
        }`}
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full text-[12px] px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-300"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-3">Sin resultados</p>
            ) : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50 transition-colors ${
                  value === o.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {o.label}
                {o.sub && <span className="ml-1.5 text-[10px] text-gray-400">{o.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CargaMasivaModal ───────────────────────────────────────────────────────────
// modulo: 'siau' | 'pjud' | 'seguimiento' | 'seguimiento_rev'
// 'seguimiento_rev' = carga masiva para el tab Seguimiento dentro de Causas
//                     (guarda en tabla 'revisiones' con semana_key=null)
export default function CargaMasivaModal({ modulo, allCausas, defaultCausaRit, onClose, onSuccess }) {
  const isSeg    = modulo === 'seguimiento' || modulo === 'seguimiento_rev'
  const isSegRev = modulo === 'seguimiento_rev'

  // Auto-seleccionar si hay una sola causa (o defaultCausaRit)
  const autoCliente = allCausas.length === 1 ? (allCausas[0].cliente_nombre ?? '') : ''
  const autoRit     = defaultCausaRit
    ?? (allCausas.length === 1 ? (allCausas[0].rit ?? '') : '')

  const [step, setStep]             = useState(1)
  const [clienteSel, setClienteSel] = useState(autoCliente)
  const [causaSel, setCausaSel]     = useState(autoRit)
  const [rows, setRows]             = useState(() => makeRows(5, modulo))
  const [saving, setSaving]         = useState(false)
  const [savedCount, setSavedCount] = useState(null)
  const [error, setError]           = useState(null)
  const tableRef = useRef(null)

  // Derived options
  const clienteOptions = Array.from(
    new Map(allCausas.map(c => [c.cliente_nombre, c.cliente_nombre])).entries()
  )
    .map(([k]) => ({ value: k, label: k }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const causaOptions = allCausas
    .filter(c => !clienteSel || c.cliente_nombre === clienteSel)
    .map(c => ({ value: c.rit, label: c.rit, sub: c.materia || c.tribunal || '' }))
    .sort((a, b) => (a.value || '').localeCompare(b.value || '', 'es'))

  const causaObj = allCausas.find(c => c.rit === causaSel) ?? null

  // When client changes, clear causa if it no longer matches
  useEffect(() => {
    if (clienteSel && causaObj && causaObj.cliente_nombre !== clienteSel) setCausaSel('')
  }, [clienteSel])

  // ── Excel paste ──────────────────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    if (!tableRef.current?.contains(e.target)) return
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text.includes('\t') && !text.includes('\n')) return // not multi-cell
    e.preventDefault()

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
    const parsed = lines.map(line => {
      const cells = parseTsvRow(line)
      if (isSeg) {
        const estadoRaw = (cells[2] ?? '').trim()
        const estadoNorm = ESTADO_SEG_OPTS.find(o => o.toLowerCase() === estadoRaw.toLowerCase()) || (estadoRaw || 'Pendiente')
        return {
          fecha:    normalizeDate(cells[0] ?? ''),
          por_hacer: (cells[1] ?? '').trim(),
          estado:   estadoNorm,
          notas:    (cells[3] ?? '').trim(),
        }
      }
      return {
        fecha:     normalizeDate(cells[0] ?? ''),
        folio:     (cells[1] ?? '').trim(),
        solicitud: (cells[2] ?? '').trim(),
        respuesta: (cells[3] ?? '').trim(),
        documento: ['si','sí','1','true','x','yes'].includes((cells[4] ?? '').trim().toLowerCase()),
        notas:     (cells[5] ?? '').trim(),
      }
    }).filter(r => !isRowEmpty(r, modulo))

    if (parsed.length === 0) return
    setRows(prev => {
      // Find target row (the focused input's row index)
      const focused = tableRef.current?.querySelector('input:focus, textarea:focus')
      const focusedRow = focused?.closest('tr')
      const allTrs = tableRef.current?.querySelectorAll('tbody tr') ?? []
      let startIdx = 0
      allTrs.forEach((tr, i) => { if (tr === focusedRow) startIdx = i })

      const merged = [...prev]
      parsed.forEach((r, i) => {
        const idx = startIdx + i
        if (idx < merged.length) {
          merged[idx] = r
        } else {
          merged.push(r)
        }
      })
      return merged
    })
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // ── Row ops ──────────────────────────────────────────────────────────────────
  const updateRow = (idx, key, value) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  const addRow = () => setRows(prev => [...prev, emptyRow(modulo)])
  const removeRow = (idx) => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)

  // ── Validations ──────────────────────────────────────────────────────────────
  const filledRows = rows.filter(r => !isRowEmpty(r, modulo))
  const rowErrors = filledRows.map(r => {
    if (!isValidDate(r.fecha)) return 'Fecha inválida'
    if (isSeg) {
      if (!r.por_hacer?.trim()) return 'Por hacer es requerido'
    } else {
      if (!r.solicitud?.trim() && !r.folio?.trim()) return 'Folio o solicitud requeridos'
    }
    return null
  })
  const hasErrors = rowErrors.some(Boolean)
  const canGoStep2 = clienteSel && causaSel
  const canSave = !saving && filledRows.length > 0 && !hasErrors

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!canSave || !causaObj) return
    setSaving(true)
    setError(null)

    const payloads = filledRows.map(r => {
      const base = {
        notas:          r.notas?.trim()     || null,
        causa_rit:      causaObj.rit,
        cliente_nombre: causaObj.cliente_nombre,
        causa_id:       causaObj.id        || null,
        cliente_id:     causaObj.cliente_id || null,
      }
      if (isSegRev) {
        // Tab Seguimiento en Causas → tabla revisiones
        return {
          ...base,
          fecha_revision: r.fecha || null,
          por_hacer:      r.por_hacer?.trim() || null,
          que_se_hizo:    r.estado || 'Pendiente',
          semana_key:     null,
          revisada:       false,
        }
      } else if (isSeg) {
        return {
          ...base,
          fecha:     r.fecha,
          por_hacer: r.por_hacer?.trim() || null,
          estado:    r.estado || 'Pendiente',
        }
      } else if (modulo === 'siau') {
        return {
          ...base,
          folio:     r.folio?.trim()     || null,
          solicitud: r.solicitud?.trim() || null,
          respuesta: r.respuesta?.trim() || null,
          estado:    r.respuesta?.trim() ? 'Respondida' : 'Pendiente',
          documentos: r.documento ? 'Sí' : '',
        }
      } else {
        return {
          ...base,
          folio:           r.folio?.trim()     || null,
          solicitud:       r.solicitud?.trim() || null,
          respuesta:       r.respuesta?.trim() || null,
          estado:          r.respuesta?.trim() ? 'Respondido' : 'Pendiente',
          tiene_documento: r.documento,
          documento_desc:  '',
          presenta:        'Nosotros',
          responsable:     'MT',
        }
      }
    })

    const tableName = isSegRev ? 'revisiones' : isSeg ? 'seguimiento' : modulo
    const { data, error: err } = await supabase.from(tableName).insert(payloads).select()
    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    setSavedCount(data.length)
    onSuccess(data)
    setSaving(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const tableName = isSegRev ? 'Seguimiento' : isSeg ? 'Seguimiento Semanal' : modulo === 'siau' ? 'SIAU' : 'PJUD'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1a2e4a]/8 flex items-center justify-center">
              <Table2 size={15} className="text-[#1a2e4a]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Carga masiva · {tableName}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Ingresa múltiples registros de una vez</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              {[1, 2].map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                    step >= s ? 'bg-[#2570BA] text-white' : 'bg-gray-100 text-gray-400'
                  }`}>{s}</div>
                  {s < 2 && <div className={`w-6 h-px ${step > s ? 'bg-[#2570BA]' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Saved state */}
        {savedCount !== null ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold text-gray-900">{savedCount} {savedCount === 1 ? 'registro cargado' : 'registros cargados'}</p>
              <p className="text-[13px] text-gray-400 mt-1">Los registros se añadieron a {tableName} correctamente</p>
            </div>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-[#2570BA] hover:bg-[#2570BA]/90 text-white text-[13px] font-medium rounded-lg transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* STEP 1 — Selector */}
              <div className="px-6 py-5 border-b border-gray-50">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Paso 1 · Selecciona cliente y causa</p>
                <div className="grid grid-cols-2 gap-4">
                  <SearchDropdown
                    label="Cliente"
                    value={clienteSel}
                    onChange={v => { setClienteSel(v); setCausaSel('') }}
                    options={clienteOptions}
                    placeholder="Seleccionar cliente…"
                  />
                  <SearchDropdown
                    label="Causa (RIT)"
                    value={causaSel}
                    onChange={setCausaSel}
                    options={causaOptions}
                    placeholder="Seleccionar causa…"
                    disabled={!clienteSel}
                  />
                </div>
                {causaObj && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                    <Check size={12} className="text-emerald-500" />
                    <span className="font-medium text-gray-700">{causaObj.rit}</span>
                    {causaObj.materia && <span>· {causaObj.materia}</span>}
                    {causaObj.tribunal && <span>· {causaObj.tribunal}</span>}
                  </div>
                )}
              </div>

              {/* STEP 2 — Table */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Paso 2 · Ingresa los registros
                    <span className="ml-2 text-[10px] font-normal text-gray-400 normal-case">
                      · Pega desde Excel con Cmd+V / Ctrl+V · Columnas:{' '}
                      {isSeg
                        ? 'Fecha · Por hacer · Estado · Notas'
                        : 'Fecha · Folio · Solicitud · Respuesta · Documento · Notas'
                      }
                    </span>
                  </p>
                  <span className="text-[11px] text-gray-400 tabular-nums">{filledRows.length} con contenido</span>
                </div>

                {/* Table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full" ref={tableRef}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-32">Fecha</th>
                        {isSeg ? (
                          <>
                            <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Por hacer</th>
                            <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-36">Estado</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-24">Folio</th>
                            <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Solicitud</th>
                            <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Respuesta</th>
                            <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-16">Doc.</th>
                          </>
                        )}
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Notas</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const filled = !isRowEmpty(row, modulo)
                        const dateErr = filled && !isValidDate(row.fecha)
                        return (
                          <tr key={idx} className={`border-b border-gray-100 last:border-0 ${filled ? 'bg-white' : 'bg-gray-50/40'}`}>
                            {/* Fecha */}
                            <td className="px-2 py-1.5">
                              <input
                                type="date"
                                value={row.fecha}
                                onChange={e => updateRow(idx, 'fecha', e.target.value)}
                                className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:ring-1 transition-colors ${
                                  dateErr
                                    ? 'border-red-300 bg-red-50 focus:ring-red-200'
                                    : 'border-gray-200 bg-white focus:ring-blue-200 focus:border-blue-300'
                                }`}
                              />
                            </td>

                            {isSeg ? (
                              <>
                                {/* Por hacer */}
                                <td className="px-2 py-1.5">
                                  <textarea
                                    value={row.por_hacer}
                                    onChange={e => updateRow(idx, 'por_hacer', e.target.value)}
                                    placeholder="Tarea o acción pendiente…"
                                    rows={1}
                                    className="w-full text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder-gray-300 resize-none transition-colors"
                                    onInput={e => { e.target.style.height = ''; e.target.style.height = e.target.scrollHeight + 'px' }}
                                  />
                                </td>
                                {/* Estado */}
                                <td className="px-2 py-1.5">
                                  <select
                                    value={row.estado}
                                    onChange={e => updateRow(idx, 'estado', e.target.value)}
                                    className="w-full text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
                                  >
                                    {ESTADO_SEG_OPTS.map(o => <option key={o}>{o}</option>)}
                                  </select>
                                </td>
                              </>
                            ) : (
                              <>
                                {/* Folio */}
                                <td className="px-2 py-1.5">
                                  <input
                                    value={row.folio}
                                    onChange={e => updateRow(idx, 'folio', e.target.value)}
                                    placeholder="—"
                                    className="w-full text-[11px] font-mono px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder-gray-300 transition-colors"
                                  />
                                </td>
                                {/* Solicitud */}
                                <td className="px-2 py-1.5">
                                  <textarea
                                    value={row.solicitud}
                                    onChange={e => updateRow(idx, 'solicitud', e.target.value)}
                                    placeholder="Descripción…"
                                    rows={1}
                                    className="w-full text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder-gray-300 resize-none transition-colors"
                                    onInput={e => { e.target.style.height = ''; e.target.style.height = e.target.scrollHeight + 'px' }}
                                  />
                                </td>
                                {/* Respuesta */}
                                <td className="px-2 py-1.5">
                                  <textarea
                                    value={row.respuesta}
                                    onChange={e => updateRow(idx, 'respuesta', e.target.value)}
                                    placeholder="—"
                                    rows={1}
                                    className="w-full text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder-gray-300 resize-none transition-colors"
                                    onInput={e => { e.target.style.height = ''; e.target.style.height = e.target.scrollHeight + 'px' }}
                                  />
                                </td>
                                {/* Documento */}
                                <td className="px-2 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={row.documento}
                                    onChange={e => updateRow(idx, 'documento', e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-200 cursor-pointer"
                                  />
                                </td>
                              </>
                            )}

                            {/* Notas */}
                            <td className="px-2 py-1.5">
                              <input
                                value={row.notas}
                                onChange={e => updateRow(idx, 'notas', e.target.value)}
                                placeholder="—"
                                className="w-full text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder-gray-300 transition-colors"
                              />
                            </td>
                            {/* Delete */}
                            <td className="px-1 py-1.5">
                              <button
                                onClick={() => removeRow(idx)}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add row */}
                <button
                  onClick={addRow}
                  className="mt-2 flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-[#1a2e4a] font-medium transition-colors px-1 py-1"
                >
                  <Plus size={13} />
                  Agregar fila
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
              <div className="flex items-center gap-2">
                {!canGoStep2 && (
                  <p className="text-[12px] text-gray-400 flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-amber-400" />
                    Selecciona un cliente y una causa para guardar
                  </p>
                )}
                {canGoStep2 && hasErrors && (
                  <p className="text-[12px] text-red-500 flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    Revisa las fechas inválidas antes de guardar
                  </p>
                )}
                {canGoStep2 && !hasErrors && filledRows.length === 0 && (
                  <p className="text-[12px] text-gray-400">Agrega al menos una fila con contenido</p>
                )}
                {error && (
                  <p className="text-[12px] text-red-500 flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={onClose} className="text-[13px] text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || !canGoStep2}
                  className="flex items-center gap-2 px-4 py-1.5 bg-[#2570BA] hover:bg-[#2570BA]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-lg transition-colors"
                >
                  {saving
                    ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                    : <><Upload size={13} /> Guardar {filledRows.length > 0 ? `${filledRows.length} registro${filledRows.length > 1 ? 's' : ''}` : 'registros'}</>
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
