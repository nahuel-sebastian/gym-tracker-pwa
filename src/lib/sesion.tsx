import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { ContextoSesion } from './useSesion'

export default function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // getSession lee de localStorage sin ir a la red: la app arranca al
    // instante y sin conexión sigue considerándote autenticado.
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      setCargando(false)
    })

    return () => suscripcion.subscription.unsubscribe()
  }, [])

  const valor = useMemo(() => ({ sesion, cargando }), [sesion, cargando])

  return <ContextoSesion value={valor}>{children}</ContextoSesion>
}
