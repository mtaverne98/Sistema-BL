import { useEffect, useState } from 'react'
import { exchangeCode } from '../lib/googleCalendar'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

export default function AuthCallback() {
  const [state, setState] = useState('loading') // 'loading' | 'success' | 'error'
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('code')
    const err    = params.get('error')

    if (err) {
      setError(err === 'access_denied' ? 'Acceso denegado por el usuario.' : err)
      setState('error')
      return
    }
    if (!code) {
      setError('No se recibió código de autorización de Google.')
      setState('error')
      return
    }

    exchangeCode(code)
      .then(() => {
        setState('success')
        setTimeout(() => window.location.replace('/configuracion'), 1600)
      })
      .catch(e => {
        setError(e.message)
        setState('error')
      })
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 w-[380px] text-center">

        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-[#1a2e4a] mx-auto mb-6 flex items-center justify-center">
          <span className="text-white font-bold text-sm">BL</span>
        </div>

        {state === 'loading' && (
          <>
            <Loader size={36} className="mx-auto text-blue-400 animate-spin mb-4" />
            <p className="text-sm font-bold text-gray-800">Conectando con Google Calendar…</p>
            <p className="text-xs text-gray-400 mt-1.5">Verificando credenciales de acceso</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle size={36} className="mx-auto text-emerald-400 mb-4" />
            <p className="text-sm font-bold text-gray-800">¡Google Calendar conectado!</p>
            <p className="text-xs text-gray-400 mt-1.5">Redirigiendo a Configuración…</p>
            <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full animate-[grow_1.5s_ease-in-out]" style={{ width: '100%' }} />
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle size={36} className="mx-auto text-red-400 mb-4" />
            <p className="text-sm font-bold text-gray-800">Error al conectar</p>
            <p className="text-xs text-red-500 mt-1.5 mb-5 leading-relaxed">{error}</p>
            <button
              onClick={() => window.location.replace('/configuracion')}
              className="text-xs bg-[#1a2e4a] text-white px-5 py-2 rounded-lg hover:bg-[#2570ba] transition-colors font-semibold"
            >
              Volver a Configuración
            </button>
          </>
        )}
      </div>
    </div>
  )
}
