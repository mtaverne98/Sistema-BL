import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search, Video, MapPin, Calendar, ChevronDown,
  Copy, ExternalLink, CheckCircle, FileText, Users, Check,
  Download, Plus, AlignLeft, X, Loader2, AlertCircle, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

// ── Constantes ────────────────────────────────────────────────────────────────
const TODAY    = new Date().toISOString().split('T')[0]
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()
const SEMANA_FIN = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })()

const ESTADO_AUD = {
  'Programada': { badge: 'bg-blue-50 text-blue-600',        dot: 'bg-blue-400'     },
  'Realizada':  { badge: 'bg-emerald-50 text-emerald-600',  dot: 'bg-emerald-400'  },
  'Suspendida': { badge: 'bg-amber-50 text-amber-700',      dot: 'bg-amber-400'    },
}

const ABOGADAS = [
  { key: 'MT', nombre: 'Macarena', bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  { key: 'AB', nombre: 'Angélica', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { key: 'CL', nombre: 'Catalina', bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
]

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_SEMANA = ['dom','lun','mar','mié','jue','vie','sáb']

// Campos que existen en la BD (se persisten al actualizar)
const DB_FIELDS = new Set(['estado','notas','tipo','fecha','hora','tribunal','sala','resultado','cliente_nombre','causa_rit','cliente_id','causa_id'])

// ── Mappers ───────────────────────────────────────────────────────────────────
function mapRow(row) {
  return {
    id:             row.id,
    created_at:     row.created_at,
    tipo:           row.tipo           || '',
    fecha:          row.fecha          || '',
    hora:           row.hora           || '',
    tribunal:       row.tribunal       || '',
    sala:           row.sala           || '',
    estado:         row.estado         || 'Programada',
    resultado:      row.resultado      || '',
    notas:          row.notas          || '',
    cliente_nombre: row.cliente_nombre || '',
    causa_rit:      row.causa_rit      || '',
    causa_id:       row.causa_id       || null,
    cliente_id:     row.cliente_id     || null,
    // Campos UI-only (no están en la BD)
    asiste:   [],
    minuta:   '',
    modalidad:'Presencial',
  }
}

function mapToDb(form) {
  return {
    tipo:           form.tipo           || null,
    fecha:          form.fecha          || null,
    hora:           form.hora           || null,
    tribunal:       form.tribunal       || null,
    sala:           form.sala           || null,
    estado:         form.estado         || 'Programada',
    resultado:      form.resultado      || null,
    notas:          form.notas          || null,
    cliente_nombre: form.cliente_nombre || null,
    causa_rit:      form.causa_rit      || null,
    cliente_id:     form.cliente_id     || null,
    causa_id:       form.causa_id       || null,
  }
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────
function ErrorBanner({ mensaje, onRetry }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-600">
      <AlertCircle size={16} className="flex-shrink-0" />
      <span className="flex-1">{mensaje}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-medium underline underline-offset-2 hover:text-red-800 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

// ── getDayInfo ────────────────────────────────────────────────────────────────
function getDayInfo(fechaStr) {
  if (!fechaStr) return { dia: '', mes: '', dow: '', indicator: null }
  const [y, m, d] = fechaStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow  = DIAS_SEMANA[date.getDay()]
  const mes  = MESES_CORTO[m - 1]
  let indicator = null
  if      (fechaStr === TODAY)    indicator = 'hoy'
  else if (fechaStr === TOMORROW) indicator = 'manana'
  else if (fechaStr  <  TODAY)    indicator = 'pasada'
  return { dia: d, mes, dow, indicator }
}

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text, label = false }) {
  const [copied, setCopied] = useState(false)
  const handle = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handle}
      title="Copiar"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${
        copied
          ? 'text-emerald-500 bg-emerald-50'
          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {label && <span className="text-[10px]">{copied ? 'Copiado' : 'Copiar'}</span>}
    </button>
  )
}

// ── AbogadasSelect ────────────────────────────────────────────────────────────
function AbogadasSelect({ value, onChange }) {
  const [open, setOpen]     = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 4, left: r.left })
    }
    setOpen(p => !p)
  }

  const toggle = (key) => {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  }

  const hasSelected = value.length > 0

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all ${
          hasSelected
            ? 'border-[#1a2e4a]/20 bg-[#1a2e4a]/5 text-[#1a2e4a]'
            : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
        }`}
      >
        <Users size={11} />
        Asiste
        {hasSelected && (
          <span className="bg-[#2570BA] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {value.length}
          </span>
        )}
        <ChevronDown size={9} className="opacity-40" />
      </button>

      {value.map(k => {
        const a = ABOGADAS.find(ab => ab.key === k)
        return a ? (
          <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.bg} ${a.text}`}>
            {a.key}
          </span>
        ) : null
      })}

      {open && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] py-1"
          style={{ top: coords.top, left: coords.left, minWidth: 190 }}
        >
          <div className="px-3 pt-2 pb-1.5 border-b border-gray-50">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Asistencia</p>
          </div>
          {ABOGADAS.map(a => {
            const sel = value.includes(a.key)
            return (
              <button
                key={a.key}
                onClick={(e) => { e.stopPropagation(); toggle(a.key) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  sel ? 'bg-gray-50' : 'hover:bg-gray-50/80'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.dot}`} />
                <span className={`text-xs flex-1 ${sel ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                  {a.nombre} <span className="text-gray-300 font-normal">({a.key})</span>
                </span>
                {sel && <Check size={12} className="text-emerald-500 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ResultadoEditor ───────────────────────────────────────────────────────────
function ResultadoEditor({ value, onChange }) {
  const [open, setOpen]     = useState(false)
  const [draft, setDraft]   = useState(value)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef  = useRef(null)
  const menuRef = useRef(null)
  const hasContent = value && value.trim().length > 0

  useEffect(() => {
    const close = (e) => {
      if (
        open &&
        btnRef.current  && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false)
        setDraft(value)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, value])

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r   = btnRef.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 344))
      setCoords({ top: r.bottom + 6, left })
    }
    setDraft(value)
    setOpen(p => !p)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all ${
          hasContent
            ? 'border-transparent bg-emerald-50 text-emerald-600'
            : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
        }`}
      >
        {hasContent ? <CheckCircle size={11} /> : <AlignLeft size={11} />}
        Resultado
      </button>
      {hasContent && (
        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{value}</p>
      )}

      {open && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] p-4"
          style={{ top: coords.top, left: coords.left, width: 336 }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-gray-700 mb-2.5">Resultado de la audiencia</p>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            className="w-full text-xs text-gray-700 border border-gray-100 rounded-xl p-3 resize-none focus:outline-none focus:border-blue-200 bg-gray-50/60 leading-relaxed"
            placeholder="¿Cómo resultó la audiencia? Anota la resolución, acuerdos, próximos pasos..."
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => { setOpen(false); setDraft(value) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { onChange(draft); setOpen(false) }}
              className="text-xs bg-[#2570BA] text-white px-4 py-1.5 rounded-lg hover:bg-[#2570BA]/90 transition-colors font-medium"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MinutaEditor ──────────────────────────────────────────────────────────────
function MinutaEditor({ value, onChange, audiencia }) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState(value)
  const hasContent = value && value.trim().length > 0

  const handleDownload = (e) => {
    e.stopPropagation()
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `Minuta_${audiencia.causa_rit}_${audiencia.fecha}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleOpen = (e) => {
    e.stopPropagation()
    setDraft(value)
    setOpen(p => !p)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleOpen}
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all ${
            hasContent
              ? 'border-transparent bg-indigo-50 text-indigo-600'
              : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
          }`}
        >
          <FileText size={11} />
          {open ? 'Ocultar minuta' : hasContent ? 'Ver / editar minuta' : 'Redactar minuta'}
        </button>
        {hasContent && !open && (
          <button
            onClick={handleDownload}
            title="Descargar minuta"
            className="inline-flex items-center gap-1 text-[10px] text-gray-300 hover:text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={11} />
            .txt
          </button>
        )}
      </div>

      {open && (
        <div
          className="mt-1 border border-gray-100 rounded-xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gray-50/80 border-b border-gray-100 px-3.5 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Minuta de audiencia</span>
            <div className="flex items-center gap-1.5">
              {hasContent && (
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-white transition-colors"
                >
                  <Download size={10} />
                  Descargar
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onChange(draft); setOpen(false) }}
                className="text-[10px] bg-[#2570BA] text-white px-3 py-1 rounded-md hover:bg-[#2570BA]/90 transition-colors font-medium"
              >
                Guardar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); setDraft(value) }}
                className="text-gray-300 hover:text-gray-500 transition-colors p-1"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={9}
            className="w-full text-xs text-gray-700 p-4 resize-none focus:outline-none font-mono leading-relaxed bg-white"
            placeholder={`MINUTA DE AUDIENCIA\n\nFecha: ${audiencia.fecha} | Hora: ${audiencia.hora}\nTribunal: ${audiencia.tribunal}${audiencia.sala ? ', ' + audiencia.sala : ''}\nCliente: ${audiencia.cliente_nombre}\nRIT: ${audiencia.causa_rit}\n\nDESARROLLO:\n\n\nRESOLUCIÓN:\n\n\nOBSERVACIONES:`}
          />
        </div>
      )}
    </div>
  )
}

// ── DateBlock ─────────────────────────────────────────────────────────────────
function DateBlock({ fecha, hora }) {
  const { dia, mes, dow, indicator } = getDayInfo(fecha)

  const styles = {
    hoy:    { wrap: 'bg-amber-50 ring-2 ring-amber-300',  num: 'text-amber-700',  sub: 'text-amber-400', badge: 'bg-amber-400 text-white', label: 'Hoy'    },
    manana: { wrap: 'bg-blue-50/60 ring-2 ring-blue-200', num: 'text-blue-700',   sub: 'text-blue-400',  badge: 'bg-blue-400 text-white',  label: 'Mañana' },
    pasada: { wrap: 'bg-gray-50',                         num: 'text-gray-300',   sub: 'text-gray-300',  badge: '',                        label: ''       },
    futura: { wrap: 'bg-gray-50/60',                      num: 'text-[#1a2e4a]',  sub: 'text-gray-400',  badge: '',                        label: ''       },
  }

  const s = styles[indicator || 'futura']

  return (
    <div className={`w-[68px] flex-shrink-0 flex flex-col items-center justify-center rounded-xl py-3 ${s.wrap}`}>
      {(indicator === 'hoy' || indicator === 'manana') && (
        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full mb-1 ${s.badge}`}>
          {s.label}
        </span>
      )}
      {(!indicator || indicator === 'pasada') && (
        <span className={`text-[9px] uppercase mb-0.5 ${s.sub}`}>{dow}</span>
      )}
      <span className={`text-[26px] font-bold leading-none ${s.num}`}>{dia}</span>
      <span className={`text-[9px] uppercase mt-0.5 font-medium ${s.sub}`}>{mes}</span>
      <span className={`text-[10px] mt-1.5 ${s.sub}`}>{hora}</span>
    </div>
  )
}

// ── CardAudiencia ─────────────────────────────────────────────────────────────
function CardAudiencia({ audiencia: aud, onUpdate, onDeleteRequest }) {
  const [expanded, setExpanded] = useState(false)
  const { indicator } = getDayInfo(aud.fecha)
  const isInactiva    = aud.estado !== 'Programada'
  const eStyles       = ESTADO_AUD[aud.estado] || ESTADO_AUD['Programada']

  return (
    <div className={`group bg-white rounded-2xl overflow-hidden transition-all duration-200 ${
      indicator === 'hoy'
        ? 'border border-amber-200 shadow-sm shadow-amber-50'
        : indicator === 'manana'
          ? 'border border-blue-100 shadow-sm shadow-blue-50/40'
          : isInactiva
            ? 'border border-gray-100 opacity-70'
            : 'border border-gray-100 hover:border-gray-200'
    }`}>

      {/* ── Compact header (always visible) ── */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-stretch text-left hover:bg-gray-50/40 transition-colors"
      >
        {/* Date */}
        <div className="p-3 flex items-center">
          <DateBlock fecha={aud.fecha} hora={aud.hora} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 py-3 pr-4 flex flex-col justify-center gap-1">
          <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
            {aud.tipo}
          </span>
          <span className="text-sm font-semibold text-gray-900 leading-tight">
            {aud.cliente_nombre}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <MapPin size={10} className="flex-shrink-0" />
            <span className="truncate">{aud.tribunal}</span>
            {aud.sala && <><span>·</span><span className="flex-shrink-0">{aud.sala}</span></>}
          </div>
        </div>

        {/* Badges + expand */}
        <div className="py-3 pr-4 flex items-center gap-2 flex-shrink-0">
          {/* RIT badge */}
          {aud.causa_rit && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              {aud.causa_rit}
            </span>
          )}

          {/* Estado */}
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${eStyles.badge}`}>
            {aud.estado}
          </span>

          {/* Asiste mini chips */}
          <div className="flex gap-1">
            {(aud.asiste || []).map(k => {
              const a = ABOGADAS.find(ab => ab.key === k)
              return a ? (
                <span
                  key={k}
                  title={a.nombre}
                  className={`text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${a.bg} ${a.text}`}
                >
                  {k[0]}
                </span>
              ) : null
            })}
          </div>

          {/* Delete + Expand icon */}
          <button
            onClick={e => { e.stopPropagation(); onDeleteRequest && onDeleteRequest(aud) }}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
            title="Eliminar audiencia"
          >
            <Trash2 size={13} />
          </button>
          <ChevronDown
            size={15}
            className={`text-gray-300 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-gray-50 px-6 py-5 space-y-4" onClick={e => e.stopPropagation()}>

          {/* RIT + Sala */}
          <div className="flex items-center gap-2 flex-wrap">
            {aud.causa_rit && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold bg-violet-50 text-violet-600 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                RIT {aud.causa_rit}
              </span>
            )}
            {aud.sala && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[11px] text-gray-500 font-medium">{aud.sala}</span>
              </>
            )}
          </div>

          {/* Notas */}
          {aud.notas && (
            <div className="bg-gray-50/80 rounded-xl p-3.5">
              <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Notas</p>
              <p className="text-xs text-gray-600 leading-relaxed">{aud.notas}</p>
            </div>
          )}

          {/* Asiste / Resultado / Minuta */}
          <div className="flex items-start gap-5 pt-1 flex-wrap">

            {/* Asiste (UI-only) */}
            <div className="flex flex-col gap-2 min-w-[140px]">
              <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider">Asistencia</p>
              <AbogadasSelect
                value={aud.asiste || []}
                onChange={v => onUpdate(aud.id, { asiste: v }, false)}
              />
            </div>

            <div className="w-px self-stretch bg-gray-100" />

            {/* Resultado (persiste a BD) */}
            <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
              <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider">Resultado</p>
              <ResultadoEditor
                value={aud.resultado || ''}
                onChange={v => onUpdate(aud.id, { resultado: v }, true)}
              />
            </div>

            <div className="w-px self-stretch bg-gray-100" />

            {/* Minuta (UI-only) */}
            <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
              <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider">Minuta</p>
              <MinutaEditor
                value={aud.minuta || ''}
                onChange={v => onUpdate(aud.id, { minuta: v }, false)}
                audiencia={aud}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'text-[#1a2e4a]', Icon }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex-1 min-w-0 flex gap-3 items-center">
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-gray-300" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── ClienteSearchSelect ───────────────────────────────────────────────────────
/**
 * Combobox con buscador para seleccionar un cliente.
 * Props: clientes[], value (nombre), onSelect(clienteObj|null)
 */
