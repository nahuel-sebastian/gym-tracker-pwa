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
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
