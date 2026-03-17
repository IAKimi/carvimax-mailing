# PostIAlo Mailing - SaaS de Email Marketing con IA

## Overview
PostIAlo Mail is an AI-powered email marketing automation SaaS platform designed to streamline email campaign creation and management. It leverages AI for content and image generation, offering a comprehensive tool for users to efficiently design, generate, and manage their email marketing efforts. The project aims to empower users with advanced AI capabilities to create engaging and effective email campaigns.

## User Preferences
I want to prioritize iterative development, receiving detailed explanations for complex features. I prefer clear, concise language in all communications. For coding, I favor a modular and clean architecture. Before making any significant architectural changes or introducing new dependencies, please ask for my approval. Ensure all user-facing text and documentation are in Spanish.

## System Architecture
The application is built with a modern web stack, featuring a React frontend and an Express.js backend.

### Frontend
- **Framework & Styling**: React with TypeScript, Vite, and Tailwind CSS.
- **UI Components**: Shadcn UI, Lucide React, React Icons, Framer Motion for animations.
- **WYSIWYG Editor**: TipTap for rich text editing.
- **Visual Theme**: Light mode only, using Primary #002073 and Accent #e3001b. Layouts are full-width (`w-full`) with dynamic padding and a collapsible sidebar.
- **UI/UX Decisions**: Unified campaign card layouts, always-editable text fields, preview via iframe dialog, instant version switching, and a database selector card in the campaign editor.
- **Placeholder System**: Standardized placeholders (`{{ASUNTO}}`, `{{PREHEADER}}`, `{{CONTENIDO}}`, `{{CTA_TEXTO}}`, `{{CTA_URL}}`, `{{IMAGEN_URL}}`) are used for dynamic content injection in templates.

### Backend
- **Framework**: Express.js (Node.js).
- **Authentication**: `bcryptjs` for hashing and `express-session` with `connect-pg-simple` for session management.
- **API Design**: RESTful API with Zod-based validation for all endpoints, covering authentication, CRUD operations for campaigns, contacts, brand identity, and templates, as well as AI-driven generation and editing.
- **Security**: Rate limiting on auth and AI routes, HTML sanitization, input validation, and data ownership checks.
- **Concurrency**: OpenAI (text) and Gemini (image) generation run in parallel.

### Data Management
- **Database**: PostgreSQL with Drizzle ORM.
- **Schema**: Includes `users`, `campaigns`, `campaign_versions`, `contact_databases`, `contacts`, `brand_identity`, and `templates` tables.
- **Campaign Versioning**: Supports up to 3 versions per campaign, storing `contentJson` and `imageUrl`.
- **Template Versioning**: Allows up to 3 versions per template for comparison, with a `isConfirmed` flag.
- **AI Integration**:
    - **OpenAI**: Uses `gpt-4.1-mini` for text generation with Structured Outputs, leveraging `brand_identity` and conversational history. Includes retry logic and refusal handling.
    - **Gemini**: Uses `gemini-3.1-flash-image-preview` for image generation (16:9 aspect ratio) and advanced multimodal image editing (Nano Banana) with micro-prompts.
- **Contacts System**: Manages `name`, `email`, `position`, `segment` fields, with validation and deduplication on import.
- **Admin Panel**: Provides user management (create, edit, delete, activate, role changes), activity logs, platform statistics, and impersonation functionality, protected by `requireAdmin` middleware.

