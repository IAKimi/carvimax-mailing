# Guía de Migración — PostIAlo Mailing entre cuentas de Replit

Este runbook describe cómo mover el entorno de desarrollo de PostIAlo Mailing
desde una cuenta de Replit a otra cuenta de Replit. Está pensado para que un
agente que no conoce el proyecto pueda seguirlo de arriba a abajo sin
adivinar nada.

> **La base de datos de producción NO se toca con esta migración.**
> Producción vive en un VPS (Coolify + Docker) con su propia Postgres,
> independiente de Replit. El cambio de cuenta solo afecta el entorno de
> desarrollo. Usuarios reales, sesiones activas, dominio y datos
> productivos siguen funcionando sin cambios.

---

## Fase 1 — Exportar desde la cuenta vieja

Esto lo hace el dueño del proyecto en la cuenta de Replit que va a abandonar.

### 1.1 Asegurar que GitHub tiene el código más reciente
- [ ] Abrir el panel de Version Control en Replit.
- [ ] Verificar que no haya cambios sin commitear.
- [ ] Si hay cambios pendientes: commit + push a la rama `main`.
- [ ] Confirmar en GitHub.com que el último commit aparece visible.

### 1.2 Anotar todos los Secrets de la cuenta vieja
Abrir Tools → Secrets y copiar a un lugar seguro (gestor de contraseñas, NO
en texto plano) los valores de estas variables. Los nombres tienen que
coincidir exactamente al cargarlas en la cuenta nueva:

- [ ] `SESSION_SECRET` — **CRÍTICO**: si se cambia este valor, todas las API
      keys de Brevo/Mailchimp guardadas por usuarios dejan de descifrarse.
      Copiar el valor exacto.
