import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolverCodigo } from './codigoBarras'
import { db } from './db'
import { guardarDelServidor } from './datos'
import type { ResultadoBusqueda } from './openfoodfacts'

vi.mock('./senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const CODIGO = '8480000123456'

const busca = (r: ResultadoBusqueda) => vi.fn(async () => r)

const FICHA = {
  nombre: 'Yogur griego natural',
  marca: 'Hacendado',
  codigo_barras: CODIGO,
  kcal_100g: 97,
  proteina_100g: 9,
  grasa_100g: 5,
  carbos_100g: 3.6,
  fibra_100g: 0,
  azucar_100g: 3.6,
  sal_100g: 0.13,
  porcion_defecto_g: 125,
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('resolverCodigo', () => {
  it('la biblioteca propia manda sobre Open Food Facts', async () => {
    // La ficha de casa puede estar corregida a mano, y además así el escáner
    // funciona sin cobertura para lo que se compra siempre.
    await guardarDelServidor('alimentos', [
      { id: 'mio', nombre: 'Mi yogur corregido', codigo_barras: CODIGO, kcal_100g: 100 },
    ])
    const buscar = busca({ estado: 'no_esta' })

    const r = await resolverCodigo(CODIGO, buscar)

    expect(r.estado).toBe('en_biblioteca')
    expect(buscar).not.toHaveBeenCalled()
  })

  it('crea la ficha con lo que devuelve Open Food Facts', async () => {
    const r = await resolverCodigo(CODIGO, busca({ estado: 'encontrado', ficha: FICHA }))

    expect(r.estado).toBe('creado')
    const guardado = await db.alimentos.where('codigo_barras').equals(CODIGO).first()
    expect(guardado).toMatchObject({
      nombre: 'Yogur griego natural',
      kcal_100g: 97,
      origen: 'openfoodfacts',
      veces_usado: 0,
    })
  })

  it('un producto sin macros manda a darlo de alta, con el nombre ya puesto', async () => {
    const r = await resolverCodigo(CODIGO, busca({ estado: 'incompleto', nombre: 'Barrita X' }))

    expect(r).toMatchObject({ estado: 'a_mano', motivo: 'incompleto', nombre: 'Barrita X' })
    // Y no deja una ficha a medias en la biblioteca.
    expect(await db.alimentos.count()).toBe(0)
  })

  it('sin red distingue el motivo, que no es lo mismo que no existir', async () => {
    const r = await resolverCodigo(CODIGO, busca({ estado: 'sin_red' }))
    expect(r).toMatchObject({ estado: 'a_mano', motivo: 'sin_red', codigo: CODIGO })
  })

  it('escanear dos veces el mismo producto no duplica la ficha', async () => {
    // El índice único por (usuario, código) del servidor rechazaría la segunda.
    await resolverCodigo(CODIGO, busca({ estado: 'encontrado', ficha: FICHA }))
    await resolverCodigo(CODIGO, busca({ estado: 'encontrado', ficha: FICHA }))

    expect(await db.alimentos.count()).toBe(1)
  })
})
