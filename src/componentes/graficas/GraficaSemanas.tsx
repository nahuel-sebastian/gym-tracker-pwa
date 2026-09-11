import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoCorto } from '../../lib/fechas'
import { formatoKcal } from '../../lib/numeros'
import { CURSOR_BARRA, EJE, REJILLA } from './comun'
import { CuerpoTooltip, Leyenda, SinDatos } from './piezas'
import type { TipoDia } from '../../lib/tipos'

export type FilaSemana = {
  semana: string
  entreno: number | null
  descanso: number | null
  diasEntreno: number
  diasDescanso: number
}

/**
 * Media diaria de calorías por semana, separando entreno de descanso.
 *
 * Solo calorías: meter los macros en el mismo dibujo obligaría a un segundo eje
 * con otra escala, y dos ejes inventan una correlación que no está en los
 * datos. Los macros van en la tabla de debajo, que además es la vista sin
 * color de esta misma gráfica.
 */
export default function GraficaSemanas({ filas }: { filas: FilaSemana[] }) {
  if (!filas.length) {
    return <SinDatos>Registra algún día de comida y aquí saldrá la media semanal.</SinDatos>
  }

  return (
    <div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2}>
            <CartesianGrid {...REJILLA} />
            <XAxis dataKey="semana" tickFormatter={formatoCorto} minTickGap={16} {...EJE} />
            <YAxis width={44} tickFormatter={(v: number) => formatoKcal(v)} {...EJE} />
            <Tooltip cursor={CURSOR_BARRA} content={<TarjetaSemana />} />
            <Bar
              dataKey="entreno"
              fill="var(--color-entreno)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="descanso"
              fill="var(--color-descanso)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Leyenda
        series={[
          { etiqueta: 'Días de entreno', color: 'var(--color-entreno)', forma: 'bloque' },
          { etiqueta: 'Días de descanso', color: 'var(--color-descanso)', forma: 'bloque' },
        ]}
      />
    </div>
  )
}

const COLOR: Record<TipoDia, string> = {
  entreno: 'var(--color-entreno)',
  descanso: 'var(--color-descanso)',
}

type PropsTarjeta = {
  active?: boolean
  label?: string
  payload?: { payload?: FilaSemana }[]
}

export function TarjetaSemana({ active, label, payload }: PropsTarjeta) {
  const fila = payload?.[0]?.payload
  if (!active || !label || !fila) return null

  const filas = (['entreno', 'descanso'] as const)
    .filter((tipo) => fila[tipo] !== null)
    .map((tipo) => ({
      clave: tipo,
      etiqueta: `${tipo} · ${tipo === 'entreno' ? fila.diasEntreno : fila.diasDescanso} días`,
      valor: `${formatoKcal(fila[tipo] as number)} kcal`,
      color: COLOR[tipo],
    }))

  if (!filas.length) return null

  return <CuerpoTooltip titulo={`Semana del ${formatoCorto(label)}`} filas={filas} />
}
