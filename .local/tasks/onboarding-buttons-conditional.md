# Ocultar botones de onboarding cuando ya hay datos

## What & Why
Los botones "Siguiente: Base de Datos" en Plantillas, "Siguiente: Plantillas" en Marca, e "Ir a Calendario" en Contactos aparecen siempre que la sección actual tiene datos, sin verificar si el siguiente paso ya fue completado. Si el usuario ya tiene datos en todas las secciones, estos botones de onboarding no deberían aparecer.

## Done looks like
- En la página de Plantillas, el botón "Siguiente: Base de Datos" no aparece si el usuario ya tiene al menos una base de datos de contactos
- En la página de Marca/Identidad, el botón "Siguiente: Plantillas" no aparece si el usuario ya tiene al menos una plantilla
- En la página de Contactos, el botón "Ir a Calendario" no aparece si el usuario ya tiene al menos una campaña
- Los botones sí aparecen durante el primer uso cuando las secciones destino están vacías

## Out of scope
- Cambios en el sidebar o sistema de niveles de onboarding
- Cambios en el tutorial guiado

## Tasks
1. **Consultar estado de onboarding** — En cada página (Plantillas, BrandIdentity, Contactos), consultar el endpoint `/api/onboarding-status` para saber si las secciones destino ya tienen datos.
2. **Condicionar visibilidad** — Ocultar los botones "Siguiente" cuando la sección destino ya tenga datos según el estado de onboarding.

## Relevant files
- `client/src/pages/Templates.tsx:676-690`
- `client/src/pages/BrandIdentity.tsx:711-725`
- `client/src/pages/Contacts.tsx:751-765`
- `server/routes.ts:1123`
