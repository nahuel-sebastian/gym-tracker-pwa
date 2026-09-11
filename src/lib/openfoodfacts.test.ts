import { describe, expect, it, vi } from 'vitest'
import { buscarPorCodigoBarras } from './openfoodfacts'

const respuesta = (cuerpo: unknown, status = 200) =>
  vi.fn(async () =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch

const PRODUCTO = {
  status: 1,
  product: {
    product_name: 'Greek Style Yogurt',
    product_name_es: 'Yogur griego natural',
    brands: 'Hacendado, Mercadona',
    serving_quantity: 125,
    nutriments: {
      'energy-kcal_100g': 97,
      proteins_100g: 9,
      fat_100g: 5,
      carbohydrates_100g: 3.6,
      fiber_100g: 0,
      sugars_100g: 3.6,
      salt_100g: 0.13,
    },
  },
}

describe('buscarPorCodigoBarras', () => {
  it('devuelve la ficha lista para guardar', async () => {
    const resultado = await buscarPorCodigoBarras('8480000123456', respuesta(PRODUCTO))

    expect(resultado).toEqual({
      estado: 'encontrado',
      ficha: {
        nombre: 'Yogur griego natural',
        marca: 'Hacendado',
        codigo_barras: '8480000123456',
        kcal_100g: 97,
        proteina_100g: 9,
        grasa_100g: 5,
        carbos_100g: 3.6,
        fibra_100g: 0,
        azucar_100g: 3.6,
        sal_100g: 0.13,
        porcion_defecto_g: 125,
      },
    })
  })

  it('prefiere el nombre en español y se queda con la primera marca', async () => {
    const { ficha } = (await buscarPorCodigoBarras('1', respuesta(PRODUCTO))) as {
      ficha: { nombre: string; marca: string }
    }
    expect(ficha.nombre).toBe('Yogur griego natural')
    expect(ficha.marca).toBe('Hacendado')
  })

  it('convierte los kilojulios cuando no vienen las kcal', async () => {
    // La etiqueta europea obliga a los kJ; muchos productos solo traen eso.
    const soloKj = structuredClone(PRODUCTO)
    delete (soloKj.product.nutriments as Record<string, unknown>)['energy-kcal_100g']
    ;(soloKj.product.nutriments as Record<string, unknown>)['energy-kj_100g'] = 406

    const { ficha } = (await buscarPorCodigoBarras('1', respuesta(soloKj))) as {
      ficha: { kcal_100g: number }
    }
    expect(ficha.kcal_100g).toBeCloseTo(97.04, 2)
  })

  it('un 200 con status 0 es "no está", que es como lo dice esta API', async () => {
    expect(await buscarPorCodigoBarras('1', respuesta({ status: 0 }))).toEqual({
      estado: 'no_esta',
    })
  })

  it('un 404 también', async () => {
    expect(await buscarPorCodigoBarras('1', respuesta({}, 404))).toEqual({ estado: 'no_esta' })
  })

  it('sin macros la ficha no sirve: se pide completarla a mano', async () => {
    // Guardar ceros aquí metería un alimento silenciosamente falso en la
    // biblioteca, y a partir de ahí en todos los registros que lo usen.
    const sinMacros = structuredClone(PRODUCTO)
    sinMacros.product.nutriments = { 'energy-kcal_100g': 97 } as never

    expect(await buscarPorCodigoBarras('1', respuesta(sinMacros))).toEqual({
      estado: 'incompleto',
      nombre: 'Yogur griego natural',
    })
  })

  it('sin conexión lo dice, en vez de parecer que el producto no existe', async () => {
    const rota = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    expect(await buscarPorCodigoBarras('1', rota)).toEqual({ estado: 'sin_red' })
  })

  it('un error del servidor no se confunde con un producto inexistente', async () => {
    expect(await buscarPorCodigoBarras('1', respuesta({}, 503))).toEqual({ estado: 'sin_red' })
  })

  it('acepta los números que vienen como texto', async () => {
    const comoTexto = structuredClone(PRODUCTO)
    comoTexto.product.nutriments.proteins_100g = '9,2' as never

    const { ficha } = (await buscarPorCodigoBarras('1', respuesta(comoTexto))) as {
      ficha: { proteina_100g: number }
    }
    expect(ficha.proteina_100g).toBe(9.2)
  })
})
