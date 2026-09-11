# Estado del proyecto

Última actualización: 11 de septiembre de 2026.

El plan original está en `docs/plan.md` y no se ha modificado. Este archivo
registra lo construido, las decisiones tomadas sobre el plan y cómo seguir.

---

## Cómo retomar el trabajo

```bash
# 1. Node (el del sistema es 18 y no vale)
cd gym-tracker-pwa      # .nvmrc ya fija la versión
nvm use                      # → v22

# 2. Base de datos local (necesita Docker Desktop arrancado)
systemctl --user start docker-desktop
npx supabase start           # deja Studio en http://127.0.0.1:54323

# 3. La app
npm run dev                  # http://localhost:5173
```

Cuenta de pruebas local: `yo@local.test` / `gimnasio123`.

Para parar la base de datos: `npx supabase stop`. Para borrarla y reaplicar
todas las migraciones desde cero: `npx supabase db reset` (ojo: borra también
los usuarios locales, hay que volver a crearlos, ver más abajo).

---

## Hecho

### Fase 1 — Andamiaje (commit `7f82c1c`)

- Vite 8, React 19, TypeScript, Tailwind 4, `vite-plugin-pwa`.
- Manifest e iconos (192, 512, maskable, apple-touch), service worker con
  precacheo del shell.
- Cuatro pestañas fijas, cabecera con acceso a Ajustes e indicador de
  sincronización, pantallas de marcador por fase.
- Detalles de iPhone: `safe-area-inset`, inputs a 16px para que Safari no haga
  zoom al enfocar, objetivos táctiles por encima de 44px, tema claro y oscuro
  según el sistema.

### Fase 1 — Base de datos y autenticación

Cinco migraciones en `supabase/migrations/`, **todas aplicadas y probadas
contra un Supabase local real**:

| Archivo | Contenido |
|---|---|
| `0001_esquema.sql` | 14 tablas, índices, trigger de `updated_at` |
| `0002_rls.sql` | RLS activada y forzada, una política por tabla, `anon` revocado |
| `0003_funciones.sql` | RPC `ultimas_series()` para la vista de "última vez" |
| `0004_storage.sql` | Bucket privado `fotos` con políticas por carpeta de usuario |
| `0005_semilla_ejercicios.sql` | Catálogo de 70 ejercicios |

Autenticación: cliente de Supabase con sesión persistente, contexto de sesión,
pantalla de login (sin registro, la cuenta se crea a mano) y cierre de sesión
desde Ajustes.

### Fase 4 (adelantada) — Capa de mutación offline

Toda escritura de la app pasa por `guardar()` / `borrar()` en `src/lib/datos.ts`,
nunca por `supabase.from(...)`. El camino es siempre el mismo: se aplica a
IndexedDB, la interfaz se refresca sola, y el envío se encola. La red no
bloquea nada.

| Archivo | Papel |
|---|---|
| `src/lib/tipos.ts` | Tipos de las 14 tablas, espejo del esquema |
| `src/lib/fechas.ts` | Fechas de día en hora local, nunca `toISOString()` |
| `src/lib/db.ts` | Dexie: 14 tablas + `cola`, `fallidas` y `meta` |
| `src/lib/datos.ts` | API única de escritura, fusión de cola y cascadas locales |
| `src/lib/sincronizacion.ts` | Vaciado de la cola, reintentos, estado observable |
| `src/lib/descarga.ts` | Descarga incremental por marca de agua de `updated_at` |
| `src/lib/senal.ts` | Rompe el ciclo de módulos entre datos y sincronización |
| `src/lib/useSync.ts` | Estado de sincronización para React |

Comportamientos que sostienen el modo offline:

- **Fusión de la cola.** Corregir cinco veces el peso de una serie sin
  cobertura deja **una** operación, no cinco. La operación fusionada conserva
  su puesto en la cola: si se colara detrás de sus series, el servidor las
  rechazaría por clave ajena.
- **Borrar lo que el servidor no conoce cancela su envío**, en vez de encolar
  el borrado de algo inexistente.
- **Cascadas replicadas en local.** Borrar una sesión borra sus series aquí y
  cancela los envíos pendientes de esas series; sin eso, un insert rezagado
  crearía filas huérfanas tras la cascada del servidor. Lo que el servidor pone
  a null (`sesiones.dia_id`, `registros_comida.alimento_id`) se pone a null
  también aquí.
