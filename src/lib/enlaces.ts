/**
 * Entrada por enlace: el JSON del puente manual puede llegar en la propia URL,
 * para no tener que pegarlo a mano.
 *
 * Se admiten dos sitios y el orden importa:
 *
 *  · **El fragmento** (`#json=…`) es el preferido, y es el que usa el Atajo de
 *    iOS. El fragmento **no se manda al servidor**, así que lo que se ha comido
 *    no acaba en el registro de accesos del host.
 *  · **La cadena de consulta** (`?json=…`) porque es donde lo deja el
 *    `share_target` del manifest, que solo puede usar GET. Ahí sí viaja al
 *    servidor; es el precio de que el sistema operativo lo entregue solo.
 */

const CLAVE = 'json'

export function jsonDeEnlace(hash: string, busqueda: string): string | null {
  return deFragmento(hash) ?? deConsulta(busqueda)
}

function deFragmento(hash: string): string | null {
  const limpio = hash.startsWith('#') ? hash.slice(1) : hash
  if (!limpio) return null

  // El fragmento puede ser `json=…` o venir con más parámetros.
  const params = new URLSearchParams(limpio)
  return normalizar(params.get(CLAVE))
}

function deConsulta(busqueda: string): string | null {
  if (!busqueda) return null
  return normalizar(new URLSearchParams(busqueda).get(CLAVE))
}

function normalizar(valor: string | null): string | null {
  if (valor === null) return null
  const texto = valor.trim()
  return texto ? texto : null
}
