# Sincronizar todos los datos de desarrollo a producción

## What & Why
La base de datos de producción tiene los usuarios pero le faltan todos los datos asociados: identidad de marca, plantillas, bases de contactos, contactos, campañas, versiones de campaña y envíos. El script de seed solo corre cuando la DB está vacía, y como ya tiene usuarios, nunca insertó el resto. Se necesita una migración que inserte todos los datos faltantes usando el seed-data.json existente.

## Done looks like
- Al iniciar la app en producción, todos los datos del seed-data.json están presentes: 1 identidad de marca, 3 plantillas, 2 bases de contactos, 6 contactos, 2 campañas, 3 versiones de campaña, 16 envíos
- El usuario demo@postialo.com ve su identidad de marca configurada, sus plantillas, contactos y campañas anteriores
- La migración es idempotente: usa ON CONFLICT DO NOTHING para no duplicar datos existentes
- La migración se ejecuta una sola vez (registrada en la tabla _migrations)
- Después de verificar en dev, se redespliega a producción

## Out of scope
- Cambios en la estructura de la base de datos o lógica del negocio
- Nuevos features o correcciones de UI

## Tasks
1. **Agregar migración 002** — En server/migrations.ts, agregar una nueva migración que lea seed-data.json y ejecute INSERT ... ON CONFLICT DO NOTHING para todas las tablas (brand_identity, templates, contact_databases, contacts, campaigns, campaign_versions, campaign_sends). Incluir setval de secuencias para evitar conflictos de ID futuros.
2. **Rebuild y verificar** — Compilar, reiniciar, verificar que la migración se aplica correctamente en dev (sin errores, sin duplicar datos existentes).
3. **Redesplegar** — Publicar para que la migración se ejecute en producción al arrancar.

## Relevant files
- `server/migrations.ts`
- `server/seed.ts`
- `server/seed-data.json`
- `server/index.ts:122-124`
