# PostIAlo Mail - SaaS de Email Marketing con IA

## Descripción
Plataforma SaaS de automatización de correos electrónicos con inteligencia artificial. Inspirada en PostIAlo (plataforma existente para redes sociales), adaptada para email marketing.

## Stack Técnico
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Base de Datos**: PostgreSQL (Drizzle ORM) - conectada con DatabaseStorage
- **Autenticación**: bcryptjs (hash de contraseñas) + express-session (sesiones en PostgreSQL via connect-pg-simple)
- **Editor WYSIWYG**: TipTap
- **Animaciones**: Framer Motion
- **Gráficos**: Recharts
- **Routing**: Wouter
- **Iconos**: Lucide React + React Icons (SI)

## Estado Actual
Todas las features conectadas a PostgreSQL. Autenticación real con registro/login. Sesiones persistidas en BD. Calendario, Contactos, Identidad de Marca, Plantillas e Historial todos usan datos reales del servidor. No hay dark mode (solo light mode).

## Estructura del Proyecto
```
client/src/
├── pages/
│   ├── Login.tsx          - Login + Registro (toggle entre ambos)
│   ├── Home.tsx           - Bienvenida + 2 dropdowns (Mi Producto / ¿Cómo funciona?)
│   ├── BrandIdentity.tsx  - 2 dropdowns (Mi Empresa / Lineamientos) — datos de API
│   ├── CalendarView.tsx   - Centro de trabajo: calendario + editor — datos de API
│   ├── Templates.tsx      - Galería de plantillas HTML — datos de API
│   ├── MyEmails.tsx       - Historial de correos (sent/scheduled) — datos de API
│   ├── Contacts.tsx       - Bases de contactos con CRUD — datos de API
│   ├── CampaignEditor.tsx - Editor de campaña individual (legacy, no en nav)
│   └── not-found.tsx      - 404
├── components/
│   ├── Layout.tsx         - Sidebar colapsable (module-level hover state) + header
│   ├── AnimatedCard.tsx   - Card con animaciones
│   ├── TipTapEditor.tsx   - Editor WYSIWYG
│   └── ui/               - Componentes Shadcn
├── hooks/                 - Custom hooks
└── lib/                   - Utilidades (queryClient, utils)

server/
├── db.ts       - Conexión PostgreSQL (pg + drizzle-orm)
├── routes.ts   - API endpoints (auth + CRUD completo)
├── storage.ts  - DatabaseStorage (PostgreSQL real, todas las operaciones)
└── index.ts    - Server + session middleware

shared/
├── schema.ts   - Modelos de datos (Drizzle + Zod) — 7 tablas
└── routes.ts   - Contrato API
```

## Base de Datos (PostgreSQL)
### Tablas
- **users**: id, name, email (unique), password (bcrypt hash), company
- **campaigns**: id, userId, name, idea, objective, tone, status, layoutPreference, imagePrompt, targetDatabase, scheduledAt, createdAt
- **campaign_versions**: id, campaignId, versionNumber, contentJson (JSONB), imageUrl, isSelected, createdAt
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
- `GET/POST /api/campaigns` — listar/crear campañas
- `GET/PATCH /api/campaigns/:id` — obtener/actualizar campaña (PATCH acepta status)
- `GET /api/campaigns/:id/versions` — versiones de campaña
- `POST /api/campaigns/:id/generate` — generar versión con IA (mock)
- `PATCH /api/versions/:id` — actualizar versión
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
- `PATCH /api/templates/:id` — actualizar plantilla (favorite toggle, etc.)
- `DELETE /api/templates/:id` — eliminar plantilla

## Flujo de Usuario
1. Login/Registro → Home (bienvenida con 2 dropdowns)
2. Identidad de Marca → 2 dropdowns colapsados, datos guardados en BD
3. Calendario (centro de trabajo):
   - Clic en día vacío → popup "Nuevo Correo"
     - Campos: Idea, Objetivo, 2 botones de imagen (Prompt de Imagen / Subir Imagen), Plantilla (del API), Base de Datos destino (del API), Fecha+Hora
   - Clic en día con correo → opción "Nuevo Correo" o "Editar existente"
   - Editor: imagen + texto con preview colapsable, versiones desde BD
   - "Publicar Ahora": visible cuando imagen Y texto aprobados, actualiza status a "sent"
4. Historial → lista de correos enviados/programados filtrados desde campañas reales
5. Plantillas → galería HTML con CRUD completo, favoritos
6. Base de Datos → bases con contactos, edición inline, agregar contactos, confirmación de eliminación

## Sidebar
- Desktop: colapsable con hover (module-level variable persiste estado entre remounts). Icons-only (4.5rem) → hover expande (16rem).
- Mobile: hamburger menu con overlay
- Logout llama al endpoint real POST /api/auth/logout

## Tema Visual
- Primary (azul PostIAlo): #002073
- Accent (rojo PostIAlo): #e3001b
- Solo light mode
- Sidebar: fondo azul oscuro #002073 con texto blanco
- Branding: "Post" + "IA" en rojo + "lo" + " Mail" en blanco
- Border radius: rounded-xl/2xl

## Notas Técnicas
- Sesiones: express-session + connect-pg-simple (almacenadas en PostgreSQL)
- Contraseñas: bcryptjs con salt factor 10
- ProtectedRoute (App.tsx): verifica sesión con GET /api/auth/me antes de renderizar
- TipTap: `{ TextStyle }` from `@tiptap/extension-text-style`, `{ Color }` from `@tiptap/extension-color`
- All UI text in Spanish
- CalendarView: 2 botones de imagen (prompt IA / subir archivo), mutuamente excluyentes
- Plantilla y BD destino en calendario usan datos reales del usuario (GET /api/templates, GET /api/contact-databases)

## Fases Futuras (Pendientes)
- **Fase 3**: Integración con IA (OpenAI/Gemini para generación de contenido e imágenes)
- **Fase 3.5**: Integración con Nano Banana para edición de imágenes
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 4.5**: Envío automático por webhook al llegar la fecha/hora programada
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
