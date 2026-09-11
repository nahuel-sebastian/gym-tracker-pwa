import { useState } from 'react'
import { guardarAlimento } from '../lib/acciones'
import { aNumero, aTexto, formatoKcal } from '../lib/numeros'
import { desvioKcal, kcalDeMacros } from '../lib/nutricion'
import type { Alimento } from '../lib/tipos'
import { Boton, Campo, CampoNumero } from './Formulario'
import Hoja from './Hoja'

type Props = {
  /** Ficha a editar; si no se pasa, se crea una nueva. */
  alimento?: Alimento
  /** Nombre con el que precargar el formulario, de lo que se estaba buscando. */
  nombreInicial?: string
  /** Código recién escaneado, para no tener que teclearlo. */
  codigoInicial?: string
  onCerrar: () => void
  onGuardado?: (id: string) => void
}

const VACIO = {
  nombre: '',
  marca: '',
  kcal_100g: '',
  proteina_100g: '',
  grasa_100g: '',
  carbos_100g: '',
  porcion_defecto_g: '',
  codigo_barras: '',
}

/**
 * Alta y edición de una ficha de la biblioteca. Los valores son siempre por
 * 100 g, como la etiqueta del envase.
 */
export default function HojaAlimento({
  alimento,
  nombreInicial = '',
  codigoInicial = '',
  onCerrar,
  onGuardado,
}: Props) {
  const [campos, setCampos] = useState(() =>
    alimento
      ? {
          nombre: alimento.nombre,
          marca: alimento.marca ?? '',
          kcal_100g: aTexto(alimento.kcal_100g),
          proteina_100g: aTexto(alimento.proteina_100g),
          grasa_100g: aTexto(alimento.grasa_100g),
          carbos_100g: aTexto(alimento.carbos_100g),
          porcion_defecto_g: aTexto(alimento.porcion_defecto_g),
          codigo_barras: alimento.codigo_barras ?? '',
        }
      : { ...VACIO, nombre: nombreInicial, codigo_barras: codigoInicial },
  )
  const [guardando, setGuardando] = useState(false)

  const poner = (clave: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setCampos((c) => ({ ...c, [clave]: e.target.value }))

  const numeros = {
    kcal: aNumero(campos.kcal_100g),
    proteina: aNumero(campos.proteina_100g),
    grasa: aNumero(campos.grasa_100g),
    carbos: aNumero(campos.carbos_100g),
  }

  const completo =
    campos.nombre.trim() !== '' &&
    numeros.kcal !== null &&
    numeros.proteina !== null &&
    numeros.grasa !== null &&
    numeros.carbos !== null

  // Aviso, no bloqueo: hay alimentos donde la fibra justifica el desvío, y la
  // etiqueta manda sobre la aritmética. Pero teclear 36 de grasa en vez de 3,6
  // arrastraría el diario desde ese momento.
  const desvio = completo
    ? desvioKcal({
        kcal: numeros.kcal!,
        proteina: numeros.proteina!,
        grasa: numeros.grasa!,
        carbos: numeros.carbos!,
      })
    : 0
  const incoherente = desvio > 0.15

  async function enviar() {
    if (!completo) return
    setGuardando(true)
    try {
      const id = await guardarAlimento({
        id: alimento?.id,
        nombre: campos.nombre.trim(),
        marca: campos.marca.trim() || null,
        kcal_100g: numeros.kcal!,
        proteina_100g: numeros.proteina!,
        grasa_100g: numeros.grasa!,
        carbos_100g: numeros.carbos!,
        porcion_defecto_g: aNumero(campos.porcion_defecto_g),
        codigo_barras: campos.codigo_barras.trim() || null,
      })
      onGuardado?.(id)
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={alimento ? 'Editar alimento' : 'Nuevo alimento'} onCerrar={onCerrar}>
      <div className="space-y-3">
        <Campo
          etiqueta="Nombre"
          value={campos.nombre}
          onChange={poner('nombre')}
          autoCapitalize="sentences"
          autoFocus={!alimento}
        />
        <Campo etiqueta="Marca" value={campos.marca} onChange={poner('marca')} />

        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-tenue">
          Por 100 gramos
        </p>
        <div className="grid grid-cols-2 gap-3">
          <CampoNumero
            etiqueta="Kcal"
            value={campos.kcal_100g}
            onChange={poner('kcal_100g')}
          />
          <CampoNumero
            etiqueta="Proteína"
            sufijo="g"
            value={campos.proteina_100g}
            onChange={poner('proteina_100g')}
          />
          <CampoNumero
            etiqueta="Grasa"
            sufijo="g"
            value={campos.grasa_100g}
            onChange={poner('grasa_100g')}
          />
          <CampoNumero
            etiqueta="Carbohidratos"
            sufijo="g"
            value={campos.carbos_100g}
            onChange={poner('carbos_100g')}
          />
        </div>

        {incoherente && (
          <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
            Los macros dan{' '}
            {formatoKcal(
              kcalDeMacros({
                proteina: numeros.proteina!,
                grasa: numeros.grasa!,
                carbos: numeros.carbos!,
              }),
            )}{' '}
            kcal y has puesto {formatoKcal(numeros.kcal!)}. Revísalo antes de guardar.
          </p>
        )}

        <CampoNumero
          etiqueta="Porción habitual"
          sufijo="g"
          value={campos.porcion_defecto_g}
          onChange={poner('porcion_defecto_g')}
          ayuda="Se usará como cantidad por defecto al registrarlo."
        />
        <Campo
          etiqueta="Código de barras"
          inputMode="numeric"
          value={campos.codigo_barras}
          onChange={poner('codigo_barras')}
        />

        <Boton onClick={() => void enviar()} disabled={!completo || guardando}>
          {guardando ? 'Guardando…' : 'Guardar alimento'}
        </Boton>
      </div>
    </Hoja>
  )
}
