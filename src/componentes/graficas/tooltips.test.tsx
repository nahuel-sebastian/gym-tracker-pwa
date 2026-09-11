// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TarjetaPeso } from './GraficaPeso'
import { TarjetaEjercicio } from './GraficaEjercicio'
import { TarjetaSemana } from './GraficaSemanas'
import { TarjetaGrupo } from './GraficaGrupos'

/**
 * El contenido de los tooltips, probado sin montar la gráfica: Recharts no
 * dibuja nada en jsdom (el contenedor mide cero) y tampoco responde a eventos
 * de ratón sintéticos, así que el hover de verdad hay que mirarlo con el ratón.
 * Lo que sí se puede fijar aquí es lo que se enseña cuando se activa.
 */

afterEach(cleanup)

describe('tooltip de peso', () => {
  it('enseña la media y el peso de ese día, con la media primero', () => {
    render(
      <TarjetaPeso
        active
        label="2026-09-11"
        payload={[
          { dataKey: 'peso', value: 79.4 },
          { dataKey: 'media', value: 79.85 },
        ]}
      />,
    )

    const filas = screen.getAllByRole('listitem').map((li) => li.textContent)
    // La media es la señal, así que va arriba.
    expect(filas[0]).toContain('79,85 kg')
    expect(filas[0]).toContain('media 7 días')
    expect(filas[1]).toContain('79,4 kg')
  })

  it('en un día sin pesaje solo enseña la media', () => {
    render(<TarjetaPeso active label="2026-09-11" payload={[{ dataKey: 'media', value: 80 }]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('sin activar no pinta nada', () => {
    const { container } = render(<TarjetaPeso label="2026-09-11" payload={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('tooltip de ejercicio', () => {
  it('da el valor de la métrica y cuántas series lo respaldan', () => {
    render(
      <TarjetaEjercicio
        active
        label="2026-09-08"
        metrica="volumen"
        payload={[{ payload: { fecha: '2026-09-08', valor: 2460, series: 3 } }]}
      />,
    )

    expect(screen.getByText('2460 kg')).toBeDefined()
    expect(screen.getByText('series efectivas')).toBeDefined()
  })

  it('singulariza una sola serie', () => {
    render(
      <TarjetaEjercicio
        active
        label="2026-09-08"
        metrica="peso"
        payload={[{ payload: { fecha: '2026-09-08', valor: 82.5, series: 1 } }]}
      />,
    )
    expect(screen.getByText('serie efectiva')).toBeDefined()
  })
})

describe('tooltip de semanas', () => {
  it('enseña las dos medias con los días que las respaldan', () => {
    render(
      <TarjetaSemana
        active
        label="2026-09-07"
        payload={[
          {
            payload: {
              semana: '2026-09-07',
              entreno: 2810,
              descanso: 2190,
              diasEntreno: 3,
              diasDescanso: 4,
            },
          },
        ]}
      />,
    )

    expect(screen.getByText(/Semana del/)).toBeDefined()
    expect(screen.getByText('2810 kcal')).toBeDefined()
    expect(screen.getByText('entreno · 3 días')).toBeDefined()
    expect(screen.getByText('descanso · 4 días')).toBeDefined()
  })

  it('una semana sin días de entreno no inventa una fila a cero', () => {
    render(
      <TarjetaSemana
        active
        label="2026-09-07"
        payload={[
          {
            payload: {
              semana: '2026-09-07',
              entreno: null,
              descanso: 2190,
              diasEntreno: 0,
              diasDescanso: 5,
            },
          },
        ]}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('tooltip de grupo muscular', () => {
  it('nombra el grupo y sus series', () => {
    render(<TarjetaGrupo active payload={[{ payload: { grupo: 'pecho', series: 34 } }]} />)
    expect(screen.getByText('pecho')).toBeDefined()
    expect(screen.getByText('34')).toBeDefined()
  })
})
