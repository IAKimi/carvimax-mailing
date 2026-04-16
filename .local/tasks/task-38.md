---
title: Parche producción: bugs de regeneración, CTA, imagen, webhook y vista enviado
---
# Parche producción: bugs de regeneración, CTA, imagen, webhook y vista enviado

## What & Why
Corregir 9 bugs encontrados durante pruebas en producción que afectan la experiencia del usuario al crear y enviar campañas. S1 y S2 ya están implementados. S3 está parcialmente hecho (falta corregir contador visual).

## Done looks like
1. **S1 — YA HECHO**: Botones de regeneración se ocultan al alcanzar límite.
2. **S2 — YA HECHO**: Toasts muestran mensajes limpios sin JSON crudo.
3. El contador visual del CTA muestra "/40" en vez de "/25".
4. Al cambiar entre versiones de texto, si la imagen está aprobada, la imagen no cambia — permanece fija.
5. Si el usuario desactiva el CTA pero la plantilla base tiene todos los placeholders, se muestra tag naranja "Editada" en vez de "Incompleta".
6. El webhook secret es alfanumérico sin caracteres especiales que causan 403.
7. La imagen hero llega correctamente en los correos enviados desde producción.
8. Cuando el usuario desactiva el CTA, el correo enviado NO incluye el botón CTA.
9. La vista "Enviando..." muestra el preview correctamente, no en blanco.

## Out of scope
- Nuevas funcionalidades o cambios de diseño no relacionados con estos 9 bugs.
- Cambios en el flujo draft→scheduled (ya resueltos en Task #37).

## Tasks

### S1: Ocultar botones de regeneración al alcanzar límite — YA HECHO

### S2: Limpiar mensajes de error en toasts — YA HECHO

### S3: Corregir contador visual CTA "/25" → "/40"
- El `maxLength` ya está en 40, pero el span de texto todavía dice `{localCta.length}/25`. Cambiar a `/40` en CalendarView.tsx línea 1699.

### S4: Imagen aprobada NO cambia al cambiar versión de texto
- Agregar estado `approvedImageUrl` en CalendarView.tsx.
- Cuando `handleApproveImage` se llama, capturar la URL actual en `approvedImageUrl`.
- En la derivación de `selectedImageUrl` (línea 964), si `imageApproved === true`, usar `approvedImageUrl`.
- Cuando se desaprueba la imagen, limpiar `approvedImageUrl`.

### S5: Tag "Editada" en vez de "Incompleta" cuando CTA desactivado
- En la sección de plantillas (líneas 1993-2000), agregar condición: si `hasAllPlaceholders` es true en la plantilla base Y `ctaEnabled === false`, mostrar tag naranja "Editada" en vez de "Incompleta".
- No deshabilitar la selección de la plantilla cuando es "Editada".

### S6: Webhook secret alfanumérico
- Generar nuevo secret alfanumérico sin caracteres especiales.
- Configurar en env var `MAKE_WEBHOOK_SECRET`.
- El usuario deberá pegar el mismo valor en Coolify y en Make.com HTTP header `x-webhook-secret`.

### S7: Imagen hero no llega en correo enviado
- ROOT CAUSE: En `sendCampaignToWebhook` (línea 1608), `getImagePublicUrl(resolved.imageUrl)` se llama sin `req`. Sin `req`, usa `REPLIT_DOMAINS` que NO existe en producción (Coolify). Solución: añadir soporte para variable de entorno `APP_URL` o `PRODUCTION_URL` en `getImagePublicUrl` como fallback antes de `REPLIT_DOMAINS`.

### S8: CTA se envía aunque el usuario lo desactivó
- ROOT CAUSE: `getResolvedCampaignContent` resuelve el `contentJson` de la versión seleccionada. Si el usuario editó el contenido en el frontend con `cta_enabled: false`, esto se guarda en la versión. Pero al editar campos individuales vía PATCH, puede que `cta_enabled` no se persista correctamente en la versión. Verificar que cuando el usuario guarda con CTA desactivado, el campo `cta_enabled: false` está presente en el `contentJson` de la versión seleccionada en la DB.

### S9: Vista "Enviando..." en blanco
- ROOT CAUSE: Cuando una campaña está en estado "sending", el preview construye `srcDoc` usando `selectedHtml` que depende de `selectedTextVersion`. Si las versiones cargan correctamente pero `contentData` no tiene el campo esperado (`cuerpo_html`, `html`, o `body`), el contenido queda vacío. Verificar que el iframe se construye correctamente para campañas en estado "sending" — probablemente relacionado con S7 (imagen URL inválida que podría bloquear el render).

## Relevant files
- `client/src/pages/CalendarView.tsx:964,1179-1238,1699,1993-2000`
- `server/routes.ts:25-36,231-245,1580-1660`
- `server/templates.ts:78-125`
- `client/src/lib/queryClient.ts`