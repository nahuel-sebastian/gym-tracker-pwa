/**
 * Números que entran y salen de la interfaz.
 *
 * El teclado decimal de un iPhone en español da **coma**, no punto, así que
 * todo lo que se teclee pasa por `aNumero`. Sin eso, escribir "82,5" en el peso
 * de una serie daría `NaN` y la serie se guardaría sin peso.
 */

/** Convierte lo teclado en número, o `null` si no hay nada usable. */
export function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** Como `aNumero`, pero rechaza lo que no sea positivo. */
export function aNumeroPositivo(texto: string): number | null {
  const n = aNumero(texto)
  return n !== null && n > 0 ? n : null
}

/**
 * Redondea y escribe con coma, sin ceros de relleno: "82", "82,5", "78,4".
 *
 * `decimales` es el máximo, no el fijo: un peso de 78,4 kg no se enseña como
 * "78,40" por pedir dos decimales.
 */
export function formatoNumero(n: number, decimales = 1): string {
  const factor = 10 ** decimales
  return String(Math.round(n * factor) / factor).replace('.', ',')
}

/** Las kcal se enseñan enteras: el decimal es ruido. */
export function formatoKcal(n: number): string {
  return String(Math.round(n))
}

export function formatoGramos(n: number): string {
  return `${formatoNumero(n)} g`
}

/** Para rellenar un input a partir de un valor guardado. */
export function aTexto(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : formatoNumero(n, 2)
}
