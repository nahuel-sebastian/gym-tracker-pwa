import { useSyncExternalStore } from 'react'
import { leerEstado, suscribirse, type EstadoSync } from './sincronizacion'

/** Estado de la cola de sincronización, para pintarlo en la cabecera. */
export function useSync(): EstadoSync {
  return useSyncExternalStore(suscribirse, leerEstado, leerEstado)
}
