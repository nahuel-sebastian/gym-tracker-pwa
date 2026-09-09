import Marcador from '../componentes/Marcador'

export default function Comida() {
  return (
    <Marcador
      titulo="Registro de comidas"
      descripcion="Biblioteca propia de alimentos, recetas y las vías rápidas de registro."
      pendiente={[
        'Buscador ordenado por veces usado',
        'Alta manual de alimentos',
        'Recetas y comidas guardadas',
        'Duplicar día anterior',
        'Escáner de código de barras y Open Food Facts',
        'Importar JSON de macros',
      ]}
    />
  )
}
