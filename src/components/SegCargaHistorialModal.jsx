import { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Plus, Trash2, Upload, Check, Loader2,
  AlertCircle, CheckCircle2, Table2, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────────
function emptyRow() {
  return { fecha: '', por_hacer: '', que_se_hizo: '', notas: '', proxima_accion: '', responsable: 'MT' }
}

function isRowEmpty(row) {
  return (
    !row.fecha.trim() &&
    !row.por_hacer.trim() &&
    !row.que_se_hizo.trim() &&
    !row.notas.trim() &&
    !row.proxima_accion.trim()
  )
}

function isValidDate(str) {
  if (!str) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str + 'T00:00:00').getTime())
}

// Normalize various date formats → YYYY-MM-DD
function normalizeDate(str) {
  if (!str) return ''
  const s = str.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s                               // ISO already
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}` // DD/MM/YYYY
  const m2 = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}` // YYYY/MM/DD
  // Excel serial number (numeric, 5 digits)
  if (/^\d{5}$/.test(s)) {
    const epoch = new Date(1899, 11, 30)
    epoch.setDate(epoch.getDate() + parseInt(s))
    return epoch.toISOString().slice(0, 10)
  }
  return s
}

// Date string → ISO week → SEG-YYYY-Www
function dateToSegKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const dow  = d.getDay() === 0 ? 7 : d.getDay()        // Mon=1 … Sun=7
  const thu  = new Date(d)
  thu.setDate(d.getDate() - dow + 4)                     // Thursday of the same week
  const yearStart = new Date(thu.getFullYear(), 0, 1)
  const weekNum   = Math.ceil(((thu - yearStart) / 86400000 + 1) / 7)
  return `SEG-${thu.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// Readable label for a semana_key
function fmtSemanaKey(key) {
  return key?.replace('SEG-', '') ?? key
}

// Parse a TSV line respecting quoted fields (Excel paste)
function parseTsvRow(line) {
  const cells = []
  let cell = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === '\t' && !inQuote) { cells.push(cell); cell = '' }
    else cell += ch
  }
  cells.push(cell)
  return cells
}

const RESPONSABLE_VALID = new Set(['MT', 'AB', 'CL'])

// ── SegCargaHistorialModal ─────────────────────────────────────────────────────
export default function SegCargaHistorialModal({ causa, onClose, onSuccess }) {
  const [rows,       setRows]      = useState(() => Array.from({ length: 5 }, emptyRow))
  const [saving,     setSaving]    = useState(false)
  const [savedCount, setSavedCount]= useState(null)
  const [error,      setError]     = useState(null)
  // conflict state: { keys: string[], action: null | 'overwrite' | 'skip' }
  const [conflict,   setConflict]  = useState(null)
  const tableRef = useRef(null)

  // ── Excel paste ──────────────────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    if (!tableRef.current?.contains(e.target)) return
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text.includes('\t') && !text.includes('\n')) return   // single cell → let browser handle
    e.preventDefault()

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
    const parsed = lines.map(line => {
      const c = parseTsvRow(line)
      const resp = (c[5] ?? '').trim().toUpperCase()
      return {
        fecha:          normalizeDate(c[0] ?? ''),
        por_hacer:      (c[1] ?? '').trim(),
        que_se_hizo:    (c[2] ?? '').trim(),
        notas:          (c[3] ?? '').trim(),
        proxima_accion: (c[4] ?? '').trim(),
        responsable:    RESPONSABLE_VALID.has(resp) ? resp : 'MT',
      }
    }).filter(r => !isRowEmpty(r))

    if (parsed.length === 0) return

    setRows(prev => {
      const focused = tableRef.current?.querySelector('input:focus, textarea:focus')
      const focusedTr = focused?.closest('tr')
      let startIdx = 0
      tableRef.current?.querySelectorAll('tbody tr').forEach((tr, i) => {
        if (tr === focusedTr) startIdx = i
      })
      const merged = [...prev]
      parsed.forEach((r, i) => {
        const idx = startIdx + i
        if (idx < merged.length) merged[idx] = r
        else merged.push(r)
      })
      return merged
    })
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // ── Row mutations ────────────────────────────────────────────────────────────
  const updateRow = (idx, key, val) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  const addRow    = ()    => setRows(prev => [...prev, emptyRow()])
  const removeRow = (idx) => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filledRows = rows.filter(r => !isRowEmpty(r))
  const dateErrors = rows.reduce((acc, r, i) => {
    if (isRowEmpty(r)) return acc
    if (!r.fecha) acc.push(`Fila ${i + 1}: fecha requerida`)
    else if (!isValidDate(r.fecha)) acc.push(`Fila ${i + 1}: "${r.fecha}" no es una fecha válida`)
    return acc
  }, [])
  const canSave = !saving && filledRows.length > 0 && dateErrors.length === 0

  // ── Save flow ────────────────────────────────────────────────────────────────
  async function handleSaveClick() {
    if (!canSave) return
    setError(null)

    // Check for existing semana_keys for this causa
    const keys = filledRows.map(r => dateToSegKey(r.fecha))
    const { data: existing } = await supabase
      .from('revisiones')
      .select('semana_key')
      .eq('causa_id', causa.id)
      .in('semana_key', keys)

    const existingKeys = (existing || []).map(e => e.semana_key)
    const duplicates   = [...new Set(keys.filter(k => existingKeys.includes(k)))]

    if (duplicates.length > 0) {
      setConflict({ keys: duplicates, action: null })
    } else {
      await doSave(filledRows)
    }
  }

  async function resolveConflict(action) {
    // action: 'overwrite' | 'skip'
    const skipKeys = new Set(action === 'skip' ? conflict.keys : [])
    const toSave   = filledRows.filter(r => !skipKeys.has(dateToSegKey(r.fecha)))
    setConflict(null)
    if (toSave.length === 0) { setSavedCount(0); return }
    await doSave(toSave)
  }

  async function doSave(rowsToSave) {
    setSaving(true)
    setError(null)

    const payloads = rowsToSave.map(r => ({
      causa_id:       causa.id,
      causa_rit:      causa.rit        || '',
      cliente_nombre: causa.cliente_nombre || '',
      semana_key:     dateToSegKey(r.fecha),
      fecha:          r.fecha,
      por_hacer:      r.por_hacer.trim()      || null,
      que_se_hizo:    r.que_se_hizo.trim()    || null,
      estado_seg:     null,
      proxima_accion: r.proxima_accion.trim() || null,
      nota:           r.notas.trim()          || null,
      responsable:    r.responsable           || 'MT',
      revisada:       false,
    }))

    const { data, error: err } = await supabase
      .from('revisiones')
      .upsert(payloads, { onConflict: 'semana_key,causa_id' })
      .select()

    if (err) { setError(err.message); setSaving(false); return }
    setSavedCount(data?.length ?? rowsToSave.length)
    onSuccess(data ?? [])
    setSaving(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Table2 size={15} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Cargar historial de seguimiento</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {causa.cliente_nombre && <span className="font-medium text-gray-600">{causa.cliente_nombre}</span>}
                {causa.rit && <span> · {causa.rit}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {/* ── Success screen ── */}
        {savedCount !== null ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold text-gray-900">
                {savedCount === 0
                  ? 'No se guardaron registros'
                  : `${savedCount} ${savedCount === 1 ? 'semana cargada' : 'semanas cargadas'}`
                }
              </p>
              <p className="text-[13px] text-gray-400 mt-1">
                {savedCount === 0
                  ? 'Todos los registros ya existían y fueron omitidos'
                  : 'El historial se añadió al seguimiento de la causa'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>

        ) : conflict ? (
          /* ── Conflict resolution screen ── */
          <div className="flex flex-col items-center justify-center py-12 px-8 gap-5">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <AlertCircle size={22} className="text-amber-500" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-[15px] font-semibold text-gray-900">Semanas ya existentes</p>
              <p className="text-[13px] text-gray-500 mt-2">
                {conflict.keys.length === 1
                  ? 'La siguiente semana ya tiene registro en esta causa:'
                  : `Las siguientes ${conflict.keys.length} semanas ya tienen registro en esta causa:`
                }
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {conflict.keys.map(k => (
                  <span key={k} className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    {fmtSemanaKey(k)}
                  </span>
                ))}
              </div>
              <p className="text-[12px] text-gray-400 mt-3">¿Qué deseas hacer con estas semanas?</p>
            </div>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => resolveConflict('skip')}
                className="px-4 py-2 border border-gray-200 hover:border-gray-300 text-gray-600 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Omitir duplicadas
              </button>
              <button
                onClick={() => resolveConflict('overwrite')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium rounded-lg transition-colors"
              >
                Sobreescribir todas
              </button>
            </div>
            <button
              onClick={() => setConflict(null)}
              className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Volver a editar
            </button>
          </div>

        ) : (
          <>
            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-5">

                {/* Instructions strip */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] text-gray-400">
                    <span className="font-semibold text-gray-500 uppercase tracking-wide">Columnas de Excel:</span>
                    {' '}Fecha · Por hacer · Estado/Qué se hizo · Notas · Próxima acción · Responsable
                    <span className="ml-2 text-[10px]">— Pega con <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[10px]">Cmd+V</kbd></span>
                  </p>
                  <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0 ml-4">
                    {filledRows.length} con contenido
                  </span>
                </div>

                {/* Scrollable table wrapper */}
                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[860px]" ref={tableRef}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-[120px]">Fecha</th>
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Por hacer</th>
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Estado / Qué se hizo</th>
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-[140px]">Notas</th>
                        <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-[160px]">Próxima acción</th>
                        <th className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 w-[72px]">Resp.</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const filled   = !isRowEmpty(row)
                        const dateErr  = filled && row.fecha && !isValidDate(row.fecha)
                        const cellBase = 'w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:ring-1 transition-colors placeholder-gray-300'
                        const cellOk   = `${cellBase} border-gray-200 bg-white focus:ring-indigo-200 focus:border-indigo-300`
                        const cellErr  = `${cellBase} border-red-300 bg-red-50 focus:ring-red-200`

                        return (
                          <tr
                            key={idx}
                            className={`border-b border-gray-100 last:border-0 ${filled ? 'bg-white' : 'bg-gray-50/30'}`}
                          >
                            {/* Fecha */}
                            <td className="px-2 py-1.5">
                              <input
                                type="date"
                                value={row.fecha}
                                onChange={e => updateRow(idx, 'fecha', e.target.value)}
                                className={dateErr ? cellErr : cellOk}
                                title={dateErr ? 'Fecha inválida' : undefined}
                              />
                            </td>

                            {/* Por hacer */}
                            <td className="px-2 py-1.5">
                              <textarea
                                value={row.por_hacer}
                                onChange={e => updateRow(idx, 'por_hacer', e.target.value)}
                                placeholder="Tareas, gestiones…"
                                rows={1}
                                className={`${cellOk} resize-none`}
                                onInput={e => { e.target.style.height = ''; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px' }}
                              />
                            </td>

                            {/* Qué se hizo / Estado */}
                            <td className="px-2 py-1.5">
                              <textarea
                                value={row.que_se_hizo}
                                onChange={e => updateRow(idx, 'que_se_hizo', e.target.value)}
                                placeholder="Avances, resultado…"
                                rows={1}
                                className={`${cellOk} resize-none`}
                                onInput={e => { e.target.style.height = ''; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px' }}
                              />
                            </td>

                            {/* Notas */}
                            <td className="px-2 py-1.5">
                              <input
                                value={row.notas}
                                onChange={e => updateRow(idx, 'notas', e.target.value)}
                                placeholder="—"
                                className={cellOk}
                              />
                            </td>

                            {/* Próxima acción */}
                            <td className="px-2 py-1.5">
                              <input
                                value={row.proxima_accion}
                                onChange={e => updateRow(idx, 'proxima_accion', e.target.value)}
                                placeholder="¿Qué sigue?"
                                className={cellOk}
                              />
                            </td>

                            {/* Responsable */}
                            <td className="px-2 py-1.5">
                              <select
                                value={row.responsable}
                                onChange={e => updateRow(idx, 'responsable', e.target.value)}
                                className="w-full text-[11px] font-semibold text-center px-1 py-1 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200 focus:border-indigo-300 cursor-pointer"
                              >
                                <option value="MT">MT</option>
                                <option value="AB">AB</option>
                                <option value="CL">CL</option>
                              </select>
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
                  className="mt-2 flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-indigo-600 font-medium transition-colors px-1 py-1"
                >
                  <Plus size={13} />
                  Agregar fila
                </button>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
              <div className="text-[12px]">
                {dateErrors.length > 0 ? (
                  <p className="text-red-500 flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    {dateErrors[0]}{dateErrors.length > 1 ? ` (+${dateErrors.length - 1} más)` : ''}
                  </p>
                ) : filledRows.length === 0 ? (
                  <p className="text-gray-400">Agrega al menos una fila con contenido</p>
                ) : (
                  <p className="text-gray-400">
                    Se guardarán <span className="font-semibold text-gray-700">{filledRows.length}</span>{' '}
                    {filledRows.length === 1 ? 'semana' : 'semanas'} de historial
                  </p>
                )}
                {error && (
                  <p className="text-red-500 mt-1 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="text-[13px] text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveClick}
                  disabled={!canSave}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-lg transition-colors"
                >
                  {saving
                    ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                    : <><Upload size={13} /> Guardar {filledRows.length > 0 ? `${filledRows.length} semana${filledRows.length !== 1 ? 's' : ''}` : 'registros'}</>
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
