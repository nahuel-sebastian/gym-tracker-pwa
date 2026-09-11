import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Boton, Tarjeta } from '../componentes/Formulario'
import HojaAlimento from '../componentes/HojaAlimento'
import HojaAnadirAlimento from '../componentes/HojaAnadirAlimento'
import HojaEscanear from '../componentes/HojaEscanear'
import { duplicarDia } from '../lib/acciones'
import { registrarReceta } from '../lib/recetas'
import { db } from '../lib/db'
import { useAlimentos, useHoy, useRecetas } from '../lib/consultas'
import { formatoRelativo, sumarDias } from '../lib/fechas'
import { NOMBRE_MOMENTO, momentoSugerido } from '../lib/momentos'
import { formatoKcal, formatoNumero } from '../lib/numeros'
import type { Alimento, Momento } from '../lib/tipos'

/**
 * Registro de comidas. El buscador es la vía principal y está arriba, enfocado
 * cuando se llega desde el botón de Hoy: de escribir tres letras a tener la
 * comida registrada son dos toques.
 */
export default function Comida() {
  const fecha = useHoy()
  const [params] = useSearchParams()
  const momentoPedido = params.get('momento') as Momento | null
  const momento = momentoPedido ?? momentoSugerido()

  const [busqueda, setBusqueda] = useState('')
  const alimentos = useAlimentos(busqueda)
  const [aAnadir, setAAnadir] = useState<Alimento | null>(null)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Alimento | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [codigoAMano, setCodigoAMano] = useState<{ codigo: string; nombre: string } | null>(null)

  /** Tras crear o corregir una ficha se vuelve a la cantidad, sin buscarla otra vez. */
  async function trasCrear(id: string) {
    const nuevo = await db.alimentos.get(id)
    if (nuevo) setAAnadir(nuevo)
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-4 bg-fondo/95 px-4 pb-2 pt-1 backdrop-blur">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en mi biblioteca"
          autoCapitalize="none"
          autoCorrect="off"
          // Enfocado solo al llegar desde "Añadir comida": entrar por la
          // pestaña no debería levantar el teclado sin pedirlo.
          autoFocus={momentoPedido !== null}
          className="min-h-12 w-full rounded-xl border border-borde bg-superficie px-3 outline-none focus:border-acento"
        />
        <p className="mt-1.5 text-xs text-tenue">
          Se añadirá a {NOMBRE_MOMENTO[momento].toLowerCase()} de{' '}
          {formatoRelativo(fecha).toLowerCase()}
        </p>
      </div>

      {alimentos.length > 0 && (
        <Tarjeta className="!p-0">
          {alimentos.map((a) => (
            <button
              key={a.id}
              onClick={() => setAAnadir(a)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-borde px-4 py-2 text-left last:border-b-0 active:bg-fondo"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.nombre}</span>
                <span className="block truncate text-xs text-tenue">
                  {a.marca ? `${a.marca} · ` : ''}
                  <span className="cifras">
                    {formatoKcal(a.kcal_100g)} kcal · P {formatoNumero(a.proteina_100g)} · G{' '}
                    {formatoNumero(a.grasa_100g)} · C {formatoNumero(a.carbos_100g)} /100 g
                  </span>
                </span>
              </span>
              {a.favorito && <span className="text-acento">★</span>}
            </button>
          ))}
        </Tarjeta>
      )}

      {alimentos.length === 0 && (
        <Tarjeta>
          <p className="text-sm text-tenue">
            {busqueda.trim()
              ? `No hay nada que se llame «${busqueda.trim()}» en tu biblioteca.`
              : 'Tu biblioteca está vacía. Da de alta el primer alimento y quedará guardado para siempre.'}
          </p>
        </Tarjeta>
      )}

      <div className="flex gap-2">
        <Boton variante="secundario" onClick={() => setEscaneando(true)}>
          Escanear
        </Boton>
        <Boton onClick={() => setCreando(true)}>
          {busqueda.trim() ? `Crear «${busqueda.trim()}»` : 'Nuevo alimento'}
        </Boton>
      </div>

      <TarjetaRecetas fecha={fecha} momento={momento} />

      <Tarjeta>
        <h2 className="text-base font-semibold">Importar macros</h2>
        <p className="mb-3 mt-1 text-sm text-tenue">
          Pega el JSON que te devuelve Claude al analizar la foto de un plato.
        </p>
        <Link
          to="/comida/importar"
          className="flex min-h-12 items-center justify-center rounded-xl border border-borde font-medium active:bg-fondo"
        >
          Pegar un JSON
        </Link>
      </Tarjeta>

      <DuplicarDia fecha={fecha} />

      {aAnadir && (
        <HojaAnadirAlimento
          alimento={aAnadir}
          fecha={fecha}
          momentoInicial={momento}
          onCerrar={() => setAAnadir(null)}
          onRegistrado={() => setBusqueda('')}
          onEditarFicha={() => {
            setEditando(aAnadir)
            setAAnadir(null)
          }}
        />
      )}

      {creando && (
        <HojaAlimento
          nombreInicial={busqueda.trim()}
          codigoInicial={codigoAMano?.codigo}
          onCerrar={() => {
            setCreando(false)
            setCodigoAMano(null)
          }}
          onGuardado={(id) => void trasCrear(id)}
        />
      )}

      {escaneando && (
        <HojaEscanear
          onAlimento={(a) => {
            setEscaneando(false)
            setAAnadir(a)
          }}
          onAMano={(codigo, nombre) => {
            setEscaneando(false)
            setCodigoAMano({ codigo, nombre })
            setBusqueda(nombre)
            setCreando(true)
          }}
          onCerrar={() => setEscaneando(false)}
        />
      )}

      {editando && (
        <HojaAlimento
          alimento={editando}
          onCerrar={() => setEditando(null)}
          // Corregir la ficha devuelve a la cantidad, que es de donde se venía.
          onGuardado={(id) => void trasCrear(id)}
        />
      )}
    </div>
  )
}

/**
 * Las recetas, registrables de un toque: una porción en el momento que toca.
 * Es el atajo para lo que se come siempre igual.
 */
function TarjetaRecetas({ fecha, momento }: { fecha: string; momento: Momento }) {
  const recetas = useRecetas()
  const [hecha, setHecha] = useState<string | null>(null)

  async function registrar(receta: (typeof recetas)[number]) {
    await registrarReceta(fecha, momento, receta)
    setHecha(receta.id)
    setTimeout(() => setHecha(null), 1800)
  }

  return (
    <Tarjeta className="!p-0">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <h2 className="text-base font-semibold">Recetas</h2>
        <Link to="/comida/recetas" className="text-sm font-medium text-acento">
          Gestionar
        </Link>
      </div>

      {recetas.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-tenue">
          Define una receta y podrás registrarla de un toque.
        </p>
      ) : (
        <ul className="divide-y divide-borde border-t border-borde">
          {recetas.slice(0, 6).map((r) => (
            <li key={r.id}>
              <button
                onClick={() => void registrar(r)}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-fondo"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.nombre}</span>
                <span className="shrink-0 text-sm text-acento">
                  {hecha === r.id ? 'Añadida' : '+ 1 porción'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

/** Copia las comidas de ayer: los días repetidos son la norma, no la excepción. */
function DuplicarDia({ fecha }: { fecha: string }) {
  const ayer = sumarDias(fecha, -1)
  const [estado, setEstado] = useState<string | null>(null)

  async function duplicar() {
    const copiados = await duplicarDia(ayer, fecha)
    setEstado(
      copiados
        ? `${copiados} ${copiados === 1 ? 'comida copiada' : 'comidas copiadas'} de ayer.`
        : 'Ayer no registraste nada.',
    )
  }

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Duplicar día anterior</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        Copia todo lo de ayer a hoy, con los macros tal como quedaron registrados.
      </p>
      <Boton variante="secundario" onClick={() => void duplicar()}>
        Copiar lo de ayer
      </Boton>
      {estado && <p className="mt-2 text-sm text-acento">{estado}</p>}
    </Tarjeta>
  )
}
