# App Hiperlocal · Villas de Irapuato

Guía de confianza de Villas de Irapuato, hecha por los vecinos y navegable como un universo: una sola pantalla donde se hace zoom en lugar de scroll. El residente escribe lo que necesita con sus palabras y encuentra casas, gente de confianza y comercios; cada tarjeta lleva a WhatsApp. No es anónima: el creador conoce en persona a cada vecino que entra.

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
- Universo: `artifacts/villas-web/src/components/UniverseCanvas.tsx` y `src/lib/layout.ts`
- Paleta y constelaciones: `artifacts/villas-web/src/index.css`, `src/lib/constellations.ts`

## Architecture decisions

- **Acceso por llave personal, sin contraseñas ni SMS.** Código de invitación → vecino pendiente → el creador lo aprueba y le envía un link `/llave/<token>` por WhatsApp. Solo se guarda el hash SHA-256 de llaves y sesiones. Regenerar o bloquear corta el acceso al instante.
- **Universo en 2D con profundidad, no 3D real.** La regla "fluido en gama media" pesa más; el zoom solo cambia dos variables CSS por cuadro (`--kl`, `--ks`), sin renders de React.
- **Búsqueda: palabras + embeddings, gana el mayor.** El embedding de cada lugar se calcula al guardarlo (no en cada búsqueda); el de la consulta se cachea. Toda búsqueda se registra para medir y para que las vacías lleguen al creador.
- **Impulso pagado separado de la relevancia.** `places.boost` suma como máximo 0.1 al orden; el brillo en pantalla es relevancia pura y lo patrocinado se marca. Aún no hay UI para cobrarlo.
- **Privacidad por diseño.** Los vecinos nunca aparecen en el universo; su WhatsApp solo lo ve el creador; el nombre en una recomendación requiere permiso explícito; las quejas no se publican.

## Product

- Universo con tres constelaciones (Casas, Gente de confianza, Comercios) y tres niveles de zoom: lejos (constelaciones), medio (nombres), cerca (la estrella al centro abre su tarjeta).
- Búsqueda en lenguaje libre: las estrellas que coinciden se acercan al vecino y brillan; las demás se alejan. "Refinar con IA" si hay llave de OpenAI.
- Tarjeta: quién es, qué ofrece, quién lo recomienda, botón a WhatsApp, "Lo recomiendo" y queja privada.
- Vista en lista equivalente.
- Panel del creador: señales de que funciona, invitaciones, aprobar vecinos y enviar llaves, alta de lugares, búsquedas sin resultado y quejas.

## Gotchas

- Tras editar `openapi.yaml`, corre codegen; si no, los tipos del frontend y la validación del backend quedan desfasados.
- El límite de intentos vive en la tabla `rate_limits` (sirve igual en Replit y en Vercel). Si pruebas muchas llaves falsas desde tu IP, te bloqueas 15 minutos.
- Cambios al esquema: corre `db push` contra Neon **antes** de desplegar el código que los usa.
- Al editar un lugar se borra su embedding y se recalcula en segundo plano; si OpenAI falla, el lugar sigue encontrándose por palabras.
- Los sinónimos del buscador están en `search-core.ts` (`SYNONYMS`). Amplíalos con lo que aparezca en "Búsquedas sin resultado".

## Pointers

- Ver el skill `pnpm-workspace` para la estructura del monorepo.
