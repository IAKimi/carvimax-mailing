# PostIAlo Mailing - SaaS de Email Marketing con IA

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

### Deployment & Production
- **Deployment Target**: VM for WebSocket and campaign scheduler support.
- **Build Process**: `esbuild` for backend, `Vite` for frontend.
- **Production Run**: `node ./dist/index.cjs` serves both API and static frontend.
- **Database Seed**: `server/seed.ts` auto-seeds production DB on first boot.
- **Uploads**: Campaign images and logos stored in `uploads/` and served statically.
- **Session Security**: Secure cookies and `trust proxy` enabled for Replit.

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