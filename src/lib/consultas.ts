import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'
import { hoy } from './fechas'
import { ultimaVez, type UltimaVez } from './entreno'
import { sumarMacros, type Macros } from './nutricion'
import type {
  Alimento,
  Dia,
  Ejercicio,
  MedidaCorporal,
  ObjetivoNutricional,
  RegistroComida,
  Rutina,
  RutinaDia,
  RutinaEjercicio,
  Serie,
  Sesion,
  TipoDia,
} from './tipos'

/**
 * Lecturas de la app, todas contra IndexedDB.
 *
 * Ninguna pantalla consulta a Supabase. `useLiveQuery` vuelve a ejecutar la
 * consulta cuando cambia lo que ha leído, así que una escritura local se ve al
 * instante y una descarga del servidor también, sin refrescar nada a mano.
 */

/** El día está marcado o no; si no lo está, cuenta como descanso. */
export function useDia(fecha: string): { dia: Dia | undefined; tipo: TipoDia; marcado: boolean } {
  const dia = useLiveQuery(() => db.dias.where('fecha').equals(fecha).first(), [fecha])
  return { dia, tipo: dia?.tipo ?? 'descanso', marcado: dia !== undefined }
}

/**
 * Objetivo vigente para un tipo de día en una fecha: la fila con el
 * `vigente_desde` más alto que no sea posterior a esa fecha. Así el diario de
 * hace tres meses se sigue comparando contra el objetivo de entonces.
 */
export function useObjetivo(
  tipo: TipoDia,
  fecha: string,
): ObjetivoNutricional | undefined {
  return useLiveQuery(
    () =>
      db.objetivos_nutricionales
        .where('[tipo_dia+vigente_desde]')
        .between([tipo, ''], [tipo, fecha], true, true)
        .last(),
    [tipo, fecha],
  )
}

/** Los dos objetivos vigentes hoy, para el formulario de Ajustes. */
export function useObjetivos(fecha: string): Record<TipoDia, ObjetivoNutricional | undefined> {
  return {
    entreno: useObjetivo('entreno', fecha),
    descanso: useObjetivo('descanso', fecha),
  }
}

export function useComidasDelDia(fecha: string): RegistroComida[] {
  return (
    useLiveQuery(() => db.registros_comida.where('fecha').equals(fecha).toArray(), [fecha]) ?? []
  )
}

export function useTotalesDelDia(fecha: string): Macros {
  const comidas = useComidasDelDia(fecha)
  return sumarMacros(comidas)
}

export function useMedida(fecha: string): MedidaCorporal | undefined {
  return useLiveQuery(() => db.medidas_corporales.where('fecha').equals(fecha).first(), [fecha])
}

/**
 * Buscador de la biblioteca. Ordena por uso descendente, que es lo que hace
 * que registrar lo de siempre sean dos toques.
 *
 * La búsqueda se hace en memoria sobre toda la tabla: son los alimentos de una
 * persona (cientos, no millones), y un índice de texto en IndexedDB no sabe
 * buscar por el medio de la palabra ni ignorar acentos.
 */
export function useAlimentos(busqueda = '', limite = 50): Alimento[] {
  return (
    useLiveQuery(async () => {
      const todos = await db.alimentos.toArray()
      const filtrados = busqueda.trim() ? todos.filter(coincide(busqueda)) : todos

      return filtrados
        .sort(
          (a, b) =>
            Number(b.favorito) - Number(a.favorito) ||
            b.veces_usado - a.veces_usado ||
            a.nombre.localeCompare(b.nombre, 'es'),
        )
        .slice(0, limite)
    }, [busqueda, limite]) ?? []
  )
}

/** Compara ignorando acentos y mayúsculas: "platano" encuentra "plátano". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function coincide(busqueda: string) {
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean)
  return (a: Alimento) => {
    const campo = normalizar(`${a.nombre} ${a.marca ?? ''}`)
    return terminos.every((t) => campo.includes(t))
  }
}

export function useAlimento(id: string | null | undefined): Alimento | undefined {
  return useLiveQuery(() => (id ? db.alimentos.get(id) : undefined), [id])
}

/** Los alimentos de una lista de registros, indexados por id. */
export function useAlimentosDe(registros: RegistroComida[]): Map<string, Alimento> {
  const ids = [...new Set(registros.map((r) => r.alimento_id).filter(Boolean))] as string[]
  const clave = ids.join(',')

  const lista = useLiveQuery(
    () =>
      ids.length
        ? db.alimentos.bulkGet(ids)
        : Promise.resolve([] as (Alimento | undefined)[]),
    [clave],
  )

  return new Map(
    (lista ?? []).filter((a): a is Alimento => a !== undefined).map((a) => [a.id, a]),
  )
}

