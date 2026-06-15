import { useState, useRef } from 'react'

/**
 * Hook para columnas de tabla redimensionables con persistencia en localStorage.
 *
 * @param storageKey   Clave única para localStorage (p.ej. 'cols-siau')
 * @param defaultWidths Array de números (px) o null (la columna toma el espacio restante).
 *                      El índice del array corresponde al índice de la columna resizable.
 *
 * @returns {widths, getResizerProps}
 *   widths[i]           — ancho actual de la columna i (px) o null (auto)
 *   getResizerProps(i)  — { onMouseDown } para el handle de resize
 */
export default function useResizableColumns(storageKey, defaultWidths) {
  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      if (Array.isArray(saved) && saved.length === defaultWidths.length) return saved
    } catch {}
    return [...defaultWidths]
  })

  const widthsRef = useRef(widths)
  widthsRef.current = widths

  function getResizerProps(colIdx) {
    return {
      onMouseDown(e) {
        e.preventDefault()
        e.stopPropagation()
        const th = e.currentTarget.closest('th')
        const startW = widthsRef.current[colIdx] ?? (th?.offsetWidth ?? 120)
        const startX = e.clientX

        function onMove(ev) {
          const next = [...widthsRef.current]
          next[colIdx] = Math.max(40, startW + ev.clientX - startX)
          setWidths(next)
        }

        function onUp() {
          try { localStorage.setItem(storageKey, JSON.stringify(widthsRef.current)) } catch {}
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }

        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }
    }
  }

  return { widths, getResizerProps }
}
