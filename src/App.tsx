import { Navigate, Route, Routes } from 'react-router'
import Cabecera from './componentes/Cabecera'
import BarraPestanas from './componentes/BarraPestanas'
import Hoy from './pantallas/Hoy'
import Comida from './pantallas/Comida'
import Entreno from './pantallas/Entreno'
import Progreso from './pantallas/Progreso'
import Ajustes from './pantallas/Ajustes'

export default function App() {
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
