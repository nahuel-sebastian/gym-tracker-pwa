import { Navigate, Route, Routes } from 'react-router'
import BarraPestanas from './componentes/BarraPestanas'
import Cabecera from './componentes/Cabecera'
import { useSesion } from './lib/sesion'
import Ajustes from './pantallas/Ajustes'
import Comida from './pantallas/Comida'
import Entreno from './pantallas/Entreno'
import Hoy from './pantallas/Hoy'
import Login from './pantallas/Login'
import Progreso from './pantallas/Progreso'

export default function App() {
  const { sesion, cargando } = useSesion()

  // getSession lee de localStorage, así que este estado dura milisegundos.
  // Se pinta el fondo a secas para no provocar un parpadeo de contenido.
  if (cargando) return <div className="min-h-dvh bg-fondo" />

  if (!sesion) return <Login />

  return (
    <div className="flex min-h-dvh flex-col bg-fondo text-texto">
      <Cabecera />
      <main className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-3">
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/comida" element={<Comida />} />
          <Route path="/entreno" element={<Entreno />} />
          <Route path="/progreso" element={<Progreso />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BarraPestanas />
    </div>
  )
}
