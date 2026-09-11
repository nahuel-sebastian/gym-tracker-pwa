import { useState } from 'react'
import { guardarObjetivo } from '../lib/acciones'
import { useObjetivo } from '../lib/consultas'
import { formatoCorto } from '../lib/fechas'
import { aNumero, aTexto, formatoKcal } from '../lib/numeros'
import { desvioKcal, kcalDeMacros } from '../lib/nutricion'
import type { ObjetivoNutricional, TipoDia } from '../lib/tipos'
import { Boton, CampoNumero, Segmentado, Tarjeta } from './Formulario'

const OPCIONES: { valor: TipoDia; etiqueta: string }[] = [
  { valor: 'entreno', etiqueta: 'Día de entreno' },
  { valor: 'descanso', etiqueta: 'Día de descanso' },
]

/**
 * Objetivos por tipo de día.
 *
 * Guardar no sobrescribe: crea una vigencia nueva a partir de hoy y deja la
 * anterior como histórico, para que el diario de hace tres meses se siga
 * comparando con el objetivo que había entonces.
 */
export default function BloqueObjetivos({ fecha }: { fecha: string }) {
  const [tipo, setTipo] = useState<TipoDia>('entreno')
  const objetivo = useObjetivo(tipo, fecha)

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Objetivos</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        Cambiarlos no toca el pasado: se guardan con fecha de vigencia.
      </p>

      <Segmentado opciones={OPCIONES} valor={tipo} onCambio={setTipo} />

      {/* La clave remonta el formulario al cambiar de pestaña o al llegar el
          objetivo descargado, así nace con los valores correctos. */}
      <Formulario key={`${tipo}:${objetivo?.id ?? 'nuevo'}`} tipo={tipo} objetivo={objetivo} />
    </Tarjeta>
  )
}

function Formulario({
  tipo,
  objetivo,
}: {
  tipo: TipoDia
  objetivo: ObjetivoNutricional | undefined
}) {
  const [campos, setCampos] = useState(() => ({
    kcal: aTexto(objetivo?.kcal),
    proteina_g: aTexto(objetivo?.proteina_g),
    grasa_g: aTexto(objetivo?.grasa_g),
    carbos_g: aTexto(objetivo?.carbos_g),
  }))
  const [guardado, setGuardado] = useState(false)

  const poner = (clave: keyof typeof campos) => (e: { target: { value: string } }) => {
    setCampos((c) => ({ ...c, [clave]: e.target.value }))
    setGuardado(false)
  }

  const valores = {
    kcal: aNumero(campos.kcal),
    proteina_g: aNumero(campos.proteina_g),
    grasa_g: aNumero(campos.grasa_g),
    carbos_g: aNumero(campos.carbos_g),
  }
  const completo = Object.values(valores).every((v) => v !== null && v >= 0)

  const desvio = completo
    ? desvioKcal({
        kcal: valores.kcal!,
        proteina: valores.proteina_g!,
        grasa: valores.grasa_g!,
        carbos: valores.carbos_g!,
      })
    : 0

  async function enviar() {
    if (!completo) return
    await guardarObjetivo(tipo, {
      kcal: valores.kcal!,
      proteina_g: valores.proteina_g!,
      grasa_g: valores.grasa_g!,
      carbos_g: valores.carbos_g!,
    })
    setGuardado(true)
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <CampoNumero etiqueta="Kcal" value={campos.kcal} onChange={poner('kcal')} />
        <CampoNumero
          etiqueta="Proteína"
          sufijo="g"
          value={campos.proteina_g}
          onChange={poner('proteina_g')}
        />
        <CampoNumero
          etiqueta="Grasa"
          sufijo="g"
          value={campos.grasa_g}
          onChange={poner('grasa_g')}
        />
        <CampoNumero
          etiqueta="Carbohidratos"
          sufijo="g"
          value={campos.carbos_g}
          onChange={poner('carbos_g')}
        />
      </div>

      {completo && desvio > 0.05 && (
        <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
          Esos macros suman{' '}
          {formatoKcal(
            kcalDeMacros({
              proteina: valores.proteina_g!,
              grasa: valores.grasa_g!,
              carbos: valores.carbos_g!,
            }),
          )}{' '}
          kcal, no {formatoKcal(valores.kcal!)}.
        </p>
      )}

      <Boton onClick={() => void enviar()} disabled={!completo}>
        {guardado ? 'Guardado' : 'Guardar objetivo'}
      </Boton>

      {objetivo && (
        <p className="text-xs text-tenue">
          Vigente desde {formatoCorto(objetivo.vigente_desde)}.
        </p>
      )}
    </div>
  )
}
