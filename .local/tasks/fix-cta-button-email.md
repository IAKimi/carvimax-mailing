# Corregir botón CTA en correos enviados

## Problema
El botón CTA (call-to-action) se ve correctamente en la vista previa de la plataforma, pero cuando llega al buzón de correo real del destinatario, el botón aparece vacío (sin texto) o con estilos incorrectos. Esto se debe a la compatibilidad del HTML con diferentes clientes de correo electrónico.

## Análisis

### Flujo actual
1. La plantilla tiene `{{CTA_TEXTO}}` y `{{CTA_URL}}` como placeholders
2. `server/templates.ts` → `renderTemplateWithContent()` reemplaza los placeholders con valores del `contentJson` (`cta_text`, `cta_url`)
3. `server/routes.ts` → `cleanHtmlForEmail()` limpia el HTML y lo envía al webhook de Make.com
4. Make.com lo entrega al destinatario

### Posibles causas
1. **Las plantillas generadas por OpenAI** usan un tag `<a>` con estilos CSS para el botón, pero muchos clientes de correo (Outlook, Gmail, Yahoo) no respetan `display: inline-block`, `padding`, o `background-color` en `<a>` tags
2. **El texto del CTA podría estar vacío** en ciertos flujos (especialmente en reenvíos donde el contentJson podría no tener `cta_text` correctamente mapeado)
3. **La función `cleanHtmlForEmail`** podría estar removiendo atributos necesarios del botón

## Solución propuesta

### 1. Validar que `cta_text` siempre llega al render
- En `renderTemplateWithContent`, agregar logging si `cta_text` está vacío
- Verificar que en el flujo de reenvío el `cta_text` se preserve correctamente

### 2. Usar patrón "bulletproof button" en las plantillas
Los clientes de correo funcionan mejor con botones basados en tablas HTML:
```html
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
  <tr>
    <td align="center" bgcolor="#002073" style="border-radius:8px">
      <a href="{{CTA_URL}}" style="display:inline-block;padding:12px 32px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#002073">
        {{CTA_TEXTO}}
      </a>
    </td>
  </tr>
</table>
```

### 3. Actualizar las plantillas existentes
- Verificar que las plantillas en la BD usen el patrón bulletproof para el botón CTA
- Actualizar el prompt de generación de plantillas en OpenAI para que siempre genere botones compatibles con email

### 4. Validación pre-envío
- Antes de enviar, verificar que `cta_text` no esté vacío
- Si está vacío, usar un fallback o advertir al usuario

## Archivos afectados
- `server/templates.ts` — renderTemplateWithContent (validación)
- `server/routes.ts` — cleanHtmlForEmail y flujo de envío
- `server/openai.ts` — prompt de generación de plantillas (instrucciones de HTML email-safe)
- Posiblemente actualizar plantillas existentes en la BD

## Criterios de aceptación
- El botón CTA muestra el texto correcto cuando el correo llega al buzón del destinatario
- El botón se ve bien en Gmail, Outlook y Apple Mail
- El texto del CTA nunca llega vacío al render final
- Las nuevas plantillas generadas por IA usan el patrón bulletproof de tablas HTML
