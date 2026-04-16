# Plan de pruebas QA completo de la plataforma

## What & Why
Crear un documento de pruebas estructurado (checklist QA) que el usuario pueda seguir paso a paso para probar todas las funcionalidades de PostIAlo Mailing. Este documento será un archivo descargable que cubra cada módulo de la plataforma con instrucciones claras de qué probar, qué resultado esperar, y dónde marcar si pasa o falla.

## Done looks like
- Un documento Markdown descargable con un checklist completo organizado por módulos: Registro/Login, Identidad de Marca, Calendario/Campañas, Contactos/Bases de Datos, Plantillas, Historial de Correos, Dashboard, Tutorial, y Panel de Administración.
- Cada ítem del checklist describe la acción a realizar y el resultado esperado.
- El documento se presenta al usuario para que lo use como guía de auditoría.

## Out of scope
- Automatización de pruebas
- Corrección de bugs encontrados durante las pruebas (se abordarán por separado)

## Tasks
1. **Auditar todos los módulos** — Revisar el código de cada sección de la plataforma para listar todas las funcionalidades probables.
2. **Crear el documento QA** — Escribir el checklist con secciones por módulo, acciones paso a paso, y resultado esperado para cada una.
3. **Entregar al usuario** — Presentar el documento como archivo descargable.

## Relevant files
- `client/src/pages/Home.tsx`
- `client/src/pages/BrandIdentity.tsx`
- `client/src/pages/CalendarView.tsx`
- `client/src/pages/Contacts.tsx`
- `client/src/pages/Templates.tsx`
- `client/src/pages/MyEmails.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/AdminPanel.tsx`
- `server/routes.ts`
