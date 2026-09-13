// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import { guardarDelServidor } from '../lib/datos'
import Sesion from './Sesion'

vi.mock('../lib/senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const PRESS = 'ej-press'
const REMO = 'ej-remo'
const DIA = 'dia-a'
const HOY = 'sesion-hoy'

function pintar(id = HOY) {
  return render(
    <MemoryRouter initialEntries={[`/entreno/sesion/${id}`]}>
      <Routes>
        <Route path="/entreno/sesion/:id" element={<Sesion />} />
        <Route path="/entreno" element={<p>Entreno</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))

  await guardarDelServidor('ejercicios', [
    { id: PRESS, nombre: 'Press banca', grupo_muscular: 'pecho', equipamiento: 'barra', es_unilateral: false, archivado: false },
    { id: REMO, nombre: 'Remo con barra', grupo_muscular: 'espalda', equipamiento: 'barra', es_unilateral: false, archivado: false },
  ])
  await guardarDelServidor('rutina_dias', [
    { id: DIA, rutina_id: 'r1', nombre: 'Día A — Empuje', orden: 0 },
  ])
  await guardarDelServidor('rutina_ejercicios', [
    { id: 're1', dia_id: DIA, ejercicio_id: PRESS, orden: 0, series_objetivo: 3, reps_objetivo: '8-10', rir_objetivo: 2 },
  ])

  // La sesión de la semana pasada, que es la referencia de progresión.
  await guardarDelServidor('sesiones', [
    { id: 'sesion-vieja', dia_id: DIA, nombre_dia: 'Día A — Empuje', fecha: '2026-09-04', created_at: '2026-09-04T18:00:00Z' },
    { id: HOY, dia_id: DIA, nombre_dia: 'Día A — Empuje', fecha: '2026-09-11', hora_fin: null, notas: null, sensacion: null, created_at: '2026-09-11T18:00:00Z' },
  ])
  await guardarDelServidor('series', [
    { id: 'v1', sesion_id: 'sesion-vieja', ejercicio_id: PRESS, numero: 1, peso_kg: 80, reps: 8, rir: 2, tipo: 'normal' },
    { id: 'v2', sesion_id: 'sesion-vieja', ejercicio_id: PRESS, numero: 2, peso_kg: 80, reps: 7, rir: 1, tipo: 'normal' },
  ])
})

afterEach(cleanup)

