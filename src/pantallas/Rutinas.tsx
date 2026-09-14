import { useState } from 'react'
import { Boton, Campo, CampoNumero, Tarjeta } from '../componentes/Formulario'
import Hoja from '../componentes/Hoja'
import HojaElegirEjercicio from '../componentes/HojaElegirEjercicio'
import {
  useCatalogo,
  useDiasDeRutina,
  useEjerciciosDeDia,
  useHoy,
  useRutinas,
} from '../lib/consultas'
import { guardar } from '../lib/datos'
import { aNumero, aTexto } from '../lib/numeros'
import {
  activarRutina,
  anadirDia,
  anadirEjercicioADia,
  borrarDia,
  borrarRutina,
  crearRutina,
  mover,
  rutinaComoJson,
  quitarEjercicioDeDia,
} from '../lib/rutinas'
import type { RutinaEjercicio } from '../lib/tipos'

/** Gestión de rutinas: crear, montar los días y activar la que se está haciendo. */
export default function Rutinas() {
  const fecha = useHoy()
  const rutinas = useRutinas()
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  const abierta = rutinas.find((r) => r.id === seleccionada) ?? rutinas.find((r) => r.activa)

  async function crear() {
    if (!nombre.trim()) return
    const id = await crearRutina(nombre.trim(), fecha)
    setNombre('')
    setCreando(false)
    setSeleccionada(id)
  }

  return (
    <div className="space-y-4">
      <Tarjeta className="!p-0">
        {rutinas.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setSeleccionada(r.id)
              setConfirmandoBorrado(false)
            }}
            className={`flex min-h-12 w-full items-center justify-between border-b border-borde px-4 text-left text-sm last:border-b-0 active:bg-fondo ${
              abierta?.id === r.id ? 'font-semibold' : ''
            }`}
          >
            {r.nombre}
            {r.activa && <span className="text-xs font-medium text-acento">Activa</span>}
          </button>
        ))}
        {rutinas.length === 0 && (
          <p className="p-4 text-sm text-tenue">Todavía no hay ninguna rutina.</p>
        )}
      </Tarjeta>

      <Boton variante="secundario" onClick={() => setCreando(true)}>
        Nueva rutina
      </Boton>

      {abierta && (
        <>
          {!abierta.activa && (
            <Boton onClick={() => void activarRutina(abierta.id)}>Activar</Boton>
          )}

          <DiasDeRutina rutinaId={abierta.id} />

          <CompartirRutina rutinaId={abierta.id} nombre={abierta.nombre} />

          {/* Borrar una rutina se lleva sus días y sus ejercicios por delante,
              así que va al final y en dos pasos. Las sesiones ya entrenadas
              sobreviven: su `dia_id` queda a null y conservan el nombre. */}
          {confirmandoBorrado ? (
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => setConfirmandoBorrado(false)}>
                Cancelar
              </Boton>
              <Boton
                variante="peligro"
                onClick={() => {
                  void borrarRutina(abierta.id)
                  setSeleccionada(null)
                  setConfirmandoBorrado(false)
                }}
              >
                Sí, borrar «{abierta.nombre}»
              </Boton>
            </div>
          ) : (
            <Boton variante="peligro" onClick={() => setConfirmandoBorrado(true)}>
              Borrar rutina
            </Boton>
          )}
        </>
      )}

      {creando && (
        <Hoja titulo="Nueva rutina" onCerrar={() => setCreando(false)}>
          <div className="space-y-3">
            <Campo
              etiqueta="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Full body 3 días"
              autoFocus
            />
            <Boton onClick={() => void crear()} disabled={!nombre.trim()}>
              Crear
            </Boton>
          </div>
        </Hoja>
      )}
    </div>
  )
}

/**
 * La rutina como JSON, para pasarla a otra cuenta.
 *
 * El mismo formato que acepta el importador, así que el viaje de vuelta no pasa
 * por Claude: la app produce lo que la app entiende. Los ejercicios van por
 * nombre porque los ids son de un usuario y no valen en el otro.
 */
