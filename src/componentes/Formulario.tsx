import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

/**
 * Primitivas de formulario, con los detalles de iPhone resueltos de una vez:
 * teclado numérico en los campos de cifras, 44px de alto mínimo en todo lo que
 * se toca, y 16px de fuente en los inputs para que Safari no haga zoom al
 * enfocar (está en `index.css`).
 */

type PropsCampo = {
  etiqueta: string
  sufijo?: string
  ayuda?: string
} & InputHTMLAttributes<HTMLInputElement>

export function Campo({ etiqueta, sufijo, ayuda, className = '', ...resto }: PropsCampo) {
  return (
    <label className="block">
      {etiqueta && <span className="mb-1 block text-sm text-tenue">{etiqueta}</span>}
      <div className="relative">
        <input
          // El nombre accesible se pone a mano: el texto de la etiqueta incluye
          // el sufijo y la ayuda, y "Proteína g" no es el nombre del campo.
          aria-label={etiqueta || undefined}
          {...resto}
          className={`min-h-12 w-full rounded-xl border border-borde bg-fondo px-3 outline-none focus:border-acento ${sufijo ? 'pr-10' : ''} ${className}`}
        />
        {sufijo && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-tenue">
            {sufijo}
          </span>
        )}
      </div>
      {ayuda && <span className="mt-1 block text-xs text-tenue">{ayuda}</span>}
    </label>
  )
}

/** Campo de cifras: abre el teclado numérico y alinea en tabular. */
export function CampoNumero(props: PropsCampo) {
  return (
    <Campo
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      {...props}
      className={`cifras ${props.className ?? ''}`}
    />
  )
}

type PropsBoton = {
  children: ReactNode
  variante?: 'principal' | 'secundario' | 'peligro'
} & ButtonHTMLAttributes<HTMLButtonElement>

const ESTILOS = {
  principal: 'bg-acento font-semibold text-fondo',
  secundario: 'border border-borde font-medium',
  peligro: 'border border-borde font-medium text-error',
} as const

export function Boton({ children, variante = 'principal', className = '', ...resto }: PropsBoton) {
  return (
    <button
      {...resto}
      className={`min-h-12 w-full rounded-xl transition-opacity active:opacity-70 disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
    >
      {children}
    </button>
  )
}

type PropsSegmentado<T extends string> = {
  opciones: { valor: T; etiqueta: string }[]
  valor: T | null
  onCambio: (valor: T) => void
}

/** Selector de dos o tres opciones, del ancho completo para poder acertar. */
export function Segmentado<T extends string>({ opciones, valor, onCambio }: PropsSegmentado<T>) {
  return (
    <div role="radiogroup" className="flex gap-2">
      {opciones.map((o) => {
        const activa = o.valor === valor
        return (
          <button
            key={o.valor}
            role="radio"
            aria-checked={activa}
            onClick={() => onCambio(o.valor)}
            className={`min-h-12 flex-1 rounded-xl border text-sm font-medium transition-colors ${
              activa
                ? 'border-acento bg-acento/10 text-acento'
                : 'border-borde text-tenue active:bg-fondo'
            }`}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

/** Tarjeta: el contenedor de todo bloque de contenido de la app. */
export function Tarjeta({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-borde bg-superficie p-4 ${className}`}>
      {children}
    </section>
  )
}
