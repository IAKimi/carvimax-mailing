# Validación pre-envío, fix preview y fecha en historial

## What & Why
Múltiples bugs de UI y falta de validación afectan la experiencia: (1) el preview recorta la imagen a 200px de alto, (2) no se valida que todos los campos requeridos estén llenos antes de enviar, (3) el historial no muestra hora de envío. Estos son fixes directos que mejoran la calidad y evitan envíos incompletos.

## Done looks like
- La previsualización del correo muestra la imagen completa sin recorte (height:auto en lugar de height:200px)
- Al hacer clic en "Publicar" o "Enviar ahora", el sistema valida: asunto, preheader, contenido HTML, CTA texto, CTA URL, imagen. Si falta alguno, muestra alerta en español indicando cuáles faltan y resalta visualmente con borde rojo los campos faltantes (similar al tutorial del bombillo)
- El botón CTA no se envía vacío: si no hay URL de CTA, no se permite publicar
- En el historial de campañas, cada entrada muestra fecha Y hora de envío (no solo la fecha)
- La validación server-side también bloquea envíos con campos críticos vacíos

## Out of scope
- Cambiar el diseño completo del panel de edición
- Validación de formato de email en los contactos

## Tasks
1. **Fix preview imagen cortada** — Cambiar `height:200px;object-fit:cover` a `height:auto` en los iframes de preview del correo en CalendarView.
2. **Validación frontend pre-publicación** — Al hacer clic en "Publicar" o "Enviar ahora", validar todos los campos requeridos. Mostrar toast/alerta con la lista de campos faltantes. Resaltar visualmente los campos faltantes con borde rojo animado.
3. **Validación server-side pre-envío** — En la función `sendCampaignToWebhook`, verificar que la versión seleccionada tenga asunto, preheader, cuerpo_html, cta_text con contenido, y que exista cta_url y imageUrl antes de proceder.
4. **Agregar hora al historial** — En la sección de historial de campañas, mostrar fecha y hora (formato: "13 de marzo de 2026 a las 15:00") en lugar de solo la fecha.

## Relevant files
- `client/src/pages/CalendarView.tsx:1520-1540,680-770,935-967`
- `server/routes.ts:1390-1470`
- `client/src/pages/MyEmails.tsx`
