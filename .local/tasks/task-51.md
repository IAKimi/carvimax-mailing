---
title: Flujo de envío directo Brevo y tracking por webhooks
---
# Reemplazar flujo de envío con Brevo directo y tracking

## What & Why
Con la infraestructura de proveedores creada en la tarea anterior, ahora necesitamos conectar el flujo real de envío de campañas para que use la API de Brevo directamente en lugar de Make.com, y recibir las notificaciones de tracking (entregado, abierto, clicado, rebotado) a través de webhooks de Brevo.

## Done looks like
- Cuando un usuario con Brevo configurado envía o programa una campaña, el backend llama directamente a la API de Brevo con la API key del usuario — no pasa por Make.com.
- Los envíos se hacen en lotes de hasta 1,000 destinatarios usando `messageVersions`.
- Se incluye un tag `postialo_campaign_{id}` en cada envío para vincular los webhooks de tracking.
- Existe un nuevo endpoint `POST /api/webhooks/brevo` que recibe notificaciones de Brevo (delivered, opened, click, hard_bounce, soft_bounce) y actualiza el estado de cada envío individual, los contadores de la campaña, y transmite el progreso por WebSocket en tiempo real.
- Si Brevo responde con 402 (sin créditos), el envío se detiene y el usuario recibe un mensaje claro.
- El scheduler de campañas programadas también usa el envío directo a Brevo.
- Si el usuario NO tiene proveedor configurado, la campaña no se puede enviar y se muestra un error indicándole que configure su proveedor primero (el webhook de Make.com para envío se elimina por completo).
- El webhook de Make.com para verificación de registro (`/api/webhooks/make-callback` para registration flow) se mantiene intacto.

## Out of scope
- Frontend/UI para configurar el proveedor (tarea separada).
- Integración con Mailchimp.
- Importar contactos desde Brevo.

## Tasks
1. **Refactorizar `sendCampaignToWebhook`** — Renombrar a `sendCampaignDirect`. En vez de llamar al webhook de Make.com, buscar el proveedor configurado del usuario. Si tiene Brevo, llamar a `sendBatchEmails` del módulo Brevo. Si no tiene proveedor, retornar error claro. Eliminar la constante `MAKE_WEBHOOK_URL` y toda referencia al webhook de Make.com para envío de campañas.

2. **Endpoint de webhook Brevo** — Crear `POST /api/webhooks/brevo` (público, sin requireAuth) que reciba las notificaciones de Brevo. Validar que el payload contenga los campos esperados (event, email, tags). Usar el tag `postialo_campaign_{id}` para encontrar la campaña. Actualizar el `campaign_send` correspondiente y los contadores. Broadcast por WebSocket. Manejar eventos: delivered→sent, hard_bounce→failed, soft_bounce→failed, opened/click→actualizar metadata.

3. **Manejo de errores de créditos** — Cuando Brevo responda 402 durante un envío batch, detener los chunks restantes, marcar los envíos no procesados como "failed" con mensaje "Sin créditos en Brevo", actualizar el estado de la campaña a "partial", y notificar por WebSocket.

4. **Actualizar el scheduler** — Modificar la lógica del scheduler para que verifique que el usuario tenga un proveedor configurado antes de intentar enviar una campaña programada. Si no tiene proveedor, marcar la campaña como fallida con error descriptivo.

## Relevant files
- `server/routes.ts:1758-1877,1910-1995,2291-2340`
- `server/providers/brevo.ts`
- `server/storage.ts`
- `shared/schema.ts`