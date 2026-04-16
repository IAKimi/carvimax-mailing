# Función de reenviar campaña desde historial

## What & Why
El usuario necesita poder reenviar una campaña que ya fue enviada, reutilizando la misma plantilla e imagen pero pudiendo editar los textos, cambiar la base de datos de destino y programar una nueva fecha/hora de envío. Esto evita tener que recrear toda la campaña desde cero cuando el resultado visual fue bueno pero se quiere enviar a otra audiencia o con un mensaje diferente.

## Done looks like
- En el historial de campañas (sección "Mis Correos"), cada campaña enviada tiene un botón "Reenviar"
- Al hacer clic en "Reenviar", se abre un panel con:
  - Preview completo del correo original tal como se envió
  - Botón "Editar textos" que permite modificar solo el contenido textual (asunto, preheader, cuerpo, CTA texto, CTA URL) manteniendo la plantilla e imagen intactas
  - Selector de base de datos (la misma u otra)
  - Selector de fecha y hora de programación
- Al confirmar, se crea una nueva campaña como copia de la original con estado "scheduled"
- Se redirige al calendario en el día programado
- En el editor de esa campaña clonada, NO se muestran los editores de imagen ni texto (ya viene pre-llenada), solo el preview final y el botón "Publicar ahora"
- La campaña clonada mantiene referencia a la campaña original

## Out of scope
- Edición de la imagen en el flujo de reenvío (se mantiene la original)
- Edición de la plantilla HTML en el flujo de reenvío
- Reenvío automático a contactos que fallaron (eso es otra feature)

## Tasks
1. **Endpoint de clonado de campaña** — Crear ruta POST `/api/campaigns/:id/resend` que clone la campaña original: misma plantilla, misma imagen, mismos textos (editables), nueva fecha, nueva base de datos. Crea una nueva campaña con status "draft" o "scheduled" y copia la versión seleccionada.
2. **UI de reenvío en historial** — En MyEmails, agregar botón "Reenviar" en cada campaña con status "sent". Al hacer clic, abrir diálogo/panel con preview del correo original.
3. **Edición de textos en reenvío** — Dentro del panel de reenvío, permitir editar asunto, preheader, cuerpo HTML, CTA texto y CTA URL inline. Mostrar preview actualizado en tiempo real.
4. **Selector de BD y fecha/hora** — Agregar selector de base de datos de destino y un date-time picker para la fecha de envío.
5. **Flujo de campaña clonada en calendario** — Cuando se abre una campaña que viene de reenvío, mostrar solo el preview y el botón "Publicar ahora" (sin editores de imagen/texto).

## Relevant files
- `client/src/pages/MyEmails.tsx`
- `client/src/pages/CalendarView.tsx`
- `server/routes.ts`
- `server/storage.ts`
- `shared/schema.ts`
