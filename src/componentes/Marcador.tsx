type Props = { titulo: string; descripcion: string; pendiente: string[] }

/** Placeholder de pantalla mientras se construye la fase correspondiente. */
export default function Marcador({ titulo, descripcion, pendiente }: Props) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="mt-1 text-sm text-tenue">{descripcion}</p>
      </div>
      <div className="rounded-2xl border border-borde bg-superficie p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-tenue">
          Pendiente en esta pantalla
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {pendiente.map((linea) => (
            <li key={linea} className="flex gap-2">
              <span className="text-tenue">·</span>
              {linea}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
