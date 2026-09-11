import type { Alimento } from './tipos'

/**
 * Cálculo de macros.
 *
 * Los macros se calculan **una vez, al registrar**, y se guardan congelados en
 * `registros_comida`. No se recalculan al leer: si el usuario corrige la ficha
 * de un alimento, el diario de la semana pasada no puede cambiar. Es una
 * decisión del plan y aquí se respeta guardando siempre el resultado.
 */

export type Macros = {
  kcal: number
  proteina: number
  grasa: number
  carbos: number
}

export const MACROS_CERO: Macros = { kcal: 0, proteina: 0, grasa: 0, carbos: 0 }

/** Kilocalorías por gramo de cada macronutriente. */
export const KCAL_POR_GRAMO = { proteina: 4, grasa: 9, carbos: 4 } as const

/** Las columnas son `numeric(7,2)`: más decimales se perderían al guardar. */
function dosDecimales(n: number): number {
  return Math.round(n * 100) / 100
}

export function redondear(m: Macros): Macros {
  return {
    kcal: dosDecimales(m.kcal),
    proteina: dosDecimales(m.proteina),
    grasa: dosDecimales(m.grasa),
    carbos: dosDecimales(m.carbos),
  }
}

/** Macros de una cantidad en gramos de un alimento, cuya ficha es por 100 g. */
export function macrosDeAlimento(alimento: Alimento, gramos: number): Macros {
  const factor = gramos / 100
  return redondear({
    kcal: alimento.kcal_100g * factor,
    proteina: alimento.proteina_100g * factor,
    grasa: alimento.grasa_100g * factor,
    carbos: alimento.carbos_100g * factor,
  })
}

export function sumarMacros(lista: readonly Macros[]): Macros {
  const total = lista.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteina: acc.proteina + m.proteina,
      grasa: acc.grasa + m.grasa,
      carbos: acc.carbos + m.carbos,
    }),
    MACROS_CERO,
  )
  return redondear(total)
}

export function escalarMacros(m: Macros, factor: number): Macros {
  return redondear({
    kcal: m.kcal * factor,
    proteina: m.proteina * factor,
    grasa: m.grasa * factor,
    carbos: m.carbos * factor,
  })
}

/**
 * Kilocalorías que se deducen de los macros (4/9/4).
 *
 * Sirve para avisar de una ficha incoherente al darla de alta a mano: teclear
 * las kcal de la etiqueta y equivocarse en un macro es el error típico, y
 * arrastra todo el diario a partir de ese momento.
 */
export function kcalDeMacros(m: Omit<Macros, 'kcal'>): number {
  return dosDecimales(
    m.proteina * KCAL_POR_GRAMO.proteina +
      m.grasa * KCAL_POR_GRAMO.grasa +
      m.carbos * KCAL_POR_GRAMO.carbos,
  )
}

/**
 * Cuánto se desvían las kcal declaradas de las que dicen los macros, en tanto
 * por uno. Por encima de 0,1 conviene revisar la ficha; la fibra y los
 * polialcoholes justifican desvíos pequeños, no uno del 40 %.
 */
export function desvioKcal(m: Macros): number {
  const teoricas = kcalDeMacros(m)
  if (teoricas === 0 && m.kcal === 0) return 0
  if (teoricas === 0) return 1
  return Math.abs(m.kcal - teoricas) / teoricas
}

/** Porcentaje consumido sobre el objetivo, sin tope: pasarse se tiene que ver. */
export function porcentaje(consumido: number, objetivo: number): number {
  if (!objetivo) return 0
  return (consumido / objetivo) * 100
}
