# Infraestructura de proveedores de email y módulo Brevo

## What & Why
La plataforma actualmente envía todas las campañas a través de un único webhook de Make.com conectado a una cuenta centralizada de Brevo. Esto no es escalable para comercializar la plataforma. Necesitamos que cada usuario conecte su propia cuenta de proveedor de email (empezando con Brevo) y que los envíos se hagan directamente desde el backend usando la API del proveedor con las credenciales del usuario.

Esta tarea crea toda la infraestructura backend: esquema de base de datos, encriptación de API keys, módulo de Brevo con envío batch, y las rutas API de configuración.

## Done looks like
- Existe una nueva tabla `email_providers` que almacena la configuración del proveedor de cada usuario con la API key encriptada.
- Existen endpoints API para conectar un proveedor (validando la key con `GET /v3/account`), desconectar, listar senders verificados (`GET /v3/senders`), y consultar el estado de conexión.
- Al conectar exitosamente, se crea automáticamente un webhook transaccional en la cuenta de Brevo del usuario (`POST /v3/webhooks`) apuntando a nuestro backend.
- Existe un módulo `server/providers/brevo.ts` que implementa: validación de key, envío batch con `messageVersions` (chunks de hasta 1,000), consulta de senders, creación de webhook, y manejo de errores (401/402/429).
- La encriptación de API keys usa `crypto` nativo de Node.js con AES-256-GCM y una key derivada del `SESSION_SECRET`.

## Out of scope
- Integración con Mailchimp (será una tarea posterior).
- Frontend/UI (se construye en tarea separada).
- Modificación del flujo de envío actual de Make.com (se hace en tarea separada).
- OAuth2 (se usa API key directa para Brevo; OAuth2 solo será necesario para Mailchimp en el futuro).

## Tasks
1. **Esquema de base de datos** — Agregar tabla `email_providers` en `shared/schema.ts` con campos: id, userId, provider (enum: "brevo"/"mailchimp"), encryptedApiKey, iv, authTag, isActive, senderEmail, senderName, webhookId, accountEmail, accountPlan, createdAt. Crear los schemas de inserción y tipos correspondientes. Ejecutar `db:push` para sincronizar.

2. **Utilidad de encriptación** — Crear `server/encryption.ts` con funciones `encryptApiKey(plainKey)` y `decryptApiKey(encrypted, iv, authTag)` usando AES-256-GCM con key derivada de `SESSION_SECRET` via PBKDF2.

3. **Métodos de storage** — Agregar a `IStorage` y `DatabaseStorage`: `createEmailProvider`, `getEmailProvider(userId, provider)`, `getEmailProviders(userId)`, `updateEmailProvider(id, updates)`, `deleteEmailProvider(id)`.

4. **Módulo Brevo** — Crear `server/providers/brevo.ts` con funciones: `validateApiKey(key)` que llama a `GET /v3/account`, `getSenders(key)` que llama a `GET /v3/senders`, `createTrackingWebhook(key, callbackUrl)` que llama a `POST /v3/webhooks`, `sendBatchEmails(key, sender, subject, html, contacts, campaignTag)` que usa `POST /v3/smtp/email` con `messageVersions` dividiendo en chunks de 1,000.

5. **Rutas API de configuración** — Crear endpoints protegidos con `requireAuth`: `POST /api/email-provider/connect` (valida key, encripta, guarda, crea webhook), `DELETE /api/email-provider/:provider` (desconecta), `GET /api/email-provider/status` (retorna proveedores configurados), `GET /api/email-provider/:provider/senders` (lista senders verificados del proveedor).

## Relevant files
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts:1-30,1758-1877`
- `server/index.ts`
