# Correcciones MyEmails + popup de reenvío + fix admin

## What & Why
El historial de correos (MyEmails) tiene varios problemas: muestra "Correo enviado el [fecha]" en lugar del asunto de la campaña, el campo "Base de datos destino" muestra el ID numérico en vez del nombre, y el botón "Reenviar campaña" redirige directamente al calendario sin dar opción de configurar. Además, en el panel de administración, la actividad reciente también muestra el prompt en vez del nombre/asunto real.

## Done looks like
- En el historial, cada campaña muestra el asunto del correo generado por la IA (del contentJson de la versión seleccionada) como título, seguido de la fecha y hora de envío
- El campo "Base de datos destino" muestra el nombre de la base de datos, no su ID numérico
- Al hacer clic en "Reenviar campaña", se abre un popup/modal con:
  - Previsualización del correo enviado (iframe o HTML renderizado)
  - Campo editable para modificar los textos del correo manualmente
  - Selector de base de datos (puede mantener la misma o cambiar)
  - Selector de fecha y hora para el nuevo envío
  - Botón "Agregar a calendario" que crea la campaña duplicada como programada con la nueva fecha y redirige al calendario mostrando esa campaña lista para publicar
- En la pestaña de edición del calendario, si la campaña viene de un reenvío, se muestra como si ya estuviera aprobada, lista solo para "Publicar ahora" o dejarla programada
- En el panel admin (AdminUsers.tsx), la actividad reciente muestra el nombre real de la campaña o su asunto generado, no el prompt

## Out of scope
- Cambios en la generación inicial de campañas
- Cambios en el flujo normal de creación desde el calendario

## Tasks
1. **Mostrar asunto en historial** — Cargar las versiones seleccionadas de las campañas para extraer el `subject` del `contentJson` y mostrarlo como título en la lista del historial en vez de "Correo enviado el...".
2. **Resolver nombre de base de datos** — En el detalle expandido, hacer lookup del nombre de la base de datos por su ID para mostrar el nombre real en vez del número.
3. **Popup de reenvío** — Reemplazar la redirección inmediata por un modal/dialog que muestre: preview del correo, campos editables para textos (asunto, preheader, body, CTA), selector de base de datos, selector de fecha/hora, y botón "Agregar a calendario".
4. **Backend de reenvío mejorado** — Modificar el endpoint POST `/api/campaigns/:id/resend` para aceptar campos editados (textos, base de datos, fecha programada) y crear la campaña con status "scheduled" y los datos proporcionados, con la versión ya marcada como aprobada.
5. **Vista de edición para reenvíos** — Si la campaña viene de un reenvío (se puede detectar por nombre con "(reenvío)" o un flag), mostrarla en el calendario como ya aprobada, solo con opción de "Publicar ahora".
6. **Fix admin actividad reciente** — En el endpoint de actividad del admin y en AdminUsers.tsx, mostrar el asunto generado (del contentJson) en vez del campo `name` de la campaña.

## Relevant files
- `client/src/pages/MyEmails.tsx`
- `client/src/pages/CalendarView.tsx:550-580`
- `client/src/pages/AdminUsers.tsx:549`
- `server/routes.ts:864-903`
- `server/storage.ts:570-586`
