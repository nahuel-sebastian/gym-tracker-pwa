import Marcador from '../componentes/Marcador'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'

export default function Ajustes() {
  const { sesion } = useSesion()

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-borde bg-superficie p-4">
        <h2 className="text-base font-semibold">Cuenta</h2>
        <p className="mt-1 text-sm text-tenue">{sesion?.user.email}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-3 min-h-11 w-full rounded-xl border border-borde font-medium text-red-500 active:bg-fondo"
        >
          Cerrar sesión
        </button>
      </section>

      <Marcador
        titulo="Ajustes"
        descripcion="Objetivos nutricionales y herramientas de datos."
        pendiente={[
          'Objetivos de entreno y descanso',
          'Instrucciones copiables para el puente manual de macros',
          'Exportación completa a JSON',
        ]}
      />
    </div>
  )
}
