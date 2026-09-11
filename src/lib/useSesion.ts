import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/**
 * Contexto y hook de sesión, separados del proveedor.
 *
 * Viven en su propio archivo porque el recarga-en-caliente de Vite solo
 * funciona cuando un módulo exporta únicamente componentes: mezclar el
 * proveedor con el hook obligaba a recargar la página entera en cada cambio.
 */
export type EstadoSesion = {
  sesion: Session | null
  cargando: boolean
}

export const ContextoSesion = createContext<EstadoSesion>({
  sesion: null,
  cargando: true,
})

export function useSesion(): EstadoSesion {
  return useContext(ContextoSesion)
}
