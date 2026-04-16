# Preparar y desplegar PostIAlo Mailing a producción

## What & Why
La plataforma está feature-complete y necesita desplegarse a producción. Esto incluye: crear el usuario administrador principal, generar un script de seed que migre todos los datos existentes (usuarios, campañas, plantillas, contactos, identidad de marca, imágenes) a la base de datos de producción, cambiar el deployment target de "autoscale" a "vm" (para soportar WebSocket de progreso de envío en tiempo real), y ejecutar el despliegue.

## Done looks like
- Usuario admin@postial.com creado con contraseña `Admin12345PostIAlo!"#$%` y rol admin
- Script de seed creado que exporta todos los datos del entorno de desarrollo y los inserta en la base de producción al primer arranque
- Los datos incluyen: usuarios, campañas, versiones de campaña, plantillas, contactos, bases de datos de contactos, identidad de marca, envíos de campaña
- Las imágenes de uploads/ (campañas y logos) se incluyen en el build
- Deployment target cambiado de "autoscale" a "vm" para soporte WebSocket persistente
- La app desplegada y funcionando en producción con todos los datos visibles
- Todas las APIs (OpenAI, Gemini) funcionando en producción con las mismas variables de entorno

## Out of scope
- Verificación de correo electrónico al registrarse (fase futura)
- Webhook dinámico por usuario (el webhook de Make.com sigue hardcoded por ahora)
- Dominio personalizado (se usará el .replit.app por ahora)

## Tasks
1. **Crear usuario admin** — Insertar en la base de datos de desarrollo el usuario admin@postial.com con contraseña hasheada con bcrypt y rol "admin".

2. **Crear script de seed para producción** — Script que al detectar que la base de datos de producción está vacía (sin usuarios), exporta e inserta todos los datos existentes: usuarios, brand_identity, templates, contact_databases, contacts, campaigns, campaign_versions, campaign_sends. El script debe ejecutarse automáticamente al arrancar el servidor en producción si la DB está vacía.

3. **Asegurar persistencia de uploads** — Verificar que la carpeta uploads/ con las imágenes de campañas y logos se incluya correctamente en el build y sea accesible en producción.

4. **Cambiar deployment target a VM** — Cambiar de "autoscale" a "vm" en .replit para soportar WebSocket persistente y el scheduler de campañas programadas.

5. **Desplegar y verificar** — Ejecutar el despliegue, verificar que la app carga, que se puede hacer login con admin@postial.com, y que los datos migrados son visibles.

## Relevant files
- `.replit`
- `server/index.ts`
- `server/routes.ts:46-53,252-274`
- `server/storage.ts`
- `shared/schema.ts`
- `script/build.ts`
