# PostIAlo Mail - SaaS de Email Marketing con IA

## Descripción
Plataforma SaaS de automatización de correos electrónicos con inteligencia artificial. Inspirada en PostIAlo (plataforma existente para redes sociales), adaptada para email marketing.

## Stack Técnico
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Base de Datos**: PostgreSQL (Drizzle ORM) - pendiente de conexión real
- **Editor WYSIWYG**: TipTap
- **Animaciones**: Framer Motion
- **Gráficos**: Recharts
- **Routing**: Wouter
- **Iconos**: Lucide React + React Icons (SI)

## Estado Actual: Fase 1 - Frontend
El frontend está construido con datos mock (sin base de datos real conectada). El storage usa MemStorage en memoria.

## Estructura del Proyecto
```
client/src/
├── pages/
│   ├── Login.tsx          - Pantalla de inicio de sesión
│   ├── Home.tsx           - Bienvenida + features + timeline
│   ├── BrandIdentity.tsx  - Configuración de identidad de marca
│   ├── CalendarView.tsx   - Calendario mensual para programar correos
│   ├── Templates.tsx      - Galería de plantillas HTML
│   ├── MyEmails.tsx       - Lista de correos generados + editor
│   ├── Contacts.tsx       - Gestión de contactos
│   ├── CampaignEditor.tsx - Editor de campaña individual
│   └── not-found.tsx      - 404
├── components/
│   ├── Layout.tsx         - Sidebar + header + theme toggle
│   ├── AnimatedCard.tsx   - Card con animaciones
│   ├── TipTapEditor.tsx   - Editor WYSIWYG
│   └── ui/               - Componentes Shadcn
├── hooks/                 - Custom hooks (dashboard, campaigns, contacts, versions)
└── lib/                   - Utilidades (queryClient, utils)

server/
├── routes.ts   - API endpoints (mock data)
├── storage.ts  - MemStorage (datos en memoria)
└── index.ts    - Server entry point

shared/
├── schema.ts   - Modelos de datos (Drizzle + Zod)
└── routes.ts   - Contrato API (paths + validación)
```

## Flujo de Usuario
1. Login → Home (bienvenida)
2. Identidad de Marca → configurar empresa, colores, tipografías
3. Calendario → clic en día → popup para crear correo (Idea, Objetivo, Selector de Plantilla, Fecha de Programación)
4. Mis Correos → lista de correos generados, editor TipTap, versiones (hasta 3)
5. Plantillas → galería HTML, cargar nuevas plantillas
6. Contactos → tabla de contactos con segmentación

## Tema Visual
- Primary (azul PostIAlo): #002073 / hsl(223 100% 23%)
- Accent/Secondary (rojo PostIAlo): #e3001b / hsl(353 100% 45%)
- Blanco como fondo principal en light mode
- Sidebar: fondo azul oscuro #002073 con texto blanco
- Branding: "Post" en foreground, "IA" en rojo #e3001b, "lo" en foreground, ".mail" en azul/tenue
- Font: Inter
- Border radius: 12-16px (rounded-xl/2xl)
- Dark mode: toggle in header, persisted via localStorage "theme"
- Auth: Mock via localStorage ("postIAlo_auth", "postIAlo_user")

## Notas Técnicas
- TipTap: import `{ TextStyle }` from `@tiptap/extension-text-style`, `{ Color }` from `@tiptap/extension-color`
- Templates page uses `<iframe srcDoc>` for HTML previews
- Theme bootstrap runs in App.tsx (applies dark class before render)
- Authenticated users are redirected away from /login
- All UI text in Spanish

## Fases Futuras (Pendientes)
- **Fase 2**: Conectar PostgreSQL real, autenticación real (Google OAuth)
- **Fase 3**: Integración con IA (OpenAI/Gemini para generación de contenido e imágenes)
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
