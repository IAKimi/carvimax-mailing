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
PostgreSQL conectada. Autenticación real con registro/login (email + contraseña hasheada). Sesiones persistidas en la base de datos. Frontend con datos mock en Calendario y Contactos (estos se migrarán a la BD en fases futuras). No hay dark mode (solo light mode).

## Estructura del Proyecto
```
client/src/
├── pages/
│   ├── Login.tsx          - Login + Registro (toggle entre ambos)
│   ├── Home.tsx           - Bienvenida + 2 dropdowns (Mi Producto / ¿Cómo funciona?)
│   ├── BrandIdentity.tsx  - 2 dropdowns colapsados por defecto (Mi Empresa / Lineamientos y Branding)
│   ├── CalendarView.tsx   - Centro de trabajo: calendario + editor + 2 botones de imagen
│   ├── Templates.tsx      - Galería de plantillas HTML
│   ├── MyEmails.tsx       - Historial de correos enviados/programados (solo lectura)
│   ├── Contacts.tsx       - Base de Datos: CRUD de bases con contactos, edición inline
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
├── routes.ts   - API endpoints (auth + CRUD)
├── storage.ts  - DatabaseStorage (PostgreSQL real)
└── index.ts    - Server + session middleware

shared/
├── schema.ts   - Modelos de datos (Drizzle + Zod)
└── routes.ts   - Contrato API (paths + validación, usado por hooks del frontend)
```

## Base de Datos (PostgreSQL)
### Tablas
- **users**: id, name, email (unique), password (bcrypt hash), company
- **campaigns**: id, userId, name, idea, objective, tone, status, layoutPreference, scheduledAt, createdAt
- **campaign_versions**: id, campaignId, versionNumber, contentJson (JSONB), imageUrl, isSelected, createdAt
- **contact_databases**: id, userId, name, createdAt
- **contacts**: id, userId, databaseId, email, name, country, segment, createdAt
- **session** (auto-created by connect-pg-simple)

### API de Autenticación
- `POST /api/auth/register` — { name, email, password, company? } → crea usuario, inicia sesión
- `POST /api/auth/login` — { email, password } → valida credenciales, inicia sesión
- `GET /api/auth/me` — devuelve usuario actual o 401
- `POST /api/auth/logout` — destruye sesión

### API de Datos
- `GET/POST /api/campaigns` — listar/crear campañas
- `GET/PATCH /api/campaigns/:id` — obtener/actualizar campaña
- `GET /api/campaigns/:id/versions` — versiones de campaña
- `POST /api/campaigns/:id/generate` — generar versión con IA (mock)
- `PATCH /api/versions/:id` — actualizar versión
- `GET/POST /api/contact-databases` — listar/crear bases de contactos
- `DELETE /api/contact-databases/:id` — eliminar base de contactos
- `GET /api/contact-databases/:id/contacts` — listar contactos
- `POST /api/contact-databases/:id/contacts` — crear contacto
- `PATCH /api/contacts/:id` — actualizar contacto
- `DELETE /api/contacts/:id` — eliminar contacto

## Flujo de Usuario
1. Login/Registro → Home (bienvenida con 2 dropdowns)
2. Identidad de Marca → 2 dropdowns colapsados
3. Calendario (centro de trabajo):
   - Clic en día vacío → popup "Nuevo Correo"
     - Campos: Idea, Objetivo, 2 botones de imagen (Prompt de Imagen / Subir Imagen), Plantilla, Base de Datos destino, Fecha+Hora
     - "Prompt de Imagen": despliega un textarea para escribir prompt de IA
     - "Subir Imagen": abre explorador de archivos del usuario
   - Clic en día con correo → opción "Nuevo Correo" o "Editar existente"
   - Editor: imagen + texto con preview colapsable
   - "Publicar Ahora": visible cuando imagen Y texto aprobados
4. Historial → lista de correos enviados/programados (solo lectura)
5. Plantillas → galería HTML
6. Base de Datos → bases con contactos, edición inline, confirmación de eliminación

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

## Fases Futuras (Pendientes)
- **Fase 3**: Integración con IA (OpenAI/Gemini para generación de contenido e imágenes)
- **Fase 3.5**: Integración con Nano Banana para edición de imágenes
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 4.5**: Envío automático por webhook al llegar la fecha/hora programada
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
