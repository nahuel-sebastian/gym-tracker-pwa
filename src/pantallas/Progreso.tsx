import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CampoNumero, Segmentado, Tarjeta } from '../componentes/Formulario'
import {
  useAjustes,
  useCatalogo,
  useHoy,
  useMedidas,
  useRegistros,
  useSeriesDe,
  useSesionesDesde,
  useTiposDeDia,
} from '../lib/consultas'
import { formatoCorto, sumarDias } from '../lib/fechas'
import { aNumeroPositivo, aTexto, formatoKcal, formatoNumero } from '../lib/numeros'
import { guardarPesoObjetivo } from '../lib/acciones'
import {
  NOMBRE_METRICA,
  UNIDAD_METRICA,
  mediasSemanales,
  progresionEjercicio,
  serieDePeso,
  tendenciaPeso,
  proyeccionDePeso,
  volumenPorGrupo,
  volumenSemanalPorGrupo,
  type Metrica,
  type VolumenGrupo,
} from '../lib/progreso'
import type { FilaSemana } from '../componentes/graficas/GraficaSemanas'

/**
 * Recharts pesa más que el resto de la app junta y solo hace falta aquí.
 * Cargarlo aparte deja el arranque desde el icono de la pantalla de inicio en
 * lo que pide el plan; esta pantalla es la única que espera un momento.
 */
const GraficaPeso = lazy(() => import('../componentes/graficas/GraficaPeso'))
const GraficaEjercicio = lazy(() => import('../componentes/graficas/GraficaEjercicio'))
const GraficaSemanas = lazy(() => import('../componentes/graficas/GraficaSemanas'))
const GraficaGrupos = lazy(() => import('../componentes/graficas/GraficaGrupos'))
const GraficaGruposSemanal = lazy(() => import('../componentes/graficas/GraficaGruposSemanal'))

const RANGOS = [
  { valor: '30', etiqueta: '30 días' },
  { valor: '90', etiqueta: '90 días' },
  { valor: '365', etiqueta: '1 año' },
  { valor: '3650', etiqueta: 'Todo' },
]

const METRICAS: { valor: Metrica; etiqueta: string }[] = [
  { valor: 'peso', etiqueta: 'Peso máx.' },
  { valor: 'volumen', etiqueta: 'Volumen' },
  { valor: 'unorm', etiqueta: '1RM' },
]

