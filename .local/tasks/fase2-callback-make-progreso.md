# Fix callback de Make y progreso de envío

## What & Why
El estado de las campañas se queda pegado en "Enviando" después de que Make.com procesa los correos exitosamente. Los logs del servidor muestran que nunca llega ningún callback de Make. El JSON actual de Make solo envía `{"campaign_id": "...", "status": "sent"}` sin desglose por contacto. Se necesita: (1) documentar y guiar al usuario sobre cómo configurar el callback correcto en Make, (2) asegurar que el servidor maneja correctamente tanto callbacks individuales (por contacto) como callbacks globales (de campaña completa), (3) generar el JSON correcto que Make debe enviar para callbacks individuales.

## Done looks like
- El servidor procesa callbacks individuales por contacto: marca cada contacto como sent/failed
- Si Make envía un callback global sin `contact_email`, el sistema marca todos los contactos pendientes como enviados y actualiza el status
- La barra de progreso muestra el avance real en tiempo real vía WebSocket
- Al finalizar todos los envíos, el estado cambia a "sent", "failed" o "partial" según corresponda
- Se documenta claramente el JSON que Make debe enviar en cada iteración del loop de contactos
- El endpoint de progreso `/api/campaigns/:id/send-progress` muestra cuáles contactos están pendientes, enviados y fallidos

## Out of scope
- Reintento automático de correos fallidos
- Integración directa con la API de Make

## Tasks
1. **Mejorar el handler del callback global** — Cuando Make envía solo `campaign_id` y `status: "sent"` sin `contact_email`, el sistema debe marcar todos los send records pendientes como "sent" y actualizar contadores y estado.
2. **Agregar endpoint de detalle de envíos** — Crear endpoint que devuelva la lista de contactos con su estado individual (pending/sent/failed) para que el frontend pueda mostrar quién recibió y quién no.
3. **Mejorar respuesta del webhook de envío** — Al enviar la campaña, incluir en la respuesta al frontend el JSON exacto que Make debe usar para callbacks individuales por contacto.
4. **Actualizar el frontend** — Mostrar en la sección de progreso la lista de contactos con su estado. Los que fallaron deben ser visibles para retargeting.

## Relevant files
- `server/routes.ts:1427-1570`
- `server/storage.ts`
- `client/src/pages/CalendarView.tsx:935-967`
- `client/src/hooks/use-campaign-progress.ts`
