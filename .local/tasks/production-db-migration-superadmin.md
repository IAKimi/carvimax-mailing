# Migración de producción: superadmin y limpieza

## What & Why
Los cambios del Task #23 (jerarquía superadmin) actualizaron el código y la base de datos de desarrollo, pero la base de datos de producción no fue actualizada porque el script de seed solo corre cuando la DB está vacía. Se necesita un script de migración que se ejecute al arrancar el servidor y aplique los cambios pendientes de forma idempotente (una sola vez) en cualquier entorno, incluyendo producción.

## Done looks like
- Al iniciar la app en producción, el usuario admin@postialo.com tiene rol "superadmin"
- El usuario E2E Test (id=9) y sus datos asociados se eliminan de producción si existen
- El script de migración es idempotente: solo aplica cambios si son necesarios, no falla si ya fueron aplicados
- Después de ejecutarse una vez, no vuelve a hacer cambios en siguientes reinicios
- La app se redespliega y los cambios se reflejan correctamente en producción

## Out of scope
- Cambios en la lógica de negocio de superadmin (ya implementada en Task #23)
- Modificaciones a las rutas o frontend (ya implementados)

## Tasks
1. **Crear script de migración** — Agregar una función `runMigrations()` en un nuevo archivo `server/migrations.ts` que verifique y aplique cambios pendientes: actualizar rol de admin@postialo.com a superadmin, eliminar usuario E2E (id=9) y sus datos dependientes. Usar una tabla de control `_migrations` para registrar migraciones ya ejecutadas.
2. **Integrar al arranque** — Llamar `runMigrations()` desde `server/index.ts` después del seed, antes de aceptar conexiones.
3. **Asegurar que el build incluya la migración** — Verificar que el archivo de migraciones se compila correctamente con el bundle.
4. **Rebuild y redeploy** — Compilar, verificar que la migración se ejecuta correctamente en dev, y redesplegar a producción.

## Relevant files
- `server/index.ts:94-134`
- `server/seed.ts`
- `server/routes.ts:1705-1714`
