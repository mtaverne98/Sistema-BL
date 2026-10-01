export const EQUIPO = [
  {
    iniciales: 'MT',
    nombre: 'Macarena T.',
    nombreCompleto: 'Macarena Taverne Velasco',
    bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500',
    color: '#1a2e4a',
  },
  {
    iniciales: 'AB',
    nombre: 'Angélica B.',
    nombreCompleto: 'María Angélica Bianchi Pino',
    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500',
    color: '#2570ba',
  },
  {
    iniciales: 'CL',
    nombre: 'Catalina L.',
    nombreCompleto: 'Catalina Leiva Ochoa',
    bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500',
    color: '#059669',
  },
]

export const EQUIPO_MAP = Object.fromEntries(EQUIPO.map(a => [a.iniciales, a]))

export const EQUIPO_OPTS = EQUIPO.map(a => a.iniciales)

export const EQUIPO_SELECT = EQUIPO.map(({ iniciales, nombre }) => ({ value: iniciales, label: nombre }))
