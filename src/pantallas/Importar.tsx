import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Boton, Tarjeta } from '../componentes/Formulario'
import VistaComida from '../componentes/importar/VistaComida'
import VistaFichas from '../componentes/importar/VistaFichas'
import VistaRutina from '../componentes/importar/VistaRutina'
import { useEjercicios } from '../lib/consultas'
import { jsonDeEnlace } from '../lib/enlaces'
import { interpretarBruto, type AlimentoEstimado } from '../lib/estimacion'
import { interpretarFichas, type FichaImportada } from '../lib/fichasImportadas'
import { interpretarRutina, type RutinaImportada } from '../lib/rutinaImportada'
import { ErrorDeSobre, NOMBRE_TIPO, analizar } from '../lib/sobre'
import type { Momento } from '../lib/tipos'

/**
 * Una sola puerta de entrada para todo lo que se importa.
 *
 * No hay que elegir el tipo: **el JSON dice lo que es**. Pedirlo sería pedir un
 * dato que el texto ya lleva dentro, y abrir la puerta a elegir mal —"rutina" y
 * pegar una comida—. Cada tipo tiene su vista previa, y ninguna guarda nada
 * hasta que se confirma: lo que llega es una estimación de un modelo, no una
 * medida.
 */
type Leido =
  | { tipo: 'comida'; alimentos: AlimentoEstimado[]; momento: Momento | null }
  | { tipo: 'rutina'; rutina: RutinaImportada }
  | { tipo: 'alimentos'; fichas: FichaImportada[] }

export default function Importar() {
  const navegar = useNavigate()
  const { pathname, hash, search } = useLocation()
  const catalogo = useEjercicios('', true)

  const delEnlace = useMemo(() => jsonDeEnlace(hash, search), [hash, search])

  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [leido, setLeido] = useState<Leido | null>(null)

  useEffect(() => {
    if (!delEnlace) return

    // El texto se escribe además de interpretarse: si el JSON viene mal, el
    // campo es el único sitio donde queda para arreglarlo, porque la URL se
    // limpia justo después. Y no basta con inicializar el estado: en el primer
    // render la ruta puede no traer todavía el fragmento.
    setTexto(delEnlace)
    leer(delEnlace)

    // Con el router, no con `history.replaceState`: éste no le dice nada a
    // React Router, y al re-renderizar reponía su URL interna con el fragmento.
    navegar(pathname, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delEnlace])

  function leer(entrada: string) {
    setError(null)
    try {
      const { tipo, bruto } = analizar(entrada)

      if (tipo === 'rutina') {
        setLeido({ tipo, rutina: interpretarRutina(bruto, catalogo) })
      } else if (tipo === 'alimentos') {
        setLeido({ tipo, fichas: interpretarFichas(bruto) })
      } else {
        const estimacion = interpretarBruto(bruto)
        setLeido({ tipo, alimentos: estimacion.alimentos, momento: estimacion.momento })
      }
    } catch (e) {
      setLeido(null)
      setError(
        e instanceof Error && (e instanceof ErrorDeSobre || e.name === 'ErrorDeFormato')
          ? e.message
          : 'No he podido leer eso. Revisa el formato.',
      )
    }
  }

  async function pegar() {
    try {
      const delPortapapeles = await navigator.clipboard.readText()
      setTexto(delPortapapeles)
      setError(null)
    } catch {
      // Safari solo deja leer el portapapeles con un gesto del usuario, y a
      // veces ni así: no es un error que merezca alarmar, se pega a mano.
      setError('Tu navegador no me deja leer el portapapeles. Pega el texto a mano.')
    }
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <h2 className="text-base font-semibold">Pega el JSON de Claude</h2>
        <p className="mb-3 mt-1 text-sm text-tenue">
          Comidas, rutinas o fichas de alimentos. No hace falta decir qué es: se
          reconoce solo. Las instrucciones de cada cosa están en Ajustes.
        </p>

        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setError(null)
          }}
          rows={6}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="JSON de la comida"
          placeholder={'{\n  "tipo": "rutina",\n  …\n}'}
          className="w-full resize-y rounded-xl border border-borde bg-fondo p-3 font-mono text-sm outline-none focus:border-acento"
        />

        <div className="mt-2 flex gap-2">
          <Boton variante="secundario" onClick={() => void pegar()}>
            Pegar
          </Boton>
          <Boton onClick={() => leer(texto)} disabled={!texto.trim()}>
            Interpretar
          </Boton>
        </div>

        {error && (
          <p role="alert" className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        {leido && (
          <p className="mt-2 text-sm text-acento">
            Reconocido: {NOMBRE_TIPO[leido.tipo].toLowerCase()}.
          </p>
        )}
      </Tarjeta>

      {leido?.tipo === 'comida' && (
        <VistaComida
          alimentos={leido.alimentos}
          momentoDelJson={leido.momento}
          onCambio={(alimentos) => setLeido({ ...leido, alimentos })}
          onHecho={() => navegar('/')}
        />
      )}

      {leido?.tipo === 'rutina' && (
        <VistaRutina rutina={leido.rutina} onHecho={() => navegar('/entreno/rutinas')} />
      )}

      {leido?.tipo === 'alimentos' && (
        <VistaFichas fichas={leido.fichas} onHecho={() => navegar('/comida')} />
      )}
    </div>
  )
}
