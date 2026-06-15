import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Muestra un valor (RIT, RUC, etc.) que se puede copiar al portapapeles con un clic.
 * Props:
 *   value      — texto a copiar
 *   prefix     — prefijo visual, p.ej. "RIT" o "RUC" (opcional)
 *   className  — clases extra para el botón
 *   chipStyle  — si true, aplica estilo de chip coloreado
 *   chipColor  — "violet" | "cyan" | "gray" (default "gray")
 *   mono       — si true (default), usa font-mono
 */
export default function CopyValue({
  value,
  prefix,
  className = '',
  chipStyle = false,
  chipColor = 'gray',
  mono = true,
}) {
  const [copied, setCopied] = useState(false)

  if (!value) return null

  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const CHIP_COLORS = {
    violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
    cyan:   'bg-cyan-50   text-cyan-700   hover:bg-cyan-100',
    gray:   'bg-gray-100  text-gray-600   hover:bg-gray-200',
  }

  const baseClass = chipStyle
    ? `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${CHIP_COLORS[chipColor] ?? CHIP_COLORS.gray}`
    : `inline-flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70`

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar ${prefix ? prefix + ' ' : ''}${value}`}
      className={`${baseClass} ${className}`}
    >
      <span className={mono ? 'font-mono' : ''}>
        {prefix ? `${prefix} ${value}` : value}
      </span>
      {copied
        ? <Check size={9} className="text-green-500 flex-shrink-0" />
        : <Copy size={9} className="opacity-30 flex-shrink-0" />
      }
    </button>
  )
}