- **Orden estricto de envío.** Una operación que falla detiene el vaciado; no
  se adelanta la siguiente. Ese orden es lo único que garantiza que una sesión
  llegue antes que sus series.
- **Los fallos de transporte no se descartan nunca**, por muchos reintentos que
  lleven. Los definitivos (códigos 22, 23, 42 de Postgres) se apartan a
  `fallidas` a la primera y el vaciado sigue: un envío imposible no puede
  bloquear para siempre las series que vengan detrás. Ajustes los enseña, con
  botones de reintentar y descartar.
- **Retroceso exponencial con jitter**, de 2 s a 5 min de techo.
- **La descarga no pisa lo que está pendiente de subir.** Es la parte de
  "última escritura gana" que evita perder un cambio sin sincronizar.
- **Cerrar sesión borra la base local**, y al arrancar se comprueba que los
  datos locales son de la cuenta autenticada. IndexedDB sobrevive al `signOut`.
- `EstadoSync` lee el tamaño real de la cola, no `navigator.onLine`: tener
  cobertura no significa que lo registrado en el gimnasio ya esté guardado.

### Pruebas automatizadas

`npm test` (vitest sobre `fake-indexeddb`, así que ejercita Dexie de verdad:
transacciones e índices compuestos). **34 pruebas**, todas en verde:

- `src/lib/datos.test.ts` — fusión de cola, cancelación de envíos, cascadas,
  referencias a null, la descarga que no pisa lo pendiente.
- `src/lib/sincronizacion.test.ts` — orden de envío, reintentos, que un fallo
  de red no descarte datos, que un fallo definitivo no atasque la cola.
- `src/lib/fechas.test.ts` — la cena de las 22:00 que debe contar como de hoy.

Dos errores reales que encontraron estas pruebas:

1. `db.cola.where('tabla')` no funcionaba: Dexie no resuelve una consulta por
   el primer componente de un índice compuesto. El filtro que protege lo
   pendiente de subir **no filtraba nada** y la excepción quedaba tragada
   dentro de la transacción.
2. Un fallo de red gastaba el contador de reintentos y a los diez intentos la
   operación se descartaba. Una sesión entera registrada en un sótano se
   habría perdido a los veinte minutos.

### Pruebas contra la base de datos real

Verificadas contra el Supabase local, no revisadas a ojo:

- Anónimo leyendo o escribiendo cualquier tabla → `42501 permission denied`.
- Un segundo usuario ve **0** filas de los datos del primero.
- Enviar dos veces el mismo `id` con `Prefer: resolution=merge-duplicates` deja
  **una** fila: los reintentos de la cola offline no duplicarán series.
- `ultimas_series()` devuelve las series correctas y **vacío** para otro usuario.
- Un registro de comida sin alimento, receta ni descripción → rechazado.
- Una segunda rutina activa → rechazada por el índice único parcial.

Y de la capa offline, con `node scripts/verificar-offline.mjs` contra el REST real:

- La consulta de la descarga (`select *` + `gte(updated_at)` + orden doble +
  `range`) devuelve las 70 filas, y dos páginas de 40 no solapan ni pierden.
- Un upsert **sin `user_id`** queda con el `auth.uid()` correcto: el default de
  la columna funciona y el cliente no tiene que recordar el dato.
- El trigger mueve `updated_at` al actualizar, que es lo que hace avanzar la
  marca de agua de la descarga.
- Una serie creada con uuid de cliente se relaciona con su sesión igual.
- Una clave ajena rota devuelve `23503`, el código que la capa clasifica como
  definitivo.
- Borrar un id inexistente **no** es un error, así que un reintento que llegue
  de más no rompe nada.

---

## Decisiones tomadas sobre el plan

Añadidos y correcciones respecto a `docs/plan.md`, con su motivo:

1. **El cliente genera los uuid**, no la base de datos. Sin esto no se pueden
   crear filas relacionadas sin conexión (una sesión y sus series), y los
   reintentos duplicarían datos. Es la pieza que sostiene toda la fase offline.
2. **`sesiones.dia_id` es `on delete set null`**, no cascade, y la sesión
   guarda una copia del nombre del día (`nombre_dia`). Borrar o reescribir una
   rutina no puede llevarse por delante el histórico.
3. **Los ejercicios se archivan, no se borran** (`archivado`), y las claves
   ajenas hacia ellos son `on delete restrict`. Un ejercicio con series no
   puede desaparecer.
4. **`updated_at` con trigger en todas las tablas**, que el plan no contemplaba.
   La sincronización es "última escritura gana" y necesita un reloj del servidor.
