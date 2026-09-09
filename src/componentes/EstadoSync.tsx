import { useEffect, useState } from 'react'

/**
 * Indicador de estado de sincronización.
 * De momento solo refleja la conectividad; en la fase offline pasará a leer
 * el tamaño de la cola de escritura en IndexedDB.
 */
export default function EstadoSync() {
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

  return (
    <span
      title={enLinea ? 'Sincronizado' : 'Sin conexión'}
      aria-label={enLinea ? 'Sincronizado' : 'Sin conexión'}
      className={`h-2 w-2 rounded-full ${enLinea ? 'bg-acento' : 'bg-amber-500'}`}
    />
  )
}