export function useRutinaActiva(): Rutina | undefined {
  // El índice único parcial del servidor garantiza que no haya dos.
  return useLiveQuery(() => db.rutinas.filter((r) => r.activa).first())
}

export function useDiasDeRutina(rutinaId: string | undefined): RutinaDia[] {
  return (
    useLiveQuery(
      () =>
        rutinaId
          ? db.rutina_dias.where('rutina_id').equals(rutinaId).sortBy('orden')
          : Promise.resolve([] as RutinaDia[]),
      [rutinaId],
    ) ?? []
  )
}

export function useSesionesDelDia(fecha: string): Sesion[] {
  return useLiveQuery(() => db.sesiones.where('fecha').equals(fecha).toArray(), [fecha]) ?? []
}

// -----------------------------------------------------------------------------
// Entrenamiento
// -----------------------------------------------------------------------------

/** El catálogo, sin los archivados salvo que se pidan. */
export function useEjercicios(busqueda = '', incluirArchivados = false): Ejercicio[] {
  return (
    useLiveQuery(async () => {
      const todos = await db.ejercicios.toArray()
      const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean)

      return todos
        .filter((e) => (incluirArchivados || !e.archivado) &&
          terminos.every((t) => normalizar(`${e.nombre} ${e.grupo_muscular ?? ''}`).includes(t)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }, [busqueda, incluirArchivados]) ?? []
  )
}

/** Los ejercicios indexados por id, para resolver nombres al pintar series. */
export function useCatalogo(): Map<string, Ejercicio> {
  const lista = useLiveQuery(() => db.ejercicios.toArray()) ?? []
  return new Map(lista.map((e) => [e.id, e]))
}

export function useSesion(id: string | undefined): Sesion | undefined {
  return useLiveQuery(() => (id ? db.sesiones.get(id) : undefined), [id])
}

export function useSeriesDeSesion(sesionId: string | undefined): Serie[] {
  return (
    useLiveQuery(
      () =>
        sesionId
          ? db.series.where('sesion_id').equals(sesionId).sortBy('numero')
          : Promise.resolve([] as Serie[]),
      [sesionId],
    ) ?? []
  )
}

export function useEjerciciosDeDia(diaId: string | null | undefined): RutinaEjercicio[] {
  return (
    useLiveQuery(
      () =>
        diaId
          ? db.rutina_ejercicios.where('dia_id').equals(diaId).sortBy('orden')
          : Promise.resolve([] as RutinaEjercicio[]),
      [diaId],
    ) ?? []
  )
}

/**
 * Qué se hizo la última vez en cada ejercicio. Se recalcula cuando cambian las
 * series o las sesiones, así que al anotar una serie la referencia sigue viva.
 */
export function useUltimaVez(
  ejercicioIds: string[],
  excluirSesion?: string,
): Map<string, UltimaVez> {
  const clave = ejercicioIds.join(',')

  return (
    // `ultimaVez` consulta Dexie por dentro, y useLiveQuery sigue esas lecturas
    // aunque estén en otra función: anotar una serie repite la consulta sola.
    useLiveQuery(() => ultimaVez(ejercicioIds, excluirSesion), [clave, excluirSesion]) ??
    new Map()
  )
}

export function useRutinas(): Rutina[] {
  return useLiveQuery(() => db.rutinas.orderBy('id').toArray()) ?? []
}

export function useSesiones(limite = 30): Sesion[] {
  return (
    useLiveQuery(
      () => db.sesiones.orderBy('fecha').reverse().limit(limite).toArray(),
      [limite],
    ) ?? []
  )
}

/** Si hay algo en la base local: distingue "sin datos" de "aún descargando". */
export function useHayDatos(): boolean | undefined {
  return useLiveQuery(async () => (await db.ejercicios.count()) > 0)
}

/**
 * La fecha de hoy, que se corrige sola.
 *
 * Una PWA instalada no se recarga: se queda abierta en segundo plano días
 * enteros. Sin esto, abrir la app por la mañana enseñaría el diario de ayer y
 * el desayuno se registraría en el día equivocado.
 */
export function useHoy(): string {
  const [fecha, setFecha] = useState(hoy)

  useEffect(() => {
    const revisar = () => setFecha((actual) => (actual === hoy() ? actual : hoy()))
    const reloj = setInterval(revisar, 30_000)
    document.addEventListener('visibilitychange', revisar)

    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', revisar)
    }
  }, [])

  return fecha
}
