# Mejoras UX de Plantillas + Historial

## What & Why
La sección de plantillas tiene varios problemas de usabilidad que confunden al usuario y el botón "Vaciar historial" del calendario es peligroso y está mal ubicado. Este task agrupa 6 mejoras concretas que impactan la experiencia del usuario directamente.

## Done looks like
1. **Límite de regeneración IA de plantillas corregido** — La primera generación con IA ya cuenta como 1/3, dejando solo 2 regeneraciones adicionales (botón "Nueva versión IA"). El contador muestra "1/3 versiones" desde el momento en que se crea la plantilla. El backend también valida este límite.
2. **Diálogo "Editar Textos" mejorado** — En vez de mostrar un campo separado por cada nodo de texto individual (Texto 1, Texto 2, Texto 3), los textos se agrupan por bloque visual padre (la celda `<td>` o `<div>` contenedor). Si 3 nodos de texto están en el mismo footer, aparecen como un solo campo editable con una etiqueta descriptiva (ej. "Pie de página" en vez de "Texto 1"). Solo se muestran campos separados cuando los textos están en secciones HTML distintas.
3. **Nombres de plantillas IA estandarizados** — En vez de que la IA genere nombres descriptivos feos como "Plantilla email con banner verde, titular azul mayúscula y botón verde", las plantillas generadas reciben nombres limpios y genéricos: "Plantilla 1", "Plantilla 2", etc. basados en el conteo de plantillas existentes del usuario. Las versiones se nombran "Plantilla N (v2)", "Plantilla N (v3)".
4. **Auto-inserción de placeholders con IA en "Cargar Plantilla"** — Cuando el usuario pega HTML propio que no incluye los placeholders requeridos, en vez de solo mostrar un aviso, se ofrece un botón "Adaptar con IA" que envía el HTML a OpenAI con un prompt que le indica mantener toda la estructura y diseño intactos, solo insertando los placeholders dinámicos ({{ASUNTO}}, {{CONTENIDO}}, {{CTA_TEXTO}}, {{CTA_URL}}, {{IMAGEN_URL}}, {{PREHEADER}}) en las posiciones lógicas correctas. El usuario ve el resultado en el preview antes de guardar.
5. **Bloqueo suave por plantillas sin confirmar** — Si el usuario tiene plantillas en estado borrador (versiones sin confirmar después de editar con IA), al intentar navegar al Calendario aparece un toast/banner de advertencia: "Tenés plantillas sin confirmar. Confirmá o eliminá las versiones pendientes antes de programar campañas." El Calendario no se bloquea por completo, pero al intentar crear una nueva campaña se valida que la plantilla seleccionada esté confirmada.
6. **Eliminar "Vaciar historial" del Calendario → mover a Historial de Correos** — El botón "Vaciar historial" se elimina del calendario. En la página "Mis Correos" (/emails) se agrega: (a) checkboxes para seleccionar campañas individualmente, (b) botón "Eliminar seleccionados", (c) botón "Vaciar todo el historial" con confirmación. Al eliminar, se eliminan las campañas de la base de datos y se reflejan los cambios en el calendario.

## Out of scope
- Drag & drop de plantillas
- Editor visual WYSIWYG de plantillas
- Cambios en el sistema de envío/webhook
- Cambios en el panel de administración

## Tasks
1. **Ajustar límite de regeneración IA** — Cambiar la lógica de conteo en frontend y backend para que la generación original cuente como versión 1 de 3. El botón "Nueva versión IA" solo aparece si hay menos de 3 versiones (contando la original). El badge muestra "1/3" desde la creación.

2. **Agrupar textos por bloque en "Editar Textos"** — Modificar la función `extractTextNodes` para que agrupe nodos de texto que comparten el mismo contenedor padre (buscar el `<td>` o `<div>` ancestro más cercano). Mostrar un campo por grupo con etiqueta descriptiva. Actualizar `applyTextEdits` para mapear el texto editado de vuelta a los nodos individuales.

3. **Estandarizar nombres de plantillas** — Cambiar la generación de nombres para usar formato "Plantilla N" donde N es el siguiente número disponible para el usuario. Remover la instrucción de nombre descriptivo del prompt de OpenAI. Actualizar el sufijo de versiones.

4. **Implementar auto-inserción de placeholders con IA** — Crear endpoint backend que reciba HTML arbitrario y lo envíe a OpenAI con prompt de inserción de placeholders. Agregar botón "Adaptar con IA" en el diálogo de "Cargar Plantilla" que se muestre cuando faltan placeholders. Mostrar resultado en preview antes de guardar.

5. **Validación de plantillas sin confirmar** — Agregar verificación al navegar al calendario y al crear campaña nueva: si el usuario tiene plantillas con versiones sin confirmar, mostrar advertencia. Al seleccionar plantilla para campaña, solo mostrar plantillas confirmadas o sin versiones pendientes.

6. **Mover eliminación de campañas a Historial de Correos** — Eliminar el botón "Vaciar historial" de CalendarView. En MyEmails agregar selección múltiple con checkboxes, botón "Eliminar seleccionados" y "Vaciar historial" con diálogo de confirmación. Las eliminaciones actualizan el calendario automáticamente vía invalidación de cache.

## Relevant files
- `client/src/pages/Templates.tsx`
- `client/src/pages/CalendarView.tsx`
- `client/src/pages/MyEmails.tsx`
- `server/routes.ts:1339-1510`
- `server/openai.ts:416-500`
- `server/templates.ts`
- `shared/schema.ts:127-134`
