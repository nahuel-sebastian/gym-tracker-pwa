import { useState } from 'react'
import { borrarRegistro, cambiarGramos } from '../lib/acciones'
import { guardar } from '../lib/datos'
import { OPCIONES_MOMENTO } from '../lib/momentos'
import { aNumero, aNumeroPositivo, aTexto, formatoKcal, formatoNumero } from '../lib/numeros'
import { macrosDeAlimento } from '../lib/nutricion'
import type { Alimento, Momento, RegistroComida } from '../lib/tipos'
import { Boton, CampoNumero, Segmentado } from './Formulario'
import Hoja from './Hoja'

type Props = {
  registro: RegistroComida
  alimento: Alimento | undefined
  onCerrar: () => void
}

/**
 * Editar o borrar algo ya registrado.
 *
 * Con un alimento detrás se corrigen los gramos y los macros se recalculan con
 * la ficha actual. Sin él (una comida de fuera, o lo que vino del puente de
 * macros) se editan los macros a mano: no hay de dónde recalcularlos.
 */
export default function HojaRegistro({ registro, alimento, onCerrar }: Props) {
  const [gramos, setGramos] = useState(() => aTexto(registro.gramos))
  const [momento, setMomento] = useState<Momento>(registro.momento)
  const [macros, setMacros] = useState(() => ({
    kcal: aTexto(registro.kcal),
    proteina: aTexto(registro.proteina),
    grasa: aTexto(registro.grasa),
    carbos: aTexto(registro.carbos),
  }))
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const cantidad = aNumeroPositivo(gramos)
  const previa = alimento && cantidad ? macrosDeAlimento(alimento, cantidad) : null

  async function guardarCambios() {
    if (alimento && cantidad) {
      await cambiarGramos(registro, alimento, cantidad)
    } else {
      await guardar('registros_comida', {
        id: registro.id,
        gramos: aNumero(gramos),
        kcal: aNumero(macros.kcal) ?? 0,
        proteina: aNumero(macros.proteina) ?? 0,
        grasa: aNumero(macros.grasa) ?? 0,
        carbos: aNumero(macros.carbos) ?? 0,
      })
    }

    if (momento !== registro.momento) {
      await guardar('registros_comida', { id: registro.id, momento })
    }

    onCerrar()
  }

  async function eliminar() {
    await borrarRegistro(registro.id)
    onCerrar()
  }

  const titulo = alimento?.nombre ?? registro.descripcion ?? 'Registro'

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-4">
        {alimento ? (
          <>
            <CampoNumero
              etiqueta="Cantidad"
              sufijo="g"
              value={gramos}
              onChange={(e) => setGramos(e.target.value)}
            />
            <div className="cifras rounded-xl bg-fondo p-3 text-sm">
              {previa ? (
                <>
                  <span className="text-lg font-semibold">{formatoKcal(previa.kcal)}</span>
                  <span className="text-tenue">
                    {' '}
                    kcal · P {formatoNumero(previa.proteina)} · G {formatoNumero(previa.grasa)} ·
                    C {formatoNumero(previa.carbos)}
                  </span>
                </>
              ) : (
                <span className="text-tenue">Escribe una cantidad.</span>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero
              etiqueta="Kcal"
              value={macros.kcal}
              onChange={(e) => setMacros({ ...macros, kcal: e.target.value })}
            />
            <CampoNumero
              etiqueta="Gramos"
              sufijo="g"
              value={gramos}
              onChange={(e) => setGramos(e.target.value)}
            />
            <CampoNumero
              etiqueta="Proteína"
              sufijo="g"
              value={macros.proteina}
              onChange={(e) => setMacros({ ...macros, proteina: e.target.value })}
            />
            <CampoNumero
              etiqueta="Grasa"
              sufijo="g"
              value={macros.grasa}
              onChange={(e) => setMacros({ ...macros, grasa: e.target.value })}
            />
            <CampoNumero
              etiqueta="Carbohidratos"
              sufijo="g"
              value={macros.carbos}
              onChange={(e) => setMacros({ ...macros, carbos: e.target.value })}
            />
          </div>
        )}

        <div>
          <span className="mb-1 block text-sm text-tenue">Momento</span>
          <Segmentado opciones={OPCIONES_MOMENTO} valor={momento} onCambio={setMomento} />
        </div>

        <Boton onClick={() => void guardarCambios()}>Guardar</Boton>

        {confirmandoBorrado ? (
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setConfirmandoBorrado(false)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={() => void eliminar()}>
              Sí, borrar
            </Boton>
          </div>
        ) : (
          <Boton variante="peligro" onClick={() => setConfirmandoBorrado(true)}>
            Borrar
          </Boton>
        )}
      </div>
    </Hoja>
  )
}
