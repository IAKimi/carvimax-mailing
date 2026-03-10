# PostIAlo Mail - SaaS de Email Marketing con IA

## Overview
PostIAlo Mail is an AI-powered email marketing automation SaaS platform. It aims to streamline email campaign creation and management by leveraging AI for content and image generation. The project's vision is to provide a comprehensive tool for users to design, generate, and manage their email marketing efforts efficiently.

## User Preferences
I want to prioritize iterative development, receiving detailed explanations for complex features. I prefer clear, concise language in all communications. For coding, I favor a modular and clean architecture. Before making any significant architectural changes or introducing new dependencies, please ask for my approval. Ensure all user-facing text and documentation are in Spanish.

## System Architecture
The application is built with a modern web stack.

### Frontend
- **Framework**: React with TypeScript, bundled by Vite.
- **Styling**: Tailwind CSS for utility-first styling.
- **State Management/Routing**: Wouter for routing.
- **UI Components**: Shadcn UI for pre-built components, Lucide React and React Icons for iconography.
- **Animations**: Framer Motion.
- **WYSIWYG Editor**: TipTap for rich text editing.
- **Visual Theme**: Light mode only, using a specific color palette: Primary #002073, Accent #e3001b. Sidebar uses #002073 with white text. Regeneration buttons are blue (#2563eb), Nano Banana button is amber (#f59e0b), and approval buttons are emerald green.
- **Layout**: Full-width (`w-full`) — no `max-w` constraint. Content stretches to fill available space, adjusting dynamically when sidebar opens/closes. Padding: `p-4 md:p-8 lg:p-10`.
- **UI/UX Decisions**: Unified campaign card layout (image left, text right, stacking on mobile). Always-editable text fields. Preview via dialog modal (iframe). Collapsible sidebar for desktop, hamburger menu for mobile. Choice dialog shows `campaign.name` (truncated) instead of `campaign.idea`. Campaign editor includes database selector card. Version switching is instant via `localSelectedVersionId` local state + image preloading.

### Backend
- **Framework**: Express.js (Node.js).
- **Authentication**: `bcryptjs` for password hashing and `express-session` with `connect-pg-simple` for session management.
- **API Design**: RESTful API with endpoints for authentication, CRUD operations on campaigns, contacts, brand identity, and templates, and AI-driven generation/regeneration/editing. All endpoints have Zod-based body validation and enforce max lengths.
- **Security**: Rate limiting on auth and AI routes, HTML sanitization for templates, input validation for all fields, and ownership checks for data modification.
- **Concurrency**: OpenAI (text) and Gemini (image) generation run in parallel using `Promise.all`.

### Data Management
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Schema**: Seven core tables: `users`, `campaigns`, `campaign_versions`, `contact_databases`, `contacts`, `brand_identity` (includes `logoUrl` for base64 logo), `templates`, plus an auto-created `session` table.
- **Campaign Versioning**: Stores `contentJson` (OpenAI output) and `imageUrl` (Gemini output) for each version. Supports up to 3 versions per campaign.
- **Template Versioning**: When AI generates/edits templates, creates separate version records (up to 3) linked by `parentTemplateId`. Users compare versions side-by-side and confirm one; others are deleted. Fields: `isConfirmed`, `parentTemplateId`, `versionNumber`. Display logic: confirmed parents are hidden from the template list when they have unconfirmed children (only the latest unconfirmed version shows).
- **AI Integration Logic**:
    - **OpenAI (Text Generation)**: Uses `gpt-4.1-mini` with Structured Outputs (JSON schema for `asunto`, `preheader`, `cuerpo_html`, `cta_text`). Utilizes `brand_identity` for context and conversational history for text regeneration. Includes retry logic and refusal handling. Template generation prompt enforces strict structure: Header → Image Hero → Content → CTA → Footer (image always before content).
    - **Gemini (Image Generation/Editing)**: Uses `gemini-3.1-flash-image-preview` (Nano Banana 2). Generates images with `responseModalities: ["IMAGE"]` and `aspectRatio: "16:9"`. Supports basic `editImage()` and advanced `editImageAdvanced()` for multimodal editing.
    - **Compositor Avanzado (Nano Banana)**: Advanced image editing with 5 action types: Agregar, Reemplazar, Fusionar, Estilo, Borrar Elemento. Each action injects a micro-prompt optimized for Gemini. Supports multimodal payloads (text + base image + up to 3 reference images). Reference images can be uploaded or selected from version history. Endpoint: `POST /api/campaigns/:id/edit-image-advanced`. Total image size validated ≤ 20 MB.

### Placeholder System
The platform uses a standardized placeholder system for email templates. All templates (AI-generated or manually uploaded) can contain these 6 placeholders that map to campaign editor fields:
- `{{ASUNTO}}` → `contentJson.asunto` (email subject line, placed in `<title>`)
- `{{PREHEADER}}` → `contentJson.preheader` (preview text, hidden `<span>` in `<body>`)
- `{{CONTENIDO}}` → `contentJson.cuerpo_html` (main body HTML content)
- `{{CTA_TEXTO}}` → `contentJson.cta_text` (call-to-action button text)
- `{{CTA_URL}}` → `contentJson.cta_url` (call-to-action button URL)
- `{{IMAGEN_URL}}` → `version.imageUrl` (hero image URL)

