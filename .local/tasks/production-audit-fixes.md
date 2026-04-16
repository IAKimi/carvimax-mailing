# Correcciones de auditoría de producción

## What & Why
La auditoría de logs de producción del 27 de marzo 2026 reveló 3 problemas en el código que deben corregirse: rutas API inexistentes respondiendo 200, falta de reintentos en Gemini, e imágenes de error que se pueden aprobar. Estos causan falsos positivos en escáneres de seguridad, mala experiencia al usuario cuando Gemini tiene caídas temporales, y campañas que quedan con imágenes rotas.

## Done looks like
- Las rutas `/api/*` que no existen devuelven 404 en lugar de 200 (el frontend solo se sirve en rutas no-API)
- La generación de imágenes con Gemini reintenta automáticamente hasta 3 veces con espera progresiva antes de fallar
- No se puede aprobar una imagen si la URL es el placeholder de error (`placehold.co/...Error+generando+imagen`)
- La pantalla roja de error de imagen se reemplaza por un mensaje más amigable con opción clara de reintentar

## Out of scope
- Cambiar el modelo de Gemini (decisión del usuario)
- Configurar MAKE_WEBHOOK_SECRET en Coolify (tarea manual del usuario)
- Cambios en el flujo de eliminación de plantillas (el bloqueo actual es intencional)

## Tasks
1. **Catch-all 404 para rutas API** — Agregar un middleware antes del catch-all del frontend que responda 404 JSON para cualquier ruta `/api/*` que no coincida con un endpoint definido.

2. **Retry con backoff exponencial para Gemini** — En la función de generación de imagen, implementar hasta 3 reintentos con espera progresiva (2s, 4s, 8s) cuando Gemini devuelva error 500/503. Solo reintentar en errores de servidor, no en errores de cliente (400, 401, 403).

3. **Bloquear aprobación de imagen placeholder** — En la ruta de aprobación de imagen, validar que la URL no sea el placeholder de error antes de permitir aprobarla. Mostrar mensaje claro al usuario indicando que debe regenerar la imagen primero.

4. **Mejorar UX de error de imagen** — En el frontend, cuando la imagen de una campaña es el placeholder de error, mostrar un estado visual amigable (no pantalla roja completa) con botón de "Reintentar generación" en lugar de solo el placeholder rojo.

## Relevant files
- `server/routes.ts:869-901`
- `server/routes.ts:1520-1539`
- `server/gemini.ts`
- `server/vite.ts`
- `client/src/pages/CampaignEditor.tsx`
