/**
 * Con dos cuentas en la misma base, ¿ve cada una solo lo suyo?
 *
 * Es la comprobación que hay que pasar antes de dejar entrar a una segunda
 * persona: RLS está por tabla, y una política mal puesta no se nota hasta que
 * alguien ve el diario de otro. Lee las dos cuentas de `.env.local` por
 * defecto; se pueden cambiar por entorno.
 *
 *   node scripts/verificar-aislamiento.mjs
 *   EMAIL_A=… PASS_A=… EMAIL_B=… PASS_B=… node scripts/verificar-aislamiento.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim())),
)

const TABLAS = ['ejercicios','rutinas','sesiones','series','alimentos','registros_comida',
  'objetivos_nutricionales','dias','medidas_corporales','fotos_progreso','ajustes','recetas']

let fallos = 0
const check = (n, ok, extra='') => { if(!ok) fallos++; console.log(`${ok?'  OK ':'FALLO'}  ${n}${extra?' · '+extra:''}`) }

async function entrar(email, password) {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { sb, uid: data.user.id }
}

const mio = await entrar(process.env.EMAIL_A ?? 'yo@local.test', process.env.PASS_A ?? 'gimnasio123')
const suyo = await entrar(process.env.EMAIL_B ?? 'pareja@local.test', process.env.PASS_B ?? 'gimnasio456')
check('las dos cuentas entran', mio.uid !== suyo.uid)

// Cada uno cuenta sus filas por tabla.
const ajenas = []
for (const tabla of TABLAS) {
  const { data, error } = await suyo.sb.from(tabla).select('user_id')
  if (error) { check(`leer ${tabla}`, false, error.message); continue }
  if ((data ?? []).some((f) => f.user_id !== suyo.uid)) ajenas.push(tabla)
}
check('la cuenta nueva no ve ni una fila ajena', ajenas.length === 0,
  ajenas.length ? `FILTRAN: ${ajenas.join(', ')}` : `${TABLAS.length} tablas comprobadas`)

// Mis datos siguen ahí y son míos.
const { count } = await mio.sb.from('registros_comida').select('id', { count: 'exact', head: true })
check('mis registros siguen siendo míos', (count ?? 0) > 0, `${count} comidas`)

// Escribir a nombre de otro tiene que fallar.
const intruso = await suyo.sb.from('medidas_corporales')
  .insert({ id: crypto.randomUUID(), user_id: mio.uid, fecha: '2026-01-01', peso_kg: 1 })
check('no puede escribir a mi nombre', !!intruso.error, `code=${intruso.error?.code}`)

// Y no puede sembrar el catálogo de nadie.
const rpc = await suyo.sb.rpc('sembrar_catalogo_ejercicios', { p_email: 'yo@local.test' })
check('no puede llamar a la siembra', !!rpc.error, `code=${rpc.error?.code}`)

console.log(fallos ? `\n${fallos} fallidas` : '\nAislamiento correcto')
process.exit(fallos ? 1 : 0)
