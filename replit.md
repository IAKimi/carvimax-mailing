# PostIAlo Mailing - SaaS de Email Marketing con IA

## First-time setup en cuenta nueva de Replit
Si este es el primer arranque del proyecto en una cuenta nueva de Replit (recién importado desde GitHub), seguir esto antes de tocar código:

1. **Leer `MIGRATION_GUIDE.md`** en la raíz del repo. Tiene el runbook completo de bootstrap (Fase 2).
2. **Provisionar PostgreSQL** desde Tools → Database. NO usar la DB de producción del VPS.
3. **Pedirle los Secrets al usuario uno por uno** (ver `.env.example` para la lista completa). El más crítico es `SESSION_SECRET`: tiene que ser idéntico al de la cuenta vieja, porque también se usa para encriptar las API keys de proveedores guardadas en la DB. Si se cambia, todas las conexiones de Brevo/Mailchimp dejan de funcionar.
4. **Instalar dependencias y crear las tablas**: `npm install` y `npm run db:push`.
5. **Levantar el workflow** "Start application" (`npm run dev`) y verificar los healthchecks de la sección 2.7 del MIGRATION_GUIDE.
6. **No tocar producción.** El VPS con Coolify es independiente y sigue corriendo con su propia DB y dominio.

El historial de planes de cada feature/fix está en `.local/tasks/` (incluido en Git mediante una excepción del `.gitignore`). Consultarlo para entender por qué se tomaron decisiones específicas.

## Producto
**PostIAlo Mailing** es una plataforma SaaS de email marketing potenciada con IA, dirigida a PYMEs y equipos de marketing en Latinoamérica. Toda la interfaz, los emails de la plataforma y la documentación de cara al usuario están en español. Permite que un usuario sin conocimientos técnicos cree campañas de email completas (texto + imagen + plantilla HTML) describiendo solo la idea — la IA se encarga del resto: OpenAI `gpt-4.1-mini` genera el copy y Gemini (`gemini-3.1-flash-image-preview` con fallback a `gemini-2.0-flash`) genera y edita las imágenes.

El modelo es **multi-usuario con roles** (`user`, `admin`, `superadmin`) y panel administrativo con impersonation. Cada usuario conecta sus propios proveedores de envío (**Brevo** y/o **Mailchimp**) usando sus propias API keys, que la plataforma encripta con AES-256-GCM antes de guardarlas. Esto significa que PostIAlo no envía correos por sí misma: solo orquesta la generación con IA y delega el envío real al proveedor del usuario, manteniendo costos de envío fuera de la plataforma.

El **flujo de uso típico** es: registro → verificación de email vía webhook a Make.com → onboarding progresivo lineal (Identidad de Marca → Proveedor de Email → Plantillas → Base de Datos de contactos) que va desbloqueando secciones del sidebar con candados → crear campaña describiendo idea/objetivo/audiencia → la IA genera texto e imagen en paralelo (hasta 3 versiones de cada uno: 1 original + 2 regeneraciones) → aprobar contenido → programar o enviar inmediatamente → tracking por contacto vía webhooks de Brevo/Mailchimp y broadcast en tiempo real por WebSocket. Los admins ven estadísticas, logs de actividad y pueden impersonar usuarios para soporte.

## Overview
PostIAlo Mail is an AI-powered email marketing automation SaaS platform designed to streamline email campaign creation and management. It leverages AI for content and image generation, offering a comprehensive tool for users to efficiently design, generate, and manage their email marketing efforts. The project aims to empower users with advanced AI capabilities to create engaging and effective email campaigns, simplifying the marketing process and boosting efficiency.

## User Preferences
I want to prioritize iterative development, receiving detailed explanations for complex features. I prefer clear, concise language in all communications. For coding, I favor a modular and clean architecture. Before making any significant architectural changes or introducing new dependencies, please ask for my approval. Ensure all user-facing text and documentation are in Spanish.

## System Architecture
The application is built with a modern web stack, featuring a React frontend and an Express.js backend.

### Frontend
- **Framework & Styling**: React with TypeScript, Vite, and Tailwind CSS.
- **UI Components**: Utilizes Shadcn UI, Lucide React, React Icons, and Framer Motion for animations.
- **WYSIWYG Editor**: TipTap for rich text editing.
- **Visual Theme**: Light mode only, using Primary #002073 and Accent #e3001b. Layouts are full-width with dynamic padding and a collapsible sidebar.
- **UI/UX Decisions**: Emphasizes unified campaign card layouts, always-editable text fields, iframe dialog for previews, instant version switching, and a database selector card in the campaign editor.
- **Placeholder System**: Standardized placeholders (`{{ASUNTO}}`, `{{PREHEADER}}`, `{{CONTENIDO}}`, `{{CTA_TEXTO}}`, `{{CTA_URL}}`, `{{IMAGEN_URL}}`) for dynamic content.

