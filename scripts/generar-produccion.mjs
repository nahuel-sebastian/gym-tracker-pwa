/**
 * Regenera `docs/produccion.sql` concatenando las migraciones en orden.
 *
 * Ese archivo existe para pegarlo de una vez en el SQL Editor de Supabase, y se
 * queda obsoleto en cuanto se añade una migración. Generarlo con un script
 * permite que la integración continua compruebe que sigue al día, en vez de
 * confiar en acordarse.
 *
 *   node scripts/generar-produccion.mjs            # escribe el archivo
 *   node scripts/generar-produccion.mjs --revisar  # falla si está desfasado
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const REVISAR = process.argv.includes('--revisar')

const dirMigraciones = new URL('../supabase/migrations/', import.meta.url)
const destino = new URL('../docs/produccion.sql', import.meta.url)

const CABECERA = `-- =============================================================================
-- Esquema completo para el proyecto de PRODUCCIÓN
--
-- GENERADO. No editar a mano: sale de concatenar supabase/migrations/ en orden.
--   node scripts/generar-produccion.mjs
--
-- Pégalo entero en el SQL Editor de Supabase y ejecútalo de una vez.
--
-- IMPORTANTE: crea antes la cuenta en Authentication → Users → Add user.
-- La 0005 siembra el catálogo a la PRIMERA cuenta de la base. Para las demás,
-- la 0007 deja una función a la que se llama por email:
--
--   select public.sembrar_catalogo_ejercicios('otra@cuenta.com');
--
-- Todo es idempotente salvo los CREATE TABLE: si el esquema ya está puesto y
-- solo falta una migración nueva, pega únicamente ese bloque.
-- =============================================================================
`

const archivos = readdirSync(dirMigraciones)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const partes = archivos.map(
  (f) =>
    `\n\n-- ####################  ${f}  ####################\n\n` +
    readFileSync(new URL(f, dirMigraciones), 'utf8'),
)

const generado = CABECERA + partes.join('')

if (!REVISAR) {
  writeFileSync(destino, generado)
  console.log(`docs/produccion.sql · ${archivos.length} migraciones`)
  process.exit(0)
}

const actual = readFileSync(destino, 'utf8')

if (actual !== generado) {
  console.error(
    'docs/produccion.sql está desfasado respecto a supabase/migrations/.\n' +
      'Regenéralo con: node scripts/generar-produccion.mjs',
  )
  process.exit(1)
}

console.log(`docs/produccion.sql al día · ${archivos.length} migraciones`)
