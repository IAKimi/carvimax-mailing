---
title: Fix onboarding unlock + auto-default provider
---
# Fix onboarding unlock + auto-default provider

## What & Why
Two bugs prevent users from progressing through the onboarding flow after connecting an email provider:

1. **Onboarding sidebar stays locked**: After connecting a provider on the EmailProvider page, the frontend never re-fetches `/api/onboarding-status`, so the sidebar keeps showing "Sección bloqueada" even though the backend knows the provider is active.

2. **Unnecessary "default" button**: The "Establecer como predeterminado" button always shows, even when only one provider is connected. If there's only one provider, it should be automatically set as default — no button needed. The button should only appear when both providers are active, so the user can choose between them.

## Done looks like
- After connecting the first email provider (Brevo or Mailchimp), the sidebar immediately unlocks the next sections (Plantillas, Contactos, etc.) without needing a page refresh.
- When only one provider is connected, it's automatically set as default (no "Establecer como predeterminado" button shown).
- The "Establecer como predeterminado" button only appears when both Brevo AND Mailchimp are connected simultaneously.
- If the user disconnects one provider and only one remains, it auto-becomes default.

## Out of scope
- Changing the onboarding level logic itself (the 0-4 levels are correct)
- Modifying provider connect/disconnect API endpoints beyond adding auto-default logic

## Tasks
1. **Frontend: invalidate onboarding status after provider changes** — In the connect, disconnect, and set-default mutations' `onSuccess` callbacks, add cache invalidation for `/api/onboarding-status` so the sidebar re-evaluates immediately.

2. **Backend: auto-set default when only one provider** — In the connect endpoint, after creating the provider, check if it's the only active provider for that user and auto-set `isDefault: true`. In the disconnect endpoint, if one provider remains, auto-set it as default.

3. **Frontend: conditionally show default button** — Only render the "Establecer como predeterminado" / "Predeterminado" button when both providers are connected. When only one is connected, hide the button entirely (it's already the default).

## Relevant files
- `client/src/pages/EmailProvider.tsx:257-328,539-550,810-821`
- `server/routes.ts:1410-1421,1530-1560,1599-1640`
- `client/src/components/Layout.tsx:45-52`