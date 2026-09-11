import { Suspense, lazy, useCallback, useState } from 'react'
import { MOTIVO, resolverCodigo, type SinFicha } from '../lib/codigoBarras'
import type { Alimento } from '../lib/tipos'
import { Boton, Campo } from './Formulario'
import Hoja from './Hoja'

/** La librería de escaneo pesa y solo hace falta con la hoja abierta. */
const Escaner = lazy(() => import('./Escaner'))

type Props = {
  onAlimento: (alimento: Alimento) => void
  onAMano: (codigo: string, nombre: string) => void
  onCerrar: () => void
}

/**
 * Escanear un producto y acabar en uno de dos sitios: la cantidad de un
 * alimento que ya tiene ficha, o el alta a mano con el código ya puesto.
 */
export default function HojaEscanear({ onAlimento, onAMano, onCerrar }: Props) {
  const [estado, setEstado] = useState<'leyendo' | 'buscando'>('leyendo')
  const [fallo, setFallo] = useState<SinFicha | null>(null)
  const [aMano, setAMano] = useState('')

  const resolver = useCallback(
    async (codigo: string) => {
      setEstado('buscando')
      const resultado = await resolverCodigo(codigo)

      if (resultado.estado === 'a_mano') {
        setFallo(resultado)
        setEstado('leyendo')
        return
      }

      onAlimento(resultado.alimento)
    },
    [onAlimento],
  )

  return (
    <Hoja titulo="Escanear producto" onCerrar={onCerrar}>
      <div className="space-y-3">
        {fallo ? (
          <>
            <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
              {MOTIVO[fallo.motivo]}
            </p>
            <p className="cifras text-sm text-tenue">Código: {fallo.codigo}</p>
            <Boton onClick={() => onAMano(fallo.codigo, fallo.nombre)}>
              Darlo de alta a mano
            </Boton>
            <Boton variante="secundario" onClick={() => setFallo(null)}>
              Escanear otro
            </Boton>
          </>
        ) : (
          <>
            <Suspense
              fallback={<div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-fondo" />}
            >
              <Escaner onCodigo={(c) => void resolver(c)} />
            </Suspense>

            <p className="text-center text-sm text-tenue">
              {estado === 'buscando' ? 'Buscando el producto…' : 'Encuadra el código de barras'}
            </p>

            {/* Salida siempre disponible: los códigos arrugados o mal impresos
                no hay cámara que los lea, y el envase tiene el número escrito. */}
            <Campo
              etiqueta="O escribe el código"
              inputMode="numeric"
              value={aMano}
              onChange={(e) => setAMano(e.target.value.replace(/\D/g, ''))}
              placeholder="8480000123456"
            />
            <Boton
              variante="secundario"
              disabled={aMano.length < 8}
              onClick={() => void resolver(aMano)}
            >
              Buscar ese código
            </Boton>
          </>
        )}
      </div>
    </Hoja>
  )
}
