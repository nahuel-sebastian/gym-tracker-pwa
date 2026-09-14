import { ErrorDeSobre } from './sobre'
import type { Ejercicio } from './tipos'

/**
 * Interpretar una rutina que llega en JSON.
 *
 * La parte delicada no es leer el JSON: es que la rutina nombra sus ejercicios
 * **por nombre** y la base los referencia por id. Hay que emparejar contra el
 * catálogo, y ahí es donde puede fallar en silencio — si llega "Press banca" y
 * el catálogo tiene "Press de banca con barra", o se crea un duplicado o no se
 * encuentra.
 *
 * Por eso el emparejamiento se calcula aparte y se enseña en la vista previa
 * antes de confirmar nada. Misma idea que los gramos editables de la comida: lo
 * que el modelo ha deducido se ve antes de guardarse.
 */

export type EjercicioImportado = {
  /** El nombre tal cual venía en el JSON. */
  nombre: string
  /** Id del ejercicio del catálogo con el que se ha emparejado, si hay. */
  ejercicio_id: string | null
  /** Nombre del ejercicio del catálogo, para poder enseñar el emparejamiento. */
  emparejadoCon: string | null
  series_objetivo: number | null
  reps_objetivo: string | null
  rir_objetivo: number | null
  descanso_seg: number | null
  notas: string | null
}

export type DiaImportado = {
  nombre: string
  ejercicios: EjercicioImportado[]
}

export type RutinaImportada = {
  nombre: string
  dias: DiaImportado[]
}

export function interpretarRutina(
  bruto: unknown,
  catalogo: Ejercicio[],
): RutinaImportada {
  if (!esObjeto(bruto)) throw new ErrorDeSobre('La rutina no es un objeto.')

  const nombre = texto(bruto.nombre)
  if (!nombre) throw new ErrorDeSobre('A la rutina le falta el nombre.')

  const dias = bruto.dias
  if (!Array.isArray(dias) || !dias.length) {
    throw new ErrorDeSobre('La rutina no trae ningún día.')
  }

  const indice = indexar(catalogo)

  return {
    nombre,
    dias: dias.map((dia, i) => interpretarDia(dia, i, indice)),
  }
}

function interpretarDia(bruto: unknown, i: number, indice: Indice): DiaImportado {
  if (!esObjeto(bruto)) throw new ErrorDeSobre(`El día ${i + 1} no es un objeto.`)

  const nombre = texto(bruto.nombre)
  if (!nombre) throw new ErrorDeSobre(`Al día ${i + 1} le falta el nombre.`)

  const lista = bruto.ejercicios
  if (!Array.isArray(lista) || !lista.length) {
    throw new ErrorDeSobre(`El día «${nombre}» no trae ningún ejercicio.`)
  }

  return { nombre, ejercicios: lista.map((e, j) => interpretarEjercicio(e, nombre, j, indice)) }
}

function interpretarEjercicio(
  bruto: unknown,
  dia: string,
  j: number,
  indice: Indice,
): EjercicioImportado {
  if (!esObjeto(bruto)) {
    throw new ErrorDeSobre(`El ejercicio ${j + 1} de «${dia}» no es un objeto.`)
  }

  // Se admiten los dos nombres de campo: `ejercicio` es lo natural de escribir
  // en un prompt, `nombre` es lo que sale al exportar desde la propia app.
  const nombre = texto(bruto.ejercicio) || texto(bruto.nombre)
  if (!nombre) {
    throw new ErrorDeSobre(`Al ejercicio ${j + 1} de «${dia}» le falta el nombre.`)
  }

  const delCatalogo = emparejar(nombre, indice)

  return {
    nombre,
    ejercicio_id: delCatalogo?.id ?? null,
    emparejadoCon: delCatalogo?.nombre ?? null,
    series_objetivo: numero(bruto.series ?? bruto.series_objetivo),
    reps_objetivo: texto(bruto.reps ?? bruto.reps_objetivo) || null,
    rir_objetivo: numero(bruto.rir ?? bruto.rir_objetivo),
    descanso_seg: numero(bruto.descanso_seg ?? bruto.descanso),
    notas: texto(bruto.notas) || null,
  }
}

