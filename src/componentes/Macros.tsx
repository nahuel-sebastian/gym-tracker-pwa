import type { Macros as TipoMacros } from '../lib/nutricion'
import type { ObjetivoNutricional } from '../lib/tipos'
import BarraMacro from './BarraMacro'

/** Las tres barras de macros, siempre en el mismo orden y con el mismo color. */
export default function Macros({
  totales,
  objetivo,
}: {
  totales: TipoMacros
  objetivo: ObjetivoNutricional | undefined
}) {
  return (
    <div className="space-y-2.5">
      <BarraMacro
        etiqueta="Proteína"
        consumido={totales.proteina}
        objetivo={objetivo?.proteina_g ?? 0}
        color="var(--color-proteina)"
      />
      <BarraMacro
        etiqueta="Grasa"
        consumido={totales.grasa}
        objetivo={objetivo?.grasa_g ?? 0}
        color="var(--color-grasa)"
      />
      <BarraMacro
        etiqueta="Carbohidratos"
        consumido={totales.carbos}
        objetivo={objetivo?.carbos_g ?? 0}
        color="var(--color-carbos)"
      />
    </div>
  )
}
