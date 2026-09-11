import { db } from './db'
import type { Operacion } from './db'
import { pedirSincronizacion } from './senal'
import type { NombreTabla, Tablas } from './tipos'

/**
 * API única de escritura.
 *
 * Toda escritura de la app pasa por aquí y hace dos cosas, en este orden:
 *
 *   1. Aplica el cambio a IndexedDB. La interfaz, que lee de IndexedDB con
 *      `useLiveQuery`, se actualiza al instante.
 *   2. Encola el envío al servidor.
 *
 * Nunca se espera a la red. En un sótano sin cobertura la app se comporta
 * igual que con wifi; la única diferencia es el punto del indicador de
 * sincronización en la cabecera.
 */

/** Campos que el servidor posee y el cliente no envía. */
const NO_SE_ENVIAN = new Set(['created_at', 'updated_at'])

/**
 * Prepara la fila para el upsert: quita las marcas locales (prefijo `_`) y los
 * relojes del servidor. `user_id` no se envía nunca porque la columna tiene
 * `default auth.uid()`.
 */
function paraServidor(fila: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(fila)) {
    if (clave.startsWith('_') || NO_SE_ENVIAN.has(clave)) continue
    salida[clave] = valor
  }
  return salida
}

/**
 * Hijos que el servidor borra en cascada. Al borrar el padre hay que borrarlos
 * también aquí, o la interfaz seguiría mostrando series de una sesión que ya
 * no existe. No se encola su borrado: la cascada del servidor ya se encarga.
 */
const CASCADAS: Partial<Record<NombreTabla, { tabla: NombreTabla; clave: string }[]>> = {
  rutinas: [{ tabla: 'rutina_dias', clave: 'rutina_id' }],
  rutina_dias: [{ tabla: 'rutina_ejercicios', clave: 'dia_id' }],
  sesiones: [{ tabla: 'series', clave: 'sesion_id' }],
  recetas: [{ tabla: 'receta_ingredientes', clave: 'receta_id' }],
}

/**
 * Referencias que el servidor pone a null al borrar el destino
 * (`on delete set null`). Se replica para que el histórico local quede igual
 * que el del servidor: borrar una rutina no borra las sesiones entrenadas.
 */
const A_NULO: Partial<Record<NombreTabla, { tabla: NombreTabla; clave: string }[]>> = {
  rutina_dias: [{ tabla: 'sesiones', clave: 'dia_id' }],
  alimentos: [{ tabla: 'registros_comida', clave: 'alimento_id' }],
  recetas: [{ tabla: 'registros_comida', clave: 'receta_id' }],
}

/** Tablas que la escritura de una operación puede tocar, para la transacción. */
function tablasImplicadas(nombre: NombreTabla): string[] {
  const vistas = new Set<string>([nombre])
  const pendientes: NombreTabla[] = [nombre]

  while (pendientes.length) {
    const actual = pendientes.pop()!
    for (const { tabla } of CASCADAS[actual] ?? []) {
      if (!vistas.has(tabla)) {
        vistas.add(tabla)
        pendientes.push(tabla)
      }
    }
    for (const { tabla } of A_NULO[actual] ?? []) vistas.add(tabla)
  }

  return [...vistas, 'cola']
}

/**
 * Crea o actualiza una fila. Devuelve su id, que se genera aquí si no venía:
 * el cliente es dueño de los uuid, y así se pueden relacionar filas que el
 * servidor todavía no conoce.
 *
 * `cambios` es parcial y se fusiona sobre la fila local existente, de modo que
 * editar un campo no borra el resto. El envío es siempre la fila completa,
 * coherente con "última escritura gana".
 */
export async function guardar<T extends NombreTabla>(
  nombre: T,
  cambios: Partial<Tablas[T]> & { id?: string },
): Promise<string> {
  const id = cambios.id ?? crypto.randomUUID()

  await db.transaction('rw', tablasImplicadas(nombre), async () => {
    const tabla = db.table(nombre)
    const previa = (await tabla.get(id)) as Record<string, unknown> | undefined
    const fila = {
      ...previa,
      ...cambios,
      id,
      // Marca optimista: el trigger del servidor pondrá la suya, que llegará
      // en la siguiente descarga. Aquí sirve para ordenar lo recién escrito.
      updated_at: new Date().toISOString(),
    }

    await tabla.put(fila)
    await encolar({
      tabla: nombre,
      fila_id: id,
      tipo: 'guardar',
      datos: paraServidor(fila),
    })
  })

  pedirSincronizacion()
  return id
}

