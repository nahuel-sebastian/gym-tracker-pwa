import { borrar, guardar } from './datos'
import { db } from './db'
import type { AlimentoEstimado } from './estimacion'
import { hoy } from './fechas'
import { macrosDeAlimento, type Macros } from './nutricion'
import type { Alimento, Momento, RegistroComida, TipoDia } from './tipos'

/**
 * Acciones del dominio: las operaciones con nombre que hace la app, por encima
 * de `guardar()` y `borrar()`.
 *
 * Aquí vive una regla que no puede estar en las pantallas: tres tablas tienen
 * un índice único por fecha en el servidor (`dias`, `medidas_corporales`) o por
 * vigencia (`objetivos_nutricionales`). Un upsert por `id` con otro `id` para
 * la misma fecha no lo actualizaría: chocaría contra el índice y la operación
 * acabaría en `fallidas`. Así que siempre se busca primero la fila de esa fecha
 * y se reutiliza su id.
 */

async function idPorFecha(
  tabla: 'dias' | 'medidas_corporales',
  fecha: string,
): Promise<string | undefined> {
  const fila = await db.table(tabla).where('fecha').equals(fecha).first()
  return fila?.id as string | undefined
}

/** Marca un día como de entreno o descanso. Un toque desde la pantalla Hoy. */
export async function marcarTipoDia(fecha: string, tipo: TipoDia): Promise<string> {
  return guardar('dias', { id: await idPorFecha('dias', fecha), fecha, tipo })
}

/** Registra el peso de la mañana. Un pesaje por día, se sobrescribe. */
export async function registrarPeso(fecha: string, peso_kg: number | null): Promise<string> {
  return guardar('medidas_corporales', {
    id: await idPorFecha('medidas_corporales', fecha),
    fecha,
    peso_kg,
  })
}

/**
 * Guarda el objetivo de un tipo de día con vigencia desde hoy.
 *
 * No sobrescribe el objetivo anterior: se añade una fila nueva y la de ayer
 * queda como histórico, para poder mirar más adelante contra qué objetivo se
 * comparaba entonces. Cambiarlo dos veces el mismo día sí reutiliza la fila,
 * que es lo que exige el índice único de vigencia.
 */
export async function guardarObjetivo(
  tipo_dia: TipoDia,
  valores: { kcal: number; proteina_g: number; grasa_g: number; carbos_g: number },
): Promise<string> {
  const vigente_desde = hoy()
  const existente = await db.objetivos_nutricionales
    .where('[tipo_dia+vigente_desde]')
    .equals([tipo_dia, vigente_desde])
    .first()

  return guardar('objetivos_nutricionales', {
    id: existente?.id,
    tipo_dia,
    vigente_desde,
    ...valores,
  })
}

/**
 * Registra una cantidad de un alimento de la biblioteca.
 *
 * Los macros se calculan aquí y se guardan congelados en el registro. Y se
 * sube el contador de uso, que es lo que ordena el buscador: la vía principal
 * de registro tiene que ser de dos toques, y eso solo pasa si lo de siempre
 * está arriba.
 */
export async function registrarAlimento(
  fecha: string,
  momento: Momento,
  alimento: Alimento,
  gramos: number,
): Promise<string> {
  const macros = macrosDeAlimento(alimento, gramos)

  const id = await guardar('registros_comida', {
    fecha,
    momento,
    alimento_id: alimento.id,
    receta_id: null,
    descripcion: null,
    gramos,
    ...macros,
  })

  await guardar('alimentos', {
    id: alimento.id,
    veces_usado: (alimento.veces_usado ?? 0) + 1,
  })

  return id
}

/**
 * Registra algo sin ficha en la biblioteca: una comida de fuera, o lo que
 * llega del puente manual de macros.
 */
export async function registrarSuelto(
  fecha: string,
  momento: Momento,
  descripcion: string,
  macros: Macros,
  gramos: number | null = null,
): Promise<string> {
  return guardar('registros_comida', {
    fecha,
    momento,
    alimento_id: null,
    receta_id: null,
    descripcion,
    gramos,
    ...macros,
  })
}

/**
 * Cambia los gramos de un registro y recalcula sus macros con la ficha actual
 * del alimento. Es una corrección deliberada del usuario, no un recálculo
 * automático al leer: eso es lo que el plan prohíbe.
 */
