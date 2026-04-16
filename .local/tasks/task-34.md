---
title: Persistir estado de aprobación texto/imagen en BD
---
# Persistir estado de aprobación de texto e imagen en campañas

## What & Why
Los estados `textApproved` e `imageApproved` en el editor de campañas (CalendarView) son estado local de React (`useState`). Esto significa que se pierden al remontar el componente, refrescar la página, o si hay interrupciones de sesión. En producción detrás de proxy inverso (Traefik/Coolify), se han observado micro-cortes de sesión (401 intermitentes) que causan que el componente se remonte y pierda los estados de aprobación. El usuario ve el toast "Texto aprobado" pero el progreso no sube al 100% porque el estado se pierde inmediatamente.

## Done looks like
- Al aprobar texto o imagen, el estado se guarda en la base de datos (columnas `textApproved` y `imageApproved` en la tabla `campaigns`)
- Al abrir una campaña en el editor, el estado de aprobación se lee desde la BD y se muestra correctamente
- El progreso (0%/50%/100%) persiste entre recargas de página y reconexiones de sesión
- Desaprobar (click en "Desaprobar") también se persiste en la BD
- Regenerar texto/imagen resetea el flag correspondiente en la BD
- Crear nueva campaña inicializa ambos flags en false

## Out of scope
- Cambios en la lógica de sesión o cookies (ya corregido con `secure: "auto"`)
- Cambios en el flujo de generación de contenido IA
- Cambios en la lógica de envío de campañas

## Tasks
1. **Agregar columnas al schema** — Añadir `textApproved` (boolean, default false) e `imageApproved` (boolean, default false) a la tabla `campaigns` en el schema de Drizzle y aplicar la migración.
2. **Actualizar backend** — Permitir que el endpoint PATCH `/api/campaigns/:id` acepte y guarde `textApproved` e `imageApproved`. Actualizar el schema de validación Zod.
3. **Actualizar frontend** — En CalendarView, inicializar `textApproved`/`imageApproved` desde los datos de la campaña en lugar de `useState(false)`. Al aprobar/desaprobar, llamar al PATCH de campaña para persistir. Eliminar los resets locales innecesarios que causan pérdida de estado.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts:130-160`
- `client/src/pages/CalendarView.tsx:171-172,326-327,492-493,504-505,718,737,748-749,778,805,814,824,891`