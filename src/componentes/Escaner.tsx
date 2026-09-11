import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useEffect, useRef, useState } from 'react'

/**
 * Escáner de códigos de barras.
 *
 * Se carga aparte con `lazy()`: la librería pesa y solo hace falta al escanear.
 *
 * Solo formatos de producto (EAN y UPC). Buscar además QR y códigos 2D hace el
 * reconocimiento más lento y más propenso a leer cualquier otra cosa que haya
 * en el envase.
 */
const FORMATOS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]

type Props = {
  onCodigo: (codigo: string) => void
}

export default function Escaner({ onCodigo }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pistas = new Map()
    pistas.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS)
    const lector = new BrowserMultiFormatReader(pistas)

    let controles: { stop: () => void } | undefined
    let cancelado = false

    lector
      // La cámara trasera; en un iPhone la frontal no enfoca a la distancia de
      // un envase en la mano.
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        video.current!,
        (resultado) => {
          if (resultado && !cancelado) {
            cancelado = true
            onCodigo(resultado.getText())
          }
        },
      )
      .then((c) => {
        if (cancelado) c.stop()
        else controles = c
      })
      .catch((e: unknown) => {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'No has dado permiso de cámara. Puedes escribir el código a mano.'
            : 'No he podido abrir la cámara. Puedes escribir el código a mano.',
        )
      })

    return () => {
      cancelado = true
      controles?.stop()
    }
  }, [onCodigo])

  if (error) {
    return <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">{error}</p>
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={video}
        muted
        playsInline
        className="aspect-[4/3] w-full object-cover"
        aria-label="Cámara para escanear el código de barras"
      />
      {/* Guía de encuadre: sin ella no se sabe dónde poner el código. */}
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/70" />
    </div>
  )
}
