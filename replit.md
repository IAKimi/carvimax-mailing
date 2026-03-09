# PostIAlo Mail - SaaS de Email Marketing con IA

## Descripción
Plataforma SaaS de automatización de correos electrónicos con inteligencia artificial. Inspirada en PostIAlo (plataforma existente para redes sociales), adaptada para email marketing.

## Stack Técnico
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Base de Datos**: PostgreSQL (Drizzle ORM) - conectada con DatabaseStorage
- **Autenticación**: bcryptjs (hash de contraseñas) + express-session (sesiones en PostgreSQL via connect-pg-simple)
- **IA / Imágenes**: Gemini API (modelo gemini-3.1-flash-image-preview / Nano Banana 2 con responseModalities IMAGE)
- **Editor WYSIWYG**: TipTap
- **Animaciones**: Framer Motion
- **Routing**: Wouter
- **Iconos**: Lucide React + React Icons (SI)

## Estado Actual
Todas las features conectadas a PostgreSQL. Autenticación real. Generación de imágenes con Gemini API integrada (requiere GEMINI_API_KEY). Calendario, Contactos, Identidad de Marca, Plantillas e Historial todos usan datos reales. Solo light mode. Código limpio: sin páginas huérfanas ni datos mock.

## Estructura del Proyecto
```
client/src/
├── pages/
│   ├── Login.tsx          - Login + Registro (toggle entre ambos)
│   ├── Home.tsx           - Bienvenida + 2 dropdowns (usa API para nombre de usuario)
│   ├── BrandIdentity.tsx  - 2 dropdowns (Mi Empresa / Lineamientos) — datos de API
│   ├── CalendarView.tsx   - Centro de trabajo: calendario + editor + Gemini AI
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
│   └── use-campaigns.ts   - Hooks para CampaignEditor
└── lib/                   - Utilidades (queryClient, utils)

server/
├── db.ts       - Conexión PostgreSQL (pg + drizzle-orm)
├── gemini.ts   - Integración Gemini API (generación de imágenes)
├── routes.ts   - API endpoints (auth + CRUD + generación IA)
├── storage.ts  - DatabaseStorage (PostgreSQL real, todas las operaciones)
└── index.ts    - Server + session middleware

shared/
├── schema.ts   - Modelos de datos (Drizzle + Zod) — 7 tablas
└── routes.ts   - Contrato API

docs/
└── gemini-context-prompt.md - Prompt para NotebookLM (configuración Gemini API)
```

## Variables de Entorno
- `DATABASE_URL` — conexión PostgreSQL (auto-configurada)
- `SESSION_SECRET` — secreto para sesiones express
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
- `GET/PATCH /api/campaigns/:id` — obtener/actualizar campaña (PATCH acepta status)
- `GET /api/campaigns/:id/versions` — versiones de campaña
- `POST /api/campaigns/:id/generate` — generar versión con Gemini AI (imagen) + texto placeholder
- `PATCH /api/versions/:id` — actualizar versión (con ownership check)
- `GET/POST /api/contact-databases` — listar/crear bases de contactos
- `DELETE /api/contact-databases/:id` — eliminar base de contactos
- `GET /api/contact-databases/:id/contacts` — listar contactos
- `POST /api/contact-databases/:id/contacts` — crear contacto
- `PATCH /api/contacts/:id` — actualizar contacto (con ownership check)
- `DELETE /api/contacts/:id` — eliminar contacto (con ownership check)
- `GET /api/brand-identity` — obtener identidad de marca del usuario
- `PUT /api/brand-identity` — crear/actualizar identidad de marca (upsert)
- `GET /api/templates` — listar plantillas del usuario
- `POST /api/templates` — crear plantilla
- `PATCH /api/templates/:id` — actualizar plantilla (favorite toggle, etc.)
- `DELETE /api/templates/:id` — eliminar plantilla

## Flujo de Generación de Imágenes con Gemini
1. Usuario llena "Prompt de Imagen" en el formulario del calendario
2. Clic en "Generar Correo" → POST /api/campaigns (guarda imagePrompt)
3. Automáticamente se llama POST /api/campaigns/:id/generate
4. Backend lee campaign.imagePrompt, llama a Gemini API
5. Gemini devuelve imagen en base64
6. Se guarda como data URL en campaign_versions.imageUrl
7. Frontend recibe la versión y renderiza la imagen
8. Si no hay GEMINI_API_KEY, se usa imagen placeholder

## Flujo de Usuario
1. Login/Registro → Home (bienvenida con nombre real del API)
2. Identidad de Marca → 2 dropdowns colapsados, datos guardados en BD
3. Calendario (centro de trabajo):
   - Clic en día vacío → popup "Nuevo Correo"
     - Campos: Idea, Objetivo, Prompt de Imagen / Subir Imagen, Plantilla (del API), BD destino (del API), Fecha+Hora
   - Clic en día con correo → opción "Nuevo Correo" o "Editar existente"
   - Editor: imagen (con loading overlay durante generación IA) + texto con preview colapsable
   - "Cargar Imagen" en editor funciona (abre file picker, muestra preview local)
   - "Publicar Ahora": visible cuando imagen Y texto aprobados
4. Historial → lista de correos enviados/programados
5. Plantillas → galería HTML con CRUD completo, favoritos
6. Base de Datos → bases con contactos, edición inline, agregar contactos

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

## Notas Técnicas
- Sesiones: express-session + connect-pg-simple
- Contraseñas: bcryptjs con salt factor 10
- ProtectedRoute verifica sesión con GET /api/auth/me
- localStorage: solo `postIAlo_auth` como fast UI guard (la verificación real es /api/auth/me)
- TipTap: `{ TextStyle }` from `@tiptap/extension-text-style`, `{ Color }` from `@tiptap/extension-color`
- All UI text in Spanish
- Gemini: usa modelo gemini-3.1-flash-image-preview (Nano Banana 2) con responseModalities ["IMAGE", "TEXT"]

## Fases Futuras (Pendientes)
- **Fase 3.5**: Integración con Nano Banana para edición de imágenes
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 4.5**: Envío automático por webhook al llegar la fecha/hora programada
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
- **Fase 6**: Generación de texto con Gemini (actualmente placeholder)
