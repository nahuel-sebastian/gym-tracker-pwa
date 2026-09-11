import type { ReactNode } from 'react'

/** Piezas de las gráficas que son componentes. Las constantes van en `comun.ts`. */

type FilaTooltip = { clave: string; etiqueta: string; valor: string; color: string }

/**
 * Cuerpo del tooltip: el valor manda y el nombre de la serie va detrás, que es
 * al revés que en la leyenda —  aquí el lector ya sabe qué serie mira y lo que
 * quiere es el número.
 */
export function CuerpoTooltip({
  titulo,
  filas,
}: {
  titulo: string
  filas: FilaTooltip[]
}): ReactNode {
  return (
    <div className="rounded-xl border border-borde bg-superficie px-3 py-2 shadow-lg">
      <p className="text-xs text-tenue">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {filas.map((f) => (
          <li key={f.clave} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: f.color }}
            />
            <span className="cifras font-semibold">{f.valor}</span>
            <span className="text-xs text-tenue">{f.etiqueta}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Leyenda con clave de línea o de bloque, según lo que dibuje la serie. */
export function Leyenda({
  series,
}: {
  series: { etiqueta: string; color: string; forma?: 'linea' | 'bloque' }[]
}) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <li key={s.etiqueta} className="flex items-center gap-1.5 text-xs text-tenue">
          <span
            aria-hidden
            className={s.forma === 'bloque' ? 'h-2.5 w-2.5 rounded-sm' : 'h-0.5 w-4 rounded-full'}
            style={{ backgroundColor: s.color }}
          />
          {s.etiqueta}
        </li>
      ))}
    </ul>
  )
}

/** Mensaje cuando todavía no hay con qué dibujar. */
export function SinDatos({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-tenue">{children}</p>
}
