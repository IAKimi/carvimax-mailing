# Corrección de persistencia de proveedor, tracking de envíos y limpieza Make.com

## Objetivo
Resolver 3 problemas detectados tras la primera prueba real de envío con Brevo, más una auditoría de consistencia general.

## Problemas identificados

### P1: Banner "Sin proveedor" parpadea al cargar (UX)
**Causa raíz:** La query `useQuery` para `/api/email-provider/status` no extrae `isLoading`. Mientras carga, `rawProviders` es `undefined`, se convierte en `[]`, y el UI muestra el aviso ámbar "Sin proveedor de email configurado" hasta que la query termina.

**Archivos:** `client/src/pages/CalendarView.tsx`

**Solución:**
1. Extraer `isLoading` (o `isPending`) del `useQuery` de email-provider/status
2. En el panel de edición de campaña (línea ~1249): no mostrar el banner si `isLoading` es true
3. En el diálogo de nueva campaña (línea ~2817): no mostrar "Sin proveedor" si `isLoading` es true; opcionalmente mostrar un skeleton/spinner breve
4. Aplicar la misma lógica en los guards de `handlePublishNow`, `checkBothApprovalsAndSchedule`, `handleReschedule`: si el proveedor aún está cargando, mostrar toast de "Cargando proveedor..." en vez de bloquear

### P2: Campañas atascadas en "sending" — envíos nunca salen de "pending"
**Causa raíz:** El flujo de `sendCampaignDirect` envía correctamente a Brevo (HTTP 201), pero los registros en `campaign_sends` quedan en `pending` porque la transición a `delivered`/`sent` depende 100% de que Brevo envíe webhooks de vuelta. Si la URL del webhook no es accesible externamente (como en desarrollo), o si Brevo tarda, la campaña se queda en "sending" indefinidamente. No hay mecanismo de timeout.

**Archivos:** `server/routes.ts` (sendCampaignDirect ~1953, webhook brevo ~2199, scheduler), `server/providers/brevo.ts`

**Solución:**
1. **Marcar envíos como "sent" inmediatamente cuando Brevo acepta el batch (HTTP 200/201):** En `sendCampaignDirect`, después de que `sendBatchEmails` retorne exitosamente, actualizar los registros de `campaign_sends` del chunk a `status = 'sent'` e incrementar `sentCount` en la campaña. Los webhooks de Brevo después podrán actualizar a `delivered`, `opened`, `clicked`, etc., pero el estado base ya no depende del webhook.
2. **Transición de campaña inmediata:** Si todos los chunks se enviaron OK, marcar la campaña como `sent` directamente en `sendCampaignDirect`, sin esperar webhooks.
3. **Mantener webhooks para tracking avanzado:** Los webhooks de Brevo (`delivered`, `opened`, `click`, `bounce`) siguen sirviendo para métricas de engagement, pero ya no son bloqueantes para el estado base de la campaña.
4. **Agregar timeout de seguridad en el scheduler:** Si una campaña lleva más de 30 minutos en `sending` sin progreso (mismo `sentCount`), marcarla como `partial` o `sent` según lo que se haya logrado.

### P3: Limpieza del endpoint Make.com callback
**Causa raíz:** `/api/webhooks/make-callback` es código muerto — solo logea pero no hace nada útil. Make.com ahora solo se usa para verificación de email de usuario.

**Archivos:** `server/routes.ts` (~2170)

**Solución:**
1. Eliminar el endpoint `/api/webhooks/make-callback` completamente
2. Mantener el webhook de verificación de email (`MAKE_VERIFICATION_WEBHOOK_URL`) intacto — ese sigue siendo funcional

### P4: Auditoría de consistencia general
Revisar que no haya otros problemas similares de estado inconsistente o UX confusa en las nuevas integraciones.

**Verificar:**
- Que el webhook de Brevo (`/api/webhooks/brevo`) maneje correctamente los eventos `batched` (array de eventos en un solo POST)
- Que no haya queries sin manejo de `isLoading` que causen flickering en `EmailProvider.tsx`
- Que la campaña #31 atascada se pueda resolver manualmente (UPDATE directo) después de aplicar los fixes
- Que el formulario de nueva campaña envíe correctamente el `providerId`

## Archivos clave
- `client/src/pages/CalendarView.tsx` — banner de proveedor, guards de envío, diálogo de nueva campaña
- `client/src/pages/EmailProvider.tsx` — verificar que no tenga el mismo problema de flickering
- `server/routes.ts` — sendCampaignDirect, webhook brevo, webhook make-callback
- `server/providers/brevo.ts` — sendBatchEmails, createTrackingWebhook

## Criterios de aceptación
1. Al abrir CalendarView, no se ve el banner "Sin proveedor" mientras carga la query
2. Al enviar una campaña, los envíos pasan de `pending` a `sent` inmediatamente tras respuesta exitosa de Brevo, sin depender de webhooks
3. La campaña pasa a `sent` al completar todos los envíos, sin quedarse atascada en `sending`
4. El endpoint `/api/webhooks/make-callback` ya no existe
5. Los webhooks de Brevo siguen funcionando para tracking (delivered, opened, click, bounce)
6. La campaña #31 se resuelve (UPDATE manual a `sent`)
