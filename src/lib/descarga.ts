import { guardarDelServidor } from './datos'
import { escribirMeta, leerMeta } from './db'
import { supabase } from './supabase'
import { TABLAS, type NombreTabla } from './tipos'

/**
 * Descarga incremental del servidor a IndexedDB.
 *
 * La app tiene que arrancar y ser usable sin red, así que la base local no es
 * una caché de lo que se está mirando: es una copia de los datos del usuario.
 * Se descargan **las catorce tablas completas**, no solo los últimos 30 días
 * que pedía el plan, porque las gráficas de Progreso y la vista de "última vez"
 * necesitan el histórico y trocearlo por fechas obligaría a dos rutas de
 * lectura distintas según haya o no cobertura. Son los datos de una persona:
 * un año de uso intenso no llega al megabyte.
 *
 * Cada tabla lleva su propia marca de agua sobre `updated_at`, que es del
 * reloj del servidor (lo pone un trigger). Solo baja lo que cambió desde la
 * última vez.
 *
 * Lo que esta descarga **no** ve son los borrados hechos en otro dispositivo:
 * una fila borrada allí simplemente deja de venir, y aquí se queda. Es un
 * límite aceptado, no un olvido — la app es de un usuario con un teléfono, y
 * el plan descarta expresamente construir resolución de conflictos.
 */

const TAMANO_PAGINA = 1000
const ORIGEN_DEL_TIEMPO = '1970-01-01T00:00:00Z'

function claveMarca(tabla: NombreTabla): string {
  return `descarga:${tabla}`
}

async function descargarTabla(tabla: NombreTabla): Promise<void> {
  const marca = (await leerMeta<string>(claveMarca(tabla))) ?? ORIGEN_DEL_TIEMPO
  let desde = 0
  let nuevaMarca = marca

  for (;;) {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      // `gte` y no `gt`: si varias filas comparten `updated_at` justo en el
      // corte, `gt` se dejaría algunas fuera. Volver a bajar la fila del borde
      // no cuesta nada porque la escritura local es idempotente.
      .gte('updated_at', marca)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) throw error
    if (!data?.length) break

    await guardarDelServidor(tabla, data)

    for (const fila of data) {
      const u = fila.updated_at as string
      if (u > nuevaMarca) nuevaMarca = u
    }

    if (data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  await escribirMeta(claveMarca(tabla), nuevaMarca)
}

/**
 * Baja los cambios de todas las tablas. Con `completa`, olvida las marcas de
 * agua y vuelve a traerlo todo: es la reparación a mano si la copia local
 * quedara descuadrada.
 */
export async function descargar(completa = false): Promise<void> {
  if (completa) {
    await Promise.all(TABLAS.map((t) => escribirMeta(claveMarca(t), ORIGEN_DEL_TIEMPO)))
  }

  await Promise.all(TABLAS.map(descargarTabla))
}
