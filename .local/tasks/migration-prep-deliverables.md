# Preparar Migración a Nueva Cuenta Replit

## What & Why
Preparar el repositorio para migrarlo a una nueva cuenta de Replit. El usuario hace el commit/push y la importación a mano; esta tarea solo crea los 4 entregables de documentación y configuración necesarios para que el agente de la cuenta nueva pueda levantar el proyecto sin adivinar nada. NO se toca código de la app, schema, Dockerfile, ni lógica de negocio.

La base de datos de producción (VPS/Coolify) es independiente y NO se toca con esta migración.

## Done looks like
- `.gitignore` ignora `.local/` pero hace excepción para `.local/tasks/` (91 archivos de historial quedan trackeados).
- `MIGRATION_GUIDE.md` existe en la raíz con 3 fases claras (export → bootstrap → producción intacta).
- `.env.example` existe en la raíz listando todas las variables de entorno detectadas con comentarios.
- `replit.md` tiene 3 secciones nuevas: "First-time setup", "Producto", "Gotchas / cosas raras conocidas".
- Commit local hecho con mensaje descriptivo. NO se hace push (lo hace el usuario).
- Confirmar que `.local/tasks/` quedó trackeado en git.

## Out of scope
- Cualquier cambio a código de la app, schema de DB, Dockerfile, build config, prompts de IA, lógica de negocio.
- Push a GitHub (lo hace el usuario manualmente).
- Conexión con DB de producción.
- READMEs nuevos, CHANGELOGs, ni archivos auxiliares fuera de los 4 entregables.

## Tasks

1. **Actualizar `.gitignore`** — Agregar `.local/` al ignore con excepciones explícitas para `.local/tasks/` y `.local/tasks/**`. Verificar con `git status` y `git ls-files` que los 91 archivos del historial aparecen trackeados.

2. **Crear `MIGRATION_GUIDE.md`** en la raíz con tres fases:
   - **Fase 1 (Exportar de cuenta vieja)**: checklist de commit/push, lista exacta de secrets a anotar (`SESSION_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MAKE_VERIFICATION_WEBHOOK_URL`, `MAKE_WEBHOOK_SECRET`), recordatorio sobre carpeta `uploads/` (no está en Git), recordatorio de desconectar GitHub al terminar Fase 2.
   - **Fase 2 (Bootstrap en cuenta nueva)**: pasos secuenciales — Import from GitHub → crear PostgreSQL en Replit (NO usar la de producción) → `npm install` → cargar secrets uno por uno (con bloque explícito para que el agente le pida al usuario) → `npm run db:push` → `npm run dev` → healthchecks (frontend carga login, `/api/auth/me` responde 401, registro de usuario funciona, OpenAI/Gemini responden).
   - **Fase 3 (Producción intacta)**: nota explícita de que VPS/Coolify/dominio/DB de producción no se tocan; el cambio solo afecta el entorno de desarrollo Replit.

3. **Crear `.env.example`** en la raíz con todas las variables detectadas:
   - Requeridas: `DATABASE_URL`, `SESSION_SECRET` (con WARNING: también encripta API keys, no rotar), `OPENAI_API_KEY`, `GEMINI_API_KEY`.
   - Webhooks Make.com: `MAKE_VERIFICATION_WEBHOOK_URL` (con warning del fallback hardcodeado), `MAKE_WEBHOOK_SECRET`.
   - Opcionales: `APP_URL`, `PRODUCTION_URL`, `PORT` (default 5000), `NODE_ENV`, `REPLIT_DOMAINS` (auto).
   - Solo nombres y placeholders, sin valores reales.

4. **Agregar 3 secciones a `replit.md`**:
   - **4a. "First-time setup en cuenta nueva de Replit"** al principio: pasos mínimos, referencia a `MIGRATION_GUIDE.md`, recordatorio de pedir secrets uno a uno.
   - **4b. "Producto"** después de 4a: 2-3 párrafos sobre qué es PostIAlo Mailing, público objetivo (LATAM, español, PYMEs/marketing), modelo SaaS multi-usuario con roles, flujo de uso punta a punta.
   - **4c. "Gotchas / cosas raras conocidas"** antes de Deployment: lista con SESSION_SECRET no rotar (encripta API keys), fallback hardcodeado peligroso del Make webhook, sin carpeta `migrations/` (usa `db:push` directo), `trust proxy` habilitado, `uploads/` en disco no está en Git, seed automático en producción, body limit 25MB, cookies `secure` solo en production, regen limits hardcodeados (1+2=3), encryption AES-256-GCM derivada de SESSION_SECRET.

5. **Commit local con mensaje descriptivo** — Algo como "docs: prepare repo for Replit account migration (4 deliverables)". NO push. Verificar explícitamente que los archivos de `.local/tasks/` quedaron trackeados; si la plataforma los excluyó, hacer un commit manual adicional solo para ese directorio.

6. **Reportar al usuario** — qué archivos se modificaron/crearon, cuántos commits locales quedan por pushear, si `.local/tasks/` quedó trackeado, y cualquier observación adicional del proyecto.

## Relevant files
- `.gitignore`
- `replit.md`
- `.replit:42-45`
- `server/index.ts:56,123,133`
- `server/db.ts:5-9`
- `server/encryption.ts:9-11`
- `server/openai.ts:7-9,658`
- `server/gemini.ts:7`
- `server/routes.ts:244-247,358,497`
- `package.json:6-12`
- `.local/tasks/`
