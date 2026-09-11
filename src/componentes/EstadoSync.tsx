import { useEffect, useState } from 'react'
import { useSync } from '../lib/useSync'

/**
 * Indicador de sincronización: un punto en la cabecera.
 *
 * Lee el tamaño real de la cola de escrituras, no `navigator.onLine`. Tener
 * cobertura no significa que lo registrado en el gimnasio ya esté guardado en
 * el servidor, y es eso lo que importa saber.
 */
export default function EstadoSync() {
  const { fase, pendientes, fallidas } = useSync()
  const [enLinea, setEnLinea] = useState(navigator.onLine)

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  const { color, texto, latido } = describir(fase, pendientes, fallidas, enLinea)

  return (
    <span
      role="status"
      title={texto}
      aria-label={texto}
      className={`h-2 w-2 rounded-full ${color} ${latido ? 'animate-pulse' : ''}`}
    />
  )
}

function describir(
  fase: string,
  pendientes: number,
  fallidas: number,
  enLinea: boolean,
): { color: string; texto: string; latido: boolean } {
  if (fallidas > 0) {
    return {
      color: 'bg-red-500',
      texto: `${fallidas} ${fallidas === 1 ? 'cambio' : 'cambios'} sin guardar por un error. Míralo en Ajustes.`,
      latido: false,
    }
  }

  if (!enLinea) {
    return {
      color: 'bg-amber-500',
      texto: pendientes
        ? `Sin conexión · ${pendientes} por enviar`
        : 'Sin conexión · todo guardado',
      latido: false,
    }
  }

  if (fase === 'sincronizando') {
    return { color: 'bg-amber-500', texto: `Sincronizando ${pendientes}…`, latido: true }
  }

  if (pendientes > 0) {
    return { color: 'bg-amber-500', texto: `${pendientes} por enviar`, latido: false }
  }

  return { color: 'bg-acento', texto: 'Sincronizado', latido: false }
}
