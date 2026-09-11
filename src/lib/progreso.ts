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

function redondear(n: number, decimales: number): number {
  const factor = 10 ** decimales
  return Math.round(n * factor) / factor
}
