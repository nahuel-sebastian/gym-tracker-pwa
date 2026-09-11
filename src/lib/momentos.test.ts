import { describe, expect, it } from 'vitest'
import { momentoSugerido } from './momentos'

const aLas = (h: number) => momentoSugerido(new Date(2026, 8, 11, h, 30))

describe('momentoSugerido', () => {
  it('reparte el día', () => {
    expect(aLas(8)).toBe('desayuno')
    expect(aLas(13)).toBe('almuerzo')
    expect(aLas(17)).toBe('snack')
    expect(aLas(21)).toBe('cena')
  })

  it('a la una de la noche sigue siendo la cena', () => {
    // Lo que se registra a esa hora es lo que se acaba de comer, no el
    // desayuno de dentro de siete horas.
    expect(aLas(1)).toBe('cena')
    expect(aLas(4)).toBe('cena')
    expect(aLas(5)).toBe('desayuno')
  })
})
