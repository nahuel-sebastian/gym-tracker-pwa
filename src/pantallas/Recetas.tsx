import { useState } from 'react'
import { Boton, Campo, CampoNumero, Tarjeta } from '../componentes/Formulario'
import Hoja from '../componentes/Hoja'
import { useIngredientes, useRecetas } from '../lib/consultas'
import { guardar } from '../lib/datos'
import { aNumeroPositivo, aTexto, formatoKcal, formatoNumero } from '../lib/numeros'
import {
  anadirIngrediente,
  borrarReceta,
  crearReceta,
  gramosDeReceta,
  macrosDePorcion,
  quitarIngrediente,
} from '../lib/recetas'
import HojaElegirAlimento from '../componentes/HojaElegirAlimento'
import type { Receta } from '../lib/tipos'

/**
 * Recetas: lo que se come a menudo, definido una vez.
 *
 * Los macros que se ven aquí se recalculan desde las fichas actuales, porque
 * una receta es una definición viva. Lo que se congela es el registro que sale
 * de ella, no la receta.
 */
export default function Recetas() {
  const recetas = useRecetas()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')

  async function crear() {
    if (!nombre.trim()) return
    const id = await crearReceta(nombre.trim())
    setNombre('')
    setCreando(false)
    setAbierta(id)
  }

  return (
    <div className="space-y-4">
      {recetas.length === 0 && (
        <Tarjeta>
          <p className="text-sm text-tenue">
            Todavía no hay recetas. Una receta es una comida que repites: la defines
            una vez con sus ingredientes y luego se registra de un toque.
          </p>
        </Tarjeta>
      )}

      {recetas.map((r) => (
        <FichaReceta
          key={r.id}
          receta={r}
          abierta={abierta === r.id}
          onAbrir={() => setAbierta(abierta === r.id ? null : r.id)}
        />
      ))}

      <Boton onClick={() => setCreando(true)}>Nueva receta</Boton>

      {creando && (
        <Hoja titulo="Nueva receta" onCerrar={() => setCreando(false)}>
          <div className="space-y-3">
            <Campo
              etiqueta="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Pollo con arroz"
              autoCapitalize="sentences"
              autoFocus
            />
            <Boton onClick={() => void crear()} disabled={!nombre.trim()}>
              Crear
            </Boton>
          </div>
        </Hoja>
      )}
    </div>
  )
}

function FichaReceta({
  receta,
  abierta,
  onAbrir,
}: {
  receta: Receta
  abierta: boolean
  onAbrir: () => void
}) {
  const ingredientes = useIngredientes(receta.id)
  const [anadiendo, setAnadiendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const porcion = macrosDePorcion(ingredientes, receta.porciones)
  const gramosPorcion = Math.round(gramosDeReceta(ingredientes) / Math.max(receta.porciones, 1))

  return (
    <Tarjeta className="!px-0">
      <button
        onClick={onAbrir}
        aria-expanded={abierta}
        className="flex w-full items-baseline justify-between gap-3 px-4 text-left"
      >
        <span>
          <span className="block text-base font-semibold">{receta.nombre}</span>
          <span className="cifras block text-xs text-tenue">
            {ingredientes.length} {ingredientes.length === 1 ? 'ingrediente' : 'ingredientes'} ·{' '}
            {receta.porciones} {receta.porciones === 1 ? 'porción' : 'porciones'}
          </span>
        </span>
        <span className="cifras shrink-0 text-sm text-tenue">
          {formatoKcal(porcion.kcal)} kcal
          <span className="block text-right text-xs">por porción</span>
        </span>
      </button>

      {abierta && (
        <div className="mt-3">
          <ul className="divide-y divide-borde border-y border-borde">
            {ingredientes.map(({ ingrediente, alimento }) => (
              <li key={ingrediente.id} className="flex min-h-12 items-center gap-3 px-4 py-1.5">
                <span className="flex-1 text-sm">
                  {alimento?.nombre ?? 'Alimento borrado'}
                  <span className="cifras text-tenue"> · {formatoNumero(ingrediente.gramos)} g</span>
                </span>
                <button
                  onClick={() => void quitarIngrediente(ingrediente.id)}
                  aria-label={`Quitar ${alimento?.nombre ?? 'ingrediente'}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-error active:bg-fondo"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setAnadiendo(true)}
            className="min-h-11 w-full border-b border-borde px-4 text-left text-sm font-medium text-acento active:bg-fondo"
          >
            + Añadir ingrediente
          </button>

          <div className="space-y-3 px-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <CampoNumero
                etiqueta="Porciones"
                value={aTexto(receta.porciones)}
                onChange={(e) => {
                  const n = aNumeroPositivo(e.target.value)
                  if (n) void guardar('recetas', { id: receta.id, porciones: n })
                }}
                ayuda={gramosPorcion ? `${gramosPorcion} g por porción` : ''}
              />
              <div className="cifras self-end rounded-xl bg-fondo p-3 text-sm">
                <span className="text-tenue">Por porción</span>
                <span className="mt-0.5 block">
                  P {formatoNumero(porcion.proteina)} · G {formatoNumero(porcion.grasa)} · C{' '}
                  {formatoNumero(porcion.carbos)}
                </span>
              </div>
            </div>

            {confirmando ? (
              <div className="flex gap-2">
                <Boton variante="secundario" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Boton>
                <Boton variante="peligro" onClick={() => void borrarReceta(receta.id)}>
                  Sí, borrar
                </Boton>
              </div>
            ) : (
              <Boton variante="peligro" onClick={() => setConfirmando(true)}>
                Borrar receta
              </Boton>
            )}
          </div>
        </div>
      )}

      {anadiendo && (
        <HojaElegirAlimento
          titulo="Añadir ingrediente"
          onElegir={(alimento, gramos) => {
            void anadirIngrediente(receta.id, alimento.id, gramos)
            setAnadiendo(false)
          }}
          onCerrar={() => setAnadiendo(false)}
        />
      )}
    </Tarjeta>
  )
}
