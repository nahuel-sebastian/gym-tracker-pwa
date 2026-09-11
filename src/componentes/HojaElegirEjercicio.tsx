import { useState } from 'react'
import { useEjercicios } from '../lib/consultas'
import type { Ejercicio } from '../lib/tipos'
import Hoja from './Hoja'

type Props = {
  titulo?: string
  /** Ejercicios que ya están en la lista; salen marcados pero se pueden repetir. */
  yaPuestos?: string[]
  onElegir: (ejercicio: Ejercicio) => void
  onCerrar: () => void
}

/** Buscador del catálogo, para añadir un ejercicio a una sesión o a una rutina. */
export default function HojaElegirEjercicio({
  titulo = 'Añadir ejercicio',
  yaPuestos = [],
  onElegir,
  onCerrar,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const ejercicios = useEjercicios(busqueda)
  const puestos = new Set(yaPuestos)

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar ejercicio"
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus
        className="min-h-12 w-full rounded-xl border border-borde bg-fondo px-3 outline-none focus:border-acento"
      />

      <ul className="mt-3 divide-y divide-borde">
        {ejercicios.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onElegir(e)}
              className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left active:opacity-70"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.nombre}</span>
                <span className="block truncate text-xs text-tenue">
                  {[e.grupo_muscular, e.equipamiento].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              {puestos.has(e.id) && <span className="text-xs text-tenue">ya está</span>}
            </button>
          </li>
        ))}
      </ul>

      {ejercicios.length === 0 && (
        <p className="py-4 text-sm text-tenue">
          Nada con ese nombre. Puedes crearlo desde Entreno → Ejercicios.
        </p>
      )}
    </Hoja>
  )
}
