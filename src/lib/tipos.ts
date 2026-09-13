/**
 * Tipos de las filas, espejo de `supabase/migrations/0001_esquema.sql`.
 *
 * Convenciones que vienen del esquema y condicionan estos tipos:
 *
 *  · `id` es obligatorio y lo genera el cliente. Sin eso no se pueden crear
 *    filas relacionadas sin conexión (una sesión y sus series) ni reintentar
 *    un envío sin duplicar.
 *  · `user_id` no aparece: la columna tiene `default auth.uid()` y el servidor
 *    la rellena. La base local es de un solo usuario y no necesita el dato.
 *  · Las fechas de día son texto `YYYY-MM-DD` en hora local, nunca un `Date`
 *    ni un `toISOString()`: una cena a las 22:00 debe contar como de hoy.
 *  · Los campos de servidor (`created_at`, `updated_at`) son opcionales porque
 *    al crear una fila el cliente todavía no los conoce.
 */

export type GrupoMuscular =
  | 'pecho'
  | 'espalda'
  | 'pierna'
  | 'hombro'
  | 'biceps'
  | 'triceps'
  | 'core'

export type Equipamiento = 'barra' | 'mancuerna' | 'maquina' | 'polea' | 'peso_corporal'
export type TipoSerie = 'normal' | 'calentamiento' | 'dropset' | 'fallo'
export type Momento = 'desayuno' | 'almuerzo' | 'cena' | 'snack'
export type TipoDia = 'entreno' | 'descanso'
export type OrigenAlimento = 'manual' | 'openfoodfacts' | 'importado'
export type Angulo = 'frontal' | 'lateral' | 'espalda'

/** Campos que lleva toda fila. */
type Base = {
  id: string
  created_at?: string
  updated_at?: string
  /**
   * Marcas locales, nunca se envían al servidor (se filtran por el prefijo).
   * `_enviado` distingue una fila que el servidor ya conoce de una que solo
   * existe aquí: al borrar la segunda basta con cancelar su envío pendiente.
   */
  _enviado?: boolean
}

export type Ejercicio = Base & {
  nombre: string
  grupo_muscular: GrupoMuscular | null
  equipamiento: Equipamiento | null
  es_unilateral: boolean
  notas: string | null
  archivado: boolean
}

export type Rutina = Base & {
  nombre: string
  activa: boolean
  fecha_inicio: string | null
}

export type RutinaDia = Base & {
  rutina_id: string
  nombre: string
  orden: number
}

export type RutinaEjercicio = Base & {
  dia_id: string
  ejercicio_id: string
  orden: number
  series_objetivo: number | null
  reps_objetivo: string | null
  rir_objetivo: number | null
  descanso_seg: number | null
  notas: string | null
}

export type Sesion = Base & {
  dia_id: string | null
  /** Copia del nombre del día: la sesión sigue legible si la rutina desaparece. */
  nombre_dia: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  notas: string | null
  sensacion: number | null
}

export type Serie = Base & {
  sesion_id: string
  /** Apunta al ejercicio, nunca a `rutina_ejercicios`. Decisión del plan. */
  ejercicio_id: string
  numero: number
  peso_kg: number | null
  reps: number | null
  rir: number | null
  tipo: TipoSerie
}

export type Alimento = Base & {
  nombre: string
  marca: string | null
  codigo_barras: string | null
  kcal_100g: number
  proteina_100g: number
  grasa_100g: number
  carbos_100g: number
  fibra_100g: number | null
  azucar_100g: number | null
  sal_100g: number | null
  porcion_defecto_g: number | null
  origen: OrigenAlimento
  favorito: boolean
  veces_usado: number
}

export type Receta = Base & {
  nombre: string
  porciones: number
  notas: string | null
}

export type RecetaIngrediente = Base & {
  receta_id: string
  alimento_id: string
  gramos: number
}

export type RegistroComida = Base & {
  fecha: string
  momento: Momento
  alimento_id: string | null
  receta_id: string | null
  descripcion: string | null
  gramos: number | null
  /** Macros congelados al registrar: editar la ficha no reescribe el pasado. */
  kcal: number
  proteina: number
  grasa: number
  carbos: number
}

export type ObjetivoNutricional = Base & {
  tipo_dia: TipoDia
  kcal: number
  proteina_g: number
  grasa_g: number
  carbos_g: number
  vigente_desde: string
}

export type Dia = Base & {
  fecha: string
  tipo: TipoDia
}

export type MedidaCorporal = Base & {
  fecha: string
  peso_kg: number | null
  notas: string | null
}

/** Ajustes sueltos del usuario: una sola fila. */
export type Ajustes = Base & {
  peso_objetivo: number | null
}

export type FotoProgreso = Base & {
  fecha: string
  ruta_storage: string
  angulo: Angulo | null
  peso_kg: number | null
}

/** Mapa de nombre de tabla a tipo de fila. Las claves son las tablas reales. */
export type Tablas = {
  ejercicios: Ejercicio
  rutinas: Rutina
  rutina_dias: RutinaDia
  rutina_ejercicios: RutinaEjercicio
  sesiones: Sesion
  series: Serie
  alimentos: Alimento
  recetas: Receta
  receta_ingredientes: RecetaIngrediente
  registros_comida: RegistroComida
  objetivos_nutricionales: ObjetivoNutricional
  dias: Dia
  medidas_corporales: MedidaCorporal
  fotos_progreso: FotoProgreso
  ajustes: Ajustes
}

export type NombreTabla = keyof Tablas

/** Las 15 tablas, en orden de dependencia: una fila nunca se envía antes de
 *  aquella a la que apunta su clave ajena. */
export const TABLAS: NombreTabla[] = [
  'ejercicios',
  'rutinas',
  'rutina_dias',
  'rutina_ejercicios',
  'sesiones',
  'series',
  'alimentos',
  'recetas',
  'receta_ingredientes',
  'registros_comida',
  'objetivos_nutricionales',
  'dias',
  'medidas_corporales',
  'fotos_progreso',
  'ajustes',
]
