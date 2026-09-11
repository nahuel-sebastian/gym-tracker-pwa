import { defineConfig } from 'vitest/config'

/**
 * Los tests que importan son los de la cola de sincronización: es el sitio
 * donde los datos desaparecen en silencio. Corren sobre fake-indexeddb, así que
 * ejercitan Dexie de verdad (transacciones, índices compuestos), no un doble.
 *
 * Los de pantalla (`.test.tsx`) piden su propio entorno con
 * `// @vitest-environment jsdom` en la cabecera del archivo.
 */
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/pruebas/preparacion.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
