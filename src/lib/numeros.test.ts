import { describe, expect, it } from 'vitest'
import { aNumero, aNumeroPositivo, aTexto, formatoNumero } from './numeros'

describe('aNumero', () => {
  it('acepta la coma decimal del teclado español', () => {
    // Sin esto, teclear "82,5" en el peso de una serie daría NaN y la serie se
    // guardaría sin peso.
    expect(aNumero('82,5')).toBe(82.5)
    expect(aNumero('82.5')).toBe(82.5)
    expect(aNumero(' 82,5 ')).toBe(82.5)
  })

  it('un campo vacío es null, no cero', () => {
    // Cero es un peso válido (peso corporal); "no he escrito nada" no lo es.
    expect(aNumero('')).toBeNull()
    expect(aNumero('   ')).toBeNull()
    expect(aNumero('0')).toBe(0)
  })

  it('lo que no es número es null', () => {
    expect(aNumero('abc')).toBeNull()
    expect(aNumero('8,5,5')).toBeNull()
    expect(aNumero('Infinity')).toBeNull()
  })
})

describe('aNumeroPositivo', () => {
  it('rechaza cero y negativos', () => {
    expect(aNumeroPositivo('0')).toBeNull()
    expect(aNumeroPositivo('-5')).toBeNull()
    expect(aNumeroPositivo('180')).toBe(180)
  })
})

describe('aTexto', () => {
  it('deja el campo vacío si no hay valor', () => {
    expect(aTexto(null)).toBe('')
    expect(aTexto(undefined)).toBe('')
  })

  it('ida y vuelta sin perder decimales', () => {
    expect(aNumero(aTexto(82.5))).toBe(82.5)
    expect(aNumero(aTexto(3.25))).toBe(3.25)
    expect(formatoNumero(0.5)).toBe('0,5')
  })

  it('no rellena con ceros: un peso de 78,4 kg no es "78,40"', () => {
    expect(formatoNumero(78.4, 2)).toBe('78,4')
    expect(formatoNumero(78, 2)).toBe('78')
    expect(formatoNumero(78.45, 2)).toBe('78,45')
    expect(aTexto(78.4)).toBe('78,4')
  })
})
