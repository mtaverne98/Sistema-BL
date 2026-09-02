import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Save, CheckCircle2, CalendarCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── ISO week helpers ───────────────────────────────────────────────────────────
function getISOYearWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function getMondayOfWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7)
  return monday
}

function shiftWeeks({ year, week }, delta) {
  const monday = getMondayOfWeek(year, week)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  return getISOYearWeek(monday)
}

function fmtIso(date) {
  return date.toISOString().slice(0, 10)
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmtDay(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]}`
}

function semanaKey(year, week) {
  return `SEG-${year}-W${String(week).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MiSemana() {
  const todayAnchor = getISOYearWeek(new Date())
  const [anchor, setAnchor] = useState(todayAnchor)
  const [causas,  setCausas]  = useState([])
  const [rows,    setRows]    = useState({})
  const rowsRef = useRef({}) // siempre tiene el valor más reciente de rows
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const { year, week } = anchor
  const monday    = getMondayOfWeek(year, week)
  const sunday    = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const mondayIso = fmtIso(monday)
  const sundayIso = fmtIso(sunday)
  const key       = semanaKey(year, week)
  const isCurrentWeek = year === todayAnchor.year && week === todayAnchor.week

  // Load causas once
  useEffect(() => {
    supabase
      .from('causas')
      .select('id, materia, rit, ruc, cliente_nombre, estado')
      .in('estado', ['Abierta', 'Revisar'])
      .order('cliente_nombre', { ascending: true })
      .then(({ data }) => setCausas(data || []))
  }, [])

  // Mantiene rowsRef sincronizado y persiste en localStorage
  useEffect(() => {
    rowsRef.current = rows
    if (Object.keys(rows).length === 0) return
    localStorage.setItem(`mi_semana_${key}`, JSON.stringify(rows))
  }, [rows, key])

  const notaKey  = `NOTA-${key}` // semana_key para filas de nota (distintas de SIAU/PJUD)
  const notaTimers = useRef({}) // debounce timers por causa_id

  // Load week data when anchor or causas change
  useEffect(() => {
    if (causas.length === 0) return
    setLoading(true)

    Promise.all([
      // Fila SIAU/PJUD (es_revision_semanal = true)
      supabase.from('revisiones')
        .select('id, causa_id, siau_revisado, pjud_revisado')
        .eq('semana_key', key)
        .eq('es_revision_semanal', true),
      // Fila nota (seguimiento normal, semana_key = 'NOTA-...')
      supabase.from('revisiones')
        .select('id, causa_id, por_hacer')
        .eq('semana_key', notaKey),
    ]).then(([{ data: siauData }, { data: notaData }]) => {
      const initial = {}
      for (const c of causas) {
        const siauRow = (siauData || []).find(r => r.causa_id === c.id)
        const notaRow = (notaData || []).find(r => r.causa_id === c.id)
        initial[c.id] = {
          siau:       siauRow?.siau_revisado ?? false,
          pjud:       siauRow?.pjud_revisado ?? false,
          nota:       notaRow?.por_hacer ?? '',
          existingId: siauRow?.id ?? null,
          notaId:     notaRow?.id ?? null,
        }
      }
      setRows(initial)
      setLoading(false)
    })
  }, [key, causas.length])

  // Persiste localStorage para UI veloz (solo lectura, Supabase es la fuente de verdad)
  useEffect(() => {
    if (Object.keys(rows).length === 0) return
    localStorage.setItem(`mi_semana_${key}`, JSON.stringify(rows))
  }, [rows, key])

  // Guarda SIAU/PJUD de una causa
  async function saveSiauPjud(causa, r) {
    const hasDirty = r.siau || r.pjud
    if (r.existingId) {
      await supabase.from('revisiones').update({
        siau_revisado: r.siau,
        pjud_revisado: r.pjud,
      }).eq('id', r.existingId)
    } else if (hasDirty) {
      const { data } = await supabase.from('revisiones').insert({
        causa_id:            causa.id,
        causa_rit:           causa.rit ?? null,
        cliente_nombre:      causa.cliente_nombre,
        semana_key:          key,
        fecha:               mondayIso,
        fecha_revision:      mondayIso,
        siau_revisado:       r.siau,
        pjud_revisado:       r.pjud,
        es_revision_semanal: true,
        responsable:         'MT',
      }).select('id').single()
      if (data?.id)
        setRows(prev => ({ ...prev, [causa.id]: { ...prev[causa.id], existingId: data.id } }))
    }
  }

  // Guarda la nota de una causa como entrada de seguimiento normal
  async function saveNota(causa, r) {
    const texto = (r.nota ?? '').trim()
    if (r.notaId) {
      if (texto) {
        await supabase.from('revisiones').update({ por_hacer: texto }).eq('id', r.notaId)
      } else {
        await supabase.from('revisiones').delete().eq('id', r.notaId)
        setRows(prev => ({ ...prev, [causa.id]: { ...prev[causa.id], notaId: null } }))
      }
    } else if (texto) {
      const { data, error } = await supabase.from('revisiones').insert({
        causa_id:       causa.id,
        causa_rit:      causa.rit ?? null,
        cliente_nombre: causa.cliente_nombre,
        semana_key:     notaKey,
        fecha_revision: mondayIso,
        fecha:          mondayIso,
        por_hacer:      texto,
        que_se_hizo:    'Pendiente',
        revisada:       false,
      }).select('id').single()
      if (error) console.error('[saveNota] insert error:', error.message, error.details)
      if (data?.id)
        setRows(prev => ({ ...prev, [causa.id]: { ...prev[causa.id], notaId: data.id } }))
    }
  }

  // Guarda la nota con debounce (800ms) — evita guardados en cada tecla
  function scheduleNotaSave(causa, texto) {
    clearTimeout(notaTimers.current[causa.id])
    notaTimers.current[causa.id] = setTimeout(() => {
      const r = rowsRef.current[causa.id]
      if (r) saveNota(causa, { ...r, nota: texto })
    }, 800)
  }

  async function saveCausa(causa, rowOverride) {
    const r = rowOverride ?? rows[causa.id]
    if (!r) return
    await Promise.all([saveSiauPjud(causa, r), saveNota(causa, r)])
  }

  async function saveWeek(silent = false) {
    if (!silent) setSaving(true)
    for (const causa of causas) {
      await saveCausa(causa)
    }
    if (!silent) {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  async function navigate(delta) {
    await saveWeek(true)
    setAnchor(prev => shiftWeeks(prev, delta))
  }

  const siauCount = Object.values(rows).filter(r => r.siau).length
  const pjudCount = Object.values(rows).filter(r => r.pjud).length

  return (
    <div className="h-full flex flex-col bg-[#fafafa]">

      {/* ── Header ── */}
      <div className="bg-[#1a2e4a] px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <CalendarCheck size={15} className="text-white/80" />
          </div>
          <div>
            <h1 className="text-white font-bold text-[14px] leading-tight">Mi Semana</h1>
            <p className="text-white/40 text-[11px]">Revisión semanal de causas activas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Resumen badges */}
          {(siauCount > 0 || pjudCount > 0) && (
            <div className="flex items-center gap-1.5">
              {siauCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                  {siauCount} SIAU
                </span>
              )}
              {pjudCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                  {pjudCount} PJUD
                </span>
              )}
            </div>
          )}

          {/* Week navigation */}
          <div className="flex items-center gap-0.5 bg-white/10 rounded-xl px-1 py-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="px-3 text-center" style={{ minWidth: 200 }}>
              <p className="text-white font-semibold text-[12px]">
                Semana {week} · {fmtDay(mondayIso)} – {fmtDay(sundayIso)}
              </p>
              {!isCurrentWeek && (
                <p className="text-white/30 text-[10px] leading-tight">{year}</p>
              )}
            </div>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {!isCurrentWeek && (
            <button
              onClick={() => { saveWeek(true); setAnchor(todayAnchor) }}
              className="text-white/40 hover:text-white text-[11px] font-medium transition-colors"
            >
              Semana actual
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-5 h-5 border-2 border-[#1a2e4a]/20 border-t-[#1a2e4a] rounded-full animate-spin" />
          </div>
        ) : causas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CalendarCheck size={32} className="text-gray-200 mb-3" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-400 font-medium">Sin causas activas</p>
            <p className="text-[11px] text-gray-300 mt-1">Las causas con estado "Abierta" o "Revisar" aparecen aquí</p>
          </div>
        ) : (
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '44%' }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-50/95" style={{ backdropFilter: 'blur(4px)', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Causa</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">SIAU</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">PJUD</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nota de la semana</th>
              </tr>
            </thead>
            <tbody>
              {causas.map((causa, i) => {
                const r = rows[causa.id] ?? { siau: false, pjud: false, nota: '', existingId: null }
                const touched = r.siau || r.pjud || r.nota.trim()
                return (
                  <tr
                    key={causa.id}
                    className="group transition-colors hover:bg-blue-50/20"
                    style={{ borderBottom: '1px solid #f0f0f0', background: touched ? 'rgba(37,112,186,0.02)' : i % 2 === 0 ? '#fff' : 'rgba(250,250,250,0.8)' }}
                  >
                    {/* Causa */}
                    <td className="px-6 py-3 align-middle">
                      <p className="text-[13px] font-semibold text-[#1a2e4a] leading-tight">{causa.cliente_nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {causa.rit && (
                          <span className="text-[10px] text-gray-400 font-mono">{causa.rit}</span>
                        )}
                        {causa.materia && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[260px]">{causa.materia}</span>
                        )}
                      </div>
                      {causa.ruc && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">{causa.ruc}</p>
                      )}
                    </td>

                    {/* SIAU */}
                    <td className="px-4 py-3 align-middle text-center">
                      <input
                        type="checkbox"
                        checked={r.siau}
                        onChange={e => {
                          const next = { ...r, siau: e.target.checked }
                          setRows(prev => ({ ...prev, [causa.id]: next }))
                          saveSiauPjud(causa, next)
                        }}
                        style={{ accentColor: '#1a2e4a', width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>

                    {/* PJUD */}
                    <td className="px-4 py-3 align-middle text-center">
                      <input
                        type="checkbox"
                        checked={r.pjud}
                        onChange={e => {
                          const next = { ...r, pjud: e.target.checked }
                          setRows(prev => ({ ...prev, [causa.id]: next }))
                          saveSiauPjud(causa, next)
                        }}
                        style={{ accentColor: '#1a2e4a', width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>

                    {/* Nota */}
                    <td className="px-6 py-3 align-middle">
                      <input
                        type="text"
                        value={r.nota}
                        onChange={e => {
                          const texto = e.target.value
                          setRows(prev => ({ ...prev, [causa.id]: { ...prev[causa.id], nota: texto } }))
                          scheduleNotaSave(causa, texto)
                        }}
                        onBlur={e => saveNota(causa, { ...r, nota: e.target.value })}
                        placeholder="Nota de la semana…"
                        className="w-full text-[12px] text-gray-700 bg-transparent border-0 outline-none placeholder:text-gray-300 py-1 px-2 -mx-2 rounded-lg focus:bg-white focus:border focus:border-blue-200 transition-all"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
        <p className="text-[11px] text-gray-400">
          {causas.length} causas activas · Notas y checkboxes se guardan automáticamente
        </p>
        <button
          onClick={() => saveWeek(false)}
          disabled={saving}
          className="flex items-center gap-2 bg-[#1a2e4a] text-white text-[12px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2e4a]/90 transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={13} />
          ) : (
            <Save size={13} />
          )}
          {saved ? 'Guardado ✓' : 'Guardar semana →'}
        </button>
      </div>
    </div>
  )
}
