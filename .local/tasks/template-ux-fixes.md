# Correcciones UX de Plantillas

## What & Why
Multiple UX issues found during user testing of the template upload and management flow. These prevent a smooth experience when uploading HTML templates with pre-existing elements (images, CTA buttons, footers).

## Done looks like
- Upload dialog ("Cargar Plantilla") occupies nearly the full screen height — no scrolling needed to see the complete form and preview
- Template preview dialog ("Vista previa") also shows the full template without needing scroll
- While AI adaptation is running, the dialog cannot be closed (X button disabled, clicking outside or pressing Escape does nothing) — same pattern used for image generation
- Only ONE preview eye button per template card (remove the duplicate)
- When a template has `lockedFields` (e.g., imagen, cta, cta_url, footer), `hasAllPlaceholders` is calculated considering those locked fields as "present" — so the "Analizar con IA" button does NOT appear for templates that already have those elements built-in
- After AI adaptation during upload, the save flow works correctly and the template is marked complete when locked fields cover the missing placeholders

## Out of scope
- Changes to the campaign editor locked field display (already working)
- Changes to AI text generation logic (already working)
- Template generation from scratch (not affected)

## Tasks
1. **Maximize dialog sizes** — Make the upload dialog and preview dialog use near-fullscreen height (e.g., `h-[95vh]`) so the full template is visible without scrolling. Ensure the iframe preview stretches to fill available space.

2. **Block dialog close during AI processing** — While AI adaptation is running (loading state), prevent closing the upload dialog: disable X button, prevent Escape key, prevent clicking outside. Show a visual indicator that processing is in progress. Same pattern as image generation blocking.

3. **Fix hasAllPlaceholders to respect lockedFields** — Update `validateTemplatePlaceholders()` in `server/templates.ts` to accept an optional `lockedFields` array. Map locked field names to their placeholder keys (imagen→IMAGEN_URL, cta→CTA_TEXTO, cta_url→CTA_URL) and treat those as "present" even if the literal placeholder text isn't in the HTML. Update all call sites in `server/routes.ts` to pass `lockedFields` when available. This fixes the "Analizar con IA" button appearing incorrectly on templates that already have those elements.

4. **Remove duplicate preview eye button** — Each template card currently shows two eye/preview buttons (one on hover overlay, one in the action buttons row). Keep only the hover overlay one ("Vista previa") and remove the eye icon from the action buttons row.

## Relevant files
- `client/src/pages/Templates.tsx`
- `server/templates.ts`
- `server/routes.ts`
- `shared/schema.ts:128-137`
