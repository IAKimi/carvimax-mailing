# Frontend: configuración de proveedor de email

## What & Why
Los usuarios necesitan una interfaz dentro de PostIAlo para conectar su cuenta de Brevo (y en el futuro Mailchimp), ver el estado de su conexión, y seleccionar su email remitente verificado. Sin esta pantalla, no pueden usar el envío directo.

## Done looks like
- Existe una nueva página "Proveedor de Email" accesible desde el sidebar (icono de enlace/conexión), ubicada entre "Identidad de Marca" y "Plantillas" en el orden de navegación.
- La página muestra tarjetas para cada proveedor disponible (Brevo activo, Mailchimp próximamente con badge "Próximamente").
- Para Brevo, el flujo es: el usuario pega su API key → clic en "Conectar" → la plataforma valida la key → si es válida, muestra estado conectado con el email de la cuenta y el plan.
- Una vez conectado, se muestran los senders (emails remitentes) verificados en la cuenta de Brevo del usuario, y puede seleccionar cuál usar por defecto.
- Botón de "Desconectar" para remover la configuración.
- Si el usuario intenta crear una campaña sin proveedor configurado, ve un mensaje claro que lo guía a configurar su proveedor primero.
- La API key nunca se muestra completa en el frontend — solo los últimos 4 caracteres.
- Todos los textos en español, siguiendo la estética existente de la plataforma (sidebar azul #002073, colores de marca).
- La página tiene un enlace/instrucción que le indica al usuario cómo obtener su API key en Brevo.
- Los data-testid están presentes en todos los elementos interactivos.

## Out of scope
- Configuración funcional de Mailchimp (solo se muestra la tarjeta con badge "Próximamente").
- Importar contactos desde Brevo.
- OAuth2.

## Tasks
1. **Página de configuración de proveedor** — Crear `client/src/pages/EmailProvider.tsx` con la interfaz completa: tarjetas de proveedores, formulario de API key para Brevo, estado de conexión, lista de senders verificados, selector de sender por defecto, botón de desconectar. Incluir instrucciones paso a paso para obtener la API key en Brevo (con enlace a la página de configuración de Brevo).

2. **Registrar en sidebar y routing** — Agregar la página al sidebar en `Layout.tsx` (entre Identidad de Marca y Plantillas, con icono de `Link2` o `Plug` de lucide-react) y registrar la ruta `/email-provider` en `App.tsx`. Integrar con el sistema de onboarding/locks existente (la página debe estar desbloqueada después de completar la identidad de marca).

3. **Validación en creación de campaña** — En el flujo de creación de campaña (`CalendarView.tsx` o `CampaignEditor.tsx`), verificar si el usuario tiene un proveedor configurado. Si no lo tiene, mostrar un aviso con enlace a la página de configuración en lugar de permitir el envío.

4. **Selector de proveedor en campaña (preparación multi-proveedor)** — Agregar un campo opcional de selección de proveedor en la creación de campaña. Si el usuario solo tiene un proveedor, se usa automáticamente. Si tiene más de uno configurado (futuro), muestra un selector. Guardar el proveedor seleccionado en la campaña.

## Relevant files
- `client/src/components/Layout.tsx`
- `client/src/App.tsx`
- `client/src/pages/BrandIdentity.tsx`
- `client/src/pages/CalendarView.tsx`
- `client/src/pages/CampaignEditor.tsx`
- `shared/schema.ts`
