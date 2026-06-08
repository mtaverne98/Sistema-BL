import { createContext, useContext, useState, useCallback } from 'react'

/**
 * NavigationContext — "causa activa" compartida entre todos los módulos.
 *
 * Permite que al navegar de Causas → PJUD/SIAU el módulo destino
 * auto-seleccione la causa correcta, y que al volver a Causas
 * se restaure la causa que estaba abierta.
 *
 * Persiste en sessionStorage para sobrevivir navegación intra-app.
 *
 * Shape de activeCausa:
 *   { id, rit, ruc, materia, cliente_nombre, cliente_id, causa_key }
 */
const NavigationContext = createContext(null)

export function NavigationProvider({ children }) {
  const [activeCausa, setActiveCausaRaw] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('nav.activeCausa') ?? 'null') } catch { return null }
  })

  const setActiveCausa = useCallback((causa) => {
    setActiveCausaRaw(causa)
    try {
      if (causa) sessionStorage.setItem('nav.activeCausa', JSON.stringify(causa))
      else        sessionStorage.removeItem('nav.activeCausa')
    } catch {}
  }, [])

  const clearActiveCausa = useCallback(() => {
    setActiveCausaRaw(null)
    try { sessionStorage.removeItem('nav.activeCausa') } catch {}
  }, [])

  return (
    <NavigationContext.Provider value={{ activeCausa, setActiveCausa, clearActiveCausa }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be inside NavigationProvider')
  return ctx
}
