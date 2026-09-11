// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import { guardarDelServidor } from '../lib/datos'
import { hoy } from '../lib/fechas'
import Hoy from './Hoy'

vi.mock('../lib/senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const FECHA = hoy()

function pintar() {
  return render(
    <MemoryRouter>
      <Hoy />
    </MemoryRouter>,
  )
}

async function sembrarObjetivos() {
  await guardarDelServidor('objetivos_nutricionales', [
    {
      id: 'obj-entreno',
      tipo_dia: 'entreno',
      kcal: 2800,
      proteina_g: 180,
      grasa_g: 80,
      carbos_g: 320,
      vigente_desde: '2026-01-01',
    },
    {
      id: 'obj-descanso',
      tipo_dia: 'descanso',
      kcal: 2200,
      proteina_g: 180,
      grasa_g: 70,
      carbos_g: 200,
      vigente_desde: '2026-01-01',
    },
  ])
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

afterEach(cleanup)

describe('pantalla Hoy', () => {
  it('pregunta por el tipo de día mientras no esté marcado', async () => {
    pintar()
    expect(await screen.findByText('¿Hoy entrenas?')).toBeDefined()

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Entreno' }))

    await waitFor(async () => expect(await db.dias.count()).toBe(1))
    expect((await db.dias.toArray())[0]).toMatchObject({ fecha: FECHA, tipo: 'entreno' })
    // Y la pregunta desaparece.
    await waitFor(() => expect(screen.queryByText('¿Hoy entrenas?')).toBeNull())
  })

  it('compara con el objetivo del tipo de día marcado', async () => {
    await sembrarObjetivos()
    await guardarDelServidor('dias', [{ id: 'd1', fecha: FECHA, tipo: 'descanso' }])
    await guardarDelServidor('registros_comida', [
      {
        id: 'r1',
        fecha: FECHA,
        momento: 'almuerzo',
        descripcion: 'Comida de fuera',
        kcal: 700,
        proteina: 40,
        grasa: 25,
        carbos: 70,
      },
    ])

    pintar()

    // 2200 de descanso menos 700 comidas.
    expect(await screen.findByText('1500')).toBeDefined()
    expect(screen.getByText('kcal restantes')).toBeDefined()
    expect(screen.getByText('700 / 2200')).toBeDefined()
  })

  it('enseña cuánto se ha pasado, en vez de recortar al objetivo', async () => {
    await sembrarObjetivos()
    await guardarDelServidor('dias', [{ id: 'd1', fecha: FECHA, tipo: 'descanso' }])
    await guardarDelServidor('registros_comida', [
      {
        id: 'r1',
        fecha: FECHA,
        momento: 'cena',
        descripcion: 'Pizza entera',
        kcal: 2600,
        proteina: 90,
        grasa: 110,
        carbos: 300,
      },
    ])

    pintar()

    // Un diario que esconde el exceso no sirve para nada.
    expect(await screen.findByText('400')).toBeDefined()
    expect(screen.getByText('kcal de más')).toBeDefined()
  })

  it('sin objetivos sigue contando las kcal del día', async () => {
    await guardarDelServidor('registros_comida', [
      {
        id: 'r1',
        fecha: FECHA,
        momento: 'desayuno',
        descripcion: 'Tostadas',
        kcal: 420,
        proteina: 12,
        grasa: 14,
        carbos: 60,
      },
    ])

    pintar()

    // El anillo cuenta las kcal aunque no haya contra qué compararlas.
    expect(await screen.findByText('sin objetivo')).toBeDefined()
    expect(screen.getByText('kcal hoy')).toBeDefined()
    expect(screen.getAllByText('420').length).toBeGreaterThan(0)
    expect(screen.getByText('Pon tus objetivos en Ajustes')).toBeDefined()
  })

  it('registra el peso de la mañana y luego lo enseña', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.type(await screen.findByLabelText('Peso'), '78,4')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => expect(await db.medidas_corporales.count()).toBe(1))
    expect((await db.medidas_corporales.toArray())[0]).toMatchObject({
      fecha: FECHA,
      peso_kg: 78.4,
    })
    expect(await screen.findByText('78,4 kg')).toBeDefined()
  })

  it('un pesaje por día: volver a pesarse sobrescribe, no añade', async () => {
    const usuario = userEvent.setup()
    pintar()

    await usuario.type(await screen.findByLabelText('Peso'), '78,4')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('78,4 kg')

    await usuario.click(screen.getByRole('button', { name: 'Cambiar' }))
    await usuario.type(await screen.findByLabelText('Peso'), '78,1')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('78,1 kg')
    // El índice único del servidor es por (usuario, fecha): dos filas para el
    // mismo día acabarían en la cola de fallidas.
    expect(await db.medidas_corporales.count()).toBe(1)
  })

  it('agrupa las comidas por momento y deja borrarlas', async () => {
    const usuario = userEvent.setup()
    await guardarDelServidor('registros_comida', [
      { id: 'r1', fecha: FECHA, momento: 'desayuno', descripcion: 'Avena', kcal: 350, proteina: 12, grasa: 7, carbos: 60 },
      { id: 'r2', fecha: FECHA, momento: 'cena', descripcion: 'Salmón', kcal: 400, proteina: 40, grasa: 25, carbos: 0 },
    ])

    pintar()

    expect(await screen.findByText('Avena')).toBeDefined()
    expect(screen.getByText('Salmón')).toBeDefined()

    await usuario.click(screen.getByText('Avena'))
    await usuario.click(await screen.findByRole('button', { name: 'Borrar' }))
    await usuario.click(await screen.findByRole('button', { name: 'Sí, borrar' }))

    await waitFor(async () => expect(await db.registros_comida.count()).toBe(1))
    expect((await db.registros_comida.toArray())[0].descripcion).toBe('Salmón')
  })

  it('la tarjeta de entreno solo sale en día de entreno', async () => {
    await guardarDelServidor('dias', [{ id: 'd1', fecha: FECHA, tipo: 'descanso' }])
    const { unmount } = pintar()
    await waitFor(() => expect(screen.queryByText('Empezar entreno')).toBeNull())
    unmount()

    await db.dias.clear()
    await guardarDelServidor('dias', [{ id: 'd2', fecha: FECHA, tipo: 'entreno' }])
    pintar()
    expect(await screen.findByText('Empezar entreno')).toBeDefined()
  })
})
