# Integración con Make.com para envío masivo

## What & Why
Connect the SaaS to Make.com for mass email sending. The SaaS sends a single JSON payload with campaign content and contacts to a Make.com webhook URL. Make handles the iteration and dispatching via Brevo. A callback endpoint receives confirmation from Make when sending is complete. Campaigns can be sent immediately ("Publicar ahora" button, which already exists) or fired automatically at the scheduled date/time by a background scheduler.

## Done looks like
- The existing "Publicar ahora" button, when clicked, builds the payload and POSTs it to the Make.com webhook URL immediately.
- If a campaign has a `scheduledAt` date/time, a background scheduler process automatically fires the payload to the webhook when the scheduled time arrives. The user programs and forgets.
- If the user clicks "Publicar ahora" on a scheduled campaign, it sends immediately (overriding the schedule).
- Payload structure: `{ subject, html_content, sender_name, sender_email, campaign_id, contacts: [{ name, email }, ...] }`.
- A callback endpoint (`POST /api/webhooks/make-callback`) receives `{ campaign_id, status, message_id }` from Make and updates the campaign status to `sent`.
- Sender name and email are configurable in brand identity settings.
- The webhook URL is stored as an environment secret (`MAKE_WEBHOOK_URL`).

## Out of scope
- Setting up the Make.com scenario (user does this manually).
- Brevo account configuration.
- Real-time progress tracking / Socket.io.
- Bounce/open/click tracking.

## Tasks
1. **Add sender fields** — Add `senderName` and `senderEmail` to brand identity, with UI fields in the brand identity settings page.
2. **Create send function** — A reusable server function that takes a campaign ID, gathers the rendered HTML (template + content), fetches contacts from the target database, and POSTs the full payload to the `MAKE_WEBHOOK_URL`. Updates campaign status to `sent` (or `sending`).
3. **Wire "Publicar ahora" to send** — Connect the existing publish button to call the send function. Add a confirmation dialog before sending if not already present.
4. **Background scheduler** — A setInterval-based process (or cron-like check) that runs every minute, queries for campaigns with status `scheduled` and `scheduledAt <= now`, and fires the send function for each. Ensure campaigns are not sent twice (mark as `sending` before dispatch).
5. **Create callback endpoint** — `POST /api/webhooks/make-callback` that receives delivery confirmation from Make and updates the campaign status to `sent`.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts:300-340`
- `server/storage.ts`
- `server/templates.ts`
- `server/index.ts`
- `client/src/pages/CalendarView.tsx`
- `client/src/pages/BrandIdentity.tsx`
