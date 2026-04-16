# Correcciones UX: Plantillas separadas, confirmaciones bonitas, y formulario inteligente

## What & Why
Three UX issues found during production testing: unconfirmed template versions hide the parent template (confusing users), ugly browser-native confirm dialogs, and campaign creation form not respecting template locked fields (wasting API calls for unused image generation).

## Done looks like
- Confirmed templates always visible in the main grid. Unconfirmed versions (drafts/in-progress) appear in a separate section above or below the main grid, clearly labeled (e.g., "Versiones en proceso"). The parent template never disappears when new versions are being created.
- Delete confirmations use a styled AlertDialog component (same pattern as CalendarView campaign cancellation) instead of browser's window.confirm()
- In the new campaign creation form, the template selector appears BEFORE the image section
- When a template with locked "imagen" field is selected, the image prompt/upload section is hidden automatically
- No wasted image generation API calls when template already has a built-in image

## Out of scope
- Changes to the campaign editor view (already has locked field support)
- Changes to AI text generation (already respects locked fields)
- Complete template versioning system redesign

## Tasks
1. **Separate confirmed and unconfirmed templates into two containers** — Split the template grid into two sections: the main grid for confirmed/standalone templates (always visible), and a separate clearly-labeled section for unconfirmed versions (drafts in progress). The parent template must never be hidden from the main grid when it has unconfirmed children. Both sections should be visible simultaneously so the user always knows what they have.

2. **Replace window.confirm with AlertDialog** — Replace all window.confirm() calls in Templates.tsx with the styled AlertDialog component (same pattern used in CalendarView.tsx for campaign cancellation and MyEmails.tsx for email deletion). This includes the delete template confirmation.

3. **Reorder campaign creation form and add locked fields logic** — Move the template selector field to appear BEFORE the image section in the new campaign dialog. When a template with lockedFields containing "imagen" is selected, hide the image prompt/upload section entirely. When template changes to one without locked imagen, show the image section again.

## Relevant files
- `client/src/pages/Templates.tsx:72-99,314-317`
- `client/src/pages/CalendarView.tsx:2505-2775`
- `client/src/components/ui/alert-dialog.tsx`
