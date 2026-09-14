import { Navigate, useLocation } from 'react-router'

/**
 * La pantalla de importar vivía bajo /comida cuando solo traía macros. Ahora
 * trae rutinas y fichas, así que está en la raíz — pero el atajo del iPhone que
 * ya esté creado apunta a la vieja, y el JSON viaja en el fragmento, que hay
 * que arrastrar en la redirección o se pierde la importación entera.
 *
 * Vive en su propio archivo y no dentro de `App.tsx` para poder probarlo: el
 * módulo de la app arrastra el cliente de Supabase, que exige las variables de
 * entorno y no las hay en CI.
 */
export default function RedirigirAImportar() {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: '/importar', search, hash }} replace />
}
