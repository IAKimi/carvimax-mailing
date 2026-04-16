# Correcciones de imagen, logo, tutorial y mejoras de plantillas

## What & Why
Conjunto de correcciones y mejoras críticas para la experiencia del usuario en la plataforma PostIAlo Mailing. Aborda problemas visuales, funcionalidad del tutorial, integración real del logo/brand identity en las plantillas generadas por IA, y mejoras en la calidad de diseño de las plantillas.

## Done looks like

### Imagen de previsualización
- La imagen generada por IA en el editor de campañas se muestra completa sin recorte, ajustándose al ancho del contenedor y mostrando la altura natural de la imagen.

### Logo en plantillas
- Al generar una plantilla HTML con IA, el logo de la empresa aparece en la esquina superior izquierda del header, debajo del titular, sobre el fondo de color del header.
- El `logoUrl` se inyecta en el prompt de `buildTemplateInstructions` con instrucciones explícitas de posición.

### Footer con datos de contacto
- Todas las plantillas generadas incluyen en el footer: el número de WhatsApp y el sitio web del usuario (tomados de Identidad de Marca).
- Si el usuario no tiene WhatsApp o sitio web configurados, la IA propone una frase alternativa coherente con el contenido del correo.
- Se mantiene el enlace de cancelación de suscripción existente.

### Campos de identidad de marca usados en generación de plantillas
Los siguientes campos se envían al prompt de plantillas:
- Nombre de empresa, Industria, Misión, Visión, Historia, Tono, Público Objetivo
- Color primario, secundario y de acento
- Fuente de títulos y de cuerpo
- Logo (URL), Website, WhatsApp
Los siguientes campos NO se envían al prompt de plantillas (solo a generación de contenido):
- Productos/Servicios, Guía de Estilo

### Estilo visual (nuevo campo)
- Nuevo campo "Estilo Visual" en Identidad de Marca con 5 opciones: Minimalista, Corporativo, Moderno, Creativo, Elegante.
- Cada opción tiene un prompt predefinido (hardcodeado) con instrucciones de diseño específicas que se inyectan automáticamente al prompt de generación de plantillas, similar a cómo funcionan los botones de Nano Banana.
- Los estilos base (sombras sutiles, bordes redondeados, gradientes) van siempre en el prompt del sistema. El estilo visual seleccionado añade variaciones de diseño. El prompt del usuario personaliza el resultado final.

### Sistema de 2 variantes de plantilla
- Al generar una plantilla, se generan 2 propuestas de diseño simultáneas (2 llamadas a la API).
- El usuario ve las 2 propuestas y escoge una.
- La variante no seleccionada se descarta.
- Después de escoger, el usuario puede regenerar máximo 2 veces más (no 3).
- Total máximo de llamadas API por generación de plantilla: 2 (inicial) + 2 (regeneraciones) = 4 llamadas al API como máximo por plantilla.

### Tutorial (bombillo)
- El botón de tutorial (bombillo) NO aparece en la página Home (ya que no hay pasos de tutorial para esa sección).
- El tutorial sigue funcionando con los botones de siguiente/anterior como está actualmente (sin cambios al mecanismo de navegación).
- El paso `import-contacts` en Contactos muestra un mensaje guía si no hay bases de datos expandidas.

## Out of scope
- Auto-avance del tutorial al hacer clic fuera de campos (no se implementa)
- Rediseño completo del sistema de tutorial
- Cambios al modelo de IA (gpt-4.1-mini se mantiene)
- Generación de más de 2 variantes simultáneas
- Campo de posición de logo configurable por el usuario (se fija en esquina superior izquierda)

## Tasks
1. **Corregir contenedor de imagen** — Cambiar el estilo del `<img>` de previsualización en el editor de campañas para que muestre la imagen completa sin recorte, manteniendo el ancho del contenedor.
2. **Actualizar prompt de plantillas con campos de marca completos** — En `buildTemplateInstructions`, incluir: `logoUrl`, `website`, `whatsapp`, `mission`, `vision`, `history`. Quitar `products` y `styleGuide` del prompt de plantillas. Agregar instrucciones para que el logo aparezca en la esquina superior izquierda del header y que el footer incluya WhatsApp y sitio web.
3. **Crear campo Estilo Visual** — Agregar `visualStyle` (text, default "moderno") al schema de `brandIdentity`. Crear las 5 opciones en la UI de Identidad de Marca. Definir los prompts predefinidos para cada estilo e inyectarlos en `buildTemplateInstructions`.
4. **Sistema de 2 variantes de plantilla** — Modificar la generación de plantillas para hacer 2 llamadas paralelas a la API y presentar ambas al usuario. Agregar UI para comparar y seleccionar. Limitar regeneraciones a 2 después de la selección.
5. **Tutorial: ocultar bombillo en Home y mejorar contactos** — No mostrar el botón del bombillo cuando el usuario está en la página Home. Mejorar el manejo del paso `import-contacts` cuando no hay bases de datos expandidas.

## Relevant files
- `client/src/pages/CalendarView.tsx:934-939`
- `server/openai.ts:299-376`
- `shared/schema.ts:63-83`
- `client/src/pages/BrandIdentity.tsx`
- `client/src/pages/Templates.tsx`
- `client/src/contexts/TutorialContext.tsx`
- `client/src/components/TutorialHighlight.tsx`
- `client/src/pages/Home.tsx`
- `client/src/pages/Contacts.tsx`
- `client/src/components/Layout.tsx`
- `server/routes.ts`
