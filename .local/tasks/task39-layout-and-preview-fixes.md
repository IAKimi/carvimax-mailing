# Fix: Layout overflow durante generación + Vista Final sin respetar CTA desactivado

## What & Why

Dos bugs reportados por el usuario:

### Bug 1: Layout desbordado durante generación de contenido IA
Cuando se genera contenido con IA ("Generando tu correo con IA..."), la página permite scroll horizontal y vertical cuando no debería. El título de la campaña (que puede ser muy largo) se desborda horizontalmente fuera del viewport.

**Causa raíz**: El `h1` del título tiene `truncate` pero está dentro de un flex container con `flex-wrap`. El texto largo del nombre de campaña no se trunca correctamente porque `flex-wrap` impide que `truncate` funcione como se espera. Además, el contenedor principal no tiene `overflow-hidden` para prevenir el scroll horizontal.

**Fix**: 
- Agregar `overflow-hidden` al contenedor principal del editor
- Asegurar que el título se trunce correctamente con `max-w-full` y removiendo `flex-wrap` del contenedor del título (los tags de estado pueden ir debajo)
- Agregar `overflow-x-hidden` al layout general para prevenir scroll horizontal

### Bug 2: Vista Final del Correo muestra botón CTA cuando está desactivado
Cuando el usuario desactiva el CTA (`cta_enabled: false` en contentJson) y envía el correo, el email real llega sin el botón (correcto), pero la "Vista Final del Correo" en la app sigue mostrando el botón CTA.

**Causa raíz**: Dos problemas:
1. El regex que elimina el bloque CTA del HTML de la plantilla (`/<!--\s*(?:BLOQUE\s*\d+\s*:\s*)?Botón CTA\s*-->\s*<tr>[\s\S]*?<\/tr>/i`) puede fallar si la plantilla AI genera una estructura HTML diferente (ej. el CTA no empieza con `<tr>` inmediatamente después del comentario, o hay whitespace/newlines diferentes). El backend usa el mismo regex pero lo ejecuta ANTES de los replacements de placeholders, mientras que el frontend lo ejecuta sobre el HTML completo con placeholders ya sustituidos, lo cual puede cambiar el matching.
2. El sidebar de metadatos (línea 1286-1289) siempre muestra "Botón CTA" con su texto, sin importar si `ctaEnabled` es false. Debería ocultarse o mostrar "Desactivado".

**Fix**:
- Usar `renderTemplateWithContent()` del backend (o replicar su lógica exacta) para generar el HTML del preview, en lugar de tener lógica duplicada en el frontend
- Si no es viable unificar, asegurar que el regex del frontend sea idéntico al del backend y se ejecute en el mismo punto
- Ocultar la tarjeta "Botón CTA" en el sidebar cuando `ctaEnabled` es false

### Bug 2b: Vista Final en blanco después de F5
Después de recargar la página (F5), el iframe de "Vista Final del Correo" aparece en blanco para campañas enviadas.

**Causa raíz**: `editingCampaignId` se pierde al recargar porque es estado React volátil. Si la URL no contiene `?edit=ID`, la campaña no se reabre automáticamente. Pero incluso si se recupera vía URL params, el `selectedVersion` puede tardar en cargarse, y el iframe no se re-renderiza correctamente. Los scripts de `postMessage` para calcular altura pueden fallar silenciosamente en el iframe sandboxed tras un refresh.

**Fix**:
- Asegurar que el parámetro `?edit=ID` se preserva en la URL al abrir una campaña enviada
- Agregar un fallback de altura mínima más robusto y un setTimeout de respaldo para el cálculo de altura del iframe
- Verificar que el `sentPreviewHeight` se resetea correctamente al cambiar de campaña

## Done looks like

1. La pantalla de "Generando tu correo con IA..." se muestra sin scroll horizontal ni vertical — el título se trunca correctamente sin importar su longitud
2. La "Vista Final del Correo" para campañas enviadas con `cta_enabled: false` NO muestra el botón CTA ni en el preview HTML ni en la tarjeta lateral
3. Después de hacer F5 en una campaña enviada, la Vista Final carga correctamente con el contenido visible (no en blanco)

## Relevant files

- `client/src/pages/CalendarView.tsx` — Editor principal, layout del header, "Vista Final", lógica de generación
- `server/templates.ts` — `renderTemplateWithContent()` como referencia para la lógica de render correcta (línea 104)
- `server/openai.ts` — Template base con comentarios HTML de bloques (línea 360: `<!-- BLOQUE 4: Botón CTA -->`)
