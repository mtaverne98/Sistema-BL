import { createContext, useContext, useState, useCallback } from 'react'

/**
 * NavigationContext — memoria de navegación compartida entre módulos.
 *
 * - activeCausa: la causa actualmente en foco (para PJUD/SIAU/etc.)
 * - activeTab:   última tab activa dentro de CausaView
 * - Persiste en sessionStorage para sobrevivir navegación intra-app.
 */
const NavigationContext = createContext(null)

export function NavigationProvider({ children }) {
  const [activeCausa, setActiveCausaRaw] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('nav.activeCausa') ?? 'null') } catch { return null }
  })

  const [activeTab, setActiveTabRaw] = useState(() => {
    try { return sessionStorage.getItem('nav.activeTab') ?? 'resumen' } catch { return 'resumen' }
  })

  const setActiveCausa = useCallback((causa) => {
    setActiveCausaRaw(causa)
    try {
      if (causa) sessionStorage.setItem('nav.activeCausa', JSON.stringify(causa))
      else        sessionStorage.removeItem('nav.activeCausa')
    } catch {}
  }, [])

  const setActiveTab = useCallback((tab) => {
    setActiveTabRaw(tab)
    try { sessionStorage.setItem('nav.activeTab', tab) } catch {}
  }, [])

  const clearActiveCausa = useCallback(() => {
    setActiveCausaRaw(null)
    setActiveTabRaw('resumen')
    try {
      sessionStorage.removeItem('nav.activeCausa')
      sessionStorage.removeItem('nav.activeTab')
    } catch {}
  }, [])

  return (
    <NavigationContext.Provider value={{ activeCausa, setActiveCausa, clearActiveCausa, activeTab, setActiveTab }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be inside NavigationProvider')
  return ctx
}