function CompartirRutina({ rutinaId, nombre }: { rutinaId: string; nombre: string }) {
  const [json, setJson] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function abrir() {
    setAviso(null)
    setJson(await rutinaComoJson(rutinaId))
  }

  // Safari de iPhone la tiene; los navegadores de escritorio, casi nunca. El
  // tipado de TS la da por segura, de ahí el `typeof`.
  const sePuedeCompartir = typeof navigator.share === 'function'

  async function compartir(texto: string) {
    // En el iPhone la hoja de compartir es el camino natural (WhatsApp, Notas).
    // En el portátil casi nunca existe, y ahí el portapapeles es lo que hay.
    try {
      if (sePuedeCompartir) await navigator.share({ title: nombre, text: texto })
      else {
        await navigator.clipboard.writeText(texto)
        setAviso('Copiado al portapapeles.')
      }
    } catch {
      // Cancelar la hoja de compartir también lanza: no es un error que contar.
    }
  }

  return (
    <>
      <Boton variante="secundario" onClick={() => void abrir()}>
        Compartir esta rutina
      </Boton>

      {json !== null && (
        <Hoja titulo={`Compartir «${nombre}»`} onCerrar={() => setJson(null)}>
          <div className="space-y-3">
            <p className="text-sm text-tenue">
              Quien lo reciba lo pega en Importar y le sale la rutina entera. Los
              ejercicios que no tenga en su catálogo se le crean.
            </p>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-borde bg-fondo p-3 text-xs leading-relaxed">
              {json}
            </pre>
            <Boton onClick={() => void compartir(json)}>
              {sePuedeCompartir ? 'Compartir' : 'Copiar'}
            </Boton>
            {aviso && <p className="text-sm text-tenue">{aviso}</p>}
          </div>
        </Hoja>
      )}
    </>
  )
}

