import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from './supabase'

type EstadoSesion = {
  sesion: Session | null
  cargando: boolean
}

const ContextoSesion = createContext<EstadoSesion>({
  sesion: null,
  cargando: true,
})

export function ProveedorSesion({ children }: { children: ReactNode }) {
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

export function useSesion() {
  return useContext(ContextoSesion)
}
