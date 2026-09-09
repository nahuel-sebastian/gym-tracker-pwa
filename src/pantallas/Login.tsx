import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

/**
 * No hay pantalla de registro: la cuenta se crea a mano desde el panel de
 * Supabase. Esta app es de una sola persona.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : `No se ha podido entrar: ${error.message}`,
      )
      setEnviando(false)
    }
    // Si va bien, onAuthStateChange se encarga de cambiar de pantalla.
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-fondo px-6 text-texto">
      <div className="mx-auto w-full max-w-sm">
        <img src="/pwa-192.png" alt="" className="mx-auto mb-6 h-16 w-16 rounded-2xl" />
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Gimnasio y Nutrición
        </h1>
        <p className="mt-1 text-center text-sm text-tenue">Entra con tu cuenta</p>

        <form onSubmit={entrar} className="mt-8 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-tenue">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              required
              className="w-full rounded-xl border border-borde bg-superficie px-3 py-3 outline-none focus:border-acento"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-tenue">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-borde bg-superficie px-3 py-3 outline-none focus:border-acento"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="min-h-12 w-full rounded-xl bg-acento font-semibold text-fondo disabled:opacity-60"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
