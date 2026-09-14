import { useState } from 'react'
import { Link } from 'react-router'
import { INSTRUCCIONES_PARA_CLAUDE } from '../lib/estimacion'
import { INSTRUCCIONES_FICHAS } from '../lib/fichasImportadas'
import { INSTRUCCIONES_RUTINA } from '../lib/rutinaImportada'
import { NOMBRE_TIPO, type TipoImportable } from '../lib/sobre'
import { Boton, Tarjeta } from './Formulario'

/**
 * Las instrucciones que hay que pegar en un Proyecto de Claude para que
 * devuelva JSON que la pantalla de importar entienda.
 *
 * Aquí sí hay un desplegable, y en la pantalla de importar no: elegir el tipo
 * al importar sería repetir un dato que el JSON ya lleva, pero elegirlo aquí es
 * lo único que se puede hacer — todavía no hay JSON del que deducir nada, se
 * está montando el Proyecto que lo va a producir.
 *
 * Cada texto vive al lado de su parser, para que las dos mitades del puente
 * cambien a la vez.
 */
const INSTRUCCIONES: Record<TipoImportable, string> = {
  comida: INSTRUCCIONES_PARA_CLAUDE,
  rutina: INSTRUCCIONES_RUTINA,
  alimentos: INSTRUCCIONES_FICHAS,
}

const PARA_QUE: Record<TipoImportable, string> = {
  comida: 'Foto de un plato → los macros de lo que te has comido.',
  rutina: 'Una rutina entera con sus días, ejercicios y objetivos.',
  alimentos: 'Fichas por 100 g para la biblioteca: lo casero, lo que no tiene código de barras.',
}

export default function BloqueInstrucciones() {
  const [tipo, setTipo] = useState<TipoImportable>('comida')
  const [copiado, setCopiado] = useState(false)

  const texto = INSTRUCCIONES[tipo]

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles queda el texto a la vista para copiarlo a mano.
      setCopiado(false)
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Importar</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        Un Proyecto de Claude por cada cosa. Pega dentro estas instrucciones y sus
        respuestas se podrán importar desde{' '}
        <Link to="/importar" className="text-acento underline">
          Importar
        </Link>
        . No hace falta decir qué es al pegarlo: se reconoce solo.
      </p>

      <label className="block text-sm text-tenue" htmlFor="tipo-instrucciones">
        Qué quiero importar
      </label>
      <select
        id="tipo-instrucciones"
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value as TipoImportable)
          setCopiado(false)
        }}
        className="mt-1 min-h-12 w-full rounded-xl border border-borde bg-fondo px-3 outline-none focus:border-acento"
      >
        {(Object.keys(INSTRUCCIONES) as TipoImportable[]).map((t) => (
          <option key={t} value={t}>
            {NOMBRE_TIPO[t]}
          </option>
        ))}
      </select>

      <p className="mt-2 text-sm text-tenue">{PARA_QUE[tipo]}</p>

      {/* `pre-wrap` en vez del `pre` de serie: con scroll horizontal, en un
          iPhone las líneas largas quedarían fuera de la pantalla y este texto
          está para leerlo. */}
      <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-borde bg-fondo p-3 text-xs leading-relaxed">
        {texto}
      </pre>

      <div className="mt-3">
        <Boton variante="secundario" onClick={() => void copiar()}>
          {copiado ? 'Copiado' : 'Copiar instrucciones'}
        </Boton>
      </div>
    </Tarjeta>
  )
}
