import { formatoKcal } from '../lib/numeros'

type Props = {
  consumido: number
  objetivo: number
}

const RADIO = 68
const GROSOR = 12
const PERIMETRO = 2 * Math.PI * RADIO

/**
 * Anillo de calorías. Es lo primero que se mira al abrir la app, así que dice
 * en grande lo único que se necesita decidir: cuánto queda por comer.
 *
 * Pasarse se ve: el anillo se completa y cambia de color, no se recorta al
 * 100 %. Un diario que oculta el exceso no sirve para nada.
 */
export default function Anillo({ consumido, objetivo }: Props) {
  const proporcion = objetivo > 0 ? consumido / objetivo : 0
  const restante = objetivo - consumido
  const pasado = restante < 0

  const avance = Math.min(proporcion, 1)
  const color = pasado ? 'var(--color-aviso)' : 'var(--color-acento)'

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={RADIO}
          fill="none"
          stroke="var(--color-borde)"
          strokeWidth={GROSOR}
        />
        <circle
          cx="80"
          cy="80"
          r={RADIO}
          fill="none"
          stroke={color}
          strokeWidth={GROSOR}
          strokeLinecap="round"
          strokeDasharray={PERIMETRO}
          strokeDashoffset={PERIMETRO * (1 - avance)}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {objetivo > 0 ? (
          <>
            <span className="cifras text-3xl font-semibold tabular-nums">
              {formatoKcal(Math.abs(restante))}
            </span>
            <span className="text-xs text-tenue">
              {pasado ? 'kcal de más' : 'kcal restantes'}
            </span>
            <span className="cifras mt-1 text-xs text-tenue">
              {formatoKcal(consumido)} / {formatoKcal(objetivo)}
            </span>
          </>
        ) : (
          <>
            <span className="cifras text-3xl font-semibold">{formatoKcal(consumido)}</span>
            <span className="text-xs text-tenue">kcal hoy</span>
            <span className="mt-1 text-xs text-tenue">sin objetivo</span>
          </>
        )}
      </div>
    </div>
  )
}
