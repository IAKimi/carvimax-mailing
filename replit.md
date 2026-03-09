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
│   ├── BrandIdentity.tsx  - Configuración de identidad de marca (con barra de progreso semáforo)
│   ├── CalendarView.tsx   - Centro de trabajo: calendario + editor de imagen/texto/preview
│   ├── Templates.tsx      - Galería de plantillas HTML
│   ├── MyEmails.tsx       - Historial de correos enviados/programados (solo lectura)
│   ├── Contacts.tsx       - Gestión de contactos
│   ├── CampaignEditor.tsx - Editor de campaña individual (legacy, no en nav)
│   └── not-found.tsx      - 404
├── components/
│   ├── Layout.tsx         - Sidebar azul + header + theme toggle
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
2. Identidad de Marca → configurar empresa, colores, tipografías (barra de progreso tipo semáforo)
3. Calendario (centro de trabajo):
   - Clic en día vacío → popup "Nuevo Correo" (Idea, Objetivo, Plantilla, Fecha)
   - Clic en día con correo → opción "Nuevo Correo" o "Editar correo existente"
   - Al editar: panel con editor de imagen (regenerar/cargar/Nano Banana/historial/aprobar) y editor de texto (TipTap/regenerar/historial/aprobar) + vista previa del correo completo
4. Historial → solo lista de correos enviados/programados (sin edición)
5. Plantillas → galería HTML, cargar nuevas plantillas
6. Contactos → tabla de contactos con segmentación

## Tema Visual
- Primary (azul PostIAlo): #002073 / hsl(223 100% 23%)
- Accent/Secondary (rojo PostIAlo): #e3001b / hsl(353 100% 45%)
- Blanco como fondo principal en light mode
- Sidebar: fondo azul oscuro #002073 con texto blanco
- Branding: "Post" en foreground, "IA" en rojo #e3001b, "lo" en foreground, " Mail" en tenue
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
- CalendarView maneja todo el flujo de creación/edición de correos
- MyEmails es solo histórico (read-only)

## Fases Futuras (Pendientes)
- **Fase 2**: Conectar PostgreSQL real, autenticación real (Google OAuth)
- **Fase 3**: Integración con IA (OpenAI/Gemini para generación de contenido e imágenes)
- **Fase 3.5**: Integración con Nano Banana para edición de imágenes
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
