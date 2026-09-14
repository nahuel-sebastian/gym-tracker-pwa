import { useState } from 'react'
import { guardarAlimento } from '../../lib/acciones'
import type { FichaImportada } from '../../lib/fichasImportadas'
import { formatoKcal, formatoNumero } from '../../lib/numeros'
import { desvioKcal } from '../../lib/nutricion'
import { Boton, Tarjeta } from '../Formulario'

/**
 * Vista previa de fichas de biblioteca importadas.
 *
 * Se avisa de las que no cuadran con la regla 4/9/4, igual que en el alta a
 * mano: una ficha mal no se nota al guardarla, se nota en cada comida que la
 * use a partir de entonces.
 */
export default function VistaFichas({
  fichas,
  onHecho,
}: {
  fichas: FichaImportada[]
  onHecho: () => void
}) {
  const [guardando, setGuardando] = useState(false)

  async function confirmar() {
    setGuardando(true)
    try {
      for (const f of fichas) {
        await guardarAlimento({ ...f, origen: 'importado' })
      }
      onHecho()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Tarjeta>
        <h2 className="text-base font-semibold">
          {fichas.length} {fichas.length === 1 ? 'ficha' : 'fichas'} para la biblioteca
        </h2>
        <p className="mt-1 text-sm text-tenue">
          Valores por 100 g. Si una ficha ya existe con el mismo código de barras, se
          actualiza en vez de duplicarse.
        </p>
      </Tarjeta>

      <Tarjeta className="!p-0">
        <ul className="divide-y divide-borde">
          {fichas.map((f, i) => {
            const desvio = desvioKcal({
              kcal: f.kcal_100g,
              proteina: f.proteina_100g,
              grasa: f.grasa_100g,
              carbos: f.carbos_100g,
            })

            return (
              <li key={i} className="px-4 py-2.5">
                <span className="block text-sm font-medium">{f.nombre}</span>
                <span className="cifras block text-xs text-tenue">
                  {f.marca ? `${f.marca} · ` : ''}
                  {formatoKcal(f.kcal_100g)} kcal · P {formatoNumero(f.proteina_100g)} · G{' '}
                  {formatoNumero(f.grasa_100g)} · C {formatoNumero(f.carbos_100g)} /100 g
                </span>
                {desvio > 0.15 && (
                  <span className="mt-0.5 block text-xs text-aviso">
                    Los macros no cuadran con las kcal. Revísala después en la biblioteca.
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Tarjeta>

      <Boton onClick={() => void confirmar()} disabled={guardando}>
        {guardando ? 'Guardando…' : `Añadir ${fichas.length === 1 ? 'la ficha' : 'las fichas'}`}
      </Boton>
    </>
  )
}
