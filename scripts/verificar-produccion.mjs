/**
 * Comprueba el proyecto de PRODUCCIÓN.
 *
 *   node scripts/verificar-produccion.mjs
 *
 * Sin credenciales hace las comprobaciones anónimas, que son las que importan
 * para la seguridad: que las catorce tablas existan y que RLS las cierre a la
 * clave pública. Es exactamente lo que puede intentar cualquiera que lea el
 * bundle de la app.
 *
 * Con la cuenta, comprueba además el catálogo y el bucket. Las pide por
 * teclado, así que la contraseña no queda en el historial de la shell ni en
 * ningún archivo:
 *
 *   node scripts/verificar-produccion.mjs
 *
 * Si prefieres pasarlas por entorno (por ejemplo en CI), también las coge de
 * EMAIL y PASSWORD.
 *
 * Y con --escribir hace también una escritura de ida y vuelta (crea una sesión
 * de prueba, la reenvía para comprobar que no duplica, y la borra). Va apagado
 * por defecto: es producción.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const ESCRIBIR = process.argv.includes('--escribir')

const env = Object.fromEntries(
  readFileSync(new URL('../.env.production.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const URL_SB = env.VITE_SUPABASE_URL
const CLAVE = env.VITE_SUPABASE_ANON_KEY

if (!URL_SB || !CLAVE) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.production.local')
  process.exit(1)
}

if (URL_SB.includes('127.0.0.1') || URL_SB.includes('localhost')) {
  console.error('Esto es para el proyecto remoto. Para el local está verificar-offline.mjs.')
  process.exit(1)
}

const TABLAS = [
  'ejercicios', 'rutinas', 'rutina_dias', 'rutina_ejercicios', 'sesiones', 'series',
  'alimentos', 'recetas', 'receta_ingredientes', 'registros_comida',
  'objetivos_nutricionales', 'dias', 'medidas_corporales', 'fotos_progreso',
]

let fallos = 0
const check = (nombre, ok, extra = '') => {
  if (!ok) fallos++
  console.log(`${ok ? '  OK ' : 'FALLO'}  ${nombre}${extra ? ' · ' + extra : ''}`)
}

console.log(`Proyecto: ${URL_SB}\n`)

// ---------------------------------------------------------------------------
// Anónimo: lo que puede intentar cualquiera con la clave del bundle
// ---------------------------------------------------------------------------

const anon = createClient(URL_SB, CLAVE, { auth: { persistSession: false } })

console.log('Anónimo (clave pública, sin sesión)')

let faltan = []
let abiertas = []

for (const tabla of TABLAS) {
  const { error } = await anon.from(tabla).select('id').limit(1)

  // 42501 es "permission denied": la tabla está y RLS la cierra.
  // PGRST205 / 42P01 es "no existe": falta una migración.
  if (!error) abiertas.push(tabla)
  else if (error.code === 'PGRST205' || error.code === '42P01') faltan.push(tabla)
}

check(
  'las catorce tablas existen',
  faltan.length === 0,
  faltan.length ? `faltan: ${faltan.join(', ')}` : `${TABLAS.length} tablas`,
)
check(
  'RLS cierra todas las tablas al anónimo',
  abiertas.length === 0,
  abiertas.length ? `ABIERTAS: ${abiertas.join(', ')}` : 'ninguna filtra datos',
)

{
  const { error } = await anon.rpc('ultimas_series', { p_ejercicio_ids: [] })
  const existe = !(error?.code === 'PGRST202')
  check('la función ultimas_series existe y no es pública', existe && !!error,
    error ? `code=${error.code}` : 'DEVOLVIÓ DATOS AL ANÓNIMO')
}

{
  const { error } = await anon.from('ejercicios').insert({ nombre: 'intruso' })
  check('el anónimo no puede escribir', !!error, `code=${error?.code}`)
}

// ---------------------------------------------------------------------------
// Con la cuenta
// ---------------------------------------------------------------------------

/**
 * Pregunta por teclado. Con `oculto`, no repite lo que se escribe: la
 * contraseña no debe quedar ni en la pantalla ni, por tanto, en el scrollback
 * de la terminal.
 */
