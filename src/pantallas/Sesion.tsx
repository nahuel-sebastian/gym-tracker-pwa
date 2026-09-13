import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Boton, Campo, Segmentado, Tarjeta } from '../componentes/Formulario'
import HojaElegirEjercicio from '../componentes/HojaElegirEjercicio'
import {
  useCatalogo,
  useEjerciciosDeDia,
  useSeriesDeSesion,
  useSesion,
  useUltimaVez,
} from '../lib/consultas'
import { diasEntre, formatoRelativo, hoy } from '../lib/fechas'
import { propuestaDeSerie, type UltimaVez } from '../lib/entreno'
import { aNumero, aTexto, formatoNumero } from '../lib/numeros'
import {
  anotarSerie,
  borrarSerie,
  corregirSerie,
  reabrirSesion,
  terminarSesion,
  type ValoresSerie,
} from '../lib/rutinas'
import type { Ejercicio, RutinaEjercicio, Serie, TipoSerie } from '../lib/tipos'

/**
 * La sesión en curso: la pantalla que se usa de pie, con una mano y a veces sin
 * cobertura. Cada serie anotada es una escritura local; la red no interviene.
 */
export default function Sesion() {
  const { id } = useParams<{ id: string }>()
  const sesion = useSesion(id)
  const series = useSeriesDeSesion(id)
  const delDia = useEjerciciosDeDia(sesion?.dia_id)
  const catalogo = useCatalogo()
  const navegar = useNavigate()
  const [anadiendo, setAnadiendo] = useState(false)
  const [extra, setExtra] = useState<string[]>([])

  // Los del plan, y detrás los que se hayan añadido sobre la marcha.
  const delPlan = delDia.map((e) => e.ejercicio_id)
  const conSeries = series.map((s) => s.ejercicio_id)
  const orden = [...new Set([...delPlan, ...conSeries, ...extra])]

  const anterior = useUltimaVez(orden, id)

  if (!sesion) {
    return <p className="text-sm text-tenue">Esta sesión ya no existe.</p>
  }

  const cerrada = sesion.hora_fin !== null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{sesion.nombre_dia ?? 'Sesión libre'}</h2>
        <p className="text-sm text-tenue">
          {formatoRelativo(sesion.fecha)}
          {cerrada ? ' · terminada' : ''}
        </p>
      </div>

      {orden.length === 0 && (
        <Tarjeta>
          <p className="text-sm text-tenue">
            Sesión vacía. Añade el primer ejercicio y empieza a anotar series.
          </p>
        </Tarjeta>
      )}

      {orden.map((ejercicioId) => (
        <BloqueEjercicio
          key={ejercicioId}
          ejercicio={catalogo.get(ejercicioId)}
          plan={delDia.find((e) => e.ejercicio_id === ejercicioId)}
          series={series.filter((s) => s.ejercicio_id === ejercicioId)}
          anterior={anterior.get(ejercicioId)}
          sesionId={sesion.id}
          bloqueado={cerrada}
        />
      ))}

      <Boton variante="secundario" onClick={() => setAnadiendo(true)}>
        Añadir ejercicio
      </Boton>

      <CierreDeSesion
        sesionId={sesion.id}
        notas={sesion.notas}
        sensacion={sesion.sensacion}
        cerrada={cerrada}
        onTerminada={() => navegar('/entreno')}
      />

      {anadiendo && (
        <HojaElegirEjercicio
          yaPuestos={orden}
          onElegir={(e) => {
            setExtra((previos) => [...previos, e.id])
            setAnadiendo(false)
          }}
          onCerrar={() => setAnadiendo(false)}
        />
      )}
    </div>
  )
}

/**
 * Un ejercicio dentro de la sesión: lo que manda la rutina, lo que se hizo la
 * última vez, lo hecho hoy, y la fila para anotar la siguiente serie.
 */
function BloqueEjercicio({
  ejercicio,
  plan,
  series,
  anterior,
  sesionId,
  bloqueado,
}: {
  ejercicio: Ejercicio | undefined
  plan: RutinaEjercicio | undefined
  series: Serie[]
  anterior: UltimaVez | undefined
  sesionId: string
  bloqueado: boolean
}) {
  const objetivo = plan
    ? [
        plan.series_objetivo ? `${plan.series_objetivo} series` : null,
        plan.reps_objetivo ? `${plan.reps_objetivo} reps` : null,
        plan.rir_objetivo !== null ? `RIR ${plan.rir_objetivo}` : null,
        plan.descanso_seg ? formatoDescanso(plan.descanso_seg) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <Tarjeta className="!px-0">
      <div className="px-4">
        <h3 className="text-base font-semibold">{ejercicio?.nombre ?? 'Ejercicio'}</h3>
        {objetivo && <p className="text-xs text-tenue">{objetivo}</p>}
        <UltimaVezResumen anterior={anterior} />
      </div>

      {series.length > 0 && (
        <ul className="mt-3 divide-y divide-borde border-y border-borde">
          {series.map((s) => (
            <FilaHecha key={s.id} serie={s} bloqueado={bloqueado} />
          ))}
        </ul>
      )}

      {!bloqueado && (
        <FilaNueva
          sesionId={sesionId}
          ejercicioId={ejercicio?.id}
          propuesta={propuestaDeSerie(series, anterior, series.length + 1)}
          numero={series.length + 1}
        />
      )}
    </Tarjeta>
  )
}

