import { NavLink } from 'react-router'
import { IconoComida, IconoEntreno, IconoHoy, IconoProgreso } from './Iconos'

const pestanas = [
  { ruta: '/', etiqueta: 'Hoy', Icono: IconoHoy },
  { ruta: '/comida', etiqueta: 'Comida', Icono: IconoComida },
  { ruta: '/entreno', etiqueta: 'Entreno', Icono: IconoEntreno },
  { ruta: '/progreso', etiqueta: 'Progreso', Icono: IconoProgreso },
]

export default function BarraPestanas() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="flex">
        {pestanas.map(({ ruta, etiqueta, Icono }) => (
          <li key={ruta} className="flex-1">
            <NavLink
              to={ruta}
              end={ruta === '/'}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-acento' : 'text-tenue'
                }`
              }
            >
              <Icono className="h-6 w-6" />
              {etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
