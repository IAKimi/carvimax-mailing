# Publicar Ahora sin validaciones (modo pruebas)

## What & Why
Ajustar el flujo de "Publicar ahora" para modo de pruebas con Make.com. Actualmente el botón se deshabilita tras el clic y el backend bloquea re-envíos si el estado es "sending" o "sent". El usuario necesita poder hacer clic múltiples veces sin restricciones durante las pruebas. El cambio de estado a "publicado" solo debe ocurrir cuando Make.com envíe el callback, no inmediatamente después del webhook.

## Done looks like
- Al hacer clic en "Publicar ahora", el payload se envía a Make.com pero el botón NO se deshabilita ni cambia visualmente. Se puede volver a hacer clic cuantas veces sea necesario.
- El estado de la campaña no cambia a "sent" inmediatamente tras enviar al webhook. Solo se marca como "sending" durante el envío.
- El estado solo cambia a "sent" cuando el endpoint de callback (`POST /api/webhooks/make-callback`) recibe la confirmación desde Make.com.
- No hay validaciones que bloqueen re-envío por estado "sending" o "sent" en el backend.

## Out of scope
- Timeout de 60 segundos con re-habilitación automática del botón (feature futura).
- Cualquier otra validación o UX refinement.

## Tasks
1. **Backend: quitar cambio inmediato a "sent" tras webhook exitoso** — En `sendCampaignToWebhook`, después de que el webhook responde OK, NO actualizar el estado a "sent". Dejarlo en "sending" para que solo el callback lo cambie.
2. **Backend: quitar bloqueos de re-envío** — En `POST /api/campaigns/:id/send`, quitar las validaciones que bloquean si el estado es "sending" o "sent", permitiendo re-envíos durante pruebas.
3. **Frontend: no deshabilitar el botón** — En CalendarView.tsx, el botón "Publicar Ahora" no debe deshabilitarse con `isPending` ni mostrar estado de carga. Solo enviar y listo.

## Relevant files
- `server/routes.ts:1234-1340`
- `client/src/pages/CalendarView.tsx:363-395`
