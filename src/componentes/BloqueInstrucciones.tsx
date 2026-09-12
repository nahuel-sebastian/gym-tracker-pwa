import { useState } from 'react'
import { INSTRUCCIONES_PARA_CLAUDE } from '../lib/estimacion'
import { Boton, Tarjeta } from './Formulario'

/**
 * Las instrucciones que hay que pegar en el Proyecto de Claude para que
 * devuelva el JSON con el formato que entiende la pantalla de importar.
 *
 * El texto sale de `estimacion.ts`, al lado del parser: las dos mitades del
 * puente tienen que cambiar a la vez o dejan de encajar.
 */
export default function BloqueInstrucciones() {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(INSTRUCCIONES_PARA_CLAUDE)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles queda el texto a la vista para copiarlo a mano.
      setCopiado(false)
    }
  }

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Puente manual de macros</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        Pega esto en tu Proyecto de Claude. A partir de ahí, sus respuestas se
        podrán importar desde Comida → Importar macros.
      </p>

      {/* `pre-wrap` en vez del `pre` de serie: con scroll horizontal, en un
          iPhone las líneas largas quedarían fuera de la pantalla y este texto
          está para leerlo. */}
      <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-borde bg-fondo p-3 text-xs leading-relaxed">
        {INSTRUCCIONES_PARA_CLAUDE}
      </pre>

      <div className="mt-3">
        <Boton variante="secundario" onClick={() => void copiar()}>
          {copiado ? 'Copiado' : 'Copiar instrucciones'}
        </Boton>
      </div>
    </Tarjeta>
  )
}
