import { useState } from 'react'
import { useHoy } from '../../lib/consultas'
import { aCrear, type RutinaImportada } from '../../lib/rutinaImportada'
import { OBJETIVOS_DEFECTO, guardarRutinaImportada } from '../../lib/rutinas'
import { Boton, Tarjeta } from '../Formulario'

/**
 * Vista previa de una rutina importada.
 *
 * Lo que hay que ver antes de confirmar **no son los objetivos, es el
 * emparejamiento de nombres**: la rutina nombra sus ejercicios por nombre y la
 * base los referencia por id. Si llega "Press banca" y el catálogo tiene "Press
 * de banca con barra", o se empareja o se crea un duplicado — y eso hay que
 * verlo, no descubrirlo tres semanas después con el histórico partido en dos.
 */
export default function VistaRutina({
  rutina,
  onHecho,
}: {
  rutina: RutinaImportada
  onHecho: () => void
}) {
  const hoy = useHoy()
  const [guardando, setGuardando] = useState(false)

  const nuevos = aCrear(rutina)
  const totalEjercicios = rutina.dias.reduce((n, d) => n + d.ejercicios.length, 0)

  async function confirmar() {
    setGuardando(true)
    try {
      await guardarRutinaImportada(rutina, hoy)
      onHecho()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Tarjeta>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">{rutina.nombre}</h2>
          <span className="cifras shrink-0 text-sm text-tenue">
            {rutina.dias.length} {rutina.dias.length === 1 ? 'día' : 'días'} · {totalEjercicios}{' '}
            ejercicios
          </span>
        </div>
        <p className="mt-1 text-sm text-tenue">
          {nuevos.length === 0
            ? 'Todos los ejercicios están en tu catálogo.'
            : `${nuevos.length} ${nuevos.length === 1 ? 'ejercicio se creará' : 'ejercicios se crearán'} en tu catálogo: ${nuevos.join(', ')}.`}
        </p>
        <p className="mt-2 text-xs text-tenue">
          No se activará. La rutina que estés haciendo sigue siendo la activa.
        </p>
      </Tarjeta>

      {rutina.dias.map((dia, i) => (
        <Tarjeta key={i} className="!px-0">
          <h3 className="px-4 text-base font-semibold">{dia.nombre}</h3>

          <ul className="mt-2 divide-y divide-borde border-t border-borde">
            {dia.ejercicios.map((e, j) => (
              <li key={j} className="px-4 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{e.nombre}</span>
                  {/* Los objetivos que el JSON no traiga se rellenan al
                      guardar, así que aquí se enseñan ya rellenos: un "?" en la
                      vista previa sería mentira. */}
                  <span className="cifras shrink-0 text-xs text-tenue">
                    {e.series_objetivo ?? OBJETIVOS_DEFECTO.series_objetivo}×
                    {e.reps_objetivo ?? OBJETIVOS_DEFECTO.reps_objetivo} · RIR{' '}
                    {e.rir_objetivo ?? OBJETIVOS_DEFECTO.rir_objetivo}
                    {e.descanso_seg ? ` · ${e.descanso_seg} s` : ''}
                  </span>
                </div>

                {/* El emparejamiento, que es lo que de verdad hay que revisar. */}
                <p className="mt-0.5 text-xs">
                  {e.ejercicio_id ? (
                    e.emparejadoCon === e.nombre ? (
                      <span className="text-tenue">en tu catálogo</span>
                    ) : (
                      <span className="text-acento">→ {e.emparejadoCon}</span>
                    )
                  ) : (
                    <span className="text-aviso">se creará nuevo</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ))}

      <Boton onClick={() => void confirmar()} disabled={guardando}>
        {guardando ? 'Guardando…' : `Crear «${rutina.nombre}»`}
      </Boton>
    </>
  )
}
