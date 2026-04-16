---
title: Failsafe Gemini: modelo de respaldo automático
---
# Failsafe con modelo Gemini de respaldo

## What & Why
Agregar un modelo Gemini de respaldo (`gemini-2.0-flash`) que se active automáticamente cuando el modelo principal (`gemini-3.1-flash-image-preview`) falla después de agotar sus 3 reintentos. Esto garantiza que los usuarios siempre reciban una imagen generada, incluso cuando el modelo principal tiene problemas de disponibilidad en Google.

## Done looks like
- Cuando el modelo principal falla 3 veces seguidas con errores de servidor (500/502/503/429), el sistema automáticamente intenta con `gemini-2.0-flash` (1-2 intentos adicionales)
- Si el modelo de respaldo también falla, ahí sí se muestra el error al usuario
- Las 3 funciones de Gemini (generateImage, editImage, editImageAdvanced) tienen este comportamiento de failsafe
- En los logs del servidor se registra cuándo se activó el modelo de respaldo para monitoreo
- El usuario no percibe el cambio de modelo — simplemente recibe su imagen

## Out of scope
- Cambiar el modelo principal (sigue siendo `gemini-3.1-flash-image-preview`)
- Agregar modelos de otros proveedores (DALL-E, etc.) como respaldo
- Cambios en el frontend — el failsafe es 100% backend y transparente para el usuario

## Tasks
1. **Refactorizar `fetchGeminiWithRetry`** — Extraer el nombre del modelo de las URLs hardcodeadas y convertirlo en parámetro configurable. Definir constantes para el modelo principal y el de respaldo.

2. **Implementar lógica de failsafe** — Crear una función wrapper que ejecute la petición con el modelo principal, y si falla tras los reintentos, automáticamente repita la misma petición sustituyendo el modelo por `gemini-2.0-flash`. Agregar logging claro cuando se activa el respaldo.

3. **Aplicar failsafe a las 3 funciones** — Asegurar que `generateImage`, `editImage` y `editImageAdvanced` usen la nueva lógica de failsafe con modelo de respaldo.

## Relevant files
- `server/gemini.ts`