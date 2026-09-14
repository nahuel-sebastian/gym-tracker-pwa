import { describe, expect, it } from 'vitest'
import { jsonDeEnlace } from './enlaces'

const JSON_COMIDA = '{"alimentos":[{"nombre":"Pollo","kcal":297,"proteina":55.8,"grasa":6.5,"carbos":0}]}'

describe('jsonDeEnlace', () => {
  it('lee el JSON del fragmento, que es lo que manda el Atajo', () => {
    const hash = '#json=' + encodeURIComponent(JSON_COMIDA)
    expect(jsonDeEnlace(hash, '')).toBe(JSON_COMIDA)
  })

  it('lee también la cadena de consulta, que es donde lo deja el share_target', () => {
    const busqueda = '?json=' + encodeURIComponent(JSON_COMIDA)
    expect(jsonDeEnlace('', busqueda)).toBe(JSON_COMIDA)
  })

  it('el fragmento gana: no viaja al servidor', () => {
    const hash = '#json=' + encodeURIComponent('{"del":"fragmento"}')
    const busqueda = '?json=' + encodeURIComponent('{"de":"la consulta"}')
    expect(jsonDeEnlace(hash, busqueda)).toBe('{"del":"fragmento"}')
  })

  it('aguanta el JSON con acentos y llaves sin escapar del todo', () => {
    const conAcentos = '{"alimentos":[{"nombre":"Aliño de la ensalada","kcal":90}]}'
    expect(jsonDeEnlace('#json=' + encodeURIComponent(conAcentos), '')).toBe(conAcentos)
  })

  it('convive con otros parámetros en el mismo fragmento', () => {
    const hash = '#momento=cena&json=' + encodeURIComponent(JSON_COMIDA)
    expect(jsonDeEnlace(hash, '')).toBe(JSON_COMIDA)
  })

  it('sin nada devuelve null, no una cadena vacía', () => {
    expect(jsonDeEnlace('', '')).toBeNull()
    expect(jsonDeEnlace('#', '')).toBeNull()
    expect(jsonDeEnlace('#json=', '')).toBeNull()
    expect(jsonDeEnlace('#json=%20%20', '')).toBeNull()
    expect(jsonDeEnlace('#otra=cosa', '?y=otra')).toBeNull()
  })
})
