import Dexie, { type EntityTable } from 'dexie'
import type {
  Ajustes,
  Alimento,
  Dia,
  Ejercicio,
  FotoProgreso,
  MedidaCorporal,
  NombreTabla,
  ObjetivoNutricional,
  Receta,
  RecetaIngrediente,
  RegistroComida,
  Rutina,
  RutinaDia,
  RutinaEjercicio,
  Serie,
  Sesion,
} from './tipos'

/**
 * Una operación pendiente de enviar al servidor.
 *
 * La cola es el corazón del modo offline: toda escritura pasa por aquí y se
 * vacía cuando hay red. El `id` autoincremental fija el orden de envío, que
 * además respeta las claves ajenas (una sesión se crea antes que sus series
 * porque se encoló antes).
 */
export type Operacion = {
  id?: number
  tabla: NombreTabla
  fila_id: string
  tipo: 'guardar' | 'borrar'
  /** Fila completa a subir con upsert. `null` en los borrados. */
  datos: Record<string, unknown> | null
  intentos: number
  /** Epoch ms: antes de esta marca no se reintenta (retroceso exponencial). */
  proximo_intento: number
  ultimo_error: string | null
  creado: number
}

/**
 * Operación que el servidor rechazó de forma definitiva (una restricción
 * incumplida, por ejemplo). Se aparta de la cola para que un envío imposible
 * no bloquee para siempre las series que vienen detrás, y se muestra como
 * error de sincronización.
 */
export type OperacionFallida = Operacion & {
  id?: number
  fallo: string
  fallado_en: number
}

/** Pares clave/valor de servicio: marcas de última descarga, usuario, etc. */
export type Meta = { clave: string; valor: unknown }

export class BaseLocal extends Dexie {
  ejercicios!: EntityTable<Ejercicio, 'id'>
  rutinas!: EntityTable<Rutina, 'id'>
  rutina_dias!: EntityTable<RutinaDia, 'id'>
  rutina_ejercicios!: EntityTable<RutinaEjercicio, 'id'>
  sesiones!: EntityTable<Sesion, 'id'>
  series!: EntityTable<Serie, 'id'>
  alimentos!: EntityTable<Alimento, 'id'>
  recetas!: EntityTable<Receta, 'id'>
  receta_ingredientes!: EntityTable<RecetaIngrediente, 'id'>
  registros_comida!: EntityTable<RegistroComida, 'id'>
  objetivos_nutricionales!: EntityTable<ObjetivoNutricional, 'id'>
  dias!: EntityTable<Dia, 'id'>
  medidas_corporales!: EntityTable<MedidaCorporal, 'id'>
  fotos_progreso!: EntityTable<FotoProgreso, 'id'>
  ajustes!: EntityTable<Ajustes, 'id'>

  cola!: EntityTable<Operacion, 'id'>
  fallidas!: EntityTable<OperacionFallida, 'id'>
  meta!: EntityTable<Meta, 'clave'>

  constructor() {
    super('gym')

    // Ningún índice de fecha es único, ni siquiera donde el servidor lo exige
    // (`dias.fecha`, `medidas_corporales.fecha`). La unicidad se resuelve
    // reutilizando el id de la fila existente, en `datos.ts`; un índice único
    // aquí solo cambiaría un dato incoherente por una excepción en pantalla.
    this.version(1).stores({
      ejercicios: 'id, nombre, grupo_muscular, archivado',
      rutinas: 'id, activa',
      rutina_dias: 'id, rutina_id, [rutina_id+orden]',
      rutina_ejercicios: 'id, dia_id, ejercicio_id, [dia_id+orden]',
      sesiones: 'id, fecha, dia_id',
      series: 'id, sesion_id, ejercicio_id, [sesion_id+numero]',
      alimentos: 'id, nombre, codigo_barras, veces_usado, favorito',
      recetas: 'id, nombre',
      receta_ingredientes: 'id, receta_id, alimento_id',
      registros_comida: 'id, fecha, alimento_id, receta_id, [fecha+momento]',
      objetivos_nutricionales: 'id, tipo_dia, [tipo_dia+vigente_desde]',
      dias: 'id, fecha',
      medidas_corporales: 'id, fecha',
      fotos_progreso: 'id, fecha',
      // Una sola fila; no hay nada por lo que filtrarla.
      ajustes: 'id',

      // `tabla` y `fila_id` van sueltos además del compuesto: Dexie no resuelve
      // una consulta por el primer componente de un índice compuesto.
      cola: '++id, tabla, fila_id, [tabla+fila_id], proximo_intento',
      fallidas: '++id, fallado_en',
      meta: 'clave',
    })
  }
}

export const db = new BaseLocal()

/** Acceso a una tabla de datos por su nombre, con el tipo de su fila. */
export function tabla(nombre: NombreTabla) {
  return db.table(nombre)
}

export async function leerMeta<T>(clave: string): Promise<T | undefined> {
  const fila = await db.meta.get(clave)
  return fila?.valor as T | undefined
}

export async function escribirMeta(clave: string, valor: unknown): Promise<void> {
  await db.meta.put({ clave, valor })
}

/**
 * Vacía la base local por completo. Se llama al cerrar sesión: los datos de
 * una cuenta no pueden quedar visibles para la siguiente, y también al
 * detectar que el usuario autenticado no es el que dejó estos datos.
 *
 * Tira también la cola: son escrituras que ya no se pueden atribuir.
 */
export async function borrarTodoLoLocal(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
