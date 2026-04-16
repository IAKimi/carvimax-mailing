# Filtro por fecha en Dashboard

## What & Why
El Dashboard actualmente muestra todas las métricas sin posibilidad de filtrar por período. El usuario necesita ver estadísticas filtradas por rango de fechas para analizar rendimiento por períodos específicos.

## Done looks like
- El Dashboard tiene un selector de rango de fechas en la parte superior
- Opciones rápidas: "Última semana", "Último mes", "Últimos 3 meses", "Todo el tiempo", "Rango personalizado"
- En "Rango personalizado" aparecen dos date pickers (desde/hasta)
- Las métricas del Dashboard (campañas enviadas, contactos alcanzados, tasas) se recalculan según el filtro seleccionado
- Por defecto muestra "Último mes"
- El filtro persiste mientras el usuario está en la página

## Out of scope
- Exportar datos filtrados a CSV/Excel
- Gráficos de tendencia temporal

## Tasks
1. **Agregar parámetros de fecha al endpoint** — Modificar los endpoints que alimentan el Dashboard para aceptar parámetros `from` y `to` como query strings y filtrar por `createdAt` o `scheduledAt`.
2. **UI del filtro de fecha** — Agregar un componente selector de rango de fechas en la parte superior del Dashboard con las opciones rápidas y el rango personalizado.
3. **Conectar filtro con queries** — Los queries de TanStack del Dashboard deben incluir los parámetros de fecha seleccionados en el queryKey para refetch automático.

## Relevant files
- `client/src/pages/Dashboard.tsx`
- `server/routes.ts`
