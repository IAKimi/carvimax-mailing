# PostIAlo Mail - SaaS de Email Marketing con IA

## Descripción
Plataforma SaaS de automatización de correos electrónicos con inteligencia artificial. Inspirada en PostIAlo (plataforma existente para redes sociales), adaptada para email marketing.

## Stack Técnico
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Base de Datos**: PostgreSQL (Drizzle ORM) - conectada con DatabaseStorage
- **Autenticación**: bcryptjs (hash de contraseñas) + express-session (sesiones en PostgreSQL via connect-pg-simple)
- **IA / Texto**: OpenAI Responses API (modelo gpt-4.1-mini con Structured Outputs)
- **IA / Imágenes**: Gemini API (modelo gemini-3.1-flash-image-preview / Nano Banana 2 con responseModalities IMAGE)
- **Editor WYSIWYG**: TipTap
- **Animaciones**: Framer Motion
- **Routing**: Wouter
- **Iconos**: Lucide React + React Icons (SI)

## Estado Actual
Todas las features conectadas a PostgreSQL. Autenticación real. Generación de imágenes con Gemini API integrada. Generación de texto con OpenAI Responses API integrada. Regeneración de texto con historial conversacional (correcciones del usuario). Regeneración de imagen con nuevo prompt. Edición de imagen con Nano Banana (image-to-image via Gemini). Cancelación de campañas (soft delete, status "cancelled"). Tags de estado calculados (Cancelado, Enviado, Listo, Generado, Programado, Borrador). Barra de progreso basada en aprobaciones (0%/50%/100%). Calendario, Contactos, Identidad de Marca, Plantillas e Historial todos usan datos reales. Solo light mode.

## Estructura del Proyecto
```
client/src/
├── pages/
│   ├── Login.tsx          - Login + Registro (toggle entre ambos)
│   ├── Home.tsx           - Bienvenida + 2 dropdowns (usa API para nombre de usuario)
│   ├── BrandIdentity.tsx  - 2 dropdowns (Mi Empresa / Lineamientos) — datos de API
│   ├── CalendarView.tsx   - Centro de trabajo: calendario + editor + Gemini/OpenAI AI + modales regeneración
│   ├── Templates.tsx      - Galería de plantillas HTML — datos de API
│   ├── MyEmails.tsx       - Historial de correos (sent/scheduled) — datos de API
│   ├── Contacts.tsx       - Bases de contactos con CRUD — datos de API
│   ├── CampaignEditor.tsx - Editor de campaña individual (ruta /campaigns/:id)
│   └── not-found.tsx      - 404
├── components/
│   ├── Layout.tsx         - Sidebar colapsable (module-level hover state, API para nombre)
│   ├── AnimatedCard.tsx   - Card con animaciones
│   ├── TipTapEditor.tsx   - Editor WYSIWYG
│   └── ui/               - Componentes Shadcn
├── hooks/
│   ├── use-campaigns.ts   - Hooks para CampaignEditor
│   └── use-campaign-versions.ts - Hooks: generate, update, regenerateText, regenerateImage, editImage
└── lib/                   - Utilidades (queryClient, utils)

server/
├── db.ts       - Conexión PostgreSQL (pg + drizzle-orm)
├── gemini.ts   - Integración Gemini API (generación + edición de imágenes)
├── openai.ts   - Integración OpenAI Responses API (generación + regeneración de texto)
├── routes.ts   - API endpoints (auth + CRUD + generación IA dual + regeneración + edición imagen)
├── storage.ts  - DatabaseStorage (PostgreSQL real, todas las operaciones)
└── index.ts    - Server + session middleware

shared/
├── schema.ts   - Modelos de datos (Drizzle + Zod) — 7 tablas
└── routes.ts   - Contrato API (incluyendo regenerateText, regenerateImage, editImage)

docs/
└── gemini-context-prompt.md - Prompt para NotebookLM (configuración Gemini API)
```

## Variables de Entorno
- `DATABASE_URL` — conexión PostgreSQL (auto-configurada)
- `SESSION_SECRET` — secreto para sesiones express
- `OPENAI_API_KEY` — clave API de OpenAI (requerida para generación de texto)
- `GEMINI_API_KEY` — clave API de Google Gemini (requerida para generación de imágenes)

