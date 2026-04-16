# Correcciones: Calendario, Imagen y Webhook Make

## What & Why
Corregir 4 bugs reportados por el usuario durante pruebas reales de la plataforma: programación de campañas el mismo día, edición de prompt de imagen, límite de caracteres en prompts de imagen, y formato HTML en el payload enviado a Make.

## Done looks like
- El usuario puede programar campañas para hoy a una hora futura (no solo días futuros)
- Al regenerar imagen, el prompt anterior aparece en el textarea y es completamente editable (se pueden hacer micro-cambios sin borrar todo)
- Todos los campos de prompt de imagen (regeneración completa y Nano Banana) aceptan hasta 1200 caracteres
- El payload JSON enviado a Make contiene `html_content` como HTML limpio estándar (sin xmlns, sin XHTML, sin caracteres escapados innecesariamente), compatible con motores de correo

## Out of scope
- Cambios en la lógica de Make.com o en los escenarios de Make
- Cambios en el flujo de generación de contenido de texto
- Nuevos features del calendario

## Tasks
1. **Programación mismo día** — Cuando el usuario selecciona el día actual en el calendario, la hora por defecto debe ser la próxima hora completa (no 09:00 si ya pasó). Validar que la comparación de fechas en backend funcione correctamente con la zona horaria del usuario.

2. **Textarea de regeneración de imagen editable** — Corregir el estado del textarea en el modal de regeneración de imagen para que el prompt precargado sea completamente editable sin necesidad de borrarlo.

3. **Subir límite de caracteres a 1200** — Cambiar el maxLength del textarea y la validación backend a 1200 en todos los campos de prompt de imagen: regeneración de imagen, edición de imagen estándar, y edición avanzada (Nano Banana).

4. **HTML limpio en payload a Make** — Asegurar que el campo `html_content` del payload enviado al webhook de Make contenga HTML estándar limpio (como el ejemplo de referencia del usuario), sin atributos XHTML como `xmlns`, sin self-closing tags innecesarios, y sin escapes de caracteres extra.

## Relevant files
- `client/src/pages/CalendarView.tsx`
- `server/routes.ts:277-283,318-327,564,613,677,1234-1322`
- `server/templates.ts`
