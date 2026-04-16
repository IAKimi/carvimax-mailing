---
title: Verificación de correo electrónico al registrarse
---
# Verificación de correo electrónico al registrarse

## What & Why
Actualmente cualquier persona puede registrarse con cualquier correo y acceder inmediatamente a la plataforma sin verificar que el correo le pertenezca. Esto permite cuentas falsas y uso no autorizado. Se necesita un flujo de verificación donde al registrarse se dispara un webhook a Make.com, Make envía el correo de confirmación, y al hacer clic en el enlace de confirmación se activa la cuenta e inicia sesión automáticamente.

## Done looks like
- Al registrarse, la plataforma dispara webhook a Make con los datos del usuario y queda en una pantalla de "Verifica tu correo"
- El usuario recibe un correo (enviado por Make) con botón de confirmación
- Al hacer clic en el botón, se abre una pestaña en el navegador que verifica la cuenta, inicia sesión automáticamente, y redirige al dashboard (sin necesidad de volver a escribir correo y contraseña)
- La pantalla de "Verifica tu correo" también detecta automáticamente cuando se verificó (polling cada 3 segundos) y redirige al dashboard
- Si intenta hacer login sin verificar, ve mensaje con opción de reenviar correo
- Los usuarios existentes quedan verificados automáticamente via migración

## Out of scope
- Flujo de "olvidé mi contraseña" (trabajo futuro)
- Captcha o protección anti-bot (trabajo futuro)
- Configuración del escenario dentro de Make (el usuario lo hace)

## Payload que Make recibe en el webhook

El webhook `https://hook.eu2.make.com/0ifmac54kwkvgc85hlyq8nuxdfl15spu` recibirá un POST con este JSON:

```json
{
  "type": "verification",
  "email": "usuario@ejemplo.com",
  "name": "Nombre del Usuario",
  "company": "Nombre de Empresa",
  "verificationLink": "https://tudominio.com/api/auth/verify/TOKEN_UUID_AQUI"
}
```

El campo `verificationLink` es la URL que debe ir en el botón "Confirmar" o "Acceder ahora" del correo. Cuando el usuario haga clic, la plataforma se encarga del resto.

## Tasks
1. **Agregar campos de verificación al schema** — Añadir `isVerified` (boolean, default false), `verificationToken` (text, nullable) y `verificationTokenExpiresAt` (timestamp, nullable) a la tabla `users`. Crear migración que marque todos los usuarios existentes como verificados.

2. **Modificar endpoint de registro** — Al crear usuario: generar token UUID único, guardarlo en DB con expiración de 24 horas, disparar webhook a Make con payload `{ type, email, name, company, verificationLink }`. NO iniciar sesión automáticamente. Retornar `{ success: true, needsVerification: true, email }`.

3. **Crear endpoint de verificación** — `GET /api/auth/verify/:token` que valide el token, verifique que no esté expirado, marque `isVerified = true`, limpie el token, inicie sesión automáticamente (setear `req.session.userId`), y redirija al dashboard (`/`).

4. **Crear endpoint de estado de verificación** — `GET /api/auth/verification-status/:email` que retorne `{ verified: true/false }` para que el frontend haga polling y detecte cuando se verificó.

5. **Crear endpoint de reenvío** — `POST /api/auth/resend-verification` que reciba el email, genere nuevo token, y dispare nuevamente el webhook a Make.

6. **Modificar endpoint de login** — Verificar `isVerified === true` antes de permitir el acceso. Si no está verificado, retornar `{ message: "...", needsVerification: true, email }` para que el frontend muestre botón de reenviar.

7. **Pantalla post-registro con polling** — Después de registrarse, mostrar pantalla con diseño PostIAlo (azul #002073, logo con IA en rojo) indicando que revise su correo. Incluir botón "Reenviar correo" y polling cada 3 segundos a `/api/auth/verification-status/:email`. Cuando detecte verificación, redirigir automáticamente al dashboard.

8. **Actualizar pantalla de login** — Manejar el error de "no verificado" mostrando mensaje diferenciado con botón para reenviar. Si llegan al login después de verificar por la otra pestaña, el polling los habrá redirigido al dashboard.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts:64-73,330-353,354-395`
- `server/storage.ts`
- `server/migrations.ts`
- `server/index.ts`
- `client/src/pages/Home.tsx`
- `server/seed.ts`
- `server/seed-data.json`