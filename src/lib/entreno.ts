import { db } from './db'
import type { Serie, TipoSerie } from './tipos'

/**
 * Consultas de entrenamiento sobre la base local.
 *
 * "Qué hice la última vez en este ejercicio" se resuelve **aquí**, no con la
 * función `ultimas_series()` del servidor. El gimnasio es un sótano sin
 * cobertura y esa llamada no llegaría; como la base local es una copia
 * completa del histórico, la misma consulta se responde sin red. La función
 * SQL se queda en las migraciones por si algún día hiciera falta desde fuera.
 */

export type UltimaVez = {
  sesion_id: string
  fecha: string
  series: Serie[]
}

/**
 * Última sesión en la que se tocó cada ejercicio, con sus series.
 *
 * `excluirSesion` deja fuera la sesión en curso: la última vez es la anterior,
 * no lo que se está registrando ahora mismo.
 *
 * Solo cuenta el trabajo efectivo: una sesión en la que un ejercicio solo tuvo
 * calentamiento no fue una sesión de ese ejercicio.
 */
export async function ultimaVez(
  ejercicioIds: string[],
  excluirSesion?: string,
): Promise<Map<string, UltimaVez>> {
  const resultado = new Map<string, UltimaVez>()
  if (!ejercicioIds.length) return resultado

  const series = await db.series.where('ejercicio_id').anyOf(ejercicioIds).toArray()

  // Solo el trabajo efectivo. "Última vez" existe para decidir la carga de hoy,
  // y un calentamiento de aproximación no dice nada de eso; además es de donde
  // sale la propuesta de la siguiente serie, así que colarlo propondría el peso
  // del calentamiento como si fuera una serie de trabajo.
  const relevantes = series.filter((s) => s.sesion_id !== excluirSesion && esEfectiva(s.tipo))
  if (!relevantes.length) return resultado

  const sesiones = await db.sesiones.bulkGet([...new Set(relevantes.map((s) => s.sesion_id))])
  const fechaDe = new Map(sesiones.filter(Boolean).map((s) => [s!.id, s!]))

  const porEjercicio = new Map<string, Serie[]>()
  for (const s of relevantes) {
    if (!fechaDe.has(s.sesion_id)) continue
    const lista = porEjercicio.get(s.ejercicio_id)
    if (lista) lista.push(s)
    else porEjercicio.set(s.ejercicio_id, [s])
  }

  for (const [ejercicioId, lista] of porEjercicio) {
    // La sesión más reciente por fecha; a igualdad de fecha, la creada después.
    let mejor = lista[0].sesion_id
    for (const s of lista) {
      if (esPosterior(fechaDe.get(s.sesion_id)!, fechaDe.get(mejor)!)) mejor = s.sesion_id
    }

    resultado.set(ejercicioId, {
      sesion_id: mejor,
      fecha: fechaDe.get(mejor)!.fecha,
      series: lista
        .filter((s) => s.sesion_id === mejor)
        .sort((a, b) => a.numero - b.numero),
    })
  }

  return resultado
}

function esPosterior(
  a: { fecha: string; created_at?: string },
  b: { fecha: string; created_at?: string },
): boolean {
  if (a.fecha !== b.fecha) return a.fecha > b.fecha
  return (a.created_at ?? '') > (b.created_at ?? '')
}

/** Series de una sesión, ordenadas como se registraron. */
export async function seriesDeSesion(sesionId: string): Promise<Serie[]> {
  return db.series.where('sesion_id').equals(sesionId).sortBy('numero')
}

/**
 * Qué proponer en la siguiente serie de un ejercicio.
 *
 * Manda lo último hecho hoy en ese mismo ejercicio: si la primera serie salió
 * a 82,5 la segunda casi seguro va igual. Si aún no hay nada hoy, se usa la
 * serie del mismo número de la última vez. Así lo normal es confirmar sin
 * teclear.
 */
export function propuestaDeSerie(
  hechasHoy: Serie[],
  anterior: UltimaVez | undefined,
  numero: number,
): { peso_kg: number | null; reps: number | null; rir: number | null } {
  // Igual que en "última vez": el calentamiento no manda. Al empezar una
  // sesión anotando la aproximación, la siguiente fila debe proponer el peso de
  // trabajo de la última vez, no los 46 kg con los que acabas de calentar.
  const ultimaDeHoy = hechasHoy.filter((s) => esEfectiva(s.tipo)).at(-1)
  if (ultimaDeHoy) {
    return {
      peso_kg: ultimaDeHoy.peso_kg,
      reps: ultimaDeHoy.reps,
      rir: ultimaDeHoy.rir,
    }
  }

  const deLaUltimaVez =
    anterior?.series.find((s) => s.numero === numero) ?? anterior?.series[0]

  return {
    peso_kg: deLaUltimaVez?.peso_kg ?? null,
    reps: deLaUltimaVez?.reps ?? null,
    rir: deLaUltimaVez?.rir ?? null,
  }
}

/** Series que cuentan como trabajo efectivo: el calentamiento no suma volumen. */
export function esEfectiva(tipo: TipoSerie): boolean {
  return tipo !== 'calentamiento'
}

/** Volumen de una serie: peso por repeticiones. */
export function volumenDeSerie(s: Serie): number {
  if (!s.peso_kg || !s.reps || !esEfectiva(s.tipo)) return 0
  return s.peso_kg * s.reps
}

/**
 * 1RM estimado por Epley: `peso × (1 + reps / 30)`, tal cual lo define el plan.
 *
 * No se corrige el caso de una sola repetición (donde la fórmula da un 3 % de
 * más) ni se cambia por otra más fina en repeticiones altas: lo que se mira es
 * la evolución de uno mismo, y para eso basta con que la fórmula sea siempre
 * la misma.
 */
export function unoRM(peso: number, reps: number): number {
  return peso * (1 + reps / 30)
}

export const NOMBRE_TIPO_SERIE: Record<TipoSerie, string> = {
  normal: 'Normal',
  calentamiento: 'Calentamiento',
  dropset: 'Dropset',
  fallo: 'Al fallo',
}
