# Fix plantillas, límites de regeneración y NanoBanano con imagen propia

## What & Why
Corregir 4 problemas identificados en producción que afectan la experiencia del usuario al trabajar con plantillas, regeneración de texto/imagen, y edición con NanoBanano.

## Done looks like
1. Al hacer clic en "Ver N versiones" en Plantillas, se muestran TODAS las versiones incluyendo la plantilla padre (no solo las hijas)
2. Cuando se agotan las 2 regeneraciones de imagen (incluyendo NanoBanano), el botón de Regenerar Imagen y el botón de Nano Banana desaparecen completamente (no solo se deshabilitan o muestran mensaje)
3. Cuando se agotan las 2 regeneraciones de texto, el botón de Regenerar Texto desaparece completamente
4. NanoBanano se puede usar sobre imágenes subidas manualmente por el usuario (no solo sobre imágenes generadas por IA). Si el usuario sube una foto propia y quiere editarla con NanoBanano, debe poder hacerlo

## Out of scope
- Cambiar los límites numéricos (se mantiene 1 original + 2 regeneraciones = 3 máximo)
- Cambios en la lógica del backend de regeneración
- Cambios en el modelo de datos

## Tasks
1. **Fix consulta de versiones de plantilla** — La función `getTemplateVersions` solo devuelve hijos (`parentTemplateId = id`) sin incluir al padre. Agregar la plantilla padre a los resultados para que el diálogo muestre todas las versiones.

2. **Ocultar botones de regeneración al llegar al límite** — Reemplazar el comportamiento actual (mostrar badge "Regeneraciones agotadas") por ocultar completamente los botones de Regenerar Imagen, Nano Banana y Regenerar Texto cuando `imageRegenCount >= 2` o `textRegenCount >= 2`.

3. **Habilitar NanoBanano para imágenes subidas manualmente** — Actualmente el botón de NanoBanano requiere que `selectedImageVersion?.imageUrl` exista (viene de generación IA). Permitir que NanoBanano funcione también cuando el usuario ha cargado una imagen propia vía upload, usando la URL de la imagen cargada como base para la edición.

## Relevant files
- `server/storage.ts:498-500`
- `client/src/pages/Templates.tsx:264-278`
- `client/src/pages/CalendarView.tsx:675-708`
- `client/src/pages/CalendarView.tsx:1604-1659`
- `client/src/pages/CalendarView.tsx:1919-1934`
- `client/src/pages/CalendarView.tsx:443-460`
- `server/routes.ts:2116-2126`
