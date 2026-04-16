---
title: Corregir preview de edición y bloqueo post-aprobación
---
# Corregir preview de edición y bloqueo post-aprobación

## What & Why
The campaign editor's "Vista Previa del Correo" uses a hardcoded generic HTML template (blue header, generic footer "© 2026 Mi Empresa") instead of the user's actual selected template. This confuses users because the preview looks completely different from their final email. Additionally, after approving image or text, editing controls remain active — they should be fully disabled once approved. The preheader field is shown in the edit preview but may not render in the final preview if the template lacks the placeholder, causing inconsistency.

## Done looks like
- "Vista Previa del Correo" renders the campaign's assigned template (fetched from DB) with current editor values injected into placeholders, matching the final preview's visual appearance
- The hardcoded generic preview HTML (blue header, "© 2026 Mi Empresa" footer) is removed
- After clicking "Aprobar Imagen," all image editing controls (regenerate, edit, upload, Nano Banana) are visually disabled/hidden
- After clicking "Aprobar Texto," all text editing controls (regenerate, subject/preheader/CTA inputs) are visually disabled/hidden
- If the user needs to make changes after approval, they must explicitly un-approve first (or approval resets automatically as it currently does on edit)
- Preheader field behavior is consistent between edit preview and final preview

## Out of scope
- Changes to the "Vista Previa Final" endpoint (already works correctly)
- Template generation/AI changes
- Any schema or migration changes

## Tasks
1. **Replace hardcoded preview with template-based preview** — Fetch the campaign's assigned template HTML when opening the edit preview, inject current editor values (subject, preheader, image, content, CTA) into the template placeholders client-side, and render in the iframe. Fall back to a simple layout only if no template is assigned.
2. **Disable image controls after approval** — When `imageApproved` is true, disable or hide the regenerate, edit, upload, and Nano Banana buttons/controls in the image section.
3. **Disable text controls after approval** — When `textApproved` is true, disable the subject, preheader, and CTA input fields plus the regenerate text button.

## Relevant files
- `client/src/pages/CalendarView.tsx:1422-1428,1640-1670`
- `client/src/pages/CalendarView.tsx:171-172,778-822,1275-1420,1445-1620`
- `server/routes.ts:511`