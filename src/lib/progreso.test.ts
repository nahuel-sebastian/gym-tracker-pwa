import { describe, expect, it } from 'vitest'
import {
  inicioDeSemana,
  mediasSemanales,
  progresionEjercicio,
  proyeccionDePeso,
  serieDePeso,
  tendenciaPeso,
  volumenPorGrupo,
  volumenSemanalPorGrupo,
} from './progreso'
import type { Ejercicio, MedidaCorporal, RegistroComida, Serie, Sesion } from './tipos'

const medida = (fecha: string, peso_kg: number | null): MedidaCorporal => ({
  id: fecha,
  fecha,
  peso_kg,
  notas: null,
})

describe('serieDePeso', () => {
  it('devuelve un punto por día, también los días sin pesarse', () => {
    // Si el eje se comprimiera donde faltan datos, una semana sin báscula
    // parecería un día y la pendiente engañaría.
    const puntos = serieDePeso([medida('2026-09-01', 80), medida('2026-09-05', 79.5)])

    expect(puntos.map((p) => p.fecha)).toEqual([
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
    ])
    expect(puntos[1].peso).toBeNull()
  })

  it('promedia por días de calendario, no por las últimas siete medidas', () => {
    // Entre el 1 y el 20 hay hueco: la media del 20 no puede arrastrar el dato
    // del 1, que tiene tres semanas.
    const puntos = serieDePeso([
      medida('2026-09-01', 90),
      medida('2026-09-19', 80),
      medida('2026-09-20', 80),
    ])

    const ultimo = puntos[puntos.length - 1]
    expect(ultimo.fecha).toBe('2026-09-20')
    expect(ultimo.media).toBe(80)
  })

  it('la media suaviza el ruido diario', () => {
    const pesos = [80, 80.8, 79.6, 80.4, 79.8, 80.2, 80]
    const puntos = serieDePeso(pesos.map((p, i) => medida(`2026-09-0${i + 1}`, p)))

    const ultimo = puntos[puntos.length - 1]
    expect(ultimo.peso).toBe(80)
    expect(ultimo.media).toBeCloseTo(80.11, 2)
  })

  it('ignora los días sin peso registrado', () => {
    expect(serieDePeso([medida('2026-09-01', null)])).toEqual([])
    expect(serieDePeso([])).toEqual([])
  })
})

describe('tendenciaPeso', () => {
  it('compara la media de hoy con la de hace cuatro semanas', () => {
    const dias = Array.from({ length: 29 }, (_, i) => {
      const d = new Date(2026, 8, 1 + i)
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return medida(fecha, 82 - i * 0.05)
    })

    // Bajando 0,05 kg al día: la media del día 28 va 1,25 kg por debajo de la
    // del día 0 (la ventana de siete días desplaza el valor medio tres días).
    const tendencia = tendenciaPeso(serieDePeso(dias), 28)
    expect(tendencia).toBe(-1.25)
  })

  it('con un solo punto no inventa una tendencia', () => {
    expect(tendenciaPeso(serieDePeso([medida('2026-09-01', 80)]))).toBeNull()
    expect(tendenciaPeso([])).toBeNull()
  })
})

describe('progresionEjercicio', () => {
  const sesiones: Sesion[] = [
    { id: 's1', dia_id: null, nombre_dia: null, fecha: '2026-09-01', hora_inicio: null, hora_fin: null, notas: null, sensacion: null },
    { id: 's2', dia_id: null, nombre_dia: null, fecha: '2026-09-08', hora_inicio: null, hora_fin: null, notas: null, sensacion: null },
  ]

  const serie = (id: string, sesion: string, peso: number, reps: number, tipo: Serie['tipo'] = 'normal'): Serie => ({
    id, sesion_id: sesion, ejercicio_id: 'press', numero: 1, peso_kg: peso, reps, rir: 2, tipo,
  })

  const series = [
    serie('a', 's1', 60, 12, 'calentamiento'),
    serie('b', 's1', 80, 8),
    serie('c', 's1', 80, 7),
    serie('d', 's2', 82.5, 8),
    serie('e', 's2', 82.5, 6),
  ]

  it('peso máximo por sesión', () => {
    expect(progresionEjercicio(series, sesiones, 'press', 'peso')).toEqual([
      { fecha: '2026-09-01', valor: 80, series: 2 },
      { fecha: '2026-09-08', valor: 82.5, series: 2 },
    ])
  })

  it('el calentamiento no cuenta en el volumen', () => {
    // Con él, la primera sesión sumaría 720 kg de más y taparía la progresión.
    const [primera] = progresionEjercicio(series, sesiones, 'press', 'volumen')
    expect(primera.valor).toBe(80 * 8 + 80 * 7)
  })

  it('1RM de Epley, el mejor de la sesión', () => {
    const puntos = progresionEjercicio(series, sesiones, 'press', 'unorm')
    expect(puntos[0].valor).toBeCloseTo(101.3, 1)
    expect(puntos[1].valor).toBeCloseTo(104.5, 1)
  })

  it('un ejercicio sin series no da puntos', () => {
    expect(progresionEjercicio(series, sesiones, 'sentadilla', 'peso')).toEqual([])
  })

  it('una serie sin peso no inventa un cero', () => {
    const sinPeso: Serie[] = [{ ...serie('x', 's1', 0, 0), peso_kg: null, reps: null }]
    expect(progresionEjercicio(sinPeso, sesiones, 'press', 'peso')).toEqual([])
  })
})

