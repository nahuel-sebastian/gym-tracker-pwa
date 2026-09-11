import { formatoNumero } from '../lib/numeros'
import { porcentaje } from '../lib/nutricion'

type Props = {
  etiqueta: string
  consumido: number
  objetivo: number
  color: string
}

/**
 * Barra de un macro. Sin objetivo sigue enseñando los gramos consumidos: el
 * diario tiene que servir antes de configurar nada.
 */
export default function BarraMacro({ etiqueta, consumido, objetivo, color }: Props) {
  const pct = porcentaje(consumido, objetivo)
  const pasado = pct > 100

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-tenue">{etiqueta}</span>
        <span className="cifras">
          {formatoNumero(consumido)}
          {objetivo > 0 && <span className="text-tenue"> / {formatoNumero(objetivo)} g</span>}
          {objetivo === 0 && <span className="text-tenue"> g</span>}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-borde">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: pasado ? 'var(--color-aviso)' : color,
          }}
        />
      </div>
    </div>
  )
}
