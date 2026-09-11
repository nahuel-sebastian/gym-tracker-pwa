import type { Momento } from './tipos'
import { MOMENTOS } from './momentos'

/**
 * Estimación nutricional.
 *
 * El plan prohíbe llamar a ninguna API de modelos, y resuelve el problema con
 * un puente manual: el usuario analiza la foto en la aplicación de Claude y
 * pega aquí el JSON que le devuelve. Pero pide además que exista esta capa,
 * con una interfaz y una sola implementación, para que contratar mañana una API
 * de visión sea escribir otra implementación y cambiar la configuración — no
 * reescribir la pantalla de importar.
 *
 * De ahí que `estimarMacros` reciba una `EntradaEstimacion` genérica (hoy solo
 * texto, mañana quizá un `Blob` de imagen) y devuelva siempre lo mismo.
 */

export type AlimentoEstimado = {
  nombre: string
  gramos: number | null
  kcal: number
  proteina: number
  grasa: number
  carbos: number
}

export type Estimacion = {
  alimentos: AlimentoEstimado[]
  momento: Momento | null
}

export type EntradaEstimacion =
  | { tipo: 'texto'; contenido: string }
  | { tipo: 'imagen'; contenido: Blob }

export interface Estimador {
  readonly nombre: string
  /** Qué entradas acepta, para que la interfaz enseñe lo que toque. */
  readonly acepta: EntradaEstimacion['tipo'][]
  estimar(entrada: EntradaEstimacion): Promise<Estimacion>
}

/** Error con un mensaje pensado para enseñárselo al usuario tal cual. */
export class ErrorDeFormato extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeFormato'
  }
}

// -----------------------------------------------------------------------------
// Puente manual: el JSON pegado
// -----------------------------------------------------------------------------

export const puenteManual: Estimador = {
  nombre: 'Puente manual',
  acepta: ['texto'],
  async estimar(entrada) {
    if (entrada.tipo !== 'texto') {
      throw new ErrorDeFormato('El puente manual solo acepta texto pegado.')
    }
    return interpretar(entrada.contenido)
  },
}

/** La implementación en uso. Cambiarla es cambiar esta línea. */
export const estimador: Estimador = puenteManual

export function estimarMacros(entrada: EntradaEstimacion): Promise<Estimacion> {
  return estimador.estimar(entrada)
}

// -----------------------------------------------------------------------------
// El parser
// -----------------------------------------------------------------------------

/**
 * Interpreta el JSON del puente manual.
 *
 * Es tolerante con la forma (vallas de markdown, una lista suelta, números como
 * texto con coma decimal) porque eso es lo que llega de verdad al pegar desde
 * un chat, y **estricto con los datos**: si falta un macro o no es un número,
 * falla con un mensaje concreto en vez de guardar un cero silencioso. Aquí es
 * donde se pierden datos sin que nadie se entere.
 */
export function interpretar(texto: string): Estimacion {
  const limpio = quitarVallas(texto).trim()

  if (!limpio) {
    throw new ErrorDeFormato('No has pegado nada.')
  }

  let bruto: unknown
  try {
    bruto = JSON.parse(limpio)
  } catch {
    throw new ErrorDeFormato(
      'Eso no es JSON válido. Copia la respuesta entera de Claude, desde la primera llave hasta la última.',
    )
  }

  const lista = listaDeAlimentos(bruto)

  if (!lista.length) {
    throw new ErrorDeFormato('El JSON no trae ningún alimento.')
  }

  return {
    alimentos: lista.map(normalizarAlimento),
    momento: momentoDe(bruto),
  }
}

/** Pegar desde un chat suele traer ```json … ``` alrededor. */
function quitarVallas(texto: string): string {
  const conVallas = texto.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return conVallas ? conVallas[1] : texto
}

