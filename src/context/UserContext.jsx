import { createContext, useContext, useState } from 'react'

export const USUARIOS = [
  { id: 'MT', nombre: 'Macarena', apellido: 'T.', color: '#2570ba' },
  { id: 'AB', nombre: 'Angélica', apellido: 'B.', color: '#059669' },
  { id: 'CL', nombre: 'Catalina', apellido: 'L.', color: '#7c3aed' },
]

const LS_KEY = 'bl_usuario'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUserState] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) return USUARIOS.find(u => u.id === saved) || null
    } catch {}
    return null
  })

  function setUser(u) {
    setUserState(u)
    try {
      if (u) localStorage.setItem(LS_KEY, u.id)
      else    localStorage.removeItem(LS_KEY)
    } catch {}
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
