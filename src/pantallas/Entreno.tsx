import { Link, useNavigate } from 'react-router'
import { Boton, Tarjeta } from '../componentes/Formulario'
import {
  useDiasDeRutina,
  useHoy,
  useRutinaActiva,
  useSesiones,
} from '../lib/consultas'
import { formatoRelativo } from '../lib/fechas'
import { empezarSesion } from '../lib/rutinas'
import type { RutinaDia } from '../lib/tipos'

/**
 * Punto de partida del entreno: seguir lo que está a medias, o empezar el día
 * que toca. Todo lo demás (rutinas, catálogo) está un toque por debajo.
 */
export default function Entreno() {
  const fecha = useHoy()
  const rutina = useRutinaActiva()
  const dias = useDiasDeRutina(rutina?.id)
  const sesiones = useSesiones(15)
  const navegar = useNavigate()

  const enCurso = sesiones.find((s) => !s.hora_fin)

  async function empezar(dia?: RutinaDia) {
    const id = await empezarSesion(fecha, dia)
    navegar(`/entreno/sesion/${id}`)
  }

  return (
    <div className="space-y-4">
      {enCurso && (
        <Tarjeta>
          <h2 className="text-base font-semibold">Sesión a medias</h2>
          <p className="mt-1 text-sm text-tenue">
            {enCurso.nombre_dia ?? 'Sesión libre'} · {formatoRelativo(enCurso.fecha)}
          </p>
          <Link
            to={`/entreno/sesion/${enCurso.id}`}
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-acento font-semibold text-fondo active:opacity-70"
          >
            Continuar
          </Link>
        </Tarjeta>
      )}

      <Tarjeta>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">{rutina?.nombre ?? 'Sin rutina activa'}</h2>
          <Link to="/entreno/rutinas" className="text-sm font-medium text-acento">
            Rutinas
          </Link>
        </div>

        {dias.length > 0 ? (
          <div className="mt-3 space-y-2">
            {dias.map((d) => (
              <button
                key={d.id}
                onClick={() => void empezar(d)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-borde px-4 text-left text-sm font-medium active:bg-fondo"
              >
                {d.nombre}
                <span className="text-tenue">Empezar</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-tenue">
            {rutina
              ? 'Esta rutina no tiene días todavía.'
              : 'Crea una rutina, o entrena suelto y añade los ejercicios sobre la marcha.'}
          </p>
        )}

        <div className="mt-3">
          <Boton variante="secundario" onClick={() => void empezar()}>
            Sesión libre
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Historial</h2>
          <Link to="/entreno/catalogo" className="text-sm font-medium text-acento">
            Ejercicios
          </Link>
        </div>

        {sesiones.length === 0 ? (
          <p className="mt-1 text-sm text-tenue">Todavía no has registrado ninguna sesión.</p>
        ) : (
          <ul className="mt-2 divide-y divide-borde">
            {sesiones.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/entreno/sesion/${s.id}`}
                  className="flex min-h-12 items-center justify-between text-sm active:opacity-70"
                >
                  <span>{s.nombre_dia ?? 'Sesión libre'}</span>
                  <span className="text-tenue">
                    {formatoRelativo(s.fecha)}
                    {!s.hora_fin && ' · a medias'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  )
}
