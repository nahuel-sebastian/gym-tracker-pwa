import { db, escribirMeta, leerMeta } from './db'
import type { Operacion } from './db'
import { registrarSincronizador } from './senal'
import { supabase } from './supabase'
import { descargar } from './descarga'

/**
 * Vaciado de la cola de escrituras contra Supabase.
 *
 * Reglas que gobiernan este archivo:
 *
 *  · **Orden estricto.** Las operaciones se envían de la más antigua a la más
 *    nueva y una que falla detiene el vaciado. Ese orden es lo único que
 *    garantiza que una sesión llegue antes que sus series; adelantar la
 *    siguiente operación rompería la clave ajena.
 *  · **Reintentos con retroceso exponencial** para los fallos de red o de
 *    servidor, que son temporales.
 *  · **Los fallos definitivos se apartan.** Una restricción incumplida no se
 *    va a arreglar reintentando, y dejarla al frente de la cola bloquearía
 *    para siempre todo lo que venga detrás. Se mueve a `fallidas` y se enseña
 *    como error de sincronización.
 *  · **Idempotencia.** El envío es un upsert por `id` (que genera el cliente),
 *    así que reintentar una operación que en realidad sí llegó no duplica
 *    nada. Está verificado contra la base real.
 */

export type FaseSync = 'inactivo' | 'sincronizando' | 'pendiente' | 'error' | 'sin_conexion'

export type EstadoSync = {
  fase: FaseSync
  pendientes: number
  fallidas: number
  ultimoError: string | null
  ultimaSync: number | null
}

const MAX_INTENTOS = 10
const ESPERA_BASE_MS = 2_000
const ESPERA_MAX_MS = 5 * 60_000

// -----------------------------------------------------------------------------
// Estado observable
// -----------------------------------------------------------------------------

let estado: EstadoSync = {
  fase: 'inactivo',
  pendientes: 0,
  fallidas: 0,
  ultimoError: null,
  ultimaSync: null,
}

const oyentes = new Set<() => void>()

export function suscribirse(fn: () => void): () => void {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function leerEstado(): EstadoSync {
  return estado
}

function actualizar(cambios: Partial<EstadoSync>): void {
  const siguiente = { ...estado, ...cambios }
  // useSyncExternalStore compara por identidad: si nada cambió, no se notifica
  // y React no vuelve a pintar.
  if (
    siguiente.fase === estado.fase &&
    siguiente.pendientes === estado.pendientes &&
    siguiente.fallidas === estado.fallidas &&
    siguiente.ultimoError === estado.ultimoError &&
    siguiente.ultimaSync === estado.ultimaSync
  ) {
    return
  }
  estado = siguiente
  for (const fn of oyentes) fn()
}

async function recontar(): Promise<{ pendientes: number; fallidas: number }> {
  const [pendientes, fallidas] = await Promise.all([db.cola.count(), db.fallidas.count()])
  return { pendientes, fallidas }
}

// -----------------------------------------------------------------------------
// Clasificación de errores
// -----------------------------------------------------------------------------

type ErrorEnvio = { message: string; code?: string }

/**
 * Un error definitivo no mejora reintentando: la fila incumple una
 * restricción, apunta a algo que no existe, o el rol no tiene permiso.
 *
 * Los códigos son de Postgres: 22 datos inválidos, 23 integridad
 * (clave ajena, unicidad, check), 42 permisos y sintaxis (42501 es RLS).
 * PostgREST añade los suyos con prefijo `PGRST`.
 */
function esDefinitivo(error: ErrorEnvio): boolean {
  const code = error.code ?? ''
  if (/^(22|23|42)/.test(code)) return true
  if (code.startsWith('PGRST')) return true
  return false
}

/**
 * Un fallo de transporte: no llegó a haber respuesta del servidor, o la que
 * hubo no dice nada de la fila. Se reintenta indefinidamente, sin que cuente
 * para el límite que descarta la operación: una sesión entera registrada en un
 * sótano no se puede tirar porque haya tardado veinte minutos en salir.
 *
 * supabase-js atrapa el fallo de `fetch` y devuelve un error **sin código** de
 * Postgres, así que la ausencia de código es la señal. Los códigos 08 (fallo
 * de conexión), 53 (recursos agotados), 57 y 58 son del servidor y también se
 * arreglan solos.
 */
function esFalloDeTransporte(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (!navigator.onLine) return true

  const code = (error as ErrorEnvio)?.code ?? ''
  if (!code) return true
  if (/^(08|53|57|58)/.test(code)) return true
  if (code === '429' || /^5\d\d$/.test(code)) return true
  return false
}

function espera(intentos: number): number {
  const bruto = Math.min(ESPERA_BASE_MS * 2 ** intentos, ESPERA_MAX_MS)
  // Jitter: si vuelve la cobertura, no todas las operaciones salen a la vez.
  return Math.round(bruto * (0.8 + Math.random() * 0.4))
}

// -----------------------------------------------------------------------------
// Envío de una operación
// -----------------------------------------------------------------------------

async function enviar(op: Operacion): Promise<void> {
  if (op.tipo === 'borrar') {
    const { error } = await supabase.from(op.tabla).delete().eq('id', op.fila_id)
    if (error) throw error
    return
  }

  // Upsert por id: supabase-js manda `Prefer: resolution=merge-duplicates`, así
  // que reenviar la misma fila la actualiza en vez de chocar con la clave.
  const { error } = await supabase
    .from(op.tabla)
    .upsert(op.datos as Record<string, unknown>, { onConflict: 'id' })
  if (error) throw error

  await db.table(op.tabla).where('id').equals(op.fila_id).modify({ _enviado: true })
}

async function apartar(op: Operacion, fallo: string): Promise<void> {
  await db.transaction('rw', ['cola', 'fallidas'], async () => {
    await db.fallidas.add({ ...op, id: undefined, fallo, fallado_en: Date.now() })
    if (op.id !== undefined) await db.cola.delete(op.id)
  })
}

// -----------------------------------------------------------------------------
// Bucle de vaciado
// -----------------------------------------------------------------------------

let enMarcha = false
let repetir = false
let temporizador: ReturnType<typeof setTimeout> | null = null

function programar(ms: number): void {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    temporizador = null
    void vaciar()
  }, ms)
}

