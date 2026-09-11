import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import BarraPestanas from './componentes/BarraPestanas'
import Cabecera from './componentes/Cabecera'
import { arrancarSincronizacion } from './lib/sincronizacion'
import { useSesion } from './lib/sesion'
import Ajustes from './pantallas/Ajustes'
import Catalogo from './pantallas/Catalogo'
import Comida from './pantallas/Comida'
import Entreno from './pantallas/Entreno'
import Hoy from './pantallas/Hoy'
import Login from './pantallas/Login'
import Progreso from './pantallas/Progreso'
import Rutinas from './pantallas/Rutinas'
import Sesion from './pantallas/Sesion'

export default function App() {
  const { sesion, cargando } = useSesion()
  const idUsuario = sesion?.user.id

  useEffect(() => {
    if (!idUsuario) return
    let limpiar: (() => void) | undefined
    let cancelado = false

    void arrancarSincronizacion(idUsuario).then((fn) => {
      if (cancelado) fn()
      else limpiar = fn
    })

    return () => {
      cancelado = true
      limpiar?.()
    }
  }, [idUsuario])

  // getSession lee de localStorage, así que este estado dura milisegundos.
  // Se pinta el fondo a secas para no provocar un parpadeo de contenido.
  if (cargando) return <div className="min-h-dvh bg-fondo" />

  if (!sesion) return <Login />

  return (
    <div className="flex min-h-dvh flex-col bg-fondo text-texto">
      <Cabecera />
      {/* La app está pensada para un iPhone; en una pantalla ancha se centra a
          la anchura de un móvil en vez de estirarse, que es como se diseñó y
          como se va a usar. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-3">
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/comida" element={<Comida />} />
          <Route path="/entreno" element={<Entreno />} />
          <Route path="/entreno/sesion/:id" element={<Sesion />} />
          <Route path="/entreno/rutinas" element={<Rutinas />} />
          <Route path="/entreno/catalogo" element={<Catalogo />} />
          <Route path="/progreso" element={<Progreso />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BarraPestanas />
    </div>
  )
}
