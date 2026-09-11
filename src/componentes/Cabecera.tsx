import { Link, useLocation, useNavigate } from 'react-router'
import { IconoAjustes } from './Iconos'
import EstadoSync from './EstadoSync'

const titulos: Record<string, string> = {
  '/': 'Hoy',
  '/comida': 'Comida',
  '/entreno': 'Entreno',
  '/progreso': 'Progreso',
  '/ajustes': 'Ajustes',
  '/entreno/rutinas': 'Rutinas',
  '/entreno/catalogo': 'Ejercicios',
}

export default function Cabecera() {
  const { pathname } = useLocation()
  const navegar = useNavigate()

  // Las subpantallas de Entreno no tienen pestaña propia: necesitan volver.
  const esSubpantalla = pathname.startsWith('/entreno/') || pathname === '/ajustes'
  const titulo = titulos[pathname] ?? (pathname.startsWith('/entreno/sesion/') ? 'Sesión' : 'Hoy')

  return (
    <header className="sticky top-0 z-10 border-b border-borde bg-fondo/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-1">
          {esSubpantalla && (
            <button
              onClick={() => navegar(-1)}
              aria-label="Volver"
              className="-ml-2 flex h-11 w-9 items-center justify-center rounded-full text-tenue active:bg-superficie"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h1 className="truncate text-xl font-semibold tracking-tight">{titulo}</h1>
        </div>
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
