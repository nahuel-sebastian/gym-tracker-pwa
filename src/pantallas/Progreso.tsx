import Marcador from '../componentes/Marcador'

export default function Progreso() {
  return (
    <Marcador
      titulo="Progreso"
      descripcion="Evolución del peso, de las cargas y del volumen de entrenamiento."
      pendiente={[
        'Peso corporal con media móvil de 7 días',
        'Progresión por ejercicio: máximo, volumen y 1RM estimado',
        'Medias semanales de calorías y macros por tipo de día',
        'Galería y comparación de fotos',
        'Volumen semanal por grupo muscular',
      ]}
    />
  )
}
