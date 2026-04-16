# Rediseño Home fullwidth + corrección de enlaces y lógica

## What & Why
La página Home tiene varios problemas: enlaces rotos (Contactos apunta a `/databases` en vez de `/contacts`, "Ver todo" apunta a `/my-emails` en vez de `/emails`), el layout no es fullwidth como el resto de secciones, el CTA de "Identidad de Marca" aparece aunque la marca esté completa, y la actividad reciente muestra el prompt en vez del asunto generado por la IA.

## Done looks like
- Los botones de "Contactos" y "Ver todo" navegan correctamente sin errores 404
- La página Home ocupa todo el ancho disponible (fullwidth), igual que las demás secciones
- Layout en 2 columnas: izquierda (4 botones de acción + "Cómo funciona" + "Funcionalidades") y derecha (indicadores de campañas enviadas/programadas + Actividad Reciente)
- El bloque CTA de "Ir a Identidad de Marca" se oculta cuando la identidad de marca está completa (hasBrand=true del endpoint onboarding-status)
- La actividad reciente muestra el asunto del correo (de la versión seleccionada del campaign contentJson) en vez del prompt/idea

## Out of scope
- Cambios en el Dashboard (tiene su propia página)
- Cambios en el flujo de onboarding del sidebar

## Tasks
1. **Corregir enlaces rotos** — Cambiar `/databases` a `/contacts` y `/my-emails` a `/emails` en Home.tsx.
2. **Hacer layout fullwidth** — Eliminar restricción de ancho máximo centrado y hacer que Home ocupe el 100% del ancho disponible, igual que las demás secciones.
3. **Rediseñar en 2 columnas** — Columna izquierda con los 4 botones de acción rápida, sección "Cómo funciona" y "Funcionalidades". Columna derecha con indicadores de campañas (enviadas, programadas) y lista de actividad reciente.
4. **Condicionar CTA de marca** — Consultar el endpoint `/api/onboarding-status` y ocultar el bloque CTA de "Ir a Identidad de Marca" cuando `hasBrand` sea true.
5. **Mostrar asunto real en actividad reciente** — Cargar las versiones seleccionadas de las campañas recientes y mostrar el `subject` del `contentJson` en lugar del campo `name` (que contiene el prompt).

## Relevant files
- `client/src/pages/Home.tsx`
- `client/src/App.tsx:130-145`
- `server/routes.ts:332-340`
- `server/storage.ts:231-337`