Templates are validated for placeholder completeness (`hasAllPlaceholders` field). Campaigns can be linked to templates via `templateId`. The `GET /api/campaigns/:id/preview-final` endpoint renders the template with real campaign content injected.

Key files:
- `shared/schema.ts`: `TEMPLATE_PLACEHOLDERS` constant and `ALL_PLACEHOLDER_KEYS` array
- `server/templates.ts`: `validateTemplatePlaceholders()` and `renderTemplateWithContent()` utilities

### Contacts System
- **Fields**: `name`, `email`, `position` (cargo/puesto), `segment`
- **Note**: The `country` column was renamed to `position` — the schema uses `position` throughout
- **Validation**: RFC 5322-compliant email regex on frontend; Zod `.email()` on backend

### Calendar Optimization & Display
- Calendar cells use memoized `CalendarCell` component (`client/src/components/CalendarCell.tsx`)
- Campaign display: truncated title + colored left border (emerald=sent, blue=scheduled, gray=draft, red=cancelled) + image thumbnail on hover
- `POST /api/campaigns/thumbnails` fetches selected version images for visible campaigns (scoped by userId for security)
- `getCampaignThumbnails()` in storage uses `inArray` to query selected version images in bulk
- `campaignsByDay` is computed via single-pass O(campaigns) bucketing
- `GET /api/campaigns` excludes `selectedImageUrl` (base64 images) for lightweight list responses via `getCampaignsLight()`
- Month-based filtering: campaigns query passes `?year=X&month=Y` to only fetch current month's campaigns + drafts without dates
- Template selector uses `useMemo` for sorting, static icons instead of iframe previews, and disables/greys out incomplete templates
- "Vaciar Historial" button always visible with confirmation dialog to delete all campaigns
- Live preview button ("Vista Previa del Correo") is positioned below image editor section with PostIAlo blue (#002073) styling; hidden when both text AND image are approved
- "Vista Previa Final" button requires templateId AND textApproved AND imageApproved to be visible

### CSV/XLSX Import
- `POST /api/contact-databases/:id/import` with `mode=append|overwrite`
- Frontend parses CSV (automatic delimiter detection: comma/semicolon) and XLSX/XLS files (via `xlsx` package)
- Supports column headers in English and Spanish (email/correo, name/nombre, position/cargo, segment/segmento)
- Missing optional fields display as "No encontrado" (muted italic text) in the contacts table
- Deduplicates emails within file and against existing database (in append mode)
- Contact update (`PATCH /api/contacts/:id`) checks for duplicate emails in same database
- Error handling: try/catch around parsing + reader.onerror for corrupt/invalid files

### Template Analysis
- `POST /api/templates/:id/analyze` endpoint sends template HTML to OpenAI to auto-insert the 6 required placeholders
- Uses low temperature (0.3) to preserve original HTML structure
- "Analizar con IA" button appears on non-AI-generated incomplete templates

### Image Validation
- Placeholder images (`placehold.co` URLs) show a warning banner in the editor
- Users cannot approve a placeholder image — must upload or regenerate a real image first

### Validation & Security Guardrails
- **Text approval**: Cannot approve empty subject or placeholder "Borrador" text; cannot approve empty body
- **Image approval**: Cannot approve placeholder images (`placehold.co`)
- **Publishing**: Backend enforces `templateId` and `targetDatabase` before allowing `sent` status
- **Sent campaigns**: All AI endpoints block modifications on sent campaigns; content edits blocked on PATCH; version edits blocked
- **Website field**: Auto-prepends `https://` on both frontend (blur) and backend (Zod transform)
- **CSV deduplication**: Emails deduplicated within CSV batch and against existing database contacts
- **Contact update**: Prevents changing email to one already used in same database

### Project Structure
- `client/`: Frontend React application.
- `server/`: Backend Express.js application, including database connection, API routes, and AI integrations.
- `shared/`: Shared data models (Drizzle + Zod schemas) and API contracts.
- `client/src/components/CalendarCell.tsx`: Memoized calendar cell with campaign name + status + image thumbnails.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **OpenAI Responses API**: Used for AI text generation, regeneration, and template generation/editing. (Requires `OPENAI_API_KEY`)
- **Google Gemini API**: Used for AI image generation, regeneration, and image-to-image editing (Nano Banana). (Requires `GEMINI_API_KEY`)
- **bcryptjs**: For password hashing in authentication.
- **express-session**: For managing user sessions.
- **connect-pg-simple**: Stores session data in PostgreSQL.
- **TipTap**: WYSIWYG editor used in the frontend.
- **Framer Motion**: For animations in the frontend.
- **Wouter**: For client-side routing.
- **Lucide React / React Icons (SI)**: Icon libraries.
- **express-rate-limit**: For rate limiting API requests.
- **Drizzle ORM**: Object-Relational Mapper for PostgreSQL.
- **Zod**: Schema validation library used for API request bodies.
