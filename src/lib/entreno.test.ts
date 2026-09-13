import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { guardarDelServidor } from './datos'
import { propuestaDeSerie, ultimaVez, unoRM, volumenDeSerie } from './entreno'
import type { Serie } from './tipos'

const PRESS = 'ej-press'
const SENTADILLA = 'ej-sentadilla'

async function sembrarSesion(
  id: string,
  fecha: string,
  series: { ejercicio: string; numero: number; peso: number; reps: number; tipo?: string }[],
  created_at = `${fecha}T10:00:00Z`,
) {
  await guardarDelServidor('sesiones', [{ id, fecha, created_at }])
  await guardarDelServidor(
    'series',
    series.map((s, i) => ({
      id: `${id}-${i}`,
      sesion_id: id,
      ejercicio_id: s.ejercicio,
      numero: s.numero,
      peso_kg: s.peso,
      reps: s.reps,
      rir: 2,
      tipo: s.tipo ?? 'normal',
    })),
  )
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('ultimaVez', () => {
  it('devuelve la sesión más reciente de cada ejercicio, con sus series en orden', async () => {
    await sembrarSesion('s1', '2026-09-01', [
      { ejercicio: PRESS, numero: 1, peso: 80, reps: 8 },
      { ejercicio: PRESS, numero: 2, peso: 80, reps: 7 },
    ])
    await sembrarSesion('s2', '2026-09-08', [
      { ejercicio: PRESS, numero: 2, peso: 82.5, reps: 7 },
      { ejercicio: PRESS, numero: 1, peso: 82.5, reps: 8 },
      { ejercicio: SENTADILLA, numero: 1, peso: 100, reps: 5 },
    ])

    const mapa = await ultimaVez([PRESS, SENTADILLA])

    expect(mapa.get(PRESS)?.fecha).toBe('2026-09-08')
    expect(mapa.get(PRESS)?.series.map((s) => s.numero)).toEqual([1, 2])
    expect(mapa.get(PRESS)?.series[0].peso_kg).toBe(82.5)
    expect(mapa.get(SENTADILLA)?.series).toHaveLength(1)
  })

  it('ignora la sesión en curso: la última vez es la anterior', async () => {
    await sembrarSesion('s1', '2026-09-01', [{ ejercicio: PRESS, numero: 1, peso: 80, reps: 8 }])
    await sembrarSesion('hoy', '2026-09-11', [{ ejercicio: PRESS, numero: 1, peso: 85, reps: 6 }])

    const mapa = await ultimaVez([PRESS], 'hoy')

    expect(mapa.get(PRESS)?.fecha).toBe('2026-09-01')
    expect(mapa.get(PRESS)?.series[0].peso_kg).toBe(80)
  })

  it('con dos sesiones el mismo día gana la registrada después', async () => {
    await sembrarSesion('manana', '2026-09-10', [{ ejercicio: PRESS, numero: 1, peso: 80, reps: 8 }], '2026-09-10T08:00:00Z')
    await sembrarSesion('tarde', '2026-09-10', [{ ejercicio: PRESS, numero: 1, peso: 85, reps: 5 }], '2026-09-10T19:00:00Z')

    expect((await ultimaVez([PRESS])).get(PRESS)?.series[0].peso_kg).toBe(85)
  })

  it('un ejercicio que nunca se ha hecho no aparece', async () => {
    await sembrarSesion('s1', '2026-09-01', [{ ejercicio: PRESS, numero: 1, peso: 80, reps: 8 }])
    const mapa = await ultimaVez([PRESS, SENTADILLA])
    expect(mapa.has(SENTADILLA)).toBe(false)
  })

  it('sin ejercicios no consulta nada', async () => {
    expect((await ultimaVez([])).size).toBe(0)
  })
})

describe('propuestaDeSerie', () => {
  const serie = (n: number, peso: number, reps: number, rir = 2): Serie => ({
    id: `x${n}`,
    sesion_id: 's',
    ejercicio_id: PRESS,
    numero: n,
    peso_kg: peso,
    reps,
    rir,
    tipo: 'normal',
  })

  const anterior = {
    sesion_id: 's1',
    fecha: '2026-09-04',
    series: [serie(1, 80, 8), serie(2, 80, 7), serie(3, 77.5, 7)],
  }

  it('manda lo último hecho hoy: la segunda serie va como fue la primera', () => {
    expect(propuestaDeSerie([serie(1, 85, 6, 1)], anterior, 2)).toEqual({
      peso_kg: 85,
      reps: 6,
      rir: 1,
    })
  })

  it('si aún no hay nada hoy, propone la serie del mismo número de la última vez', () => {
    expect(propuestaDeSerie([], anterior, 3)).toMatchObject({ peso_kg: 77.5, reps: 7 })
  })

  it('si la última vez tuvo menos series, cae en la primera', () => {
    expect(propuestaDeSerie([], anterior, 5)).toMatchObject({ peso_kg: 80, reps: 8 })
  })

  it('un ejercicio nuevo se propone vacío, no a cero', () => {
    // Cero sería un peso registrado; vacío es "dímelo tú".
    expect(propuestaDeSerie([], undefined, 1)).toEqual({
      peso_kg: null,
      reps: null,
      rir: null,
    })
  })
})

describe('volumen y 1RM', () => {
  const base = { id: 'x', sesion_id: 's', ejercicio_id: PRESS, numero: 1, rir: 2 }

  it('el calentamiento no suma volumen', () => {
    expect(volumenDeSerie({ ...base, peso_kg: 60, reps: 10, tipo: 'calentamiento' })).toBe(0)
    expect(volumenDeSerie({ ...base, peso_kg: 60, reps: 10, tipo: 'normal' })).toBe(600)
  })

  it('una serie sin peso o sin reps no suma', () => {
    expect(volumenDeSerie({ ...base, peso_kg: null, reps: 10, tipo: 'normal' })).toBe(0)
    expect(volumenDeSerie({ ...base, peso_kg: 60, reps: null, tipo: 'normal' })).toBe(0)
  })

  it('aplica Epley tal cual lo define el plan', () => {
    // peso × (1 + reps / 30). No se corrige el caso de una repetición: la
    // comparación consigo mismo a lo largo del tiempo vale igual.
    expect(unoRM(100, 1)).toBeCloseTo(103.33, 2)
    expect(unoRM(100, 0)).toBe(100)
    expect(unoRM(80, 8)).toBeCloseTo(101.33, 2)
  })
})

describe('esEfectiva, que es lo que el selector de tipo hace posible', () => {
  const base = { id: 'x', sesion_id: 's', ejercicio_id: PRESS, numero: 1, peso_kg: 80, reps: 8, rir: 2 }

  it('solo el calentamiento queda fuera del trabajo efectivo', () => {
    // Antes del selector, todo se guardaba como `normal` y las series de
    // aproximación se contaban como volumen en las gráficas.
    expect(volumenDeSerie({ ...base, tipo: 'normal' })).toBe(640)
    expect(volumenDeSerie({ ...base, tipo: 'dropset' })).toBe(640)
    expect(volumenDeSerie({ ...base, tipo: 'fallo' })).toBe(640)
    expect(volumenDeSerie({ ...base, tipo: 'calentamiento' })).toBe(0)
  })
})

describe('el calentamiento no manda en la referencia', () => {
  const serie = (
    id: string, sesion: string, numero: number, peso: number, reps: number,
    tipo: Serie['tipo'] = 'normal',
  ): Serie => ({ id, sesion_id: sesion, ejercicio_id: PRESS, numero, peso_kg: peso, reps, rir: 2, tipo })

  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('"última vez" enseña solo las series efectivas', async () => {
    await guardarDelServidor('sesiones', [{ id: 's1', fecha: '2026-09-01', created_at: '2026-09-01T10:00:00Z' }])
    await guardarDelServidor('series', [
      serie('a', 's1', 1, 46.5, 10, 'calentamiento'),
      serie('b', 's1', 2, 77.5, 7),
      serie('c', 's1', 3, 77.5, 6),
    ])

    const anterior = (await ultimaVez([PRESS])).get(PRESS)
    expect(anterior!.series.map((s) => s.peso_kg)).toEqual([77.5, 77.5])
  })

  it('una sesión que solo fue calentamiento no cuenta como última vez', async () => {
    await guardarDelServidor('sesiones', [
      { id: 'vieja', fecha: '2026-09-01', created_at: '2026-09-01T10:00:00Z' },
      { id: 'tanteo', fecha: '2026-09-08', created_at: '2026-09-08T10:00:00Z' },
    ])
    await guardarDelServidor('series', [
      serie('a', 'vieja', 1, 80, 8),
      serie('b', 'tanteo', 1, 40, 12, 'calentamiento'),
    ])

    const anterior = (await ultimaVez([PRESS])).get(PRESS)
    expect(anterior!.fecha).toBe('2026-09-01')
    expect(anterior!.series[0].peso_kg).toBe(80)
  })

  it('tras calentar, la propuesta es el peso de trabajo de la última vez', () => {
    const anterior = {
      sesion_id: 's1',
      fecha: '2026-09-04',
      series: [serie('x', 's1', 1, 77.5, 8)],
    }
    const hoy = [serie('c', 'hoy', 1, 46.5, 10, 'calentamiento')]

    // Sin esto propondría 46,5 kg como serie de trabajo.
    expect(propuestaDeSerie(hoy, anterior, 2)).toMatchObject({ peso_kg: 77.5, reps: 8 })
  })
})
