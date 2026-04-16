---
title: Parche producción: prompt IA, versiones, contador, estados y reprogramación
---
# Parche de producción: prompt IA, versiones, contador, estados y reprogramación

  ## What & Why
  Múltiples bugs y mejoras de flujo reportados en producción. La creación inicial ya consume 1 generación (solo quedan 2 regeneraciones). Las versiones aparecen invertidas. El prompt de regeneración de texto es demasiado conservador. El scheduler envía sin verificar aprobaciones. Se necesita un flujo completo de estados (draft → scheduled) que solo transite cuando ambas aprobaciones estén confirmadas, con capacidad de reprogramar fecha/hora y alertas cuando la hora programada ya pasó.

  ## Done looks like
  1. Al regenerar texto, la IA reescribe el correo completo según las instrucciones del usuario.
  2. Las versiones se muestran en orden ascendente (v1 arriba, v2 abajo, v3 más abajo).
  3. El contador muestra "2 restantes" tras crear campaña (máx 2 regeneraciones adicionales).
  4. Una campaña permanece en "draft" hasta que AMBOS (texto + imagen) estén aprobados.
  5. Al aprobar ambos: si la hora programada aún no pasó → pasa a "scheduled". Si ya pasó → alerta pidiendo reprogramar con selector de fecha/hora.
  6. El scheduler SOLO envía campañas en "scheduled" (con ambas aprobaciones implícitas).
  7. Con todo aprobado ("scheduled"), el usuario puede reprogramar fecha/hora si faltan > 15 minutos.
  8. Si intenta cambiar a < 15 minutos del envío → alerta bloqueante.
  9. La validación del CTA (Task #36) se confirma funcional e incluida.

  ## Sub-tasks

  ### S1: Mejorar prompt de regeneración de texto
  - **File**: server/openai.ts (función regenerateEmailContent)
  - **Cambio**: Reescribir el prompt del usuario de "aplica las siguientes correcciones" a una instrucción de reescritura completa: "Reescribe COMPLETAMENTE el correo basándote en estas instrucciones del usuario. Si pide cambiar el tono, reescríbelo todo en ese tono. Si pide agregar emojis, agrégalos. El resultado debe reflejar fielmente lo que pide el usuario."

  ### S2: Ordenar versiones ascendente
  - **File**: client/src/pages/CalendarView.tsx
  - **Cambio**: Agregar .sort((a, b) => a.versionNumber - b.versionNumber) antes del .map() tanto para textVersions como imageVersions.

  ### S3: Corregir límite de regeneraciones a 2 adicionales
  - **Files**: server/routes.ts (endpoints regenerate-text y regenerate-image), client/src/pages/CalendarView.tsx (contadores UI)
  - **Cambio**: Cambiar límite de >= 3 a >= 2 en backend. En frontend cambiar 3 - count a 2 - count. Mensajes de error actualizados.

  ### S4: Flujo de estados draft → scheduled con aprobaciones
  - **Files**: server/routes.ts, client/src/pages/CalendarView.tsx
  - **Cambio backend**:
    - Al crear campaña con hora: status = "draft" (no "scheduled")
    - El scheduler solo procesa campañas con status "scheduled" (ya las tiene, pero ahora "scheduled" implica ambas aprobaciones)
  - **Cambio frontend (CalendarView.tsx)**:
    - Al aprobar la segunda pieza (texto o imagen, la que falte), verificar scheduledAt:
      - Si scheduledAt > ahora → PATCH status a "scheduled" + toast de confirmación
      - Si scheduledAt <= ahora → mostrar alerta: "La hora programada ya pasó. Por favor reprograma tu correo." + mostrar selector de fecha/hora para reprogramar. Al seleccionar nueva hora → PATCH scheduledAt + status "scheduled"
    - Si cierro la computadora y las aprobaciones no están → se queda en "draft" indefinidamente. El scheduler la ignora.

  ### S5: Reprogramación de fecha/hora post-aprobación
  - **File**: client/src/pages/CalendarView.tsx
  - **Cambio**: Cuando la campaña está en "scheduled" (todo aprobado), mostrar un botón "Reprogramar" que permita cambiar fecha y hora del envío, con estas validaciones:
    - Si la nueva fecha/hora es a > 15 min del momento actual → permitir cambio, PATCH scheduledAt
    - Si la nueva fecha/hora es a <= 15 min del momento actual → rechazar con alerta: "No puedes reprogramar porque estás a menos de 15 minutos del envío."
    - Si la hora actual ya está a <= 15 min de la hora programada existente → no permitir reprogramar, alerta: "No puedes cambiar la hora porque el envío está a menos de 15 minutos."

  ### S6: Confirmar CTA toggle funcional (Task #36)
  - Verificar que todo el código del toggle CTA, validación de URL, y strip de CTA del HTML está presente y funcional.

  ## Relevant files
  - server/openai.ts
  - server/routes.ts  
  - client/src/pages/CalendarView.tsx
  - server/templates.ts