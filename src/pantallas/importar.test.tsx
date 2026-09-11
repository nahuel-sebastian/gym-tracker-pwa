// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import { hoy, sumarDias } from '../lib/fechas'
import Importar from './Importar'

vi.mock('../lib/senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const JSON_CLAUDE = JSON.stringify({
  alimentos: [
    { nombre: 'Pechuga de pollo a la plancha', gramos: 180, kcal: 297, proteina: 55.8, grasa: 6.5, carbos: 0 },
    { nombre: 'Arroz blanco', gramos: 200, kcal: 260, proteina: 5.4, grasa: 0.6, carbos: 56 },
  ],
  momento: 'almuerzo',
})

function pintar() {
  return render(
    <MemoryRouter>
      <Importar />
    </MemoryRouter>,
  )
}

async function pegar(usuario: ReturnType<typeof userEvent.setup>, texto: string) {
  const campo = screen.getByLabelText('JSON de la comida')
  await usuario.click(campo)
  await usuario.paste(texto)
  await usuario.click(screen.getByRole('button', { name: 'Interpretar' }))
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

afterEach(cleanup)

describe('importar macros', () => {
  it('enseña una vista previa con el total antes de guardar nada', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, JSON_CLAUDE)

    expect(await screen.findByText('2 alimentos')).toBeDefined()
    // 297 + 260 kcal, y los macros sumados.
    expect(screen.getByText(/557 kcal/)).toBeDefined()
    expect(screen.getByText(/P 61,2/)).toBeDefined()
    // Nada tocado todavía.
    expect(await db.registros_comida.count()).toBe(0)
  })

  it('respeta el momento que viene en el JSON', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, JSON_CLAUDE)

    expect(await screen.findByRole('button', { name: /Añadir a almuerzo de hoy/ })).toBeDefined()
  })

  it('deja corregir la estimación antes de confirmar', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, JSON_CLAUDE)

    // Lo que llega es una estimación de un modelo: 180 g de pollo pueden ser 150.
    const gramos = (await screen.findAllByLabelText('Gramos'))[0] as HTMLInputElement
    await usuario.clear(gramos)
    await usuario.type(gramos, '150')

    const kcal = (screen.getAllByLabelText('Kcal')[0]) as HTMLInputElement
    await usuario.clear(kcal)
    await usuario.type(kcal, '248')

    await usuario.click(screen.getByRole('button', { name: /Añadir a almuerzo/ }))

    await waitFor(async () => expect(await db.registros_comida.count()).toBe(2))
    const pollo = (await db.registros_comida.toArray()).find((r) =>
      r.descripcion?.includes('Pechuga'),
    )
    expect(pollo).toMatchObject({ gramos: 150, kcal: 248, fecha: hoy(), momento: 'almuerzo' })
  })

  it('quita un alimento que sobra del plato', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, JSON_CLAUDE)

    await usuario.click(await screen.findByLabelText('Quitar Arroz blanco'))
    expect(await screen.findByText('1 alimento')).toBeDefined()

    await usuario.click(screen.getByRole('button', { name: /Añadir a almuerzo/ }))
    await waitFor(async () => expect(await db.registros_comida.count()).toBe(1))
  })

  it('pasa los alimentos a la biblioteca con los valores por 100 g', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, JSON_CLAUDE)
    await usuario.click(await screen.findByRole('button', { name: /Añadir a almuerzo/ }))

    await waitFor(async () => expect(await db.alimentos.count()).toBe(2))
    const pollo = (await db.alimentos.toArray()).find((a) => a.nombre.includes('Pechuga'))

    // 297 kcal en 180 g son 165 por cada 100.
    expect(pollo).toMatchObject({
      kcal_100g: 165,
      proteina_100g: 31,
      porcion_defecto_g: 180,
      origen: 'importado',
    })
  })

  it('un alimento sin gramos se registra igual, pero no va a la biblioteca', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(
      usuario,
      '{"alimentos":[{"nombre":"Salsa de la casa","kcal":90,"proteina":1,"grasa":8,"carbos":3}]}',
    )

    // Sin el peso servido no hay forma de saber a cuánto equivale por 100 g.
    expect(await screen.findByText(/no trae gramos/)).toBeDefined()

    await usuario.click(screen.getByRole('button', { name: /Añadir a/ }))
    await waitFor(async () => expect(await db.registros_comida.count()).toBe(1))
    expect(await db.alimentos.count()).toBe(0)
    expect((await db.registros_comida.toArray())[0].alimento_id).toBeNull()
  })

  it('registra en ayer si se le pide', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, JSON_CLAUDE)

    await usuario.click(await screen.findByRole('radio', { name: 'Ayer' }))
    await usuario.click(screen.getByRole('button', { name: /de ayer/ }))

    await waitFor(async () => expect(await db.registros_comida.count()).toBe(2))
    expect((await db.registros_comida.toArray())[0].fecha).toBe(sumarDias(hoy(), -1))
  })

  it('explica el error sin perder lo pegado', async () => {
    const usuario = userEvent.setup()
    pintar()
    await pegar(usuario, '{"alimentos":[{"nombre":"Salmón","kcal":300,"proteina":30,"carbos":0}]}')

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('grasa'),
    )
    // El texto sigue en el campo para poder arreglarlo.
    expect((screen.getByLabelText('JSON de la comida') as HTMLTextAreaElement).value).toContain(
      'Salmón',
    )
    expect(screen.queryByRole('button', { name: /Añadir a/ })).toBeNull()
  })
})