async function vaciar(): Promise<void> {
  if (enMarcha) {
    // Otra llamada está dentro: se anota para repasar la cola al terminar, por
    // si lo que se acaba de encolar entró después de leerla.
    repetir = true
    return
  }

  enMarcha = true
  try {
    do {
      repetir = false
      await unaPasada()
    } while (repetir)
  } finally {
    enMarcha = false
  }
}

async function unaPasada(): Promise<void> {
  const cuentas = await recontar()

  if (!cuentas.pendientes) {
    actualizar({
      ...cuentas,
      fase: cuentas.fallidas ? 'error' : 'inactivo',
      ultimaSync: Date.now(),
    })
    return
  }

  if (!navigator.onLine) {
    actualizar({ ...cuentas, fase: 'sin_conexion' })
    return
  }

  actualizar({ ...cuentas, fase: 'sincronizando' })

  for (;;) {
    const op = await db.cola.orderBy('id').first()
    if (!op) break

    const ahora = Date.now()
    if (op.proximo_intento > ahora) {
      // La cabeza de la cola aún espera su turno. No se adelanta la siguiente:
      // el orden es lo que sostiene las claves ajenas.
      programar(op.proximo_intento - ahora)
      actualizar({ ...(await recontar()), fase: 'pendiente' })
      return
    }

    try {
      await enviar(op)
      if (op.id !== undefined) await db.cola.delete(op.id)
    } catch (error) {
      const err = error as ErrorEnvio
      const mensaje = err?.message ?? String(error)

      const transporte = esFalloDeTransporte(error)
      const intentos = op.intentos + 1

      // Se aparta solo lo que reintentar no puede arreglar. Un fallo de
      // transporte nunca se descarta, por muchas veces que se repita.
      if (!transporte && (esDefinitivo(err) || intentos >= MAX_INTENTOS)) {
        await apartar(op, mensaje)
        actualizar({ ...(await recontar()), fase: 'error', ultimoError: mensaje })
        // Se sigue con la siguiente: la cola no puede quedar atascada detrás de
        // un envío imposible.
        continue
      }

      const demora = espera(intentos)
      await db.cola.update(op.id!, {
        intentos,
        proximo_intento: Date.now() + demora,
        ultimo_error: mensaje,
      })
      actualizar({
        ...(await recontar()),
        fase: navigator.onLine ? 'pendiente' : 'sin_conexion',
        // Un corte de red no es un error que merezca alarmar al usuario: el
        // punto ámbar de la cabecera ya dice que queda algo por enviar.
        ultimoError: transporte ? null : mensaje,
      })
      programar(demora)
      // No se adelanta la siguiente operación: el orden sostiene las claves
      // ajenas (la sesión antes que sus series).
      return
    }
  }

  const finales = await recontar()
  actualizar({
    ...finales,
    fase: finales.fallidas ? 'error' : 'inactivo',
    ultimoError: finales.fallidas ? estado.ultimoError : null,
    ultimaSync: Date.now(),
  })
}

