import { useState } from 'react'
import { registrarImportado } from '../../lib/acciones'
import { useHoy } from '../../lib/consultas'
import type { AlimentoEstimado } from '../../lib/estimacion'
import { sumarDias } from '../../lib/fechas'
import { NOMBRE_MOMENTO, OPCIONES_MOMENTO, momentoSugerido } from '../../lib/momentos'
import { aNumero, aTexto, formatoKcal, formatoNumero } from '../../lib/numeros'
import { sumarMacros } from '../../lib/nutricion'
import type { Momento } from '../../lib/tipos'
import { Boton, Campo, CampoNumero, Segmentado, Tarjeta } from '../Formulario'

type Props = {
  alimentos: AlimentoEstimado[]
  momentoDelJson: Momento | null
  onCambio: (alimentos: AlimentoEstimado[]) => void
  onHecho: () => void
}

/**
 * Vista previa de una comida importada.
 *
 * Editable a propósito: lo que llega es una estimación de un modelo, no una
 * medida. Corregir 180 g por 150 g antes de confirmar es parte del flujo.
 */
export default function VistaComida({ alimentos, momentoDelJson, onCambio, onHecho }: Props) {
  const fechaHoy = useHoy()
  const [ayer, setAyer] = useState(false)
  const [momento, setMomento] = useState<Momento>(momentoDelJson ?? momentoSugerido())
  const [aBiblioteca, setABiblioteca] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const fecha = ayer ? sumarDias(fechaHoy, -1) : fechaHoy
  const total = sumarMacros(alimentos)
  const sinGramos = alimentos.filter((a) => !a.gramos).length

  async function confirmar() {
    if (!alimentos.length) return
    setGuardando(true)
    try {
      await registrarImportado(fecha, momento, alimentos, aBiblioteca)
      onHecho()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Tarjeta>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            {alimentos.length} {alimentos.length === 1 ? 'alimento' : 'alimentos'}
          </h2>
          <span className="cifras text-sm text-tenue">
            {formatoKcal(total.kcal)} kcal · P {formatoNumero(total.proteina)} · G{' '}
            {formatoNumero(total.grasa)} · C {formatoNumero(total.carbos)}
          </span>
        </div>
        <p className="mt-1 text-sm text-tenue">
          Corrige lo que haga falta antes de guardar. Es una estimación, no una medida.
        </p>
      </Tarjeta>

      {alimentos.map((a, i) => (
        <FilaAlimento
          key={i}
          alimento={a}
          onCambio={(nuevo) => onCambio(alimentos.map((otro, j) => (i === j ? nuevo : otro)))}
          onQuitar={() => onCambio(alimentos.filter((_, j) => i !== j))}
        />
      ))}

      <Tarjeta>
        <span className="mb-1 block text-sm text-tenue">Día</span>
        <Segmentado
          opciones={[
            { valor: 'hoy', etiqueta: 'Hoy' },
            { valor: 'ayer', etiqueta: 'Ayer' },
          ]}
          valor={ayer ? 'ayer' : 'hoy'}
          onCambio={(v) => setAyer(v === 'ayer')}
        />

        <span className="mb-1 mt-3 block text-sm text-tenue">Momento</span>
        <Segmentado opciones={OPCIONES_MOMENTO} valor={momento} onCambio={setMomento} />

        <label className="mt-3 flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            checked={aBiblioteca}
            onChange={(e) => setABiblioteca(e.target.checked)}
            className="h-5 w-5 accent-[var(--color-acento)]"
          />
          <span className="text-sm">Guardar también en mi biblioteca</span>
        </label>

        {aBiblioteca && sinGramos > 0 && (
          <p className="mt-1 text-xs text-tenue">
            {sinGramos === 1
              ? 'Un alimento no trae gramos, así que no se puede pasar a ficha por 100 g. Se registrará igual, suelto.'
              : `${sinGramos} alimentos no traen gramos, así que no se pueden pasar a ficha por 100 g. Se registrarán igual, sueltos.`}
          </p>
        )}

        <div className="mt-3">
          <Boton onClick={() => void confirmar()} disabled={!alimentos.length || guardando}>
            {guardando
              ? 'Guardando…'
              : `Añadir a ${NOMBRE_MOMENTO[momento].toLowerCase()} de ${ayer ? 'ayer' : 'hoy'}`}
          </Boton>
        </div>
      </Tarjeta>
    </>
  )
}

function FilaAlimento({
  alimento,
  onCambio,
  onQuitar,
}: {
  alimento: AlimentoEstimado
  onCambio: (a: AlimentoEstimado) => void
  onQuitar: () => void
}) {
  const poner = (campo: keyof AlimentoEstimado) => (e: { target: { value: string } }) => {
    const valor = aNumero(e.target.value)
    onCambio({ ...alimento, [campo]: campo === 'gramos' ? valor : (valor ?? 0) })
  }

  return (
    <Tarjeta>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Campo
            etiqueta="Nombre"
            value={alimento.nombre}
            onChange={(e) => onCambio({ ...alimento, nombre: e.target.value })}
          />
        </div>
        <button
          onClick={onQuitar}
          aria-label={`Quitar ${alimento.nombre}`}
          className="mt-6 flex h-12 w-11 items-center justify-center rounded-xl text-error active:bg-fondo"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <CampoNumero etiqueta="Gramos" sufijo="g" value={aTexto(alimento.gramos)} onChange={poner('gramos')} />
        <CampoNumero etiqueta="Kcal" value={aTexto(alimento.kcal)} onChange={poner('kcal')} />
        <CampoNumero etiqueta="Proteína" sufijo="g" value={aTexto(alimento.proteina)} onChange={poner('proteina')} />
        <CampoNumero etiqueta="Grasa" sufijo="g" value={aTexto(alimento.grasa)} onChange={poner('grasa')} />
        <CampoNumero etiqueta="Carbohidratos" sufijo="g" value={aTexto(alimento.carbos)} onChange={poner('carbos')} />
      </div>
    </Tarjeta>
  )
}