function DiasDeRutina({ rutinaId }: { rutinaId: string }) {
  const dias = useDiasDeRutina(rutinaId)
  const [nombreDia, setNombreDia] = useState('')
  const [anadiendo, setAnadiendo] = useState(false)

  async function crear() {
    if (!nombreDia.trim()) return
    await anadirDia(rutinaId, nombreDia.trim())
    setNombreDia('')
    setAnadiendo(false)
  }

  return (
    <div className="space-y-3">
      {dias.map((d, i) => (
        <Tarjeta key={d.id} className="!px-0">
          <div className="flex items-center gap-1 px-4">
            <h3 className="flex-1 text-base font-semibold">{d.nombre}</h3>
            <BotonOrden
              disabled={i === 0}
              direccion={-1}
              onMover={() => void mover('rutina_dias', d.id, -1, 'rutina_id')}
            />
            <BotonOrden
              disabled={i === dias.length - 1}
              direccion={1}
              onMover={() => void mover('rutina_dias', d.id, 1, 'rutina_id')}
            />
            <button
              onClick={() => void borrarDia(d.id)}
              aria-label={`Borrar ${d.nombre}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-error active:bg-fondo"
            >
              ✕
            </button>
          </div>

          <EjerciciosDelDia diaId={d.id} />
        </Tarjeta>
      ))}

      <Boton variante="secundario" onClick={() => setAnadiendo(true)}>
        Añadir día
      </Boton>

      {anadiendo && (
        <Hoja titulo="Nuevo día" onCerrar={() => setAnadiendo(false)}>
          <div className="space-y-3">
            <Campo
              etiqueta="Nombre"
              value={nombreDia}
              onChange={(e) => setNombreDia(e.target.value)}
              placeholder="Día A — Empuje"
              autoFocus
            />
            <Boton onClick={() => void crear()} disabled={!nombreDia.trim()}>
              Añadir
            </Boton>
          </div>
        </Hoja>
      )}
    </div>
  )
}

function EjerciciosDelDia({ diaId }: { diaId: string }) {
  const ejercicios = useEjerciciosDeDia(diaId)
  const catalogo = useCatalogo()
  const [eligiendo, setEligiendo] = useState(false)
  const [editando, setEditando] = useState<RutinaEjercicio | null>(null)

  return (
    <>
      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {ejercicios.map((e, i) => (
          <li key={e.id} className="flex items-center gap-1 py-1 pl-4 pr-1">
            <button
              onClick={() => setEditando(e)}
              className="min-h-11 flex-1 text-left text-sm active:opacity-70"
            >
              <span className="block">{catalogo.get(e.ejercicio_id)?.nombre ?? '—'}</span>
              <span className="cifras block text-xs text-tenue">
                {e.series_objetivo ?? '?'}×{e.reps_objetivo ?? '?'}
                {e.rir_objetivo !== null ? ` · RIR ${e.rir_objetivo}` : ''}
              </span>
            </button>
            <BotonOrden
              disabled={i === 0}
              direccion={-1}
              onMover={() => void mover('rutina_ejercicios', e.id, -1, 'dia_id')}
            />
            <BotonOrden
              disabled={i === ejercicios.length - 1}
              direccion={1}
              onMover={() => void mover('rutina_ejercicios', e.id, 1, 'dia_id')}
            />
            <button
              onClick={() => void quitarEjercicioDeDia(e.id)}
              aria-label="Quitar ejercicio"
              className="flex h-11 w-11 items-center justify-center rounded-full text-error active:bg-fondo"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setEligiendo(true)}
        className="min-h-11 w-full border-t border-borde px-4 text-left text-sm font-medium text-acento active:bg-fondo"
      >
        + Añadir ejercicio
      </button>

      {eligiendo && (
        <HojaElegirEjercicio
          yaPuestos={ejercicios.map((e) => e.ejercicio_id)}
          onElegir={(ej) => {
            void anadirEjercicioADia(diaId, ej.id)
            setEligiendo(false)
          }}
          onCerrar={() => setEligiendo(false)}
        />
      )}

      {editando && (
        <HojaObjetivos
          ejercicio={editando}
          nombre={catalogo.get(editando.ejercicio_id)?.nombre ?? ''}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  )
}

function HojaObjetivos({
  ejercicio,
  nombre,
  onCerrar,
}: {
  ejercicio: RutinaEjercicio
  nombre: string
  onCerrar: () => void
}) {
  const [series, setSeries] = useState(() => aTexto(ejercicio.series_objetivo))
  const [reps, setReps] = useState(ejercicio.reps_objetivo ?? '')
  const [rir, setRir] = useState(() => aTexto(ejercicio.rir_objetivo))
  const [descanso, setDescanso] = useState(() => aTexto(ejercicio.descanso_seg))
  const [notas, setNotas] = useState(ejercicio.notas ?? '')

  async function guardarObjetivos() {
    await guardar('rutina_ejercicios', {
      id: ejercicio.id,
      series_objetivo: aNumero(series),
      reps_objetivo: reps.trim() || null,
      rir_objetivo: aNumero(rir),
      descanso_seg: aNumero(descanso),
      notas: notas.trim() || null,
    })
    onCerrar()
  }

  return (
    <Hoja titulo={nombre} onCerrar={onCerrar}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <CampoNumero
            etiqueta="Series"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
          />
          <Campo
            etiqueta="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="8-10"
            ayuda=""
          />
          <CampoNumero etiqueta="RIR" value={rir} onChange={(e) => setRir(e.target.value)} />
        </div>
        <CampoNumero
          etiqueta="Descanso"
          sufijo="s"
          value={descanso}
          onChange={(e) => setDescanso(e.target.value)}
          ayuda="Se enseña junto al ejercicio durante la sesión."
        />
        <Campo
          etiqueta="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Agarre, cadencia…"
        />
        <Boton onClick={() => void guardarObjetivos()}>Guardar</Boton>
      </div>
    </Hoja>
  )
}

function BotonOrden({
  direccion,
  disabled,
  onMover,
}: {
  direccion: -1 | 1
  disabled: boolean
  onMover: () => void
}) {
  return (
    <button
      onClick={onMover}
      disabled={disabled}
      aria-label={direccion === -1 ? 'Subir' : 'Bajar'}
      className="flex h-11 w-9 items-center justify-center rounded-full text-tenue disabled:opacity-25"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${direccion === 1 ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="m6 14 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
