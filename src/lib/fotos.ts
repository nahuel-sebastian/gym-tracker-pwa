import { borrar, guardar } from './datos'
import { db } from './db'
import { supabase } from './supabase'
import type { Angulo } from './tipos'

/**
 * Fotos de progreso.
 *
 * Es la única parte de la app que **necesita conexión**. Todo lo demás pasa por
 * la cola de escrituras, pero la cola guarda filas, no archivos: meter fotos en
 * IndexedDB para subirlas luego llenaría el almacenamiento del teléfono y es
 * justo lo que iOS desaloja cuando anda justo. La fila de `fotos_progreso` se
 * crea solo después de que la imagen esté arriba, así que nunca queda una foto
 * en el histórico que no se pueda abrir.
 */

const BUCKET = 'fotos'

/** Lado mayor y calidad que pide el plan, para no agotar el giga del plan gratuito. */
const LADO_MAYOR = 1600
const CALIDAD = 0.8

export class ErrorDeFoto extends Error {}

/**
 * Redimensiona en el cliente antes de subir.
 *
 * Una foto de un iPhone son 3–5 MB; a 1600 px y calidad 0,8 se queda en unos
 * 300 kB sin que se note para comparar dos posturas. Sin esto, cien fotos se
 * comerían un tercio del plan gratuito.
 */
export async function redimensionar(archivo: Blob): Promise<Blob> {
  const imagen = await cargarImagen(archivo)

  const escala = Math.min(1, LADO_MAYOR / Math.max(imagen.width, imagen.height))
  const ancho = Math.round(imagen.width * escala)
  const alto = Math.round(imagen.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto

  const contexto = lienzo.getContext('2d')
  if (!contexto) throw new ErrorDeFoto('Este navegador no puede procesar la imagen.')

  contexto.drawImage(imagen, 0, 0, ancho, alto)
  cerrar(imagen)

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', CALIDAD),
  )

  if (!blob) throw new ErrorDeFoto('No he podido convertir la imagen.')
  return blob
}

async function cargarImagen(archivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap respeta la orientación EXIF, que es lo que evita que una
  // foto hecha en vertical se suba tumbada.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    } catch {
      /* Safari antiguo: se sigue por el camino del <img>. */
    }
  }

  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function cerrar(imagen: ImageBitmap | HTMLImageElement): void {
  if ('close' in imagen) imagen.close()
}

/**
 * Sube la foto y crea su fila. La ruta empieza por el id del usuario, que es lo
 * que comprueban las políticas del bucket.
 */
export async function subirFoto(
  archivo: Blob,
  fecha: string,
  angulo: Angulo | null,
): Promise<string> {
  const { data: sesion } = await supabase.auth.getSession()
  const idUsuario = sesion.session?.user.id
  if (!idUsuario) throw new ErrorDeFoto('No hay sesión.')

  const comprimida = await redimensionar(archivo)
  const ruta = `${idUsuario}/${crypto.randomUUID()}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, comprimida, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (error) {
    throw new ErrorDeFoto(
      navigator.onLine
        ? `No he podido subir la foto: ${error.message}`
        : 'Las fotos necesitan conexión. Vuelve a intentarlo con cobertura.',
    )
  }

  // El peso del día se copia en la foto: así la galería sigue diciendo con qué
  // peso se hizo aunque luego se corrija la medida.
  const medida = await db.medidas_corporales.where('fecha').equals(fecha).first()

  return guardar('fotos_progreso', {
    fecha,
    ruta_storage: ruta,
    angulo,
    peso_kg: medida?.peso_kg ?? null,
  })
}

/**
 * URL firmada para enseñar una foto. El bucket es privado, así que no hay
 * enlaces permanentes: cada vista pide una firma de una hora.
 */
export async function urlFirmada(ruta: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 3600)
  return error ? null : data.signedUrl
}

/**
 * Borra la foto: primero el archivo, después la fila.
 *
 * Ese orden deja como único fallo posible un archivo huérfano en Storage, que
 * no se ve desde ningún sitio y no cuenta como dato perdido. Al revés, un fallo
 * dejaría una fila en la galería que no se puede abrir.
 */
export async function borrarFoto(id: string, ruta: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([ruta])

  if (error) {
    throw new ErrorDeFoto(
      navigator.onLine
        ? `No he podido borrar la foto: ${error.message}`
        : 'Borrar una foto necesita conexión.',
    )
  }

  await borrar('fotos_progreso', id)
}