describe('inicioDeSemana', () => {
  it('la semana empieza en lunes', () => {
    expect(inicioDeSemana('2026-09-11')).toBe('2026-09-07') // viernes → lunes
    expect(inicioDeSemana('2026-09-07')).toBe('2026-09-07') // lunes
    expect(inicioDeSemana('2026-09-13')).toBe('2026-09-07') // domingo
    expect(inicioDeSemana('2026-09-14')).toBe('2026-09-14')
  })
})

describe('mediasSemanales', () => {
  const comida = (fecha: string, kcal: number): RegistroComida => ({
    id: `${fecha}-${kcal}`,
    fecha,
    momento: 'cena',
    alimento_id: null,
    receta_id: null,
    descripcion: 'x',
    gramos: null,
    kcal,
    proteina: 10,
    grasa: 5,
    carbos: 20,
  })

  it('divide por días con registro, no por siete', () => {
    // Cuatro días apuntados de una semana: la media es de esos cuatro días,
    // no del reparto entre siete, que saldría un 40 % más baja.
    const registros = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'].map((f) =>
      comida(f, 2000),
    )
    const tipos = new Map(registros.map((r) => [r.fecha, 'entreno' as const]))

    const { entreno } = mediasSemanales(registros, tipos)
    expect(entreno).toHaveLength(1)
    expect(entreno[0]).toMatchObject({ semana: '2026-09-07', dias: 4, kcal: 2000 })
  })

  it('suma varios registros del mismo día como un solo día', () => {
    const registros = [comida('2026-09-07', 700), comida('2026-09-07', 800)]
    const { descanso } = mediasSemanales(registros, new Map())
    expect(descanso[0]).toMatchObject({ dias: 1, kcal: 1500 })
  })

  it('separa entreno de descanso, y lo no marcado es descanso', () => {
    const registros = [comida('2026-09-07', 2800), comida('2026-09-08', 2200)]
    const tipos = new Map([['2026-09-07', 'entreno' as const]])

    const medias = mediasSemanales(registros, tipos)
    expect(medias.entreno[0].kcal).toBe(2800)
    expect(medias.descanso[0].kcal).toBe(2200)
  })
})

describe('volumenPorGrupo', () => {
  const ejercicios = new Map<string, Ejercicio>([
    ['press', { id: 'press', nombre: 'Press', grupo_muscular: 'pecho', equipamiento: 'barra', es_unilateral: false, notas: null, archivado: false }],
    ['curl', { id: 'curl', nombre: 'Curl', grupo_muscular: 'biceps', equipamiento: 'mancuerna', es_unilateral: false, notas: null, archivado: false }],
    ['raro', { id: 'raro', nombre: 'Raro', grupo_muscular: null, equipamiento: null, es_unilateral: false, notas: null, archivado: false }],
  ])

  const sesiones: Sesion[] = [
    { id: 's1', dia_id: null, nombre_dia: null, fecha: '2026-09-08', hora_inicio: null, hora_fin: null, notas: null, sensacion: null },
    { id: 'vieja', dia_id: null, nombre_dia: null, fecha: '2026-06-01', hora_inicio: null, hora_fin: null, notas: null, sensacion: null },
  ]

  const s = (id: string, sesion: string, ejercicio: string, tipo: Serie['tipo'] = 'normal'): Serie => ({
    id, sesion_id: sesion, ejercicio_id: ejercicio, numero: 1, peso_kg: 50, reps: 10, rir: 2, tipo,
  })

  it('cuenta series efectivas por grupo, de mayor a menor', () => {
    const series = [
      s('a', 's1', 'press'), s('b', 's1', 'press'), s('c', 's1', 'press'),
      s('d', 's1', 'curl'),
      s('e', 's1', 'press', 'calentamiento'),
      s('f', 'vieja', 'press'),
    ]

    expect(volumenPorGrupo(series, sesiones, ejercicios, '2026-09-01', '2026-09-30')).toEqual([
      { grupo: 'pecho', series: 3 },
      { grupo: 'biceps', series: 1 },
    ])
  })

  it('los ejercicios sin grupo no se pierden', () => {
    const series = [s('a', 's1', 'raro')]
    expect(volumenPorGrupo(series, sesiones, ejercicios, '2026-09-01', '2026-09-30')).toEqual([
      { grupo: 'sin grupo', series: 1 },
    ])
  })
})

