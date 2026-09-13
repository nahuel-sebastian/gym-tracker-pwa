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
import type { Metrica, PuntoEjercicio } from '../../lib/progreso'
import { NOMBRE_METRICA, UNIDAD_METRICA } from '../../lib/progreso'
import { CURSOR_LINEA, EJE, REJILLA, ejeFecha, escalaLimpia } from './comun'
import { CuerpoTooltip, SinDatos } from './piezas'

/**
 * Progresión de un ejercicio: una sesión, un punto.
 *
 * Serie única, así que no lleva leyenda —  el selector de arriba ya dice qué
 * ejercicio y qué métrica se está mirando. El último punto va con su valor
 * escrito al lado: es el número con el que se decide la siguiente sesión.
 */
export default function GraficaEjercicio({
  puntos,
  metrica,
}: {
  puntos: PuntoEjercicio[]
  metrica: Metrica
}) {
  if (puntos.length < 2) {
    return (
      <SinDatos>
        {puntos.length
          ? 'Con una sola sesión todavía no hay progresión que enseñar.'
          : 'Sin series registradas de este ejercicio.'}
      </SinDatos>
    )
  }

  const valores = puntos.map((p) => p.valor)
  const { dominio, marcas } = escalaLimpia(valores)

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* 28 arriba, no 12: la escala se ajusta al dato, así que el punto más
            alto cae en el techo del área y su etiqueta necesita ese hueco o
            sale recortada. */}
        <LineChart data={puntos} margin={{ top: 28, right: 40, bottom: 0, left: -12 }}>
          <CartesianGrid {...REJILLA} />
          <XAxis dataKey="fecha" tickFormatter={ejeFecha} minTickGap={32} {...EJE} />
          <YAxis
            domain={dominio}
            ticks={marcas}
            width={48}
            tickFormatter={(v: number) => formatoNumero(v, 0)}
            {...EJE}
          />
          <Tooltip cursor={CURSOR_LINEA} content={<TarjetaEjercicio metrica={metrica} />} />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--color-acento)"
            strokeWidth={2}
            strokeLinecap="round"
            // Las sesiones son puntos sueltos y espaciados: aquí el marcador sí
            // aporta, con su anillo del color de la superficie para que no se
            // confunda con la línea al solaparse.
            dot={{ r: 4, fill: 'var(--color-acento)', strokeWidth: 2, stroke: 'var(--color-superficie)' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-superficie)' }}
            isAnimationActive={false}
            label={<EtiquetaFinal total={puntos.length} metrica={metrica} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type PropsEtiqueta = {
  x?: number
  y?: number
  index?: number
  value?: number
  total: number
  metrica: Metrica
}

/** Solo el último punto lleva número: etiquetar todos sería ilegible. */
function EtiquetaFinal({ x, y, index, value, total, metrica }: PropsEtiqueta) {
  if (index !== total - 1 || x === undefined || y === undefined) return null

  return (
    <text
      x={x}
      y={y - 10}
      textAnchor="end"
      className="cifras"
      fill="var(--color-texto)"
      fontSize={12}
      fontWeight={600}
    >
      {formatoNumero(value ?? 0, 1)} {UNIDAD_METRICA[metrica]}
    </text>
  )
}

type PropsTarjeta = {
  active?: boolean
  label?: string
  payload?: { payload?: PuntoEjercicio }[]
  metrica: Metrica
}

export function TarjetaEjercicio({ active, label, payload, metrica }: PropsTarjeta) {
  const punto = payload?.[0]?.payload
  if (!active || !label || !punto) return null

  return (
    <CuerpoTooltip
      titulo={formatoLargo(label)}
      filas={[
        {
          clave: 'valor',
          etiqueta: NOMBRE_METRICA[metrica].toLowerCase(),
          valor: `${formatoNumero(punto.valor, 1)} ${UNIDAD_METRICA[metrica]}`,
          color: 'var(--color-acento)',
        },
        {
          clave: 'series',
          etiqueta: punto.series === 1 ? 'serie efectiva' : 'series efectivas',
          valor: String(punto.series),
          color: 'var(--color-tenue)',
        },
      ]}
    />
  )
}
