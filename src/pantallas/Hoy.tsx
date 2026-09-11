import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Anillo from '../componentes/Anillo'
import { Boton, CampoNumero, Segmentado, Tarjeta } from '../componentes/Formulario'
import HojaRegistro from '../componentes/HojaRegistro'
import Macros from '../componentes/Macros'
import { marcarTipoDia, registrarPeso } from '../lib/acciones'
import {
  useAlimentosDe,
  useComidasDelDia,
  useDia,
  useHoy,
  useMedida,
  useObjetivo,
  useRutinaActiva,
  useSesionesDelDia,
} from '../lib/consultas'
import { formatoLargo } from '../lib/fechas'
import { MOMENTOS, NOMBRE_MOMENTO, momentoSugerido } from '../lib/momentos'
import { aNumeroPositivo, formatoKcal, formatoNumero } from '../lib/numeros'
import { sumarMacros } from '../lib/nutricion'
import type { Alimento, RegistroComida, TipoDia } from '../lib/tipos'

const OPCIONES_TIPO: { valor: TipoDia; etiqueta: string }[] = [
  { valor: 'entreno', etiqueta: 'Entreno' },
  { valor: 'descanso', etiqueta: 'Descanso' },
]

export default function Hoy() {
  const fecha = useHoy()
  const { tipo, marcado } = useDia(fecha)
  const objetivo = useObjetivo(tipo, fecha)
  const comidas = useComidasDelDia(fecha)
  const alimentos = useAlimentosDe(comidas)
  const totales = sumarMacros(comidas)
  const [editando, setEditando] = useState<RegistroComida | null>(null)
  const navegar = useNavigate()

  return (
    <div className="space-y-4">
      <p className="text-sm text-tenue">{formatoLargo(fecha)}</p>

      <TipoDelDia fecha={fecha} tipo={tipo} marcado={marcado} />

      <Tarjeta>
        <Anillo consumido={totales.kcal} objetivo={objetivo?.kcal ?? 0} />
        <div className="mt-4">
          <Macros totales={totales} objetivo={objetivo} />
        </div>
        {!objetivo && (
          <Link
            to="/ajustes"
            className="mt-3 block text-center text-sm font-medium text-acento"
          >
            Pon tus objetivos en Ajustes
          </Link>
        )}
      </Tarjeta>

      <Boton onClick={() => navegar(`/comida?momento=${momentoSugerido()}`)}>
        Añadir comida
      </Boton>

      {tipo === 'entreno' && <TarjetaEntreno fecha={fecha} />}

      <PesoDeLaManana fecha={fecha} />

      <ListaComidas
        comidas={comidas}
        alimentos={alimentos}
        onTocar={setEditando}
        onAnadir={(momento) => navegar(`/comida?momento=${momento}`)}
      />

      {editando && (
        <HojaRegistro
          registro={editando}
          alimento={editando.alimento_id ? alimentos.get(editando.alimento_id) : undefined}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

/**
 * Selector de tipo de día. Mientras no esté marcado ocupa una tarjeta entera
 * con la pregunta: de ese dato dependen los objetivos contra los que se compara
 * todo lo demás. Una vez marcado se reduce a una línea.
 */
function TipoDelDia({
  fecha,
  tipo,
  marcado,
}: {
  fecha: string
  tipo: TipoDia
  marcado: boolean
}) {
  const cambiar = (t: TipoDia) => void marcarTipoDia(fecha, t)

  if (!marcado) {
    return (
      <Tarjeta>
        <h2 className="text-base font-semibold">¿Hoy entrenas?</h2>
        <p className="mb-3 mt-1 text-sm text-tenue">
          Marca el día para comparar con el objetivo que le toca.
        </p>
        <Segmentado opciones={OPCIONES_TIPO} valor={null} onCambio={cambiar} />
      </Tarjeta>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-tenue">Día de</span>
      <div className="flex-1">
        <Segmentado opciones={OPCIONES_TIPO} valor={tipo} onCambio={cambiar} />
      </div>
    </div>
  )
}

/** Acceso al entreno del día: empezar el que toca, o seguir el que está a medias. */
function TarjetaEntreno({ fecha }: { fecha: string }) {
  const rutina = useRutinaActiva()
  const sesiones = useSesionesDelDia(fecha)
  const enCurso = sesiones.find((s) => !s.hora_fin)
  const terminadas = sesiones.filter((s) => s.hora_fin)

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Entreno</h2>

      {enCurso ? (
        <p className="mt-1 text-sm text-tenue">
          Sesión a medias{enCurso.nombre_dia ? `: ${enCurso.nombre_dia}` : ''}.
        </p>
      ) : terminadas.length ? (
        <p className="mt-1 text-sm text-tenue">
          Hecho{terminadas[0].nombre_dia ? `: ${terminadas[0].nombre_dia}` : ''}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-tenue">
          {rutina ? rutina.nombre : 'Sin rutina activa. Puedes hacer una sesión libre.'}
        </p>
      )}

      <Link
        to="/entreno"
        className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-acento font-semibold text-fondo active:opacity-70"
      >
        {enCurso ? 'Continuar entreno' : terminadas.length ? 'Ver entreno' : 'Empezar entreno'}
      </Link>
    </Tarjeta>
  )
}

/** Peso de la mañana: un campo y listo, o el valor ya registrado. */
function PesoDeLaManana({ fecha }: { fecha: string }) {
  const medida = useMedida(fecha)
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(false)

  const valor = aNumeroPositivo(texto)

  async function guardarPeso() {
    if (!valor) return
    await registrarPeso(fecha, valor)
    setTexto('')
    setEditando(false)
  }

  if (medida?.peso_kg && !editando) {
    return (
      <Tarjeta>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Peso de hoy</h2>
            <p className="cifras mt-1 text-2xl font-semibold">
              {formatoNumero(medida.peso_kg, 2)} kg
            </p>
          </div>
          <button
            onClick={() => setEditando(true)}
            className="min-h-11 rounded-xl border border-borde px-4 text-sm font-medium active:bg-fondo"
          >
            Cambiar
          </button>
        </div>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta>
      <h2 className="text-base font-semibold">Peso de la mañana</h2>
      <p className="mb-3 mt-1 text-sm text-tenue">
        En ayunas y a la misma hora; lo que cuenta es la media de la semana.
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <CampoNumero
            etiqueta="Peso"
            sufijo="kg"
            value={texto}
            placeholder={medida?.peso_kg ? formatoNumero(medida.peso_kg, 2) : ''}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <button
          onClick={() => void guardarPeso()}
          disabled={!valor}
          className="mt-[1.65rem] min-h-12 rounded-xl bg-acento px-5 font-semibold text-fondo disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </Tarjeta>
  )
}

/** Las comidas del día por momento. Los momentos vacíos también salen. */
function ListaComidas({
  comidas,
  alimentos,
  onTocar,
  onAnadir,
}: {
  comidas: RegistroComida[]
  alimentos: Map<string, Alimento>
  onTocar: (r: RegistroComida) => void
  onAnadir: (momento: string) => void
}) {
  return (
    <div className="space-y-3">
      {MOMENTOS.map((momento) => {
        const delMomento = comidas.filter((c) => c.momento === momento)
        const total = sumarMacros(delMomento)

        return (
          <Tarjeta key={momento} className="!p-0">
            <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
              <h3 className="text-sm font-semibold">{NOMBRE_MOMENTO[momento]}</h3>
              <span className="cifras text-sm text-tenue">
                {delMomento.length ? `${formatoKcal(total.kcal)} kcal` : ''}
              </span>
            </div>

            {delMomento.map((c) => {
              const alimento = c.alimento_id ? alimentos.get(c.alimento_id) : undefined
              return (
                <button
                  key={c.id}
                  onClick={() => onTocar(c)}
                  className="flex min-h-12 w-full items-center gap-3 border-t border-borde px-4 py-2 text-left active:bg-fondo"
                >
                  <span className="flex-1 truncate text-sm">
                    {alimento?.nombre ?? c.descripcion ?? 'Sin nombre'}
                    {c.gramos ? (
                      <span className="cifras text-tenue"> · {formatoNumero(c.gramos)} g</span>
                    ) : null}
                  </span>
                  <span className="cifras text-sm text-tenue">{formatoKcal(c.kcal)}</span>
                </button>
              )
            })}

            <button
              onClick={() => onAnadir(momento)}
              className="min-h-11 w-full border-t border-borde px-4 text-left text-sm font-medium text-acento active:bg-fondo"
            >
              + Añadir a {NOMBRE_MOMENTO[momento].toLowerCase()}
            </button>
          </Tarjeta>
        )
      })}
    </div>
  )
}