/**
 * Índice del catálogo: por nombre normalizado y por palabras.
 *
 * Se ignoran acentos, mayúsculas y espacios de sobra, que es por donde falla el
 * emparejamiento en la práctica: nadie escribe "Aducción" con tilde en un
 * prompt. Los archivados quedan fuera: un ejercicio archivado no debe volver a
 * aparecer en una rutina nueva por la puerta de atrás.
 */
type Indice = {
  porNombre: Map<string, Ejercicio>
  activos: { ejercicio: Ejercicio; palabras: Set<string> }[]
}

function indexar(catalogo: Ejercicio[]): Indice {
  const indice: Indice = { porNombre: new Map(), activos: [] }

  for (const e of catalogo) {
    if (e.archivado) continue
    indice.porNombre.set(normalizar(e.nombre), e)
    indice.activos.push({ ejercicio: e, palabras: palabrasDe(e.nombre) })
  }

  return indice
}

/**
 * Emparejar un nombre del JSON con uno del catálogo.
 *
 * Primero el nombre exacto. Si no, por palabras: los modelos abrevian —"press
 * banca" por "Press de banca con barra"— y crear un duplicado parte el
 * histórico del ejercicio en dos sin avisar.
 *
 * Solo se empareja si **un único** ejercicio contiene todas las palabras: con
 * "press banca" y un catálogo que tenga la versión con barra y la de
 * mancuernas, elegir una sería adivinar. Sin emparejar se crea uno nuevo, y eso
 * la vista previa lo dice.
 */
function emparejar(nombre: string, indice: Indice): Ejercicio | null {
  const exacto = indice.porNombre.get(normalizar(nombre))
  if (exacto) return exacto

  const palabras = [...palabrasDe(nombre)]
  if (!palabras.length) return null

  const candidatos = indice.activos.filter((c) => palabras.every((p) => c.palabras.has(p)))
  return candidatos.length === 1 ? candidatos[0].ejercicio : null
}

/** Las palabras que distinguen un ejercicio de otro: las de unir no cuentan. */
const VACIAS = new Set(['de', 'del', 'con', 'en', 'a', 'al', 'la', 'el', 'los', 'las', 'y', 'para'])

function palabrasDe(nombre: string): Set<string> {
  return new Set(
    normalizar(nombre)
      .split(' ')
      .filter((p) => p && !VACIAS.has(p)),
  )
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cuántos ejercicios habrá que crear porque no están en el catálogo. */
export function aCrear(rutina: RutinaImportada): string[] {
  const nuevos = new Set<string>()
  for (const dia of rutina.dias) {
    for (const e of dia.ejercicios) {
      if (!e.ejercicio_id) nuevos.add(e.nombre)
    }
  }
  return [...nuevos]
}

function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// -----------------------------------------------------------------------------
// Instrucciones para el Proyecto de Claude
// -----------------------------------------------------------------------------

/**
 * Igual que las de comida: viven al lado del parser para que las dos mitades
 * del puente cambien a la vez. Se pide el nombre exacto del ejercicio porque el
 * emparejamiento contra el catálogo va por nombre.
 */
export const INSTRUCCIONES_RUTINA = `Cuando te pida una rutina de gimnasio, respóndeme SOLO con un bloque JSON con este formato exacto, sin texto alrededor:

{
  "tipo": "rutina",
  "nombre": "Full body 3 días",
  "dias": [
    {
      "nombre": "Día A — Empuje",
      "ejercicios": [
        {
          "nombre": "Press de banca con barra",
          "series_objetivo": 4,
          "reps_objetivo": "6-8",
          "rir_objetivo": 2,
          "descanso_seg": 180,
          "notas": "Agarre a la anchura de los hombros"
        }
      ]
    }
  ]
}

Reglas:
- "tipo" va siempre, y siempre vale "rutina".
- "nombre" del ejercicio: el nombre completo y habitual en español, sin abreviar
  ("Press de banca con barra", no "Press banca"). La app lo empareja con mi
  catálogo por nombre, y si no lo encuentra crea un ejercicio nuevo.
- "reps_objetivo" es texto: puede ser un rango ("8-10") o un número ("5").
- "series_objetivo", "rir_objetivo" y "descanso_seg" son números. Si no tienes
  un valor claro, omite el campo en vez de poner 0.
- "descanso_seg" en segundos. "notas" es opcional.
- Un día por sesión de la semana, con sus ejercicios en el orden en que se hacen.
- Nada de texto fuera del JSON.`
