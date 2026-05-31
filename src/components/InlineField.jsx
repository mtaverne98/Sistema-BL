import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Campo editable inline estilo Notion.
 *
 * Muestra el valor como texto. Al hacer clic → modo edición.
 * Guarda automáticamente al perder el foco o al presionar Enter.
 * Cancela al presionar Escape.
 *
 * Props:
 *   value         — valor actual
 *   onSave(v)     — async/sync, llamado con el nuevo valor al guardar
 *   type          — 'text' | 'textarea' | 'select' | 'date'  (default: 'text')
 *   options       — string[]  (solo para type='select')
 *   placeholder   — texto cuando está vacío  (default: 'Agregar…')
 *   className     — clases del wrapper
 *   textClassName — clases del span de visualización
 *   inputClassName— clases del input/textarea
 *   disabled      — no permite editar
 *   debounce      — ms para auto-save en textarea (0 = solo on-blur)
 */
export default function InlineField({
  value        = '',
  onSave,
  type         = 'text',
  options      = [],
  placeholder  = 'Agregar…',
  className    = '',
  textClassName= '',
  inputClassName = '',
  disabled     = false,
  debounce     = 0,
}) {
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState(value ?? '')
  const [saving,   setSaving]   = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)

  // Sync draft when value changes externally (e.g., after server update)
  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (!editing || !inputRef.current) return
    inputRef.current.focus()
    if (type === 'text' || type === 'date') {
      const len = inputRef.current.value.length
      try { inputRef.current.setSelectionRange(len, len) } catch {}
    }
  }, [editing, type])

  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const commit = useCallback(async (val) => {
    const v = val ?? draft
    clearTimeout(timerRef.current)
    if (v === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    setErrorMsg(null)
    try {
      await onSave?.(v)
      setEditing(false)
    } catch (e) {
      // Save failed — stay in edit mode and show the error
      setErrorMsg(e?.message || 'Error al guardar')
    }
    setSaving(false)
  }, [draft, value, onSave])

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      clearTimeout(timerRef.current)
      setDraft(value ?? '')
      setErrorMsg(null)
      setEditing(false)
      return
    }
    // Enter saves for single-line fields
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      commit()
    }
  }

  function handleChange(e) {
    const v = e.target.value
    setDraft(v)
    if (errorMsg) setErrorMsg(null)   // limpiar error al reescribir
    if (debounce > 0) {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onSave?.(v), debounce)
    }
  }

  // ── Display mode ──────────────────────────────────────────────────────────
  if (!editing) {
    const isEmpty = !value && value !== 0
    return (
      <span
        onClick={() => { if (!disabled) { setDraft(value ?? ''); setEditing(true) } }}
        className={`
          inline-block rounded px-0.5 -mx-0.5 transition-colors leading-snug
          ${disabled ? 'cursor-default' : 'cursor-text hover:bg-black/[0.04]'}
          ${className}
        `}
        title={disabled ? undefined : 'Clic para editar'}
      >
        <span className={isEmpty ? `text-gray-300 italic ${textClassName}` : textClassName}>
          {isEmpty ? placeholder : value}
        </span>
        {saving && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse align-middle" />
        )}
      </span>
    )
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const borderCls = errorMsg ? 'border-red-400 focus:ring-red-400/20' : 'border-blue-400 focus:ring-blue-400/20'
  const baseInput = `
    rounded px-1.5 py-0.5 border bg-white outline-none
    focus:ring-2 transition-shadow
    ${borderCls} ${inputClassName}
  `

  /** Envuelve el control con el mensaje de error (si lo hay) */
  function withError(control) {
    if (!errorMsg) return control
    return (
      <span className="inline-flex flex-col gap-0.5">
        {control}
        <span className="text-[10px] text-red-500 leading-tight">{errorMsg}</span>
      </span>
    )
  }

  if (type === 'select') {
    return withError(
      <select
        ref={inputRef}
        value={draft}
        onChange={e => { setDraft(e.target.value); commit(e.target.value) }}
        onBlur={() => commit()}
        onKeyDown={handleKeyDown}
        className={`${baseInput} ${className}`}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (type === 'textarea') {
    return withError(
      <textarea
        ref={inputRef}
        value={draft}
        onChange={handleChange}
        onBlur={() => commit()}
        onKeyDown={handleKeyDown}
        rows={4}
        className={`w-full ${baseInput} resize-none ${className}`}
      />
    )
  }

  return withError(
    <input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={handleChange}
      onBlur={() => commit()}
      onKeyDown={handleKeyDown}
      className={`${baseInput} ${className}`}
    />
  )
}