- [ ] `OPENAI_API_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `MAKE_VERIFICATION_WEBHOOK_URL`
- [ ] `MAKE_WEBHOOK_SECRET` (también está duplicada en `.replit` bajo
      `[userenv.shared]`)
- [ ] `APP_URL` o `PRODUCTION_URL` (si se setearon manualmente)

`DATABASE_URL` NO se copia — la cuenta nueva genera la suya cuando se
provisiona la DB.

### 1.3 (Opcional) Descargar carpeta `uploads/`
La carpeta `uploads/` contiene logos de marca e imágenes de campañas
subidas por usuarios. NO está versionada en Git.
- [ ] Si se quiere conservar este contenido en el entorno de desarrollo
      nuevo, descargarla manualmente desde la cuenta vieja antes de cerrar
      el acceso.
- [ ] Para una cuenta nueva limpia (recomendado), no es necesario migrarla.

### 1.4 Desconectar GitHub de la cuenta vieja
**Hacer este paso solo después de completar toda la Fase 2 y verificar que
la cuenta nueva funciona.**
- [ ] En Replit (cuenta vieja): desconectar la integración con GitHub para
      evitar pushes accidentales desde el repl viejo.
- [ ] (Opcional) Archivar o eliminar el Repl viejo.

---

## Fase 2 — Bootstrap en la cuenta nueva

Estos pasos los ejecuta el agente de la cuenta nueva, en orden estricto.

### 2.1 Importar el repo desde GitHub
- [ ] En la cuenta nueva de Replit: Create Repl → **Import from GitHub**.
- [ ] Pegar la URL del repositorio.
- [ ] Esperar a que termine la clonación.
- [ ] Si Replit pregunta el tipo de proyecto, elegir Node.js.

### 2.2 Provisionar la base de datos
- [ ] Abrir Tools → Database.
- [ ] Crear una **nueva** base de datos PostgreSQL del lado de Replit.
      **No usar la URL de la DB de producción.** El entorno de desarrollo
      tiene que estar aislado del entorno productivo.
- [ ] Confirmar que `DATABASE_URL` aparece auto-cargada en Tools → Secrets.

### 2.3 Instalar dependencias
```bash
npm install
```

### 2.4 Cargar Secrets — pedirle al usuario uno por uno
Antes de seguir, el agente debe **pausar y pedir al usuario** los valores de
cada uno de estos Secrets, e ir cargándolos en Tools → Secrets:

1. `SESSION_SECRET` — pedirlo exactamente igual al de la cuenta vieja.
   No generar uno nuevo: rompería todas las API keys guardadas por usuarios.
2. `OPENAI_API_KEY`
3. `GEMINI_API_KEY`
4. `MAKE_VERIFICATION_WEBHOOK_URL`
5. `MAKE_WEBHOOK_SECRET`
6. (Opcional) `APP_URL` y/o `PRODUCTION_URL` si el usuario quiere apuntar
   a un dominio custom.

> Ver `.env.example` para la lista completa con descripciones.

### 2.5 Aplicar el schema a la DB nueva
```bash
npm run db:push
```
Este comando lee `shared/schema.ts` y crea todas las tablas. **No existe
una carpeta `migrations/` en este proyecto** — Drizzle Kit hace push
directo del schema. Si pide forzar la sincronización por algún cambio
destructivo, usar `npm run db:push --force`.

### 2.6 Levantar el workflow
- [ ] Hacer clic en Run, o ejecutar `npm run dev`.
- [ ] Verificar en consola que aparece `serving on port 5000` (o equivalente)
      sin errores fatales de conexión a DB ni de variables faltantes.

### 2.7 Healthchecks
Verificar de arriba abajo que el entorno está sano:

- [ ] **Frontend carga**: abrir la vista previa, debe verse la pantalla de
      login con la marca "PostIAlo Mailing".
- [ ] **API responde**: en otra pestaña/curl pegar
      `GET /api/auth/me` — debe devolver `401 { message: "No autenticado." }`.
- [ ] **Registro funciona**: crear un usuario de prueba desde la UI. Debe
      llegar el correo de verificación (validar que el webhook de Make.com
      ejecutó).
- [ ] **Verificación de email**: hacer clic en el link del correo. Debe
      autologuear y redirigir a `/`.
- [ ] **OpenAI responde**: completar el onboarding hasta crear una plantilla
      con IA. Si la generación de texto funciona, OpenAI está bien.
- [ ] **Gemini responde**: en una campaña, generar una imagen con IA. Si la
      imagen vuelve, Gemini está bien.
- [ ] **(Si aplica) Login del admin**: si se quiere acceso admin en el
      entorno de desarrollo, usar SQL para promover al usuario:
      ```sql
      UPDATE users SET role = 'superadmin', is_verified = true
      WHERE email = 'tu@email.com';
      ```

### 2.8 Reconectar GitHub
- [ ] En el panel de Version Control de la cuenta nueva, vincular la cuenta
      de GitHub y conectar al mismo repositorio.
- [ ] Hacer un commit de prueba pequeño (ej: actualizar un comentario) y
      verificar que el push llega a GitHub.

Una vez que todo lo anterior está verde, volver a la Fase 1.4 y desconectar
GitHub de la cuenta vieja.

---

## Fase 3 — Producción queda intacta

Esta migración **no toca producción de ninguna forma**. Específicamente:

- La instancia de producción corre en un VPS con Coolify + Docker (ver
  `MANUAL_MIGRACION_VPS.md`, `DOCKER_COOLIFY.md`, `Dockerfile`,
  `docker-compose.yml`). Esa infraestructura es independiente de Replit.
- La base de datos PostgreSQL de producción vive en el VPS, NO en Replit.
  Sus usuarios, campañas, contactos y demás datos no se ven afectados.
- El dominio público (custom domain, DNS, certificados TLS) sigue
  apuntando al VPS de producción. Cambiar de cuenta de Replit no altera
  nada de eso.
- Las sesiones activas de usuarios reales en producción siguen vivas; el
  cookie está firmado con el `SESSION_SECRET` del VPS, no con el de Replit.
- Los webhooks de Make.com configurados contra el dominio de producción
  siguen funcionando.

Si en el futuro hay que tocar producción (deploy de nueva versión, rotar
secrets productivos, etc.), eso es un procedimiento separado documentado
en `MANUAL_MIGRACION_VPS.md` y `SEGURIDAD_VPS.md`.

---

## Anexo — Qué pasa con el historial del agente

El historial de chat con el agente de Replit **no se transfiere entre
cuentas**. Para que el agente nuevo no parta de cero:

- `replit.md` (raíz) tiene la arquitectura, convenciones, gotchas y el
  flujo de producto. Se carga automáticamente en la memoria del agente.
- `.local/tasks/` contiene los planes históricos de cada feature/fix
  desarrollado. Está incluido en el repo gracias a la excepción
  configurada en `.gitignore`. El agente nuevo puede leer cualquier
  `.local/tasks/*.md` para entender por qué se tomaron decisiones
  específicas.
- Este archivo (`MIGRATION_GUIDE.md`) y `.env.example` documentan el
  bootstrap.

Con esos cuatro artefactos el agente nuevo tiene todo lo que necesita.
