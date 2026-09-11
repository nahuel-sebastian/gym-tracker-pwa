import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { borrar, guardar, guardarDelServidor } from './datos'
import { db } from './db'

// -----------------------------------------------------------------------------
// Doble de Supabase: registra las llamadas y permite inyectar el error que
// devolvería el servidor en cada una.
// -----------------------------------------------------------------------------

type Llamada = { tipo: 'upsert' | 'delete'; tabla: string; datos: unknown }

const llamadas: Llamada[] = []
let responder: (l: Llamada) => unknown = () => null

vi.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => ({
      upsert: async (datos: unknown) => {
        const l: Llamada = { tipo: 'upsert', tabla, datos }
        llamadas.push(l)
        return respuesta(l)
      },
      delete: () => ({
        eq: async (columna: string, valor: unknown) => {
          const l: Llamada = { tipo: 'delete', tabla, datos: { [columna]: valor } }
          llamadas.push(l)
          return respuesta(l)
        },
      }),
    }),
    auth: { signOut: async () => ({ error: null }) },
  },
}))

// La descarga no es lo que se prueba aquí.
vi.mock('./descarga', () => ({ descargar: async () => {} }))

function respuesta(l: Llamada) {
  const error = responder(l)
  if (error instanceof Error) throw error
  return { error: error ?? null }
}

const { sincronizarAhora, leerEstado, reintentarFallidas } = await import('./sincronizacion')

function conexion(enLinea: boolean) {
  ;(globalThis as { __enLinea?: boolean }).__enLinea = enLinea
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  llamadas.length = 0
  responder = () => null
  conexion(true)
  // Solo setTimeout: Dexie y fake-indexeddb avanzan con microtareas, y fingir
  // esas colgaría los tests.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('vaciado de la cola', () => {
  it('envía en orden de encolado, para que la sesión llegue antes que sus series', async () => {
    const sesion = await guardar('sesiones', { fecha: '2026-09-11' })
    await guardar('series', { sesion_id: sesion, ejercicio_id: 'e', numero: 1 })
    await guardar('series', { sesion_id: sesion, ejercicio_id: 'e', numero: 2 })

    await sincronizarAhora()

    expect(llamadas.map((l) => l.tabla)).toEqual(['sesiones', 'series', 'series'])
    expect(await db.cola.count()).toBe(0)
    expect(leerEstado()).toMatchObject({ fase: 'inactivo', pendientes: 0 })
  })

  it('no envía user_id ni los relojes del servidor', async () => {
    await guardar('medidas_corporales', { fecha: '2026-09-11', peso_kg: 78.4 })
    await sincronizarAhora()

    expect(llamadas[0].datos).toEqual({
      id: expect.any(String),
      fecha: '2026-09-11',
      peso_kg: 78.4,
    })
  })

  it('marca la fila como conocida por el servidor al subirla', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11' })
    await sincronizarAhora()

    expect(await db.sesiones.get(id)).toMatchObject({ _enviado: true })
  })

  it('borra por id', async () => {
    const id = crypto.randomUUID()
    await guardarDelServidor('sesiones', [{ id, fecha: '2026-09-11' }])
    await borrar('sesiones', id)

    await sincronizarAhora()

    expect(llamadas).toEqual([{ tipo: 'delete', tabla: 'sesiones', datos: { id } }])
    expect(await db.cola.count()).toBe(0)
  })

  it('sin conexión no intenta nada y lo dice', async () => {
    conexion(false)
    await guardar('sesiones', { fecha: '2026-09-11' })

    await sincronizarAhora()

    expect(llamadas).toHaveLength(0)
    expect(leerEstado()).toMatchObject({ fase: 'sin_conexion', pendientes: 1 })
  })
})

