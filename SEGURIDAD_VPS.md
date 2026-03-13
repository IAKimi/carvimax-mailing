# PostIAlo Mailing — Seguridad y Configuración de Producción VPS

> **Documento complementario a** `MANUAL_MIGRACION_VPS.md`
> Sigue estas instrucciones **después** de haber completado la instalación base.

---

## Índice

1. [Crear usuario dedicado (no usar root)](#1-crear-usuario-dedicado-no-usar-root)
2. [Configuración de Nginx como Reverse Proxy](#2-configuración-de-nginx-como-reverse-proxy)
3. [Certificado SSL con Let's Encrypt](#3-certificado-ssl-con-lets-encrypt)
4. [Configuración Nginx con SSL (versión final)](#4-configuración-nginx-con-ssl-versión-final)
5. [UFW — Firewall](#5-ufw--firewall)
6. [PM2 — Gestión de procesos](#6-pm2--gestión-de-procesos)
7. [Respaldos automáticos de base de datos](#7-respaldos-automáticos-de-base-de-datos)
8. [Hardening SSH](#8-hardening-ssh)
9. [Fail2Ban — Protección contra fuerza bruta](#9-fail2ban--protección-contra-fuerza-bruta)
10. [Actualizaciones automáticas de seguridad](#10-actualizaciones-automáticas-de-seguridad)
11. [Permisos de archivos](#11-permisos-de-archivos)
12. [Seguridad de PostgreSQL](#12-seguridad-de-postgresql)
13. [Monitoreo básico](#13-monitoreo-básico)
14. [Checklist final de seguridad](#14-checklist-final-de-seguridad)

---

## 1. Crear usuario dedicado (no usar root)

Nunca ejecutes la aplicación como root. Crea un usuario dedicado:

```bash
# Crear usuario para la aplicación
sudo adduser postialo
# (Te pedirá contraseña — usa una segura)

# Darle permisos sudo (solo para administración, no para la app)
sudo usermod -aG sudo postialo

# Cambiar al nuevo usuario
su - postialo

# Desde aquí, toda la instalación de la app se hace como este usuario
cd /home/postialo
```

Asegúrate de que el proyecto esté en `/home/postialo/postialo-mailing/` y que todo pertenezca a este usuario:

```bash
sudo chown -R postialo:postialo /home/postialo/postialo-mailing
```

---

## 2. Configuración de Nginx como Reverse Proxy

La aplicación corre en **puerto 5000**. Nginx recibe las peticiones en el puerto 80/443 y las redirige internamente.

### Instalar Nginx:

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### Crear configuración del sitio (sin SSL, paso inicial):

```bash
sudo nano /etc/nginx/sites-available/postialo
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # ─── Límite de tamaño de body (25MB para uploads de imágenes) ───
    client_max_body_size 25M;

    # ─── Headers de seguridad ───
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # ─── Ocultar versión de Nginx ───
    server_tokens off;

    # ─── Proxy principal hacia Node.js (puerto 5000) ───
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSocket support (requerido por PostIAlo)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers estándar de proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts generosos para operaciones de IA
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # ─── Caché para archivos estáticos (CSS, JS, imágenes del build) ───
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ─── Rate limiting para login y API de IA ───
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ai/ {
        limit_req zone=ai burst=3 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # ─── Bloquear acceso a archivos sensibles ───
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~* (\.env|\.git|\.json$) {
        deny all;
        return 404;
    }
}
```

### Configurar las zonas de rate limiting:

```bash
sudo nano /etc/nginx/nginx.conf
```

Dentro del bloque `http { }`, agrega estas líneas (antes de los `include`):

```nginx
    # Rate limiting zones para PostIAlo
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=ai:10m rate=10r/m;
```

### Activar el sitio:

```bash
# Eliminar el sitio por defecto
sudo rm -f /etc/nginx/sites-enabled/default

# Activar PostIAlo
sudo ln -sf /etc/nginx/sites-available/postialo /etc/nginx/sites-enabled/

# Verificar la configuración
sudo nginx -t

# Si dice "syntax is ok", reiniciar
sudo systemctl restart nginx
```

---

## 3. Certificado SSL con Let's Encrypt

### Requisitos previos:

- Tu dominio debe apuntar a la IP del VPS (registro DNS tipo A)
- El puerto 80 debe estar abierto (lo configuramos en UFW)
- Nginx debe estar corriendo

### Instalar Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtener el certificado:

```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

Certbot te pedirá:
1. Tu email (para avisos de expiración)
2. Aceptar términos de servicio
3. Si quieres redirigir HTTP a HTTPS — **di que sí**

### Verificar renovación automática:

Certbot configura un timer automático. Verifica que funciona:

```bash
# Ver el timer de renovación
sudo systemctl status certbot.timer

# Probar renovación (sin aplicarla realmente)
sudo certbot renew --dry-run
```

> Los certificados se renuevan automáticamente cada 60-90 días. No necesitas hacer nada más.

---

## 4. Configuración Nginx con SSL (versión final)

Después de instalar Certbot, reemplaza la configuración de Nginx con esta versión completa que incluye SSL y todas las protecciones:

```bash
sudo nano /etc/nginx/sites-available/postialo
```

```nginx
# ─── Redirigir HTTP a HTTPS ───
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

# ─── Servidor principal HTTPS ───
server {
    listen 443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    # ─── Certificados SSL (Let's Encrypt) ───
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ─── Configuración SSL avanzada ───
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ─── HSTS (fuerza HTTPS por 1 año) ───
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ─── Headers de seguridad ───
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # ─── Ocultar versión de Nginx ───
    server_tokens off;

    # ─── Límite de body (25MB para uploads) ───
    client_max_body_size 25M;

    # ─── Proxy principal hacia Node.js ───
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers de proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts para operaciones de IA (generación puede tardar)
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # ─── Caché para estáticos ───
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ─── Rate limiting para autenticación ───
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ─── Rate limiting para IA ───
    location /api/ai/ {
        limit_req zone=ai burst=3 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # ─── Bloquear archivos sensibles ───
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~* (\.env|\.git|\.json$) {
        deny all;
        return 404;
    }
}
```

```bash
# Verificar y reiniciar
sudo nginx -t && sudo systemctl restart nginx
```

---

## 5. UFW — Firewall

### Configurar UFW:

```bash
# Configuración por defecto: bloquear todo lo entrante
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (puerto 22) — SIEMPRE antes de activar UFW
sudo ufw allow 22/tcp comment 'SSH'

# Permitir HTTP (puerto 80) — para Nginx y renovación de certificados
sudo ufw allow 80/tcp comment 'HTTP'

# Permitir HTTPS (puerto 443) — para Nginx con SSL
sudo ufw allow 443/tcp comment 'HTTPS'

# Activar el firewall
sudo ufw enable
# Te preguntará si estás seguro — responde 'y'

# Verificar las reglas
sudo ufw status verbose
```

### Resultado esperado:

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere       # SSH
80/tcp                     ALLOW IN    Anywhere       # HTTP
443/tcp                    ALLOW IN    Anywhere       # HTTPS
```

> **Importante**: El puerto 5000 (Node.js) y el 5432 (PostgreSQL) **no** están en la lista. Esto es correcto — solo son accesibles internamente. Nginx se encarga de redirigir el tráfico externo al puerto 5000.

### Si te bloqueas accidentalmente:

Si pierdes acceso SSH, la mayoría de proveedores VPS ofrecen una consola de emergencia (VNC/KVM) desde su panel web. Desde ahí puedes ejecutar `sudo ufw disable`.

---

## 6. PM2 — Gestión de procesos

### Instalar PM2:

```bash
# Como el usuario postialo
npm install -g pm2
```

### Crear archivo de ecosistema:

```bash
nano /home/postialo/postialo-mailing/ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [{
    name: "postialo-mailing",
    script: "dist/index.cjs",
    cwd: "/home/postialo/postialo-mailing",
    node_args: "--max-old-space-size=1024",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: "10s",
    error_file: "/home/postialo/postialo-mailing/logs/error.log",
    out_file: "/home/postialo/postialo-mailing/logs/output.log",
    merge_logs: true,
    time: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
  }]
};
```

### Iniciar la aplicación:

```bash
cd /home/postialo/postialo-mailing
mkdir -p logs

# Iniciar con el archivo de ecosistema
pm2 start ecosystem.config.cjs

# Verificar que está corriendo
pm2 status
pm2 logs postialo-mailing --lines 30
```

### Configurar auto-inicio en reboot:

```bash
# Generar el script de startup
pm2 startup

# PM2 te dará un comando con sudo — CÓPIALO Y EJECÚTALO
# Se verá algo como:
# sudo env PATH=$PATH:/home/postialo/.nvm/versions/node/v20.20.0/bin pm2 startup systemd -u postialo --hp /home/postialo

# Después de ejecutar ese comando, guardar la configuración
pm2 save
```

> Ahora si el servidor se reinicia, PM2 levantará la app automáticamente.

### Configurar rotación de logs:

Sin rotación, los logs crecen hasta llenar el disco.

```bash
pm2 install pm2-logrotate

# Configurar: máximo 10MB por archivo, mantener 7 archivos, comprimir
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### Comandos útiles:

```bash
pm2 status                        # Estado general
pm2 logs postialo-mailing         # Logs en tiempo real
pm2 restart postialo-mailing      # Reiniciar
pm2 reload postialo-mailing       # Reinicio sin downtime (graceful)
pm2 monit                         # Monitor interactivo (CPU, RAM)
pm2 describe postialo-mailing     # Info detallada del proceso
```

---

## 7. Respaldos automáticos de base de datos

### Crear script de respaldo:

```bash
sudo mkdir -p /home/postialo/backups
sudo chown postialo:postialo /home/postialo/backups

nano /home/postialo/backup-db.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/home/postialo/backups"
DB_NAME="postialo_mailing"
DB_USER="postialo"
DATE=$(date +%Y-%m-%d_%H%M)
RETENTION_DAYS=14

pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$BACKUP_DIR/${DB_NAME}_${DATE}.backup"

if [ $? -eq 0 ]; then
    echo "[$(date)] Respaldo exitoso: ${DB_NAME}_${DATE}.backup"
else
    echo "[$(date)] ERROR: Fallo el respaldo de la base de datos" >&2
    exit 1
fi

find "$BACKUP_DIR" -name "*.backup" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Limpieza: eliminados respaldos mayores a ${RETENTION_DAYS} días"
```

```bash
chmod +x /home/postialo/backup-db.sh
```

### Configurar ejecución automática diaria:

```bash
crontab -e
```

Agrega esta línea (respaldo diario a las 3:00 AM):

```
0 3 * * * /home/postialo/backup-db.sh >> /home/postialo/backups/backup.log 2>&1
```

### Verificar que funciona:

```bash
# Ejecutar manualmente para probar
./backup-db.sh

# Verificar que se creó el archivo
ls -la /home/postialo/backups/
```

### Restaurar un respaldo (si lo necesitas):

```bash
pg_restore -U postialo -d postialo_mailing --clean --if-exists /home/postialo/backups/postialo_mailing_FECHA.backup
```

---

## 8. Hardening SSH

### 8.1 — Configurar autenticación por clave SSH

Desde tu **computadora local** (no el VPS):

```bash
# Generar par de claves si no tienes uno
ssh-keygen -t ed25519 -C "tu-email@ejemplo.com"

# Copiar la clave pública al VPS
ssh-copy-id postialo@IP_DEL_VPS
```

Verifica que puedes conectarte sin contraseña:

```bash
ssh postialo@IP_DEL_VPS
# Debe entrar sin pedir contraseña
```

### 8.2 — Endurecer la configuración SSH

**Solo después de verificar que la clave funciona**:

```bash
sudo nano /etc/ssh/sshd_config
```

Busca y cambia estas líneas:

```
# Deshabilitar login como root
PermitRootLogin no

# Deshabilitar autenticación por contraseña
PasswordAuthentication no

# Deshabilitar contraseñas vacías
PermitEmptyPasswords no

# Solo protocolo 2
Protocol 2

# Timeout de inactividad (5 minutos)
ClientAliveInterval 300
ClientAliveCountMax 2

# Máximo intentos de autenticación
MaxAuthTries 3

# Solo permitir al usuario postialo
AllowUsers postialo
```

```bash
# Verificar sintaxis
sudo sshd -t

# Reiniciar SSH
sudo systemctl restart sshd
```

> **Advertencia**: Si configuras mal SSH y cierras la sesión, podrías perder acceso. Mantén una sesión abierta mientras pruebas los cambios, y asegúrate de que tu proveedor VPS tiene consola de emergencia.

---

## 9. Fail2Ban — Protección contra fuerza bruta

Fail2Ban bloquea IPs que intentan acceder repetidamente con credenciales incorrectas.

### Instalar:

```bash
sudo apt install -y fail2ban
```

### Configurar:

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 120
bantime = 600
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verificar estado
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### Comandos útiles:

```bash
# Ver IPs bloqueadas
sudo fail2ban-client status sshd

# Desbloquear una IP
sudo fail2ban-client set sshd unbanip 1.2.3.4
```

---

## 10. Actualizaciones automáticas de seguridad

Ubuntu puede aplicar parches de seguridad automáticamente sin intervención:

```bash
sudo apt install -y unattended-upgrades

# Configurar
sudo dpkg-reconfigure -plow unattended-upgrades
# Responde "Yes" cuando pregunte
```

### Verificar la configuración:

```bash
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

Asegúrate de que estas líneas estén descomentadas:

```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
};

Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

> **Nota**: `Automatic-Reboot` está en `false` para que el servidor no se reinicie solo. Si un parche requiere reinicio, te avisará en el login y tú decides cuándo hacerlo.

### Verificar que funciona:

```bash
sudo unattended-upgrade --dry-run --debug
```

---

## 11. Permisos de archivos

### Proteger el archivo .env:

```bash
cd /home/postialo/postialo-mailing

# Solo el dueño puede leer/escribir .env
chmod 600 .env

# Verificar
ls -la .env
# Debe mostrar: -rw------- 1 postialo postialo
```

### Permisos generales del proyecto:

```bash
# Archivos: lectura/escritura para el dueño, lectura para grupo
find /home/postialo/postialo-mailing -type f -exec chmod 644 {} \;

# Directorios: lectura/escritura/ejecución para dueño, lectura/ejecución para grupo
find /home/postialo/postialo-mailing -type d -exec chmod 755 {} \;

# .env debe ser restrictivo (repetir porque el comando anterior lo cambió)
chmod 600 /home/postialo/postialo-mailing/.env

# La carpeta uploads necesita escritura (la app sube archivos ahí)
chmod 755 /home/postialo/postialo-mailing/uploads
chmod 755 /home/postialo/postialo-mailing/uploads/logos
chmod 755 /home/postialo/postialo-mailing/uploads/campaigns

# Logs de PM2
chmod 755 /home/postialo/postialo-mailing/logs

# Asegurar que todo pertenece al usuario postialo
sudo chown -R postialo:postialo /home/postialo/postialo-mailing
```

---

## 12. Seguridad de PostgreSQL

### Verificar que solo acepta conexiones locales:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Asegúrate de que las únicas líneas activas (no comentadas) sean:

```
# Conexiones locales (socket Unix)
local   all   all   peer

# Conexiones TCP desde localhost solamente
host    all   all   127.0.0.1/32   scram-sha-256
host    all   all   ::1/128        scram-sha-256
```

> **Importante**: NO debe haber líneas con `0.0.0.0/0` — eso abriría PostgreSQL a todo internet.

### Verificar que solo escucha en localhost:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Busca la línea `listen_addresses` y asegúrate de que diga:

```
listen_addresses = 'localhost'
```

```bash
sudo systemctl restart postgresql
```

### Verificar que el puerto 5432 no está expuesto:

```bash
sudo ss -tlnp | grep 5432
# Debe mostrar solo 127.0.0.1:5432, NO 0.0.0.0:5432
```

---

## 13. Monitoreo básico

### Script de monitoreo con alertas por disco y memoria:

```bash
nano /home/postialo/monitor.sh
```

```bash
#!/bin/bash

DISK_THRESHOLD=85
MEM_THRESHOLD=85
LOG_FILE="/home/postialo/monitor.log"

DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
MEM_USAGE=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')

ALERT=""

if [ "$DISK_USAGE" -gt "$DISK_THRESHOLD" ]; then
    ALERT="${ALERT}[ALERTA] Disco al ${DISK_USAGE}% (umbral: ${DISK_THRESHOLD}%)\n"
fi

if [ "$MEM_USAGE" -gt "$MEM_THRESHOLD" ]; then
    ALERT="${ALERT}[ALERTA] Memoria al ${MEM_USAGE}% (umbral: ${MEM_THRESHOLD}%)\n"
fi

PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' | head -1)
if echo "$PM2_STATUS" | grep -qv "online"; then
    ALERT="${ALERT}[ALERTA] PostIAlo NO está corriendo en PM2\n"
fi

if [ -n "$ALERT" ]; then
    echo -e "[$(date)] ALERTAS DETECTADAS:\n${ALERT}" >> "$LOG_FILE"
    echo -e "[$(date)] ALERTAS DETECTADAS:\n${ALERT}"
else
    echo "[$(date)] Todo normal — Disco: ${DISK_USAGE}%, Memoria: ${MEM_USAGE}%, App: OK" >> "$LOG_FILE"
fi
```

```bash
chmod +x /home/postialo/monitor.sh
```

### Ejecutar cada 10 minutos:

```bash
crontab -e
```

Agrega:

```
*/10 * * * * /home/postialo/monitor.sh
```

### Revisar alertas:

```bash
tail -20 /home/postialo/monitor.log

# O buscar solo alertas
grep "ALERTA" /home/postialo/monitor.log
```

---

## 14. Checklist final de seguridad

Ejecuta cada verificación después de completar todas las secciones:

### Usuario y permisos:

- [ ] La app corre como usuario `postialo`, NO como root
- [ ] `.env` tiene permisos `600` (solo el dueño puede leerlo)
- [ ] Todos los archivos pertenecen al usuario `postialo`

### Nginx:

- [ ] Nginx está corriendo: `sudo systemctl status nginx`
- [ ] La app responde en `https://tu-dominio.com`
- [ ] HTTP redirige a HTTPS automáticamente
- [ ] Headers de seguridad presentes: `curl -I https://tu-dominio.com`
- [ ] Version de Nginx oculta (no aparece `Server: nginx/x.x.x`)

### SSL:

- [ ] Certificado válido: `sudo certbot certificates`
- [ ] Renovación automática: `sudo certbot renew --dry-run`
- [ ] HSTS activo en headers de respuesta

### Firewall:

- [ ] UFW activo: `sudo ufw status`
- [ ] Solo puertos 22, 80, 443 abiertos
- [ ] Puerto 5000 NO accesible desde fuera: `curl http://IP_VPS:5000` (debe fallar)
- [ ] Puerto 5432 NO accesible desde fuera

### PM2:

- [ ] App corriendo: `pm2 status`
- [ ] Auto-inicio configurado: `pm2 startup` ejecutado
- [ ] Configuración guardada: `pm2 save` ejecutado
- [ ] Rotación de logs activa: `pm2 describe postialo-mailing`

### SSH:

- [ ] Login con clave SSH funciona
- [ ] Login como root deshabilitado
- [ ] Autenticación por contraseña deshabilitada
- [ ] `MaxAuthTries 3` configurado

### PostgreSQL:

- [ ] Solo escucha en localhost: `sudo ss -tlnp | grep 5432`
- [ ] Puerto 5432 no accesible externamente

### Respaldos:

- [ ] Script de backup funciona: `/home/postialo/backup-db.sh`
- [ ] Cron job configurado: `crontab -l`
- [ ] Al menos un backup existe en `/home/postialo/backups/`

### Protecciones:

- [ ] Fail2Ban corriendo: `sudo fail2ban-client status`
- [ ] Actualizaciones automáticas: `sudo systemctl status unattended-upgrades`
- [ ] Monitor activo: `crontab -l | grep monitor`

---

## Resumen de servicios activos

| Servicio               | Estado     | Función                          |
|------------------------|-----------|----------------------------------|
| Nginx                  | Corriendo | Reverse proxy + SSL + headers    |
| PM2                    | Corriendo | Gestión de la app Node.js        |
| PostgreSQL             | Corriendo | Base de datos (solo local)       |
| UFW                    | Activo    | Firewall (22, 80, 443)           |
| Fail2Ban               | Corriendo | Protección contra fuerza bruta   |
| Certbot Timer          | Activo    | Renovación automática de SSL     |
| Unattended Upgrades    | Activo    | Parches de seguridad automáticos |
| Backup Cron            | Activo    | Respaldo diario de PostgreSQL    |
| Monitor Cron           | Activo    | Alertas de disco/memoria/app     |