describe('pantalla de sesión', () => {
  it('enseña qué se hizo la última vez junto al ejercicio', async () => {
    pintar()

    expect(await screen.findByText('Press banca')).toBeDefined()
    // El dato que gobierna la progresión, sin navegar a ningún sitio.
    expect(await screen.findByText('80×8 RIR2 · 80×7 RIR1')).toBeDefined()
    expect(screen.getByText(/Última vez/)).toBeDefined()
  })

  it('precarga la serie con lo de la última vez y la anota de un toque', async () => {
    const usuario = userEvent.setup()
    pintar()

    await screen.findByText(/Última vez/)
    const peso = (await screen.findByLabelText('Peso de la serie 1')) as HTMLInputElement
    const reps = screen.getByLabelText('Repeticiones de la serie 1') as HTMLInputElement
    expect(peso.value).toBe('80')
    expect(reps.value).toBe('8')

    // En el caso normal solo hay que confirmar.
    await usuario.click(screen.getByLabelText('Anotar serie'))

    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(1))
    const anotada = (await db.series.where('sesion_id').equals(HOY).toArray())[0]
    expect(anotada).toMatchObject({
      ejercicio_id: PRESS,
      numero: 1,
      peso_kg: 80,
      reps: 8,
      rir: 2,
      tipo: 'normal',
    })
  })

  it('la siguiente serie se propone como la que se acaba de hacer', async () => {
    const usuario = userEvent.setup()
    pintar()

    const peso = (await screen.findByLabelText('Peso de la serie 1')) as HTMLInputElement
    // Se espera a que llegue la propuesta antes de cambiarla, que es lo que
    // hace una persona: mira lo que pone y decide si subir el peso.
    await waitFor(() => expect(peso.value).toBe('80'))
    await usuario.clear(peso)
    await usuario.type(peso, '82,5')
    await usuario.clear(screen.getByLabelText('Repeticiones de la serie 1'))
    await usuario.type(screen.getByLabelText('Repeticiones de la serie 1'), '6')
    await usuario.click(screen.getByLabelText('Anotar serie'))

    // Si la primera salió a 82,5 la segunda casi seguro va igual, aunque la
    // semana pasada fuera a 80.
    const siguiente = (await screen.findByLabelText('Peso de la serie 2')) as HTMLInputElement
    expect(siguiente.value).toBe('82,5')
    expect((screen.getByLabelText('Repeticiones de la serie 2') as HTMLInputElement).value).toBe('6')
  })

  it('numera por ejercicio, no por sesión', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(await screen.findByLabelText('Anotar serie'))
    await screen.findByLabelText('Peso de la serie 2')
    await usuario.click(screen.getByLabelText('Anotar serie'))
    await screen.findByLabelText('Peso de la serie 3')

    // Y ahora otro ejercicio, fuera del plan.
    await usuario.click(screen.getByRole('button', { name: 'Añadir ejercicio' }))
    await usuario.click(await screen.findByText('Remo con barra'))

    const anotar = await screen.findAllByLabelText('Anotar serie')
    await usuario.type(screen.getAllByLabelText('Peso de la serie 1')[0], '60')
    await usuario.type(screen.getAllByLabelText('Repeticiones de la serie 1')[0], '10')
    await usuario.click(anotar[anotar.length - 1])

    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(3))
    const delRemo = (await db.series.where('sesion_id').equals(HOY).toArray()).filter(
      (s) => s.ejercicio_id === REMO,
    )
    expect(delRemo).toHaveLength(1)
    expect(delRemo[0].numero).toBe(1)
  })

  it('un ejercicio nunca hecho no propone nada, en vez de proponer cero', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(await screen.findByRole('button', { name: 'Añadir ejercicio' }))
    await usuario.click(await screen.findByText('Remo con barra'))

    expect(await screen.findByText('Primera vez con este ejercicio.')).toBeDefined()
    const pesos = screen.getAllByLabelText('Peso de la serie 1') as HTMLInputElement[]
    expect(pesos.some((p) => p.value === '')).toBe(true)
  })

  it('anota una serie de calentamiento, que no cuenta como volumen', async () => {
    const usuario = userEvent.setup()
    pintar()

    await screen.findByText(/Última vez/)
    await usuario.click(screen.getByRole('radio', { name: 'Calent.' }))
    await usuario.click(screen.getByLabelText('Anotar serie'))

    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(1))
    expect((await db.series.where('sesion_id').equals(HOY).toArray())[0].tipo).toBe('calentamiento')
  })

  it('el tipo no se arrastra a la siguiente serie', async () => {
    const usuario = userEvent.setup()
    pintar()

    await screen.findByText(/Última vez/)
    await usuario.click(screen.getByRole('radio', { name: 'Calent.' }))
    await usuario.click(screen.getByLabelText('Anotar serie'))
    await screen.findByLabelText('Peso de la serie 2')

    // Lo habitual es una de aproximación y el resto efectivas.
    await usuario.click(screen.getByLabelText('Anotar serie'))
    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(2))

    const tipos = (await db.series.where('sesion_id').equals(HOY).sortBy('numero')).map((s) => s.tipo)
    expect(tipos).toEqual(['calentamiento', 'normal'])
  })

  it('corrige el tipo de una serie ya anotada', async () => {
    const usuario = userEvent.setup()
    pintar()

    await screen.findByText(/Última vez/)
    await usuario.click(screen.getByLabelText('Anotar serie'))
    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(1))

    await usuario.click(screen.getByLabelText('Tipo de la serie 1: Normal'))
    // El selector de la fila ya anotada va antes en el DOM que el de la nueva.
    await usuario.click((await screen.findAllByRole('radio', { name: 'Calent.' }))[0])

    await waitFor(async () =>
      expect((await db.series.where('sesion_id').equals(HOY).toArray())[0].tipo).toBe(
        'calentamiento',
      ),
    )
  })

  it('enseña el descanso objetivo junto al ejercicio', async () => {
    await guardarDelServidor('rutina_ejercicios', [
      { id: 're1', dia_id: DIA, ejercicio_id: PRESS, orden: 0, series_objetivo: 3, reps_objetivo: '8-10', rir_objetivo: 2, descanso_seg: 150 },
    ])

    pintar()
    expect(await screen.findByText('3 series · 8-10 reps · RIR 2 · 2:30')).toBeDefined()
  })

  it('borra una serie mal anotada', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.click(await screen.findByLabelText('Anotar serie'))
    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(1))

    await usuario.click(await screen.findByLabelText('Borrar serie 1'))
    await waitFor(async () => expect(await db.series.where('sesion_id').equals(HOY).count()).toBe(0))
  })

  it('terminar guarda la hora de fin, las notas y la sensación', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.type(await screen.findByLabelText('Notas de la sesión'), 'Hombro algo cargado')
    await usuario.click(screen.getByRole('radio', { name: '4' }))
    await usuario.click(screen.getByRole('button', { name: 'Terminar entreno' }))

    await waitFor(async () => expect((await db.sesiones.get(HOY))?.hora_fin).toBeTruthy())
    expect(await db.sesiones.get(HOY)).toMatchObject({
      notas: 'Hombro algo cargado',
      sensacion: 4,
    })
  })

  it('una sesión terminada no deja anotar hasta reabrirla', async () => {
    await guardarDelServidor('sesiones', [
      { id: HOY, dia_id: DIA, nombre_dia: 'Día A — Empuje', fecha: '2026-09-11', hora_fin: '2026-09-11T19:30:00Z' },
    ])

    pintar()

    expect(await screen.findByText(/terminada/)).toBeDefined()
    expect(screen.queryByLabelText('Anotar serie')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reabrir sesión' })).toBeDefined()
  })
})
