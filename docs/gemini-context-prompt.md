# Prompt de Contextualización para NotebookLM — Integración Gemini API con PostIAlo Mail

## Contexto del Proyecto

Estamos construyendo **PostIAlo Mail**, una plataforma SaaS de email marketing con inteligencia artificial. La plataforma permite a los usuarios crear campañas de correo electrónico donde la IA genera tanto el texto como las imágenes del correo.

### Stack Técnico
- **Backend**: Node.js con Express.js, escrito en TypeScript
- **Base de Datos**: PostgreSQL con Drizzle ORM
- **Frontend**: React con TypeScript (Vite)
- **Entorno**: Replit (Linux, sin Docker)

### Flujo que queremos implementar

1. El usuario abre el **Calendario** y hace clic en un día
2. Se abre un formulario "Nuevo Correo" con estos campos:
   - **Idea / Tema**: texto describiendo la campaña
   - **Objetivo**: meta de la campaña
   - **Prompt de Imagen**: descripción de la imagen deseada para el correo
   - **Plantilla**: diseño HTML base
   - **Base de Datos**: lista de contactos destino
   - **Fecha y Hora**: programación del envío
3. Al hacer clic en **"Generar Correo"**, el backend debe:
   - Crear la campaña en la base de datos
   - Tomar el campo `imagePrompt` y enviarlo a la **API de Gemini (modelo Imagen 3)** para generar una imagen
   - Recibir la imagen generada (formato base64 o URL)
   - Guardar la imagen en la base de datos (en el campo `imageUrl` de la tabla `campaign_versions`)
   - Devolver la versión completa al frontend para renderizarla

### Almacenamiento de imágenes
- Planeamos guardar las imágenes como **data URLs en base64** directamente en PostgreSQL (campo `text` en la tabla `campaign_versions.imageUrl`)
- Cada imagen se estima en ~100-200KB como base64
- Es un MVP, así que no usamos almacenamiento externo (S3, Cloudinary) por ahora

### Estructura relevante del backend

```typescript
// Endpoint que necesitamos modificar
POST /api/campaigns/:id/generate

// Tabla campaign_versions
{
  id: serial,
  campaignId: integer,
  versionNumber: integer,       // máximo 3 por campaña
  contentJson: jsonb,           // { title, body, cta } o { html }
  imageUrl: text,               // aquí se guarda la imagen (data URL base64)
  isSelected: boolean,
  createdAt: timestamp
}

// Tabla campaigns (tiene el prompt)
{
  id: serial,
  userId: integer,
  name: text,
  idea: text,
  objective: text,
  tone: text,
  imagePrompt: text,            // prompt del usuario para la imagen
  targetDatabase: text,
  status: text,                 // draft | scheduled | sent
  scheduledAt: timestamp
}
```

---

## Preguntas Específicas para el Cuaderno

Necesitamos que el cuaderno nos responda estas preguntas específicas sobre la API de Gemini para poder implementar la integración:

### 1. Autenticación y Configuración
- ¿Cómo nos autenticamos con la API de Gemini para usar la generación de imágenes (Imagen 3)?
- ¿Se usa una API Key simple o se requiere OAuth / Service Account?
- ¿Cuál es el formato del header de autenticación?
- ¿Necesitamos habilitar algún servicio específico en Google Cloud para usar Imagen 3?

### 2. Endpoint y Modelo
- ¿Cuál es el endpoint exacto para generar imágenes con Imagen 3?
- ¿Cuál es el nombre exacto del modelo? (ej: `imagen-3.0-generate-001`, `imagegeneration@006`, etc.)
- ¿Se usa el SDK `@google/generative-ai` para Node.js o se hacen llamadas HTTP directas?
- Si se usa el SDK, ¿cuál es la función/método específico para generación de imágenes?
- ¿Hay una diferencia entre la API de Vertex AI y la API de Generative AI para imágenes?

### 3. Parámetros de la Solicitud
- ¿Qué parámetros acepta la solicitud de generación de imágenes?
  - Prompt (texto)
  - Tamaño/dimensiones (necesitamos 600x300 o similar para headers de email)
  - Calidad
  - Estilo (fotográfico, ilustración, etc.)
  - Número de imágenes por solicitud
- ¿Soporta prompts negativos (cosas que NO queremos en la imagen)?
- ¿Hay un límite de caracteres para el prompt?
- ¿Se puede especificar una relación de aspecto (aspect ratio) en vez de dimensiones exactas?

### 4. Formato de Respuesta
- ¿En qué formato viene la imagen generada?
  - ¿Base64 directamente en el JSON de respuesta?
  - ¿URL temporal que hay que descargar?
  - ¿Bytes crudos?
- ¿Cuál es el tipo MIME de la imagen (PNG, JPEG, WebP)?
- ¿Qué campos del JSON de respuesta contienen la imagen?
- Muéstrenos un ejemplo del JSON de respuesta completo

### 5. Ejemplo de Código Completo
- Necesitamos un ejemplo de código en **Node.js / TypeScript** que:
  1. Configure el cliente de Gemini
  2. Envíe un prompt de texto
  3. Reciba la imagen generada
  4. La convierta a un data URL base64 (ej: `data:image/png;base64,iVBOR...`)
- Si se usa el SDK: ejemplo con `@google/generative-ai`
- Si se usa HTTP directo: ejemplo con `fetch` o `axios`

### 6. Límites y Costos
- ¿Cuál es el rate limit (solicitudes por minuto)?
- ¿Cuánto cuesta cada generación de imagen?
- ¿Hay un tier gratuito o créditos iniciales?
- ¿Qué headers o campos indican los límites restantes?

### 7. Manejo de Errores
- ¿Qué códigos de error puede devolver la API?
- ¿Cómo se manejan los errores de contenido inapropiado (safety filters)?
- ¿Cuál es la estructura del error en el JSON de respuesta?
- ¿Se recomienda implementar reintentos (retries)? ¿Con qué estrategia?

### 8. Optimización para Email Marketing
- ¿Se puede pedir que la imagen tenga un fondo sólido para que se vea bien en emails?
- ¿Se puede especificar que la imagen no tenga texto (ya que el texto va en HTML)?
- ¿Hay parámetros para generar imágenes más "limpias" o "profesionales" ideales para email marketing?
- ¿Recomendaciones de tamaño de imagen para maximizar compatibilidad con clientes de correo?

---

## Formato de Respuesta Esperado

Por favor organice la respuesta en las mismas 8 secciones de arriba, con ejemplos de código cuando aplique. Si hay diferencias entre la API de Vertex AI y la API pública de Generative AI, indique cuál usar para nuestro caso (un SaaS que se ejecuta en Replit con una API Key).

Prioridad: Necesitamos poder hacer esto en Node.js/TypeScript con una API Key simple, sin necesidad de Google Cloud Project complejo.
