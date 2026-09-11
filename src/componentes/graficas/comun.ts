import { formatoCorto } from '../../lib/fechas'

/**
 * Piezas comunes a todas las gráficas.
 *
 * Los colores se pasan como `var(--color-…)`: SVG resuelve las variables CSS,
 * así que el tema oscuro entra solo sin duplicar componentes. Los pasos de cada
 * tema están validados aparte contra su propia superficie.
 */

/** Rejilla y ejes: línea de un pixel, sólida (nunca discontinua) y recesiva. */
export const EJE = {
  stroke: 'var(--color-rejilla)',
  tick: { fill: 'var(--color-tenue)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--color-rejilla)' },
} as const

export const REJILLA = {
  stroke: 'var(--color-rejilla)',
  strokeDasharray: '0',
  vertical: false,
} as const

export const CURSOR_LINEA = { stroke: 'var(--color-rejilla)', strokeWidth: 1 }
export const CURSOR_BARRA = { fill: 'var(--color-tenue)', fillOpacity: 0.08 }

export function ejeFecha(fecha: string): string {
  return formatoCorto(fecha)
}

const PASOS = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

/**
 * Dominio y marcas del eje Y en números redondos.
 *
 * Dejar que la librería reparta el rango da escalas como 83 / 81,5 / 79,5: tres
 * saltos distintos en el mismo eje, y hay que pararse a leerlos. Las marcas del
 * eje llevan los valores que no se etiquetan a mano, así que tienen que poder
 * leerse de un vistazo.
 */
export function escalaLimpia(
  valores: number[],
  objetivo = 5,
): { dominio: [number, number]; marcas: number[] } {
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1

  const paso = PASOS.find((p) => rango / p <= objetivo) ?? PASOS[PASOS.length - 1]
  const desde = Math.floor(min / paso) * paso
  const hasta = Math.ceil(max / paso) * paso

  const marcas: number[] = []
  for (let v = desde; v <= hasta + paso / 2; v += paso) {
    marcas.push(Math.round(v * 100) / 100)
  }

  return { dominio: [desde, hasta], marcas }
}
