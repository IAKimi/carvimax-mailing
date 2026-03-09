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
El frontend está construido con datos mock (sin base de datos real conectada). El storage usa MemStorage en memoria. No hay dark mode (solo light mode).

## Estructura del Proyecto
```
client/src/
├── pages/
│   ├── Login.tsx          - Pantalla de inicio de sesión
│   ├── Home.tsx           - Bienvenida + 2 dropdowns (Mi Producto / ¿Cómo funciona?)
│   ├── BrandIdentity.tsx  - 2 dropdowns colapsados por defecto (Mi Empresa / Lineamientos y Branding)
│   ├── CalendarView.tsx   - Centro de trabajo: calendario + editor + selector de base de datos
│   ├── Templates.tsx      - Galería de plantillas HTML
│   ├── MyEmails.tsx       - Historial de correos enviados/programados (solo lectura)
│   ├── Contacts.tsx       - Base de Datos: CRUD de bases con contactos, edición inline
│   ├── CampaignEditor.tsx - Editor de campaña individual (legacy, no en nav)
│   └── not-found.tsx      - 404
├── components/
│   ├── Layout.tsx         - Sidebar colapsable (icons-only → hover expande) + header
│   ├── AnimatedCard.tsx   - Card con animaciones
│   ├── TipTapEditor.tsx   - Editor WYSIWYG
│   └── ui/               - Componentes Shadcn (collapsible, separator, alert-dialog, etc.)
├── hooks/                 - Custom hooks
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
1. Login → Home (bienvenida con 2 dropdowns: "Mi Producto" y "¿Cómo funciona?")
2. Identidad de Marca → 2 dropdowns colapsados: "Mi Empresa" y "Lineamientos y Branding"
3. Calendario (centro de trabajo):
   - Clic en día vacío → popup "Nuevo Correo" (Idea, Objetivo, Plantilla, Base de Datos destino, Fecha+Hora)
   - Clic en día con correo → opción "Nuevo Correo" o "Editar correo existente"
   - Editor: imagen + texto con preview colapsable
   - "Publicar Ahora": visible cuando imagen Y texto aprobados
4. Historial → solo lista de correos enviados/programados (sin edición)
5. Plantillas → galería HTML
6. Base de Datos:
   - Bases agrupadas con nombre, expandibles con contactos
   - Botón "Eliminar" base de datos (con confirmación)
   - 3 botones de acción: "Editar" (inline), "Añadir a Base de Datos", "Sobreescribir Base de Datos"
   - Edición inline de contactos (nombre, email, país, segmento)

## Sidebar
- Desktop: colapsable con hover. Por defecto muestra solo iconos (4.5rem). Al pasar el cursor se expande (16rem) con labels.
- Mobile: hamburger menu clásico con overlay
- No hay dark mode toggle

## Tema Visual
- Primary (azul PostIAlo): #002073 / hsl(223 100% 23%)
- Accent/Secondary (rojo PostIAlo): #e3001b / hsl(353 100% 45%)
- Solo light mode (no dark mode)
- Sidebar: fondo azul oscuro #002073 con texto blanco
- Branding: "Post" + "IA" en rojo + "lo" + " Mail" en blanco (no gris)
- Font: Inter
- Border radius: 12-16px (rounded-xl/2xl)
- Auth: Mock via localStorage ("postIAlo_auth", "postIAlo_user")

## Notas Técnicas
- TipTap: import `{ TextStyle }` from `@tiptap/extension-text-style`, `{ Color }` from `@tiptap/extension-color`
- Templates page uses `<iframe srcDoc>` for HTML previews
- All UI text in Spanish
- CalendarView: datetime-local, selector de base de datos destino, botón "Publicar Ahora"
- Vista previa del correo: botón toggle con animación
- BrandIdentity: dropdowns colapsados por defecto
- Contacts: AlertDialog para confirmación de eliminación, edición inline de contactos

## Fases Futuras (Pendientes)
- **Fase 2**: Conectar PostgreSQL real, autenticación real (Google OAuth)
- **Fase 3**: Integración con IA (OpenAI/Gemini para generación de contenido e imágenes)
- **Fase 3.5**: Integración con Nano Banana para edición de imágenes
- **Fase 4**: Integración con Make.com (webhooks), Cloudinary (imágenes), Brevo (envío)
- **Fase 4.5**: Envío automático por webhook al llegar la fecha/hora programada
- **Fase 5**: Dashboard con métricas reales, WebSockets para feedback en tiempo real
