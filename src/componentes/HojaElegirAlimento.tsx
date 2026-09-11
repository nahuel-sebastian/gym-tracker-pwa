import { useState } from 'react'
import { useAlimentos } from '../lib/consultas'
import { aNumeroPositivo, aTexto, formatoKcal } from '../lib/numeros'
import type { Alimento } from '../lib/tipos'
import { Boton, CampoNumero } from './Formulario'
import Hoja from './Hoja'

type Props = {
  titulo: string
  onElegir: (alimento: Alimento, gramos: number) => void
  onCerrar: () => void
}

/** Elegir un alimento de la biblioteca y decir cuántos gramos. */
export default function HojaElegirAlimento({ titulo, onElegir, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const alimentos = useAlimentos(busqueda, 20)
  const [elegido, setElegido] = useState<Alimento | null>(null)
  const [gramos, setGramos] = useState('')

  const cantidad = aNumeroPositivo(gramos)

  if (elegido) {
    return (
      <Hoja titulo={elegido.nombre} onCerrar={onCerrar}>
        <div className="space-y-3">
          <CampoNumero
            etiqueta="Cantidad"
            sufijo="g"
            value={gramos}
            onChange={(e) => setGramos(e.target.value)}
            autoFocus
          />
          <Boton disabled={!cantidad} onClick={() => cantidad && onElegir(elegido, cantidad)}>
            Añadir
          </Boton>
          <Boton variante="secundario" onClick={() => setElegido(null)}>
            Elegir otro
          </Boton>
        </div>
      </Hoja>
    )
  }

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar en mi biblioteca"
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus
        className="min-h-12 w-full rounded-xl border border-borde bg-fondo px-3 outline-none focus:border-acento"
      />

      <ul className="mt-3 divide-y divide-borde">
        {alimentos.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => {
                setElegido(a)
                setGramos(aTexto(a.porcion_defecto_g ?? 100))
              }}
              className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left active:opacity-70"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.nombre}</span>
              <span className="cifras shrink-0 text-xs text-tenue">
                {formatoKcal(a.kcal_100g)} /100 g
              </span>
            </button>
          </li>
        ))}
      </ul>

      {alimentos.length === 0 && (
        <p className="py-4 text-sm text-tenue">
          Nada con ese nombre. Da el alimento de alta primero desde Comida.
        </p>
      )}
    </Hoja>
  )
}
