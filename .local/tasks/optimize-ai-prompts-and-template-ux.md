# Optimización de prompts IA y mejoras UX de plantillas

## What & Why
La generación de plantillas con IA tarda ~120 segundos por enviar datos innecesarios en los prompts y generar 2 variantes simultáneas. Se necesita: optimizar los prompts enviados a cada servicio IA (OpenAI texto, OpenAI plantillas, Gemini imagen), cambiar a generación de 1 sola plantilla, añadir edición manual de textos hardcodeados en plantillas, y bloquear edición IA tras confirmar.

## Done looks like
- **Generación de plantillas**: Tarda significativamente menos (~30s o menos). Solo se envía al prompt de OpenAI: nombre empresa, industria, productos/servicios, colores, tipografías, logo URL y estilo visual. No se envía misión, visión, historia, audiencia, tono, guía de estilo.
- **Generación de contenido de campaña** (texto del correo): Solo se envía nombre empresa, industria, misión, visión, productos/servicios, historia, guía de estilo y tono. No se envían colores, tipografías, logo ni estilo visual.
- **Generación de imagen con Gemini**: Solo se envía el prompt del usuario y la acción seleccionada (reemplazar/agregar/eliminar). No se envía ningún dato de identidad de marca.
- **1 sola variante**: Al crear con IA solo se genera 1 plantilla. El usuario tiene 3 regeneraciones disponibles y puede elegir entre las versiones generadas antes de confirmar.
- **Edición manual de textos**: Al hacer clic en el ícono de lápiz de una plantilla, se abre un formulario que muestra los textos hardcodeados (no los placeholders dinámicos) y permite editarlos in situ sin cambiar posición ni estilos.
- **Confirmar bloquea edición IA**: Una vez confirmada la plantilla, desaparecen los botones de "Editar con IA" y "Regenerar". Solo quedan habilitados: previsualización, renombrar y edición manual de textos.

## Out of scope
- Drag-and-drop de elementos en la plantilla
- Cambio de posición de secciones
- Edición de placeholders dinámicos ({{CONTENIDO}}, {{CTA_TEXTO}}, etc.)
- Cambios al esquema de base de datos

## Tasks
1. **Reducir prompt de generación de plantillas** — En `buildTemplateInstructions()` de `server/openai.ts`, enviar solo: companyName, industry, products, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, logoUrl, visualStyle, website, whatsapp. Eliminar: mission, vision, history, targetAudience, tone, styleGuide.

2. **Reducir prompt de generación de contenido de campaña** — En `buildInstructions()` de `server/openai.ts`, enviar solo: companyName, industry, mission, vision, products, history, styleGuide, tone, targetAudience. Eliminar: primaryColor, secondaryColor, accentColor, headingFont, bodyFont, logoUrl, visualStyle, website, whatsapp.

3. **Limpiar datos enviados a Gemini** — En las funciones de generación/edición de imagen en `server/gemini.ts` y las rutas correspondientes en `server/routes.ts`, asegurarse de que solo se envíe el prompt del usuario y la acción seleccionada. No enviar datos de brand identity.

4. **Cambiar a generación de 1 sola variante** — Modificar la ruta `POST /api/templates/generate` para generar solo 1 plantilla. Actualizar `Templates.tsx` para eliminar el diálogo de comparación de 2 variantes y mostrar directamente la plantilla generada. Mantener la lógica de 3 regeneraciones para generar versiones alternativas.

5. **Edición manual de textos hardcodeados** — Crear un formulario que parsee el HTML de la plantilla, identifique los textos que NO son placeholders dinámicos (como títulos, frases de footer, etc.), y permita editarlos. El formulario se abre al hacer clic en el ícono de lápiz de la plantilla. Los cambios se guardan actualizando el HTML directamente.

6. **Bloquear edición IA tras confirmar** — Cuando `isConfirmed === true`, ocultar los botones de "Editar con IA", "Regenerar" y cualquier opción de generación IA. Solo dejar visible: previsualización (ojo), renombrar, edición manual de textos, y eliminar.

## Relevant files
- `server/openai.ts:1-470`
- `server/gemini.ts`
- `server/routes.ts:1068-1123`
- `client/src/pages/Templates.tsx`