describe('proyeccionDePeso', () => {
  const bajando = (kgPorDia: number, dias = 40) =>
    serieDePeso(
      Array.from({ length: dias }, (_, i) => {
        const d = new Date(2026, 7, 1 + i)
        const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return medida(f, 82 - i * kgPorDia)
      }),
    )

  it('dice cuántas semanas faltan al ritmo de las últimas cuatro', () => {
    // Bajando 0,1 kg al día son 0,7 por semana. Desde ~79 hasta 76 son 3 kg.
    const p = proyeccionDePeso(bajando(0.1), 76)
    expect(p).not.toBeNull()
    expect(p!.ritmo).toBeCloseTo(-0.7, 1)
    expect(p!.alReves).toBe(false)
    expect(p!.semanas).toBeGreaterThan(0)
    expect(p!.semanas).toBeLessThan(10)
  })

  it('avisa cuando el ritmo va al lado contrario del objetivo', () => {
    // Bajando, pero con el objetivo por encima del peso actual.
    const p = proyeccionDePeso(bajando(0.1), 90)
    expect(p!.alReves).toBe(true)
    expect(p!.semanas).toBe(Infinity)
  })

  it('no proyecta sin objetivo, sin tendencia o ya en el objetivo', () => {
    expect(proyeccionDePeso(bajando(0.1), null)).toBeNull()
    // Peso plano: no hay ritmo del que tirar.
    expect(proyeccionDePeso(bajando(0), 76)).toBeNull()
    // A menos de medio kilo, una cifra de semanas es ruido de la báscula.
    const puntos = bajando(0.1)
    const actual = [...puntos].reverse().find((p) => p.media !== null)!.media!
    expect(proyeccionDePeso(puntos, actual - 0.2)).toBeNull()
  })
})

describe('volumenSemanalPorGrupo', () => {
  const ejercicios = new Map<string, Ejercicio>([
    ['press', { id: 'press', nombre: 'Press', grupo_muscular: 'pecho', equipamiento: 'barra', es_unilateral: false, notas: null, archivado: false }],
    ['remo', { id: 'remo', nombre: 'Remo', grupo_muscular: 'espalda', equipamiento: 'barra', es_unilateral: false, notas: null, archivado: false }],
  ])

  const sesion = (id: string, fecha: string): Sesion => ({
    id, dia_id: null, nombre_dia: null, fecha, hora_inicio: null, hora_fin: null, notas: null, sensacion: null,
  })

  const serie = (id: string, ses: string, ej: string, tipo: Serie['tipo'] = 'normal'): Serie => ({
    id, sesion_id: ses, ejercicio_id: ej, numero: 1, peso_kg: 80, reps: 8, rir: 2, tipo,
  })

  it('cuenta series efectivas por grupo y semana, y rellena las semanas vacías', () => {
    const sesiones = [sesion('a', '2026-09-01'), sesion('b', '2026-09-15')]
    const series = [
      serie('1', 'a', 'press'), serie('2', 'a', 'press'), serie('3', 'a', 'press', 'calentamiento'),
      serie('4', 'a', 'remo'),
      serie('5', 'b', 'press'),
    ]

    const { semanas, porGrupo } = volumenSemanalPorGrupo(
      series, sesiones, ejercicios, '2026-09-01', '2026-09-20',
    )

    // Del 31 ago al 14 sep: tres semanas, con la del medio a cero.
    expect(semanas).toEqual(['2026-08-31', '2026-09-07', '2026-09-14'])
    expect(porGrupo[0]).toEqual({ grupo: 'pecho', series: [2, 0, 1] })
    expect(porGrupo[1]).toEqual({ grupo: 'espalda', series: [1, 0, 0] })
  })

  it('ordena los grupos por volumen total del periodo', () => {
    const sesiones = [sesion('a', '2026-09-01')]
    const series = [serie('1', 'a', 'remo'), serie('2', 'a', 'remo'), serie('3', 'a', 'press')]
    const { porGrupo } = volumenSemanalPorGrupo(series, sesiones, ejercicios, '2026-09-01', '2026-09-07')
    expect(porGrupo.map((g) => g.grupo)).toEqual(['espalda', 'pecho'])
  })

  it('sin sesiones en el rango no devuelve semanas', () => {
    expect(volumenSemanalPorGrupo([], [], ejercicios, '2026-09-01', '2026-09-07')).toEqual({
      semanas: [], porGrupo: [],
    })
  })
})
