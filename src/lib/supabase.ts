import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y rellena los valores.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // La sesión debe sobrevivir a cerrar la app: se guarda en localStorage y el
    // token se renueva solo. El usuario no vuelve a escribir la contraseña.
    persistSession: true,
    autoRefreshToken: true,
    // No hay enlaces mágicos ni OAuth: nada que leer de la URL.
    detectSessionInUrl: false,
    storageKey: 'gym.auth',
  },
})
