import { borrar, guardar } from './datos'
import { db } from './db'
import type { RutinaImportada } from './rutinaImportada'
import type { Ejercicio, RutinaDia, Serie, TipoSerie } from './tipos'

/**
 * Acciones de entrenamiento: rutinas, sesiones y series.
 *
 * Las marcas de tiempo de una sesión (`hora_inicio`, `hora_fin`) sí usan
 * `toISOString()`: son instantes, columnas `timestamptz`. La regla de calcular
 * la fecha en local es para las columnas `date`, que representan un día del
 * calendario y no un instante.
 */

// -----------------------------------------------------------------------------
// Sesiones
// -----------------------------------------------------------------------------

/**
 * Empieza una sesión. Sin día de rutina es una sesión libre.
 *
 * Se guarda una copia del nombre del día: si mañana se reescribe la rutina, la
 * sesión de hoy tiene que seguir siendo legible.
 */
export async function empezarSesion(fecha: string, dia?: RutinaDia): Promise<string> {
  return guardar('sesiones', {
    dia_id: dia?.id ?? null,
    nombre_dia: dia?.nombre ?? null,
    fecha,
    hora_inicio: new Date().toISOString(),
    hora_fin: null,
    notas: null,
    sensacion: null,
  })
}

export async function terminarSesion(
  id: string,
  datos: { notas?: string | null; sensacion?: number | null } = {},
): Promise<void> {
  await guardar('sesiones', { id, hora_fin: new Date().toISOString(), ...datos })
}

/** Vuelve a abrir una sesión cerrada por error. */
export async function reabrirSesion(id: string): Promise<void> {
  await guardar('sesiones', { id, hora_fin: null })
}

export async function borrarSesion(id: string): Promise<void> {
  await borrar('sesiones', id)
}

// -----------------------------------------------------------------------------
// Series
// -----------------------------------------------------------------------------

export type ValoresSerie = {
  peso_kg: number | null
  reps: number | null
  rir: number | null
  tipo?: TipoSerie
}

/**
 * Anota una serie. El número se calcula sobre las que ya hay de ese ejercicio
 * en la sesión, así que la numeración es por ejercicio y no por sesión.
 */
export async function anotarSerie(
  sesionId: string,
  ejercicioId: string,
  valores: ValoresSerie,
): Promise<string> {
  const hechas = await db.series
    .where('sesion_id')
    .equals(sesionId)
    .filter((s) => s.ejercicio_id === ejercicioId)
    .toArray()

  const numero = hechas.reduce((max, s) => Math.max(max, s.numero), 0) + 1

  return guardar('series', {
    sesion_id: sesionId,
    ejercicio_id: ejercicioId,
    numero,
    tipo: 'normal',
    ...valores,
  })
}

export async function corregirSerie(id: string, valores: Partial<Serie>): Promise<void> {
  await guardar('series', { id, ...valores })
}

export async function borrarSerie(id: string): Promise<void> {
  await borrar('series', id)
}

// -----------------------------------------------------------------------------
// Rutinas
// -----------------------------------------------------------------------------

export async function crearRutina(nombre: string, fechaInicio: string): Promise<string> {
  return guardar('rutinas', {
    nombre,
    activa: false,
    fecha_inicio: fechaInicio,
  })
}

/**
 * Activa una rutina y desactiva la que estuviera.
 *
 * El orden importa y no es cosmético: el servidor tiene un índice único parcial
 * que solo admite una rutina activa. Si la activación se enviara antes que la
 * desactivación, chocaría con el índice, el error sería definitivo (23505) y
 * acabaría en la cola de fallidas. La cola respeta el orden de encolado, así
 * que desactivar primero es lo que hace que esto funcione sin conexión.
 */
export async function activarRutina(id: string): Promise<void> {
  const activas = await db.rutinas.filter((r) => r.activa && r.id !== id).toArray()
  for (const r of activas) await guardar('rutinas', { id: r.id, activa: false })
  await guardar('rutinas', { id, activa: true })
}

export async function borrarRutina(id: string): Promise<void> {
  await borrar('rutinas', id)
}

export async function anadirDia(rutinaId: string, nombre: string): Promise<string> {
  const hermanos = await db.rutina_dias.where('rutina_id').equals(rutinaId).toArray()
  const orden = hermanos.reduce((max, d) => Math.max(max, d.orden), -1) + 1
  return guardar('rutina_dias', { rutina_id: rutinaId, nombre, orden })
}

export async function borrarDia(id: string): Promise<void> {
  await borrar('rutina_dias', id)
}

/**
 * Lo que se pone cuando no se dice otra cosa. Está exportado porque la vista
 * previa de una rutina importada tiene que enseñar lo que se va a guardar de
 * verdad, no un "?" donde luego habrá un 3.
 */
export const OBJETIVOS_DEFECTO = { series_objetivo: 3, reps_objetivo: '8-10', rir_objetivo: 2 }

