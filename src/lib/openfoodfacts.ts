import type { Alimento } from './tipos'

/**
 * Open Food Facts: la ficha de un producto por su código de barras.
 *
 * Es la única llamada de red que hace la app fuera de Supabase. Es opcional por
 * diseño: si no hay cobertura o el producto no está, siempre queda darlo de
 * alta a mano, y la biblioteca local se consulta **antes** que esta API.
 *
 * No necesita clave. La cortesía de la API pide identificar al cliente, pero un
 * navegador no deja poner `User-Agent`, así que se manda en la propia URL.
 */

const BASE = 'https://world.openfoodfacts.org/api/v2/product'

const CAMPOS = [
  'product_name',
  'product_name_es',
  'brands',
  'nutriments',
  'serving_quantity',
].join(',')

export type FichaEncontrada = Pick<
  Alimento,
  | 'nombre'
  | 'marca'
  | 'codigo_barras'
  | 'kcal_100g'
  | 'proteina_100g'
  | 'grasa_100g'
  | 'carbos_100g'
  | 'fibra_100g'
  | 'azucar_100g'
  | 'sal_100g'
  | 'porcion_defecto_g'
>

export type ResultadoBusqueda =
  | { estado: 'encontrado'; ficha: FichaEncontrada }
  | { estado: 'no_esta' }
  | { estado: 'incompleto'; nombre: string }
  | { estado: 'sin_red' }

/**
 * Busca un código de barras.
 *
 * Distingue cuatro finales porque la interfaz hace algo distinto en cada uno:
 * el producto no está, está pero sin macros (pasa a menudo con marcas
 * pequeñas), no hay red, o está completo.
 */
export async function buscarPorCodigoBarras(
  codigo: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoBusqueda> {
  let respuesta: Response

  try {
    respuesta = await fetchImpl(
      `${BASE}/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}&app_name=gym-pwa`,
      { headers: { Accept: 'application/json' } },
    )
  } catch {
    return { estado: 'sin_red' }
  }

  if (respuesta.status === 404) return { estado: 'no_esta' }
  if (!respuesta.ok) return { estado: 'sin_red' }

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = (await respuesta.json()) as Record<string, unknown>
  } catch {
    return { estado: 'sin_red' }
  }

  // La v2 devuelve 200 con status 0 cuando el producto no existe.
  if (cuerpo.status === 0 || !esObjeto(cuerpo.product)) return { estado: 'no_esta' }

  const producto = cuerpo.product
  const nutrientes = esObjeto(producto.nutriments) ? producto.nutriments : {}

  const nombre =
    texto(producto.product_name_es) || texto(producto.product_name) || ''

  const kcal = kcalPor100(nutrientes)
  const proteina = numero(nutrientes['proteins_100g'])
  const grasa = numero(nutrientes['fat_100g'])
  const carbos = numero(nutrientes['carbohydrates_100g'])

  // Sin nombre o sin los cuatro macros la ficha no sirve para registrar nada:
  // más vale decirlo y ofrecer completarla a mano que guardar ceros.
  if (!nombre || kcal === null || proteina === null || grasa === null || carbos === null) {
    return { estado: 'incompleto', nombre }
  }

  return {
    estado: 'encontrado',
    ficha: {
      nombre,
      marca: texto(producto.brands).split(',')[0].trim() || null,
      codigo_barras: codigo,
      kcal_100g: kcal,
      proteina_100g: proteina,
      grasa_100g: grasa,
      carbos_100g: carbos,
      fibra_100g: numero(nutrientes['fiber_100g']),
      azucar_100g: numero(nutrientes['sugars_100g']),
      sal_100g: numero(nutrientes['salt_100g']),
      porcion_defecto_g: numero(producto.serving_quantity),
    },
  }
}

/**
 * Muchos productos europeos traen la energía solo en kilojulios, porque es lo
 * que exige la etiqueta. Se convierte con el factor oficial.
 */
function kcalPor100(nutrientes: Record<string, unknown>): number | null {
  const kcal = numero(nutrientes['energy-kcal_100g'])
  if (kcal !== null) return kcal

  const kj = numero(nutrientes['energy-kj_100g']) ?? numero(nutrientes['energy_100g'])
  return kj === null ? null : Math.round((kj / 4.184) * 100) / 100
}

function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(',', '.'))
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