function listaDeAlimentos(bruto: unknown): Record<string, unknown>[] {
  // Una lista suelta también vale: es lo que sale si se copia solo el array.
  const lista = Array.isArray(bruto)
    ? bruto
    : esObjeto(bruto) && Array.isArray(bruto.alimentos)
      ? bruto.alimentos
      : null

  if (!lista) {
    throw new ErrorDeFormato(
      'Falta la lista "alimentos". Se espera { "alimentos": [ … ] } o directamente la lista.',
    )
  }

  return lista.map((a, i) => {
    if (!esObjeto(a)) {
      throw new ErrorDeFormato(`El alimento ${i + 1} no es un objeto.`)
    }
    return a
  })
}

function normalizarAlimento(a: Record<string, unknown>, i: number): AlimentoEstimado {
  const nombre = typeof a.nombre === 'string' ? a.nombre.trim() : ''
  if (!nombre) {
    throw new ErrorDeFormato(`Al alimento ${i + 1} le falta el nombre.`)
  }

  return {
    nombre,
    gramos: numeroOpcional(a.gramos, nombre, 'gramos'),
    kcal: numeroObligatorio(a.kcal, nombre, 'kcal'),
    proteina: numeroObligatorio(a.proteina, nombre, 'proteína'),
    grasa: numeroObligatorio(a.grasa, nombre, 'grasa'),
    carbos: numeroObligatorio(a.carbos, nombre, 'carbohidratos'),
  }
}

function momentoDe(bruto: unknown): Momento | null {
  if (!esObjeto(bruto)) return null
  const momento = typeof bruto.momento === 'string' ? bruto.momento.trim().toLowerCase() : ''
  // Un momento que no se reconoce no es motivo para rechazar la comida entera:
  // la pantalla propone el que toca por la hora y el usuario lo confirma.
  return (MOMENTOS as string[]).includes(momento) ? (momento as Momento) : null
}

/**
 * Acepta números y textos numéricos, con coma o con punto. Lo que no se puede
 * leer como número **no se convierte en cero**: falla.
 */
function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null

  if (typeof valor === 'string') {
    const limpio = valor.trim().replace(',', '.').replace(/\s*(g|kcal|cal)$/i, '')
    if (!limpio) return null
    const n = Number(limpio)
    return Number.isFinite(n) ? n : null
  }

  return null
}

function numeroObligatorio(valor: unknown, nombre: string, campo: string): number {
  const n = aNumero(valor)

  if (n === null) {
    throw new ErrorDeFormato(
      valor === undefined || valor === null
        ? `A «${nombre}» le falta ${campo}.`
        : `«${nombre}» tiene un valor de ${campo} que no es un número.`,
    )
  }

  if (n < 0) {
    throw new ErrorDeFormato(`«${nombre}» tiene ${campo} en negativo.`)
  }

  return redondear(n)
}

function numeroOpcional(valor: unknown, nombre: string, campo: string): number | null {
  if (valor === undefined || valor === null || valor === '') return null
  return numeroObligatorio(valor, nombre, campo)
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// -----------------------------------------------------------------------------
// Instrucciones para el Proyecto de Claude
// -----------------------------------------------------------------------------

/**
 * El texto que el usuario pega en su Proyecto de Claude. Vive aquí, al lado del
 * parser, para que las dos mitades del puente se cambien a la vez: si un día el
 * formato acepta un campo más, se añade arriba y se pide aquí abajo.
 */
export const INSTRUCCIONES_PARA_CLAUDE = `Cuando te mande una foto de comida, respóndeme SOLO con un bloque JSON con este formato exacto, sin texto alrededor:

{
  "alimentos": [
    {
      "nombre": "Pechuga de pollo a la plancha",
      "gramos": 180,
      "kcal": 297,
      "proteina": 55.8,
      "grasa": 6.5,
      "carbos": 0
    }
  ],
  "momento": "almuerzo"
}

Reglas:
- Un objeto por alimento que veas en el plato, no uno por plato entero.
- "gramos" es tu estimación del peso servido. Si no puedes estimarlo, omítelo.
- "kcal", "proteina", "grasa" y "carbos" son del total servido, NO por 100 g, y
  son obligatorios los cuatro. Números, con punto decimal.
- "momento" es uno de: desayuno, almuerzo, cena, snack.
- Nada de comentarios, unidades ni texto fuera del JSON.`
