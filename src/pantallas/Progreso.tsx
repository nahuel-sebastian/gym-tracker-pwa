import { Suspense, lazy, useMemo, useState } from 'react'
import { Segmentado, Tarjeta } from '../componentes/Formulario'
import {
  useCatalogo,
  useHoy,
  useMedidas,
  useRegistros,
  useSeriesDe,
  useSesionesDesde,
  useTiposDeDia,
} from '../lib/consultas'
import { formatoCorto, sumarDias } from '../lib/fechas'
import { formatoKcal, formatoNumero } from '../lib/numeros'
import {
  NOMBRE_METRICA,
  UNIDAD_METRICA,
  mediasSemanales,
  progresionEjercicio,
  serieDePeso,
  tendenciaPeso,
  volumenPorGrupo,
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

  const puntosPeso = useMemo(() => serieDePeso(medidas), [medidas])
  const tendencia = useMemo(() => tendenciaPeso(puntosPeso), [puntosPeso])

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
