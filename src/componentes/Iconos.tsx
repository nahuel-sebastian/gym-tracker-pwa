type Props = { className?: string }

const base = 'h-6 w-6'

export function IconoHoy({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
    </svg>
  )
}

export function IconoComida({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M6 2.5v8a2.5 2.5 0 0 0 5 0v-8M8.5 10.5V21.5" strokeLinecap="round" />
      <path d="M17.5 2.5c-1.7 1.3-2.5 3.2-2.5 5.5s.8 3.5 2.5 4v9.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconoEntreno({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M8 12h8M5 8.5v7M8 6.5v11M16 6.5v11M19 8.5v7" strokeLinecap="round" />
    </svg>
  )
}

export function IconoProgreso({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M4 19.5V4.5" strokeLinecap="round" />
      <path d="M4 19.5h16" strokeLinecap="round" />
      <path d="M7.5 15l3.5-4.5 3 2.5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconoAjustes({ className = base }: Props) {
  // Engranaje con dientes, no un círculo con rayos: lo segundo se lee como un
  // sol, es decir, como un interruptor de tema claro y oscuro.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56v.17a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H2.8a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.45 8.5a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 9.92 2.6v-.17a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03h.17a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1.03Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
