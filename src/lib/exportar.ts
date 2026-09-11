import { db } from './db'
import { hoy } from './fechas'
import { TABLAS } from './tipos'

/**
 * Exportación completa a JSON.
 *
 * Es la red de seguridad que pide el plan frente a cualquier problema con
 * Supabase: un archivo con **todo** lo registrado, legible sin la app y sin la
 * base de datos. Se arma desde IndexedDB y no desde el servidor, así que
 * funciona también sin conexión.
 */

export type Exportacion = {
  version: 1
  generado: string
  /** Lo que quedaba por enviar al servidor cuando se exportó. */
  pendientes_de_enviar: number
  datos: Record<string, unknown[]>
}

/** Marcas internas de la base local que no significan nada fuera de ella. */
function limpiar(fila: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(fila)) {
    if (!clave.startsWith('_')) salida[clave] = valor
  }
  return salida
}

export async function exportarTodo(): Promise<Exportacion> {
  const datos: Record<string, unknown[]> = {}

  for (const tabla of TABLAS) {
    const filas = (await db.table(tabla).toArray()) as Record<string, unknown>[]
    datos[tabla] = filas.map(limpiar)
  }

  return {
    version: 1,
    generado: new Date().toISOString(),
    pendientes_de_enviar: await db.cola.count(),
    datos,
  }
}

export function nombreDeArchivo(): string {
  return `gym-${hoy()}.json`
}

/**
 * Descarga la exportación como archivo.
 *
 * En una PWA instalada en iOS esto abre la hoja de compartir, que es lo que
 * permite mandarlo a Archivos o a iCloud. El `URL.revokeObjectURL` va detrás de
 * un tiempo muerto porque Safari cancela la descarga si se revoca al instante.
 */
export function descargar(exportacion: Exportacion, nombre = nombreDeArchivo()): void {
  const blob = new Blob([JSON.stringify(exportacion, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()

  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
