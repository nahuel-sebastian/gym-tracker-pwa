/**
 * El sobre: qué clase de cosa trae un JSON pegado o compartido.
 *
 * Hay un solo camino de entrada —una pantalla, un Atajo, un enlace— y es el
 * contenido el que dice qué es, no el usuario. Pedirle que elija el tipo antes
 * de pegar sería pedirle un dato que el texto ya lleva, y abrir la puerta a
 * elegir mal.
 *
 * El campo `tipo` manda. Si no está, se deduce por la forma: los JSON de comida
 * anteriores a esto no lo llevaban y tienen que seguir funcionando.
 */

export type TipoImportable = 'comida' | 'rutina' | 'alimentos'

export const NOMBRE_TIPO: Record<TipoImportable, string> = {
  comida: 'Una comida',
  rutina: 'Una rutina',
  alimentos: 'Fichas de alimentos',
}

export class ErrorDeSobre extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeSobre'
  }
}

/** Quita las vallas de markdown: pegar desde un chat las trae casi siempre. */
export function quitarVallas(texto: string): string {
  const conVallas = texto.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return conVallas ? conVallas[1] : texto
}

export function analizar(texto: string): { tipo: TipoImportable; bruto: unknown } {
  const limpio = quitarVallas(texto).trim()

  if (!limpio) throw new ErrorDeSobre('No has pegado nada.')

  let bruto: unknown
  try {
    bruto = JSON.parse(limpio)
  } catch {
    throw new ErrorDeSobre(
      'Eso no es JSON válido. Copia la respuesta entera de Claude, desde la primera llave hasta la última.',
    )
  }

  return { tipo: tipoDe(bruto), bruto }
}

function tipoDe(bruto: unknown): TipoImportable {
  if (esObjeto(bruto)) {
    const declarado = typeof bruto.tipo === 'string' ? bruto.tipo.trim().toLowerCase() : ''
    if (declarado) {
      if (esTipo(declarado)) return declarado
      throw new ErrorDeSobre(
        `No sé importar cosas de tipo «${declarado}». Los tipos que entiendo son: ${Object.keys(
          NOMBRE_TIPO,
        ).join(', ')}.`,
      )
    }

    // Sin `tipo`, la forma lo dice. Una rutina trae días; una comida, lo que se
    // ha comido; una lista de fichas, valores por 100 g.
    if (Array.isArray(bruto.dias)) return 'rutina'
    if (Array.isArray(bruto.alimentos)) {
      return parecenFichas(bruto.alimentos) ? 'alimentos' : 'comida'
    }
  }

  // Una lista suelta es lo que sale al copiar solo el array de una comida.
  if (Array.isArray(bruto)) return parecenFichas(bruto) ? 'alimentos' : 'comida'

  throw new ErrorDeSobre(
    'No reconozco ese JSON. Añádele un campo "tipo" con uno de estos: ' +
      Object.keys(NOMBRE_TIPO).join(', ') +
      '.',
  )
}

/**
 * Una ficha de biblioteca habla por 100 g; una comida habla del total servido.
 * Es lo único que distingue las dos listas cuando no viene el `tipo`.
 */
function parecenFichas(lista: unknown[]): boolean {
  return lista.some(
    (a) => esObjeto(a) && ('kcal_100g' in a || 'por_100g' in a || 'kcal100' in a),
  )
}

function esTipo(valor: string): valor is TipoImportable {
  return valor in NOMBRE_TIPO
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
