import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { guardarDelServidor } from './datos'
import { hoy } from './fechas'
import { interpretarRutina } from './rutinaImportada'
import { guardarRutinaImportada, rutinaComoJson } from './rutinas'
import { analizar } from './sobre'

vi.mock('./senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const PRESS = 'ej-press'
const SENTADILLA = 'ej-sentadilla'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await guardarDelServidor('ejercicios', [
    { id: PRESS, nombre: 'Press de banca con barra', grupo_muscular: 'pecho', equipamiento: 'barra', es_unilateral: false, archivado: false },
    { id: SENTADILLA, nombre: 'Sentadilla trasera', grupo_muscular: 'pierna', equipamiento: 'barra', es_unilateral: false, archivado: false },
  ])
})

const JSON_DE_CLAUDE = JSON.stringify({
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
    {
      nombre: 'Día B — Pierna',
      ejercicios: [{ ejercicio: 'sentadilla trasera', series: 5, reps: '5', rir: 2 }],
    },
  ],
})

describe('importar una rutina', () => {
  it('la guarda entera, y crea solo los ejercicios que faltaban', async () => {
    const { bruto } = analizar(JSON_DE_CLAUDE)
    const rutina = interpretarRutina(bruto, await db.ejercicios.toArray())

    await guardarRutinaImportada(rutina, hoy())

    const guardada = (await db.rutinas.toArray())[0]
    expect(guardada).toMatchObject({ nombre: 'Full body 3 días', activa: false })

    const dias = await db.rutina_dias.where('rutina_id').equals(guardada.id).sortBy('orden')
    expect(dias.map((d) => d.nombre)).toEqual(['Día A — Empuje', 'Día B — Pierna'])

    // Solo "Face pull" era nuevo: los otros dos se emparejaron.
    expect(await db.ejercicios.count()).toBe(3)
    expect((await db.ejercicios.toArray()).map((e) => e.nombre)).toContain('Face pull')
  })

  it('no la activa: te cambiaría la rutina que estás haciendo', async () => {
    await guardarDelServidor('rutinas', [{ id: 'mia', nombre: 'La que hago', activa: true }])

    const { bruto } = analizar(JSON_DE_CLAUDE)
    await guardarRutinaImportada(interpretarRutina(bruto, await db.ejercicios.toArray()), hoy())

    const activas = (await db.rutinas.toArray()).filter((r) => r.activa)
    expect(activas).toHaveLength(1)
    expect(activas[0].id).toBe('mia')
  })

  it('conserva los objetivos de cada ejercicio', async () => {
    const { bruto } = analizar(JSON_DE_CLAUDE)
    await guardarRutinaImportada(interpretarRutina(bruto, await db.ejercicios.toArray()), hoy())

    const todos = await db.rutina_ejercicios.toArray()
    const press = todos.find((e) => e.ejercicio_id === PRESS)
    expect(press).toMatchObject({
      series_objetivo: 4,
      reps_objetivo: '6-8',
      rir_objetivo: 2,
      descanso_seg: 150,
    })
  })
})

describe('el viaje completo: exportar e importar', () => {
  it('lo que exporta la app lo vuelve a leer la app', async () => {
    // Es lo que permite pasar una rutina de una cuenta a otra sin recrearla.
    const { bruto } = analizar(JSON_DE_CLAUDE)
    const original = await guardarRutinaImportada(
      interpretarRutina(bruto, await db.ejercicios.toArray()),
      hoy(),
    )

    const exportado = await rutinaComoJson(original)

    // La otra cuenta: mismo catálogo base, sin la rutina.
    await db.rutinas.clear()
    await db.rutina_dias.clear()
    await db.rutina_ejercicios.clear()
    await db.ejercicios.where('nombre').equals('Face pull').delete()

    const { tipo, bruto: reLeido } = analizar(exportado)
    expect(tipo).toBe('rutina')

    const copia = interpretarRutina(reLeido, await db.ejercicios.toArray())
    await guardarRutinaImportada(copia, hoy())

    const guardada = (await db.rutinas.toArray())[0]
    const dias = await db.rutina_dias.where('rutina_id').equals(guardada.id).sortBy('orden')
    const ejerciciosDelA = await db.rutina_ejercicios
      .where('dia_id')
      .equals(dias[0].id)
      .sortBy('orden')

    expect(guardada.nombre).toBe('Full body 3 días')
    expect(dias).toHaveLength(2)
    expect(ejerciciosDelA).toHaveLength(2)
    expect(ejerciciosDelA[0]).toMatchObject({ series_objetivo: 4, reps_objetivo: '6-8' })
  })

  it('los ejercicios viajan por nombre, no por id', async () => {
    // Los ids son de un usuario: en otra cuenta no existen.
    const { bruto } = analizar(JSON_DE_CLAUDE)
    const id = await guardarRutinaImportada(
      interpretarRutina(bruto, await db.ejercicios.toArray()),
      hoy(),
    )

    const exportado = await rutinaComoJson(id)
    expect(exportado).toContain('Press de banca con barra')
    expect(exportado).not.toContain(PRESS)
  })
})
