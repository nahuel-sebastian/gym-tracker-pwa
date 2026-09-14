// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import RedirigirAImportar from './RedirigirAImportar'

afterEach(cleanup)

function Sonda() {
  const { pathname, hash, search } = useLocation()
  return <div data-testid="donde">{pathname + search + hash}</div>
}

/**
 * La pantalla de importar se movió de /comida/importar a /importar, pero el
 * Atajo del iPhone que ya esté creado apunta a la vieja y el JSON viaja en el
 * fragmento. Si la redirección lo perdiera, compartir desde Claude dejaría de
 * importar nada y no habría ni error que ver.
 */
describe('la ruta vieja de importar', () => {
  it('lleva a la nueva arrastrando el JSON del fragmento', () => {
    render(
      <MemoryRouter initialEntries={['/comida/importar#json=%7B%22a%22%3A1%7D']}>
        <Routes>
          <Route path="/comida/importar" element={<RedirigirAImportar />} />
          <Route path="/importar" element={<Sonda />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('donde').textContent).toBe('/importar#json=%7B%22a%22%3A1%7D')
  })

  it('y también la cadena de consulta, que es la vía del share_target', () => {
    render(
      <MemoryRouter initialEntries={['/comida/importar?json=%7B%22a%22%3A1%7D']}>
        <Routes>
          <Route path="/comida/importar" element={<RedirigirAImportar />} />
          <Route path="/importar" element={<Sonda />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('donde').textContent).toBe('/importar?json=%7B%22a%22%3A1%7D')
  })
})
