# Archivos Docker para despliegue en Coolify

## What & Why
El usuario gestiona un VPS con Coolify donde ya tiene contenedores de N8N, EvolutionAPI y otros servicios. Quiere desplegar PostIAlo Mailing como contenedor Docker gestionado por Coolify, conectado vía GitHub para CI/CD automático.

## Done looks like
Archivos listos en el repositorio para que Coolify los detecte y despliegue automáticamente:

1. **`Dockerfile`** — Multi-stage build:
   - Stage 1 (build): Node 20-alpine, npm install (incluye devDependencies), npm run build
   - Stage 2 (production): Node 20-alpine, copia dist/ + node_modules (solo prod) + seed-data.json, ejecuta `node dist/index.cjs`
   - Expone puerto 5000

2. **`.dockerignore`** — Excluir node_modules, dist, .git, .env, etc.

3. **`docker-compose.yml`** — Para referencia/uso directo:
   - Servicio `postialo-mailing` (la app Node.js, puerto 5000)
   - Servicio `postialo-db` (PostgreSQL 16 alpine) — opcional si ya tiene PostgreSQL en Coolify
   - Volumen persistente para `uploads/` (logos e imágenes de campañas, ~14MB)
   - Volumen persistente para datos de PostgreSQL
   - Variables de entorno documentadas con placeholders
   - Healthcheck en la app
   - Red interna para comunicación app↔db

4. **Documento `DOCKER_COOLIFY.md`** con instrucciones específicas para Coolify:
   - Cómo crear el proyecto en Coolify desde GitHub
   - Configurar variables de entorno en el panel de Coolify
   - Habilitar WebSocket support en el proxy de Coolify (Traefik)
   - Migrar uploads/ al volumen del contenedor
   - Opción A: usar PostgreSQL propio del contenedor vs Opción B: conectarse a PostgreSQL existente en Coolify
   - Cómo aplicar el esquema de BD y datos semilla (se ejecutan automáticamente al primer inicio)
   - Verificación y troubleshooting

## Technical considerations
- La app usa WebSockets (ws) para comunicación en tiempo real — Coolify usa Traefik como proxy que soporta WS pero puede necesitar configuración
- Express body limit 25MB (por uploads de imágenes generadas por IA)
- `server/seed.ts` y `server/migrations.ts` se ejecutan automáticamente al primer inicio — crean datos y aplican migraciones
- Las tablas se crean vía `npx drizzle-kit push` O vía SQL directo antes del primer inicio
- La app necesita que la carpeta `uploads/` sobreviva recreaciones del contenedor → volumen Docker
- El build produce `dist/index.cjs` (servidor CJS) + `dist/public/` (frontend) + `dist/server/seed-data.json`
- Variables de entorno requeridas: DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, GEMINI_API_KEY, PORT

## Relevant files
- package.json (scripts build/start)
- script/build.ts (build process)
- server/index.ts (entrypoint, puerto 5000)
- server/db.ts (conexión PostgreSQL)
- server/seed.ts + server/migrations.ts (auto-ejecutan al inicio)
- shared/schema.ts (esquema Drizzle)
- drizzle.config.ts
- .gitignore
