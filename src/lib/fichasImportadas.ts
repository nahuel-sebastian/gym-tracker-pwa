import { ErrorDeSobre } from './sobre'
import type { Alimento } from './tipos'

/**
 * Fichas de biblioteca que llegan en JSON: valores **por 100 g**, no de una
 * ración.
 *
 * Sirve para lo casero, que no tiene código de barras —una tortilla de patatas
 * no está en Open Food Facts— y para pasar fichas de una cuenta a otra.
 *
 * Estricto con los cuatro macros, igual que el resto: una ficha a ceros sería
 * un alimento silenciosamente falso en la biblioteca y en cada registro que la
 * use después.
 */

export type FichaImportada = Pick<
  Alimento,
  | 'nombre'
  | 'marca'
  | 'codigo_barras'
  | 'kcal_100g'
  | 'proteina_100g'
  | 'grasa_100g'
  | 'carbos_100g'
  | 'porcion_defecto_g'
>

export function interpretarFichas(bruto: unknown): FichaImportada[] {
  const lista = Array.isArray(bruto)
    ? bruto
    : esObjeto(bruto) && Array.isArray(bruto.alimentos)
      ? bruto.alimentos
      : null

  if (!lista) throw new ErrorDeSobre('Falta la lista "alimentos".')
  if (!lista.length) throw new ErrorDeSobre('El JSON no trae ninguna ficha.')

  return lista.map(unaFicha)
}

function unaFicha(bruto: unknown, i: number): FichaImportada {
  if (!esObjeto(bruto)) throw new ErrorDeSobre(`La ficha ${i + 1} no es un objeto.`)

  const nombre = texto(bruto.nombre)
  if (!nombre) throw new ErrorDeSobre(`A la ficha ${i + 1} le falta el nombre.`)

  return {
    nombre,
    marca: texto(bruto.marca) || null,
    codigo_barras: texto(bruto.codigo_barras) || null,
    kcal_100g: obligatorio(bruto, ['kcal_100g', 'kcal100', 'kcal'], nombre, 'kcal'),
    proteina_100g: obligatorio(bruto, ['proteina_100g', 'proteina'], nombre, 'proteína'),
    grasa_100g: obligatorio(bruto, ['grasa_100g', 'grasa'], nombre, 'grasa'),
    carbos_100g: obligatorio(bruto, ['carbos_100g', 'carbos'], nombre, 'carbohidratos'),
    porcion_defecto_g: numero(bruto.porcion_defecto_g ?? bruto.porcion),
  }
}

/** Se admite el sufijo `_100g` y sin él: los prompts lo escriben de las dos formas. */
function obligatorio(
  bruto: Record<string, unknown>,
  claves: string[],
  nombre: string,
  campo: string,
): number {
  for (const clave of claves) {
    const n = numero(bruto[clave])
    if (n !== null) {
      if (n < 0) throw new ErrorDeSobre(`«${nombre}» tiene ${campo} en negativo.`)
      return n
    }
  }
  throw new ErrorDeSobre(`A «${nombre}» le falta ${campo} por 100 g.`)
}

function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim().replace(',', '.').replace(/\s*(g|kcal)$/i, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// -----------------------------------------------------------------------------
// Instrucciones para el Proyecto de Claude
// -----------------------------------------------------------------------------

/**
 * Lo que hay que repetir tres veces en el prompt es **por 100 g**: es lo único
 * que separa una ficha de biblioteca de una comida, y equivocarse ahí no da
 * error, da una ficha mal que contamina cada registro que la use.
 */
export const INSTRUCCIONES_FICHAS = `Cuando te pida fichas de alimentos para mi biblioteca, respóndeme SOLO con un bloque JSON con este formato exacto, sin texto alrededor:

{
  "tipo": "alimentos",
  "alimentos": [
    {
      "nombre": "Tortilla de patatas casera",
      "marca": null,
      "kcal_100g": 168,
      "proteina_100g": 5.1,
      "grasa_100g": 11.4,
      "carbos_100g": 11.2,
      "porcion_defecto_g": 150
    }
  ]
}

Reglas:
- "tipo" va siempre, y siempre vale "alimentos".
- Los macros son SIEMPRE por 100 g de producto, nunca de una ración. Es lo que
  distingue esto de una comida: aquí no existe "lo que me he comido".
- "kcal_100g", "proteina_100g", "grasa_100g" y "carbos_100g" son obligatorios
  los cuatro. Números, con punto decimal.
- "porcion_defecto_g" es la ración típica en gramos, si la sabes. Opcional.
- "marca" solo si es un producto de marca; si es casero, null.
- Si te doy una etiqueta con los valores por ración, conviértelos a 100 g.
- Nada de texto fuera del JSON.`
