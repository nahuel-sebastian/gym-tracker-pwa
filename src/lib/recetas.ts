import { borrar, guardar } from './datos'
import { db } from './db'
import { escalarMacros, macrosDeAlimento, sumarMacros, type Macros } from './nutricion'
import type { Alimento, Momento, Receta, RecetaIngrediente } from './tipos'

/**
 * Recetas: una comida que se repite, guardada una vez y registrable de un toque.
 *
 * Los macros de una receta **sí** se recalculan al mirarla, porque una receta es
 * una definición viva: cambiar un ingrediente tiene que cambiar lo que dice. Lo
 * que no se recalcula nunca es el registro que sale de ella, que se congela al
 * guardarlo como cualquier otro.
 */

export type IngredienteConFicha = {
  ingrediente: RecetaIngrediente
  alimento: Alimento | undefined
}

/** Macros de la receta entera, sumando sus ingredientes. */
export function macrosDeReceta(ingredientes: IngredienteConFicha[]): Macros {
  return sumarMacros(
    ingredientes
      .filter((i) => i.alimento)
      .map((i) => macrosDeAlimento(i.alimento!, i.ingrediente.gramos)),
  )
}

/** Macros de una porción. Las porciones nunca son cero: la tabla lo impide. */
export function macrosDePorcion(
  ingredientes: IngredienteConFicha[],
  porciones: number,
): Macros {
  return escalarMacros(macrosDeReceta(ingredientes), 1 / Math.max(porciones, 1))
}

/** Gramos totales de la receta, para poder decir cuánto pesa una porción. */
export function gramosDeReceta(ingredientes: IngredienteConFicha[]): number {
  return Math.round(ingredientes.reduce((total, i) => total + i.ingrediente.gramos, 0))
}

export async function crearReceta(nombre: string, porciones = 1): Promise<string> {
  return guardar('recetas', { nombre, porciones, notas: null })
}

export async function anadirIngrediente(
  receta_id: string,
  alimento_id: string,
  gramos: number,
): Promise<string> {
  return guardar('receta_ingredientes', { receta_id, alimento_id, gramos })
}

export async function quitarIngrediente(id: string): Promise<void> {
  await borrar('receta_ingredientes', id)
}

export async function borrarReceta(id: string): Promise<void> {
  await borrar('recetas', id)
}

/**
 * Registra porciones de una receta.
 *
 * Los macros se congelan a partir de las fichas de **hoy**: si mañana se cambia
 * un ingrediente, lo comido ayer sigue diciendo lo que decía. El nombre también
 * se copia en la descripción, para que el registro siga siendo legible si la
 * receta desaparece.
 */
export async function registrarReceta(
  fecha: string,
  momento: Momento,
  receta: Receta,
  porciones = 1,
): Promise<string> {
  const ingredientes = await ingredientesDe(receta.id)
  const macros = escalarMacros(macrosDeReceta(ingredientes), porciones / Math.max(receta.porciones, 1))
  const gramos = Math.round((gramosDeReceta(ingredientes) * porciones) / Math.max(receta.porciones, 1))

  return guardar('registros_comida', {
    fecha,
    momento,
    alimento_id: null,
    receta_id: receta.id,
    descripcion:
      porciones === 1 ? receta.nombre : `${receta.nombre} (${porciones} porciones)`,
    gramos: gramos || null,
    ...macros,
  })
}

export async function ingredientesDe(recetaId: string): Promise<IngredienteConFicha[]> {
  const ingredientes = await db.receta_ingredientes.where('receta_id').equals(recetaId).toArray()
  const alimentos = await db.alimentos.bulkGet(ingredientes.map((i) => i.alimento_id))

  return ingredientes.map((ingrediente, i) => ({ ingrediente, alimento: alimentos[i] }))
}
