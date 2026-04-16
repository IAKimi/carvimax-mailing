# Editor Persistence, Scheduling & HTML Fixes

## What & Why
Four critical UX and functionality bugs need fixing: (1) the campaign editor closes unexpectedly during image editing operations, (2) same-day scheduling rejects valid times due to timezone mismatch, (3) scheduled time is not shown in the editor, and (4) the HTML payload sent to Make.com embeds 3MB+ base64 images instead of hosted URLs, making it unusable.

## Done looks like
- Applying Nano Banana edits, regenerating images, or editing text keeps the user on the current screen with a loading state. The dialog cannot be closed while a mutation is in progress. On success, only the specific sub-dialog closes — the campaign editor stays open.
- Scheduling a campaign for today at a valid future time (e.g., 2:00 PM local) succeeds without error.
- The campaign editor header shows both the scheduled date AND time (e.g., "11 mar 2026, 14:00").
- The HTML payload sent to the Make.com webhook uses hosted image URLs instead of base64 data URIs. The payload is clean, standard HTML with reasonable size.

## Out of scope
- Redesigning the overall editor layout
- Adding new image editing capabilities
- Changing the Make.com webhook contract (fields stay the same)

## Tasks
1. **Prevent editor from closing during mutations** — Keep the Nano Banana, image regeneration, and text regeneration dialogs open and non-dismissible while their mutations are pending (isPending). On success, close only the sub-dialog, never the campaign editor. Investigate and fix any query invalidation side effect that causes editingCampaignId to reset.

2. **Fix timezone-aware scheduling** — The frontend sends a datetime-local string without timezone info (e.g., "2026-03-11T14:00"), but the server interprets it as UTC. Convert the frontend value to a proper ISO string with timezone offset before sending to the backend, so "2pm local" is correctly understood regardless of server timezone.

3. **Show scheduled time in editor header** — Change the date display in the campaign editor from date-only (`toLocaleDateString`) to date+time format so users always see when their campaign is scheduled.

4. **Host campaign images and use URLs in webhook HTML** — Save generated/edited images to the server filesystem (similar to logo uploads) and store the public URL. When rendering HTML for the Make webhook, the `{{IMAGEN_URL}}` placeholder will resolve to a small HTTP URL instead of a multi-megabyte base64 string.

## Relevant files
- `client/src/pages/CalendarView.tsx:233-275`
- `client/src/pages/CalendarView.tsx:285-310`
- `client/src/pages/CalendarView.tsx:735-741`
- `server/routes.ts:287-310`
- `server/routes.ts:557-740`
- `server/routes.ts:1247-1310`
- `server/gemini.ts:35-120`
- `server/templates.ts:34-68`
