import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatoLargo } from '../../lib/fechas'
import { formatoNumero } from '../../lib/numeros'
import type { PuntoPeso } from '../../lib/progreso'
import { CURSOR_LINEA, EJE, REJILLA, ejeFecha, escalaLimpia } from './comun'
import { CuerpoTooltip, Leyenda, SinDatos } from './piezas'

/**
 * Peso corporal: la media móvil de 7 días delante, el dato diario detrás.
 *
 * El peso diario fluctúa por agua y glucógeno; el número crudo es ruido y la
 * media es la señal. Por eso la media lleva la línea gruesa y el color de
 * acento, y el diario va en un pelo tenue: sigue estando, pero no manda.
 */
export default function GraficaPeso({ puntos }: { puntos: PuntoPeso[] }) {
  if (puntos.length < 2) {
    return <SinDatos>Pésate un par de días y aparecerá la tendencia.</SinDatos>
  }

  const pesos = puntos.flatMap((p) => [p.peso, p.media]).filter((v): v is number => v !== null)
  const { dominio, marcas } = escalaLimpia(pesos)

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid {...REJILLA} />
            <XAxis dataKey="fecha" tickFormatter={ejeFecha} minTickGap={32} {...EJE} />
            <YAxis
              domain={dominio}
              ticks={marcas}
              width={44}
              tickFormatter={(v) => formatoNumero(v, 1)}
              {...EJE}
            />
            <Tooltip cursor={CURSOR_LINEA} content={<TarjetaPeso />} />

            {/* El dato diario, conectando los huecos para que una semana sin
                báscula no parta la línea en trozos sueltos. */}
            <Line
              type="monotone"
              dataKey="peso"
              stroke="var(--color-tenue)"
              strokeWidth={1}
              strokeOpacity={0.5}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="media"
              stroke="var(--color-acento)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-superficie)' }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Leyenda
        series={[
          { etiqueta: 'Media de 7 días', color: 'var(--color-acento)' },
          { etiqueta: 'Peso diario', color: 'var(--color-tenue)' },
        ]}
      />
    </div>
  )
}

type PropsTarjeta = {
  active?: boolean
  label?: string
  payload?: { dataKey?: string | number; value?: number | null }[]
}

export function TarjetaPeso({ active, label, payload }: PropsTarjeta) {
  if (!active || !label) return null

  const valor = (clave: string) =>
    payload?.find((p) => p.dataKey === clave)?.value ?? null

  const filas = [
    { clave: 'media', etiqueta: 'media 7 días', color: 'var(--color-acento)', bruto: valor('media') },
    { clave: 'peso', etiqueta: 'ese día', color: 'var(--color-tenue)', bruto: valor('peso') },
  ]
    .filter((f) => f.bruto !== null)
    .map((f) => ({ ...f, valor: `${formatoNumero(f.bruto as number, 2)} kg` }))

  if (!filas.length) return null

  return <CuerpoTooltip titulo={formatoLargo(label)} filas={filas} />
}
