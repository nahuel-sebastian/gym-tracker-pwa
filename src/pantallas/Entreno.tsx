import Marcador from '../componentes/Marcador'

export default function Entreno() {
  return (
    <Marcador
      titulo="Entrenamiento"
      descripcion="Sesiones, series y gestión de rutinas."
      pendiente={[
        'Iniciar sesión desde la rutina activa o libre',
        'Filas de series con peso, reps y RIR',
        'Vista de la última vez en cada ejercicio',
        'Añadir ejercicio fuera del plan',
        'Notas y sensación de la sesión',
        'Gestión de rutinas y catálogo de ejercicios',
      ]}
    />
  )
}