export async function anadirEjercicioADia(
  diaId: string,
  ejercicioId: string,
  objetivos: {
    series_objetivo?: number | null
    reps_objetivo?: string | null
    rir_objetivo?: number | null
    descanso_seg?: number | null
    notas?: string | null
  } = {},
): Promise<string> {
  const hermanos = await db.rutina_ejercicios.where('dia_id').equals(diaId).toArray()
  const orden = hermanos.reduce((max, e) => Math.max(max, e.orden), -1) + 1

  return guardar('rutina_ejercicios', {
    dia_id: diaId,
    ejercicio_id: ejercicioId,
    orden,
    series_objetivo: objetivos.series_objetivo ?? OBJETIVOS_DEFECTO.series_objetivo,
    reps_objetivo: objetivos.reps_objetivo ?? OBJETIVOS_DEFECTO.reps_objetivo,
    rir_objetivo: objetivos.rir_objetivo ?? OBJETIVOS_DEFECTO.rir_objetivo,
    descanso_seg: objetivos.descanso_seg ?? null,
    notas: objetivos.notas ?? null,
  })
}

export async function quitarEjercicioDeDia(id: string): Promise<void> {
  await borrar('rutina_ejercicios', id)
}

/**
 * Mueve un elemento una posición arriba o abajo intercambiando el orden con su
 * vecino. Dos escrituras, y la cola las manda en ese mismo orden.
 */
export async function mover(
  tabla: 'rutina_dias' | 'rutina_ejercicios',
  id: string,
  direccion: -1 | 1,
  claveGrupo: 'rutina_id' | 'dia_id',
): Promise<void> {
  const fila = await db.table(tabla).get(id)
  if (!fila) return

  const hermanos = (await db
    .table(tabla)
    .where(claveGrupo)
    .equals(fila[claveGrupo])
    .sortBy('orden')) as { id: string; orden: number }[]

  const posicion = hermanos.findIndex((h) => h.id === id)
  const vecino = hermanos[posicion + direccion]
  if (!vecino) return

  await guardar(tabla, { id: fila.id, orden: vecino.orden })
  await guardar(tabla, { id: vecino.id, orden: fila.orden })
}

// -----------------------------------------------------------------------------
// Catálogo de ejercicios
// -----------------------------------------------------------------------------

export async function guardarEjercicio(
  datos: Partial<Ejercicio> & { nombre: string },
): Promise<string> {
  const porDefecto: Partial<Ejercicio> = datos.id
    ? {}
    : {
        grupo_muscular: null,
        equipamiento: null,
        es_unilateral: false,
        notas: null,
        archivado: false,
      }

  return guardar('ejercicios', { ...porDefecto, ...datos })
}

/**
 * Los ejercicios se archivan, no se borran.
 *
 * Las claves ajenas hacia `ejercicios` son `on delete restrict`: un ejercicio
 * con series detrás no se puede borrar sin llevarse el histórico por delante.
 * Archivado deja de salir en los buscadores y sigue explicando las series
 * antiguas.
 */
export async function archivarEjercicio(id: string, archivado = true): Promise<void> {
  await guardar('ejercicios', { id, archivado })
}

// -----------------------------------------------------------------------------
// Importar y compartir rutinas
// -----------------------------------------------------------------------------

/**
 * Guarda una rutina importada.
 *
 * Crea los ejercicios que no estaban en el catálogo, y **no activa la rutina**:
 * el índice único del servidor solo admite una activa, y activar por sorpresa
 * la que acabas de importar te cambiaría la que estás haciendo.
 */
export async function guardarRutinaImportada(
  rutina: RutinaImportada,
  fechaInicio: string,
): Promise<string> {
  const rutinaId = await crearRutina(rutina.nombre, fechaInicio)

  for (const dia of rutina.dias) {
    const diaId = await anadirDia(rutinaId, dia.nombre)

    for (const e of dia.ejercicios) {
      const ejercicioId =
        e.ejercicio_id ?? (await guardarEjercicio({ nombre: e.nombre }))

      await anadirEjercicioADia(diaId, ejercicioId, {
        series_objetivo: e.series_objetivo,
        reps_objetivo: e.reps_objetivo,
        rir_objetivo: e.rir_objetivo,
        descanso_seg: e.descanso_seg,
        notas: e.notas,
      })
    }
  }

  return rutinaId
}

/**
 * La rutina como JSON, con el mismo sobre que acepta el importador.
 *
 * Es lo que permite pasar una rutina a otra cuenta sin recrearla a mano, y sin
 * pasar por Claude: la app produce lo que la app entiende. Los ejercicios van
 * por nombre y no por id, porque los ids son de un usuario y no valen en otro.
 */
export async function rutinaComoJson(rutinaId: string): Promise<string> {
  const rutina = await db.rutinas.get(rutinaId)
  if (!rutina) throw new Error('Esa rutina ya no existe.')

  const dias = await db.rutina_dias.where('rutina_id').equals(rutinaId).sortBy('orden')
  const catalogo = new Map((await db.ejercicios.toArray()).map((e) => [e.id, e.nombre]))

  const salida = {
    tipo: 'rutina',
    nombre: rutina.nombre,
    dias: await Promise.all(
      dias.map(async (dia) => ({
        nombre: dia.nombre,
        ejercicios: (await db.rutina_ejercicios.where('dia_id').equals(dia.id).sortBy('orden')).map(
          (e) => ({
            nombre: catalogo.get(e.ejercicio_id) ?? '(ejercicio borrado)',
            series_objetivo: e.series_objetivo,
            reps_objetivo: e.reps_objetivo,
            rir_objetivo: e.rir_objetivo,
            descanso_seg: e.descanso_seg,
            notas: e.notas,
          }),
        ),
      })),
    ),
  }

  return JSON.stringify(salida, null, 2)
}