export default function Progreso() {
  const hoy = useHoy()
  const [rango, setRango] = useState('90')
  const desde = sumarDias(hoy, -Number(rango))

  const medidas = useMedidas(desde)
  const registros = useRegistros(desde)
  const sesiones = useSesionesDesde(desde)
  const series = useSeriesDe(sesiones)
  const tipos = useTiposDeDia(desde)
  const catalogo = useCatalogo()

  const ajustes = useAjustes()
  const puntosPeso = useMemo(() => serieDePeso(medidas), [medidas])
  const tendencia = useMemo(() => tendenciaPeso(puntosPeso), [puntosPeso])
  const proyeccion = useMemo(
    () => proyeccionDePeso(puntosPeso, ajustes?.peso_objetivo),
    [puntosPeso, ajustes?.peso_objetivo],
  )

  return (
    <div className="space-y-4">
      {/* Un solo selector de rango arriba: todo lo de abajo mira el mismo
          periodo, así que los números de unas gráficas y otras cuadran. */}
      <div>
        <span className="mb-1 block text-sm text-tenue">Periodo</span>
        <Segmentado opciones={RANGOS} valor={rango} onCambio={setRango} />
      </div>

      <Tarjeta>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Peso corporal</h2>
          {tendencia !== null && (
            <span className="cifras text-sm text-tenue">
              {tendencia > 0 ? '+' : ''}
              {formatoNumero(tendencia, 2)} kg en 4 semanas
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-tenue">
          El peso diario sube y baja por agua y glucógeno. La media de siete días es
          la que dice hacia dónde vas.
        </p>

        <PesoActual puntos={puntosPeso} />

        <Suspense fallback={<Cargando />}>
          <GraficaPeso puntos={puntosPeso} />
        </Suspense>

        <PesoObjetivo objetivo={ajustes?.peso_objetivo ?? null} proyeccion={proyeccion} />

        <Datos
          cabeceras={['Fecha', 'Peso', 'Media 7 d']}
          filas={[...puntosPeso]
            .reverse()
            .filter((p) => p.peso !== null)
            .slice(0, 30)
            .map((p) => [
              formatoCorto(p.fecha),
              p.peso !== null ? `${formatoNumero(p.peso, 2)} kg` : '—',
              p.media !== null ? `${formatoNumero(p.media, 2)} kg` : '—',
            ])}
        />
      </Tarjeta>

      <ProgresionEjercicio
        series={series}
        sesiones={sesiones}
        catalogo={catalogo}
      />

      <Nutricion registros={registros} tipos={tipos} />

      <Tarjeta>
        <h2 className="text-base font-semibold">Volumen por grupo</h2>
        <p className="mb-2 mt-1 text-sm text-tenue">
          Series efectivas del periodo. El calentamiento no cuenta.
        </p>
        <VolumenGrupos datos={volumenPorGrupo(series, sesiones, catalogo, desde, hoy)} />
      </Tarjeta>

      <VolumenSemanal
        datos={volumenSemanalPorGrupo(series, sesiones, catalogo, desde, hoy)}
      />

      <Tarjeta>
        <h2 className="text-base font-semibold">Fotos de progreso</h2>
        <p className="mb-3 mt-1 text-sm text-tenue">
          Lo que la báscula no dice. Mismo ángulo, misma luz, y comparar meses, no días.
        </p>
        <Link
          to="/progreso/fotos"
          className="flex min-h-12 items-center justify-center rounded-xl border border-borde font-medium active:bg-fondo"
        >
          Ver las fotos
        </Link>
      </Tarjeta>
    </div>
  )
}

function VolumenGrupos({ datos }: { datos: VolumenGrupo[] }) {
  return (
    <>
      <Suspense fallback={<Cargando />}>
        <GraficaGrupos datos={datos} />
      </Suspense>
      <Datos
        cabeceras={['Grupo', 'Series']}
        filas={datos.map((d) => [d.grupo, String(d.series)])}
      />
    </>
  )
}

/**
 * Semana a semana por grupo: no cuánto has hecho, sino si va subiendo o
 * bajando. Es con lo que se decide tocar el volumen de un grupo.
 */
function VolumenSemanal({
  datos,
}: {
  datos: ReturnType<typeof volumenSemanalPorGrupo>
}) {
  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Cómo ha ido el volumen</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        Series efectivas por semana. Todas las gráficas comparten escala, así que
        se pueden comparar entre sí.
      </p>

      <Suspense fallback={<Cargando />}>
        <GraficaGruposSemanal semanas={datos.semanas} porGrupo={datos.porGrupo} />
      </Suspense>

      <Datos
        cabeceras={['Grupo', ...datos.semanas.map((f) => formatoCorto(f))]}
        filas={datos.porGrupo.map((g) => [g.grupo, ...g.series.map(String)])}
      />
    </Tarjeta>
  )
}

/**
 * Peso objetivo y cuánto falta al ritmo actual.
 *
 * El ritmo sale de la media móvil, no de dos pesajes: con el dato diario, un
 * día de más sal daría una proyección absurda.
 */
function PesoObjetivo({
  objetivo,
  proyeccion,
}: {
  objetivo: number | null
  proyeccion: ReturnType<typeof proyeccionDePeso>
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(() => aTexto(objetivo))

  async function guardar() {
    await guardarPesoObjetivo(aNumeroPositivo(texto))
    setEditando(false)
  }

  if (editando || objetivo === null) {
    return (
      <div className="mt-3 border-t border-borde pt-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <CampoNumero
              etiqueta="Peso objetivo"
              sufijo="kg"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              ayuda="Para saber cuánto falta al ritmo de las últimas cuatro semanas."
            />
          </div>
          <button
            onClick={() => void guardar()}
            className="mb-[1.65rem] min-h-12 rounded-xl bg-acento px-5 font-semibold text-fondo"
          >
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-borde pt-3">
      <div>
        <p className="text-sm text-tenue">
          Objetivo <span className="cifras text-texto">{formatoNumero(objetivo, 2)} kg</span>
        </p>
        <p className="mt-0.5 text-sm">
          {proyeccion === null ? (
            <span className="text-tenue">
              Aún no hay tendencia con la que proyectar.
            </span>
          ) : proyeccion.alReves ? (
            <span className="text-aviso">
              Vas en dirección contraria: {formatoNumero(proyeccion.ritmo, 2)} kg por semana.
            </span>
          ) : (
            <>
              <span className="cifras font-semibold">
                {proyeccion.semanas} {proyeccion.semanas === 1 ? 'semana' : 'semanas'}
              </span>
              <span className="text-tenue">
                {' '}
                a {formatoNumero(Math.abs(proyeccion.ritmo), 2)} kg por semana
              </span>
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => {
          setTexto(aTexto(objetivo))
          setEditando(true)
        }}
        className="min-h-11 shrink-0 rounded-xl border border-borde px-4 text-sm font-medium active:bg-fondo"
      >
        Cambiar
      </button>
    </div>
  )
}

/** El número que se mira primero: la media de hoy, no el peso de esta mañana. */
function PesoActual({ puntos }: { puntos: { media: number | null }[] }) {
  const ultima = [...puntos].reverse().find((p) => p.media !== null)?.media
  if (ultima === undefined || ultima === null) return null

  return (
    <p className="mt-3 text-4xl font-semibold">
      {formatoNumero(ultima, 2)} <span className="text-xl text-tenue">kg</span>
    </p>
  )
}

function ProgresionEjercicio({
  series,
  sesiones,
  catalogo,
}: {
  series: Parameters<typeof progresionEjercicio>[0]
  sesiones: Parameters<typeof progresionEjercicio>[1]
  catalogo: Map<string, { nombre: string }>
}) {
  const [metrica, setMetrica] = useState<Metrica>('peso')

  // Solo los ejercicios que se han hecho: un desplegable con los 70 del
  // catálogo obligaría a buscar entre ejercicios sin un solo dato.
  const conDatos = useMemo(() => {
    const ids = [...new Set(series.map((s) => s.ejercicio_id))]
    return ids
      .map((id) => ({ id, nombre: catalogo.get(id)?.nombre ?? '—' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [series, catalogo])

  const [elegido, setElegido] = useState<string | null>(null)
  const ejercicioId = elegido && conDatos.some((e) => e.id === elegido) ? elegido : conDatos[0]?.id

  const puntos = useMemo(
    () => (ejercicioId ? progresionEjercicio(series, sesiones, ejercicioId, metrica) : []),
    [series, sesiones, ejercicioId, metrica],
  )

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Progresión por ejercicio</h2>

      {conDatos.length === 0 ? (
        <p className="mt-1 text-sm text-tenue">
          Todavía no hay series registradas en este periodo.
        </p>
      ) : (
        <>
          <select
            value={ejercicioId}
            onChange={(e) => setElegido(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border border-borde bg-fondo px-3 outline-none focus:border-acento"
          >
            {conDatos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>

          <div className="mt-2">
            <Segmentado opciones={METRICAS} valor={metrica} onCambio={setMetrica} />
          </div>

          <p className="mt-2 text-sm text-tenue">
            {NOMBRE_METRICA[metrica]} por sesión, en {UNIDAD_METRICA[metrica]}.
          </p>

          <Suspense fallback={<Cargando />}>
            <GraficaEjercicio puntos={puntos} metrica={metrica} />
          </Suspense>

          <Datos
            cabeceras={['Sesión', NOMBRE_METRICA[metrica], 'Series']}
            filas={[...puntos].reverse().map((p) => [
              formatoCorto(p.fecha),
              `${formatoNumero(p.valor, 1)} ${UNIDAD_METRICA[metrica]}`,
              String(p.series),
            ])}
          />
        </>
      )}
    </Tarjeta>
  )
}

function Nutricion({
  registros,
  tipos,
}: {
  registros: Parameters<typeof mediasSemanales>[0]
  tipos: Parameters<typeof mediasSemanales>[1]
}) {
  const medias = useMemo(() => mediasSemanales(registros, tipos), [registros, tipos])

  const filas: FilaSemana[] = useMemo(() => {
    const semanas = [
      ...new Set([...medias.entreno, ...medias.descanso].map((s) => s.semana)),
    ].sort()

    return semanas.map((semana) => {
      const e = medias.entreno.find((s) => s.semana === semana)
      const d = medias.descanso.find((s) => s.semana === semana)
      return {
        semana,
        entreno: e?.kcal ?? null,
        descanso: d?.kcal ?? null,
        diasEntreno: e?.dias ?? 0,
        diasDescanso: d?.dias ?? 0,
      }
    })
  }, [medias])

  const tabla = useMemo(
    () =>
      [
        ...medias.entreno.map((s) => ['Entreno', s] as const),
        ...medias.descanso.map((s) => ['Descanso', s] as const),
      ]
        .sort((a, b) => b[1].semana.localeCompare(a[1].semana))
        .map(([tipo, s]) => [
          `${formatoCorto(s.semana)} · ${tipo}`,
          formatoKcal(s.kcal),
          formatoNumero(s.proteina),
          formatoNumero(s.grasa),
          formatoNumero(s.carbos),
        ]),
    [medias],
  )

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Medias semanales</h2>
      <p className="mb-2 mt-1 text-sm text-tenue">
        Media por día registrado, no repartida entre siete: una semana a medio
        apuntar no baja la media.
      </p>

      <Suspense fallback={<Cargando />}>
        <GraficaSemanas filas={filas} />
      </Suspense>

      <Datos cabeceras={['Semana', 'Kcal', 'P', 'G', 'C']} filas={tabla} />
    </Tarjeta>
  )
}

/**
 * Vista de datos de cada gráfica. Cerrada por defecto, pero presente: ningún
 * número de esta pantalla depende de poder ver un color o de acertar con el
 * dedo en un punto.
 */
function Datos({ cabeceras, filas }: { cabeceras: string[]; filas: string[][] }) {
  const [abierta, setAbierta] = useState(false)

  if (!filas.length) return null

  return (
    <div className="mt-3">
      <button
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="min-h-11 text-sm font-medium text-acento active:opacity-70"
      >
        {abierta ? 'Ocultar datos' : 'Ver datos'}
      </button>

      {abierta && (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-tenue">
                {cabeceras.map((c) => (
                  <th key={c} className="py-1 pr-3 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="cifras">
              {filas.map((fila) => (
                <tr key={fila.join('|')} className="border-t border-borde">
                  {fila.map((celda, i) => (
                    <td key={i} className="py-1.5 pr-3">
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Cargando() {
  return <div className="h-56 animate-pulse rounded-xl bg-fondo" />
}
