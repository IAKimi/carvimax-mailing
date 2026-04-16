# Tropicalizar requisitos Mailchimp + agregar panel Brevo

## What & Why
Los textos actuales del panel "Requisitos importantes" de Mailchimp son demasiado técnicos para el usuario promedio (hablan de DKIM, DMARC, CNAME, CAN-SPAM, opt-in, error 429, etc.). El usuario no entiende estos términos. Necesitamos reescribirlos en lenguaje accesible ("tropicalizado") que le explique qué tiene que hacer sin usar jerga técnica, e incluir un disclaimer de que debe buscar en la plataforma correspondiente cómo realizar cada paso.

Además, agregar el panel equivalente para Brevo con los 5 requisitos específicos de Brevo, ya redactados en lenguaje tropicalizado desde el inicio.

**Importante:** Esto es solo cambio de UI/texto. No se modifica ninguna lógica de backend.

## Done looks like
- **Mailchimp** — Los 5 puntos del panel existente se reescriben en español accesible:
  1. **Verificar su dominio de correo:** Explicar que si no verifica su dominio en Mailchimp, los correos que envíe van a aparecer como enviados desde una dirección genérica (@mandrillapp.com) en vez de su marca. Decirle que busque "Autenticar dominio" en la configuración de Mailchimp y siga los pasos (necesitará acceso a donde compró su dominio web).
  2. **Dirección física en los correos:** Explicar que por ley, todo correo masivo debe incluir una dirección postal real. Mailchimp la pide al configurar la audiencia y la agrega automáticamente al pie de cada correo. Que la ingrese en su cuenta de Mailchimp.
  3. **Límites del plan gratuito:** La cuenta gratuita solo permite enviar 100 correos en total. Cuando se acaben, necesita agregar una tarjeta o cambiar de plan en Mailchimp.
  4. **Velocidad de envío:** Si envía muchas campañas al mismo tiempo, Mailchimp puede pausar temporalmente los envíos. Esto es normal y se resuelve solo esperando unos minutos.
  5. **Permiso de sus contactos:** Las personas a las que les envíe correos deben haber aceptado recibir información suya previamente. Si envía correos a personas que no lo autorizaron, Mailchimp puede suspender su cuenta.
  - Cada punto incluye al final una nota breve tipo: "Puede configurar esto desde su panel de Mailchimp."

- **Brevo** — Se agrega un panel nuevo con 5 puntos en la tarjeta de Brevo (misma estructura visual que Mailchimp):
  1. **Validación de cuenta nueva:** Cuando crea una cuenta nueva en Brevo, esta pasa por una revisión. Hasta que Brevo no la apruebe, no podrá enviar correos desde PostIAlo. Si le sale error de "cuenta en validación", debe completar su perfil en Brevo y esperar la aprobación.
  2. **Verificar su correo y dominio:** Debe verificar al menos la dirección de correo que usará como remitente (Brevo envía un enlace de confirmación). Se recomienda también verificar el dominio completo para que los correos no caigan en spam.
  3. **Límites del plan gratuito:** El plan gratuito permite enviar hasta 300 correos por día. Este límite se renueva automáticamente cada 24 horas. Si su campaña tiene más de 300 destinatarios, el envío se pausará hasta el día siguiente.
  4. **Límite de webhooks:** PostIAlo crea automáticamente una conexión (webhook) con Brevo para rastrear si sus correos fueron entregados y abiertos. Brevo permite máximo 40 de estas conexiones. Si ya tiene muchas herramientas conectadas a Brevo, puede que necesite eliminar alguna desde su panel de Brevo.
  5. **Permiso de sus contactos:** Las personas a las que envíe correos deben haber dado su consentimiento. Si envía correos a personas que no lo autorizaron y generan quejas, Brevo puede bloquear su cuenta.
  - Cada punto incluye al final una nota breve: "Puede configurar esto desde su panel de Brevo."

- Misma estructura visual: amber theme, íconos descriptivos, desplegable, `type="button"`.
- El panel de Brevo usa una función `brevoRequirementsPanel()` equivalente a `mailchimpRequirementsPanel()`.
- Se agrega estado `showBrevoRequirements`.
- Los data-testid siguen el patrón existente: `button-toggle-brevo-requirements`, `brevo-requirements-panel`, etc.

## Out of scope
- No se cambia ninguna lógica de backend.
- No se agregan nuevas validaciones o bloqueos de envío.
- No se modifican otros componentes fuera de EmailProvider.tsx.

## Tasks
1. Reescribir los 5 puntos del `mailchimpRequirementsPanel()` con textos tropicalizados y nota de "configurar desde Mailchimp".
2. Agregar estado `showBrevoRequirements` y función `brevoRequirementsPanel()` con los 5 puntos de Brevo en lenguaje tropicalizado.
3. Insertar `brevoRequirementsPanel()` en la tarjeta de Brevo, tanto en estado desconectado (después de instrucciones de API key) como conectado (después de remitentes verificados).
4. Verificar que ambos paneles se muestran y colapsan correctamente en ambos estados.

## Relevant files
- `client/src/pages/EmailProvider.tsx:79-130`
- `client/src/pages/EmailProvider.tsx:240-310`
- `client/src/pages/EmailProvider.tsx:505-562`