function ClienteSearchSelect({ clientes, value, onSelect, inputCls }) {
  const [query,    setQuery]    = useState(value || '')
  const [open,     setOpen]     = useState(false)
  const wrapRef = useRef(null)

  // Sincronizar si el padre borra el valor
  useEffect(() => { setQuery(value || '') }, [value])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const h = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clientes
      .filter(c => !q || c.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [clientes, query])

  function handleSelect(cliente) {
    setQuery(cliente.nombre)
    setOpen(false)
    onSelect(cliente)
  }

  function handleChange(e) {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    if (!v.trim()) onSelect(null)
  }

  function handleClear() {
    setQuery('')
    setOpen(false)
    onSelect(null)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente activo..."
          className={`${inputCls} pl-8 pr-7`}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-[200] top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-gray-400 italic">
                {query ? 'Sin resultados' : 'No hay clientes activos'}
              </p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FormAudiencia ─────────────────────────────────────────────────────────────
const FORM_VACIO = {
  tipo: '', fecha: '', hora: '', tribunal: '', sala: '',
  estado: 'Programada', notas: '', resultado: '',
  cliente_nombre: '', causa_rit: '', cliente_id: null, causa_id: null,
}

function FormAudiencia({ inicial, clientes, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState(inicial || FORM_VACIO)
  const [causasCliente, setCausasCliente] = useState([])
  const [loadingCausas, setLoadingCausas] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Al editar, cargar las causas del cliente inicial
  useEffect(() => {
    if (inicial?.cliente_id) cargarCausas(inicial.cliente_id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarCausas(clienteId) {
    setLoadingCausas(true)
    const { data } = await supabase
      .from('causas')
      .select('id, rit, ruc, materia, tribunal')
      .eq('cliente_id', clienteId)
      .order('rit', { nullsFirst: false })
    setCausasCliente(data || [])
    setLoadingCausas(false)
  }

  // Selector de cliente
  function handleClienteSelect(cliente) {
    setForm(p => ({
      ...p,
      cliente_nombre: cliente?.nombre || '',
      cliente_id:     cliente?.id     || null,
      // limpiar causa al cambiar cliente
      causa_rit: '',
      causa_id:  null,
      tribunal:  p.tribunal,
    }))
    setCausasCliente([])
    if (cliente?.id) cargarCausas(cliente.id)
  }

  // Selector de causa
  function handleCausaChange(e) {
    const causaId = e.target.value
    if (!causaId) {
      setForm(p => ({ ...p, causa_rit: '', causa_id: null }))
      return
    }
    const causa = causasCliente.find(c => c.id === causaId)
    if (causa) {
      setForm(p => ({
        ...p,
        causa_rit: causa.rit  || '',
        causa_id:  causa.id,
        tribunal:  causa.tribunal || p.tribunal,
      }))
    }
  }

  const handleSubmit = (e) => { e.preventDefault(); onGuardar(form) }

  const inputCls = "w-full text-xs text-gray-700 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-200 bg-gray-50/60 placeholder:text-gray-300"
  const labelCls = "text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block"

  const clienteSeleccionado = !!form.cliente_id

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#1a2e4a]">
            {inicial ? 'Editar audiencia' : 'Nueva audiencia'}
          </h2>
          <button onClick={onCancelar} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">

          {/* 1. Cliente — buscador */}
          <div>
            <label className={labelCls}>Cliente</label>
            <ClienteSearchSelect
              clientes={clientes}
              value={form.cliente_nombre}
              onSelect={handleClienteSelect}
              inputCls={inputCls}
            />
          </div>

          {/* 2. Causa — select dependiente del cliente */}
          <div>
            <label className={`${labelCls} ${!clienteSeleccionado ? 'opacity-40' : ''}`}>
              Causa
            </label>
            {loadingCausas ? (
              <div className={`${inputCls} flex items-center gap-2 text-gray-400`}>
                <Loader2 size={12} className="animate-spin" />
                <span>Cargando causas…</span>
              </div>
            ) : !clienteSeleccionado ? (
              <div className={`${inputCls} text-gray-300 italic cursor-not-allowed`}>
                Selecciona primero un cliente
              </div>
            ) : causasCliente.length === 0 ? (
              <div className={`${inputCls} text-amber-500 text-xs`}>
                Este cliente no tiene causas registradas
              </div>
            ) : (
              <select
                value={form.causa_id || ''}
                onChange={handleCausaChange}
                className={inputCls}
              >
                <option value="">— Seleccionar causa —</option>
                {causasCliente.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.materia}
                    {c.rit  ? ` · RIT ${c.rit}`  : ''}
                    {!c.rit && c.ruc ? ` · RUC ${c.ruc}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className={labelCls}>Tipo de audiencia</label>
            <input
              value={form.tipo}
              onChange={e => set('tipo', e.target.value)}
              placeholder="Ej: Preparatoria, Juicio oral, Cautelar..."
              className={inputCls}
            />
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => set('fecha', e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                value={form.hora}
                onChange={e => set('hora', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Tribunal + Sala */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tribunal</label>
              <input
                value={form.tribunal}
                onChange={e => set('tribunal', e.target.value)}
                placeholder="Tribunal..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Sala</label>
              <input
                value={form.sala}
                onChange={e => set('sala', e.target.value)}
                placeholder="Sala o número"
                className={inputCls}
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className={labelCls}>Estado</label>
            <select
              value={form.estado}
              onChange={e => set('estado', e.target.value)}
              className={inputCls}
            >
              <option>Programada</option>
              <option>Realizada</option>
              <option>Suspendida</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              rows={3}
              placeholder="Observaciones sobre la audiencia..."
              className={inputCls + ' resize-none'}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <button
            type="button"
            onClick={onCancelar}
            className="text-xs text-gray-400 hover:text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onGuardar(form)}
            disabled={guardando || !form.fecha}
            className="inline-flex items-center gap-2 text-xs bg-[#2570BA] text-white px-5 py-2 rounded-xl hover:bg-[#2570BA]/90 transition-colors font-medium disabled:opacity-50"
          >
            {guardando && <Loader2 size={12} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Audiencias() {
  const [audiencias,       setAudiencias]       = useState([])
  const [clientesActivos,  setClientesActivos]  = useState([])
  const [cargando,         setCargando]         = useState(true)
  const [error,            setError]            = useState(null)
  const [mostrarForm,      setMostrarForm]      = useState(false)
  const [guardando,        setGuardando]        = useState(false)
  const [busqueda,         setBusqueda]         = useState('')
  const [filtroEstado,     setFiltroEstado]     = useState('Todas')
  const [filtroFecha,      setFiltroFecha]      = useState('Todas')
  const [deleteTarget,     setDeleteTarget]     = useState(null)

  // ── Fetch audiencias ──
  const fetchAudiencias = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('audiencias')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora',  { ascending: true  })
    if (err) {
      setError(err.message)
    } else {
      setAudiencias((data || []).map(mapRow))
    }
    setCargando(false)
  }, [])

  // ── Fetch clientes activos para el selector del formulario ──
  const fetchClientes = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('estado', 'Activo')
      .order('nombre')
    setClientesActivos(data || [])
  }, [])

  useEffect(() => {
    fetchAudiencias()
    fetchClientes()
  }, [fetchAudiencias, fetchClientes])

  // ── Actualizar audiencia ──
  // persist=true → guarda en BD; persist=false → solo actualiza estado local (UI-only)
  const handleUpdate = useCallback(async (id, cambios, persist = true) => {
    setAudiencias(prev => prev.map(a => a.id === id ? { ...a, ...cambios } : a))
    if (!persist) return

    // Filtrar solo los campos que existen en BD
    const dbCambios = Object.fromEntries(
      Object.entries(cambios).filter(([k]) => DB_FIELDS.has(k))
    )
    if (Object.keys(dbCambios).length === 0) return

    const { error: err } = await supabase
      .from('audiencias')
      .update(dbCambios)
      .eq('id', id)
    if (err) console.error('Error actualizando audiencia:', err.message)
  }, [])

  // ── Eliminar audiencia ──
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    await supabase.from('audiencias').delete().eq('id', deleteTarget.id)
    setAudiencias(prev => prev.filter(a => a.id !== deleteTarget.id))
    setDeleteTarget(null)
  }, [deleteTarget])

  // ── Crear audiencia ──
  const handleCrear = useCallback(async (form) => {
    setGuardando(true)
    const payload = mapToDb(form)
    const { data, error: err } = await supabase
      .from('audiencias')
      .insert([payload])
      .select()
      .single()
    if (err) {
      alert('Error al guardar: ' + err.message)
    } else {
      setAudiencias(prev => [mapRow(data), ...prev])
      setMostrarForm(false)
    }
    setGuardando(false)
  }, [])

  // ── Métricas ──
  const hoy         = audiencias.filter(a => a.fecha === TODAY).length
  const semana      = audiencias.filter(a => a.fecha >= TODAY && a.fecha <= SEMANA_FIN).length
  const programadas = audiencias.filter(a => a.estado === 'Programada').length
  const realizadas  = audiencias.filter(a => a.estado === 'Realizada').length

  // ── Filtrado + orden ──
  const filtered = useMemo(() => {
    let r = audiencias

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(a =>
        (a.cliente_nombre || '').toLowerCase().includes(q) ||
        (a.causa_rit      || '').toLowerCase().includes(q) ||
        (a.tipo           || '').toLowerCase().includes(q) ||
        (a.tribunal       || '').toLowerCase().includes(q)
      )
    }
    if (filtroEstado !== 'Todas') r = r.filter(a => a.estado === filtroEstado)

    if      (filtroFecha === 'Hoy')         r = r.filter(a => a.fecha === TODAY)
    else if (filtroFecha === 'Esta semana') r = r.filter(a => a.fecha >= TODAY && a.fecha <= SEMANA_FIN)
    else if (filtroFecha === 'Próximas')    r = r.filter(a => a.fecha >= TODAY)
    else if (filtroFecha === 'Pasadas')     r = r.filter(a => a.fecha < TODAY)

    const upcoming = r.filter(a => a.fecha >= TODAY).sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || '')
    )
    const past = r.filter(a => a.fecha < TODAY).sort((a, b) =>
      b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || '')
    )
    return [...upcoming, ...past]
  }, [audiencias, busqueda, filtroEstado, filtroFecha])

  const hayFiltros = busqueda || filtroEstado !== 'Todas' || filtroFecha !== 'Todas'

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#1a2e4a]">Audiencias</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {cargando ? 'Cargando...' : `${audiencias.length} audiencias registradas`}
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="inline-flex items-center gap-2 bg-[#2570BA] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#2570BA]/90 transition-colors"
        >
          <Plus size={15} />
          Nueva audiencia
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

        {/* Error */}
        {error && (
          <ErrorBanner mensaje={`Error al cargar audiencias: ${error}`} onRetry={fetchAudiencias} />
        )}

        {/* Loading */}
        {cargando && (
          <div className="flex items-center justify-center py-20 text-gray-300">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}

        {!cargando && !error && (
          <>
            {/* Métricas */}
            <div className="flex gap-3">
              <MetricCard
                label="Audiencias hoy"
                value={hoy}
                sub={hoy === 1 ? 'programada para hoy' : 'programadas para hoy'}
                color={hoy > 0 ? 'text-amber-600' : 'text-[#1a2e4a]'}
                Icon={Calendar}
              />
              <MetricCard
                label="Esta semana"
                value={semana}
                sub="próximos 7 días"
                Icon={Calendar}
              />
              <MetricCard
                label="Programadas"
                value={programadas}
                sub="pendientes de realizar"
                color="text-blue-600"
                Icon={Calendar}
              />
              <MetricCard
                label="Realizadas"
                value={realizadas}
                sub="completadas"
                color="text-emerald-600"
                Icon={CheckCircle}
              />
            </div>

            {/* Filtros */}
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
              {/* Buscador */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente, RIT, tipo, tribunal..."
                  className="w-full pl-8 pr-3 py-2 text-xs text-gray-600 placeholder:text-gray-300 bg-gray-50/60 border border-gray-100 rounded-xl focus:outline-none focus:border-blue-200"
                />
              </div>

              {/* Estado */}
              {[
                { lbl: 'Estado', val: filtroEstado, set: setFiltroEstado, opts: ['Todas', 'Programada', 'Realizada', 'Suspendida'] },
                { lbl: 'Fecha',  val: filtroFecha,  set: setFiltroFecha,  opts: ['Todas', 'Hoy', 'Esta semana', 'Próximas', 'Pasadas'] },
              ].map(({ lbl, val, set, opts }) => (
                <div key={lbl} className="relative">
                  <select
                    value={val}
                    onChange={e => set(e.target.value)}
                    className="appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl pl-3 pr-7 py-2 focus:outline-none focus:border-blue-200 cursor-pointer"
                  >
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                </div>
              ))}

              {/* Limpiar filtros */}
              {hayFiltros && (
                <button
                  onClick={() => { setBusqueda(''); setFiltroEstado('Todas'); setFiltroFecha('Todas') }}
                  className="text-[11px] text-gray-300 hover:text-gray-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X size={11} />
                  Limpiar
                </button>
              )}
            </div>

            {/* Lista de audiencias */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-300">
                <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {audiencias.length === 0 ? 'No hay audiencias registradas' : 'No hay audiencias que coincidan'}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {audiencias.length === 0 ? 'Crea la primera con el botón de arriba' : 'Prueba ajustando los filtros'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filtered.map(aud => (
                  <CardAudiencia
                    key={aud.id}
                    audiencia={aud}
                    onUpdate={handleUpdate}
                    onDeleteRequest={a => setDeleteTarget({ id: a.id, name: `${a.tipo || 'audiencia'} · ${a.cliente_nombre}` })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal nueva audiencia */}
      {mostrarForm && (
        <FormAudiencia
          clientes={clientesActivos}
          onGuardar={handleCrear}
          onCancelar={() => setMostrarForm(false)}
          guardando={guardando}
        />
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
