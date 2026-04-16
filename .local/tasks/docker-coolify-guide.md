# Docker + Coolify: Guía completa paso a paso para PostIAlo Mailing

## What & Why
El usuario necesita un documento aparte (adicional al manual de migración y al de seguridad) con una guía completa "for dummies" para desplegar PostIAlo Mailing en su VPS existente usando Docker y Coolify. Ya tiene otros contenedores corriendo (N8N, EvolutionAPI). El subdominio será mailing.postialo.com. Necesita entender la arquitectura, los archivos Docker necesarios, y el paso a paso en Coolify.

## Done looks like

### Archivos en el repositorio:

1. **`Dockerfile`** — Multi-stage build optimizado:
   - Stage 1 (build): Node 20-alpine, npm ci (incluye devDependencies), npm run build
   - Stage 2 (production): Node 20-alpine, npm ci --omit=dev (solo producción), copia dist/ + seed-data.json
   - Crea carpeta uploads/ dentro del contenedor
   - Expone puerto 5000, ejecuta `node dist/index.cjs`

2. **`.dockerignore`** — Excluir node_modules, dist, .git, .env, uploads, logs, *.backup, etc.

3. **`docker-compose.yml`** — Para referencia y uso local:
   - Servicio postialo-app (Node.js, puerto 5000)
   - Servicio postialo-db (PostgreSQL 16 alpine) — opcional si ya tiene PG en Coolify
   - Volúmenes persistentes para uploads/ y datos de PostgreSQL
   - Variables de entorno con placeholders
   - Healthcheck, restart: always, red interna

### Documento guía:

4. **`DOCKER_COOLIFY.md`** — Guía paso a paso con:

   **Arquitectura recomendada:**
   - Diagrama ASCII: Internet → Traefik (Coolify) → contenedor app ↔ contenedor PostgreSQL
   - Explicación sencilla de por qué 2 contenedores separados es mejor
   - Coolify maneja SSL, dominio y reverse proxy automáticamente — NO necesita Nginx ni Certbot manual

   **Configuración del subdominio:**
   - DNS: registro A para mailing.postialo.com → IP del VPS
   - En Coolify: campo "Domains" → https://mailing.postialo.com
   - Traefik enruta por dominio automáticamente (convive con N8N, EvolutionAPI, etc.)

   **Paso a paso en Coolify (for dummies):**
   - Paso 1: Crear la base de datos PostgreSQL 16 desde el marketplace de Coolify (o reusar una existente)
   - Paso 2: Obtener la DATABASE_URL de la BD creada
   - Paso 3: Crear nuevo recurso desde GitHub (conectar repo)
   - Paso 4: Coolify detecta el Dockerfile automáticamente
   - Paso 5: Configurar el puerto expuesto: 5000
   - Paso 6: Escribir el dominio: https://mailing.postialo.com
   - Paso 7: Agregar variables de entorno (DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, GEMINI_API_KEY, PORT=5000, NODE_ENV=production)
   - Paso 8: Configurar volumen persistente para /app/uploads
   - Paso 9: Habilitar WebSocket support si es necesario (labels de Traefik)
   - Paso 10: Deploy

   **Crear tablas y cargar datos:**
   - Opción A: ejecutar drizzle-kit push dentro del contenedor (docker exec)
   - Opción B: SQL directo contra la BD
   - Seed data y migraciones se ejecutan automáticamente al primer inicio
   - Cómo importar dump de Replit si quiere migrar datos existentes

   **Migrar archivos uploads/:**
   - Cómo copiar logos e imágenes (~14MB) al volumen del contenedor
   - Comando docker cp

   **Actualizaciones futuras:**
   - Push a GitHub → Coolify detecta → rebuild automático (webhook)
   - Datos de uploads/ y BD se mantienen intactos entre deploys

   **Respaldos:**
   - Backup de la BD desde Coolify o con docker exec + pg_dump
   - Backup del volumen uploads/

   **Solución de problemas:**
   - App no arranca: logs de Coolify, verificar DATABASE_URL
   - WebSockets no funcionan: labels de Traefik
   - Imágenes no cargan: verificar volumen uploads/
   - Cómo entrar al contenedor: docker exec -it

## Technical context
- Puerto de la app: 5000
- La app usa WebSockets (ws) para comunicación en tiempo real
- Express body limit 25MB (por uploads de imágenes IA)
- server/seed.ts y server/migrations.ts se ejecutan automáticamente al primer inicio
- El build produce dist/index.cjs + dist/public/ + dist/server/seed-data.json
- Variables requeridas: DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, GEMINI_API_KEY, PORT
- Subdominio objetivo: mailing.postialo.com

## Relevant files
- package.json
- script/build.ts
- server/index.ts
- server/db.ts
- server/seed.ts
- server/migrations.ts
- shared/schema.ts
- drizzle.config.ts
- .gitignore
