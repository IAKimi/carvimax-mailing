# PostIAlo Mailing — Guía Completa de Despliegue con Docker y Coolify

> **Subdominio objetivo**: `mailing.postialo.com`
> **Requisito**: Tener Coolify instalado y funcionando en tu VPS.

---

## Índice

1. [Entender la arquitectura](#1-entender-la-arquitectura)
2. [Preparar el repositorio en GitHub](#2-preparar-el-repositorio-en-github)
3. [Crear la base de datos en Coolify](#3-crear-la-base-de-datos-en-coolify)
4. [Crear el proyecto PostIAlo en Coolify](#4-crear-el-proyecto-postialo-en-coolify)
5. [Configurar las variables de entorno](#5-configurar-las-variables-de-entorno)
6. [Configurar el volumen para uploads/](#6-configurar-el-volumen-para-uploads)
7. [Crear las tablas y cargar datos](#7-crear-las-tablas-y-cargar-datos)
8. [Primer despliegue](#8-primer-despliegue)
9. [Migrar archivos existentes (uploads/)](#9-migrar-archivos-existentes-uploads)
10. [Actualizaciones futuras](#10-actualizaciones-futuras)
11. [Respaldos](#11-respaldos)
12. [Solución de problemas](#12-solución-de-problemas)

---

## 1. Entender la arquitectura

### ¿Cómo se conecta todo?

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │  Tu VPS Ubuntu  │
              │                 │
              │   ┌──────────┐  │
              │   │ Coolify  │  │
              │   │ (Traefik)│  │   ← Gestiona dominios, SSL y proxy
              │   └────┬─────┘  │
              │        │        │
              │   ┌────┴────────┴────────────────────┐
              │   │         Red interna Docker        │
              │   │                                   │
              │   │  ┌─────────────┐  ┌────────────┐ │
              │   │  │ PostIAlo    │  │ PostgreSQL │ │
              │   │  │ App         │──│ 16         │ │
              │   │  │ (puerto     │  │            │ │
              │   │  │  5000)      │  │            │ │
              │   │  └─────────────┘  └────────────┘ │
              │   │                                   │
              │   │  ┌──────┐ ┌──────────┐ ┌──────┐  │
              │   │  │ N8N  │ │Evolution │ │ Otros│  │  ← Tus otros servicios
              │   │  └──────┘ │ API      │ └──────┘  │
              │   │           └──────────┘           │
              │   └──────────────────────────────────┘
              └─────────────────────────────────────────┘

Dominios:
  mailing.postialo.com  ──→  PostIAlo App (puerto 5000)
  n8n.tudominio.com     ──→  N8N
  api.tudominio.com     ──→  EvolutionAPI
```

### ¿Por qué 2 contenedores separados y no todo en uno?

| | Todo junto | Separados |
|---|---|---|
| **Actualizar la app** | Tumba la base de datos | La BD sigue intacta |
| **Si la app falla** | La BD también se cae | La BD sigue corriendo |
| **Respaldos** | Complicado | Independientes |
| **Escalabilidad** | Difícil | Puedes mover la BD a otro servidor |

**Decisión**: Usamos 2 contenedores — uno para la app y uno para PostgreSQL.

### ¿Qué NO necesitas configurar manualmente?

Coolify se encarga de todo esto automáticamente:

- **Nginx/Reverse Proxy** → Coolify usa Traefik internamente. No necesitas instalar ni configurar Nginx.
- **SSL/HTTPS** → Coolify obtiene certificados Let's Encrypt automáticamente. No necesitas Certbot.
- **Dominio** → Solo escribes `mailing.postialo.com` en Coolify y listo.

---

## 2. Preparar el repositorio en GitHub

Tu repositorio ya debe tener estos archivos (están incluidos en el proyecto):

### Verificar archivos necesarios:

```
tu-repositorio/
├── Dockerfile        ← Instrucciones para construir la imagen Docker
├── .dockerignore     ← Archivos que Docker debe ignorar
├── docker-compose.yml ← Referencia (Coolify lo usa como guía)
├── package.json
├── server/
├── client/
├── shared/
└── ... (resto del proyecto)
```

### Verificar que están en GitHub:

```bash
# En tu terminal local o en Replit
git add Dockerfile .dockerignore docker-compose.yml
git commit -m "Agregar archivos Docker para despliegue en Coolify"
git push origin main
```

> **Nota**: El `Dockerfile` le dice a Docker cómo construir tu aplicación paso a paso. El `.dockerignore` le dice qué archivos ignorar (como `node_modules`). Ambos ya están listos — no necesitas modificarlos.

---

## 3. Crear la base de datos en Coolify

Tienes dos opciones. Elige la que mejor te convenga:

### Opción A: Crear un PostgreSQL nuevo en Coolify (recomendado)

1. Entra al panel de Coolify (`https://tu-coolify.com`)
2. Ve a tu **Proyecto** (o crea uno nuevo llamado "PostIAlo")
3. Dentro del proyecto, haz clic en **"+ New"** → **"Resource"**
4. Selecciona **"Database"**
5. Elige **"PostgreSQL"**
6. Selecciona la versión **16** (o la más reciente disponible)
7. Configura:
   - **Name**: `postialo-db`
   - **Database**: `postialo_mailing`
   - **User**: `postialo`
   - **Password**: (Coolify genera una automáticamente — guárdala)
8. Haz clic en **"Start"**

#### Obtener la DATABASE_URL:

Una vez que PostgreSQL esté corriendo:

1. Haz clic en el recurso `postialo-db`
2. Ve a la pestaña **"Connection"** o **"General"**
3. Copia la **Internal URL** — se verá algo así:

```
postgresql://postialo:PASSWORD_GENERADA@postialo-db:5432/postialo_mailing
```

> **Importante**: Usa la URL **interna** (no la pública). Los contenedores se comunican por la red interna de Docker, no necesitan salir a internet.

### Opción B: Reutilizar un PostgreSQL que ya tengas

Si ya tienes un PostgreSQL corriendo en Coolify (por ejemplo, para N8N):

1. Conéctate a ese PostgreSQL
2. Crea una base de datos nueva:

```sql
CREATE DATABASE postialo_mailing;
CREATE USER postialo WITH PASSWORD 'una_password_segura';
GRANT ALL PRIVILEGES ON DATABASE postialo_mailing TO postialo;
```

3. La DATABASE_URL será:

```
postgresql://postialo:una_password_segura@NOMBRE_DEL_CONTENEDOR_PG:5432/postialo_mailing
```

> Para saber el nombre del contenedor de tu PostgreSQL existente, ve a Coolify → tu servicio PostgreSQL → pestaña "General" → busca el nombre del contenedor.

---

## 4. Crear el proyecto PostIAlo en Coolify

### Paso 1: Conectar GitHub (si no lo has hecho)

1. En Coolify, ve a **Settings** → **Sources** (o **"Git Providers"**)
2. Agrega tu cuenta de GitHub
3. Autoriza a Coolify para acceder a tus repositorios

### Paso 2: Crear el recurso

1. Ve a tu **Proyecto** en Coolify
2. Haz clic en **"+ New"** → **"Resource"**
3. Selecciona **"Application"**
4. Elige **"GitHub"** como fuente
5. Selecciona tu repositorio de PostIAlo Mailing
6. Selecciona la rama: **`main`**

### Paso 3: Configuración de build

Coolify detectará tu `Dockerfile` automáticamente. Verifica estos ajustes:

- **Build Pack**: `Dockerfile` (debe detectarse solo)
- **Dockerfile Location**: `/Dockerfile` (por defecto)
- **Build Context**: `/` (por defecto)

### Paso 4: Configurar puerto

1. En la configuración del recurso, busca **"Ports Exposes"** o **"Port"**
2. Escribe: **`5000`**
3. Esto le dice a Coolify qué puerto usa tu app internamente

### Paso 5: Configurar el dominio

1. Busca el campo **"Domains"**
2. Escribe: **`https://mailing.postialo.com`**

> **Requisito DNS**: Antes de esto, debes haber creado un registro DNS tipo A:
> ```
> mailing.postialo.com  →  IP_DE_TU_VPS
> ```
> Coolify obtendrá el certificado SSL automáticamente una vez que el DNS apunte correctamente.

### Paso 6: Habilitar WebSocket

PostIAlo usa WebSockets para actualizaciones en tiempo real. En la mayoría de versiones de Coolify esto funciona automáticamente. Si tienes problemas con WebSocket después del despliegue:

1. Ve a la configuración del recurso
2. Busca **"Custom Labels"** o **"Traefik Labels"**
3. Asegúrate de que existan estas labels (o agrégalas):

```yaml
traefik.http.middlewares.postialo-headers.headers.customrequestheaders.Connection: "upgrade"
traefik.http.middlewares.postialo-headers.headers.customrequestheaders.Upgrade: "websocket"
```

> **Nota**: En Coolify v4+ normalmente no necesitas hacer esto manualmente. Solo hazlo si los WebSockets no funcionan después del primer despliegue.

### Paso 7: NO hacer deploy todavía

Antes de desplegar necesitas configurar las variables de entorno (siguiente paso).

---

## 5. Configurar las variables de entorno

1. En la configuración de tu recurso PostIAlo en Coolify
2. Ve a la sección **"Environment Variables"**
3. Agrega **cada una** de estas variables:

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://postialo:PASSWORD@postialo-db:5432/postialo_mailing` | La URL del paso 3 |
| `SESSION_SECRET` | *(ver abajo cómo generar)* | Secreto para sesiones de login |
| `OPENAI_API_KEY` | `sk-tu-clave-openai` | Tu clave de OpenAI |
| `GEMINI_API_KEY` | `tu-clave-gemini` | Tu clave de Google Gemini |
| `PORT` | `5000` | Puerto interno de la app |
| `NODE_ENV` | `production` | Modo producción |

### Generar un SESSION_SECRET seguro:

Ejecuta esto en cualquier terminal:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copia el resultado y pégalo como valor de `SESSION_SECRET`.

> **Importante**: Marca las variables sensibles (`SESSION_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`) como **"Secret"** en Coolify si tiene esa opción. Esto evita que se muestren en texto plano en los logs.

---

## 6. Configurar el volumen para uploads/

La carpeta `uploads/` contiene logos de empresas e imágenes generadas para campañas. Si no configuras un volumen, estos archivos se perderán cada vez que se reconstruya el contenedor.

### En Coolify:

1. Ve a la configuración de tu recurso PostIAlo
2. Busca la sección **"Persistent Storage"** o **"Volumes"**
3. Agrega un nuevo volumen:
   - **Source / Name**: `postialo-uploads` (nombre del volumen en Docker)
   - **Destination / Mount Path**: `/app/uploads` (ruta dentro del contenedor)
4. Guarda los cambios

> Esto crea un espacio de almacenamiento que sobrevive a recreaciones del contenedor. Todo lo que la app guarde en `/app/uploads` persistirá entre despliegues.

---

## 7. Crear las tablas y cargar datos

### ¿Qué pasa automáticamente?

Al primer inicio, la aplicación ejecuta automáticamente:

1. **Seed** (`server/seed.ts`) — Crea los usuarios iniciales, campañas de demo, plantillas, etc.
2. **Migraciones** (`server/migrations.ts`) — Aplica ajustes de datos (asigna superadmin, etc.)

### Pero primero: necesitas crear las tablas

Las tablas de la base de datos no se crean solas. Tienes dos opciones:

### Opción A: Ejecutar SQL directo (recomendado)

Entra al contenedor de la base de datos y ejecuta el SQL de creación:

```bash
# Buscar el ID del contenedor de PostgreSQL
docker ps | grep postgres

# Entrar y ejecutar SQL
docker exec -it CONTAINER_ID psql -U postialo -d postialo_mailing
```

Dentro de psql, ejecuta el SQL completo de creación de tablas (está en el archivo `MANUAL_MIGRACION_VPS.md`, sección 8, Opción B). Copia y pega todo el bloque SQL que empieza con `CREATE TABLE IF NOT EXISTS users ...` y termina con los `GRANT`.

### Opción B: Usar Drizzle Kit desde tu máquina local

Si prefieres usar la herramienta automática de Drizzle, puedes ejecutarla **desde tu computadora** (no desde dentro del contenedor, porque el contenedor de producción no incluye herramientas de desarrollo):

```bash
# Desde tu PC o desde Replit, apuntando a la BD del VPS
# Primero, expón temporalmente el puerto de PostgreSQL en Coolify
# o usa un túnel SSH:
ssh -L 5432:localhost:5432 tu_usuario@IP_VPS

# En otra terminal, con el proyecto clonado localmente:
DATABASE_URL=postgresql://postialo:PASSWORD@localhost:5432/postialo_mailing npx drizzle-kit push
```

> **Nota**: Después de crear las tablas, cierra el túnel SSH. No dejes el puerto de PostgreSQL expuesto.

### Importar datos existentes desde Replit (opcional)

Si quieres migrar los datos que ya tienes en Replit:

**Paso 1 — En Replit, exportar:**

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges --format=custom --file=postialo_dump.backup
```

Descarga el archivo `postialo_dump.backup` desde Replit.

**Paso 2 — Subir al VPS:**

```bash
scp postialo_dump.backup tu_usuario@IP_VPS:/tmp/
```

**Paso 3 — Importar en el contenedor PostgreSQL:**

```bash
# Copiar el dump al contenedor de PostgreSQL
docker cp /tmp/postialo_dump.backup CONTAINER_ID_POSTGRES:/tmp/

# Restaurar dentro del contenedor
docker exec -it CONTAINER_ID_POSTGRES pg_restore \
  -U postialo -d postialo_mailing \
  --no-owner --no-privileges --clean --if-exists \
  /tmp/postialo_dump.backup
```

> **Si importas un dump, no necesitas crear las tablas (paso anterior) — el dump ya las incluye.**

---

## 8. Primer despliegue

### Hacer deploy:

1. En Coolify, ve a tu recurso PostIAlo
2. Haz clic en **"Deploy"**
3. Coolify va a:
   - Descargar el código desde GitHub
   - Construir la imagen Docker usando tu `Dockerfile`
   - Crear el contenedor y arrancarlo
   - Configurar el dominio y SSL automáticamente

### Verificar en los logs:

1. En Coolify, haz clic en **"Deployments"** → selecciona el despliegue actual
2. Revisa los **"Application Logs"** o **"Logs"**
3. Deberías ver algo como:

```
building client...
building server...
copied seed-data.json to dist/server/
[express] serving on port 5000
[seed] Production seed completed
[migrations] All migrations up to date.
```

### Verificar acceso web:

1. Abre `https://mailing.postialo.com` en tu navegador
2. Deberías ver la página de login de PostIAlo
3. Intenta iniciar sesión con `admin@postialo.com`

### Verificar todo funciona:

- [ ] La página carga correctamente
- [ ] Puedes iniciar sesión
- [ ] El dashboard muestra datos
- [ ] Las imágenes de campañas se ven (si ya migraste datos)
- [ ] Los logos de empresas se ven
- [ ] Puedes crear una nueva campaña de prueba

---

## 9. Migrar archivos existentes (uploads/)

Si tenías archivos en Replit (logos de empresas, imágenes de campañas), necesitas copiarlos al volumen del contenedor.

### Paso 1: Descargar de Replit

En la shell de Replit:

```bash
tar czf uploads.tar.gz uploads/
```

Descarga `uploads.tar.gz` desde el panel de archivos de Replit.

### Paso 2: Subir al VPS

```bash
scp uploads.tar.gz tu_usuario@IP_VPS:/tmp/
```

### Paso 3: Copiar al contenedor

```bash
# En el VPS, descomprimir
cd /tmp && tar xzf uploads.tar.gz

# Buscar el ID del contenedor de PostIAlo
docker ps | grep postialo

# Copiar los archivos al contenedor
docker cp /tmp/uploads/logos/. CONTAINER_ID:/app/uploads/logos/
docker cp /tmp/uploads/campaigns/. CONTAINER_ID:/app/uploads/campaigns/

# Verificar que se copiaron
docker exec CONTAINER_ID ls -la /app/uploads/logos/
docker exec CONTAINER_ID ls -la /app/uploads/campaigns/
```

> Los archivos ahora están en el volumen persistente. Sobrevivirán a futuros despliegues.

---

## 10. Actualizaciones futuras

### Despliegue automático (recomendado):

Configura Coolify para que despliegue automáticamente cuando hagas push a GitHub:

1. En Coolify, ve a la configuración de tu recurso PostIAlo
2. Busca **"Webhooks"** o **"Auto Deploy"**
3. Activa la opción **"Auto Deploy"** o **"Deploy on Push"**
4. Coolify te dará una **URL de webhook**
5. Ve a tu repositorio en GitHub → **Settings** → **Webhooks**
6. Agrega un nuevo webhook con la URL que te dio Coolify
7. Selecciona **"Just the push event"**

Ahora, cada vez que hagas `git push` desde Replit o tu editor:

```
Push a GitHub → GitHub avisa a Coolify → Coolify reconstruye → App actualizada
```

### Despliegue manual:

Si prefieres control manual:

1. Ve a Coolify → tu recurso PostIAlo
2. Haz clic en **"Deploy"** (o **"Redeploy"**)

### ¿Qué pasa con mis datos?

- **Base de datos**: No se toca. Los datos se mantienen intactos.
- **Uploads (logos, imágenes)**: Se mantienen en el volumen persistente.
- **Solo se reconstruye el código**: El nuevo deploy solo actualiza la app, no los datos.

---

## 11. Respaldos

### Respaldar la base de datos:

```bash
# Buscar el ID del contenedor de PostgreSQL
docker ps | grep postgres

# Crear un respaldo
docker exec CONTAINER_ID_POSTGRES pg_dump \
  -U postialo -Fc postialo_mailing \
  > /home/tu_usuario/backups/postialo_$(date +%Y%m%d_%H%M).backup
```

### Respaldo automático diario:

Crea un script en el VPS:

```bash
nano /home/tu_usuario/backup-postialo.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/tu_usuario/backups"
DATE=$(date +%Y-%m-%d_%H%M)
CONTAINER=$(docker ps -qf "ancestor=postgres:16-alpine" --filter "name=postialo")

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U postialo -Fc postialo_mailing \
  > "$BACKUP_DIR/postialo_${DATE}.backup"

if [ $? -eq 0 ]; then
    echo "[$(date)] Respaldo exitoso: postialo_${DATE}.backup"
else
    echo "[$(date)] ERROR en respaldo" >&2
fi

find "$BACKUP_DIR" -name "*.backup" -mtime +14 -delete
```

```bash
chmod +x /home/tu_usuario/backup-postialo.sh
crontab -e
# Agregar esta línea (respaldo diario a las 3 AM):
0 3 * * * /home/tu_usuario/backup-postialo.sh >> /home/tu_usuario/backups/backup.log 2>&1
```

### Respaldar uploads/:

```bash
# Buscar el contenedor de la app
CONTAINER=$(docker ps -qf "name=postialo" --filter "ancestor!=postgres")

# Copiar uploads del contenedor al VPS
docker cp $CONTAINER:/app/uploads /home/tu_usuario/backups/uploads_$(date +%Y%m%d)
```

### Restaurar un respaldo:

```bash
# Copiar el backup al contenedor de PostgreSQL
docker cp /ruta/al/backup.backup CONTAINER_ID_POSTGRES:/tmp/

# Restaurar
docker exec CONTAINER_ID_POSTGRES pg_restore \
  -U postialo -d postialo_mailing \
  --clean --if-exists /tmp/backup.backup
```

---

## 12. Solución de problemas

### La app no arranca

**Revisar logs en Coolify:**
1. Ve a tu recurso → **"Logs"** o **"Application Logs"**
2. Busca mensajes de error

**Errores comunes:**

| Error | Causa | Solución |
|---|---|---|
| `ECONNREFUSED ...5432` | No puede conectar a PostgreSQL | Verificar que `postialo-db` está corriendo. Verificar `DATABASE_URL`. |
| `relation "users" does not exist` | Las tablas no se crearon | Ejecutar `npx drizzle-kit push` dentro del contenedor (paso 7). |
| `SESSION_SECRET must be set` | Falta variable de entorno | Agregar `SESSION_SECRET` en las variables de entorno de Coolify. |
| `Cannot find module` | Build falló | Revisar los logs de build en Coolify. |

### WebSockets no funcionan

Síntoma: la app carga pero no se actualizan los datos en tiempo real.

1. Abre la consola del navegador (F12 → Console)
2. Si ves errores de WebSocket (`ws://` o `wss://`):
   - En Coolify, ve a la configuración del recurso
   - Busca los custom labels de Traefik
   - Asegúrate de que el proxy soporte conexiones WebSocket (upgrade headers)
3. En versiones recientes de Coolify (v4+), esto debería funcionar sin configuración adicional

### Las imágenes no cargan

1. Verificar que el volumen está montado:

```bash
docker exec CONTAINER_ID ls -la /app/uploads/logos/
docker exec CONTAINER_ID ls -la /app/uploads/campaigns/
```

2. Si las carpetas están vacías, los archivos no se migraron (ver paso 9)

3. Si las carpetas tienen archivos pero no cargan en el navegador, verificar permisos:

```bash
docker exec CONTAINER_ID chmod -R 755 /app/uploads/
```

### Error de conexión entre contenedores

Si la app no puede conectar con PostgreSQL:

1. Verificar que ambos contenedores están en la misma red:

```bash
docker network ls
docker network inspect NOMBRE_RED
```

2. Verificar que el nombre del host en `DATABASE_URL` coincide con el nombre del contenedor de PostgreSQL en Coolify

3. Probar conexión desde el contenedor de la app:

```bash
docker exec -it CONTAINER_ID_APP sh
# Dentro del contenedor:
wget -qO- http://postialo-db:5432 || echo "Puerto accesible"
```

### Cómo entrar al contenedor para debug:

```bash
# Buscar contenedores
docker ps | grep postialo

# Entrar al contenedor de la app
docker exec -it CONTAINER_ID sh

# Dentro puedes:
ls -la /app/              # Ver archivos
ls -la /app/uploads/      # Ver uploads
cat /app/.env             # No existe (las vars vienen de Coolify)
env | grep DATABASE       # Ver variables de entorno
node -e "console.log('OK')"  # Verificar Node.js

# Salir
exit
```

### Forzar reconstrucción limpia:

Si algo no funciona después de un update:

1. En Coolify → tu recurso PostIAlo
2. Haz clic en **"Restart"** (reinicia sin reconstruir)
3. Si eso no funciona, haz clic en **"Redeploy"** (reconstruye desde cero)

---

## Resumen rápido

| Qué | Dónde/Cómo |
|---|---|
| **Dominio** | `mailing.postialo.com` → DNS tipo A → IP del VPS |
| **SSL** | Automático por Coolify (Let's Encrypt) |
| **Reverse Proxy** | Automático por Coolify (Traefik) |
| **App Node.js** | Contenedor Docker, puerto 5000 |
| **PostgreSQL** | Contenedor Docker separado, puerto 5432 interno |
| **Uploads** | Volumen Docker persistente en `/app/uploads` |
| **Variables** | Panel de Coolify → Environment Variables |
| **Updates** | Push a GitHub → Coolify reconstruye automáticamente |
| **Logs** | Panel de Coolify → Application Logs |
| **Backups** | Script cron en el VPS (diario, 14 días retención) |
