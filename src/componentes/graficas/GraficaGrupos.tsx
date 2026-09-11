import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { VolumenGrupo } from '../../lib/progreso'
import { CURSOR_BARRA, EJE, REJILLA, escalaLimpia } from './comun'
import { CuerpoTooltip, SinDatos } from './piezas'

/**
 * Series efectivas por grupo muscular.
 *
 * Se cuentan series y no kilos: es la medida con la que se programa el volumen,
 * y deja comparar un press de banca con un curl. Una sola serie de datos, así
 * que todas las barras van del mismo color: teñirlas según su tamaño repetiría
 * en el color lo que ya dice la longitud.
 */
export default function GraficaGrupos({ datos }: { datos: VolumenGrupo[] }) {
  if (!datos.length) {
    return <SinDatos>Sin series efectivas en este periodo.</SinDatos>
  }

  const { dominio, marcas } = escalaLimpia([0, ...datos.map((d) => d.series)], 4)

  return (
    <div style={{ height: datos.length * 40 + 32 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
        >
          <CartesianGrid {...REJILLA} vertical horizontal={false} />
          <XAxis type="number" domain={dominio} ticks={marcas} allowDecimals={false} {...EJE} />
          <YAxis type="category" dataKey="grupo" width={72} {...EJE} />
          <Tooltip cursor={CURSOR_BARRA} content={<TarjetaGrupo />} />
          <Bar
            dataKey="series"
            fill="var(--color-acento)"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            isAnimationActive={false}
            label={<Valor />}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** El número va fuera de la punta: dentro no cabe en las barras cortas. */
function Valor({ x, y, width, height, value }: Record<string, number | undefined>) {
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null

  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dominantBaseline="central"
      className="cifras"
      fill="var(--color-tenue)"
      fontSize={12}
    >
      {value}
    </text>
  )
}

type PropsTarjeta = {
  active?: boolean
  payload?: { payload?: VolumenGrupo }[]
}

export function TarjetaGrupo({ active, payload }: PropsTarjeta) {
  const fila = payload?.[0]?.payload
  if (!active || !fila) return null

  return (
    <CuerpoTooltip
      titulo={fila.grupo}
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
