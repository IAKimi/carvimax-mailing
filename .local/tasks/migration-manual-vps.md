# Manual de migración VPS para PostIAlo Mailing

## What & Why
El usuario quiere migrar PostIAlo Mailing desde el deployment de Replit hacia un servidor VPS propio con Ubuntu, manteniendo Replit como entorno de desarrollo (vibe coding) y usando GitHub para sincronizar los cambios. Necesita un manual de instalación completo, comandos de migración de estructura, exportación de datos, y plantilla de variables de entorno.

## Done looks like
- Un archivo markdown descargable con el manual completo de instalación en Ubuntu VPS
- Incluye: versiones exactas de Node.js/PostgreSQL, comandos de instalación, configuración de Drizzle para crear tablas, script de dump/restore de datos, plantilla .env, instrucciones de proceso con PM2, y checklist de verificación
- El archivo de la carpeta uploads/ se debe copiar manualmente (logos e imágenes de campañas)

## Out of scope
- Configuración de dominio/DNS/SSL (depende del proveedor del usuario)
- Configuración de Nginx como reverse proxy (se menciona pero no se detalla)
- CI/CD automático desde GitHub (se puede hacer después)

## Tasks
1. **Generar el manual de migración** — Crear un archivo markdown completo con todas las secciones solicitadas: instalación de dependencias, migración de estructura, exportación/importación de datos, plantilla .env, e instrucciones de ejecución.
2. **Presentar al usuario** — Entregar el archivo como descargable.

## Relevant files
- `package.json`
- `shared/schema.ts`
- `drizzle.config.ts`
- `server/index.ts`
- `server/db.ts`