/** Borra una fila, su cascada local y las referencias que quedan a null. */
export async function borrar(nombre: NombreTabla, id: string): Promise<void> {
  await db.transaction('rw', tablasImplicadas(nombre), async () => {
    await borrarEnCascada(nombre, id, true)
  })

  pedirSincronizacion()
}

async function borrarEnCascada(
  nombre: NombreTabla,
  id: string,
  raiz: boolean,
): Promise<void> {
  for (const { tabla, clave } of CASCADAS[nombre] ?? []) {
    const hijos = await db.table(tabla).where(clave).equals(id).primaryKeys()
    for (const hijo of hijos) await borrarEnCascada(tabla, hijo as string, false)
  }

  for (const { tabla, clave } of A_NULO[nombre] ?? []) {
    await db.table(tabla).where(clave).equals(id).modify({ [clave]: null })
  }

  const fila = (await db.table(nombre).get(id)) as { _enviado?: boolean } | undefined
  await db.table(nombre).delete(id)

  if (!raiz) {
    // Hijo de una cascada: el servidor lo borrará solo al borrar el padre.
    // Sí hay que cancelar sus envíos pendientes, o un insert rezagado crearía
    // una fila huérfana apuntando a un padre que ya no existe.
    await cancelarPendientes(nombre, id)
    return
  }

  if (!fila?._enviado) {
    // El servidor no sabe que esta fila existe: basta con cancelar su envío.
    // Encolar el borrado sería pedirle que borre algo inexistente.
    await cancelarPendientes(nombre, id)
    return
  }

  await encolar({ tabla: nombre, fila_id: id, tipo: 'borrar', datos: null })
}

async function cancelarPendientes(nombre: NombreTabla, id: string): Promise<void> {
  await db.cola.where('[tabla+fila_id]').equals([nombre, id]).delete()
}

/**
 * Añade la operación a la cola fusionándola con la que ya hubiera para esa
 * misma fila. Sin esta fusión, corregir el peso de una serie cinco veces sin
 * cobertura mandaría cinco escrituras, y la cola crecería con trabajo inútil.
 */
async function encolar(
  op: Pick<Operacion, 'tabla' | 'fila_id' | 'tipo' | 'datos'>,
): Promise<void> {
  const nueva: Operacion = {
    ...op,
    intentos: 0,
    proximo_intento: 0,
    ultimo_error: null,
    creado: Date.now(),
  }

  const pendiente = await db.cola
    .where('[tabla+fila_id]')
    .equals([op.tabla, op.fila_id])
    .first()

  if (!pendiente) {
    await db.cola.add(nueva)
    return
  }

  // Se conserva el id de la operación existente para no perder su puesto en la
  // cola: el orden es lo que garantiza que la sesión se cree antes que sus
  // series. Los contadores de reintento se reinician porque el contenido es
  // nuevo y puede que el error anterior ya no se repita.
  await db.cola.put({ ...nueva, id: pendiente.id, creado: pendiente.creado })
}

/**
 * Escribe filas que vienen del servidor. No pasan por la cola, y quedan
 * marcadas como conocidas por el servidor.
 *
 * Si una fila tiene un envío pendiente se ignora la versión descargada: lo
 * local es más reciente y está a punto de subir. Es la parte de "última
 * escritura gana" que evita que la descarga pise un cambio sin sincronizar.
 */
export async function guardarDelServidor(
  nombre: NombreTabla,
  filas: Record<string, unknown>[],
): Promise<void> {
  if (!filas.length) return

  await db.transaction('rw', [nombre, 'cola'], async () => {
    const pendientes = new Set(
      (await db.cola.where('tabla').equals(nombre).toArray()).map((o) => o.fila_id),
    )
    const aEscribir = filas
      .filter((f) => !pendientes.has(f.id as string))
      .map((f) => ({ ...f, _enviado: true }))

    await db.table(nombre).bulkPut(aEscribir)
  })
}

/** Marca una fila como ya conocida por el servidor, tras subirla con éxito. */
export async function marcarEnviada(nombre: NombreTabla, id: string): Promise<void> {
  await db.table(nombre).where('id').equals(id).modify({ _enviado: true })
}

export { paraServidor }
