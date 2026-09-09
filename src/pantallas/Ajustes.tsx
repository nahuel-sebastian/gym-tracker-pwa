import Marcador from '../componentes/Marcador'

export default function Ajustes() {
  return (
    <Marcador
      titulo="Ajustes"
      descripcion="Cuenta, objetivos nutricionales y herramientas de datos."
      pendiente={[
        'Sesión y cierre de sesión',
        'Objetivos de entreno y descanso',
        'Instrucciones copiables para el puente manual de macros',
        'Exportación completa a JSON',
      ]}
    />
  )
}