## Base de Datos (PostgreSQL)
### Tablas
- **users**: id, name, email (unique), password (bcrypt hash), company
- **campaigns**: id, userId, name, idea, objective, tone, status, layoutPreference, imagePrompt, targetDatabase, scheduledAt, createdAt
- **campaign_versions**: id, campaignId, versionNumber, contentJson (JSONB), imageUrl (text — puede ser URL o data:base64), isSelected, createdAt
- **contact_databases**: id, userId, name, createdAt
- **contacts**: id, userId, databaseId, email, name, country, segment, createdAt
- **brand_identity**: id, userId (unique), companyName, industry, website, whatsapp, mission, vision, products, history, styleGuide, targetAudience, tone, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, updatedAt
- **templates**: id, userId, name, html, favorite, createdAt
- **session** (auto-created by connect-pg-simple)

### API de Autenticación
- `POST /api/auth/register` — { name, email, password, company? } → crea usuario, inicia sesión
- `POST /api/auth/login` — { email, password } → valida credenciales, inicia sesión
- `GET /api/auth/me` — devuelve usuario actual o 401
- `POST /api/auth/logout` — destruye sesión

### API de Datos
- `GET/POST /api/campaigns` — listar/crear campañas (auto-status "scheduled" si tiene scheduledAt)
- `GET/PATCH /api/campaigns/:id` — obtener/actualizar campaña
- `GET /api/campaigns/:id/versions` — versiones de campaña
- `POST /api/campaigns/:id/generate` — generar versión con Gemini AI (imagen) + OpenAI (texto) en paralelo
- `POST /api/campaigns/:id/regenerate-text` — regenerar texto con correcciones del usuario (historial conversacional OpenAI)
- `POST /api/campaigns/:id/regenerate-image` — regenerar imagen con nuevo prompt (nueva generación Gemini)
- `POST /api/campaigns/:id/edit-image` — editar imagen existente con Nano Banana (image-to-image Gemini)
- `PATCH /api/versions/:id` — actualizar versión (con ownership check)
- `GET/POST /api/contact-databases` — listar/crear bases de contactos
- `DELETE /api/contact-databases/:id` — eliminar base de contactos
- `GET /api/contact-databases/:id/contacts` — listar contactos
- `POST /api/contact-databases/:id/contacts` — crear contacto
- `PATCH /api/contacts/:id` — actualizar contacto
- `DELETE /api/contacts/:id` — eliminar contacto
- `GET /api/brand-identity` — obtener identidad de marca del usuario
- `PUT /api/brand-identity` — crear/actualizar identidad de marca (upsert)
- `GET /api/templates` — listar plantillas del usuario
- `POST /api/templates` — crear plantilla
- `PATCH /api/templates/:id` — actualizar plantilla
- `DELETE /api/templates/:id` — eliminar plantilla

## Flujo de Generación de Texto con OpenAI
1. POST /api/campaigns/:id/generate lee la brand_identity del usuario
2. Arma el campo `instructions` (developer): prompt de copywriter + identidad de marca completa + reglas estrictas
3. Arma el campo `input` (user): "Idea: [idea]\nObjetivo: [objetivo]"
4. Llama `openai.responses.create()` con modelo `gpt-4.1-mini`
5. Structured Output (`text.format = json_schema`): devuelve `{ asunto, preheader, cuerpo_html, cta_text }`
6. Se guarda en campaign_versions.contentJson
7. Si no hay OPENAI_API_KEY → usa texto placeholder
8. Prompt Caching: la identidad de marca (estática) va primero para aprovechar el cache automático de OpenAI

## Flujo de Regeneración de Texto con OpenAI
1. POST /api/campaigns/:id/regenerate-text recibe `{ corrections: string }`
2. Lee la versión seleccionada actual → extrae contentJson como `previousEmailJson`
3. Llama `regenerateEmailContent()` con historial conversacional:
   - input[0]: { role: "user", content: "Idea: X\nObjetivo: Y" }
   - input[1]: { role: "assistant", content: JSON.stringify(previousEmailJson) }
   - input[2]: { role: "user", content: "Correcciones: [lo que pidió el usuario]" }
4. Mismo schema de Structured Outputs, mismas instrucciones de marca
5. Se guarda como nueva versión con la imagen de la versión anterior

