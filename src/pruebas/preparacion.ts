import 'fake-indexeddb/auto'

// El código de sincronización consulta `navigator.onLine` y los listeners de
// `window`. En Node no existen, así que se montan mínimos y controlables.
const global_ = globalThis as Record<string, unknown>

if (!global_.navigator) global_.navigator = {}
Object.defineProperty(globalThis.navigator, 'onLine', {
  configurable: true,
  get: () => (globalThis as { __enLinea?: boolean }).__enLinea ?? true,
})

if (!global_.window) global_.window = globalThis
if (!global_.document) {
  global_.document = {
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}
if (typeof globalThis.addEventListener !== 'function') {
  global_.addEventListener = () => {}
  global_.removeEventListener = () => {}
}

// jsdom no trae `crypto.randomUUID`, y el cliente genera todos los uuid.
if (!globalThis.crypto?.randomUUID) {
  const { webcrypto } = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

// Tampoco trae `matchMedia`, que Recharts y las utilidades de tema consultan.
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia
}
