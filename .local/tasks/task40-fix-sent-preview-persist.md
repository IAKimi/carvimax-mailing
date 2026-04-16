# Fix: Preview de correo enviado debe persistir

## What & Why

Cuando una campaña se envía y aparece como "Enviado", la "Vista Final del Correo" muestra el iframe en blanco. Esto pasa porque el frontend intenta re-renderizar el email desde cero (plantilla + placeholders + regex CTA) cada vez que se abre, y ese proceso falla por diferencias en la estructura HTML de las plantillas.

La solución correcta: guardar el HTML renderizado final cuando se envía la campaña, y usarlo directamente en el preview.

## Prerequisite

Revertir el commit `653b6a6` ("Fix: layout overflow, CTA in sent preview, blank preview on F5") que rompió el calendario completo. Mantener solo los cambios a `server/templates.ts` (los regex fallback para CTA removal, que son correctos).

## Implementation

### Paso 1: Revertir commit roto
- `git revert 653b6a6` o restaurar `CalendarView.tsx` a su estado anterior al commit
- Mantener los cambios de `server/templates.ts` (regex CTA fallback) ya que son correctos y no causan problemas

### Paso 2: Agregar columna `sentHtml` a `campaign_versions`
- En `shared/schema.ts`, agregar columna `sentHtml` de tipo `text` (nullable) a `campaignVersions`
- Ejecutar `npm run db:push` para sincronizar

### Paso 3: Guardar HTML al enviar campaña
- En `server/routes.ts`, función `sendCampaignToWebhook`: después de generar `renderedHtml`, guardarlo en la versión activa de la campaña usando `storage.updateCampaignVersion(versionId, { sentHtml: renderedHtml })`
- Agregar método `updateCampaignVersion` a `IStorage` si no existe

### Paso 4: Usar `sentHtml` en Vista Final del Correo
- En `CalendarView.tsx`, sección "Vista Final del Correo" (línea ~1212):
  - Si `selectedVersion.sentHtml` existe, usarlo directamente como `srcDoc` del iframe (envuelto en `<html><body>` + script de altura)
  - Solo como fallback, usar la lógica actual de re-renderizado desde plantilla
- Esto elimina la dependencia de la plantilla + regex CTA para campañas ya enviadas

## Done looks like

1. El calendario funciona normalmente (sin página en blanco)
2. Cuando se envía una campaña, el HTML final se guarda en la BD
3. Al abrir una campaña enviada, la "Vista Final del Correo" muestra el contenido real del email tal como fue enviado — incluyendo respetar si el CTA estaba desactivado
4. El preview NO se pierde al recargar la página (F5) porque el HTML viene de la BD, no de estado React volátil

## Relevant files

- `client/src/pages/CalendarView.tsx` — Vista Final del Correo (iframe srcDoc)
- `server/routes.ts` — `sendCampaignToWebhook()` donde se genera `renderedHtml`
- `server/storage.ts` — Agregar método para actualizar versión
- `shared/schema.ts` — Agregar columna `sentHtml` a `campaignVersions`
- `server/templates.ts` — Mantener regex CTA fallback (ya correcto)
