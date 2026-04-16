# Onboarding progresivo con desbloqueo de sidebar

## What & Why
Los usuarios pueden acceder al Calendario y crear campañas sin tener plantillas ni bases de datos cargadas, lo que causa errores. Se necesita un flujo progresivo que desbloquee secciones del sidebar conforme el usuario completa los pasos previos. Esto aplica tanto para usuarios nuevos como para usuarios que borren sus recursos — el sistema debe revertir el acceso dinámicamente.

## Done looks like
- El sidebar se reorganiza en este orden: Inicio, Identidad de Marca, Plantillas, Base de Datos, Calendario, Historial, Dashboard (y Usuarios para admins).
- Las secciones se desbloquean progresivamente:
  - Inicio e Identidad de Marca: siempre visibles.
  - Plantillas: visible solo cuando la identidad de marca tiene los campos esenciales completos (companyName, industry, tone como mínimo).
  - Base de Datos: visible solo cuando existe al menos una plantilla.
  - Calendario, Historial y Dashboard: visibles solo cuando existen al menos una plantilla Y al menos una base de datos.
- Las secciones bloqueadas aparecen en gris con un candado, y al hacer clic muestran un mensaje indicando qué falta completar.
- Si un usuario accede a una ruta bloqueada directamente (por URL), se le redirige a la sección que necesita completar.
- Identidad de Marca muestra un botón "Siguiente" al final que navega a Plantillas (visible solo cuando la identidad está suficientemente completa).
- Plantillas muestra un botón "Siguiente" que navega a Base de Datos (visible solo cuando hay al menos una plantilla creada).
- Base de Datos muestra un botón "Ir a Calendario" (visible solo cuando hay al menos una base de datos con contactos).
- Base de Datos muestra un disclaimer rojo visible: "Tu archivo debe contener al menos las columnas 'nombre' y 'correo'. Los demás campos serán ignorados."
- Si un usuario borra todas sus plantillas o bases de datos, el sistema detecta el cambio y revierte el acceso, mostrando solo las secciones desbloqueadas.

## Out of scope
- Cambios en la lógica interna de cada página (solo navegación y acceso).
- Tutorial mode (ya existe por separado).
- Cambiar el flujo de creación de plantillas o bases de datos en sí.

## Tasks
1. **Crear endpoint de estado de onboarding** — Nuevo endpoint GET /api/onboarding-status que devuelve: hasBrandIdentity (boolean), hasTemplates (boolean), hasContactDatabases (boolean). Evalúa los datos del usuario actual.
2. **Reorganizar orden del sidebar** — Cambiar el orden de NAV_ITEMS en Layout.tsx a: Inicio, Identidad de Marca, Plantillas, Base de Datos, Calendario, Historial, Dashboard, Usuarios.
3. **Implementar gating visual en sidebar** — Consumir /api/onboarding-status en Layout.tsx. Las secciones bloqueadas se muestran en gris con icono de candado. Al hacer clic, mostrar toast con el mensaje de qué falta. Las secciones desbloqueadas funcionan normal.
4. **Proteger rutas bloqueadas** — En App.tsx o ProtectedRoute, si el usuario accede por URL a una sección bloqueada, redirigir a la sección que debe completar primero.
5. **Agregar botones "Siguiente" en cada paso** — BrandIdentity.tsx: botón "Siguiente" al final → navega a /templates. Templates.tsx: botón "Siguiente" → navega a /contacts. ContactsPage.tsx: botón "Ir a Calendario" → navega a /calendar.
6. **Disclaimer en Base de Datos** — Agregar banner rojo visible en la página de contactos que indique los campos obligatorios (nombre y correo) y que los demás serán ignorados.

## Relevant files
- `client/src/components/Layout.tsx`
- `client/src/App.tsx`
- `client/src/pages/BrandIdentity.tsx`
- `client/src/pages/Templates.tsx`
- `client/src/pages/ContactsPage.tsx`
- `server/routes.ts`
