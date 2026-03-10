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
- **UI/UX Decisions**: Unified campaign card layout (image left, text right, stacking on mobile). Always-editable text fields. Preview via dialog modal (iframe). Collapsible sidebar for desktop, hamburger menu for mobile.

### Backend
- **Framework**: Express.js (Node.js).
- **Authentication**: `bcryptjs` for password hashing and `express-session` with `connect-pg-simple` for session management.
- **API Design**: RESTful API with endpoints for authentication, CRUD operations on campaigns, contacts, brand identity, and templates, and AI-driven generation/regeneration/editing. All endpoints have Zod-based body validation and enforce max lengths.
- **Security**: Rate limiting on auth and AI routes, HTML sanitization for templates, input validation for all fields, and ownership checks for data modification.
- **Concurrency**: OpenAI (text) and Gemini (image) generation run in parallel using `Promise.all`.

### Data Management
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Schema**: Seven core tables: `users`, `campaigns`, `campaign_versions`, `contact_databases`, `contacts`, `brand_identity`, `templates`, plus an auto-created `session` table.
- **Campaign Versioning**: Stores `contentJson` (OpenAI output) and `imageUrl` (Gemini output) for each version. Supports up to 3 versions per campaign.
- **AI Integration Logic**:
    - **OpenAI (Text Generation)**: Uses `gpt-4.1-mini` with Structured Outputs (JSON schema for `asunto`, `preheader`, `cuerpo_html`, `cta_text`). Utilizes `brand_identity` for context and conversational history for text regeneration. Includes retry logic and refusal handling.
    - **Gemini (Image Generation/Editing)**: Uses `gemini-3.1-flash-image-preview` (Nano Banana 2). Generates images with `responseModalities: ["IMAGE"]` and `aspectRatio: "16:9"`. Supports image-to-image editing by sending original image as `inline_data` and edit instructions as `text`. Includes safety checks for `finishReason` and `safetyRatings`.

### Project Structure
- `client/`: Frontend React application.
- `server/`: Backend Express.js application, including database connection, API routes, and AI integrations.
- `shared/`: Shared data models (Drizzle + Zod schemas) and API contracts.

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