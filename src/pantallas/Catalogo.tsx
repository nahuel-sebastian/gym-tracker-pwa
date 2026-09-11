import { useState } from 'react'
import { Boton, Campo, Segmentado, Tarjeta } from '../componentes/Formulario'
import Hoja from '../componentes/Hoja'
import { useEjercicios } from '../lib/consultas'
import { archivarEjercicio, guardarEjercicio } from '../lib/rutinas'
import type { Ejercicio, Equipamiento, GrupoMuscular } from '../lib/tipos'

const GRUPOS: GrupoMuscular[] = [
  'pecho',
  'espalda',
  'pierna',
  'hombro',
  'biceps',
  'triceps',
  'core',
]

const EQUIPAMIENTOS: Equipamiento[] = ['barra', 'mancuerna', 'maquina', 'polea', 'peso_corporal']

const NOMBRE_EQUIPO: Record<Equipamiento, string> = {
  barra: 'Barra',
  mancuerna: 'Mancuerna',
  maquina: 'Máquina',
  polea: 'Polea',
  peso_corporal: 'Peso corporal',
}

/** Catálogo de ejercicios: buscar, crear y editar. Se archivan, no se borran. */
export default function Catalogo() {
  const [busqueda, setBusqueda] = useState('')
  const [verArchivados, setVerArchivados] = useState(false)
  const ejercicios = useEjercicios(busqueda, verArchivados)
  const [editando, setEditando] = useState<Ejercicio | null>(null)
  const [creando, setCreando] = useState(false)

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar ejercicio"
        autoCapitalize="none"
        autoCorrect="off"
        className="min-h-12 w-full rounded-xl border border-borde bg-superficie px-3 outline-none focus:border-acento"
      />

      <Tarjeta className="!p-0">
        {ejercicios.map((e) => (
          <button
            key={e.id}
            onClick={() => setEditando(e)}
            className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-borde px-4 py-2 text-left last:border-b-0 active:bg-fondo"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{e.nombre}</span>
              <span className="block truncate text-xs text-tenue">
                {[e.grupo_muscular, e.equipamiento && NOMBRE_EQUIPO[e.equipamiento]]
                  .filter(Boolean)
                  .join(' · ') || '—'}
                {e.es_unilateral ? ' · unilateral' : ''}
              </span>
            </span>
            {e.archivado && <span className="text-xs text-tenue">archivado</span>}
          </button>
        ))}
        {ejercicios.length === 0 && (
          <p className="p-4 text-sm text-tenue">Nada con ese nombre.</p>
        )}
      </Tarjeta>

      <Boton variante="secundario" onClick={() => setCreando(true)}>
        Nuevo ejercicio
      </Boton>

      <button
        onClick={() => setVerArchivados((v) => !v)}
        className="min-h-11 w-full text-sm text-tenue active:opacity-70"
      >
        {verArchivados ? 'Ocultar archivados' : 'Ver también los archivados'}
      </button>

      {(creando || editando) && (
        <HojaEjercicio
          ejercicio={editando ?? undefined}
          onCerrar={() => {
            setCreando(false)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

function HojaEjercicio({
  ejercicio,
  onCerrar,
}: {
  ejercicio?: Ejercicio
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(ejercicio?.nombre ?? '')
  const [grupo, setGrupo] = useState<GrupoMuscular | null>(ejercicio?.grupo_muscular ?? null)
  const [equipo, setEquipo] = useState<Equipamiento | null>(ejercicio?.equipamiento ?? null)
  const [unilateral, setUnilateral] = useState(ejercicio?.es_unilateral ?? false)
  const [notas, setNotas] = useState(ejercicio?.notas ?? '')

  async function enviar() {
    if (!nombre.trim()) return
    await guardarEjercicio({
      id: ejercicio?.id,
      nombre: nombre.trim(),
      grupo_muscular: grupo,
      equipamiento: equipo,
      es_unilateral: unilateral,
      notas: notas.trim() || null,
    })
    onCerrar()
  }

  return (
    <Hoja titulo={ejercicio ? 'Editar ejercicio' : 'Nuevo ejercicio'} onCerrar={onCerrar}>
      <div className="space-y-3">
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoCapitalize="sentences"
          autoFocus={!ejercicio}
        />

        <div>
          <span className="mb-1 block text-sm text-tenue">Grupo muscular</span>
          <div className="flex flex-wrap gap-2">
            {GRUPOS.map((g) => (
              <Pastilla
                key={g}
                activa={grupo === g}
                onClick={() => setGrupo(grupo === g ? null : g)}
              >
                {g}
              </Pastilla>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm text-tenue">Equipamiento</span>
          <div className="flex flex-wrap gap-2">
            {EQUIPAMIENTOS.map((eq) => (
              <Pastilla
                key={eq}
                activa={equipo === eq}
                onClick={() => setEquipo(equipo === eq ? null : eq)}
              >
                {NOMBRE_EQUIPO[eq]}
              </Pastilla>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm text-tenue">¿Unilateral?</span>
          <Segmentado
            opciones={[
              { valor: 'no', etiqueta: 'No' },
              { valor: 'si', etiqueta: 'Sí' },
            ]}
            valor={unilateral ? 'si' : 'no'}
            onCambio={(v) => setUnilateral(v === 'si')}
          />
        </div>

        <Campo etiqueta="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />

        <Boton onClick={() => void enviar()} disabled={!nombre.trim()}>
          Guardar
        </Boton>

        {ejercicio && (
          <>
            <Boton
              variante="secundario"
              onClick={() => {
                void archivarEjercicio(ejercicio.id, !ejercicio.archivado)
                onCerrar()
              }}
            >
              {ejercicio.archivado ? 'Desarchivar' : 'Archivar'}
            </Boton>
            <p className="text-xs text-tenue">
              Los ejercicios no se borran: archivarlos los quita de los buscadores y
              deja intacto el histórico de series que los menciona.
            </p>
          </>
        )}
      </div>
    </Hoja>
  )
}

function Pastilla({
  activa,
  onClick,
  children,
}: {
  activa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      className={`min-h-11 rounded-full border px-4 text-sm capitalize ${
        activa ? 'border-acento bg-acento/10 text-acento' : 'border-borde text-tenue'
      }`}
    >
      {children}
    </button>
  )
}
