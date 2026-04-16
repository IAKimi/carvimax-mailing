---
title: Conversión automática de logo a PNG transparente
---
# Conversión automática de logo a PNG transparente

## What & Why
Cuando un usuario sube un logo en formato JPEG (sin transparencia), el logo se ve mal en las plantillas de email porque queda con fondo blanco sobre el banner/header. Actualmente el sistema acepta PNG, JPEG y WebP pero no convierte a PNG. Se necesita que el backend convierta automáticamente cualquier imagen subida a formato PNG para garantizar compatibilidad con transparencia en plantillas de email.

## Done looks like
- Al subir un logo en cualquier formato soportado (JPEG, PNG, WebP), el backend lo convierte automáticamente a PNG antes de guardarlo
- El archivo guardado en `uploads/logos/` siempre tiene extensión `.png`
- Si el usuario sube un JPEG, se muestra un aviso amigable en el frontend indicando que se convirtió automáticamente a PNG
- Las imágenes PNG que ya tienen transparencia se mantienen intactas (no se degrada la calidad)
- El límite de 2MB se sigue validando sobre el archivo original antes de la conversión

## Out of scope
- Remoción automática de fondos blancos (eso requeriría IA o procesamiento complejo)
- Cambios en los formatos aceptados por el input de archivo del frontend
- Migración de logos existentes ya subidos

## Tasks
1. **Instalar sharp en el backend** — Agregar la librería `sharp` como dependencia del proyecto para procesamiento de imágenes del lado del servidor.

2. **Convertir a PNG en el endpoint de upload** — Modificar el endpoint `POST /api/brand/logo-upload` para que use `sharp` para convertir cualquier imagen recibida (JPEG, WebP) a formato PNG antes de guardarla en disco. Guardar siempre con extensión `.png`.

3. **Respuesta con indicador de conversión** — Incluir en la respuesta JSON del endpoint un campo `converted: true/false` para que el frontend pueda mostrar un aviso cuando se hizo conversión automática.

4. **Aviso en el frontend** — Si la respuesta del upload incluye `converted: true`, mostrar un toast informativo indicando que el logo se convirtió a PNG para mejor compatibilidad con plantillas.

## Relevant files
- `server/routes.ts:1439-1474`
- `client/src/pages/BrandIdentity.tsx:595-632`