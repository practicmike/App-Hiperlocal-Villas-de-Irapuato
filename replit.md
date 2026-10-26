# App Hiperlocal · Villas de Irapuato

Guía de confianza de Villas de Irapuato, hecha por los vecinos. El inicio pregunta «¿Qué necesitas hoy?» (escrito o por voz, con tus búsquedas frecuentes como atajo) y el radar muestra sobre las calles reales lo que te queda más cerca, en metros. Cada tarjeta lleva a WhatsApp. No es anónima: el creador conoce en persona a cada vecino que entra.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API (puerto 8080, rutas `/api/*`)
- `pnpm --filter @workspace/villas-web run dev` — web (puerto 5173, ruta `/`). En local: `API_PROXY=http://localhost:8080`
- `pnpm --filter @workspace/db run push` — aplica el esquema a la base
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks y Zod tras editar `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/api-server run test` — pruebas del buscador
- `pnpm run typecheck` / `pnpm run build`

### Primer arranque

1. `pnpm --filter @workspace/db run push`
2. (Replit/local) `ADMIN_NAME="Tu nombre" ADMIN_PHONE=4621234567 pnpm --filter @workspace/scripts run crear-admin` → imprime `/llave/<token>`. Ábrelo en tu teléfono, en tu dominio. Si lo vuelves a correr, la llave anterior deja de servir.
3. Opcional: `pnpm --filter @workspace/scripts run cargar-demo` (16 estrellas ficticias, solo si la tabla está vacía). Bórralas o desactívalas cuando cargues los comercios fundadores.

### Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Postgres |
| `CREATOR_NAME` | No (`Miguel`) | Nombre visible del creador |
| `CREATOR_WHATSAPP` | Recomendada | WhatsApp del creador, 10 dígitos o con lada |
| `CREATOR_MESSAGE` | No | Presentación personal |
| `CREATOR_PHOTO_URL` | No | Foto del creador |
| `OPENAI_API_KEY` | No | Activa la búsqueda semántica y "Refinar con IA". Sin ella, la búsqueda funciona por palabras y el botón se oculta |
| `OPENAI_EMBEDDING_MODEL` / `OPENAI_CHAT_MODEL` | No | `text-embedding-3-small` / `gpt-4o-mini` |

No se necesita `SESSION_SECRET`: las sesiones y llaves son tokens aleatorios guardados como hash.

## Despliegue en Vercel

El mismo repo corre en Replit (desarrollo) y en Vercel (producción). `vercel.json` ya trae instalación, build, salida y rutas. **No se necesita terminal.**

1. **Base de datos:** Vercel → proyecto → *Storage* → *Create Database* → **Neon** → conectar al proyecto. Esto crea `DATABASE_URL` solo.
2. **Variables** (*Settings → Environment Variables*): `SETUP_TOKEN` (una clave larga que inventes, mínimo 16 caracteres), `CREATOR_WHATSAPP` y, si quieres, `CREATOR_NAME`, `CREATOR_MESSAGE`, `CREATOR_PHOTO_URL`, `OPENAI_API_KEY`.
3. **Redeploy** (las variables nuevas solo aplican a despliegues nuevos).
4. Abre `https://<tu-dominio>/setup`, escribe la clave, tu nombre y tu WhatsApp. Se crean las tablas y tu cuenta, y te entrega tu llave de creador.

Si perdiste tu llave: vuelve a `/setup` con el mismo WhatsApp; la anterior deja de servir.

**Cambios al esquema:** edita `lib/db/src/schema/`, corre `pnpm --filter @workspace/db run generate` (crea la migración SQL y la embebe en el código), despliega y vuelve a enviar `/setup`: solo aplica lo que falta.

Cómo funciona: el build empaqueta la API en `artifacts/api-server/dist/vercel.mjs` y `api/index.mjs` la expone como una sola función para `/api/*`. Las migraciones viajan dentro de ese paquete (`lib/db/src/migrations.generated.ts`), así no dependen de que Vercel copie archivos sueltos. Sin `DATABASE_URL` o sin tablas, la API responde 503 con lo que falta, y la web lo muestra en lugar de un error genérico.

## Stack

pnpm workspaces · Node 24 · TypeScript 5.9 · Express 5 · Postgres + Drizzle · Zod · Orval (OpenAPI → hooks) · React 19 + Vite + Tailwind 4 · d3-zoom.

## Where things live

