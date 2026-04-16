# Separar regeneraciones de imagen y texto

## What & Why
Actualmente ambos botones (regenerar imagen y regenerar texto) comparten un solo contador basado en `versions.length`. Regenerar una imagen consume una "regeneración" que le quita al texto y viceversa. Además, al regenerar texto se crea una nueva versión que duplica la imagen anterior, y al regenerar imagen se crea una nueva versión que duplica el texto anterior. Hay que separar completamente ambas funcionalidades para que el usuario tenga 3 regeneraciones de imagen independientes y 3 regeneraciones de texto independientes.

## Done looks like
- El usuario puede regenerar imagen hasta 3 veces sin afectar el contador de texto
- El usuario puede regenerar texto hasta 3 veces sin afectar el contador de imagen
- Al regenerar texto, NO se duplica la imagen ni se crea una "versión de imagen" nueva
- Al regenerar imagen, NO se duplica el texto ni se crea una "versión de texto" nueva
- El botón de regenerar imagen muestra "(X restantes)" basado solo en regeneraciones de imagen
- El botón de regenerar texto muestra "(X restantes)" basado solo en regeneraciones de texto
- El historial de imágenes muestra solo versiones de imagen, ordenadas de V1 a VN de izquierda a derecha
- El historial de textos muestra solo versiones de texto, ordenadas de V1 a VN

## Out of scope
- Cambiar el límite de 3 regeneraciones
- Agregar generación de nuevas plantillas

## Tasks
1. **Agregar campos de conteo al esquema** — Añadir `imageRegenCount` y `textRegenCount` a la tabla de campañas para rastrear regeneraciones independientemente. Agregar campo `type` a campaign_versions para distinguir si es versión de imagen o de texto.
2. **Modificar ruta de regenerar texto** — Al regenerar texto, crear una versión de tipo "text" que solo contiene el nuevo contentJson. No copiar ni duplicar imageUrl. Incrementar solo `textRegenCount`.
3. **Modificar ruta de regenerar imagen** — Al regenerar imagen, crear una versión de tipo "image" que solo contiene la nueva imageUrl. No copiar ni duplicar contentJson. Incrementar solo `imageRegenCount`.
4. **Actualizar frontend** — Los botones de regenerar imagen y texto deben usar sus contadores independientes. El historial de imágenes solo muestra versiones tipo "image". El historial de textos solo muestra versiones tipo "text". Ordenar ambos historiales por versionNumber ascendente (V1 a la izquierda).
5. **Ajustar selección de versión activa** — La versión "seleccionada" para envío debe combinar la última imagen seleccionada + el último texto seleccionado, no depender de una sola versión monolítica.

## Relevant files
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts:570-700`
- `client/src/pages/CalendarView.tsx:162-168,267-312,341-390,1148-1280,1430-1480`
