import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { guardar, guardarDelServidor } from './datos'
import { exportarTodo, nombreDeArchivo } from './exportar'
import { hoy } from './fechas'
import { TABLAS } from './tipos'

vi.mock('./senal', () => ({ pedirSincronizacion: () => {}, registrarSincronizador: () => {} }))

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('exportarTodo', () => {
  it('trae las catorce tablas, también las vacías', async () => {
    // Una exportación a la que le falten tablas no sirve de red de seguridad:
    // quien la lea no sabría si estaban vacías o si se perdieron.
    const exportacion = await exportarTodo()
    expect(Object.keys(exportacion.datos).sort()).toEqual([...TABLAS].sort())
  })

  it('quita las marcas internas de la base local', async () => {
    await guardarDelServidor('alimentos', [{ id: 'a', nombre: 'Pollo', kcal_100g: 165 }])
    const [alimento] = (await exportarTodo()).datos.alimentos as Record<string, unknown>[]

    expect(alimento).toHaveProperty('nombre', 'Pollo')
    expect(alimento).not.toHaveProperty('_enviado')
  })

  it('dice cuántos cambios quedaban sin enviar', async () => {
    // Exportar con la cola llena es válido —los datos están—, pero conviene
    // que el archivo lo diga.
    await guardar('medidas_corporales', { fecha: hoy(), peso_kg: 78 })
    expect((await exportarTodo()).pendientes_de_enviar).toBe(1)
  })

  it('el archivo lleva la fecha, para no pisar exportaciones anteriores', () => {
    expect(nombreDeArchivo()).toBe(`gym-${hoy()}.json`)
  })
})
