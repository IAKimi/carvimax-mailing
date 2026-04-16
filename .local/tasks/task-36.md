---
title: Limpiar campañas programadas y validación CTA
---
# Limpiar campañas programadas y validación CTA

## What & Why
Dos problemas post-migración a producción:
1. Campañas antiguas del entorno anterior quedaron en estado "scheduled" y el scheduler las sigue intentando enviar. Hay que limpiarlas para empezar de cero en producción.
2. Se puede aprobar texto y enviar una campaña sin URL en el botón CTA, lo cual envía correos con un botón roto. El usuario necesita poder: (a) eliminar el botón CTA si no lo necesita, o (b) ser bloqueado si el CTA está habilitado pero sin URL.

Nota: La URL del callback de Make.com la actualiza el usuario manualmente en Make. No requiere cambio de código.

## Done looks like
- Todas las campañas con estado "scheduled" o "sending" se limpian (cancelan) para empezar desde cero
- En el editor de texto, aparece un botón para eliminar/deshabilitar el CTA (icono de basurero o X junto al campo CTA)
- Cuando el CTA está deshabilitado, se ocultan los campos de texto del CTA y URL del botón
- Cuando el CTA está habilitado pero la URL está vacía, "Aprobar Texto" muestra un error y no permite avanzar
- Al enviar el correo, si el CTA está deshabilitado, el botón se elimina del HTML final
- Al generar el preview del correo, si el CTA está deshabilitado, no se muestra el botón

## Out of scope
- Cambios en Make.com (manual del usuario)
- Cambios a la lógica del scheduler (solo limpieza de datos)
- Cambios a las plantillas HTML base

## Tasks
1. **Limpiar campañas programadas** — Cancelar todas las campañas con estado "scheduled" o "sending" en la BD para empezar desde cero en producción. Esto es una operación de datos, no un cambio de lógica.

2. **Agregar toggle para deshabilitar CTA** — Añadir un estado local `ctaEnabled` (default true) en el editor de campaña. Mostrar un botón de eliminar (icono basurero/X) junto a los campos de CTA. Al deshabilitarlo, ocultar los campos "Botón de acción (CTA)" y "Enlace del botón (URL)". Guardar este estado en el contentJson de la versión.

3. **Validar CTA URL al aprobar texto** — En `handleApproveText`, si el CTA está habilitado y la URL está vacía o no es válida, mostrar toast de error "Falta el enlace del botón CTA" y bloquear la aprobación.

4. **Eliminar botón CTA del HTML al enviar** — Si `ctaEnabled` es false, eliminar el botón CTA del HTML final antes de enviar y en el preview. Asegurar que el correo se renderice correctamente sin el botón.

## Relevant files
- `server/routes.ts:1600-1674`
- `server/routes.ts:2072-2140`
- `client/src/pages/CalendarView.tsx:796-835`
- `client/src/pages/CalendarView.tsx:1576-1610`
- `client/src/pages/CalendarView.tsx:1060-1120`