function preguntar(texto, oculto = false) {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(texto, (valor) => {
      if (oculto) process.stdout.write('\n')
      rl.close()
      resolver(valor.trim())
    })
    if (oculto) {
      // `_writeToOutput` es la única forma de silenciar el eco en readline.
      rl._writeToOutput = (cadena) => {
        if (cadena.includes(texto)) rl.output.write(texto)
      }
    }
  })
}

const interactivo = process.stdin.isTTY === true

let email = process.env.EMAIL ?? ''
let contrasena = process.env.PASSWORD ?? ''

if ((!email || !contrasena) && interactivo) {
  console.log('\nCuenta de Supabase (déjalo en blanco para saltar estas comprobaciones)')
  if (!email) email = await preguntar('  Email: ')
  if (email && !contrasena) contrasena = await preguntar('  Contraseña: ', true)
}

if (!email || !contrasena) {
  console.log(
    interactivo
      ? '\nSin cuenta: me salto las comprobaciones con sesión.'
      : '\nSin terminal interactiva y sin EMAIL/PASSWORD: me salto las comprobaciones con sesión.',
  )
  console.log('Para hacerlas, lanza el script tú desde la terminal:')
  console.log('  node scripts/verificar-produccion.mjs --escribir')
  console.log(fallos ? `\n${fallos} comprobaciones fallidas` : '\nTodo correcto')
  process.exit(fallos ? 1 : 0)
}

console.log('\nCon la cuenta')

const sb = createClient(URL_SB, CLAVE, { auth: { persistSession: false } })
const { data: auth, error: eAuth } = await sb.auth.signInWithPassword({
  email,
  password: contrasena,
})

if (eAuth) {
  check('entrar con la cuenta', false, eAuth.message)
  console.log(`\n${fallos} comprobaciones fallidas`)
  process.exit(1)
}

check('entrar con la cuenta', true, auth.user.id)

{
  const { count, error } = await sb.from('ejercicios').select('id', { count: 'exact', head: true })
  check('catálogo sembrado', !error && count === 70, error?.message ?? `${count} ejercicios`)
}

{
  const { data, error } = await sb.storage.from('fotos').list('', { limit: 1 })
  // Una lista vacía es correcta: el bucket existe y responde.
  check('el bucket privado fotos responde', !error, error?.message ?? `${data?.length ?? 0} objetos`)
}

if (ESCRIBIR) {
  const id = crypto.randomUUID()

  const primera = await sb.from('sesiones').upsert(
    { id, fecha: new Date().toISOString().slice(0, 10), nombre_dia: 'Comprobación' },
    { onConflict: 'id' },
  )
  check('escribir una fila', !primera.error, primera.error?.message)

  const segunda = await sb.from('sesiones').upsert(
    { id, fecha: new Date().toISOString().slice(0, 10), nombre_dia: 'Comprobación (reenvío)' },
    { onConflict: 'id' },
  )
  const { data: filas } = await sb.from('sesiones').select('id').eq('id', id)
  check(
    'reenviar la misma fila no duplica',
    !segunda.error && filas?.length === 1,
    `${filas?.length} filas`,
  )

  const { data: dueño } = await sb.from('sesiones').select('user_id').eq('id', id).single()
  check('user_id se rellena solo con auth.uid()', dueño?.user_id === auth.user.id)

  const { error: eBorrar } = await sb.from('sesiones').delete().eq('id', id)
  check('limpieza de la fila de prueba', !eBorrar, eBorrar?.message)
} else {
  console.log('  (--escribir para probar también la ida y vuelta de una escritura)')
}

console.log(fallos ? `\n${fallos} comprobaciones fallidas` : '\nTodo correcto')
process.exit(fallos ? 1 : 0)
