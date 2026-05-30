import { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Plus, Trash2, Upload, Loader2, CheckCircle2, AlertCircle, Table2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Configuración por módulo ────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

const TIPO_SIAU = [
  'Copia de carpeta investigativa',
  'Solicitud de entrevista',
  'Solicitud de diligencias',
  'Solicitud de información',
  'Solicitud de documento',
  'Otro',
]
const ESTADO_SEG = ['Pendiente', 'En progreso', 'Listo', 'Sin novedades']

function getConfig(modulo) {
  if (modulo === 'seguimiento_rev') {
    return {
      tabla:   'revisiones',
      titulo:  'Seguimiento',
      cols:    ['Fecha', 'Por hacer', 'Estado', 'Notas'],
      empty:   () => ({ fecha: TODAY, por_hacer: '', estado: 'Pendiente', notas: '' }),
      isEmpty: r => !r.por_hacer?.trim(),
      parse:   cells => ({
        fecha:    normalizeDate(cells[0] ?? ''),
        por_hacer: (cells[1] ?? '').trim(),
        estado:    ESTADO_SEG.find(o => o.toLowerCase() === (cells[2] ?? '').trim().toLowerCase()) || 'Pendiente',
        notas:     (cells[3] ?? '').trim(),
      }),
      payload: (r, causaObj) => ({
        fecha_revision: r.fecha || null,
        por_hacer:      r.por_hacer?.trim() || null,
        que_se_hizo:    r.estado || 'Pendiente',
        notas:          r.notas?.trim() || null,
        causa_rit:      causaObj.rit      || null,
        causa_id:       causaObj.id       || null,
        cliente_nombre: causaObj.cliente_nombre || null,
        semana_key:     null,
        revisada:       false,
      }),
    }
  }
  if (modulo === 'siau') {
    return {
      tabla:   'siau',
      titulo:  'SIAU',
      cols:    ['Fecha', 'Folio', 'Tipo solicitud', 'Solicitud', 'Respuesta', 'F. Respuesta', 'Doc.', 'Notas'],
      empty:   () => ({ fecha: TODAY, folio: '', tipo_solicitud: '', solicitud: '', respuesta: '', fecha_respuesta: '', tiene_documento: false, notas: '' }),
      isEmpty: r => !r.folio?.trim() && !r.solicitud?.trim(),
      parse:   cells => ({
        fecha:           normalizeDate(cells[0] ?? ''),
        folio:           (cells[1] ?? '').trim(),
        tipo_solicitud:  (cells[2] ?? '').trim(),
        solicitud:       (cells[3] ?? '').trim(),
        respuesta:       (cells[4] ?? '').trim(),
        fecha_respuesta: normalizeDate(cells[5] ?? '') || '',
        tiene_documento: ['si','sí','1','true','x','yes'].includes((cells[6] ?? '').trim().toLowerCase()),
        notas:           (cells[7] ?? '').trim(),
      }),
      payload: (r, causaObj) => ({
        fecha:            r.fecha            || null,
        folio:            r.folio?.trim()    || null,
        tipo_solicitud:   r.tipo_solicitud?.trim() || null,
        solicitud:        r.solicitud?.trim()|| null,
        respuesta:        r.respuesta?.trim()|| null,
        fecha_respuesta:  r.fecha_respuesta  || null,
        tiene_documento:  !!r.tiene_documento,
        notas:            r.notas?.trim()    || null,
        estado:           r.respuesta?.trim() ? 'Respondida' : 'Pendiente',
        causa_rit:        causaObj.rit        || '',
        causa_ruc:        causaObj.ruc        || null,
        cliente_nombre:   causaObj.cliente_nombre || '',
      }),
    }
  }
  // pjud (default)
  return {
    tabla:   'pjud',
    titulo:  'PJUD',
    cols:    ['Fecha', 'Folio', 'Solicitud', 'Respuesta', 'F. Respuesta', 'Doc.', 'Notas'],
    empty:   () => ({ fecha: TODAY, folio: '', solicitud: '', respuesta: '', fecha_respuesta: '', tiene_documento: false, notas: '' }),
    isEmpty: r => !r.folio?.trim() && !r.solicitud?.trim(),
    parse:   cells => ({
      fecha:           normalizeDate(cells[0] ?? ''),
      folio:           (cells[1] ?? '').trim(),
      solicitud:       (cells[2] ?? '').trim(),
      respuesta:       (cells[3] ?? '').trim(),
      fecha_respuesta: normalizeDate(cells[4] ?? '') || '',
      tiene_documento: ['si','sí','1','true','x','yes'].includes((cells[5] ?? '').trim().toLowerCase()),
      notas:           (cells[6] ?? '').trim(),
    }),
    payload: (r, causaObj) => ({
      fecha:           r.fecha            || null,
      folio:           r.folio?.trim()    || null,
      solicitud:       r.solicitud?.trim()|| null,
      respuesta:       r.respuesta?.trim()|| null,
      fecha_respuesta: r.fecha_respuesta  || null,
      tiene_documento: !!r.tiene_documento,
      notas:           r.notas?.trim()    || null,
      estado:          r.respuesta?.trim() ? 'Respondido' : 'Pendiente',
      causa_rit:       causaObj.rit        || '',
      cliente_nombre:  causaObj.cliente_nombre || '',
      causa_id:        causaObj.id         || null,
      cliente_id:      causaObj.cliente_id || null,
      presenta:        'Nosotros',
      responsable:     'MT',
    }),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeDate(str) {
  if (!str) return TODAY
  const s = str.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  return s
}

function parseTsvRow(line) {
  const cells = []
  let cell = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cell += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === '\t' && !inQuote) { cells.push(cell); cell = '' }
    else cell += ch
  }
  cells.push(cell)
  return cells
}

// ─── CargaMasivaModal ─────────────────────────────────────────────────────────
// causaObj: { rit, ruc, cliente_nombre, id, cliente_id, materia, tribunal }
export default function CargaMasivaModal({ modulo, causaObj, onClose, onSuccess }) {
  const cfg = getConfig(modulo)

  const [rows,       setRows]       = useState(() => Array.from({ length: 5 }, cfg.empty))
  const [saving,     setSaving]     = useState(false)
  const [savedCount, setSavedCount] = useState(null)
  const [error,      setError]      = useState(null)
  const tableRef = useRef(null)

  // ── Paste from Excel ────────────────────────────────────────────────────────
  const handlePaste = useCallback((e) => {
    if (!tableRef.current?.contains(e.target)) return
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()

    const lines  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
    const parsed = lines.map(line => cfg.parse(parseTsvRow(line))).filter(r => !cfg.isEmpty(r))
    if (parsed.length === 0) return

    const focused    = tableRef.current?.querySelector('input:focus, textarea:focus, select:focus')
    const focusedRow = focused?.closest('tr')
    const allTrs     = Array.from(tableRef.current?.querySelectorAll('tbody tr') ?? [])
    const startIdx   = focusedRow ? allTrs.indexOf(focusedRow) : 0

    setRows(prev => {
      const merged = [...prev]
      parsed.forEach((r, i) => {
        const idx = startIdx + i
        if (idx < merged.length) merged[idx] = r
        else merged.push(r)
      })
      return merged
    })
  }, [cfg])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // ── Row operations ──────────────────────────────────────────────────────────
  const updateRow = (idx, key, val) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  const addRow    = () => setRows(prev => [...prev, cfg.empty()])
  const removeRow = idx => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)

  // ── Save ────────────────────────────────────────────────────────────────────
  const filledRows = rows.filter(r => !cfg.isEmpty(r))

  async function handleSave() {
    if (filledRows.length === 0 || !causaObj) return
    setSaving(true)
    setError(null)
    const payloads = filledRows.map(r => cfg.payload(r, causaObj))
    const { data, error: err } = await supabase.from(cfg.tabla).insert(payloads).select()
    if (err) { setError(err.message); setSaving(false); return }
    setSavedCount(data.length)
    onSuccess(data)
    setSaving(false)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const inputCls = 'w-full text-[11px] px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300 placeholder-gray-300'
  const taCls    = inputCls + ' resize-none'

  // ── Success screen ──────────────────────────────────────────────────────────
  if (savedCount !== null) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl w-80 p-8 flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-emerald-500"/>
        </div>
        <div className="text-center">
          <p className="text-[16px] font-semibold text-gray-900">
            {savedCount} {savedCount === 1 ? 'registro cargado' : 'registros cargados'}
          </p>
          <p className="text-[12px] text-gray-400 mt-1">
            Añadidos a {cfg.titulo} correctamente
          </p>
        </div>
        <button onClick={onClose}
          className="mt-1 px-5 py-2 bg-[#2570BA] hover:bg-[#2570BA]/90 text-white text-[13px] font-medium rounded-lg transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  )

  // ── Main modal ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 'min(96vw, 860px)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1a2e4a]/8 flex items-center justify-center flex-shrink-0">
              <Table2 size={16} className="text-[#1a2e4a]"/>
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-gray-900">
                Carga masiva · {cfg.titulo}
              </h2>
              {causaObj && (
                <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <span className="font-medium text-gray-600">{causaObj.cliente_nombre}</span>
                  {causaObj.rit && <><span>·</span><span className="font-mono">{causaObj.rit}</span></>}
                  {causaObj.materia && <><span>·</span><span>{causaObj.materia}</span></>}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5">
            <X size={14} className="text-gray-500"/>
          </button>
        </div>

        {/* Hint */}
        <div className="px-6 py-2 border-b border-gray-50 bg-gray-50/50 flex-shrink-0">
          <p className="text-[11px] text-gray-400">
            <span className="font-semibold text-gray-500">Columnas:</span>{' '}
            {cfg.cols.join(' · ')}
            <span className="ml-3 text-gray-300">·</span>
            <span className="ml-3">Pega desde Excel con <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono">⌘V</kbd> / <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono">Ctrl+V</kbd></span>
          </p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full" ref={tableRef}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {cfg.cols.map(col => (
                    <th key={col} className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="w-8"/>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const filled = !cfg.isEmpty(row)
                  return (
                    <tr key={idx} className={`border-b border-gray-100 last:border-0 ${filled ? 'bg-white' : 'bg-gray-50/30'}`}>
                      {/* ── Fecha ── */}
                      <td className="px-2 py-1.5 w-[120px]">
                        <input type="date" value={row.fecha ?? ''}
                          onChange={e => updateRow(idx, 'fecha', e.target.value)}
                          className={inputCls}/>
                      </td>

                      {/* ── Folio (pjud/siau) ── */}
                      {(modulo === 'pjud' || modulo === 'siau') && (
                        <td className="px-2 py-1.5 w-[90px]">
                          <input value={row.folio ?? ''} onChange={e => updateRow(idx, 'folio', e.target.value)}
                            placeholder="—" className={`${inputCls} font-mono`}/>
                        </td>
                      )}

                      {/* ── Tipo solicitud (siau only) ── */}
                      {modulo === 'siau' && (
                        <td className="px-2 py-1.5 w-[160px]">
                          <select value={row.tipo_solicitud ?? ''} onChange={e => updateRow(idx, 'tipo_solicitud', e.target.value)}
                            className={inputCls}>
                            <option value="">—</option>
                            {TIPO_SIAU.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                      )}

                      {/* ── Por hacer (seguimiento) / Solicitud (pjud/siau) ── */}
                      {modulo === 'seguimiento_rev' ? (
                        <td className="px-2 py-1.5">
                          <textarea value={row.por_hacer ?? ''} onChange={e => updateRow(idx, 'por_hacer', e.target.value)}
                            placeholder="¿Qué hay que hacer?" rows={1}
                            className={taCls}
                            onInput={e => { e.target.style.height = ''; e.target.style.height = e.target.scrollHeight + 'px' }}/>
                        </td>
                      ) : (
                        <td className="px-2 py-1.5">
                          <textarea value={row.solicitud ?? ''} onChange={e => updateRow(idx, 'solicitud', e.target.value)}
                            placeholder="Descripción…" rows={1}
                            className={taCls}
                            onInput={e => { e.target.style.height = ''; e.target.style.height = e.target.scrollHeight + 'px' }}/>
                        </td>
                      )}

                      {/* ── Respuesta (pjud/siau) / Estado (seguimiento) ── */}
                      {modulo === 'seguimiento_rev' ? (
                        <td className="px-2 py-1.5 w-[130px]">
                          <select value={row.estado ?? 'Pendiente'} onChange={e => updateRow(idx, 'estado', e.target.value)}
                            className={inputCls}>
                            {ESTADO_SEG.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </td>
                      ) : (
                        <td className="px-2 py-1.5">
                          <textarea value={row.respuesta ?? ''} onChange={e => updateRow(idx, 'respuesta', e.target.value)}
                            placeholder="—" rows={1}
                            className={taCls}
                            onInput={e => { e.target.style.height = ''; e.target.style.height = e.target.scrollHeight + 'px' }}/>
                        </td>
                      )}

                      {/* ── Fecha respuesta (pjud/siau) ── */}
                      {(modulo === 'pjud' || modulo === 'siau') && (
                        <td className="px-2 py-1.5 w-[120px]">
                          <input type="date" value={row.fecha_respuesta ?? ''}
                            onChange={e => updateRow(idx, 'fecha_respuesta', e.target.value)}
                            className={inputCls}/>
                        </td>
                      )}

                      {/* ── Documento (pjud/siau) ── */}
                      {(modulo === 'pjud' || modulo === 'siau') && (
                        <td className="px-2 py-1.5 w-[52px] text-center">
                          <input type="checkbox" checked={!!row.tiene_documento}
                            onChange={e => updateRow(idx, 'tiene_documento', e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer"/>
                        </td>
                      )}

                      {/* ── Notas ── */}
                      <td className="px-2 py-1.5">
                        <input value={row.notas ?? ''} onChange={e => updateRow(idx, 'notas', e.target.value)}
                          placeholder="—" className={inputCls}/>
                      </td>

                      {/* ── Delete ── */}
                      <td className="px-1 py-1.5 w-8">
                        <button onClick={() => removeRow(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-200 hover:text-red-400 transition-colors">
                          <Trash2 size={11}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={addRow}
            className="mt-2 flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-[#1a2e4a] font-medium transition-colors px-1 py-1">
            <Plus size={13}/> Agregar fila
          </button>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40 rounded-b-2xl">
          <div className="flex items-center gap-2 text-[12px] text-gray-400">
            {filledRows.length > 0
              ? <span className="text-gray-600 font-medium">{filledRows.length} fila{filledRows.length !== 1 ? 's' : ''} con contenido</span>
              : <span className="flex items-center gap-1.5"><AlertCircle size={12} className="text-amber-400"/> Agrega al menos una fila con contenido</span>
            }
            {error && <span className="text-red-500 flex items-center gap-1.5 ml-3"><AlertCircle size={12}/>{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="text-[13px] text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || filledRows.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#2570BA] hover:bg-[#2570BA]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-lg transition-colors">
              {saving
                ? <><Loader2 size={13} className="animate-spin"/> Guardando…</>
                : <><Upload size={13}/> Guardar {filledRows.length > 0 ? `${filledRows.length} registro${filledRows.length !== 1 ? 's' : ''}` : 'registros'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
