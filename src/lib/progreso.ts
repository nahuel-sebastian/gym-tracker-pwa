import { fechaLocal, aDate, diasEntre, sumarDias } from './fechas'
import { esEfectiva, unoRM, volumenDeSerie } from './entreno'
import type {
  Ejercicio,
  GrupoMuscular,
  MedidaCorporal,
  RegistroComida,
  Serie,
  Sesion,
  TipoDia,
} from './tipos'

/**
 * Cálculos de las gráficas de Progreso. Todo es una función pura sobre filas
 * ya leídas de IndexedDB: no toca la base ni la red, y se puede probar sola.
 */

// -----------------------------------------------------------------------------
// Peso corporal
// -----------------------------------------------------------------------------

export type PuntoPeso = {
  fecha: string
  peso: number | null
  /** Media móvil de 7 días. `null` mientras no haya con qué calcularla. */
  media: number | null
}

const VENTANA_MEDIA = 7

/**
 * Serie de peso con su media móvil de 7 días.
 *
 * La media es **por días de calendario**, no por las últimas siete medidas: si
 * se salta tres días, la media de hoy sigue siendo la de la última semana y no
 * se cuela un dato de hace un mes. El peso diario fluctúa por agua y glucógeno
 * y el número crudo es ruido; la media es la señal, y por eso va delante.
 *
 * Devuelve un punto por **cada día** del rango, también los días sin pesaje,
 * para que el eje de tiempo no se comprima donde faltan datos.
 */
