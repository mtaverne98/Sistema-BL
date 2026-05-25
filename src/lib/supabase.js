import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
    'Verifica que el archivo .env existe en la raíz del proyecto.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Verifica la conexión con Supabase intentando hacer una consulta simple.
 * Retorna { ok: true } si conecta, o { ok: false, error } si falla.
 */
export async function verificarConexion() {
  try {
    const { error } = await supabase.from('clientes').select('id').limit(1)
    // Si la tabla no existe aún, Supabase devuelve un error de "relation does not exist",
    // pero eso confirma que la conexión sí funciona (el error es de BD, no de red/auth).
    if (error && error.code !== 'PGRST116' && !error.message.includes('does not exist')) {
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
