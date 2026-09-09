/**
 * Pide al navegador que el almacenamiento sea persistente.
 *
 * Sin esto, iOS puede desalojar IndexedDB cuando anda justo de espacio, y ahí
 * es donde vivirá la cola de escrituras sin sincronizar. Perder la cola es
 * perder series ya registradas en el gimnasio.
 *
 * En una PWA instalada, Safari suele concederlo sin preguntar.
 */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
