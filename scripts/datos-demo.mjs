/**
 * Siembra datos de demostración en el Supabase **local**, para poder mirar las
 * pantallas con algo dentro: dos meses de pesajes, ocho semanas de sesiones y
 * seis de comidas.
 *
 *   node scripts/datos-demo.mjs            # sembrar
 *   node scripts/datos-demo.mjs --borrar   # quitarlo todo
 *
 * Los uuid se generan de forma determinista con el prefijo `dddddddd`, así que
 * borrar vuelve a calcular exactamente los mismos y no toca nada más. Sembrar
 * dos veces tampoco duplica: es un upsert por id.
 *
 * No apuntes esto a un proyecto de producción.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BORRAR = process.argv.includes('--borrar')

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim())),
)

if (!env.VITE_SUPABASE_URL.includes('127.0.0.1') && !env.VITE_SUPABASE_URL.includes('localhost')) {
  console.error('Esto solo se ejecuta contra la base local. Aborto.')
  process.exit(1)
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const { error: eAuth } = await sb.auth.signInWithPassword({
  email: process.env.EMAIL ?? 'yo@local.test',
  password: process.env.PASSWORD ?? 'gimnasio123',
})
if (eAuth) {
  console.error('No se pudo entrar:', eAuth.message)
  process.exit(1)
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

let contador = 0
const id = () => `dddddddd-0000-4000-8000-${String(++contador).padStart(12, '0')}`

const hoy = new Date()
const fecha = (atras) => {
  const d = new Date(hoy)
  d.setDate(d.getDate() - atras)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Ruido reproducible: la misma semilla da siempre los mismos datos.
let semilla = 42
const aleatorio = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

// -----------------------------------------------------------------------------
// Filas
// -----------------------------------------------------------------------------

const filas = { medidas_corporales: [], dias: [], registros_comida: [], alimentos: [], sesiones: [], series: [] }

// Peso: 60 días bajando ~0,35 kg por semana, con el ruido diario de agua.
for (let i = 59; i >= 0; i--) {
  if (i % 7 === 3) continue // algún día sin báscula, que es lo normal
  filas.medidas_corporales.push({
    id: id(),
    fecha: fecha(i),
    peso_kg: redondear(82 - (59 - i) * 0.05 + (aleatorio() - 0.5) * 1.2, 2),
  })
}

// Alimentos de la biblioteca.
const alimentos = [
  ['Pechuga de pollo a la plancha', 165, 31, 3.6, 0, 180],
  ['Arroz blanco cocido', 130, 2.7, 0.3, 28, 200],
  ['Huevo entero', 155, 13, 11, 1.1, 120],
  ['Avena en copos', 389, 16.9, 6.9, 66, 80],
  ['Yogur griego natural', 97, 9, 5, 3.6, 200],
  ['Aceite de oliva virgen extra', 884, 0, 100, 0, 15],
]
const idsAlimento = alimentos.map(([nombre, kcal, p, g, c, porcion]) => {
  const fila = {
    id: id(),
    nombre,
    kcal_100g: kcal,
    proteina_100g: p,
    grasa_100g: g,
    carbos_100g: c,
    porcion_defecto_g: porcion,
    origen: 'manual',
    veces_usado: Math.round(aleatorio() * 40),
  }
  filas.alimentos.push(fila)
  return fila
})

// Seis semanas de comidas y de tipo de día. Entreno lunes, miércoles y viernes.
for (let i = 41; i >= 1; i--) {
  const f = fecha(i)
  const diaSemana = new Date(hoy.getTime() - i * 86400000).getDay()
  const entrena = [1, 3, 5].includes(diaSemana)

  filas.dias.push({ id: id(), fecha: f, tipo: entrena ? 'entreno' : 'descanso' })

  // Algún día sin apuntar, para que la media por días registrados tenga sentido.
  if (aleatorio() < 0.12) continue

  const objetivo = entrena ? 2800 : 2200
  for (const [momento, parte] of [['desayuno', 0.25], ['almuerzo', 0.4], ['cena', 0.35]]) {
    const alimento = idsAlimento[Math.floor(aleatorio() * idsAlimento.length)]
    const kcal = redondear(objetivo * parte * (0.85 + aleatorio() * 0.3), 0)
    const gramos = redondear((kcal / alimento.kcal_100g) * 100, 0)
    filas.registros_comida.push({
      id: id(),
      fecha: f,
      momento,
      alimento_id: alimento.id,
      gramos,
      kcal,
      proteina: redondear((alimento.proteina_100g * gramos) / 100),
      grasa: redondear((alimento.grasa_100g * gramos) / 100),
      carbos: redondear((alimento.carbos_100g * gramos) / 100),
    })
  }
}

// Sesiones: hay que enganchar con ejercicios reales del catálogo sembrado.
const { data: catalogo } = await sb
  .from('ejercicios')
  .select('id, nombre')
  .in('nombre', [
    'Press de banca con barra',
    'Sentadilla trasera',
    'Peso muerto convencional',
    'Remo con barra',
    'Press militar con barra',
  ])

const porNombre = new Map((catalogo ?? []).map((e) => [e.nombre, e.id]))

const PLAN = [
  { dia: 1, nombre: 'Día A — Empuje', ejercicios: ['Press de banca con barra', 'Press militar con barra'], base: [72.5, 42.5] },
  { dia: 3, nombre: 'Día B — Pierna', ejercicios: ['Sentadilla trasera', 'Peso muerto convencional'], base: [95, 120] },
  { dia: 5, nombre: 'Día C — Tirón', ejercicios: ['Remo con barra', 'Press de banca con barra'], base: [65, 72.5] },
]

let semana = 0
for (let i = 41; i >= 1; i--) {
  const diaSemana = new Date(hoy.getTime() - i * 86400000).getDay()
  const plan = PLAN.find((p) => p.dia === diaSemana)
  if (!plan) continue
  if (diaSemana === 1) semana++

  const f = fecha(i)
  const sesionId = id()
  filas.sesiones.push({
    id: sesionId,
    fecha: f,
    nombre_dia: plan.nombre,
    hora_inicio: `${f}T18:00:00Z`,
    hora_fin: `${f}T19:15:00Z`,
    sensacion: 3 + Math.round(aleatorio()),
  })

  plan.ejercicios.forEach((nombre, iEj) => {
    const ejercicioId = porNombre.get(nombre)
    if (!ejercicioId) return

    // Progresión lenta: 2,5 kg cada dos semanas, que es como va de verdad.
    const peso = plan.base[iEj] + Math.floor(semana / 2) * 2.5

    filas.series.push({
      id: id(),
      sesion_id: sesionId,
      ejercicio_id: ejercicioId,
      numero: 1,
      peso_kg: redondear(peso * 0.6, 1),
      reps: 10,
      rir: 5,
      tipo: 'calentamiento',
    })

    for (let n = 2; n <= 4; n++) {
      filas.series.push({
        id: id(),
        sesion_id: sesionId,
        ejercicio_id: ejercicioId,
        numero: n,
        peso_kg: peso,
        reps: 9 - n + (aleatorio() < 0.3 ? 1 : 0),
        rir: 2,
        tipo: 'normal',
      })
    }
  })
}

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------

// Orden de dependencias al sembrar; al borrar, el inverso.
const ORDEN = ['alimentos', 'medidas_corporales', 'dias', 'registros_comida', 'sesiones', 'series']

if (BORRAR) {
  for (const tabla of [...ORDEN].reverse()) {
    const ids = filas[tabla].map((f) => f.id)
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from(tabla).delete().in('id', ids.slice(i, i + 200))
      if (error) console.error(tabla, error.message)
    }
    console.log(`borrado  ${tabla}: ${ids.length}`)
  }
} else {
  for (const tabla of ORDEN) {
    for (let i = 0; i < filas[tabla].length; i += 200) {
      const { error } = await sb
        .from(tabla)
        .upsert(filas[tabla].slice(i, i + 200), { onConflict: 'id' })
      if (error) {
        console.error(tabla, error.message)
        process.exit(1)
      }
    }
    console.log(`sembrado ${tabla}: ${filas[tabla].length}`)
  }
}
