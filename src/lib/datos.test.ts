import { beforeEach, describe, expect, it } from 'vitest'
import { borrar, guardar, guardarDelServidor, paraServidor } from './datos'
import { db } from './db'

async function cola() {
  return db.cola.orderBy('id').toArray()
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('guardar', () => {
  it('escribe en local y encola una sola operación', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11', nombre_dia: 'Día A' })

    expect(await db.sesiones.get(id)).toMatchObject({ fecha: '2026-09-11' })

    const ops = await cola()
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ tabla: 'sesiones', fila_id: id, tipo: 'guardar' })
  })

  it('genera el uuid en el cliente y respeta el que se le pase', async () => {
    const mio = crypto.randomUUID()
    expect(await guardar('sesiones', { id: mio, fecha: '2026-09-11' })).toBe(mio)
  })

  it('fusiona los cambios sobre la fila existente sin borrar el resto', async () => {
    const id = await guardar('series', {
      sesion_id: 'x',
      ejercicio_id: 'y',
      numero: 1,
      peso_kg: 80,
      reps: 8,
      tipo: 'normal',
    })

    await guardar('series', { id, peso_kg: 82.5 })

    expect(await db.series.get(id)).toMatchObject({ peso_kg: 82.5, reps: 8, numero: 1 })
  })
})

describe('fusión de la cola', () => {
  it('cinco correcciones de la misma serie dejan una sola operación', async () => {
    const id = await guardar('series', {
      sesion_id: 'x',
      ejercicio_id: 'y',
      numero: 1,
      peso_kg: 80,
    })
    for (const peso of [82.5, 85, 87.5, 90]) await guardar('series', { id, peso_kg: peso })

    const ops = await cola()
    expect(ops).toHaveLength(1)
    expect(ops[0].datos).toMatchObject({ peso_kg: 90 })
  })

  it('mantiene el puesto en la cola al fusionar, para no romper claves ajenas', async () => {
    const sesion = await guardar('sesiones', { fecha: '2026-09-11' })
    const serie = await guardar('series', { sesion_id: sesion, ejercicio_id: 'y', numero: 1 })

    // Editar la sesión después no puede empujarla detrás de sus series: el
    // servidor rechazaría la serie por apuntar a una sesión inexistente.
    await guardar('sesiones', { id: sesion, notas: 'flojo' })

    expect((await cola()).map((o) => o.fila_id)).toEqual([sesion, serie])
  })

  it('reinicia los reintentos al fusionar contenido nuevo', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11' })
    await db.cola.where('fila_id').equals(id).modify({
      intentos: 4,
      proximo_intento: Date.now() + 60_000,
      ultimo_error: 'boom',
    })

    await guardar('sesiones', { id, notas: 'otra cosa' })

    expect((await cola())[0]).toMatchObject({ intentos: 0, proximo_intento: 0, ultimo_error: null })
  })
})

