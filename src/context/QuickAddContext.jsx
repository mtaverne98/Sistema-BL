import { createContext, useContext, useState } from 'react'

// ctx shape: { causaId, causaRit, clienteNombre } | null
const QuickAddContext = createContext({ ctx: null, setCtx: () => {} })

export function QuickAddProvider({ children }) {
  const [ctx, setCtx] = useState(null)
  return (
    <QuickAddContext.Provider value={{ ctx, setCtx }}>
      {children}
    </QuickAddContext.Provider>
  )
}

export function useQuickAdd() {
  return useContext(QuickAddContext)
}
