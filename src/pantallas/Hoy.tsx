import Marcador from '../componentes/Marcador'

export default function Hoy() {
  return (
    <Marcador
      titulo="Pantalla de inicio"
      descripcion="Resumen del día: tipo de día, calorías y macros contra objetivo, comidas registradas, entrenamiento y peso de la mañana."
      pendiente={[
        'Selector de día de entreno o descanso',
        'Anillo de calorías y barras de macros',
        'Lista de comidas del día por momento',
        'Tarjeta de entrenamiento del día',
        'Registro rápido del peso',
      ]}
    />
  )
}
