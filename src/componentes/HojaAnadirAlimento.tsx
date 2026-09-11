import { useState } from 'react'
import { registrarAlimento } from '../lib/acciones'
import { OPCIONES_MOMENTO } from '../lib/momentos'
import { aNumeroPositivo, aTexto, formatoKcal, formatoNumero } from '../lib/numeros'
import { macrosDeAlimento } from '../lib/nutricion'
import type { Alimento, Momento } from '../lib/tipos'
import { Boton, CampoNumero, Segmentado } from './Formulario'
import Hoja from './Hoja'

type Props = {
  alimento: Alimento
  fecha: string
  momentoInicial: Momento
  onCerrar: () => void
  onRegistrado?: () => void
}

/**
 * Segundo toque del registro: cuántos gramos y en qué momento.
 *
 * Viene relleno con la porción habitual del alimento y el momento que toca por
 * la hora, así que el caso normal es abrir y confirmar.
 */
export default function HojaAnadirAlimento({
  alimento,
  fecha,
  momentoInicial,
  onCerrar,
  onRegistrado,
}: Props) {
  const [gramos, setGramos] = useState(() => aTexto(alimento.porcion_defecto_g ?? 100))
  const [momento, setMomento] = useState<Momento>(momentoInicial)
  const [guardando, setGuardando] = useState(false)

  const cantidad = aNumeroPositivo(gramos)
  const previa = cantidad ? macrosDeAlimento(alimento, cantidad) : null

  async function confirmar() {
    if (!cantidad) return
    setGuardando(true)
    try {
      await registrarAlimento(fecha, momento, alimento, cantidad)
      onRegistrado?.()
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={alimento.nombre} onCerrar={onCerrar}>
      <div className="space-y-4">
        {alimento.marca && <p className="-mt-2 text-sm text-tenue">{alimento.marca}</p>}

        <CampoNumero
          etiqueta="Cantidad"
          sufijo="g"
          value={gramos}
          onChange={(e) => setGramos(e.target.value)}
          autoFocus
          ayuda={`Por 100 g: ${formatoKcal(alimento.kcal_100g)} kcal · P ${formatoNumero(
            alimento.proteina_100g,
          )} · G ${formatoNumero(alimento.grasa_100g)} · C ${formatoNumero(alimento.carbos_100g)}`}
        />

        <div>
          <span className="mb-1 block text-sm text-tenue">Momento</span>
          <Segmentado opciones={OPCIONES_MOMENTO} valor={momento} onCambio={setMomento} />
        </div>

        <div className="rounded-xl bg-fondo p-3">
          {previa ? (
            <div className="cifras flex items-baseline justify-between">
              <span className="text-2xl font-semibold">{formatoKcal(previa.kcal)}</span>
              <span className="text-sm text-tenue">
                P {formatoNumero(previa.proteina)} · G {formatoNumero(previa.grasa)} · C{' '}
                {formatoNumero(previa.carbos)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-tenue">Escribe una cantidad para ver los macros.</p>
          )}
        </div>

        <Boton onClick={() => void confirmar()} disabled={!cantidad || guardando}>
          {guardando ? 'Guardando…' : 'Añadir'}
        </Boton>
      </div>
    </Hoja>
  )
}
