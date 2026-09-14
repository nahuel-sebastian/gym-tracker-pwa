import { describe, expect, it } from 'vitest'
import { interpretarFichas } from './fichasImportadas'

describe('interpretarFichas', () => {
  it('lee fichas por 100 g', () => {
    const json = {
      tipo: 'alimentos',
      alimentos: [
        { nombre: 'Tortilla de patatas casera', kcal_100g: 168, proteina_100g: 6.1, grasa_100g: 11.2, carbos_100g: 10.4, porcion_defecto_g: 200 },
      ],
    }

    expect(interpretarFichas(json)).toEqual([
      {
        nombre: 'Tortilla de patatas casera',
        marca: null,
        codigo_barras: null,
        kcal_100g: 168,
        proteina_100g: 6.1,
        grasa_100g: 11.2,
        carbos_100g: 10.4,
        porcion_defecto_g: 200,
      },
    ])
  })

  it('admite los nombres de campo sin el sufijo _100g', () => {
    const json = [{ nombre: 'Salsa', kcal: 90, proteina: 1, grasa: 8, carbos: 3 }]
    expect(interpretarFichas(json)[0]).toMatchObject({ kcal_100g: 90, grasa_100g: 8 })
  })

  it('un macro que falta falla, nombrando la ficha y el campo', () => {
    const json = [{ nombre: 'Salsa', kcal_100g: 90, proteina_100g: 1, carbos_100g: 3 }]
    expect(() => interpretarFichas(json)).toThrow(/A «Salsa» le falta grasa por 100 g/)
  })

  it('una ficha a ceros sería un alimento falso: los negativos también fallan', () => {
    const json = [{ nombre: 'Salsa', kcal_100g: 90, proteina_100g: -1, grasa_100g: 8, carbos_100g: 3 }]
    expect(() => interpretarFichas(json)).toThrow(/en negativo/)
  })

  it('sin nombre falla, diciendo cuál', () => {
    expect(() => interpretarFichas([{ kcal_100g: 90 }])).toThrow(/ficha 1 le falta el nombre/)
  })

  it('una lista vacía no es una importación', () => {
    expect(() => interpretarFichas([])).toThrow(/ninguna ficha/)
    expect(() => interpretarFichas({ alimentos: [] })).toThrow(/ninguna ficha/)
  })
})
