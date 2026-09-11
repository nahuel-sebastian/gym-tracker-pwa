/**
 * Fechas de día en hora local.
 *
 * Regla dura de este proyecto: una fecha de día es siempre el texto
 * `YYYY-MM-DD` calculado con los métodos locales del navegador. `toISOString()`
 * convierte a UTC y en España convertiría una cena de las 22:00 en un registro
 * del día siguiente. No se usa nunca para fechas de día.
 *
 * El texto ordena igual que la fecha, así que sirve tal cual como clave de
 * índice en IndexedDB y como valor de una columna `date` de Postgres.
 */

export function fechaLocal(d: Date = new Date()): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function hoy(): string {
  return fechaLocal()
}

/** Convierte `YYYY-MM-DD` en un Date a medianoche local. */
export function aDate(fecha: string): Date {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function sumarDias(fecha: string, dias: number): string {
  const d = aDate(fecha)
  d.setDate(d.getDate() + dias)
  return fechaLocal(d)
}

/** Días de distancia entre dos fechas (positivo si `b` es posterior). */
export function diasEntre(a: string, b: string): number {
  const msPorDia = 86_400_000
  return Math.round((aDate(b).getTime() - aDate(a).getTime()) / msPorDia)
}

const NOMBRES_MES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** "11 sep" — y con el año si no es el actual. */
export function formatoCorto(fecha: string): string {
  const d = aDate(fecha)
  const mes = NOMBRES_MES[d.getMonth()]
  const anio = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${mes}${anio}`
}

/** "Hoy", "Ayer" o la fecha corta. */
export function formatoRelativo(fecha: string): string {
  const d = diasEntre(fecha, hoy())
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Ayer'
  if (d === -1) return 'Mañana'
  return formatoCorto(fecha)
}

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** "jueves, 11 sep" */
export function formatoLargo(fecha: string): string {
  return `${NOMBRES_DIA[aDate(fecha).getDay()]}, ${formatoCorto(fecha)}`
}
