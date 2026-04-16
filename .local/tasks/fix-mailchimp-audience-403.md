# Fix Mailchimp audiencia + onboarding + tutorial proveedor

## What & Why
Tres problemas relacionados con el proveedor de email que se deben resolver juntos:

**1) Mailchimp 403 al enviar:** Al enviar una campaña por Mailchimp, el flujo falla con 403 porque `syncContactsToAudience()` intenta crear una audiencia nueva vía `POST /lists`, lo cual no está permitido en planes gratuitos. La audiencia de Mailchimp es un "buzón intermediario" donde Mailchimp necesita tener los contactos para enviarles correo — es diferente a la base de datos de PostIAlo (donde el usuario sube sus CSV/XLSX). El usuario siempre selecciona su base de datos de PostIAlo al crear la campaña, y el sistema sincroniza esos contactos a la audiencia de Mailchimp automáticamente por debajo.

**2) Onboarding no exige proveedor:** El sistema de onboarding verifica hasBrand, hasTemplates, hasContactDatabases pero NO verifica que el usuario haya conectado un proveedor de email. Actualmente Provider y Templates están al mismo nivel (1), pero el usuario debería ser obligado a conectar su proveedor ANTES de poder crear plantillas. La jerarquía correcta es: Marca → Proveedor → Plantillas → Contactos → Calendario.

**3) Tutorial faltante:** El sistema de tutorial (foquito) tiene secciones para brand, calendar, contacts, templates, emails, dashboard — pero NO para email-provider. Necesita uno básico que guíe: "Conecta tu proveedor pegando tu API Key. Ve a tu plataforma de Brevo/Mailchimp para obtenerla."

## Done looks like
### Audiencias de Mailchimp
- Al conectar Mailchimp (`POST /api/email-provider/connect`), el backend consulta `GET /lists` y guarda las audiencias encontradas.
- Si hay exactamente una audiencia, se guarda automáticamente como la audiencia seleccionada en el proveedor.
- En la tarjeta de Mailchimp conectado (EmailProvider.tsx), se muestra la audiencia seleccionada y un selector si hay más de una.
- Si no hay ninguna audiencia, se muestra mensaje indicando que debe crear una desde Mailchimp.
- Nuevo endpoint `GET /api/email-provider/mailchimp/audiences` para refrescar las audiencias disponibles.
- Al enviar, `syncContactsToAudience` ya NO intenta crear audiencias nuevas — usa la seleccionada. Si no hay ninguna seleccionada, retorna error claro.
- El selector de audiencia está SOLO en la página de configuración del proveedor, NO en el formulario de creación de campaña. La creación de campaña sigue igual (solo seleccionar base de datos de PostIAlo).

### Onboarding con proveedor
- El endpoint `/api/onboarding-status` agrega `hasProvider: boolean`.
- La función `getOnboardingLevel` en Layout.tsx cambia a 5 niveles: 0=nada, 1=tiene marca, 2=tiene proveedor, 3=tiene plantillas, 4=tiene contactos → acceso completo.
- El nav del sidebar refleja: Marca (0), Proveedor (1), Plantillas (2), Contactos (3), Calendario/Historial/Dashboard (4).
- Los mensajes de bloqueo se actualizan para mencionar el proveedor de email.

### Tutorial de proveedor
- Se agrega la sección `provider` al `TUTORIAL_SECTIONS` en TutorialContext.tsx con pasos básicos: overview ("Conecta tu cuenta de Brevo o Mailchimp pegando tu API Key"), campo de API Key ("Obtén tu API Key desde el panel de tu proveedor"), y confirmación ("Una vez conectado, podrás enviar correos desde nuestra plataforma").
- El foquito funciona correctamente en la página de EmailProvider.
- La página EmailProvider.tsx activa la sección `provider` del tutorial al montarse.

## Out of scope
- Creación de audiencias de Mailchimp desde PostIAlo.
- Cambios al flujo de envío de Brevo.
- Selector de audiencia dentro del formulario de campaña (CalendarView).

## Tasks
1. **Función getAudiences + endpoint** — Crear `getAudiences(apiKey, dataCenter)` en `server/providers/mailchimp.ts` que haga `GET /lists` y devuelva id, nombre, cantidad de miembros. Crear endpoint `GET /api/email-provider/mailchimp/audiences` protegido por auth.

2. **Traer audiencias al conectar Mailchimp** — En la ruta `POST /api/email-provider/connect` para mailchimp, después de validar la key, consultar audiencias. Si hay exactamente una, guardar su ID en `mailchimpAudienceId` del proveedor. Incluir lista de audiencias en la respuesta.

3. **Refactorizar syncContactsToAudience** — Eliminar lógica de crear audiencia nueva. Recibir `audienceId` como obligatorio. Si no viene, retornar error claro en español. En `sendCampaignDirect`, obtener audienceId del proveedor y fallar descriptivamente si no hay ninguno configurado.

4. **Selector de audiencia en EmailProvider.tsx** — En tarjeta Mailchimp conectado, mostrar audiencia actual y dropdown para cambiar si hay varias. Traer desde el nuevo endpoint. Endpoint para cambiar: `PATCH /api/email-provider/:id` actualizando `mailchimpAudienceId`.

5. **Onboarding con hasProvider** — Agregar `hasProvider` al endpoint `/api/onboarding-status`. Actualizar `getOnboardingLevel` y los `requiresLevel` del sidebar para jerarquía: Marca(0) → Proveedor(1) → Plantillas(2) → Contactos(3) → Calendario(4). Actualizar mensajes de bloqueo.

6. **Tutorial de proveedor de email** — Agregar sección `provider` a `TUTORIAL_SECTIONS` en TutorialContext.tsx con 2-3 pasos básicos. Activar sección `provider` al montar EmailProvider.tsx. Verificar que el foquito funciona correctamente en esa página.

## Relevant files
- `server/providers/mailchimp.ts`
- `server/routes.ts:1410-1419,1559-1597,2239-2300`
- `server/storage.ts`
- `shared/schema.ts:147`
- `client/src/pages/EmailProvider.tsx`
- `client/src/pages/CalendarView.tsx`
- `client/src/components/Layout.tsx:27-63`
- `client/src/contexts/TutorialContext.tsx`
- `client/src/components/TutorialTip.tsx`
