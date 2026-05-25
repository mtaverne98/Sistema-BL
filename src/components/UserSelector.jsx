import { USUARIOS, useUser } from '../context/UserContext'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function UserSelector() {
  const { setUser } = useUser()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">

      {/* Logo */}
      <div className="mb-10">
        <img
          src="/logo.jpg"
          alt="Bianchi Leiva Abogadas"
          className="object-contain"
          style={{ height: 72 }}
        />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-10 py-8 w-[380px]">
        <h2 className="text-[15px] font-semibold text-gray-800 text-center mb-1">
          {getGreeting()}
        </h2>
        <p className="text-[13px] text-gray-400 text-center mb-7">¿Quién eres?</p>

        <div className="flex flex-col gap-3">
          {USUARIOS.map(u => (
            <button
              key={u.id}
              onClick={() => setUser(u)}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group"
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0"
                style={{ backgroundColor: u.color }}
              >
                {u.id}
              </div>

              {/* Nombre */}
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-800">
                  {u.nombre} {u.apellido}
                </p>
                <p className="text-[11px] text-gray-400">Bianchi Leiva Abogadas</p>
              </div>

              {/* Arrow */}
              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-[11px] text-gray-300">Sistema de gestión interno</p>
    </div>
  )
}
