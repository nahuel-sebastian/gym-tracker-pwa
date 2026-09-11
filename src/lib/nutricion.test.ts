import { describe, expect, it } from 'vitest'
import {
  desvioKcal,
  escalarMacros,
  kcalDeMacros,
  macrosDeAlimento,
  porcentaje,
  sumarMacros,
} from './nutricion'
import type { Alimento } from './tipos'

const pollo: Alimento = {
  id: 'a',
  nombre: 'Pechuga de pollo',
  marca: null,
  codigo_barras: null,
  kcal_100g: 165,
  proteina_100g: 31,
  grasa_100g: 3.6,
  carbos_100g: 0,
  fibra_100g: null,
  azucar_100g: null,
  sal_100g: null,
  porcion_defecto_g: 150,
  origen: 'manual',
  favorito: false,
  veces_usado: 0,
}

describe('macrosDeAlimento', () => {
  it('escala la ficha de 100 g a los gramos pesados', () => {
    expect(macrosDeAlimento(pollo, 180)).toEqual({
      kcal: 297,
      proteina: 55.8,
      grasa: 6.48,
      carbos: 0,
    })
  })

  it('redondea a dos decimales, que es lo que guarda la columna', () => {
    // numeric(7,2): más decimales se perderían al guardar, y el total de la
    // pantalla dejaría de cuadrar con la suma de lo guardado.
    const m = macrosDeAlimento(pollo, 137)
    expect(m.grasa).toBe(4.93)
    expect(String(m.proteina)).toMatch(/^\d+(\.\d{1,2})?$/)
  })

  it('con 0 g devuelve todo a cero', () => {
    expect(macrosDeAlimento(pollo, 0)).toEqual({ kcal: 0, proteina: 0, grasa: 0, carbos: 0 })
  })
})

describe('sumarMacros', () => {
  it('suma el día entero', () => {
    expect(
      sumarMacros([
        { kcal: 297, proteina: 55.8, grasa: 6.48, carbos: 0 },
        { kcal: 130, proteina: 2.7, grasa: 0.3, carbos: 28 },
      ]),
    ).toEqual({ kcal: 427, proteina: 58.5, grasa: 6.78, carbos: 28 })
  })

  it('una lista vacía son cero kcal, no NaN', () => {
    expect(sumarMacros([])).toEqual({ kcal: 0, proteina: 0, grasa: 0, carbos: 0 })
  })

  it('no acumula error de coma flotante', () => {
    const decima = { kcal: 0.1, proteina: 0.1, grasa: 0.1, carbos: 0.1 }
    expect(sumarMacros(Array.from({ length: 10 }, () => decima))).toEqual({
      kcal: 1, proteina: 1, grasa: 1, carbos: 1,
    })
  })
})

describe('escalarMacros', () => {
  it('reparte una receta entre sus porciones', () => {
    expect(escalarMacros({ kcal: 900, proteina: 60, grasa: 30, carbos: 90 }, 1 / 3)).toEqual({
      kcal: 300, proteina: 20, grasa: 10, carbos: 30,
    })
  })
})

describe('coherencia de una ficha', () => {
  it('deduce las kcal de los macros con 4/9/4', () => {
    expect(kcalDeMacros({ proteina: 31, grasa: 3.6, carbos: 0 })).toBe(156.4)
  })

  it('no se queja de un desvío pequeño', () => {
    // La fibra y los polialcoholes justifican unas pocas kcal de diferencia.
    expect(desvioKcal({ kcal: 165, proteina: 31, grasa: 3.6, carbos: 0 })).toBeLessThan(0.1)
  })

  it('detecta el macro mal teclado', () => {
    // Un 3,6 de grasa escrito como 36: la etiqueta seguiría diciendo 165 kcal.
    expect(desvioKcal({ kcal: 165, proteina: 31, grasa: 36, carbos: 0 })).toBeGreaterThan(0.5)
  })

  it('un alimento sin nada no es incoherente', () => {
    expect(desvioKcal({ kcal: 0, proteina: 0, grasa: 0, carbos: 0 })).toBe(0)
  })
})

describe('porcentaje', () => {
  it('pasarse del objetivo da más de 100, no se recorta', () => {
    expect(porcentaje(2600, 2400)).toBeCloseTo(108.33, 2)
  })

  it('sin objetivo no divide por cero', () => {
    expect(porcentaje(2600, 0)).toBe(0)
  })
})
