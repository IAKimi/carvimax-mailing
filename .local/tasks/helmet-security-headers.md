# Agregar helmet para headers de seguridad HTTP

## What & Why
La plataforma no envía headers de seguridad HTTP estándar desde el backend (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.). Aunque Coolify/Traefik puede agregar algunos, tener helmet en Express garantiza que los headers se apliquen independientemente del entorno de despliegue, y los escáneres de seguridad dejarán de marcarlos como faltantes.

## Done looks like
- Todas las respuestas HTTP del servidor incluyen headers de seguridad estándar (X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, etc.)
- Los headers no interfieren con el funcionamiento de la aplicación (iframes de preview, carga de logos, etc.)
- La configuración de helmet respeta las necesidades de la app (por ejemplo, frameguard desactivado si se usan iframes internos para preview de email)

## Out of scope
- Configuración de Cloudflare (es a nivel DNS/proxy, no código)
- Backups automáticos (configuración de Coolify)
- Migración a Clerk o cambios en el sistema de autenticación

## Tasks
1. **Instalar helmet** — Agregar la librería `helmet` como dependencia del proyecto.

2. **Configurar helmet en Express** — Agregar `app.use(helmet(...))` en `server/index.ts` con configuración adaptada: desactivar `frameguard` y `contentSecurityPolicy` para no romper los iframes de preview de email y la carga de imágenes base64/externas.

## Relevant files
- `server/index.ts:1-56`
