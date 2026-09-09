# Estado del proyecto

Última actualización: 9 de septiembre de 2026.

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

### Pruebas ejecutadas

Todas verificadas contra la base de datos local, no revisadas a ojo:

- Anónimo leyendo o escribiendo cualquier tabla → `42501 permission denied`.
- Un segundo usuario ve **0** filas de los datos del primero.
- Enviar dos veces el mismo `id` con `Prefer: resolution=merge-duplicates` deja
  **una** fila: los reintentos de la cola offline no duplicarán series.
- `ultimas_series()` devuelve las series correctas y **vacío** para otro usuario.
- Un registro de comida sin alimento, receta ni descripción → rechazado.
- Una segunda rutina activa → rechazada por el índice único parcial.

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
9. **Versiones por encima del plan**: React 19 en vez de 18, Vite 8,
   Tailwind 4, react-router 8. Node del sistema era 18 (sin soporte desde abril
   de 2025) → nvm con Node 22.

---

## Siguiente paso

**Capa de mutación offline**, antes de construir ninguna pantalla con datos:

- Dexie sobre IndexedDB: caché local y cola de escrituras.
- API única de escritura que genera el uuid, aplica el cambio al estado local
  de inmediato y encola el envío. La interfaz nunca espera a la red.
- Vaciado de la cola con reintentos y retroceso exponencial, usando
  `Prefer: resolution=merge-duplicates` (ya verificado como idempotente).
- Fusión de operaciones en cola: borrar una fila que aún no se ha enviado debe
  **cancelar** su inserción, no encolar el borrado de algo inexistente.
- `EstadoSync` pasa a leer el tamaño real de la cola en vez de `navigator.onLine`.

Después, en este orden: Comida y Hoy → Entreno (con "última vez" precacheada)
→ Progreso → extras (escáner, Open Food Facts, importación de JSON, fotos,
exportación).

---

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
- Sin tests automatizados todavía. Los primeros que hacen falta son los de la
  cola de sincronización y los del parser del JSON de macros: es donde se
  pierden datos en silencio.
- La fecha se calculará en el cliente en hora local, nunca con
  `toISOString()`, o una cena a las 22:00 acabaría contando como del día
  siguiente.
- Sin definir: si el volumen de un ejercicio unilateral cuenta doble, y si el
  peso registrado es por lado o total.
