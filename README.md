# gym-pwa

PWA personal de nutrición y entrenamiento. Un usuario por cuenta, pensada para
usarse con una mano, de pie, en un gimnasio de sótano sin cobertura.

- **Coste cero**: solo planes gratuitos, sin servidor propio.
- **Sin backend**: el cliente habla directamente con Supabase.
- **Sin APIs de IA**: la estimación de macros por foto se resuelve con un puente
  manual, pegando el JSON que devuelve la aplicación de Claude.
- **Funciona sin red**: toda escritura entra en una cola local y la interfaz no
  espera nunca a la red.

React 19 · TypeScript · Vite · Tailwind 4 · Dexie · Supabase · Recharts

## Arrancar

```bash
nvm use                              # Node 22, fijado en .nvmrc
npm install

systemctl --user start docker-desktop
npx supabase start                   # base local; Studio en :54323
cp .env.example .env.local           # y rellena con lo que imprima `supabase status`

npm run dev                          # http://localhost:5173
```

La primera vez hay que crear una cuenta a mano (`Authentication → Users`), porque
la app no tiene pantalla de registro, y sembrar el catálogo de ejercicios:

```sql
select public.sembrar_catalogo_ejercicios('tu@email');
```

Para mirar las pantallas con datos dentro:

```bash
node scripts/datos-demo.mjs            # dos meses de histórico
node scripts/datos-demo.mjs --borrar
```

## Comprobar

```bash
npm run comprobar    # tipos, linter, 191 pruebas, build y el SQL de producción
```

Es lo mismo que corre la integración continua en cada empujón.

Las pruebas de lógica usan `fake-indexeddb`, así que ejercitan Dexie de verdad;
las de pantalla montan el componente entero en jsdom contra esa misma base. Para
lo que un doble no puede comprobar hay scripts contra un Supabase real:

```bash
node scripts/verificar-offline.mjs      # el contrato con PostgREST, en local
node scripts/verificar-produccion.mjs   # RLS y el esquema del proyecto remoto
node scripts/verificar-aislamiento.mjs  # que dos cuentas no se vean entre sí
```

## Desplegar

```bash
npm run produccion:sql   # regenera docs/produccion.sql si hay migraciones nuevas
npx vercel --prod
```

Las dos variables de Supabase van **además** en el panel del host: Vite las
incrusta al construir, y `.env.production.local` está en `.gitignore`.

## Documentación

- **`docs/plan.md`** — el encargo original, sin modificar. Lo que había que
  construir y lo que quedaba expresamente fuera.
- **`docs/estado.md`** — qué está hecho, **por qué** cada decisión se tomó así,
  qué se apartó del plan y con qué motivo, y qué queda sin comprobar.
- **`docs/produccion.sql`** — generado; las migraciones concatenadas para pegar
  de una vez en el SQL Editor.

Si vas a tocar el código, `docs/estado.md` es lo que hay que leer primero: la
mayoría de lo que parece raro está ahí explicado.