### Backend
- **Framework**: Express.js (Node.js).
- **Authentication**: `bcryptjs` for hashing and `express-session` with `connect-pg-simple` for session management.
- **API Design**: RESTful API with Zod-based validation for all endpoints. Covers authentication, CRUD operations, and AI-driven generation/editing.
- **Security**: Implements rate limiting, HTML sanitization, input validation, and data ownership checks.
- **Concurrency**: OpenAI (text) and Gemini (image) generation run in parallel.

### Data Management
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Includes tables for `users`, `campaigns`, `campaign_versions`, `contact_databases`, `contacts`, `brand_identity`, and `templates`.
- **Versioning**: Supports up to 3 versions per campaign and template for comparison.
- **AI Integration**:
    - **OpenAI**: Uses `gpt-4.1-mini` for text generation with Structured Outputs, leveraging brand identity and conversational history. Includes retry logic and refusal handling.
    - **Gemini**: Uses `gemini-3.1-flash-image-preview` for image generation (16:9 aspect ratio) and multimodal editing. Features automatic failsafe to `gemini-2.0-flash` upon primary model failure.
- **Contacts System**: Manages contact data with validation and deduplication on import.
- **Admin Panel**: Provides user management, activity logs, platform statistics, and impersonation functionality.

### Core Features
- **Calendar**: Displays campaigns with status indicators and image thumbnails.
- **CSV/XLSX Import**: Supports contact data import with automatic delimiter detection and column mapping.
- **Smart Template Analysis**: AI-powered analysis for uploaded HTML templates, identifying existing elements and inserting `{{CONTENIDO}}` intelligently.
- **Locked Fields System**: Templates store `lockedFields` to disable editing of pre-built elements in the campaign editor, guiding AI generation.
- **Standardized Template Structure**: All AI-generated templates follow a fixed block order (Header, Hero Image, Content, CTA Button, Footer), ensuring consistent design. AI can only customize cosmetic aspects.
- **Optimized AI Prompts**: Prompts are tailored for template generation and campaign content, utilizing brand identity and copywriting data.
- **Manual Text Editing**: Supports inline text editing within AI-generated templates, grouping text nodes for a cleaner experience.
- **Confirmed Template Lockdown**: AI editing buttons are hidden once a template is confirmed.
- **Email Verification**: New users verify email via a webhook to Brevo before platform access.
- **Logo Auto-Conversion**: Uploaded logos (JPEG/WebP) are automatically converted to PNG for transparency.
- **Email Provider Infrastructure**: Users connect their own Brevo (and future Mailchimp) accounts via API key, with encrypted credentials.
- **Security Headers**: `helmet` is used for HTTP security headers, with specific policies disabled to allow email preview iframes.
- **Validation & Security**: Enforces content approval, prevents modification of sent campaigns, and includes input validations.
- **API 404 Catch-All**: Unknown `/api/*` routes return 404 JSON.
- **Gemini Retry**: All Gemini API calls include automatic retry with exponential backoff.
- **Campaign Send Tracking**: Per-contact tracking for campaigns, updating status via Brevo webhooks and broadcasting progress via WebSocket.
- **Progressive Onboarding**: Sidebar sections unlock progressively as users complete steps, guided by "Siguiente" navigation buttons.

### Gotchas / cosas raras conocidas
Comportamientos no obvios, decisiones contraintuitivas y trampas del proyecto. **Leer antes de tocar áreas relacionadas.**

