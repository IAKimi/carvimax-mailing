# Auto-fetch Mailchimp sender on connect

  ## What & Why
  When a user connects their Mailchimp account via API Key, the app currently saves `senderEmail` and `senderName` as `null`. This causes campaign sends to fall back to the brand's sender email (which may not be verified in Mailchimp), resulting in a 400 error: "Your Campaign is not ready to send. address(es)".

  Brevo already auto-fetches verified senders on connect and stores the default one. Mailchimp should work the same way. The Mailchimp API provides sender info via the audience's `campaign_defaults` (from `GET /lists/{list_id}`) which contains `from_name` and `from_email`. Additionally, the account root endpoint (`GET /`) returns the account `email` which can be used as a fallback.

  ## Done looks like
  - When a user connects Mailchimp, the app automatically fills in the sender email and name from the selected audience's `campaign_defaults`.
  - If no audience is available, it falls back to the Mailchimp account email.
  - The connected Mailchimp card in the Provider page shows the sender info (email and name), same as Brevo.
  - Users can change the sender from the UI if needed, using the same sender selector pattern as Brevo.
  - Sending a campaign via Mailchimp no longer fails due to missing/unverified sender address.

  ## Out of scope
  - Adding new Mailchimp API endpoints beyond what's needed for sender resolution.
  - Changing how Brevo's sender flow works (it's already correct).
  - Domain verification automation (that's done in Mailchimp's dashboard).

  ## Tasks
  1. Add a `getDefaultSender(apiKey, dataCenter, audienceId)` function to `server/providers/mailchimp.ts` that calls `GET /lists/{audienceId}` and extracts `campaign_defaults.from_name` and `campaign_defaults.from_email`.
  2. Update the Mailchimp connect flow in `server/routes.ts` (around line 1591-1605) to call `getDefaultSender` after audience selection and store the result in `senderEmail` and `senderName` instead of `null`. Fall back to account email if audience sender is unavailable.
  3. Add a `GET /api/email-provider/mailchimp/senders` endpoint (or extend the existing `/:provider/senders` endpoint) to return the current sender info for Mailchimp, fetched from the audience's `campaign_defaults`.
  4. Update the Mailchimp connected card in `client/src/pages/EmailProvider.tsx` to display the sender email/name and allow changing it, mirroring the Brevo sender UI pattern.
  5. When the audience selection changes via `PATCH /api/email-provider/:id/audience`, also update the sender from the new audience's `campaign_defaults`.

  ## Relevant files
  `server/providers/mailchimp.ts`
  `server/providers/brevo.ts:103-140`
  `server/routes.ts:1560-1620`
  `server/routes.ts:1683-1710`
  `server/routes.ts:1740-1780`
  `server/routes.ts:2199-2202`
  `client/src/pages/EmailProvider.tsx`
  