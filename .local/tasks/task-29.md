---
title: Fix: Combinar texto e imagen al renderizar y enviar campañas
---
# Fix: Combinar texto e imagen al renderizar campañas

## What & Why
Bug crítico: cuando el usuario regenera la imagen de una campaña, se crea una nueva versión con `contentJson: {}` vacío y se marca como seleccionada. Al enviar o previsualizar, el sistema toma solo esa versión seleccionada, pierde todo el texto y el correo llega solo con la foto.

El comportamiento correcto: al renderizar una campaña (para previsualización o envío), el sistema debe combinar el texto de la versión de texto seleccionada con la imagen de la versión de imagen seleccionada. Son datos independientes que coexisten.

## Root cause
En `server/routes.ts`:
- Al regenerar imagen (líneas ~694, ~754, ~849): se crea versión con `contentJson: {}` (vacío)
- Al renderizar para preview (línea ~1415) y envío (línea ~1449): se busca UNA sola versión seleccionada `versions.find(v => v.isSelected)` y se usa su contentJson + imageUrl. Si la seleccionada es tipo "image", contentJson está vacío.

## Done looks like
1. Al renderizar para preview y envío, el sistema busca:
   - La versión de **texto** seleccionada (tipo "initial" o "text") → toma su `contentJson`
   - La versión de **imagen** seleccionada (tipo "initial" o "image") → toma su `imageUrl`
   - Combina ambas para renderizar el HTML completo

2. Como mejora adicional: al crear versiones de imagen, heredar el contentJson de la versión de texto seleccionada (así queda registro completo).

3. El endpoint de preview (`GET /api/campaigns/:id/preview`) debe usar la misma lógica de combinación.

4. El flujo de envío (`sendCampaignNow`) debe usar la misma lógica de combinación.

## Files to modify
- `server/routes.ts`:
  - Crear función helper `getResolvedCampaignContent(versions)` que retorna `{ contentJson, imageUrl }` combinando versiones de texto e imagen
  - Actualizar endpoint preview (~línea 1415)
  - Actualizar función sendCampaignNow (~línea 1449)
  - Actualizar creación de versiones de imagen (~líneas 694, 754, 849) para heredar contentJson

## Testing
- Crear una campaña, generar texto, luego regenerar la imagen → previsualizar → debe mostrar texto + imagen
- Regenerar el texto después → previsualizar → debe mostrar nuevo texto + imagen anterior
- Enviar la campaña → el correo debe llegar con texto completo + imagen