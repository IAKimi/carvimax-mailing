# Panel de requisitos importantes para Mailchimp

## What & Why
Agregar un panel informativo desplegable en la tarjeta de Mailchimp (página Proveedor de Email) que muestre los requisitos y aclaraciones importantes que el usuario debe tener en cuenta antes y después de conectar su cuenta. Esto protege a la plataforma al comunicar claramente que ciertos pasos de configuración (dominio, DKIM, dirección física, límites) son responsabilidad del usuario directamente en Mailchimp.

## Done looks like
- En la tarjeta de Mailchimp aparece un panel con ícono de advertencia (!) y título "Requisitos importantes" que se puede expandir/colapsar.
- El panel se muestra tanto cuando Mailchimp NO está conectado (antes del formulario de API key) como cuando YA está conectado (en la sección de info de cuenta).
- El contenido del panel incluye las siguientes aclaraciones en español:
  1. **Autenticación de dominio (DKIM/DMARC):** Explicar que si no configura DKIM y DMARC en su dominio, Mailchimp reemplazará su dirección de remitente por un subdominio genérico (@mandrillapp.com). Incluir que necesita crear registros CNAME para DKIM y un registro TXT para DMARC en su proveedor de DNS.
  2. **Dirección física obligatoria:** Por regulaciones CAN-SPAM, Mailchimp requiere una dirección postal válida en la configuración de audiencia. Esta se inserta automáticamente en el pie de página de cada correo.
  3. **Límites del plan gratuito:** La cuenta gratuita permite un máximo de 100 envíos sin tarjeta de crédito. Una vez agotados, necesita agregar método de pago o actualizar su plan.
  4. **Límite de conexiones:** Máximo 10 conexiones simultáneas a la API. Si se supera, se recibirá error 429.
  5. **Consentimiento de contactos:** Los contactos importados deben tener consentimiento previo para recibir correos. Mailchimp puede suspender cuentas que envíen a contactos sin opt-in.
- El panel usa estilo visual consistente con el panel existente de "¿Cómo obtener mi API key?" (fondo muted, bordes redondeados, texto pequeño).
- El ícono y color del panel son de advertencia (amber/amarillo) para distinguirlo del panel de instrucciones.

## Out of scope
- No se agrega panel equivalente para Brevo en esta tarea (se hará después con info específica de Brevo).
- No se hacen cambios en el backend ni en la lógica de envío.
- No se implementa OAuth 2 para Mailchimp.
- No se agrega validación de dominio verificado como bloqueo de envío.

## Tasks
1. Agregar estado `showMailchimpRequirements` (useState) al componente EmailProvider.
2. Crear el panel desplegable con ícono AlertTriangle (amber), título "Requisitos importantes" y botón de expandir/colapsar.
3. Agregar el contenido de los 5 puntos de requisitos dentro del panel como lista con íconos descriptivos.
4. Posicionar el panel debajo del desplegable de instrucciones de API key (estado no conectado) y en la sección de info (estado conectado).
5. Asegurar que el estilo sea consistente con el diseño existente de la página.

## Relevant files
- `client/src/pages/EmailProvider.tsx:406-496`