- Esquema: `lib/db/src/schema/` (`residents`, `places`, `activity`)
- Contrato de la API: `lib/api-spec/openapi.yaml` (fuente de verdad; regenera tras cambiarlo)
- Rutas: `artifacts/api-server/src/routes/` (`auth`, `universe`, `admin`)
- Buscador: `artifacts/api-server/src/lib/search-core.ts` (puro, con pruebas) y `lib/ai.ts` (OpenAI)
- Inicio y radar: `artifacts/villas-web/src/pages/HomePage.tsx`, `src/components/RadarMap.tsx` (Leaflet + OpenStreetMap), `src/lib/geo.ts`
- Novedades (sin push, dentro de la app): `src/components/NovedadesSheet.tsx`
- Universo (ya no está en la navegación; se conserva para reutilizarlo): `src/pages/UniversePage.tsx`, `src/components/UniverseCanvas.tsx`, `src/lib/layout.ts`
- Paleta y constelaciones: `artifacts/villas-web/src/index.css`, `src/lib/constellations.ts`

## Architecture decisions

- **Acceso por llave personal, sin contraseñas ni SMS.** Código de invitación → vecino pendiente → el creador lo aprueba y le envía un link `/llave/<token>` por WhatsApp. Solo se guarda el hash SHA-256 de llaves y sesiones. Regenerar o bloquear corta el acceso al instante.
- **Universo en 2D con profundidad, no 3D real.** La regla "fluido en gama media" pesa más; el zoom solo cambia dos variables CSS por cuadro (`--kl`, `--ks`), sin renders de React.
- **Búsqueda: palabras + embeddings, gana el mayor.** El embedding de cada lugar se calcula al guardarlo (no en cada búsqueda); el de la consulta se cachea. Toda búsqueda se registra para medir y para que las vacías lleguen al creador.
- **Impulso pagado separado de la relevancia.** `places.boost` suma como máximo 0.1 al orden; el brillo en pantalla es relevancia pura y lo patrocinado se marca. Aún no hay UI para cobrarlo.
- **Privacidad por diseño.** Los vecinos nunca aparecen en el universo; su WhatsApp solo lo ve el creador; el nombre en una recomendación requiere permiso explícito; las quejas no se publican.

## Product

- Inicio: la pregunta, el micrófono grande y atajos. Atajos = tus búsquedas frecuentes (3 o más); si no, lo más buscado en Villas por al menos 2 vecinos; si no hay, los giros con más lugares.
- Radar: calles reales, tú al centro con anillos de 200 y 500 m. Al buscar muestra solo lo que coincide; "o explora lo que hay cerca" muestra todo. Lista por distancia; los oficios y lo que no tiene ubicación van en "A domicilio", sin punto en el mapa.
- Ubicación del vecino: se pide al abrir el radar, vive en memoria y nunca se manda al servidor. A más de 5 km de Villas el radar abre en Villas, sin distancias.
- Ubicación de cada lugar: en el panel, «Usar mi ubicación» parado en el local (o pegando coordenadas de Google Maps).
- Novedades: campana con punto cuando hay algo que no has visto (Hoy en Villas + lugares nuevos de las últimas 2 semanas). Sin notificaciones push.
- Tarjeta: quién es, qué ofrece, quién lo recomienda, botón a WhatsApp, "Lo recomiendo" y queja privada.
- Vista en lista equivalente.
- Panel del creador: señales de que funciona, invitaciones, aprobar vecinos y enviar llaves, alta de lugares, búsquedas sin resultado y quejas.

## Gotchas

- Mapa: teselas de OpenStreetMap (uso ligero con atribución). Si el tráfico crece, cambia `TILE_URL` en `RadarMap.tsx` por un proveedor con plan.
- La llave de `/llave/<token>` es de un solo uso: para probar dos veces, genera otra.

- Tras editar `openapi.yaml`, corre codegen; si no, los tipos del frontend y la validación del backend quedan desfasados.
- El límite de intentos vive en la tabla `rate_limits` (sirve igual en Replit y en Vercel). Si pruebas muchas llaves falsas desde tu IP, te bloqueas 15 minutos.
- Cambios al esquema: corre `db push` contra Neon **antes** de desplegar el código que los usa.
- Al editar un lugar se borra su embedding y se recalcula en segundo plano; si OpenAI falla, el lugar sigue encontrándose por palabras.
- Los sinónimos del buscador están en `search-core.ts` (`SYNONYMS`). Amplíalos con lo que aparezca en "Búsquedas sin resultado".

## Pointers

- Ver el skill `pnpm-workspace` para la estructura del monorepo.