/** "90 s" por debajo del minuto y "2:30" por encima, como un cronómetro. */
function formatoDescanso(segundos: number): string {
  if (segundos < 60) return `${segundos} s`
  const min = Math.floor(segundos / 60)
  const resto = segundos % 60
  return resto ? `${min}:${String(resto).padStart(2, '0')}` : `${min} min`
}

/** Abreviaturas, para que las cuatro opciones quepan en una fila estrecha. */
const CORTO: Record<TipoSerie, string> = {
  normal: 'Normal',
  calentamiento: 'Calent.',
  dropset: 'Dropset',
  fallo: 'Fallo',
}

const TIPOS = Object.keys(CORTO) as TipoSerie[]

/**
 * Tipo de la serie.
 *
 * No es cosmético: `esEfectiva()` deja el calentamiento fuera del volumen y del
 * 1RM. Sin esta fila, todo se guardaba como `normal` y las series de
 * aproximación se contaban como trabajo efectivo en las gráficas de Progreso.
 */
function SelectorTipo({
  valor,
  onCambio,
}: {
  valor: TipoSerie
  onCambio: (tipo: TipoSerie) => void
}) {
  return (
    <div role="radiogroup" aria-label="Tipo de serie" className="flex gap-1.5">
      {TIPOS.map((tipo) => {
        const activo = tipo === valor
        return (
          <button
            key={tipo}
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(tipo)}
            className={`min-h-9 flex-1 rounded-lg border text-xs font-medium transition-colors ${
              activo
                ? 'border-acento bg-acento/10 text-acento'
                : 'border-borde text-tenue active:bg-fondo'
            }`}
          >
            {CORTO[tipo]}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Lo que se hizo la última vez en este ejercicio. Es el dato que gobierna la
 * progresión, así que va junto al ejercicio y no detrás de ninguna navegación.
 */
function UltimaVezResumen({ anterior }: { anterior: UltimaVez | undefined }) {
  if (!anterior) {
    return <p className="mt-2 text-xs text-tenue">Primera vez con este ejercicio.</p>
  }

  const dias = diasEntre(anterior.fecha, hoy())

  return (
    <div className="mt-2 rounded-xl bg-fondo px-3 py-2">
      <p className="text-xs text-tenue">
        Última vez · {dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`}
      </p>
      <p className="cifras mt-0.5 text-sm">
        {anterior.series
          .map(
            (s) =>
              `${s.peso_kg !== null ? formatoNumero(s.peso_kg, 2) : '—'}×${s.reps ?? '—'}${
                s.rir !== null ? ` RIR${s.rir}` : ''
              }`,
          )
          .join(' · ')}
      </p>
    </div>
  )
}

function FilaHecha({ serie, bloqueado }: { serie: Serie; bloqueado: boolean }) {
  const [corrigiendo, setCorrigiendo] = useState(false)

  return (
    <li className="px-4 py-1.5">
      <div className="flex min-h-12 items-center gap-3">
        <span className="cifras w-5 text-sm text-tenue">{serie.numero}</span>
        <span className="cifras flex-1 text-sm">
          {serie.peso_kg !== null ? `${formatoNumero(serie.peso_kg, 2)} kg` : '—'} ×{' '}
          {serie.reps ?? '—'}
          {serie.rir !== null && <span className="text-tenue"> · RIR {serie.rir}</span>}
        </span>

        {/* El tipo se enseña siempre, también cuando es normal: si solo
            apareciera al no serlo, nadie descubriría que se puede cambiar. */}
        {bloqueado ? (
          <span className="text-xs text-tenue">{CORTO[serie.tipo]}</span>
        ) : (
          <button
            onClick={() => setCorrigiendo((v) => !v)}
            aria-expanded={corrigiendo}
            aria-label={`Tipo de la serie ${serie.numero}: ${CORTO[serie.tipo]}`}
            className={`min-h-9 rounded-lg border px-2 text-xs font-medium ${
              serie.tipo === 'normal'
                ? 'border-transparent text-tenue'
                : 'border-borde text-texto'
            }`}
          >
            {CORTO[serie.tipo]}
          </button>
        )}

        {!bloqueado && (
          <button
            onClick={() => void borrarSerie(serie.id)}
            aria-label={`Borrar serie ${serie.numero}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-tenue active:bg-fondo"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {corrigiendo && !bloqueado && (
        <div className="pb-1.5 pl-8">
          <SelectorTipo
            valor={serie.tipo}
            onCambio={(tipo) => {
              void corregirSerie(serie.id, { tipo })
              setCorrigiendo(false)
            }}
          />
        </div>
      )}
    </li>
  )
}

/**
 * La fila de anotar. Viene rellena con lo que casi seguro toca, así que lo
 * normal es pulsar el botón sin teclear nada.
 *
 * Lo tecleado se guarda aparte de la propuesta, y `null` significa "aquí no ha
 * tocado nadie". Así la propuesta puede llegar tarde —la consulta de "última
 * vez" resuelve después del primer pintado— sin pisar lo que el usuario ya
 * haya escrito, y al anotar la serie basta con volver a `null` para que la
 * siguiente fila se rellene sola.
 */
function FilaNueva({
  sesionId,
  ejercicioId,
  propuesta,
  numero,
}: {
  sesionId: string
  ejercicioId: string | undefined
  propuesta: ValoresSerie
  numero: number
}) {
  const [tecleado, setTecleado] = useState<{
    peso: string | null
    reps: string | null
    rir: string | null
  }>({ peso: null, reps: null, rir: null })
  const [tipo, setTipo] = useState<TipoSerie>('normal')

  const peso = tecleado.peso ?? aTexto(propuesta.peso_kg)
  const reps = tecleado.reps ?? aTexto(propuesta.reps)
  const rir = tecleado.rir ?? aTexto(propuesta.rir)

  const setPeso = (v: string) => setTecleado((t) => ({ ...t, peso: v }))
  const setReps = (v: string) => setTecleado((t) => ({ ...t, reps: v }))
  const setRir = (v: string) => setTecleado((t) => ({ ...t, rir: v }))

  async function anotar() {
    if (!ejercicioId) return
    await anotarSerie(sesionId, ejercicioId, {
      peso_kg: aNumero(peso),
      reps: aNumero(reps),
      rir: aNumero(rir),
      tipo,
    })
    setTecleado({ peso: null, reps: null, rir: null })
    // El tipo no se arrastra: lo normal es una de aproximación y el resto
    // efectivas, no cuatro calentamientos seguidos.
    setTipo('normal')
  }

  const celda =
    'cifras min-h-12 w-full rounded-xl border border-borde bg-fondo px-2 text-center outline-none focus:border-acento'

  return (
    <div className="px-4 pt-3">
      <div className="flex items-end gap-2">
        <span className="cifras mb-3 w-5 text-sm text-tenue">{numero}</span>
        <label className="flex-1">
          <span className="mb-1 block text-center text-[11px] text-tenue">kg</span>
          <input
            type="text"
            inputMode="decimal"
            value={peso}
            aria-label={`Peso de la serie ${numero}`}
            onChange={(e) => setPeso(e.target.value)}
            className={celda}
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-center text-[11px] text-tenue">reps</span>
          <input
            type="text"
            inputMode="numeric"
            value={reps}
            aria-label={`Repeticiones de la serie ${numero}`}
            onChange={(e) => setReps(e.target.value)}
            className={celda}
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-center text-[11px] text-tenue">RIR</span>
          <input
            type="text"
            inputMode="numeric"
            value={rir}
            aria-label={`RIR de la serie ${numero}`}
            onChange={(e) => setRir(e.target.value)}
            className={celda}
          />
        </label>
        <button
          onClick={() => void anotar()}
          aria-label="Anotar serie"
          className="mb-0 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-acento text-fondo active:opacity-70"
        >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
      </div>

      <div className="mt-2 pl-7">
        <SelectorTipo valor={tipo} onCambio={setTipo} />
      </div>
    </div>
  )
}

const SENSACIONES = [
  { valor: '1', etiqueta: '1' },
  { valor: '2', etiqueta: '2' },
  { valor: '3', etiqueta: '3' },
  { valor: '4', etiqueta: '4' },
  { valor: '5', etiqueta: '5' },
]

function CierreDeSesion({
  sesionId,
  notas,
  sensacion,
  cerrada,
  onTerminada,
}: {
  sesionId: string
  notas: string | null
  sensacion: number | null
  cerrada: boolean
  onTerminada: () => void
}) {
  const [texto, setTexto] = useState(notas ?? '')
  const [valoracion, setValoracion] = useState(sensacion ? String(sensacion) : null)

  async function terminar() {
    await terminarSesion(sesionId, {
      notas: texto.trim() || null,
      sensacion: valoracion ? Number(valoracion) : null,
    })
    onTerminada()
  }

  if (cerrada) {
    return (
      <Tarjeta>
        {notas && <p className="text-sm">{notas}</p>}
        {sensacion && <p className="mt-1 text-sm text-tenue">Sensación: {sensacion} de 5</p>}
        <div className="mt-3">
          <Boton variante="secundario" onClick={() => void reabrirSesion(sesionId)}>
            Reabrir sesión
          </Boton>
        </div>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta>
      <Campo
        etiqueta="Notas de la sesión"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué tal ha ido"
      />
      <div className="mt-3">
        <span className="mb-1 block text-sm text-tenue">Sensación</span>
        <Segmentado opciones={SENSACIONES} valor={valoracion} onCambio={setValoracion} />
      </div>
      <div className="mt-3">
        <Boton onClick={() => void terminar()}>Terminar entreno</Boton>
      </div>
    </Tarjeta>
  )
}
