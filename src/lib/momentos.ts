import type { Momento } from './tipos'

/** Momentos del día, en el orden en que se comen. */
export const MOMENTOS: Momento[] = ['desayuno', 'almuerzo', 'snack', 'cena']

export const NOMBRE_MOMENTO: Record<Momento, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  snack: 'Snack',
  cena: 'Cena',
}

export const OPCIONES_MOMENTO = MOMENTOS.map((valor) => ({
  valor,
  etiqueta: NOMBRE_MOMENTO[valor],
}))

/**
 * Qué momento proponer según la hora. Registrar lo de siempre debe ser de dos
 * toques, y acertar el momento por defecto ahorra uno de ellos.
 *
 * La franja de la cena llega hasta las 5 de la mañana: a la una de la noche lo
 * que se está registrando es la cena, no el desayuno del día siguiente.
 */
export function momentoSugerido(ahora: Date = new Date()): Momento {
  const h = ahora.getHours()
  if (h >= 5 && h < 11) return 'desayuno'
  if (h >= 11 && h < 16) return 'almuerzo'
  if (h >= 16 && h < 19) return 'snack'
  return 'cena'
}