export function serieDePeso(medidas: MedidaCorporal[]): PuntoPeso[] {
  const conPeso = medidas
    .filter((m) => m.peso_kg !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (!conPeso.length) return []

  const porFecha = new Map(conPeso.map((m) => [m.fecha, m.peso_kg as number]))
  const primera = conPeso[0].fecha
  const ultima = conPeso[conPeso.length - 1].fecha
  const total = diasEntre(primera, ultima)

  const puntos: PuntoPeso[] = []

  for (let i = 0; i <= total; i++) {
    const fecha = sumarDias(primera, i)
    const ventana: number[] = []

    for (let atras = 0; atras < VENTANA_MEDIA; atras++) {
      const peso = porFecha.get(sumarDias(fecha, -atras))
      if (peso !== undefined) ventana.push(peso)
    }

    puntos.push({
      fecha,
      peso: porFecha.get(fecha) ?? null,
      media: ventana.length
        ? redondear(ventana.reduce((a, b) => a + b, 0) / ventana.length, 2)
        : null,
    })
  }

  return puntos
}

/** Cuánto ha cambiado la media en los últimos `dias` días. */
export function tendenciaPeso(puntos: PuntoPeso[], dias = 28): number | null {
  const conMedia = puntos.filter((p) => p.media !== null)
  if (conMedia.length < 2) return null

  const ultimo = conMedia[conMedia.length - 1]
  const objetivo = sumarDias(ultimo.fecha, -dias)
  // El punto más antiguo que no sea anterior al objetivo; si no hay tanto
  // histórico, se compara con el primero que haya.
  const referencia = conMedia.find((p) => p.fecha >= objetivo) ?? conMedia[0]
  if (referencia === ultimo) return null

  return redondear(ultimo.media! - referencia.media!, 2)
}

export type Proyeccion = {
  /** Kilos por semana de la tendencia. Negativo si baja. */
  ritmo: number
  /** Semanas para llegar al objetivo al ritmo actual. */
  semanas: number
  /** `true` si el ritmo lleva al lado contrario del objetivo. */
  alReves: boolean
}

/**
 * Cuánto falta para el peso objetivo al ritmo de las últimas semanas.
 *
 * El ritmo sale de la media móvil, no de dos pesajes sueltos: con el dato
 * diario, un día de más sal daría una proyección absurda. Devuelve `null`
 * cuando no hay con qué proyectar —sin objetivo, sin tendencia, o ya en el
 * objetivo—, porque una cifra inventada aquí es peor que ninguna.
 */
export function proyeccionDePeso(
  puntos: PuntoPeso[],
  objetivo: number | null | undefined,
  dias = 28,
): Proyeccion | null {
  if (!objetivo) return null

  const cambio = tendenciaPeso(puntos, dias)
  if (cambio === null || cambio === 0) return null

  const actual = [...puntos].reverse().find((p) => p.media !== null)?.media
  if (actual === undefined || actual === null) return null

  const restante = objetivo - actual
  // Medio kilo de margen: por debajo de eso, decir "te faltan 3 semanas" es
  // ruido de la báscula.
  if (Math.abs(restante) < 0.5) return null

  const ritmo = redondear((cambio / dias) * 7, 3)
  const alReves = Math.sign(ritmo) !== Math.sign(restante)

  return {
    ritmo,
    semanas: alReves ? Infinity : Math.ceil(Math.abs(restante / ritmo)),
    alReves,
  }
}

// -----------------------------------------------------------------------------
// Progresión por ejercicio
// -----------------------------------------------------------------------------

export type Metrica = 'peso' | 'volumen' | 'unorm'

export const NOMBRE_METRICA: Record<Metrica, string> = {
  peso: 'Peso máximo',
  volumen: 'Volumen total',
  unorm: '1RM estimado',
}

export const UNIDAD_METRICA: Record<Metrica, string> = {
  peso: 'kg',
  volumen: 'kg',
  unorm: 'kg',
}

export type PuntoEjercicio = {
  fecha: string
  valor: number
  series: number
}

/**
 * Una sesión, un punto. El calentamiento no cuenta en ninguna de las tres
 * métricas: infla el volumen y no dice nada de la progresión.
 */
export function progresionEjercicio(
  series: Serie[],
  sesiones: Sesion[],
  ejercicioId: string,
  metrica: Metrica,
): PuntoEjercicio[] {
  const fechaDe = new Map(sesiones.map((s) => [s.id, s.fecha]))

  const porSesion = new Map<string, Serie[]>()
  for (const s of series) {
    if (s.ejercicio_id !== ejercicioId) continue
    if (!esEfectiva(s.tipo)) continue
    if (!fechaDe.has(s.sesion_id)) continue
    const lista = porSesion.get(s.sesion_id)
    if (lista) lista.push(s)
    else porSesion.set(s.sesion_id, [s])
  }

  const puntos: PuntoEjercicio[] = []

  for (const [sesionId, lista] of porSesion) {
    const valor = valorDeSesion(lista, metrica)
    if (valor === null) continue
    puntos.push({ fecha: fechaDe.get(sesionId)!, valor, series: lista.length })
  }

  return puntos.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function valorDeSesion(series: Serie[], metrica: Metrica): number | null {
  if (metrica === 'volumen') {
    const total = series.reduce((acc, s) => acc + volumenDeSerie(s), 0)
    return total > 0 ? redondear(total, 1) : null
  }

  const valores = series
    .filter((s) => s.peso_kg !== null && s.reps !== null)
    .map((s) =>
      metrica === 'peso' ? (s.peso_kg as number) : unoRM(s.peso_kg as number, s.reps as number),
    )

  return valores.length ? redondear(Math.max(...valores), 1) : null
}

// -----------------------------------------------------------------------------
// Semanas
// -----------------------------------------------------------------------------

/** Lunes de la semana de esa fecha. La semana empieza en lunes, como aquí. */
export function inicioDeSemana(fecha: string): string {
  const d = aDate(fecha)
  const diaSemana = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - diaSemana)
  return fechaLocal(d)
}

export type SemanaNutricion = {
  semana: string
  /** Días con algún registro, por tipo. Sin esto la media saldría falseada. */
  dias: number
  kcal: number
  proteina: number
  grasa: number
  carbos: number
}

/**
 * Medias por semana y tipo de día.
 *
 * Se divide por **días con registro**, no por siete: una semana en la que se
 * apuntaron cuatro días daría una media un 40 % más baja de la real. Y los días
 * sin marcar cuentan como descanso, igual que en el resto de la app.
 */
export function mediasSemanales(
  registros: RegistroComida[],
  tipoPorFecha: Map<string, TipoDia>,
): Record<TipoDia, SemanaNutricion[]> {
  const acumulado = new Map<
    string,
    { dias: Set<string>; kcal: number; proteina: number; grasa: number; carbos: number }
  >()

  for (const r of registros) {
    const tipo = tipoPorFecha.get(r.fecha) ?? 'descanso'
    const clave = `${tipo}|${inicioDeSemana(r.fecha)}`

    let fila = acumulado.get(clave)
    if (!fila) {
      fila = { dias: new Set(), kcal: 0, proteina: 0, grasa: 0, carbos: 0 }
      acumulado.set(clave, fila)
    }

    fila.dias.add(r.fecha)
    fila.kcal += r.kcal
    fila.proteina += r.proteina
    fila.grasa += r.grasa
    fila.carbos += r.carbos
  }

  const salida: Record<TipoDia, SemanaNutricion[]> = { entreno: [], descanso: [] }

  for (const [clave, fila] of acumulado) {
    const [tipo, semana] = clave.split('|') as [TipoDia, string]
    const dias = fila.dias.size
    salida[tipo].push({
      semana,
      dias,
      kcal: redondear(fila.kcal / dias, 0),
      proteina: redondear(fila.proteina / dias, 1),
      grasa: redondear(fila.grasa / dias, 1),
      carbos: redondear(fila.carbos / dias, 1),
    })
  }

  for (const tipo of ['entreno', 'descanso'] as const) {
    salida[tipo].sort((a, b) => a.semana.localeCompare(b.semana))
  }

  return salida
}

// -----------------------------------------------------------------------------
// Volumen por grupo muscular
// -----------------------------------------------------------------------------

export type VolumenGrupo = {
  grupo: GrupoMuscular | 'sin grupo'
  series: number
}

/**
 * Series efectivas por grupo muscular en un rango de fechas.
 *
 * Se cuentan **series**, no kilos: es la medida con la que se programa el
 * volumen semanal, y permite comparar un press de banca con un curl. El
 * calentamiento no cuenta.
 */
export function volumenPorGrupo(
  series: Serie[],
  sesiones: Sesion[],
  ejercicios: Map<string, Ejercicio>,
  desde: string,
  hasta: string,
): VolumenGrupo[] {
  const enRango = new Set(
    sesiones.filter((s) => s.fecha >= desde && s.fecha <= hasta).map((s) => s.id),
  )

  const cuenta = new Map<string, number>()

  for (const s of series) {
    if (!enRango.has(s.sesion_id) || !esEfectiva(s.tipo)) continue
    const grupo = ejercicios.get(s.ejercicio_id)?.grupo_muscular ?? 'sin grupo'
    cuenta.set(grupo, (cuenta.get(grupo) ?? 0) + 1)
  }

  return [...cuenta.entries()]
    .map(([grupo, series]) => ({ grupo: grupo as VolumenGrupo['grupo'], series }))
    .sort((a, b) => b.series - a.series)
}

/**
 * Series efectivas por grupo y por semana.
 *
 * El total del periodo dice cuánto; esto dice **cómo ha ido cambiando**, que es
 * con lo que se decide subir o bajar el volumen de un grupo. Se rellenan las
 * semanas sin nada a cero: un hueco en el eje mentiría sobre la continuidad.
 */
export function volumenSemanalPorGrupo(
  series: Serie[],
  sesiones: Sesion[],
  ejercicios: Map<string, Ejercicio>,
  desde: string,
  hasta: string,
): { semanas: string[]; porGrupo: { grupo: string; series: number[] }[] } {
  const semanaDe = new Map<string, string>()
  for (const s of sesiones) {
    if (s.fecha >= desde && s.fecha <= hasta) semanaDe.set(s.id, inicioDeSemana(s.fecha))
  }

  if (!semanaDe.size) return { semanas: [], porGrupo: [] }

  const semanas: string[] = []
  const primera = [...semanaDe.values()].sort()[0]
  const ultima = inicioDeSemana(hasta)
  for (let f = primera; f <= ultima; f = sumarDias(f, 7)) semanas.push(f)

  const indice = new Map(semanas.map((f, i) => [f, i]))
  const cuenta = new Map<string, number[]>()

  for (const s of series) {
    const semana = semanaDe.get(s.sesion_id)
    if (semana === undefined || !esEfectiva(s.tipo)) continue

    const grupo = ejercicios.get(s.ejercicio_id)?.grupo_muscular ?? 'sin grupo'
    let fila = cuenta.get(grupo)
    if (!fila) {
      fila = new Array(semanas.length).fill(0)
      cuenta.set(grupo, fila)
    }
    fila[indice.get(semana)!] += 1
  }

  const porGrupo = [...cuenta.entries()]
    .map(([grupo, series]) => ({ grupo, series }))
    .sort((a, b) => sumar(b.series) - sumar(a.series))

  return { semanas, porGrupo }
}

function sumar(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}

function redondear(n: number, decimales: number): number {
  const factor = 10 ** decimales
  return Math.round(n * factor) / factor
}
