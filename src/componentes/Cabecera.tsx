import { Link, useLocation } from 'react-router'
import { IconoAjustes } from './Iconos'
import EstadoSync from './EstadoSync'

const titulos: Record<string, string> = {
  '/': 'Hoy',
  '/comida': 'Comida',
  '/entreno': 'Entreno',
  '/progreso': 'Progreso',
  '/ajustes': 'Ajustes',
}

export default function Cabecera() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-10 border-b border-borde bg-fondo/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {titulos[pathname] ?? 'Hoy'}
        </h1>
        <div className="flex items-center gap-1">
          <EstadoSync />
          <Link
            to="/ajustes"
            aria-label="Ajustes"
            className="flex h-11 w-11 items-center justify-center rounded-full text-tenue active:bg-superficie"
          >
            <IconoAjustes />
          </Link>
        </div>
      </div>
    </header>
  )
}
