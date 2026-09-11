/**
 * Comprueba contra un Supabase real las suposiciones de la capa offline: la
 * forma exacta de la consulta de descarga, que el default de `user_id`
 * funcione, que reenviar no duplique, y qué código devuelve cada rechazo.
 *
 * Un doble de test no puede decir nada de esto. Los tests de `npm test` cubren
 * la lógica de la cola; esto cubre el contrato con Postgres y PostgREST.
 *
 *   npx supabase start
 *   node scripts/verificar-offline.mjs
 *
 * Usa las credenciales de `.env.local` y la cuenta de pruebas local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim())),
)

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const ok = (n, c, extra = '') => console.log(`${c ? '  OK ' : 'FALLO'}  ${n}${extra ? ' · ' + extra : ''}`)
let fallos = 0
const check = (n, c, extra) => { if (!c) fallos++; ok(n, c, extra) }

const { data: auth, error: eAuth } = await sb.auth.signInWithPassword({
  email: process.env.EMAIL ?? 'yo@local.test',
  password: process.env.PASSWORD ?? 'gimnasio123',
})
if (eAuth) { console.error('No se pudo entrar:', eAuth.message); process.exit(1) }
const uid = auth.user.id
console.log('Usuario', uid, '\n')

// 1 · La consulta exacta de descarga.ts
{
  const { data, error } = await sb.from('ejercicios').select('*')
    .gte('updated_at', '1970-01-01T00:00:00Z')
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .range(0, 999)
  check('descarga: select + gte(updated_at) + order doble + range', !error && data.length > 0,
    error?.message ?? `${data?.length} ejercicios`)
}

// 2 · Paginación con range: dos páginas de 40 no repiten ni pierden filas
{
  const pag = async (desde, tam) => (await sb.from('ejercicios').select('id')
    .gte('updated_at', '1970-01-01T00:00:00Z')
    .order('updated_at', { ascending: true }).order('id', { ascending: true })
    .range(desde, desde + tam - 1)).data.map((r) => r.id)
  const a = await pag(0, 40), b = await pag(40, 40)
  const todos = new Set([...a, ...b])
  check('paginación por range sin solapes ni huecos', todos.size === a.length + b.length,
    `${a.length}+${b.length}=${todos.size}`)
}

// 3 · El upsert sin user_id lo rellena auth.uid() por defecto
const idEj = (await sb.from('ejercicios').select('id').limit(1)).data[0].id
const idSesion = crypto.randomUUID()
{
  const { error } = await sb.from('sesiones')
    .upsert({ id: idSesion, fecha: '2026-09-11', nombre_dia: 'Prueba' }, { onConflict: 'id' })
  const { data } = await sb.from('sesiones').select('user_id').eq('id', idSesion).single()
  check('upsert sin user_id: el default auth.uid() lo rellena',
    !error && data?.user_id === uid, error?.message ?? data?.user_id)
}

// 4 · Reenviar la misma operación no duplica (idempotencia de la cola)
{
  await sb.from('sesiones').upsert({ id: idSesion, fecha: '2026-09-11', nombre_dia: 'Prueba', notas: 'reenvío' }, { onConflict: 'id' })
  const { data } = await sb.from('sesiones').select('id, notas').eq('id', idSesion)
  check('reenvío del mismo id: una sola fila, con el último valor',
    data?.length === 1 && data[0].notas === 'reenvío', `${data?.length} filas`)
}

// 5 · El trigger de updated_at avanza al reenviar (marca de agua de la descarga)
{
  const antes = (await sb.from('sesiones').select('updated_at').eq('id', idSesion).single()).data.updated_at
  await new Promise((r) => setTimeout(r, 50))
  await sb.from('sesiones').upsert({ id: idSesion, fecha: '2026-09-11', notas: 'otra vez' }, { onConflict: 'id' })
  const despues = (await sb.from('sesiones').select('updated_at').eq('id', idSesion).single()).data.updated_at
  check('el servidor mueve updated_at al actualizar', despues > antes, `${antes} → ${despues}`)
}

// 6 · Serie que apunta a la sesión creada offline con uuid del cliente
const idSerie = crypto.randomUUID()
{
  const { error } = await sb.from('series').upsert(
    { id: idSerie, sesion_id: idSesion, ejercicio_id: idEj, numero: 1, peso_kg: 82.5, reps: 8, rir: 2, tipo: 'normal' },
    { onConflict: 'id' })
  check('serie relacionada por uuid generado en el cliente', !error, error?.message)
}

// 7 · Clave ajena rota: el código que la capa trata como definitivo
{
  const { error } = await sb.from('series').upsert(
    { id: crypto.randomUUID(), sesion_id: crypto.randomUUID(), ejercicio_id: idEj, numero: 1 },
    { onConflict: 'id' })
  check('clave ajena rota devuelve código 23503 (definitivo)', error?.code === '23503',
    `code=${error?.code}`)
}

// 8 · Borrado en cascada: borrar la sesión se lleva las series
{
  const { error } = await sb.from('sesiones').delete().eq('id', idSesion)
  const { data } = await sb.from('series').select('id').eq('id', idSerie)
  check('borrar la sesión cascada a sus series', !error && data?.length === 0,
    error?.message ?? `${data?.length} series`)
}

// 9 · Borrar algo inexistente no es un error (por si un reintento se pasa)
{
  const { error } = await sb.from('sesiones').delete().eq('id', crypto.randomUUID())
  check('borrar un id inexistente no falla', !error, error?.message)
}

// 10 · Anónimo sigue sin poder leer nada
{
  const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await anon.from('ejercicios').select('id').limit(1)
  check('anónimo rechazado por RLS', error?.code === '42501', `code=${error?.code}`)
}

console.log(fallos ? `\n${fallos} comprobaciones fallidas` : '\nTodo correcto')
process.exit(fallos ? 1 : 0)
