import { describe, expect, it } from 'vitest'
import { escalaLimpia } from './comun'

describe('escalaLimpia', () => {
  it('da un paso único y redondo, no tres saltos distintos', () => {
    // Repartir 77,9–82,4 a ojo salía 83 / 81,5 / 79,5 / 77,5: tres saltos
    // distintos en el mismo eje, que hay que pararse a leer.
    const { dominio, marcas } = escalaLimpia([77.9, 80.1, 82.4])

    expect(dominio).toEqual([77, 83])
    expect(marcas).toEqual([77, 78, 79, 80, 81, 82, 83])
  })

  it('el dominio envuelve siempre a los datos', () => {
    const { dominio } = escalaLimpia([123.4, 127.5])
    expect(dominio[0]).toBeLessThanOrEqual(123.4)
    expect(dominio[1]).toBeGreaterThanOrEqual(127.5)
  })

  it('escala a rangos grandes sin llenar el eje de marcas', () => {
    const { marcas } = escalaLimpia([0, 2800])
    expect(marcas.length).toBeLessThanOrEqual(7)
    expect(marcas[0]).toBe(0)
    expect(marcas[marcas.length - 1]).toBeGreaterThanOrEqual(2800)
  })

  it('un solo valor no rompe la escala', () => {
    const { dominio, marcas } = escalaLimpia([80])
    expect(dominio[0]).toBeLessThanOrEqual(80)
    expect(dominio[1]).toBeGreaterThanOrEqual(80)
    expect(marcas.length).toBeGreaterThan(0)
  })
})
