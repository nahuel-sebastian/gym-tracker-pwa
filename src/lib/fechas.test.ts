import { describe, expect, it } from 'vitest'
import { diasEntre, fechaLocal, formatoRelativo, hoy, sumarDias } from './fechas'

describe('fechaLocal', () => {
  it('una cena a las 22:00 cuenta como del mismo día', () => {
    // El fallo que esto impide: `toISOString()` en España (UTC+2) devolvería
    // 2026-09-11T20:00Z, y una cena a las 23:30 acabaría en el día siguiente.
    expect(fechaLocal(new Date(2026, 8, 11, 22, 0))).toBe('2026-09-11')
    expect(fechaLocal(new Date(2026, 8, 11, 23, 59))).toBe('2026-09-11')
    expect(fechaLocal(new Date(2026, 8, 12, 0, 1))).toBe('2026-09-12')
  })

  it('rellena mes y día con dos dígitos, para que el texto ordene por fecha', () => {
    expect(fechaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')

    // De esto depende que sirva como clave de índice en IndexedDB: el orden
    // alfabético del texto tiene que ser el orden cronológico.
    const desordenadas = ['2026-01-12', '2026-01-05', '2025-12-31']
    expect([...desordenadas].sort()).toEqual(['2025-12-31', '2026-01-05', '2026-01-12'])
  })
})

describe('sumarDias', () => {
  it('cruza meses y años', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('cruza el cambio de hora sin perder el día', () => {
    // Último domingo de octubre de 2026: la noche tiene 25 horas.
    expect(sumarDias('2026-10-24', 1)).toBe('2026-10-25')
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26')
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2)
  })

  it('una semana de media móvil son siete fechas consecutivas', () => {
    const fechas = Array.from({ length: 7 }, (_, i) => sumarDias('2026-03-25', i))
    expect(fechas).toEqual([
      '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28',
      '2026-03-29', '2026-03-30', '2026-03-31',
    ])
  })
})

describe('formatoRelativo', () => {
  it('nombra hoy y ayer', () => {
    expect(formatoRelativo(hoy())).toBe('Hoy')
    expect(formatoRelativo(sumarDias(hoy(), -1))).toBe('Ayer')
    expect(formatoRelativo(sumarDias(hoy(), -9))).toMatch(/^\d{1,2} \w{3}$/)
  })
})