### Features
- **Calendar**: Displays campaigns with status indicators (emerald=sent, blue=scheduled, gray=draft, red=cancelled) and image thumbnails on hover. Optimized for performance with memoized components and bulk image fetching.
- **CSV/XLSX Import**: Supports importing contact data with automatic delimiter detection, English/Spanish column header mapping, and deduplication.
- **Smart Template Analysis**: AI-powered analysis for uploaded HTML templates. Uses intelligent detection: identifies existing elements (logo, image, CTA button, footer) and only inserts `{{CONTENIDO}}` where content is truly variable. Returns `lockedFields` array indicating which elements are fixed. Upload dialog is a full-screen split-view (form left, live preview right) with no technical jargon — uses "Adaptar con Inteligencia Artificial" button. Endpoint: `POST /api/templates/analyze-html`.
- **Locked Fields System**: Templates store `lockedFields` (jsonb) indicating which elements come pre-built (values: "imagen", "cta", "cta_url", "footer"). In the campaign editor (CalendarView), locked fields show a lock icon and are disabled. AI text generation (`generateEmailContent`, `regenerateEmailContent`) receives `lockedFields` to focus creativity on dynamic fields only.
- **Single Template Generation**: Generates 1 template per request with standardized naming ("Plantilla N"). Users can create new AI versions (up to 3 total including original) before confirming. Manual text editing available for all AI templates.
- **Standardized Template Structure**: All AI-generated templates follow a fixed block order: Header/Banner (logo top-left + {{ASUNTO}} centered) → Hero Image → Content → CTA Button → Footer. `buildBaseTemplateHtml()` generates a parameterized base HTML template using brand colors/fonts/logo. The AI can only customize cosmetic aspects (colors, fonts, text styles, content formatting, image dimensions) but NEVER the block order. UI disclaimers in both "Create with AI" and "Edit with AI" dialogs inform users of the standard structure.
- **Optimized AI Prompts**: Template generation (`buildTemplateInstructions`) passes the base HTML template + brand identity data and instructs the AI to adapt cosmetically. Campaign content (`buildInstructions`) uses copywriting-only data (company, industry, mission, vision, products, history, styleGuide, tone, targetAudience). Gemini receives only user prompt + action.
- **Manual Text Editing**: AI-generated templates support inline text editing — groups text nodes by nearest block parent (TD, DIV, P, etc.) into labeled sections (e.g., "Sección 1", "Párrafo 2") for a cleaner editing experience.
- **Confirmed Template Lockdown**: Once a template is confirmed (`isConfirmed=true`), AI editing buttons are hidden. Only preview, rename, text edit, and delete remain.
- **Validation & Security**: Enforces content approval, prevents modification of sent campaigns, and includes various input validations (e.g., website field auto-prepends `https://`).
- **Target Audience**: Optional `targetAudience` field in campaigns, which is passed to AI prompts to tailor content.
- **Historial de Correos**: Collapsible cards show campaign details, with client-side date range filtering. Selection mode with checkboxes for selective deletion. "Vaciar Todo" for clearing entire history. Both features moved from Calendar to MyEmails page.
- **Dashboard (Analytics)**: Displays user-specific metrics (total campaigns, timeline, top databases/templates, contacts reached) using Recharts, with brand color schemes.
- **Guided Tutorial Mode (Bombillo)**: Interactive, step-by-step guidance for new users, highlighting UI elements and providing tips, persisted in local storage.
- **Logo Hosting**: `POST /api/brand/logo-upload` saves uploaded logos (PNG/JPG/WebP only, no SVG) to `uploads/logos/` and returns a public URL. Static serving via `app.use("/uploads", express.static(...))`.
- **Sender Configuration**: `senderName` and `senderEmail` fields in brand identity, used as email sender info when dispatching campaigns.
- **Make.com Integration**: Campaigns are sent via `sendCampaignToWebhook()` which POSTs rendered HTML + contacts to `MAKE_WEBHOOK_URL`. HTML is cleaned before sending (no XHTML xmlns, no self-closing non-void tags). Status lifecycle: draft → sending → sent (with rollback on failure). Background scheduler checks every 60s for scheduled campaigns with retry limit (3 attempts max, then marks as "failed"). Callback endpoint at `POST /api/webhooks/make-callback` updates campaign status and supports optional `MAKE_WEBHOOK_SECRET` env var for authentication.
- **Image Hosting**: Generated/edited images are saved as files in `uploads/campaigns/` (not base64 in DB). API responses resolve filenames to public URLs. Webhook HTML uses clean `<img src="https://...">` URLs instead of multi-MB base64. Helper functions: `saveBase64Image()` saves to disk, `getImagePublicUrl()` resolves filenames (supports `APP_URL` env var for production domains), `loadImageAsBase64()` reads back for Gemini editing.
- **Same-Day Scheduling**: When selecting today in the calendar, the default time is set to the next full hour. Frontend converts datetime-local to ISO string with `toISOString()` to avoid timezone mismatches with the server.
- **Editor Persistence**: Mutation dialogs (Regenerar Texto, Regenerar Imagen, Nano Banana) cannot be closed while a mutation is pending — `onOpenChange`, `onInteractOutside`, and `onEscapeKeyDown` are blocked during isPending.
- **Image Prompt Limits**: All image-related prompts (regeneration, editing, Nano Banana) accept up to 1200 characters (frontend maxLength + backend validation).
- **Campaign Send Tracking**: Per-contact tracking via `campaign_sends` table. Pre-registers all contacts as "pending" before webhook dispatch. Callback endpoint accepts per-contact status updates (`campaign_id`, `contact_email`, `status`, `message_id`, `error_message`). Campaign auto-transitions to "sent"/"partial"/"failed" when all callbacks received. Real-time progress via WebSocket (`/ws` path) broadcasting `campaign-progress` events. API endpoints: `GET /api/campaigns/:id/sends` (full log), `GET /api/campaigns/:id/send-stats` (summary counts).
- **Ownership Checks**: Target database ownership is verified before sending to prevent cross-tenant data leakage.
- **Progressive Onboarding**: Sidebar sections unlock progressively as the user completes steps. `GET /api/onboarding-status` returns `{hasBrand, hasTemplates, hasContactDatabases}`. Locked sidebar items show a lock icon and toast on click. Route protection redirects users who try to access locked sections via URL. "Siguiente" navigation buttons guide users through the flow: Brand → Templates → Contacts → Calendar.

### Deployment & Production
- **Deployment Target**: VM (always-running) for WebSocket and campaign scheduler support.
- **Build**: `npm run build` → esbuild bundles server to `dist/index.cjs`, Vite builds frontend to `dist/public/`.
- **Production Run**: `node ./dist/index.cjs` serves both API and static frontend.
- **Database Seed**: `server/seed.ts` auto-seeds production DB on first boot if empty. Reads from `server/seed-data.json` (copied to `dist/server/` during build). Exports all tables with sequence resets.
- **Uploads**: Campaign images and logos stored in `uploads/` directory, served via `express.static`.
- **Admin User**: `admin@postialo.com` (role: admin).
- **Session Security**: Secure cookies in production, `trust proxy` enabled for Replit's reverse proxy.

## External Dependencies
- **PostgreSQL**: Primary database.
- **OpenAI API**: For AI text generation, regeneration, and template analysis.
- **Google Gemini API**: For AI image generation and advanced image editing.
- **Make.com Webhook**: Campaign distribution via hardcoded webhook URL.
- **bcryptjs**: Password hashing.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **TipTap**: WYSIWYG editor.
- **Framer Motion**: Frontend animations.
- **Wouter**: Client-side routing.
- **Recharts**: Charting library for dashboard.
- **Lucide React / React Icons**: Icon libraries.
- **express-rate-limit**: API rate limiting.
- **Drizzle ORM**: PostgreSQL ORM.
- **Zod**: Schema validation.