## Flujo de Generación de Imágenes con Gemini
1. Usuario llena "Prompt de Imagen" en el formulario del calendario
2. POST /api/campaigns/:id/generate → envía imagePrompt a Gemini
3. Configuración: responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" }
4. Gemini devuelve imagen en base64 (inlineData)
5. Se guarda como data URL en campaign_versions.imageUrl

## Flujo de Regeneración de Imagen con Gemini
1. POST /api/campaigns/:id/regenerate-image recibe `{ imagePrompt: string }`
2. Genera imagen completamente nueva con el nuevo prompt (misma llamada que la generación inicial)
3. Se guarda como nueva versión con el texto de la versión anterior

## Flujo de Edición de Imagen con Nano Banana (Image-to-Image)
1. POST /api/campaigns/:id/edit-image recibe `{ editPrompt: string }`
2. Lee la imagen actual de la versión seleccionada (base64 data URL)
3. Envía a Gemini con inline_data (la imagen original) + text (instrucciones de edición)
4. Gemini aplica edición semántica manteniendo el contexto visual
5. Se guarda como nueva versión con el texto de la versión anterior

## Modales de Regeneración en CalendarView
- **Regenerar Texto**: modal con idea/objetivo original (read-only), último ajuste enviado, textarea de correcciones
- **Regenerar Imagen**: modal con prompt original (read-only), textarea con nuevo prompt (pre-llenado con el original)
- **Editar con Nano Banana**: modal con preview de imagen actual, textarea de instrucciones de edición, tip sobre límites de texto

## Sidebar
- Desktop: colapsable con hover (module-level variable persiste estado entre remounts)
- Mobile: hamburger menu con overlay
- Nombre de usuario obtenido de GET /api/auth/me (no localStorage)

## Tema Visual
- Primary (azul PostIAlo): #002073
- Accent (rojo PostIAlo): #e3001b
- Solo light mode
- Sidebar: fondo azul oscuro #002073 con texto blanco
- Branding: "Post" + "IA" en rojo + "lo" + " Mail"
- Botones de regenerar: azul (#2563eb)
- Botón Nano Banana: amber (#f59e0b)
- Botones de aprobar: verde esmeralda

## Notas Técnicas
- Sesiones: express-session + connect-pg-simple
- Contraseñas: bcryptjs con salt factor 10
- ProtectedRoute verifica sesión con GET /api/auth/me
- localStorage: solo `postIAlo_auth` como fast UI guard (la verificación real es /api/auth/me)
- TipTap: `{ TextStyle }` from `@tiptap/extension-text-style`, `{ Color }` from `@tiptap/extension-color`
- All UI text in Spanish
- OpenAI: Responses API con openai.responses.create(), modelo gpt-4.1-mini, Structured Outputs json_schema
- OpenAI: max_output_tokens=800, temperature=0.7 (gpt-4.1-mini es ejecución directa, no razonamiento)
- OpenAI: Pivote de gpt-5-mini (razonamiento) a gpt-4.1-mini (ejecución directa) por velocidad y costo
- OpenAI: retry automático (1 reintento) si response.status === "incomplete"
- OpenAI: safe JSON parsing con validación de campos requeridos
- OpenAI: protección contra refusals — si Structured Outputs devuelve campo refusal, muestra error amigable
- OpenAI regeneración: usa historial conversacional con array de messages [{role, content}] en campo input
- OpenAI env var: se lee con process.env.OPENAI_API_KEY en runtime (no al cargar módulo)
- OpenAI contentJson: { asunto, preheader, cuerpo_html, cta_text }
- Gemini: usa modelo gemini-3.1-flash-image-preview (Nano Banana 2)
- Gemini generación: responseModalities ["IMAGE"], imageConfig aspectRatio "16:9"
- Gemini edición: inline_data con imagen en base64 + text con instrucciones, mismo modelo y endpoint
- Gemini safety: manejo de finishReason (SAFETY, RECITATION, PROHIBITED_CONTENT), promptFeedback.blockReason, safetyRatings.blocked
- Gemini request body: snake_case; response parsing: camelCase
- Generación dual: OpenAI (texto) y Gemini (imagen) se ejecutan en paralelo con Promise.all
- Loading overlay: pantalla de carga "Generando tu correo con IA..." mientras ambos resultados (texto+imagen) están pendientes
- Límite: máximo 3 versiones por campaña

## Fases Futuras (Pendientes)
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 4.5**: Envío automático por webhook al llegar la fecha/hora programada
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
