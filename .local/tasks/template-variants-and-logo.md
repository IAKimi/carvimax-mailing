# Ajuste de variantes de plantillas y hosting de logo

## What & Why
The current 2-variant template system needs two changes: (1) after the user picks one of the 2 initial proposals, they should be able to regenerate **that selected template** up to 2 more times (currently it regenerates both variants again), and (2) the 2 initial proposals must be visually very different from each other (currently they rely on temperature randomness alone, which often produces similar results). Additionally, logos uploaded as base64 need to be hosted as real URLs so they actually appear in generated templates.

## Done looks like
- When generating a template, 2 visually distinct proposals appear side by side (different layout structure, different visual approach).
- After selecting one, the user can click "Regenerar" up to 2 more times on **that single template** — each regeneration replaces the selected template with a new version of it.
- The variant picker dialog is only shown on the initial generation (not on regenerations of the selected template).
- Logos uploaded in Brand Identity are served as real HTTP URLs (not base64), so they appear correctly in AI-generated template HTML.
- The `{{LOGO_URL}}` placeholder is replaced with the real hosted URL when rendering templates.

## Out of scope
- Changes to the template editing UI beyond the variant/regeneration flow.
- Changes to the campaign generation flow.
- Make.com integration (separate task).

## Tasks
1. **Differentiate variant prompts** — When generating 2 variants, pass distinct style/layout instructions to each call (e.g., variant A gets "layout with hero image on top, centered CTA" and variant B gets "split layout with image on side, left-aligned CTA") so they produce visibly different results.
2. **Change post-selection regeneration** — After the user picks a variant, enable a "Regenerar" button on that template's card/detail view that calls the single-template generation endpoint (not the 2-variant one). Track remaining regenerations (max 2) in component state.
3. **Host logos as URLs** — Add a server endpoint (`POST /api/brand/logo-upload`) that accepts the base64 image, writes it to disk (e.g., `uploads/logos/`), and returns a public URL. Update BrandIdentity.tsx to call this endpoint on logo upload and store the URL (not base64) in `logoUrl`. Serve the uploads directory as static files.
4. **Replace logo placeholder in templates** — In `renderTemplateWithContent` (server/templates.ts), replace `{{LOGO_URL}}` with the actual `brand.logoUrl` before returning the final HTML.

## Relevant files
- `server/openai.ts:295-470`
- `server/routes.ts:1014-1067`
- `client/src/pages/Templates.tsx:100-170,950-1052`
- `client/src/pages/BrandIdentity.tsx:580-600`
- `server/templates.ts`
- `server/storage.ts`
