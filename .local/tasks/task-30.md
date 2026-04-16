---
title: Auditoría de integridad y consistencia de datos
---
# Auditoría de integridad y consistencia de datos

## What & Why
Auditoría profunda del sistema que corrige problemas de persistencia y consistencia que afectarían a un usuario real en producción. Detectados 8 problemas concretos donde el sistema pierde datos, entra en bucles infinitos, deja referencias huérfanas, o no limpia recursos. Todos son del mismo tipo que el bug #29 (regenerar imagen perdía el texto): situaciones donde una acción del usuario causa pérdida silenciosa de datos o comportamiento inesperado.

## Done looks like
1. **Campañas programadas que fallan no se reintentan infinitamente** — si una campaña programada falla (plantilla eliminada, base de datos vacía, webhook caído), después de 3 intentos se marca como "fallida" y notifica al usuario en lugar de reintentarse cada 60 segundos para siempre.
2. **No se pueden eliminar plantillas en uso** — si una plantilla está asignada a una campaña activa (draft/scheduled), el sistema bloquea la eliminación o desvincula limpiamente la campaña, en lugar de dejar una referencia huérfana que causa error 404 al previsualizar o enviar.
3. **No se pueden eliminar bases de datos en uso** — si una base de datos de contactos está asignada a una campaña programada, el sistema avisa antes de eliminarla en lugar de que la campaña falle silenciosamente al momento del envío.
4. **Limpieza de archivos de imagen** — cuando se eliminan campañas, se eliminan también los archivos de imagen del disco. Cuando se cambia un logo, se elimina el archivo anterior. Esto previene acumulación infinita de archivos en producción.
5. **Webhook de Make.com protegido** — el endpoint de callback requiere un token secreto configurable para evitar que cualquier persona que conozca un campaign_id pueda manipular el estado de envío.
6. **Regenerar texto preserva la imagen correctamente** — la versión de texto creada al regenerar debe incluir la imageUrl resuelta (actualmente se guarda como null, y aunque el resolver lo maneja, es inconsistente con la corrección del bug #29 donde las versiones de imagen sí heredan el contentJson).
7. **Ediciones manuales del usuario no se pierden silenciosamente** — si el usuario edita el texto manualmente en el editor y luego cambia de versión sin guardar, se muestra una confirmación antes de perder los cambios.
8. **Logo faltante no rompe emails** — si el usuario no ha configurado logo, el placeholder `{{LOGO_URL}}` se reemplaza con cadena vacía o se oculta la fila del logo, en lugar de mostrar texto roto o imagen rota en el email enviado.

## Out of scope
- Refactorización mayor de la arquitectura de versiones (funciona correctamente después del fix #29)
- Sistema de notificaciones push al usuario
- Migración de almacenamiento de imágenes a S3/CDN (mejora futura)
- Tests unitarios (tarea separada)

## Tasks
1. **Límite de reintentos para campañas programadas** — Agregar un campo `retryCount` a campaigns y lógica en el scheduler: incrementar en cada fallo, marcar como "failed" con mensaje descriptivo después de 3 intentos, y no volver a intentar.

2. **Proteger eliminación de plantillas y bases de datos en uso** — Al eliminar una plantilla, verificar si hay campañas activas (draft/scheduled) que la usen y bloquear con mensaje claro. Misma lógica para bases de datos de contactos. Mostrar al usuario cuáles campañas la usan.

3. **Limpieza de archivos huérfanos** — Al eliminar campañas (individual o masivo), eliminar los archivos de imagen asociados del disco. Al cambiar logo de marca, eliminar el archivo anterior. Agregar función helper `cleanupCampaignFiles(campaignId)`.

4. **Proteger webhook de Make.com** — Agregar un token secreto configurable (env var `MAKE_WEBHOOK_SECRET`) que debe incluirse como header o query param en los callbacks. Rechazar callbacks sin token válido.

5. **Consistencia de versiones de texto** — Al regenerar texto, incluir la imageUrl resuelta en la nueva versión (igual que las versiones de imagen incluyen el contentJson resuelto). Esto mantiene coherencia y hace que cada versión sea autosuficiente.

6. **Manejo de logo faltante en templates** — En renderTemplateWithContent, si no hay logoUrl, reemplazar `{{LOGO_URL}}` con cadena vacía y opcionalmente ocultar la fila de logo del HTML. Verificar que el email renderizado no muestre imágenes rotas.

7. **Confirmación al cambiar versión con cambios sin guardar** — En el frontend (CampaignEditor), trackear si hay cambios sin guardar y mostrar diálogo de confirmación antes de cambiar de versión activa.

## Relevant files
- `server/routes.ts:1955-1979`
- `server/routes.ts:1450-1567`
- `server/routes.ts:1594-1697`
- `server/routes.ts:594-669`
- `server/routes.ts:163-176`
- `server/storage.ts`
- `server/templates.ts:78-80`
- `shared/schema.ts`
- `client/src/pages/CalendarView.tsx`
- `client/src/pages/Templates.tsx`
- `client/src/pages/Contacts.tsx`