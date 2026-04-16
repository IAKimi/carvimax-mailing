# Documento de Seguridad y Configuración de Producción VPS

## What & Why
El usuario necesita un documento aparte (adicional al manual de migración existente) con instrucciones detalladas para dejar su VPS Ubuntu listo para producción con seguridad profesional. La app PostIAlo Mailing corre en Node.js en el puerto 5000 detrás de Nginx como reverse proxy.

## Done looks like
Un archivo markdown descargable (`SEGURIDAD_VPS.md`) con las siguientes secciones completas y listas para copiar/pegar:

1. **Nginx Reverse Proxy** — Archivo de configuración completo para Nginx como reverse proxy hacia Node.js puerto 5000. Incluir headers de seguridad, WebSocket support (la app usa ws), tamaño máximo de body (25MB por las imágenes), y configuración de caché para archivos estáticos.

2. **PM2 — Gestión de procesos** — Configuración completa de PM2 con ecosystem.config.cjs, auto-restart en crash, auto-start en reboot del servidor (`pm2 startup` + `pm2 save`), logs con rotación, y monitoreo.

3. **UFW Firewall** — Comandos exactos para configurar UFW permitiendo solo puertos 80 (HTTP), 443 (HTTPS) y 22 (SSH). Denegar todo lo demás por defecto.

4. **Certificado SSL con Let's Encrypt** — Instrucciones paso a paso para instalar Certbot, obtener certificado SSL gratuito, y configurar renovación automática. Incluir la configuración Nginx actualizada con SSL.

5. **Hardening del servidor** — Pasos para:
   - Crear usuario no-root dedicado para la app
   - Deshabilitar login root por SSH
   - Configurar autenticación SSH por clave (deshabilitar contraseñas)
   - Permisos correctos en archivos de la app y .env
   - Fail2ban para proteger contra fuerza bruta
   - Headers de seguridad HTTP adicionales
   - Deshabilitar listado de directorios
   - Límites de rate limiting en Nginx

## Relevant context
- Puerto de la app: 5000
- La app usa WebSockets (ws) para comunicación en tiempo real
- El body limit de Express es 25MB (por uploads de imágenes)
- Carpeta uploads/ sirve archivos estáticos (logos, imágenes de campañas)
- Variables de entorno sensibles: DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, GEMINI_API_KEY
- El build produce dist/index.cjs (servidor) y dist/public/ (frontend)
- Ya existe MANUAL_MIGRACION_VPS.md con la instalación base; este documento es complementario

## Relevant files
- MANUAL_MIGRACION_VPS.md (documento existente de referencia)
- server/index.ts (configuración del servidor Express)
- package.json (scripts de build/start)
