# Integración completa con Mailchimp

## What & Why
Add Mailchimp as a second email delivery provider alongside Brevo. Users can configure both providers simultaneously, set a default, and choose per-campaign which one to use. Mailchimp uses a 5-step flow: sync contacts to an audience with tags, create campaign, set HTML content, and trigger send. Tracking is done via polling `/reports/{campaign_id}` since Mailchimp Marketing API doesn't have send-event webhooks like Brevo.

## Done looks like
- Users can connect their Mailchimp account by pasting an API key on the Email Provider page (the data center is extracted automatically from the key suffix)
- The Email Provider page shows both Brevo and Mailchimp sections side-by-side, each with connect/disconnect, account info, and sender/domain configuration
- Each provider card has a "Predeterminado" toggle button — the selected default is saved to the database
- When creating a campaign in the calendar, the provider selector pre-selects the user's default provider (if set), but allows switching to the other connected provider
- If only one provider is connected, it is auto-selected without showing a dropdown
- If no default is set and both are connected, the user must choose before sending
- Campaigns sent via Mailchimp follow the 5-step API flow: create/reuse audience → sync contacts with tags → create campaign → set HTML content → send
- Campaign sends are marked as "sent" immediately when Mailchimp returns 204 (same pattern as Brevo)
- The Mailchimp module validates the API key on connect by calling `GET /` (root endpoint) and extracts account info
- Verified domains are checked via `GET /verified-domains` before allowing sends
- All UI remains in Spanish

## Out of scope
- OAuth2 flow for Mailchimp (using API key for v1, as discussed)
- Mandrill/transactional API (confirmed not suitable for marketing campaigns)
- Mailchimp webhook-based tracking (Marketing API doesn't support it for send events; polling `/reports` is a future enhancement)
- Migrating existing Brevo campaigns to Mailchimp

## Tasks
1. **Schema update** — Add `isDefault` boolean column to `email_providers` table (migration 011). Add a unique partial index so only one provider per user can be `isDefault = true`. Add `mailchimpAudienceId` and `mailchimpCampaignId` columns to `campaign_sends` or campaigns table to track Mailchimp-specific IDs during the send flow.

2. **Mailchimp provider module** — Create `server/providers/mailchimp.ts` with functions: `validateApiKey` (calls `GET /` to verify key and extract data center + account info), `getVerifiedDomains` (calls `GET /verified-domains`), `syncContactsToAudience` (creates or reuses an audience, adds contacts with tags via batch subscribe, status "subscribed"), `createAndSendCampaign` (creates campaign with settings, sets HTML content, triggers send). Each function must have proper error handling with Spanish error messages matching the Brevo module pattern.

3. **Backend API routes for Mailchimp** — Extend `/api/email-provider/connect` to handle `provider: "mailchimp"`, validate the key via the new module, and store encrypted credentials. Extend `/api/email-provider/:provider/senders` to return verified domains for Mailchimp. Add `PATCH /api/email-provider/:id/default` endpoint to set a provider as the user's default (unset any previous default for that user). Extend `GET /api/email-provider/status` to include `isDefault` in the response.

4. **Multi-provider sendCampaignDirect** — Refactor `sendCampaignDirect` to check campaign's `providerId` or fall back to the user's default provider. If provider is "mailchimp", execute the 5-step Mailchimp flow (sync contacts → create campaign → set content → send). Mark sends as "sent" on Mailchimp 204 response, same as Brevo pattern. If provider is "brevo", use existing Brevo flow unchanged.

5. **Frontend: EmailProvider page** — Update the page to show both Brevo and Mailchimp sections. Mailchimp section: API key input, connect/disconnect, account info display, verified domains list. Add a "Predeterminado" toggle button on each provider card that calls the new default endpoint. Only one provider can be default at a time — selecting one deselects the other visually. Replace the generic envelope icons next to each provider name with the actual brand logos: import `@assets/brevo_icon_1775749753762.webp` for Brevo and `@assets/mailchimp-la-gi_1775749753761.webp` for Mailchimp. Display them as small rounded images (~24-32px) next to the provider name.

6. **Frontend: CalendarView provider selector** — Update the campaign creation dialog to pre-select the user's default provider. The provider dropdown should show the default provider's label with a star/badge. If the user has no default set but has multiple providers, require selection before allowing send. Use the same brand logo images (Brevo/Mailchimp) in the provider selector dropdown items instead of generic icons.

## Relevant files
- `server/providers/brevo.ts`
- `server/routes.ts:1490-1650`
- `server/routes.ts:1953-2100`
- `server/routes.ts:2610-2650`
- `server/storage.ts`
- `server/migrations.ts:209-250`
- `server/encryption.ts`
- `shared/schema.ts:132-170`
- `client/src/pages/EmailProvider.tsx`
- `client/src/pages/CalendarView.tsx:470-500,580-670,2829-2875`
