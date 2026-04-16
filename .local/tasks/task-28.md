---
title: Docker + Coolify: Guía completa paso a paso para PostIAlo Mailing
---
# Docker + Coolify: Guía completa paso a paso

  ## What & Why
  El usuario gestiona un VPS con Coolify donde ya tiene contenedores de N8N, EvolutionAPI y otros servicios. Quiere desplegar PostIAlo Mailing como contenedor Docker gestionado por Coolify. Necesita una guía completa "for dummies" — no es experto en Docker ni Coolify.

  ## Done looks like

  ### Archivos en el repositorio:

  1. **Dockerfile** — Multi-stage build optimizado:
     - Stage 1 (build): Node 20-alpine, npm install completo, npm run build
     - Stage 2 (production): Node 20-alpine, copia solo dist/ + node_modules de producción + seed-data.json
     - Expone puerto 5000, ejecuta node dist/index.cjs
     - Incluye creación de carpeta uploads/ dentro del contenedor

  2. **.dockerignore** — Excluir node_modules, dist, .git, .env, uploads, etc.

  3. **docker-compose.yml** — Dos servicios:
     - postialo-app (la app Node.js)
     - postialo-db (PostgreSQL 16 alpine)
     - Volúmenes persistentes para uploads/ y datos de PostgreSQL
     - Variables de entorno con placeholders claros
     - Healthcheck para la app y la BD
     - Red interna para comunicación app↔db
     - Configuración de restart: always
     - Nota: el docker-compose.yml es para referencia y uso local. En Coolify se configura desde el panel.

  ### Documento guía:

  4. **DOCKER_COOLIFY.md** — Guía completa paso a paso "for dummies" con:

     **Sección 1: Entender la arquitectura**
     - Diagrama simple de cómo se conecta todo (texto ASCII)
     - Explicación de por qué 2 contenedores separados (app + BD) es mejor que todo junto
     - Rol de Coolify: gestiona contenedores, SSL, dominios, y CI/CD automático
     - Rol de Traefik (ya incluido en Coolify): reverse proxy + SSL — NO necesitas Nginx

     **Sección 2: Preparar el repositorio**
     - Paso a paso: crear Dockerfile, .dockerignore
     - Verificar que están commiteados y pusheados a GitHub

     **Sección 3: Crear la base de datos en Coolify**
     - Opción A: Crear un nuevo servicio PostgreSQL 16 desde el marketplace de Coolify
     - Opción B: Reutilizar PostgreSQL existente (si ya tiene uno para N8N/otros) — solo crear una nueva BD
     - Cómo obtener la DATABASE_URL resultante

     **Sección 4: Crear el proyecto PostIAlo en Coolify**
     - Paso a paso desde el panel de Coolify:
       - New Resource → seleccionar repo de GitHub
       - Coolify detecta el Dockerfile automáticamente
       - Configurar puerto: 5000
       - Configurar dominio
     - Habilitar WebSocket en Coolify (la app usa ws para tiempo real)
       - Custom Traefik labels si es necesario

     **Sección 5: Variables de entorno en Coolify**
     - Lista exacta de variables a agregar en el panel:
       - DATABASE_URL (la del paso 3)
       - SESSION_SECRET (cómo generar uno seguro)
       - OPENAI_API_KEY
       - GEMINI_API_KEY
       - PORT=5000
       - NODE_ENV=production

     **Sección 6: Volumen para uploads/**
     - Configurar volumen persistente en Coolify para /app/uploads
     - Cómo migrar los archivos existentes (logos + imágenes de campañas, ~14MB) al volumen
     - Comando docker cp para copiar archivos al contenedor

     **Sección 7: Crear las tablas y cargar datos**
     - Opción A: Ejecutar drizzle-kit push dentro del contenedor
     - Opción B: Ejecutar SQL directo contra la BD de Coolify
     - Las migraciones (server/migrations.ts) y seed data se ejecutan automáticamente al primer inicio
     - Cómo importar un dump de la BD de Replit si quiere migrar datos existentes

     **Sección 8: Primer despliegue**
     - Deploy desde Coolify
     - Verificar logs en el panel de Coolify
     - Verificar que la app responde en el dominio configurado
     - Probar login, WebSockets, generación de imágenes

     **Sección 9: Actualizaciones futuras**
     - Flujo: push a GitHub → Coolify detecta → rebuild automático
     - Cómo configurar auto-deploy en Coolify (webhook de GitHub)
     - Los datos de uploads/ y BD se mantienen intactos entre deploys

     **Sección 10: Respaldos**
     - Cómo hacer backup de la BD desde Coolify
     - Cómo respaldar el volumen de uploads/
     - Configurar backup automático si Coolify lo permite

     **Sección 11: Solución de problemas**
     - La app no arranca: revisar logs, verificar DATABASE_URL
     - WebSockets no funcionan: configuración de Traefik
     - Imágenes no cargan: verificar volumen de uploads/
     - Error de conexión a BD: verificar red interna entre contenedores
     - Cómo entrar al contenedor para debug: docker exec

  ## Technical considerations
  - La app usa WebSockets (ws) — Traefik en Coolify lo soporta pero puede necesitar labels adicionales
  - Express body limit 25MB (por uploads de imágenes IA)
  - server/seed.ts y server/migrations.ts se ejecutan automáticamente al primer inicio
  - El build produce dist/index.cjs + dist/public/ + dist/server/seed-data.json
  - La carpeta uploads/ debe persistir entre deploys → volumen Docker obligatorio
  - Coolify maneja SSL automáticamente con Let's Encrypt — no necesita Certbot manual
  - Coolify maneja reverse proxy con Traefik — no necesita Nginx

  ## Relevant files
  - package.json (scripts build/start)
  - script/build.ts (build process)
  - server/index.ts (entrypoint, puerto 5000)
  - server/db.ts (conexión PostgreSQL vía DATABASE_URL)
  - server/seed.ts + server/migrations.ts (auto-ejecutan al inicio)
  - shared/schema.ts (esquema Drizzle — 8 tablas)
  - drizzle.config.ts