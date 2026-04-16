---
title: Rediseño Vista Final del Correo Enviado
---
# Rediseño Vista Final del Correo Enviado

## What & Why
La sección "Vista Final del Correo" que se muestra cuando una campaña ya fue enviada se ve desordenada: todo está apilado verticalmente y el preview del correo requiere scroll. El usuario quiere un layout de dos columnas más limpio y profesional.

## Done looks like
- Al abrir una campaña enviada, se ve un layout de dos columnas:
  - **Columna izquierda (más ancha):** La previsualización completa del correo, alargada verticalmente para que se vea completo sin necesidad de hacer scroll dentro del iframe.
  - **Columna derecha:** Los datos del envío apilados verticalmente en tarjetas: Asunto, CTA, Versión, Estado, y Base de Datos de Destino.
- El diseño se ve limpio y profesional, como un reporte de envío.
- En pantallas pequeñas (móvil), las columnas se apilan verticalmente.

## Out of scope
- Cambiar la funcionalidad de envío o tracking.
- Modificar cómo se ve la sección para campañas en borrador o en edición.

## Tasks
1. **Reestructurar el layout de la sección "Vista Final"** — Cambiar la cuadrícula de tarjetas horizontales a un layout de dos columnas (preview izquierda, datos derecha). El iframe del preview debe ocupar toda la altura necesaria sin scroll interno.
2. **Diseñar las tarjetas de datos del lado derecho** — Apilar verticalmente las tarjetas de Asunto, CTA, Versión, Estado y Base de Datos de Destino con buen espaciado y estilo visual consistente.
3. **Responsividad** — Asegurar que en pantallas pequeñas las columnas se apilen verticalmente (preview arriba, datos abajo).

## Relevant files
- `client/src/pages/CalendarView.tsx:929-972`