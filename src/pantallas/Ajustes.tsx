import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import BloqueInstrucciones from '../componentes/BloqueInstrucciones'
import BloqueObjetivos from '../componentes/BloqueObjetivos'
import { db, type OperacionFallida } from '../lib/db'
import { descargar as descargarDelServidor } from '../lib/descarga'
import { useHoy } from '../lib/consultas'
import { descargar, exportarTodo, nombreDeArchivo } from '../lib/exportar'
import { useSesion } from '../lib/sesion'
import {
  cerrarSesion,
  descartarFallidas,
  reintentarFallidas,
  sincronizarAhora,
} from '../lib/sincronizacion'
import { useSync } from '../lib/useSync'

export default function Ajustes() {
  const { sesion } = useSesion()
  const fecha = useHoy()

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-borde bg-superficie p-4">
        <h2 className="text-base font-semibold">Cuenta</h2>
        <p className="mt-1 text-sm text-tenue">{sesion?.user.email}</p>
        <button
          onClick={() => void cerrarSesion()}
          className="mt-3 min-h-11 w-full rounded-xl border border-borde font-medium text-red-500 active:bg-fondo"
        >
          Cerrar sesión
        </button>
        <p className="mt-2 text-xs text-tenue">
          Al cerrar sesión se borra la copia local. Si queda algo por enviar, se
          pierde: espera a que el punto de la cabecera esté en verde.
        </p>
      </section>

      <BloqueObjetivos fecha={fecha} />

      <BloqueInstrucciones />

      <BloqueSincronizacion />

      <BloqueExportar />
    </div>
  )
}

function BloqueSincronizacion() {
  const { fase, pendientes, fallidas, ultimaSync } = useSync()
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const detalleFallidas =
    useLiveQuery(
      () =>
        fallidas
          ? db.fallidas.orderBy('id').limit(5).toArray()
          : Promise.resolve([] as OperacionFallida[]),
      [fallidas],
    ) ?? []

  async function correr(nombre: string, fn: () => Promise<unknown>) {
    setTrabajando(nombre)
    try {
      await fn()
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <section className="rounded-2xl border border-borde bg-superficie p-4">
      <h2 className="text-base font-semibold">Sincronización</h2>

      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-tenue">Estado</dt>
          <dd>{ETIQUETAS[fase]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-tenue">Por enviar</dt>
          <dd>{pendientes}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-tenue">Última vez</dt>
          <dd>{ultimaSync ? new Date(ultimaSync).toLocaleTimeString('es-ES') : '—'}</dd>
        </div>
      </dl>

      {fallidas > 0 && (
        <div className="mt-3 rounded-xl bg-red-500/10 p-3">
          <p className="text-sm font-medium text-red-500">
            {fallidas} {fallidas === 1 ? 'cambio' : 'cambios'} que el servidor rechazó
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-tenue">
            {detalleFallidas.map((f) => (
              <li key={f.id}>
                {f.tipo} en {f.tabla}: {f.fallo}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void correr('reintentar', reintentarFallidas)}
              disabled={trabajando !== null}
              className="min-h-11 flex-1 rounded-xl border border-borde text-sm font-medium disabled:opacity-50"
            >
              Reintentar
            </button>
            <button
              onClick={() => void correr('descartar', descartarFallidas)}
              disabled={trabajando !== null}
              className="min-h-11 flex-1 rounded-xl border border-borde text-sm font-medium text-red-500 disabled:opacity-50"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void correr('subir', sincronizarAhora)}
          disabled={trabajando !== null}
          className="min-h-11 flex-1 rounded-xl border border-borde text-sm font-medium disabled:opacity-50"
        >
          {trabajando === 'subir' ? 'Enviando…' : 'Enviar ahora'}
        </button>
        <button
          onClick={() => void correr('bajar', () => descargarDelServidor(true))}
          disabled={trabajando !== null}
          className="min-h-11 flex-1 rounded-xl border border-borde text-sm font-medium disabled:opacity-50"
        >
          {trabajando === 'bajar' ? 'Descargando…' : 'Recargar todo'}
        </button>
      </div>
      <p className="mt-2 text-xs text-tenue">
        "Recargar todo" vuelve a traer las catorce tablas desde el servidor. Es la
        reparación si la copia local quedara descuadrada.
      </p>
    </section>
  )
}

const ETIQUETAS: Record<string, string> = {
  inactivo: 'Todo guardado',
  sincronizando: 'Sincronizando…',
  pendiente: 'Reintentando',
  error: 'Con errores',
  sin_conexion: 'Sin conexión',
}

/**
 * Exportación completa a JSON: la red de seguridad frente a cualquier problema
 * con Supabase. Se arma desde la copia local, así que funciona sin conexión.
 */
function BloqueExportar() {
  const [estado, setEstado] = useState<string | null>(null)

  async function exportar() {
    setEstado('Preparando…')
    try {
      const exportacion = await exportarTodo()
      descargar(exportacion)
      const filas = Object.values(exportacion.datos).reduce((t, f) => t + f.length, 0)
      setEstado(`${filas} filas en ${nombreDeArchivo()}`)
    } catch {
      setEstado('No he podido generar el archivo.')
    }
  }

  return (
    <section className="rounded-2xl border border-borde bg-superficie p-4">
      <h2 className="text-base font-semibold">Exportar mis datos</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        Un JSON con todo lo registrado, legible sin la app y sin la base de datos.
        Se genera desde la copia local, así que funciona sin conexión.
      </p>
      <button
        onClick={() => void exportar()}
        className="min-h-12 w-full rounded-xl border border-borde font-medium active:bg-fondo"
      >
        Descargar JSON
      </button>
      {estado && <p className="mt-2 text-sm text-tenue">{estado}</p>}
    </section>
  )
}
