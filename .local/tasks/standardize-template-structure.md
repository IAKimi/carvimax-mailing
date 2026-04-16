# Estandarizar estructura HTML de plantillas generadas por IA

## What & Why
Actualmente, la IA genera la estructura HTML completa desde cero en cada solicitud, lo que produce plantillas con estructuras inconsistentes. La plantilla "Plantilla PostIAlo Mailing" (ID 52, en seed-data.json) tiene la estructura ideal que debe ser el estándar para todas las plantillas generadas.

El cambio consiste en pasar de "la IA inventa toda la estructura" a "la IA adapta una estructura base fija según las preferencias cosméticas del usuario". La estructura fija es siempre: Banner (logo esquina superior izquierda + asunto centrado) → Imagen → Contenido → Botón CTA → Footer.

## Done looks like
- Toda plantilla generada por IA sigue la estructura fija: Banner (logo + asunto) → Imagen → Contenido → Botón CTA → Footer
- El orden de los bloques NUNCA cambia, sin importar el prompt del usuario
- El logo de la identidad de marca aparece siempre en la esquina superior izquierda del banner
- El `{{ASUNTO}}` siempre aparece centrado en el banner con fondo del color primario
- El usuario puede personalizar vía su prompt: colores de texto, estilos de fuente (negrita, tamaño), formato del contenido (tablas, relieves, listas), dimensiones/alineación de la imagen (centrada, full-width, con bordes, etc.)
- El usuario NO puede cambiar: orden de bloques, posición del logo, posición del asunto centrado, posición relativa imagen→contenido→botón→footer
- Los modales de "Crear con IA" y "Editar con IA" muestran un disclaimer explicando la estructura estándar y qué puede personalizar
- Las plantillas ya existentes no se ven afectadas
- El sistema de versiones (hasta 3, comparar, confirmar) sigue funcionando igual

## Out of scope
- Cambios a la generación de contenido de campañas (solo afecta la generación de plantillas HTML)
- Migración de plantillas existentes a la nueva estructura
- Cambios al sistema de placeholders (se mantienen los 6 existentes)
- Cambios al análisis de placeholders (`/api/templates/:id/analyze`)

## Tasks
1. **Crear plantilla HTML base como constante** — Extraer la estructura HTML de la plantilla "Plantilla PostIAlo Mailing" (ID 52 en seed-data.json) y crear una constante en openai.ts con la estructura genérica parametrizada (colores, fuentes, logo como variables). Esta es la "plantilla madre" inmutable que se pasará a la IA.

2. **Rediseñar `buildTemplateInstructions`** — Reescribir la función para que en lugar de pedir a la IA que genere la estructura HTML completa, le pase la plantilla base como ejemplo inmutable e instruya que solo puede modificar aspectos cosméticos dentro de cada bloque (colores, fuentes, estilos, formato del contenido, dimensiones de imagen) sin alterar el orden ni posición de los bloques. Inyectar los datos de marca del usuario (colores primario/secundario/acento, fuentes, logo) como parámetros de personalización.

3. **Actualizar `generateTemplateHtml`** — Asegurar que pase la plantilla base + datos de marca correctamente al prompt rediseñado.

4. **Actualizar `editTemplateHtml`** — Asegurar que las instrucciones de edición de IA también respeten la restricción de estructura fija, prohibiendo que la IA altere el orden de bloques al recibir instrucciones del usuario.

5. **Eliminar `VARIANT_INSTRUCTIONS`** — Remover la constante de variantes A/B de layout (actualmente sin uso activo pero definida en openai.ts) ya que con la estructura fija no aplican variaciones de layout.

6. **Agregar disclaimers en la UI** — En Templates.tsx, agregar un aviso breve en el modal de "Crear con IA" (Dialog línea ~801) y en el modal de "Editar con IA" (Dialog línea ~849) indicando al usuario que la estructura del correo sigue un formato estándar (Banner → Imagen → Contenido → Botón → Footer) y que puede personalizar colores, estilos y formato del contenido a través de su indicación. El texto debe estar en español.

7. **Validar logo en el banner** — Asegurar que el banner del header siempre incluye el logo de la identidad de marca en la esquina superior izquierda (usando la URL del logo o `{{LOGO_URL}}` como fallback) y el `{{ASUNTO}}` centrado a la derecha del logo.

## Relevant files
- `server/openai.ts:341-495`
- `server/routes.ts:1372-1460`
- `server/seed-data.json`
- `client/src/pages/Templates.tsx:127-160,801-900`
