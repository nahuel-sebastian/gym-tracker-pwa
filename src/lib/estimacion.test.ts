import { describe, expect, it } from 'vitest'
import { ErrorDeFormato, estimarMacros, interpretar, puenteManual } from './estimacion'

/** El ejemplo exacto que traía el plan original. */
const DEL_PLAN = `{
  "alimentos": [
    {
      "nombre": "Pechuga de pollo a la plancha",
      "gramos": 180,
      "kcal": 297,
      "proteina": 55.8,
      "grasa": 6.5,
      "carbos": 0
    }
  ],
  "momento": "almuerzo"
}`

describe('lo que llega de verdad al pegar', () => {
  it('interpreta el formato del plan', () => {
    expect(interpretar(DEL_PLAN)).toEqual({
      momento: 'almuerzo',
      alimentos: [
        {
          nombre: 'Pechuga de pollo a la plancha',
          gramos: 180,
          kcal: 297,
          proteina: 55.8,
          grasa: 6.5,
          carbos: 0,
        },
      ],
    })
  })

  it('quita las vallas de markdown que vienen al copiar de un chat', () => {
    expect(interpretar('```json\n' + DEL_PLAN + '\n```').alimentos).toHaveLength(1)
    expect(interpretar('```\n' + DEL_PLAN + '\n```').alimentos).toHaveLength(1)
  })

  it('acepta la lista suelta, sin el objeto de fuera', () => {
    const lista = '[{"nombre":"Arroz","kcal":260,"proteina":5,"grasa":1,"carbos":56}]'
    const estimacion = interpretar(lista)
    expect(estimacion.alimentos[0].nombre).toBe('Arroz')
    expect(estimacion.momento).toBeNull()
  })

  it('lee los números que vienen como texto, con coma o con unidad', () => {
    const raro = `{"alimentos":[{"nombre":"Aceite","gramos":"15 g","kcal":"132","proteina":"0","grasa":"14,7","carbos":"0"}]}`
    expect(interpretar(raro).alimentos[0]).toMatchObject({ gramos: 15, kcal: 132, grasa: 14.7 })
  })

  it('los gramos son opcionales', () => {
    const sinGramos = '{"alimentos":[{"nombre":"Ensalada","kcal":90,"proteina":2,"grasa":7,"carbos":5}]}'
    expect(interpretar(sinGramos).alimentos[0].gramos).toBeNull()
  })

  it('un momento que no existe no tira la comida entera', () => {
    // La pantalla ya propone el que toca por la hora; rechazar el JSON por esto
    // sería perder el registro por un detalle que el usuario puede confirmar.
    const raro = DEL_PLAN.replace('"almuerzo"', '"merienda"')
    expect(interpretar(raro).momento).toBeNull()
    expect(interpretar(raro).alimentos).toHaveLength(1)
  })

  it('ignora los campos de más', () => {
    const extra = '{"alimentos":[{"nombre":"Pan","kcal":80,"proteina":3,"grasa":1,"carbos":15,"fibra":2}],"notas":"x"}'
    expect(interpretar(extra).alimentos[0]).not.toHaveProperty('fibra')
  })
})

describe('lo que tiene que rechazar', () => {
  const falla = (texto: string) => () => interpretar(texto)

  it('un texto que no es JSON', () => {
    expect(falla('claro, aquí tienes los macros')).toThrow(ErrorDeFormato)
    expect(falla('claro, aquí tienes')).toThrow(/no es JSON válido/)
  })

  it('un campo vacío', () => {
    expect(falla('   ')).toThrow(/No has pegado nada/)
  })

  it('un JSON sin la lista de alimentos', () => {
    expect(falla('{"momento":"cena"}')).toThrow(/Falta la lista "alimentos"/)
  })

  it('una lista vacía', () => {
    expect(falla('{"alimentos":[]}')).toThrow(/ningún alimento/)
  })

  it('un alimento sin nombre, diciendo cuál', () => {
    expect(falla('{"alimentos":[{"kcal":10,"proteina":0,"grasa":0,"carbos":0}]}')).toThrow(
      /alimento 1 le falta el nombre/,
    )
  })

  it('un macro que falta, nombrando el alimento y el campo', () => {
    // Este es el fallo caro: guardarlo como cero descuadra el día entero y
    // nadie se entera hasta que no cuadran los totales de la semana.
    expect(falla('{"alimentos":[{"nombre":"Salmón","kcal":300,"proteina":30,"carbos":0}]}')).toThrow(
      /A «Salmón» le falta grasa/,
    )
  })

  it('un macro que no es un número', () => {
    expect(
      falla('{"alimentos":[{"nombre":"Salmón","kcal":"bastantes","proteina":30,"grasa":18,"carbos":0}]}'),
    ).toThrow(/«Salmón» tiene un valor de kcal que no es un número/)
  })

  it('un macro en negativo', () => {
    expect(
      falla('{"alimentos":[{"nombre":"Salmón","kcal":300,"proteina":-30,"grasa":18,"carbos":0}]}'),
    ).toThrow(/en negativo/)
  })

  it('null como macro, que es lo que suele salir cuando el modelo no lo sabe', () => {
    expect(
      falla('{"alimentos":[{"nombre":"Salsa","kcal":null,"proteina":0,"grasa":0,"carbos":0}]}'),
    ).toThrow(/le falta kcal/)
  })

  it('un elemento de la lista que no es un objeto', () => {
    expect(falla('{"alimentos":["pollo"]}')).toThrow(/alimento 1 no es un objeto/)
  })
})

describe('la capa de estimación', () => {
  it('estimarMacros usa el puente manual', async () => {
    const estimacion = await estimarMacros({ tipo: 'texto', contenido: DEL_PLAN })
    expect(estimacion.alimentos).toHaveLength(1)
  })

  it('el puente manual dice que solo acepta texto', async () => {
    expect(puenteManual.acepta).toEqual(['texto'])
    await expect(
      estimarMacros({ tipo: 'imagen', contenido: new Blob() }),
    ).rejects.toThrow(/solo acepta texto/)
  })
})
