import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { guardarDelServidor } from './datos'
import { hoy } from './fechas'
import {
  gramosDeReceta,
  macrosDePorcion,
  macrosDeReceta,
  registrarReceta,
  type IngredienteConFicha,
} from './recetas'
import type { Alimento, Receta } from './tipos'

vi.mock('./senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const ficha = (id: string, kcal: number, p: number, g: number, c: number): Alimento => ({
  id,
  nombre: id,
  marca: null,
  codigo_barras: null,
  kcal_100g: kcal,
  proteina_100g: p,
  grasa_100g: g,
  carbos_100g: c,
  fibra_100g: null,
  azucar_100g: null,
  sal_100g: null,
  porcion_defecto_g: null,
  origen: 'manual',
  favorito: false,
  veces_usado: 0,
})

const POLLO = ficha('pollo', 165, 31, 3.6, 0)
const ARROZ = ficha('arroz', 130, 2.7, 0.3, 28)

const ingredientes: IngredienteConFicha[] = [
  { ingrediente: { id: 'i1', receta_id: 'r', alimento_id: 'pollo', gramos: 600 }, alimento: POLLO },
  { ingrediente: { id: 'i2', receta_id: 'r', alimento_id: 'arroz', gramos: 900 }, alimento: ARROZ },
]

describe('macros de una receta', () => {
  it('suma los ingredientes', () => {
    expect(macrosDeReceta(ingredientes)).toEqual({
      kcal: 2160,
      proteina: 210.3,
      grasa: 24.3,
      carbos: 252,
    })
  })

  it('reparte entre porciones', () => {
    expect(macrosDePorcion(ingredientes, 3)).toEqual({
      kcal: 720,
      proteina: 70.1,
      grasa: 8.1,
      carbos: 84,
    })
  })

  it('un ingrediente cuyo alimento ya no existe no rompe la cuenta', () => {
    const huerfano = [...ingredientes, {
      ingrediente: { id: 'i3', receta_id: 'r', alimento_id: 'fantasma', gramos: 100 },
      alimento: undefined,
    }]
    expect(macrosDeReceta(huerfano).kcal).toBe(2160)
  })

  it('suma los gramos para poder decir cuánto pesa una porción', () => {
    expect(gramosDeReceta(ingredientes)).toBe(1500)
  })

  it('cero porciones no divide por cero', () => {
    expect(macrosDePorcion(ingredientes, 0).kcal).toBe(2160)
  })
})

describe('registrarReceta', () => {
  const receta: Receta = { id: 'r', nombre: 'Pollo con arroz', porciones: 3, notas: null }

  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await guardarDelServidor('alimentos', [POLLO, ARROZ])
    await guardarDelServidor('recetas', [receta])
    await guardarDelServidor(
      'receta_ingredientes',
      ingredientes.map((i) => i.ingrediente),
    )
  })

  it('registra una porción con los macros congelados', async () => {
    await registrarReceta(hoy(), 'almuerzo', receta)

    const registro = (await db.registros_comida.toArray())[0]
    expect(registro).toMatchObject({
      receta_id: 'r',
      alimento_id: null,
      descripcion: 'Pollo con arroz',
      kcal: 720,
      gramos: 500,
      momento: 'almuerzo',
    })
  })

  it('cambiar la receta después no reescribe lo ya registrado', async () => {
    await registrarReceta(hoy(), 'almuerzo', receta)
    // Se dobla el arroz de la receta.
    await guardarDelServidor('receta_ingredientes', [
      { id: 'i2', receta_id: 'r', alimento_id: 'arroz', gramos: 1800 },
    ])

    expect((await db.registros_comida.toArray())[0].kcal).toBe(720)
  })

  it('dos porciones escalan y lo dicen en la descripción', async () => {
    await registrarReceta(hoy(), 'cena', receta, 2)

    expect((await db.registros_comida.toArray())[0]).toMatchObject({
      kcal: 1440,
      gramos: 1000,
      descripcion: 'Pollo con arroz (2 porciones)',
    })
  })
})