5. **Unicidad por usuario**, no global: `dias(user_id, fecha)`,
   `alimentos(user_id, codigo_barras)`, `medidas_corporales(user_id, fecha)`.
   Un pesaje por día permite registrar el peso de la mañana con un upsert.
6. **RLS con `force row level security`** y `revoke all ... from anon`, además
   de la política. El rol `postgres` sí la salta, que es lo que permite sembrar
   el catálogo desde una migración.
7. **Catálogo sembrado con el `user_id` de la cuenta**, no filas globales: deja
   la política de RLS en una sola regla y permite editar los ejercicios.
8. **La fase offline se adelanta.** El plan la ponía en cuarto lugar; construir
   antes las pantallas contra `supabase.from(...)` obligaría a reescribirlas.
   La capa de mutación va antes que las pantallas.
9. **La base local es una copia, no una caché.** El plan pedía cachear los
   últimos 30 días; se descargan las catorce tablas completas. Las gráficas de
   Progreso y la vista de "última vez" necesitan el histórico, y trocearlo por
   fechas obligaría a dos rutas de lectura según haya o no cobertura. Son los
   datos de una persona: un año de uso no llega al megabyte.
10. **`user_id` no se envía nunca.** La columna tiene `default auth.uid()` y
    queda verificado que funciona. La base local es de un solo usuario y no
    necesita el dato; a cambio, `meta.usuario` guarda de quién son los datos
    locales para poder borrarlos si cambia la cuenta.
11. **El servidor es dueño de `created_at` y `updated_at`.** El cliente no los
    envía. La marca de agua de la descarga sale de los propios datos
    descargados, no del reloj del teléfono, que puede ir descuadrado.
12. **Los borrados hechos en otro dispositivo no se propagan.** Una fila
    borrada allí deja de venir en la descarga y aquí se queda. Límite aceptado:
    el plan descarta expresamente construir resolución de conflictos, y hay un
    usuario con un teléfono. "Recargar todo" en Ajustes no lo arregla; haría
    falta una tabla de tumbas.
13. **Versiones por encima del plan**: React 19 en vez de 18, Vite 8,
   Tailwind 4, react-router 8. Node del sistema era 18 (sin soporte desde abril
   de 2025) → nvm con Node 22.

---

## Siguiente paso

**Fase 2 — Comida y Hoy**, ahora que ya hay sobre qué construirlas:

- Objetivos nutricionales en Ajustes (dos filas, entreno y descanso).
- Pantalla Hoy: selector de tipo de día, anillo de calorías, barras de macros,
  comidas del día por momento, peso de la mañana.
- Pantalla Comida: buscador de la biblioteca ordenado por `veces_usado`, alta
  manual de alimentos, registro en dos toques, duplicar día anterior.

Después: Entreno (con "última vez" vía `ultimas_series()`, precacheada) →
Progreso → extras (escáner, Open Food Facts, importación de JSON, fotos,
exportación).

## Pendiente de tu parte

Crear el proyecto real en supabase.com. Hasta entonces todo corre en local.

1. Proyecto nuevo, región cercana (`eu-west` desde España). Guarda la
   contraseña de la base de datos.
2. **Authentication → Users → Add user** con tu email y contraseña, marcando
   "Auto Confirm User". No habrá pantalla de registro.
3. **SQL Editor**: pegar y ejecutar las cinco migraciones **en orden**.
   `0005` tiene que ir después de crear la cuenta del paso 2; si no, avisa de
   que no hay usuario y no siembra nada. Es idempotente, se puede repetir.
4. **Project Settings → API**: copiar `Project URL` y la clave `anon public` a
   un `.env.production.local`, dejando `.env.local` apuntando a la base local.

---

## Cosas que quedaron abiertas

- `0005` es un bloque `DO`. Convertirlo en una función
  `sembrar_catalogo_ejercicios()` permitiría volver a llamarla sin repetir el
  SQL, útil para reconstruir el entorno local tras un `db reset`.
- Falta el test del parser del JSON de macros, el otro sitio donde se pierden
  datos en silencio. La cola ya está cubierta.
- El bundle va por 560 kB (165 kB comprimido) porque Recharts entra en el
  chunk principal. Hay que cargar Progreso con `import()` diferido antes de
  dar la fase 5 por hecha; el plan pide abrir en menos de dos segundos.
- Sin definir: si el volumen de un ejercicio unilateral cuenta doble, y si el
  peso registrado es por lado o total.