// -----------------------------------------------------------------------------
// Arranque
// -----------------------------------------------------------------------------

/**
 * Disparadores de sincronización. Son funciones de módulo, con identidad
 * estable, para que `addEventListener` sea idempotente: en desarrollo React
 * monta, desmonta y vuelve a montar, y con funciones nuevas en cada llamada la
 * app acabaría sin ningún listener o con varios.
 */
function alRecuperarLaRed(): void {
  void vaciar()
  void descargarSiToca()
}

function alPerderLaRed(): void {
  void vaciar()
}

function alVolverAlFrente(): void {
  if (document.visibilityState === 'visible') alRecuperarLaRed()
}

/**
 * Pone en marcha la sincronización para el usuario autenticado.
 *
 * Antes de nada comprueba de quién son los datos locales: si son de otra
 * cuenta, se borran. Es la única defensa contra ver el diario de otro usuario
 * tras un cambio de sesión, porque IndexedDB sobrevive al `signOut`.
 */
export async function arrancarSincronizacion(idUsuario: string): Promise<() => void> {
  const dueno = await leerMeta<string>('usuario')
  if (dueno && dueno !== idUsuario) {
    await Promise.all(db.tables.map((t) => t.clear()))
  }
  await escribirMeta('usuario', idUsuario)

  registrarSincronizador(() => void vaciar())

  window.addEventListener('online', alRecuperarLaRed)
  window.addEventListener('offline', alPerderLaRed)
  document.addEventListener('visibilitychange', alVolverAlFrente)

  void primeraCarga()

  return () => {
    window.removeEventListener('online', alRecuperarLaRed)
    window.removeEventListener('offline', alPerderLaRed)
    document.removeEventListener('visibilitychange', alVolverAlFrente)
  }
}

async function primeraCarga(): Promise<void> {
  await vaciar()
  await descargarSiToca()
}

const MS_ENTRE_DESCARGAS = 60_000
let ultimaDescarga = 0

/**
 * Descarga los cambios del servidor, como mucho una vez por minuto. Se llama al
 * arrancar, al recuperar la conexión y al volver a poner la app en primer
 * plano; sin el freno, alternar de app dispararía una descarga por cada vuelta.
 */
export async function descargarSiToca(forzar = false): Promise<void> {
  if (!navigator.onLine) return
  if (!forzar && Date.now() - ultimaDescarga < MS_ENTRE_DESCARGAS) return
  ultimaDescarga = Date.now()

  try {
    await descargar()
    actualizar({ ultimaSync: Date.now() })
  } catch (error) {
    // Una descarga fallida no es un error que deba enseñarse: los datos
    // locales siguen siendo válidos y se reintentará en la próxima ocasión.
    ultimaDescarga = 0
    if (import.meta.env.DEV) console.warn('Descarga fallida', error)
  }
}

/** Reintenta las operaciones apartadas. Se ofrece desde Ajustes. */
export async function reintentarFallidas(): Promise<void> {
  await db.transaction('rw', ['cola', 'fallidas'], async () => {
    const fallidas = await db.fallidas.orderBy('id').toArray()
    for (const f of fallidas) {
      await db.cola.add({
        tabla: f.tabla,
        fila_id: f.fila_id,
        tipo: f.tipo,
        datos: f.datos,
        intentos: 0,
        proximo_intento: 0,
        ultimo_error: null,
        creado: f.creado,
      })
    }
    await db.fallidas.clear()
  })
  actualizar({ ultimoError: null })
  await vaciar()
}

/** Descarta las operaciones apartadas. Pierde esos cambios, y lo dice. */
export async function descartarFallidas(): Promise<void> {
  await db.fallidas.clear()
  actualizar({ ...(await recontar()), fase: 'inactivo', ultimoError: null })
}

export { vaciar as sincronizarAhora }

/** Cierra la sesión y borra la base local, en ese orden. */
export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut()
  await Promise.all(db.tables.map((t) => t.clear()))
  ultimaDescarga = 0
  actualizar({
    fase: 'inactivo',
    pendientes: 0,
    fallidas: 0,
    ultimoError: null,
    ultimaSync: null,
  })
}