describe('borrar', () => {
  it('cancela el envío de una fila que el servidor no conoce', async () => {
    const id = await guardar('registros_comida', {
      fecha: '2026-09-11',
      momento: 'cena',
      descripcion: 'pizza',
      kcal: 900,
      proteina: 35,
      grasa: 40,
      carbos: 95,
    })

    await borrar('registros_comida', id)

    expect(await db.registros_comida.get(id)).toBeUndefined()
    // Nada que enviar: pedirle al servidor que borre algo que nunca recibió
    // sería una operación condenada a fallar.
    expect(await cola()).toHaveLength(0)
  })

  it('encola el borrado de una fila que el servidor sí conoce', async () => {
    const id = crypto.randomUUID()
    await guardarDelServidor('registros_comida', [
      { id, fecha: '2026-09-11', momento: 'cena', descripcion: 'pizza', kcal: 900 },
    ])

    await borrar('registros_comida', id)

    const ops = await cola()
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ tipo: 'borrar', fila_id: id, datos: null })
  })

  it('borra en cascada las series de una sesión y cancela sus envíos', async () => {
    const sesion = crypto.randomUUID()
    await guardarDelServidor('sesiones', [{ id: sesion, fecha: '2026-09-11' }])

    const serieA = await guardar('series', { sesion_id: sesion, ejercicio_id: 'e', numero: 1 })
    const serieB = await guardar('series', { sesion_id: sesion, ejercicio_id: 'e', numero: 2 })

    await borrar('sesiones', sesion)

    expect(await db.series.get(serieA)).toBeUndefined()
    expect(await db.series.get(serieB)).toBeUndefined()

    // Solo el borrado de la sesión: la cascada del servidor se lleva las
    // series. Y los inserts de las series se cancelan, o llegarían después del
    // borrado y crearían filas huérfanas.
    const ops = await cola()
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ tabla: 'sesiones', tipo: 'borrar' })
  })

  it('encadena la cascada hasta los nietos', async () => {
    const rutina = crypto.randomUUID()
    const dia = crypto.randomUUID()
    await guardarDelServidor('rutinas', [{ id: rutina, nombre: 'Fuerza', activa: true }])
    await guardarDelServidor('rutina_dias', [{ id: dia, rutina_id: rutina, nombre: 'A', orden: 0 }])
    const ejercicioEnDia = await guardar('rutina_ejercicios', {
      dia_id: dia,
      ejercicio_id: 'e',
      orden: 0,
    })

    await borrar('rutinas', rutina)

    expect(await db.rutina_dias.get(dia)).toBeUndefined()
    expect(await db.rutina_ejercicios.get(ejercicioEnDia)).toBeUndefined()
  })

  it('deja el histórico en pie y pone la referencia a null, como el servidor', async () => {
    const dia = crypto.randomUUID()
    await guardarDelServidor('rutina_dias', [
      { id: dia, rutina_id: 'r', nombre: 'Día A — Empuje', orden: 0 },
    ])
    const sesion = crypto.randomUUID()
    await guardarDelServidor('sesiones', [
      { id: sesion, dia_id: dia, nombre_dia: 'Día A — Empuje', fecha: '2026-09-01' },
    ])

    await borrar('rutina_dias', dia)

    // Reescribir una rutina no puede llevarse por delante lo ya entrenado.
    expect(await db.sesiones.get(sesion)).toMatchObject({
      dia_id: null,
      nombre_dia: 'Día A — Empuje',
    })
  })
})

describe('guardarDelServidor', () => {
  it('no pisa una fila con cambios sin enviar, pero sí las demás', async () => {
    const pendiente = await guardar('medidas_corporales', {
      fecha: '2026-09-11',
      peso_kg: 78.4,
    })
    const otra = crypto.randomUUID()

    await guardarDelServidor('medidas_corporales', [
      { id: pendiente, fecha: '2026-09-11', peso_kg: 99, updated_at: '2026-09-11T10:00:00Z' },
      { id: otra, fecha: '2026-09-10', peso_kg: 78.9, updated_at: '2026-09-10T10:00:00Z' },
    ])

    // Lo local está a punto de subir y es la última escritura: gana.
    expect(await db.medidas_corporales.get(pendiente)).toMatchObject({ peso_kg: 78.4 })
    // Y el filtro no puede convertirse en "no escribo nada".
    expect(await db.medidas_corporales.get(otra)).toMatchObject({ peso_kg: 78.9 })
  })

  it('marca como conocidas por el servidor las filas descargadas', async () => {
    const id = crypto.randomUUID()
    await guardarDelServidor('alimentos', [{ id, nombre: 'Pollo', kcal_100g: 165 }])
    expect(await db.alimentos.get(id)).toMatchObject({ _enviado: true })
  })
})

describe('paraServidor', () => {
  it('quita las marcas locales y los relojes del servidor', () => {
    expect(
      paraServidor({
        id: 'a',
        peso_kg: 80,
        _enviado: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      }),
    ).toEqual({ id: 'a', peso_kg: 80 })
  })
})