describe('reintentos', () => {
  it('un fallo de red deja la operación en cola y espera antes de reintentar', async () => {
    await guardar('sesiones', { fecha: '2026-09-11' })
    responder = () => ({ message: 'TypeError: fetch failed', code: '' })

    const antes = Date.now()
    await sincronizarAhora()

    const op = await db.cola.orderBy('id').first()
    expect(op).toMatchObject({ intentos: 1 })
    expect(op!.proximo_intento).toBeGreaterThan(antes)
    // Un corte de red no se enseña como error: solo queda pendiente.
    expect(leerEstado()).toMatchObject({ fase: 'pendiente', ultimoError: null })
  })

  it('no adelanta la siguiente operación mientras la primera espera turno', async () => {
    await guardar('sesiones', { fecha: '2026-09-11' })
    await guardar('series', { sesion_id: 'x', ejercicio_id: 'e', numero: 1 })
    responder = (l) => (l.tabla === 'sesiones' ? { message: 'timeout', code: '' } : null)

    await sincronizarAhora()

    // Mandar la serie sin su sesión sería una clave ajena rota en el servidor.
    expect(llamadas.map((l) => l.tabla)).toEqual(['sesiones'])
    expect(await db.cola.count()).toBe(2)
  })

  it('un fallo de red no descarta nunca, ni tras muchos intentos', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11' })
    responder = () => ({ message: 'fetch failed', code: '' })

    for (let i = 0; i < 30; i++) {
      await db.cola.where('fila_id').equals(id).modify({ proximo_intento: 0 })
      await sincronizarAhora()
    }

    // Una sesión registrada en un sótano no se tira por llevar rato sin salir.
    expect(await db.cola.count()).toBe(1)
    expect(await db.fallidas.count()).toBe(0)
  })

  it('reintenta los errores 5xx del servidor sin gastar el límite', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11' })
    responder = () => ({ message: 'Bad gateway', code: '502' })

    for (let i = 0; i < 15; i++) {
      await db.cola.where('fila_id').equals(id).modify({ proximo_intento: 0 })
      await sincronizarAhora()
    }

    expect(await db.cola.count()).toBe(1)
  })

  it('reenviar una operación que sí había llegado no duplica nada', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11' })
    responder = () => ({ message: 'fetch failed', code: '' })
    await sincronizarAhora()

    responder = () => null
    await db.cola.where('fila_id').equals(id).modify({ proximo_intento: 0 })
    await sincronizarAhora()

    // El upsert va por el id que generó el cliente: dos envíos, una fila.
    expect(llamadas.filter((l) => l.tipo === 'upsert')).toHaveLength(2)
    expect(new Set(llamadas.map((l) => (l.datos as { id: string }).id)).size).toBe(1)
  })
})

describe('fallos definitivos', () => {
  it('aparta la operación imposible y sigue con el resto de la cola', async () => {
    await guardar('series', { sesion_id: 'inexistente', ejercicio_id: 'e', numero: 1 })
    await guardar('medidas_corporales', { fecha: '2026-09-11', peso_kg: 78.4 })

    responder = (l) =>
      l.tabla === 'series'
        ? { message: 'insert or update on table "series" violates foreign key constraint', code: '23503' }
        : null

    await sincronizarAhora()

    // Lo importante: el peso de hoy se guarda igual. Una fila condenada no
    // puede bloquear para siempre lo que venga detrás.
    expect(llamadas.map((l) => l.tabla)).toEqual(['series', 'medidas_corporales'])
    expect(await db.cola.count()).toBe(0)
    expect(await db.fallidas.count()).toBe(1)
    expect(leerEstado()).toMatchObject({ fase: 'error', fallidas: 1 })
  })

  it('trata como definitivo el rechazo de RLS', async () => {
    await guardar('sesiones', { fecha: '2026-09-11' })
    responder = () => ({ message: 'permission denied for table sesiones', code: '42501' })

    await sincronizarAhora()

    expect(await db.fallidas.count()).toBe(1)
  })

  it('aparta tras diez intentos un error de servidor que no cede', async () => {
    const id = await guardar('sesiones', { fecha: '2026-09-11' })
    responder = () => ({ message: 'algo raro', code: '99999' })

    for (let i = 0; i < 12; i++) {
      await db.cola.where('fila_id').equals(id).modify({ proximo_intento: 0 })
      await sincronizarAhora()
    }

    expect(await db.cola.count()).toBe(0)
    expect(await db.fallidas.count()).toBe(1)
  })

  it('reintentarFallidas las devuelve a la cola en su orden', async () => {
    await guardar('sesiones', { fecha: '2026-09-11' })
    await guardar('sesiones', { fecha: '2026-09-12' })
    responder = () => ({ message: 'violates check constraint', code: '23514' })
    await sincronizarAhora()
    expect(await db.fallidas.count()).toBe(2)

    llamadas.length = 0
    responder = () => null
    await reintentarFallidas()

    expect(llamadas.map((l) => (l.datos as { fecha: string }).fecha)).toEqual([
      '2026-09-11',
      '2026-09-12',
    ])
    expect(await db.fallidas.count()).toBe(0)
    expect(leerEstado()).toMatchObject({ fase: 'inactivo', pendientes: 0 })
  })
})
