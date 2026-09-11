import { useEffect, type ReactNode } from 'react'

type Props = {
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

/**
 * Panel que sube desde abajo.
 *
 * Todo lo que se rellena en esta app se rellena aquí: en un iPhone con una
 * mano, lo que aparece pegado al borde inferior queda al alcance del pulgar,
 * y no pierde el contexto de la pantalla que hay detrás.
 *
 * No tiene estado de "abierta": se monta cuando hay algo que enseñar y se
 * desmonta al cerrar. Así el formulario de dentro nace con sus valores
 * iniciales en vez de sincronizarlos con un efecto en cada apertura.
 */
export default function Hoja({ titulo, onCerrar, children }: Props) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsar)

    // Sin esto, arrastrar dentro del panel mueve la página de detrás.
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = previo
    }
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-borde bg-superficie pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-superficie px-4 py-3">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-tenue active:bg-fondo"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-4 pt-4">{children}</div>
      </div>
    </div>
  )
}
