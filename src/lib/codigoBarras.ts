import { guardarAlimento } from './acciones'
import { db } from './db'
import { buscarPorCodigoBarras } from './openfoodfacts'
import type { Alimento } from './tipos'

/**
 * Qué hacer con un código de barras recién leído.
 *
 * El orden lo fija el plan y no es casual: **primero la biblioteca propia**.
 * Un producto que ya se ha registrado antes tiene la ficha como la dejó el
 * usuario, quizá corregida a mano, y esa manda sobre lo que diga Open Food
 * Facts. Además así el escáner sigue funcionando sin cobertura para todo lo que
 * se compra habitualmente.
 */

export type Motivo = 'no_esta' | 'incompleto' | 'sin_red'

export type SinFicha = { estado: 'a_mano'; codigo: string; nombre: string; motivo: Motivo }

export type Resolucion =
  | { estado: 'en_biblioteca'; alimento: Alimento }
  | { estado: 'creado'; alimento: Alimento }
  | SinFicha

export async function resolverCodigo(
  codigo: string,
  buscar = buscarPorCodigoBarras,
): Promise<Resolucion> {
  const propio = await db.alimentos.where('codigo_barras').equals(codigo).first()
  if (propio) return { estado: 'en_biblioteca', alimento: propio }

  const resultado = await buscar(codigo)

  if (resultado.estado === 'encontrado') {
    const id = await guardarAlimento({ ...resultado.ficha, origen: 'openfoodfacts' })
    const alimento = await db.alimentos.get(id)
    if (alimento) return { estado: 'creado', alimento }
  }

  return {
    estado: 'a_mano',
    codigo,
    nombre: resultado.estado === 'incompleto' ? resultado.nombre : '',
    motivo: resultado.estado === 'encontrado' ? 'incompleto' : resultado.estado,
  }
}

export const MOTIVO: Record<Motivo, string> = {
  no_esta: 'Ese código no está en Open Food Facts. Dalo de alta a mano y queda guardado para siempre.',
  incompleto: 'Open Food Facts tiene el producto pero no sus macros. Complétalos a mano.',
  sin_red: 'Sin conexión para consultar Open Food Facts. Puedes darlo de alta a mano.',
}
