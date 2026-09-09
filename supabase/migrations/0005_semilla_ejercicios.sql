-- =============================================================================
-- 0005 · Catálogo inicial de ejercicios
--
-- La app es de un solo usuario, así que el catálogo se siembra a nombre de la
-- cuenta ya creada a mano en el panel de Supabase. Nada de filas globales: así
-- la política de RLS sigue siendo una sola regla, y los ejercicios se pueden
-- renombrar y editar como cualquier otro dato propio.
--
-- Requiere que la cuenta exista. Si no, no inserta nada y avisa.
-- Es idempotente: se puede volver a ejecutar sin duplicar.
-- =============================================================================

do $$
declare
  v_user_id uuid;
  v_insertados int;
begin
  select id into v_user_id from auth.users order by created_at limit 1;

  if v_user_id is null then
    raise warning 'No hay ningún usuario en auth.users: catálogo no sembrado. Crea la cuenta y vuelve a ejecutar esta migración.';
    return;
  end if;

  insert into public.ejercicios (user_id, nombre, grupo_muscular, equipamiento, es_unilateral)
  select v_user_id, v.nombre, v.grupo, v.equipamiento, v.unilateral
  from (values
    -- Pecho
    ('Press de banca con barra',            'pecho',   'barra',         false),
    ('Press inclinado con barra',           'pecho',   'barra',         false),
    ('Press de banca con mancuernas',       'pecho',   'mancuerna',     false),
    ('Press inclinado con mancuernas',      'pecho',   'mancuerna',     false),
    ('Aperturas con mancuernas',            'pecho',   'mancuerna',     false),
    ('Cruces en polea',                     'pecho',   'polea',         false),
    ('Press de pecho en máquina',           'pecho',   'maquina',       false),
    ('Contractor de pecho',                 'pecho',   'maquina',       false),
    ('Fondos en paralelas',                 'pecho',   'peso_corporal', false),
    ('Flexiones',                           'pecho',   'peso_corporal', false),
    -- Espalda
    ('Dominadas',                           'espalda', 'peso_corporal', false),
    ('Dominadas supinas',                   'espalda', 'peso_corporal', false),
    ('Jalón al pecho',                      'espalda', 'polea',         false),
    ('Jalón agarre neutro',                 'espalda', 'polea',         false),
    ('Remo con barra',                      'espalda', 'barra',         false),
    ('Remo con mancuerna a una mano',       'espalda', 'mancuerna',     true),
    ('Remo en T',                           'espalda', 'barra',         false),
    ('Remo sentado en polea',               'espalda', 'polea',         false),
    ('Remo en máquina',                     'espalda', 'maquina',       false),
    ('Pull-over en polea',                  'espalda', 'polea',         false),
    ('Peso muerto convencional',            'espalda', 'barra',         false),
    ('Encogimientos de hombros',            'espalda', 'mancuerna',     false),
    ('Hiperextensiones',                    'espalda', 'peso_corporal', false),
    -- Pierna
    ('Sentadilla con barra',                'pierna',  'barra',         false),
    ('Sentadilla frontal',                  'pierna',  'barra',         false),
    ('Prensa de piernas',                   'pierna',  'maquina',       false),
    ('Hack squat',                          'pierna',  'maquina',       false),
    ('Zancadas con mancuernas',             'pierna',  'mancuerna',     true),
    ('Sentadilla búlgara',                  'pierna',  'mancuerna',     true),
    ('Extensión de cuádriceps',             'pierna',  'maquina',       false),
    ('Curl femoral tumbado',                'pierna',  'maquina',       false),
    ('Curl femoral sentado',                'pierna',  'maquina',       false),
    ('Peso muerto rumano',                  'pierna',  'barra',         false),
    ('Peso muerto sumo',                    'pierna',  'barra',         false),
    ('Hip thrust',                          'pierna',  'barra',         false),
    ('Buenos días',                         'pierna',  'barra',         false),
    ('Elevación de talones de pie',         'pierna',  'maquina',       false),
    ('Elevación de talones sentado',        'pierna',  'maquina',       false),
    ('Abducción de cadera en máquina',      'pierna',  'maquina',       false),
    ('Aducción de cadera en máquina',       'pierna',  'maquina',       false),
    -- Hombro
    ('Press militar con barra',             'hombro',  'barra',         false),
    ('Press militar con mancuernas',        'hombro',  'mancuerna',     false),
    ('Press Arnold',                        'hombro',  'mancuerna',     false),
    ('Elevaciones laterales',               'hombro',  'mancuerna',     false),
    ('Elevaciones laterales en polea',      'hombro',  'polea',         true),
    ('Elevaciones frontales',               'hombro',  'mancuerna',     false),
    ('Pájaros',                             'hombro',  'mancuerna',     false),
    ('Deltoides posterior en máquina',      'hombro',  'maquina',       false),
    ('Face pull',                           'hombro',  'polea',         false),
    ('Remo al mentón',                      'hombro',  'barra',         false),
    -- Bíceps
    ('Curl con barra',                      'biceps',  'barra',         false),
    ('Curl con barra Z',                    'biceps',  'barra',         false),
    ('Curl con mancuernas',                 'biceps',  'mancuerna',     false),
    ('Curl martillo',                       'biceps',  'mancuerna',     false),
    ('Curl inclinado',                      'biceps',  'mancuerna',     false),
    ('Curl concentrado',                    'biceps',  'mancuerna',     true),
    ('Curl en polea',                       'biceps',  'polea',         false),
    ('Curl predicador',                     'biceps',  'maquina',       false),
    -- Tríceps
    ('Press francés',                       'triceps', 'barra',         false),
    ('Press cerrado',                       'triceps', 'barra',         false),
    ('Extensión en polea con barra',        'triceps', 'polea',         false),
    ('Extensión en polea con cuerda',       'triceps', 'polea',         false),
    ('Extensión sobre la cabeza',           'triceps', 'mancuerna',     false),
    ('Patada de tríceps',                   'triceps', 'mancuerna',     true),
    ('Fondos en banco',                     'triceps', 'peso_corporal', false),
    -- Core
    ('Plancha',                             'core',    'peso_corporal', false),
    ('Elevaciones de piernas colgado',      'core',    'peso_corporal', false),
    ('Crunch en polea',                     'core',    'polea',         false),
    ('Rueda abdominal',                     'core',    'peso_corporal', false),
    ('Giro ruso',                           'core',    'mancuerna',     false)
  ) as v(nombre, grupo, equipamiento, unilateral)
  on conflict (user_id, lower(nombre)) do nothing;

  get diagnostics v_insertados = row_count;
  raise notice 'Ejercicios insertados: %', v_insertados;
end;
$$;