- **`SESSION_SECRET` también encripta API keys de proveedores.** El secret no solo firma cookies de sesión: `server/encryption.ts` lo usa para derivar la clave AES-256-GCM con la que se cifran las API keys de Brevo/Mailchimp guardadas en la DB. **Rotar el secret rompe todas las conexiones existentes** y los usuarios deben reconectar sus proveedores. En migraciones entre cuentas Replit hay que conservar el mismo valor.
- **Webhook de Make.com con fallback hardcodeado peligroso.** En `server/routes.ts` (líneas 358 y 497), si `MAKE_VERIFICATION_WEBHOOK_URL` no está seteada, el código cae a una URL hardcodeada del proyecto original (`hook.eu2.make.com/0ifmac54kwkvgc85hlyq8nuxdfl15spu`). En cualquier deploy nuevo (cuenta Replit nueva, cliente nuevo) hay que setear la variable explícitamente para no enviar tráfico al webhook de otra organización.
- **No existe carpeta `migrations/`.** Drizzle Kit hace push directo del schema con `npm run db:push`. No hay archivos `.sql` versionados. Si un cambio destructivo lo requiere, usar `npm run db:push --force`.
- **Cookies seguras solo en producción.** `server/index.ts:123` activa `cookie.secure = true` solo cuando `NODE_ENV === "production"`. En dev las cookies viajan por HTTP. No cambiar esto sin entender el impacto en el login local.
- **`trust proxy` siempre habilitado.** Necesario para que Replit y Coolify reenvíen correctamente el IP real y el protocolo. No deshabilitar.
- **Carpeta `uploads/` no está en Git.** Logos de marca y imágenes de campañas (patrón `campaign_{id}_{hex}.{ext}`) se guardan en disco en `uploads/campaigns/` y `uploads/logos/`. Al migrar entornos, los archivos viejos se pierden a menos que se descarguen manualmente. En producción el VPS persiste esta carpeta como volumen Docker.
- **Seed automático en producción.** `server/seed.ts` corre en el primer boot cuando `NODE_ENV=production`, creando usuarios admin/demo iniciales. En dev no se ejecuta.
- **Body limit de 25MB.** Necesario porque las imágenes subidas viajan en base64 dentro del JSON del request (logos de marca, uploads manuales para NanoBanano). Si se baja, rompe el upload de imágenes.
- **Regen limits hardcodeados.** Texto e imagen permiten 1 versión original + 2 regeneraciones = 3 versiones máximo por campaña. NanoBanano comparte el contador `imageRegenCount` con "Regenerar Imagen". Los botones se ocultan completamente al llegar al límite (no se deshabilitan).
- **`MAKE_WEBHOOK_SECRET` declarado en dos lugares.** Aparece tanto en `.replit` (`[userenv.shared]`) como en `.env.example` / Secrets. Cualquiera funciona, pero ambos deben coincidir con lo configurado en Make.com.
- **Verificación de email tiene fallback de polling.** Mientras el usuario espera el correo, la pantalla `pending-verification` hace polling cada 3s a `/api/auth/verification-status/{email}` y autologuea cuando detecta verificación. Es por diseño, no es un bug.
- **OpenAI usa Responses API, no chat.completions.** `server/openai.ts` invoca `client.responses.create` con Structured Outputs y `store: false`. No portar a chat.completions sin entender el impacto.
- **Sidebar bloqueado por nivel de onboarding.** Las secciones del sidebar tienen `requiresLevel` y se muestran con candado hasta que el usuario complete los pasos previos. La lógica vive en `client/src/components/Layout.tsx:34-68`. No tocar el orden sin actualizar también `getOnboardingLevel`.
- **Sin migrations + DB de producción separada.** Como la DB de prod vive en VPS y se sincroniza con `db:push --force` desde el deploy, hay que tener cuidado de no introducir cambios destructivos al schema sin coordinar con el deploy.

### Deployment & Production
- **Deployment Target**: VM for WebSocket and campaign scheduler support.
- **Build Process**: `esbuild` for backend, `Vite` for frontend.
- **Production Run**: `node ./dist/index.cjs` serves both API and static frontend.
- **Database Seed**: `server/seed.ts` auto-seeds production DB on first boot.
- **Uploads**: Campaign images and logos stored in `uploads/` and served statically.
- **Session Security**: Secure cookies and `trust proxy` enabled for Replit.

#### Coolify — Volumen persistente para imágenes (CRÍTICO)
Las imágenes generadas por IA se guardan en `/app/uploads/` dentro del contenedor Docker. Sin un volumen persistente, **cada redeploy borra todas las imágenes** y las URLs de campañas antiguas quedan rotas.

**Configuración requerida en Coolify:**
1. Ir a Coolify → Service → la aplicación → pestaña **Volumes** (o "Persistent Storage").
2. Confirmar que existe un volumen con:
   - **Container path**: `/app/uploads`
   - **Host path**: un directorio persistente del host (ej. `/data/postialo/uploads` o el que asigne Coolify).
3. Si no existe, crearlo y hacer redeploy.

**Cómo verificar después de un redeploy:**
- Abrir `https://<dominio>/api/health/storage` → debe retornar `"writable": true` y `"fileCount"` > 0 (si ya había imágenes antes).
- Si `fileCount` es 0 inesperadamente, el volumen no está montado o se montó vacío — restaurar archivos desde backup o remontarlo correctamente.
- Los logs de arranque del servidor también muestran `[STORAGE WARNING]` si el directorio está vacío en producción.

**Prueba de persistencia manual:**
1. Crear una campaña con imagen generada por IA.
2. Verificar que la imagen se ve correctamente en `/uploads/campaigns/<archivo>`.
3. Hacer un redeploy completo desde Coolify.
4. Verificar que la misma URL de imagen sigue funcionando después del redeploy.

## External Dependencies
- **PostgreSQL**: Primary database.
- **OpenAI API**: AI text generation and template analysis.
- **Google Gemini API**: AI image generation and advanced image editing.
- **Brevo API**: Direct campaign email sending and delivery tracking.
- **Make.com Webhook**: User registration email verification.
- **bcryptjs**: Password hashing.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **TipTap**: WYSIWYG editor.
- **Framer Motion**: Frontend animations.
- **Wouter**: Client-side routing.
- **Recharts**: Dashboard charting library.
- **Lucide React / React Icons**: Icon libraries.
- **express-rate-limit**: API rate limiting.
- **Drizzle ORM**: PostgreSQL ORM.
- **Zod**: Schema validation.