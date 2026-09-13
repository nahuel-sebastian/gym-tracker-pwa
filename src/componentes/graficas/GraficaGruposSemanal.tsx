import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoCorto } from '../../lib/fechas'
import { CURSOR_BARRA, EJE, REJILLA, escalaLimpia } from './comun'
import { CuerpoTooltip, SinDatos } from './piezas'

export type SerieGrupo = { grupo: string; series: number[] }

/**
 * Volumen semanal por grupo, en pequeños múltiplos: una mini gráfica por grupo
 * con **la misma escala** en todas.
 *
 * Siete grupos en un solo dibujo serían siete colores, que es justo donde una
 * paleta categórica deja de distinguirse. Facetar lo resuelve sin colores: cada
 * grupo lleva el de acento, y la escala compartida es lo que permite comparar
 * entre tarjetas. Además responde mejor a la pregunta real —"¿le he bajado a
 * espalda?"— que un apilado, donde una barra que crece mueve todas las demás.
 */
export default function GraficaGruposSemanal({
  semanas,
  porGrupo,
}: {
  semanas: string[]
  porGrupo: SerieGrupo[]
}) {
  if (!porGrupo.length) {
    return <SinDatos>Sin series efectivas en este periodo.</SinDatos>
  }

  const todos = porGrupo.flatMap((g) => g.series)
  const { dominio, marcas } = escalaLimpia([0, ...todos], 3)

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {porGrupo.map(({ grupo, series }) => {
        const datos = semanas.map((semana, i) => ({ semana, series: series[i] }))
        const total = series.reduce((a, b) => a + b, 0)

        return (
          <div key={grupo}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium capitalize">{grupo}</span>
              <span className="cifras text-xs text-tenue">{total}</span>
            </div>

            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {/* Sin margen negativo a la izquierda: el eje tiene que verse,
                    o la escala compartida no se puede comprobar a ojo. */}
                <BarChart data={datos} margin={{ top: 4, right: 2, bottom: 0, left: 0 }}>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="semana" tick={false} axisLine={{ stroke: 'var(--color-rejilla)' }} height={4} />
                  <YAxis domain={dominio} ticks={marcas} width={22} {...EJE} />
                  <Tooltip cursor={CURSOR_BARRA} content={<TarjetaGrupoSemana grupo={grupo} />} />
                  <Bar
                    dataKey="series"
                    fill="var(--color-acento)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={16}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })}
    </div>
  )
}

type PropsTarjeta = {
  active?: boolean
  label?: string
  payload?: { payload?: { semana: string; series: number } }[]
  grupo: string
}

export function TarjetaGrupoSemana({ active, payload, grupo }: PropsTarjeta) {
  const fila = payload?.[0]?.payload
  if (!active || !fila) return null

  return (
    <CuerpoTooltip
      titulo={`${grupo} · semana del ${formatoCorto(fila.semana)}`}
      filas={[
        {
          clave: 'series',
          etiqueta: fila.series === 1 ? 'serie efectiva' : 'series efectivas',
          valor: String(fila.series),
          color: 'var(--color-acento)',
        },
      ]}
    />
  )
}
