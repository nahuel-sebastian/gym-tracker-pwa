import { describe, expect, it } from 'vitest'
import { ErrorDeSobre } from './sobre'
import { aCrear, interpretarRutina } from './rutinaImportada'
import type { Ejercicio } from './tipos'

const ejercicio = (id: string, nombre: string, archivado = false): Ejercicio => ({
  id,
  nombre,
  grupo_muscular: 'pecho',
  equipamiento: 'barra',
  es_unilateral: false,
  notas: null,
  archivado,
})

const CATALOGO = [
  ejercicio('press', 'Press de banca con barra'),
  ejercicio('aduccion', 'Aducción de cadera en máquina'),
  ejercicio('viejo', 'Máquina de pecho antigua', true),
]

const RUTINA = {
  tipo: 'rutina',
  nombre: 'Full body 3 días',
  dias: [
    {
      nombre: 'Día A — Empuje',
      ejercicios: [
        { ejercicio: 'Press de banca con barra', series: 4, reps: '6-8', rir: 2, descanso_seg: 150 },
        { ejercicio: 'Face pull', series: 3, reps: '12-15', rir: 1 },
      ],
    },
  ],
}

describe('interpretarRutina', () => {
  it('empareja por nombre contra el catálogo', () => {
    const r = interpretarRutina(RUTINA, CATALOGO)

    expect(r.nombre).toBe('Full body 3 días')
    expect(r.dias[0].ejercicios[0]).toMatchObject({
      nombre: 'Press de banca con barra',
      ejercicio_id: 'press',
      emparejadoCon: 'Press de banca con barra',
      series_objetivo: 4,
      reps_objetivo: '6-8',
      rir_objetivo: 2,
      descanso_seg: 150,
    })
  })

  it('lo que no está en el catálogo queda marcado para crear', () => {
    const r = interpretarRutina(RUTINA, CATALOGO)

    expect(r.dias[0].ejercicios[1]).toMatchObject({
      nombre: 'Face pull',
      ejercicio_id: null,
      emparejadoCon: null,
    })
    expect(aCrear(r)).toEqual(['Face pull'])
  })

  it('empareja ignorando acentos, mayúsculas y espacios de sobra', () => {
    // Nadie escribe "Aducción" con tilde en un prompt.
    const suelto = {
      nombre: 'R',
      dias: [{ nombre: 'D', ejercicios: [{ ejercicio: '  aduccion  DE   cadera en maquina ' }] }],
    }
    expect(interpretarRutina(suelto, CATALOGO).dias[0].ejercicios[0].ejercicio_id).toBe('aduccion')
  })

  it('no empareja con un ejercicio archivado: se crearía uno nuevo', () => {
    const conArchivado = {
      nombre: 'R',
      dias: [{ nombre: 'D', ejercicios: [{ ejercicio: 'Máquina de pecho antigua' }] }],
    }
    const r = interpretarRutina(conArchivado, CATALOGO)
    expect(r.dias[0].ejercicios[0].ejercicio_id).toBeNull()
  })

  it('acepta los dos nombres de campo, para que la exportación pueda reimportarse', () => {
    const comoLoExportaLaApp = {
      nombre: 'R',
      dias: [
        {
          nombre: 'D',
          ejercicios: [
            { nombre: 'Press de banca con barra', series_objetivo: 3, reps_objetivo: '8-10', rir_objetivo: 2 },
          ],
        },
      ],
    }
    expect(interpretarRutina(comoLoExportaLaApp, CATALOGO).dias[0].ejercicios[0]).toMatchObject({
      ejercicio_id: 'press',
      series_objetivo: 3,
      reps_objetivo: '8-10',
    })
  })

  it('los objetivos que falten quedan a null, no a cero', () => {
    const minima = { nombre: 'R', dias: [{ nombre: 'D', ejercicios: [{ ejercicio: 'Face pull' }] }] }
    expect(interpretarRutina(minima, CATALOGO).dias[0].ejercicios[0]).toMatchObject({
      series_objetivo: null,
      reps_objetivo: null,
      rir_objetivo: null,
      descanso_seg: null,
    })
  })
})

describe('lo que rechaza', () => {
  const falla = (bruto: unknown) => () => interpretarRutina(bruto, CATALOGO)

  it('sin nombre de rutina', () => {
    expect(falla({ dias: [{ nombre: 'D', ejercicios: [{ ejercicio: 'x' }] }] })).toThrow(
      /le falta el nombre/,
    )
  })

  it('sin días', () => {
    expect(falla({ nombre: 'R' })).toThrow(/ningún día/)
    expect(falla({ nombre: 'R', dias: [] })).toThrow(/ningún día/)
  })

  it('un día vacío, diciendo cuál', () => {
    expect(falla({ nombre: 'R', dias: [{ nombre: 'Día A', ejercicios: [] }] })).toThrow(
      /«Día A» no trae ningún ejercicio/,
    )
  })

  it('un ejercicio sin nombre, diciendo en qué día', () => {
    expect(
      falla({ nombre: 'R', dias: [{ nombre: 'Día A', ejercicios: [{ series: 3 }] }] }),
    ).toThrow(/ejercicio 1 de «Día A» le falta el nombre/)
  })

  it('errores del tipo que se pueden enseñar tal cual', () => {
    expect(falla({ nombre: 'R' })).toThrow(ErrorDeSobre)
  })

  it('empareja un nombre abreviado, que es como escriben los modelos', () => {
    const r = interpretarRutina(conEjercicio('press banca'), CATALOGO)

    expect(r.dias[0].ejercicios[0]).toMatchObject({
      nombre: 'press banca',
      ejercicio_id: 'press',
      emparejadoCon: 'Press de banca con barra',
    })
  })

  it('no adivina cuando el nombre corto vale para dos del catálogo', () => {
    // "press banca" con la versión de barra y la de mancuernas delante: elegir
    // una sería inventarse el histórico del ejercicio equivocado.
    const catalogo = [...CATALOGO, ejercicio('mancuernas', 'Press de banca con mancuernas')]
    const r = interpretarRutina(conEjercicio('press banca'), catalogo)

    expect(r.dias[0].ejercicios[0].ejercicio_id).toBeNull()
    expect(aCrear(r)).toContain('press banca')
  })

  it('tampoco empareja por palabras con uno archivado', () => {
    const r = interpretarRutina(conEjercicio('maquina pecho'), CATALOGO)
    expect(r.dias[0].ejercicios[0].ejercicio_id).toBeNull()
  })
})

function conEjercicio(nombre: string) {
  return { nombre: 'R', dias: [{ nombre: 'Día A', ejercicios: [{ ejercicio: nombre, series: 3 }] }] }
}
