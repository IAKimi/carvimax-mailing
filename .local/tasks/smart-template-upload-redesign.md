# Rediseño Inteligente de Carga de Plantillas

## What & Why
El diálogo actual de "Cargar Plantilla HTML" tiene problemas de UX: muestra información técnica innecesaria (lista de placeholders, término "placeholders"), es pequeño, y la IA reemplaza ciegamente todos los elementos incluyendo los que el usuario ya trae en su plantilla (logo, imagen, botón, footer). El resultado es que el usuario pierde su contenido original y debe re-configurar campos que ya estaban correctos.

Se necesita:
1. **Rediseñar el diálogo** como ventana grande (split-view) con formulario a la izquierda y vista previa en tiempo real a la derecha.
2. **Eliminar jerga técnica** — no mencionar "placeholders", no listar variables dinámicas. Usar lenguaje amigable.
3. **Análisis inteligente de la IA** — que reconozca qué elementos ya existen (logo, imagen, botón CTA, footer) y SOLO inserte la variable dinámica `{{CONTENIDO}}` en el texto que realmente cambia entre campañas.
4. **Campos bloqueados en el editor** — que las plantillas subidas manualmente guarden metadatos de qué campos son fijos (ya vienen en la plantilla) y cuáles son dinámicos. En el editor de campañas, los campos fijos aparecen deshabilitados y la IA de texto solo genera contenido para los campos dinámicos.

## Done looks like
- El diálogo de "Cargar Plantilla" ocupa casi toda la pantalla, dividido en dos columnas: formulario (izq) y vista previa (der).
- No aparece la palabra "placeholders" ni la lista técnica de variables. En su lugar, un banner amarillo amigable dice algo como "Tu plantilla será analizada y adaptada automáticamente para funcionar con nuestra plataforma".
- Al pegar código HTML, la vista previa de la derecha se actualiza en tiempo real.
- El botón "Adaptar con IA" siempre aparece debajo del campo de código HTML (no condicionado a validación).
- Al hacer clic en "Adaptar con IA", la IA analiza el HTML, detecta elementos existentes (logo, hero image, botón CTA, footer/firma) y SOLO inserta `{{CONTENIDO}}` donde hay texto variable. La vista previa se refresca con el resultado.
- La tabla `templates` tiene un nuevo campo `lockedFields` (jsonb) que guarda cuáles campos están fijos en la plantilla (ej: `["imagen", "cta", "footer"]`).
- En el editor de campañas (CalendarView), cuando se selecciona una plantilla con campos bloqueados, esos campos aparecen deshabilitados con un indicador visual (ícono de candado o tooltip) explicando que ya vienen en la plantilla original.
- La generación de texto con OpenAI solo genera contenido para los campos dinámicos (típicamente solo `{{CONTENIDO}}`), respetando los campos bloqueados.

## Out of scope
- Cambios a la generación de plantillas con IA (solo afecta plantillas subidas manualmente).
- Cambios al flujo de edición de plantillas existentes.
- Migración de plantillas existentes ya cargadas.

## Tasks
1. **Rediseño del diálogo de carga** — Convertir el diálogo actual en ventana grande split-view. Izquierda: warning amarillo amigable, nombre, código HTML, botón "Adaptar con IA". Derecha: iframe de vista previa en tiempo real. Eliminar toda referencia a "placeholders" y la caja azul informativa.

2. **Nuevo prompt inteligente de análisis** — Modificar `analyzeTemplatePlaceholders` para que la IA retorne JSON con: el HTML adaptado y un array `lockedFields` indicando qué elementos ya existían en la plantilla original. Solo insertar `{{CONTENIDO}}` donde hay texto variable; mantener intactos logo, imágenes, botones y footer existentes. Mantener `{{ASUNTO}}` en title y `{{PREHEADER}}` como span oculto (invisibles al usuario).

3. **Schema y storage** — Agregar columna `lockedFields` (jsonb, nullable) a la tabla `templates`. Actualizar el endpoint `POST /api/templates/analyze-html` para devolver también `lockedFields`. Guardar `lockedFields` al crear la plantilla desde el diálogo de carga.

4. **Editor de campañas con campos bloqueados** — En CalendarView, leer `lockedFields` de la plantilla seleccionada y deshabilitar los campos correspondientes (asunto, preheader, contenido, CTA, imagen). Mostrar indicador visual de campo fijo.

5. **Generación de texto adaptada** — Cuando se genera texto con IA para una campaña que usa plantilla con campos bloqueados, el prompt solo debe generar contenido para los campos dinámicos (no bloqueados), típicamente solo el contenido principal.

## Relevant files
- `client/src/pages/Templates.tsx:750-895`
- `server/openai.ts:549-609`
- `shared/schema.ts:99-113`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/pages/CalendarView.tsx:1660-1949`
