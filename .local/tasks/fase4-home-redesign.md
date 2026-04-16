# Rediseño de página Home

## What & Why
La página de Home tiene varios problemas de UX: (1) las secciones "Mi Producto" y "¿Cómo funciona?" son colapsables y no deberían serlo — siempre deben estar visibles, (2) el layout de estas secciones apiladas no es visualmente atractivo, (3) el botón "Ir a Identidad de Marca" al fondo es irrelevante si el usuario ya completó su identidad de marca, (4) se muestra el ID de la base de datos en lugar del nombre en algunos lugares.

## Done looks like
- Las secciones "Mi Producto" y "¿Cómo funciona?" están siempre visibles, sin posibilidad de colapsar
- Nuevo layout: las dos secciones se muestran lado a lado en pantallas grandes (dos tarjetas horizontales) y apiladas en móvil
- El diseño es limpio y atractivo: "Mi Producto" con chips/bullets de beneficios, "¿Cómo funciona?" con pasos numerados y conectores visuales
- Si la identidad de marca está al 100% completa (hasBrand: true), el botón inferior cambia a "Crear nueva campaña" dirigiendo al calendario, en lugar de "Ir a Identidad de Marca"
- Donde se muestra información de la base de datos, se muestra el nombre real (ej: "IAKimi BD") y no el ID numérico
- El conteo de contactos muestra el número correcto

## Out of scope
- Cambiar el contenido de los textos de features/pasos
- Agregar nuevas secciones al Home

## Tasks
1. **Eliminar funcionalidad colapsable** — Reemplazar el componente DropdownSection por contenido siempre visible, manteniendo el mismo contenido interno.
2. **Rediseñar layout** — Implementar dos tarjetas lado a lado con border sutil y fondo diferenciado. "Mi Producto" a la izquierda, "¿Cómo funciona?" a la derecha. Responsive: stack en móvil.
3. **Botón condicional** — Consultar `/api/onboarding-status` y si `hasBrand: true`, cambiar el CTA inferior a "Crear nueva campaña" con ícono de calendario.
4. **Fix display de base de datos** — Revisar todos los lugares donde se muestra targetDatabase (que almacena el ID) y resolver el nombre real de la BD usando los datos disponibles.

## Relevant files
- `client/src/pages/Home.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/CalendarView.tsx:969-1010`