export async function cambiarGramos(
  registro: RegistroComida,
  alimento: Alimento,
  gramos: number,
): Promise<void> {
  await guardar('registros_comida', {
    id: registro.id,
    gramos,
    ...macrosDeAlimento(alimento, gramos),
  })
}

export async function borrarRegistro(id: string): Promise<void> {
  await borrar('registros_comida', id)
}

/**
 * Copia las comidas de un día en otro, con los macros tal cual quedaron
 * registrados. No se recalculan desde la biblioteca: lo que se duplica es lo
 * que se comió, no la ficha de hoy.
 */
export async function duplicarDia(desde: string, hasta: string): Promise<number> {
  const registros = await db.registros_comida.where('fecha').equals(desde).toArray()

  for (const r of registros) {
    await guardar('registros_comida', {
      fecha: hasta,
      momento: r.momento,
      alimento_id: r.alimento_id,
      receta_id: r.receta_id,
      descripcion: r.descripcion,
      gramos: r.gramos,
      kcal: r.kcal,
      proteina: r.proteina,
      grasa: r.grasa,
      carbos: r.carbos,
    })
  }

  return registros.length
}

/**
 * Da de alta un alimento en la biblioteca. Si ya hay uno con ese código de
 * barras, actualiza el existente: el índice único del servidor rechazaría un
 * segundo id para el mismo código y el envío acabaría en `fallidas`.
 */
export async function guardarAlimento(
  datos: Partial<Alimento> & { nombre: string },
): Promise<string> {
  let id = datos.id

  if (!id && datos.codigo_barras) {
    const existente = await db.alimentos
      .where('codigo_barras')
      .equals(datos.codigo_barras)
      .first()
    id = existente?.id
  }

  // Los valores por defecto solo al crear: al actualizar una ficha existente
  // pisarían lo que ya tenía, y `veces_usado` volvería a cero perdiendo el
  // orden del buscador.
  const porDefecto: Partial<Alimento> = id
    ? {}
    : {
        origen: 'manual',
        favorito: false,
        veces_usado: 0,
        marca: null,
        codigo_barras: null,
        fibra_100g: null,
        azucar_100g: null,
        sal_100g: null,
        porcion_defecto_g: null,
      }

  return guardar('alimentos', { ...porDefecto, ...datos, id })
}

/**
 * Guarda lo que llega del puente manual de macros.
 *
 * Los macros vienen ya calculados para la cantidad servida, así que se escriben
 * tal cual: no se recalculan desde ninguna ficha.
 *
 * Con `aBiblioteca` se crea además una ficha por alimento, con los valores
 * llevados a 100 g. Eso **solo se puede hacer si el alimento trae gramos**: sin
 * el peso servido no hay forma de saber a cuánto equivalen esas kcal por cada
 * cien. Los que no lo traen se registran igual, pero sueltos.
 */
export async function registrarImportado(
  fecha: string,
  momento: Momento,
  alimentos: AlimentoEstimado[],
  aBiblioteca = false,
): Promise<{ registrados: number; enBiblioteca: number }> {
  let enBiblioteca = 0

  for (const a of alimentos) {
    let alimento_id: string | null = null

    if (aBiblioteca && a.gramos && a.gramos > 0) {
      const factor = 100 / a.gramos
      alimento_id = await guardarAlimento({
        nombre: a.nombre,
        kcal_100g: redondearDos(a.kcal * factor),
        proteina_100g: redondearDos(a.proteina * factor),
        grasa_100g: redondearDos(a.grasa * factor),
        carbos_100g: redondearDos(a.carbos * factor),
        porcion_defecto_g: a.gramos,
        origen: 'importado',
      })
      enBiblioteca++
    }

    await guardar('registros_comida', {
      fecha,
      momento,
      alimento_id,
      receta_id: null,
      // La descripción se guarda siempre, también con ficha: si un día se borra
      // el alimento de la biblioteca, el registro sigue diciendo qué se comió.
      descripcion: a.nombre,
      gramos: a.gramos,
      kcal: a.kcal,
      proteina: a.proteina,
      grasa: a.grasa,
      carbos: a.carbos,
    })
  }

  return { registrados: alimentos.length, enBiblioteca }
}

function redondearDos(n: number): number {
  return Math.round(n * 100) / 100
}
