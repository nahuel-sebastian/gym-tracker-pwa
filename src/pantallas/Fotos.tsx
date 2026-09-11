import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Boton, Segmentado, Tarjeta } from '../componentes/Formulario'
import { useHoy } from '../lib/consultas'
import { db } from '../lib/db'
import { formatoCorto } from '../lib/fechas'
import { ErrorDeFoto, borrarFoto, subirFoto, urlFirmada } from '../lib/fotos'
import { formatoNumero } from '../lib/numeros'
import type { Angulo, FotoProgreso } from '../lib/tipos'

const ANGULOS: { valor: Angulo; etiqueta: string }[] = [
  { valor: 'frontal', etiqueta: 'Frontal' },
  { valor: 'lateral', etiqueta: 'Lateral' },
  { valor: 'espalda', etiqueta: 'Espalda' },
]

/**
 * Galería de fotos de progreso, con comparación entre dos fechas.
 *
 * Es la única pantalla que necesita conexión: el bucket es privado y cada
 * imagen se abre con una URL firmada de una hora.
 */
export default function Fotos() {
  const hoy = useHoy()
  const fotos = useLiveQuery(() => db.fotos_progreso.orderBy('fecha').reverse().toArray()) ?? []

  const [angulo, setAngulo] = useState<Angulo>('frontal')
  const [comparando, setComparando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  const delAngulo = fotos.filter((f) => f.angulo === angulo)

  async function elegida(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0]
    e.target.value = ''
    if (!fichero) return

    setSubiendo(true)
    setError(null)
    try {
      await subirFoto(fichero, hoy, angulo)
    } catch (err) {
      setError(err instanceof ErrorDeFoto ? err.message : 'No he podido subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <h2 className="text-base font-semibold">Ángulo</h2>
        <p className="mb-3 mt-1 text-sm text-tenue">
          Siempre el mismo encuadre y la misma luz, o la comparación no dice nada.
        </p>
        <Segmentado opciones={ANGULOS} valor={angulo} onCambio={setAngulo} />

        <input
          ref={archivo}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void elegida(e)}
          className="hidden"
        />

        <div className="mt-3">
          <Boton onClick={() => archivo.current?.click()} disabled={subiendo}>
            {subiendo ? 'Subiendo…' : `Añadir foto de ${formatoCorto(hoy)}`}
          </Boton>
        </div>

        <p className="mt-2 text-xs text-tenue">
          Se redimensiona a 1600 px antes de subirla. Las fotos son lo único de la
          app que necesita conexión.
        </p>

        {error && (
          <p role="alert" className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </Tarjeta>

      {delAngulo.length >= 2 && (
        <Boton variante="secundario" onClick={() => setComparando((v) => !v)}>
          {comparando ? 'Ver la galería' : 'Comparar la primera con la última'}
        </Boton>
      )}

      {comparando && delAngulo.length >= 2 ? (
        <Comparacion
          antes={delAngulo[delAngulo.length - 1]}
          despues={delAngulo[0]}
        />
      ) : (
        <Galeria fotos={delAngulo} onBorrada={() => setError(null)} />
      )}
    </div>
  )
}

function Galeria({ fotos, onBorrada }: { fotos: FotoProgreso[]; onBorrada: () => void }) {
  if (!fotos.length) {
    return (
      <Tarjeta>
        <p className="text-sm text-tenue">Ninguna foto de este ángulo todavía.</p>
      </Tarjeta>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {fotos.map((f) => (
        <Miniatura key={f.id} foto={f} onBorrada={onBorrada} />
      ))}
    </div>
  )
}

function Miniatura({ foto, onBorrada }: { foto: FotoProgreso; onBorrada: () => void }) {
  const url = useUrlFirmada(foto.ruta_storage)
  const [confirmando, setConfirmando] = useState(false)

  return (
    <figure className="overflow-hidden rounded-2xl border border-borde bg-superficie">
      <Imagen url={url} alt={`Foto del ${formatoCorto(foto.fecha)}`} />
      <figcaption className="flex items-baseline justify-between gap-2 px-3 py-2">
        <span className="text-sm font-medium">{formatoCorto(foto.fecha)}</span>
        {foto.peso_kg && (
          <span className="cifras text-xs text-tenue">{formatoNumero(foto.peso_kg, 2)} kg</span>
        )}
      </figcaption>
      <div className="px-3 pb-3">
        {confirmando ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmando(false)}
              className="min-h-11 flex-1 rounded-xl border border-borde text-sm"
            >
              No
            </button>
            <button
              onClick={() => {
                void borrarFoto(foto.id, foto.ruta_storage)
                onBorrada()
              }}
              className="min-h-11 flex-1 rounded-xl border border-borde text-sm text-error"
            >
              Borrar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            className="min-h-11 w-full text-sm text-tenue active:opacity-70"
          >
            Borrar
          </button>
        )}
      </div>
    </figure>
  )
}

/** Dos fechas lado a lado: es la vista que enseña el cambio de verdad. */
function Comparacion({ antes, despues }: { antes: FotoProgreso; despues: FotoProgreso }) {
  const urlAntes = useUrlFirmada(antes.ruta_storage)
  const urlDespues = useUrlFirmada(despues.ruta_storage)
  const diferencia =
    antes.peso_kg && despues.peso_kg ? despues.peso_kg - antes.peso_kg : null

  return (
    <Tarjeta>
      <div className="grid grid-cols-2 gap-3">
        {[
          { foto: antes, url: urlAntes },
          { foto: despues, url: urlDespues },
        ].map(({ foto, url }) => (
          <figure key={foto.id} className="overflow-hidden rounded-xl border border-borde">
            <Imagen url={url} alt={`Foto del ${formatoCorto(foto.fecha)}`} />
            <figcaption className="px-2 py-1.5 text-center text-sm">
              {formatoCorto(foto.fecha)}
              {foto.peso_kg && (
                <span className="cifras block text-xs text-tenue">
                  {formatoNumero(foto.peso_kg, 2)} kg
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-3 text-center text-sm text-tenue">
        {diferencia !== null ? (
          <>
            <span className="cifras font-semibold text-texto">
              {diferencia > 0 ? '+' : ''}
              {formatoNumero(diferencia, 2)} kg
            </span>{' '}
            entre las dos fechas
          </>
        ) : (
          'Sin peso registrado en alguna de las dos fechas.'
        )}
      </p>
    </Tarjeta>
  )
}

function Imagen({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (url === undefined) return <div className="aspect-[3/4] w-full animate-pulse bg-fondo" />

  if (url === null) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center bg-fondo px-3 text-center text-xs text-tenue">
        No se ha podido cargar. Hace falta conexión.
      </div>
    )
  }

  return <img src={url} alt={alt} loading="lazy" className="aspect-[3/4] w-full object-cover" />
}

/**
 * El bucket es privado: cada imagen necesita una firma. Se piden al montar y
 * duran una hora, de sobra para una sesión mirando la galería.
 */
function useUrlFirmada(ruta: string): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    void urlFirmada(ruta).then((u) => {
      if (vivo) setUrl(u)
    })
    return () => {
      vivo = false
    }
  }, [ruta])

  return url
}
