# PostIAlo Mailing — Manual de Migración a VPS Ubuntu

## Índice

1. [Requisitos del servidor](#1-requisitos-del-servidor)
2. [Instalación de Node.js con NVM](#2-instalación-de-nodejs-con-nvm)
3. [Instalación de PostgreSQL 16](#3-instalación-de-postgresql-16)
4. [Configuración de la base de datos](#4-configuración-de-la-base-de-datos)
5. [Clonar el repositorio](#5-clonar-el-repositorio)
6. [Variables de entorno (.env)](#6-variables-de-entorno-env)
7. [Instalar dependencias y compilar](#7-instalar-dependencias-y-compilar)
8. [Crear las tablas (esquema de base de datos)](#8-crear-las-tablas-esquema-de-base-de-datos)
9. [Exportar datos desde Replit (dump)](#9-exportar-datos-desde-replit-dump)
10. [Importar datos en el VPS (restore)](#10-importar-datos-en-el-vps-restore)
11. [Migrar archivos subidos (uploads/)](#11-migrar-archivos-subidos-uploads)
12. [Ejecutar la aplicación con PM2](#12-ejecutar-la-aplicación-con-pm2)
13. [Nginx como reverse proxy (opcional)](#13-nginx-como-reverse-proxy-opcional)
14. [Checklist de verificación](#14-checklist-de-verificación)
15. [Actualizaciones futuras desde GitHub](#15-actualizaciones-futuras-desde-github)
16. [Solución de problemas](#16-solución-de-problemas)

---

## 1. Requisitos del servidor

| Componente   | Versión requerida |
|-------------|-------------------|
| Ubuntu      | 22.04 LTS o 24.04 LTS |
| Node.js     | v20.20.0 (LTS)    |
| npm         | 10.8.2            |
| PostgreSQL  | 16.x              |
| RAM mínima  | 2 GB              |
| Disco       | 20 GB mínimo      |

---

## 2. Instalación de Node.js con NVM

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y curl git build-essential

# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Cargar NVM en la sesión actual
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instalar Node.js v20.20.0
nvm install 20.20.0
nvm use 20.20.0
nvm alias default 20.20.0

# Verificar versiones
node -v   # Debe mostrar: v20.20.0
npm -v    # Debe mostrar: 10.8.2
```

---

## 3. Instalación de PostgreSQL 16

```bash
# Agregar repositorio oficial de PostgreSQL
sudo apt install -y gnupg2
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
sudo apt update

# Instalar PostgreSQL 16
sudo apt install -y postgresql-16

# Verificar que está corriendo
sudo systemctl status postgresql
sudo systemctl enable postgresql

# Verificar versión
psql --version   # Debe mostrar: psql (PostgreSQL) 16.x
```

---

## 4. Configuración de la base de datos

```bash
# Entrar como usuario postgres
sudo -u postgres psql

# Dentro de psql, ejecutar:
CREATE USER postialo WITH PASSWORD 'TU_PASSWORD_SEGURO_AQUI';
CREATE DATABASE postialo_mailing OWNER postialo;
GRANT ALL PRIVILEGES ON DATABASE postialo_mailing TO postialo;
\q
```

> **Nota**: Reemplaza `TU_PASSWORD_SEGURO_AQUI` con una contraseña fuerte. La necesitarás para el `DATABASE_URL`.

La URL de conexión resultante será:
```
postgresql://postialo:TU_PASSWORD_SEGURO_AQUI@localhost:5432/postialo_mailing
```

---

## 5. Clonar el repositorio

```bash
# Clonar desde GitHub
cd /home/tu_usuario
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git postialo-mailing
cd postialo-mailing
```

---

## 6. Variables de entorno (.env)

Crear el archivo `.env` en la raíz del proyecto:

```bash
nano .env
```

Contenido del archivo:

```env
# ============================================
# PostIAlo Mailing — Variables de entorno
# ============================================

# Base de datos PostgreSQL
DATABASE_URL=postgresql://postialo:TU_PASSWORD_SEGURO_AQUI@localhost:5432/postialo_mailing

# Secreto para sesiones Express (genera uno aleatorio)
# Puedes generar uno con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=TU_SESSION_SECRET_AQUI

# API Keys para IA
OPENAI_API_KEY=sk-tu-clave-openai-aqui
GEMINI_API_KEY=tu-clave-gemini-aqui

# Puerto del servidor (por defecto 5000)
PORT=5000

# Entorno
NODE_ENV=production
```

> **Generar un SESSION_SECRET seguro:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## 7. Instalar dependencias y compilar

```bash
cd /home/tu_usuario/postialo-mailing

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
npm install

# Compilar el proyecto (genera dist/)
npm run build
```

Después de compilar, la estructura de `dist/` será:

```
dist/
├── index.cjs          ← Servidor Node.js compilado
├── public/            ← Frontend compilado (HTML, CSS, JS)
│   ├── index.html
│   └── assets/
└── server/
    └── seed-data.json ← Datos semilla para primer inicio
```

---

## 8. Crear las tablas (esquema de base de datos)

Tienes dos opciones para crear la estructura de tablas:

### Opción A: Usar Drizzle Kit (recomendado)

```bash
# Asegúrate de que DATABASE_URL esté configurado
export DATABASE_URL=postgresql://postialo:TU_PASSWORD_SEGURO_AQUI@localhost:5432/postialo_mailing

# Crear las tablas con drizzle-kit push
npx drizzle-kit push
```

Drizzle Kit te mostrará los cambios que va a aplicar. Confirma con `Yes` cuando te lo pida.

### Opción B: SQL directo (si drizzle-kit no funciona)

Ejecuta este script SQL directamente en PostgreSQL:

```bash
sudo -u postgres psql postialo_mailing
```

```sql
-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  company TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de campañas
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  idea TEXT NOT NULL,
  objective TEXT NOT NULL,
  tone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  layout_preference TEXT NOT NULL DEFAULT 'Hero_Centered',
  image_prompt TEXT,
  target_database TEXT,
  selected_image_url TEXT,
  target_audience TEXT,
  template_id INTEGER,
  scheduled_at TIMESTAMP,
  total_expected_sends INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  image_regen_count INTEGER DEFAULT 0,
  text_regen_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de versiones de campañas
CREATE TABLE IF NOT EXISTS campaign_versions (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  content_json JSONB NOT NULL,
  image_url TEXT,
  is_selected BOOLEAN DEFAULT false,
  type TEXT NOT NULL DEFAULT 'initial',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de bases de datos de contactos
CREATE TABLE IF NOT EXISTS contact_databases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de contactos
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  database_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  position TEXT,
  segment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de identidad de marca
CREATE TABLE IF NOT EXISTS brand_identity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  company_name TEXT,
  industry TEXT,
  website TEXT,
  whatsapp TEXT,
  mission TEXT,
  vision TEXT,
  products TEXT,
  history TEXT,
  style_guide TEXT,
  target_audience TEXT,
  tone TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  heading_font TEXT,
  body_font TEXT,
  logo_url TEXT,
  visual_style TEXT DEFAULT 'moderno',
  sender_name TEXT,
  sender_email TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de plantillas
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  html TEXT NOT NULL,
  favorite BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  ai_edit_count INTEGER DEFAULT 0,
  original_html TEXT,
  has_all_placeholders BOOLEAN DEFAULT false,
  is_confirmed BOOLEAN DEFAULT true,
  parent_template_id INTEGER,
  version_number INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de envíos de campañas
CREATE TABLE IF NOT EXISTS campaign_sends (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de sesiones (creada automáticamente por connect-pg-simple)
-- No necesitas crearla manualmente; se crea al primer inicio.

-- Tabla de migraciones (creada automáticamente al primer inicio)
-- No necesitas crearla manualmente.

-- Dar permisos al usuario postialo
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postialo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postialo;
```

---

## 9. Exportar datos desde Replit (dump)

Desde la **Shell de Replit**, ejecuta este comando para exportar todos los datos:

```bash
# Exportar TODOS los datos (estructura + datos)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file=postialo_dump.backup

# Verificar que se creó el archivo
ls -lh postialo_dump.backup
```

Si solo quieres exportar los **datos** (sin estructura, porque ya la creaste en el paso 8):

```bash
# Solo datos, sin estructura
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --data-only \
  --format=custom \
  --file=postialo_data_only.backup
```

### Descargar el dump

Después de generar el archivo, descárgalo desde Replit:
1. En el panel de archivos de Replit, haz clic derecho sobre `postialo_dump.backup`
2. Selecciona **"Download"**
3. Súbelo al VPS con `scp`:

```bash
# Desde tu máquina local
scp postialo_dump.backup tu_usuario@IP_DEL_VPS:/home/tu_usuario/postialo-mailing/
```

---

## 10. Importar datos en el VPS (restore)

### Si exportaste estructura + datos (dump completo):

```bash
cd /home/tu_usuario/postialo-mailing

# Restaurar en la base de datos del VPS
pg_restore \
  --dbname=postgresql://postialo:TU_PASSWORD_SEGURO_AQUI@localhost:5432/postialo_mailing \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  postialo_dump.backup
```

### Si exportaste solo datos:

```bash
# Primero crea las tablas (paso 8), luego restaura los datos
pg_restore \
  --dbname=postgresql://postialo:TU_PASSWORD_SEGURO_AQUI@localhost:5432/postialo_mailing \
  --no-owner \
  --no-privileges \
  --data-only \
  postialo_data_only.backup
```

### Verificar la importación:

```bash
sudo -u postgres psql postialo_mailing -c "
  SELECT 'users' AS tabla, COUNT(*) FROM users
  UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
  UNION ALL SELECT 'templates', COUNT(*) FROM templates
  UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
  UNION ALL SELECT 'contact_databases', COUNT(*) FROM contact_databases
  UNION ALL SELECT 'brand_identity', COUNT(*) FROM brand_identity
  UNION ALL SELECT 'campaign_versions', COUNT(*) FROM campaign_versions
  UNION ALL SELECT 'campaign_sends', COUNT(*) FROM campaign_sends;
"
```

---

## 11. Migrar archivos subidos (uploads/)

La carpeta `uploads/` contiene logos e imágenes de campañas (~14 MB). Debes copiarla manualmente.

### Desde Replit:

1. Descarga la carpeta `uploads/` completa desde el panel de archivos de Replit
2. O comprímela y descárgala:

```bash
# En la Shell de Replit
tar czf uploads.tar.gz uploads/
# Luego descarga uploads.tar.gz desde el panel de archivos
```

### En el VPS:

```bash
cd /home/tu_usuario/postialo-mailing

# Subir y descomprimir
scp uploads.tar.gz tu_usuario@IP_DEL_VPS:/home/tu_usuario/postialo-mailing/
tar xzf uploads.tar.gz

# Verificar estructura
ls -la uploads/logos/
ls -la uploads/campaigns/
```

La estructura esperada es:

```
uploads/
├── logos/
│   └── 2_04940ef72324be40.jpg
└── campaigns/
    ├── campaign_22_64bbcd1fa2d3ebc9e324590c.png
    ├── campaign_22_f76cf0c8ff35cc82690d8420.png
    ├── campaign_23_5c8895b76eef57b48223ccc7.png
    ├── campaign_23_826d9a72781feee120dc508c.png
    ├── campaign_27_0e6476f2c836d91214888020.png
    └── campaign_27_f03d28fd9d188f99c8f457ee.png
```

---

## 12. Ejecutar la aplicación con PM2

### Instalar PM2 globalmente:

```bash
npm install -g pm2
```

### Iniciar la aplicación:

```bash
cd /home/tu_usuario/postialo-mailing

# Iniciar con PM2
pm2 start dist/index.cjs --name postialo-mailing \
  --node-args="--max-old-space-size=1024"

# Ver logs en tiempo real
pm2 logs postialo-mailing

# Guardar la configuración para auto-inicio
pm2 save
pm2 startup
# PM2 te dará un comando con sudo — ejecútalo
```

### Comandos útiles de PM2:

```bash
pm2 status                    # Ver estado de procesos
pm2 logs postialo-mailing     # Ver logs en tiempo real
pm2 restart postialo-mailing  # Reiniciar
pm2 stop postialo-mailing     # Detener
pm2 delete postialo-mailing   # Eliminar proceso
pm2 monit                     # Monitor interactivo
```

### Archivo de ecosistema PM2 (opcional):

Crea `ecosystem.config.cjs` en la raíz del proyecto:

```javascript
module.exports = {
  apps: [{
    name: "postialo-mailing",
    script: "dist/index.cjs",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    },
    max_memory_restart: "1G",
    instances: 1,
    autorestart: true,
    watch: false,
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    merge_logs: true,
    time: true
  }]
};
```

Luego inicia con:

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
```

---

## 13. Nginx como reverse proxy (opcional)

Si quieres exponer la aplicación en el puerto 80/443 con un dominio:

```bash
sudo apt install -y nginx

# Crear configuración del sitio
sudo nano /etc/nginx/sites-available/postialo
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/postialo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# (Opcional) SSL con Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## 14. Checklist de verificación

Ejecuta cada paso después de completar la instalación:

- [ ] Node.js v20.20.0 instalado: `node -v`
- [ ] PostgreSQL 16 corriendo: `sudo systemctl status postgresql`
- [ ] Base de datos `postialo_mailing` creada
- [ ] Archivo `.env` configurado con todas las variables
- [ ] `npm install` completado sin errores
- [ ] `npm run build` completado, carpeta `dist/` existe
- [ ] Tablas creadas en PostgreSQL (8 tablas de la app)
- [ ] Datos importados correctamente (verificar conteos)
- [ ] Carpeta `uploads/` copiada con logos y campañas
- [ ] Aplicación inicia con PM2 sin errores: `pm2 logs postialo-mailing`
- [ ] Acceso web funciona en `http://IP_DEL_VPS:5000`
- [ ] Login con `admin@postialo.com` funciona
- [ ] Las imágenes (logos, campañas) se cargan correctamente
- [ ] Nginx configurado (si aplica)
- [ ] SSL configurado (si aplica)
- [ ] `pm2 startup` ejecutado para auto-inicio

---

## 15. Actualizaciones futuras desde GitHub

Flujo de trabajo para desplegar nuevos cambios:

```bash
cd /home/tu_usuario/postialo-mailing

# 1. Obtener últimos cambios
git pull origin main

# 2. Instalar nuevas dependencias (si las hay)
npm install

# 3. Recompilar
npm run build

# 4. Aplicar cambios de esquema (si los hay)
export DATABASE_URL=postgresql://postialo:TU_PASSWORD_SEGURO_AQUI@localhost:5432/postialo_mailing
npx drizzle-kit push

# 5. Reiniciar la aplicación
pm2 restart postialo-mailing
```

> **Nota**: Las migraciones de datos (`server/migrations.ts`) se ejecutan automáticamente al iniciar la aplicación. Solo necesitas reiniciar.

---

## 16. Solución de problemas

### Error: "ECONNREFUSED" al conectar a PostgreSQL

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar que acepta conexiones locales
sudo -u postgres psql -c "SELECT 1;"

# Revisar pg_hba.conf si hay problemas de autenticación
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Asegúrate de tener esta línea:
# local   all   postialo   md5
# O para conexiones TCP:
# host    all   postialo   127.0.0.1/32   md5

sudo systemctl restart postgresql
```

### Error: "relation does not exist"

Las tablas no se crearon. Ejecuta el paso 8 (crear tablas).

### Las imágenes no se cargan

Verifica que la carpeta `uploads/` esté en la raíz del proyecto (junto a `dist/`):

```bash
ls -la /home/tu_usuario/postialo-mailing/uploads/
```

### Error de memoria

Si la aplicación se queda sin memoria:

```bash
pm2 delete postialo-mailing
pm2 start dist/index.cjs --name postialo-mailing \
  --node-args="--max-old-space-size=2048"
```

### Logs de la aplicación

```bash
# Ver logs de PM2
pm2 logs postialo-mailing --lines 100

# Ver solo errores
pm2 logs postialo-mailing --err --lines 50
```

### Regenerar el build después de cambios

```bash
npm run build && pm2 restart postialo-mailing
```

---

## Resumen de puertos

| Servicio     | Puerto | Notas                          |
|-------------|--------|--------------------------------|
| PostgreSQL  | 5432   | Solo acceso local              |
| PostIAlo    | 5000   | Servidor Node.js               |
| Nginx       | 80/443 | Reverse proxy (opcional)       |

---

## Estructura del proyecto compilado

```
postialo-mailing/
├── .env                    ← Variables de entorno
├── dist/
│   ├── index.cjs           ← Servidor compilado
│   ├── public/             ← Frontend compilado
│   └── server/
│       └── seed-data.json  ← Datos semilla
├── uploads/
│   ├── logos/              ← Logos de marcas
│   └── campaigns/          ← Imágenes de campañas
├── node_modules/           ← Dependencias
├── ecosystem.config.cjs    ← Config PM2 (opcional)
└── logs/                   ← Logs de PM2 (opcional)
```
