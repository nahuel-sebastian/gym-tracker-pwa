// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import { guardarDelServidor } from '../lib/datos'
import { hoy } from '../lib/fechas'
import Comida from './Comida'

// Las pantallas leen y escriben en IndexedDB, no en la red.
vi.mock('../lib/senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

const pollo = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Pechuga de pollo',
  marca: null,
  codigo_barras: null,
  kcal_100g: 165,
  proteina_100g: 31,
  grasa_100g: 3.6,
  carbos_100g: 0,
  fibra_100g: null,
  azucar_100g: null,
  sal_100g: null,
  porcion_defecto_g: 150,
  origen: 'manual',
  favorito: false,
  veces_usado: 3,
}

const arroz = { ...pollo, id: '22222222-2222-4222-8222-222222222222', nombre: 'Arroz blanco', kcal_100g: 130, proteina_100g: 2.7, grasa_100g: 0.3, carbos_100g: 28, porcion_defecto_g: 80, veces_usado: 9 }

function pintar(ruta = '/comida?momento=cena') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Comida />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await guardarDelServidor('alimentos', [pollo, arroz])
})

afterEach(cleanup)

describe('pantalla Comida', () => {
  it('ordena la biblioteca por uso, que es lo que hace el registro rápido', async () => {
    pintar()
    await waitFor(() => expect(screen.getByText('Arroz blanco')).toBeDefined())

    const nombres = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    const posArroz = nombres.findIndex((t) => t.includes('Arroz blanco'))
    const posPollo = nombres.findIndex((t) => t.includes('Pechuga de pollo'))
    expect(posArroz).toBeLessThan(posPollo)
  })

  it('busca ignorando acentos y mayúsculas', async () => {
    const usuario = userEvent.setup()
    pintar()
    await waitFor(() => expect(screen.getByText('Arroz blanco')).toBeDefined())

    await usuario.type(screen.getByPlaceholderText('Buscar en mi biblioteca'), 'PECHUGA')
    await waitFor(() => expect(screen.queryByText('Arroz blanco')).toBeNull())
    expect(screen.getByText('Pechuga de pollo')).toBeDefined()
  })

  it('registra en dos toques, con los macros congelados y el momento pedido', async () => {
    const usuario = userEvent.setup()
    pintar('/comida?momento=cena')
    await waitFor(() => expect(screen.getByText('Pechuga de pollo')).toBeDefined())

    // Toque 1: el alimento.
    await usuario.click(screen.getByText('Pechuga de pollo'))
    // Viene relleno con la porción habitual: 150 g.
    const cantidad = await screen.findByDisplayValue('150')
    expect(cantidad).toBeDefined()

    // Toque 2: confirmar.
    await usuario.click(screen.getByRole('button', { name: 'Añadir' }))

    await waitFor(async () => expect(await db.registros_comida.count()).toBe(1))
    const registro = (await db.registros_comida.toArray())[0]

    expect(registro).toMatchObject({
      fecha: hoy(),
      momento: 'cena',
      alimento_id: pollo.id,
      gramos: 150,
      kcal: 247.5,
      proteina: 46.5,
      grasa: 5.4,
      carbos: 0,
    })

    // Y sube el contador que ordena el buscador.
    expect((await db.alimentos.get(pollo.id))?.veces_usado).toBe(4)

    // Las dos escrituras están en la cola, ninguna se ha ido a la red.
    expect(await db.cola.count()).toBe(2)
  })

  it('acepta la coma decimal del teclado español', async () => {
    const usuario = userEvent.setup()
    pintar()
    await waitFor(() => expect(screen.getByText('Pechuga de pollo')).toBeDefined())
    await usuario.click(screen.getByText('Pechuga de pollo'))

    const cantidad = await screen.findByDisplayValue('150')
    await usuario.clear(cantidad)
    await usuario.type(cantidad, '182,5')
    await usuario.click(screen.getByRole('button', { name: 'Añadir' }))

    await waitFor(async () => expect(await db.registros_comida.count()).toBe(1))
    expect((await db.registros_comida.toArray())[0]).toMatchObject({
      gramos: 182.5,
      kcal: 301.13,
    })
  })

  it('da de alta un alimento y sigue directo a la cantidad', async () => {
    const usuario = userEvent.setup()
    pintar()
    await waitFor(() => expect(screen.getByText('Arroz blanco')).toBeDefined())

    await usuario.type(screen.getByPlaceholderText('Buscar en mi biblioteca'), 'Yogur griego')
    await usuario.click(screen.getByRole('button', { name: 'Crear «Yogur griego»' }))

    // El nombre viene de lo que se estaba buscando: no hay que teclearlo dos veces.
    const nombre = (await screen.findByLabelText('Nombre')) as HTMLInputElement
    expect(nombre.value).toBe('Yogur griego')

    await usuario.type(screen.getByLabelText('Kcal'), '97')
    await usuario.type(screen.getByLabelText('Proteína'), '9')
    await usuario.type(screen.getByLabelText('Grasa'), '5')
    await usuario.type(screen.getByLabelText('Carbohidratos'), '3.6')
    await usuario.click(screen.getByRole('button', { name: 'Guardar alimento' }))

    await waitFor(async () => expect(await db.alimentos.count()).toBe(3))
    // Y se abre la cantidad del recién creado, sin volver a buscarlo.
    expect(await screen.findByRole('button', { name: 'Añadir' })).toBeDefined()
  })

  it('marca un alimento como favorito desde la hoja de cantidad', async () => {
    const usuario = userEvent.setup()
    pintar()
    await usuario.click(await screen.findByText('Pechuga de pollo'))

    await usuario.click(await screen.findByLabelText('Marcar como favorito'))

    await waitFor(async () => expect((await db.alimentos.get(pollo.id))?.favorito).toBe(true))
    // Y la estrella lo refleja: la hoja lee la fila viva, no la copia que
    // recibió al abrirse.
    expect(await screen.findByLabelText('Quitar de favoritos')).toBeDefined()
  })

  it('los favoritos salen primero en el buscador', async () => {
    await db.alimentos.update(pollo.id, { favorito: true })
    pintar()

    await waitFor(() => expect(screen.getByText('Pechuga de pollo')).toBeDefined())
    const nombres = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    // El arroz tiene más usos, pero el favorito manda.
    expect(nombres.findIndex((t) => t.includes('Pechuga de pollo'))).toBeLessThan(
      nombres.findIndex((t) => t.includes('Arroz blanco')),
    )
  })

  it('corrige una ficha ya creada y vuelve a la cantidad', async () => {
    const usuario = userEvent.setup()
    pintar()
    await usuario.click(await screen.findByText('Pechuga de pollo'))

    await usuario.click(await screen.findByRole('button', { name: 'Editar ficha' }))

    const grasa = (await screen.findByLabelText('Grasa')) as HTMLInputElement
    expect(grasa.value).toBe('3,6')
    await usuario.clear(grasa)
    await usuario.type(grasa, '4,2')
    await usuario.click(screen.getByRole('button', { name: 'Guardar alimento' }))

    await waitFor(async () =>
      expect((await db.alimentos.get(pollo.id))?.grasa_100g).toBe(4.2),
    )
    // Corregir no reinicia el contador de uso ni pierde lo demás.
    expect(await db.alimentos.get(pollo.id)).toMatchObject({
      veces_usado: 3,
      nombre: 'Pechuga de pollo',
      porcion_defecto_g: 150,
    })
    // Y se vuelve a la cantidad, que es de donde se venía.
    expect(await screen.findByRole('button', { name: 'Añadir' })).toBeDefined()
  })

  it('avisa si los macros no cuadran con las kcal', async () => {
    const usuario = userEvent.setup()
    pintar()
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo alimento' }))

    await usuario.type(screen.getByLabelText('Nombre'), 'Aceite mal teclado')
    await usuario.type(screen.getByLabelText('Kcal'), '165')
    await usuario.type(screen.getByLabelText('Proteína'), '31')
    await usuario.type(screen.getByLabelText('Grasa'), '36')
    await usuario.type(screen.getByLabelText('Carbohidratos'), '0')

    // 3,6 de grasa teclado como 36: la etiqueta seguiría diciendo 165 kcal.
    expect(await screen.findByText(/Revísalo antes de guardar/)).toBeDefined()
  })

  it('registra una receta de un solo toque', async () => {
    const usuario = userEvent.setup()
    await guardarDelServidor('recetas', [
      { id: 'r1', nombre: 'Pollo con arroz', porciones: 2, notas: null },
    ])
    await guardarDelServidor('receta_ingredientes', [
      { id: 'i1', receta_id: 'r1', alimento_id: pollo.id, gramos: 400 },
      { id: 'i2', receta_id: 'r1', alimento_id: arroz.id, gramos: 600 },
    ])

    pintar('/comida?momento=cena')

    // Un toque: la receta entera, una porción, en el momento que toca.
    await usuario.click(await screen.findByText('Pollo con arroz'))

    await waitFor(async () => expect(await db.registros_comida.count()).toBe(1))
    expect((await db.registros_comida.toArray())[0]).toMatchObject({
      receta_id: 'r1',
      momento: 'cena',
      descripcion: 'Pollo con arroz',
      // (400 g de pollo + 600 g de arroz) / 2 porciones.
      kcal: 720,
      gramos: 500,
    })
    expect(await screen.findByText('Añadida')).toBeDefined()
  })

  it('duplicar el día anterior copia los macros tal como se registraron', async () => {
    const usuario = userEvent.setup()
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const fechaAyer = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`

    await guardarDelServidor('registros_comida', [
      {
        id: '33333333-3333-4333-8333-333333333333',
        fecha: fechaAyer,
        momento: 'cena',
        alimento_id: pollo.id,
        gramos: 200,
        kcal: 330,
        proteina: 62,
        grasa: 7.2,
        carbos: 0,
      },
    ])

    pintar()
    await usuario.click(await screen.findByRole('button', { name: 'Copiar lo de ayer' }))
    expect(await screen.findByText('1 comida copiada de ayer.')).toBeDefined()

    const deHoy = await db.registros_comida.where('fecha').equals(hoy()).toArray()
    // No se recalcula desde la ficha: se copia lo que se comió.
    expect(deHoy[0]).toMatchObject({ kcal: 330, proteina: 62, gramos: 200 })
  })
})
