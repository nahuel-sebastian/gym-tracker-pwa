/**
 * Puente mínimo entre la capa de escritura y la de sincronización.
 *
 * `datos.ts` necesita avisar de que hay trabajo nuevo en la cola, y
 * `sincronizacion.ts` necesita leer y escribir con la capa de datos. Importarse
 * mutuamente crearía un ciclo de módulos; este registro lo rompe sin más.
 */

let disparar: (() => void) | null = null

export function registrarSincronizador(fn: () => void): void {
  disparar = fn
}

/** Avisa de que la cola tiene trabajo. No espera nada, no falla nunca. */
export function pedirSincronizacion(): void {
  disparar?.()
}
