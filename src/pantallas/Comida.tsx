import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Boton, Tarjeta } from '../componentes/Formulario'
import HojaAlimento from '../componentes/HojaAlimento'
import HojaAnadirAlimento from '../componentes/HojaAnadirAlimento'
import { duplicarDia } from '../lib/acciones'
import { db } from '../lib/db'
import { useAlimentos, useHoy } from '../lib/consultas'
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

  /** Recién creado: se abre directamente la cantidad, sin volver a buscarlo. */
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

      <Boton onClick={() => setCreando(true)}>
        {busqueda.trim() ? `Crear «${busqueda.trim()}»` : 'Nuevo alimento'}
      </Boton>

      <DuplicarDia fecha={fecha} />

      <Tarjeta>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-tenue">
          Pendiente en esta pantalla
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {[
            'Escáner de código de barras y Open Food Facts',
            'Recetas y comidas guardadas de un toque',
            'Importar el JSON del puente manual de macros',
          ].map((linea) => (
            <li key={linea} className="flex gap-2">
              <span className="text-tenue">·</span>
              {linea}
            </li>
          ))}
        </ul>
      </Tarjeta>

      {aAnadir && (
        <HojaAnadirAlimento
          alimento={aAnadir}
          fecha={fecha}
          momentoInicial={momento}
          onCerrar={() => setAAnadir(null)}
          onRegistrado={() => setBusqueda('')}
        />
      )}

      {creando && (
        <HojaAlimento
          nombreInicial={busqueda.trim()}
          onCerrar={() => setCreando(false)}
          onGuardado={(id) => void trasCrear(id)}
        />
      )}
    </div>
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
