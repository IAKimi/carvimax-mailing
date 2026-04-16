# Fix: Aprobar Texto se resetea inmediatamente

## What & Why
Cuando el usuario hace clic en "Aprobar Texto", el toast "Texto aprobado" aparece pero el estado se revierte a no-aprobado inmediatamente. Esto bloquea al usuario al 50% y no puede avanzar a publicar la campaña.

**Causa raíz**: El editor TipTap dispara su callback `onUpdate` cuando se cambia su propiedad `editable` (de `true` a `false` al aprobar). Ese `onUpdate` llama a `handleTextChange`, que ejecuta `setTextApprovedLocal(false)`, revirtiendo la aprobación. Esto crea un ciclo: aprobado → editor no-editable → onUpdate falso → desaprobado → editor editable de nuevo.

## Done looks like
- Al hacer clic en "Aprobar Texto", el estado se mantiene aprobado de forma estable
- El progreso pasa a 100% cuando ambos (texto e imagen) están aprobados
- El usuario puede avanzar a programar y enviar la campaña sin bloqueos
- No se disparan PATCH requests innecesarios al servidor al aprobar texto

## Out of scope
- Cambios al flujo de aprobación de imagen (ya funciona correctamente)
- Cambios al flujo de reenvío o regeneración

## Tasks
1. **Guardar en TipTapEditor contra cambios espurios** — Evitar que el editor TipTap dispare `onChange` cuando se cambia la propiedad `editable` programáticamente. Usar una referencia (ref) para suprimir el callback `onUpdate` durante la transición de editabilidad.

2. **Guardar en handleTextChange contra texto aprobado** — Agregar una verificación al inicio de `handleTextChange` para no procesar cambios cuando el texto ya está aprobado, como segunda línea de defensa.

3. **Verificar flujo completo** — Confirmar que el ciclo crear campaña → generar contenido → aprobar imagen → aprobar texto → programar funciona sin reseteos inesperados.

## Relevant files
- `client/src/components/TipTapEditor.tsx`
- `client/src/pages/CalendarView.tsx:782-831`
- `client/src/pages/CalendarView.tsx:1560-1570`
- `client/src/pages/CalendarView.tsx:371-383`
