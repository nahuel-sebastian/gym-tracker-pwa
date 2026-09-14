import { describe, expect, it } from 'vitest'
import { ErrorDeSobre, analizar, quitarVallas } from './sobre'

const tipo = (texto: string) => analizar(texto).tipo

describe('detectar el tipo', () => {
  it('el campo tipo manda', () => {
    expect(tipo('{"tipo":"rutina","dias":[]}')).toBe('rutina')
    expect(tipo('{"tipo":"comida","alimentos":[]}')).toBe('comida')
    expect(tipo('{"tipo":"alimentos","alimentos":[]}')).toBe('alimentos')
  })

  it('acepta el tipo con mayúsculas o espacios, que es como llega de un chat', () => {
    expect(tipo('{"tipo":" Rutina ","dias":[]}')).toBe('rutina')
  })

  it('sin tipo, lo deduce por la forma', () => {
    // Los JSON de comida de antes de esto no llevaban `tipo` y tienen que
    // seguir funcionando.
    expect(tipo('{"alimentos":[{"nombre":"Pollo","kcal":297}],"momento":"cena"}')).toBe('comida')
    expect(tipo('{"nombre":"Full body","dias":[{"nombre":"Día A"}]}')).toBe('rutina')
  })

  it('distingue una comida de unas fichas de biblioteca', () => {
    // Una ficha habla por 100 g; una comida, del total servido.
    expect(tipo('{"alimentos":[{"nombre":"Pollo","kcal":297,"gramos":180}]}')).toBe('comida')
    expect(tipo('{"alimentos":[{"nombre":"Pollo","kcal_100g":165}]}')).toBe('alimentos')
  })

  it('una lista suelta también vale', () => {
    expect(tipo('[{"nombre":"Pollo","kcal":297}]')).toBe('comida')
    expect(tipo('[{"nombre":"Pollo","kcal_100g":165}]')).toBe('alimentos')
  })
})

describe('lo que rechaza, y cómo lo dice', () => {
  it('un tipo que no existe, diciendo cuáles sí', () => {
    expect(() => analizar('{"tipo":"sesion","x":1}')).toThrow(ErrorDeSobre)
    expect(() => analizar('{"tipo":"sesion","x":1}')).toThrow(/comida, rutina, alimentos/)
  })

  it('un JSON que no se parece a nada', () => {
    expect(() => analizar('{"hola":"mundo"}')).toThrow(/No reconozco ese JSON/)
    expect(() => analizar('42')).toThrow(/No reconozco ese JSON/)
  })

  it('texto que no es JSON', () => {
    expect(() => analizar('claro, aquí tienes la rutina')).toThrow(/no es JSON válido/)
  })

  it('nada', () => {
    expect(() => analizar('   ')).toThrow(/No has pegado nada/)
  })
})

describe('quitarVallas', () => {
  it('quita las vallas de markdown con y sin etiqueta', () => {
    expect(quitarVallas('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(quitarVallas('```\n{"a":1}\n```')).toBe('{"a":1}')
    expect(quitarVallas('{"a":1}')).toBe('{"a":1}')
  })
})
