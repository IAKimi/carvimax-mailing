# Simplificar vista de edición para campañas reenviadas

## Objetivo
Cuando una campaña llega al CalendarView por la vía de reenvío (desde MyEmails → "Agregar a calendario" → `/calendar?edit=ID`), la vista de edición debe ser simplificada: sin botones de regeneración de imagen/texto, sin Nano Banana, sin historial de versiones. Solo debe mostrar:

1. La **imagen original** (solo lectura, sin botones de regenerar/cargar/Nano Banana)
2. El **editor TipTap** para editar manualmente el texto (asunto, preheader, cuerpo, CTA)
3. El botón de **"Guardar Cambios"** para guardar ediciones manuales del texto
4. El botón de **"Aprobar Texto"** una vez satisfecho con los cambios
5. Los botones de **"Vista Previa"** y **"Publicar Ahora"** (o "Enviar Ahora")

## Lógica de detección
El estado `isResend` ya existe en CalendarView.tsx — se establece cuando la URL tiene `?edit=ID`. Usar esta bandera para condicionar la UI.

## Cambios requeridos en `client/src/pages/CalendarView.tsx`

### Sección de Imagen (aprox. líneas 1285-1333)
Cuando `isResend === true`:
- Ocultar botón "Regenerar" (data-testid="button-regenerate-image")
- Ocultar botón "Cargar Imagen" (data-testid="button-upload-image") y su input file
- Ocultar botón "Nano Banana" (data-testid="button-nano-banana")
- Ocultar historial de imágenes (data-testid="button-image-history")
- Mostrar la imagen como solo lectura (ya aprobada automáticamente)

### Sección de Texto (aprox. líneas 1519-1541)
Cuando `isResend === true`:
- Ocultar botón "Regenerar Texto" (data-testid="button-regenerate-text")
- Ocultar botón "Seleccionar Textos" (historial de versiones de texto)
- Mantener visible el editor TipTap para edición manual
- Mantener visible el botón "Guardar Cambios"
- Mantener visible el botón "Aprobar Texto"

### Aprobación de imagen
Cuando `isResend === true`:
- La imagen debe estar auto-aprobada (ya se hace en el useEffect del `?edit=` param con `setImageApproved(true)`)
- El botón de "Aprobar Imagen" debe estar oculto o ya mostrar "Imagen Aprobada" como solo lectura

### Vista previa y publicar
- Mantener "Vista Previa" y "Publicar Ahora" / "Enviar Ahora" visibles
- Estos ya funcionan correctamente con el flujo actual

## Archivos afectados
- `client/src/pages/CalendarView.tsx` (único archivo a modificar)

## Criterios de aceptación
- Al llegar desde reenvío, no aparecen botones de regeneración de imagen ni de texto
- La imagen se muestra como solo lectura
- El editor TipTap funciona para editar contenido manualmente
- Se puede guardar cambios, aprobar texto, ver preview y publicar
- El tag "Reenvío" sigue visible en la barra de estado
