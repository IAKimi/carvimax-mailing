# PostIAlo Redes Sociales — Documentación de Integración con la API de Gemini

---

## 1. Contexto del Proyecto

### 1.1 ¿Qué es PostIAlo?

**PostIAlo** es una plataforma SaaS de gestión inteligente de contenido para redes sociales, impulsada por inteligencia artificial. Es el **gemelo digital** de la plataforma PostIAlo Mailing (enfocada en campañas de email marketing), pero diseñada exclusivamente para la **publicación automatizada en Facebook e Instagram**.

PostIAlo permite a empresas, emprendedores y agencias de marketing crear, programar y gestionar publicaciones para redes sociales desde un único portal, utilizando IA generativa para producir textos (copys), imágenes y plantillas reutilizables de forma profesional y alineada con la identidad de marca del usuario.

### 1.2 ¿Cómo funciona la plataforma?

La plataforma sigue este flujo principal:

1. **Registro y autenticación** — El usuario se registra, verifica su email y accede al portal.
2. **Configuración de identidad de marca** — El usuario define su empresa, misión, visión, productos, tono de comunicación, colores, tipografías, logo y público objetivo.
3. **Conexión con Meta Business** — El usuario vincula sus cuentas de Facebook e Instagram a través de la API de Meta.
4. **Creación de contenido con IA** — El usuario proporciona una idea y un objetivo, y la IA genera automáticamente el texto del post (caption, hashtags, CTA) y la imagen.
5. **Edición y refinamiento** — El usuario puede regenerar el texto con correcciones, regenerar la imagen, o editar la imagen con instrucciones específicas.
6. **Programación y publicación** — El contenido aprobado se programa en el calendario y se publica automáticamente en las redes sociales vinculadas.

### 1.3 Rol de Gemini en la plataforma

Gemini se utiliza exclusivamente para la **generación y edición de imágenes**. Esto incluye:

- Generación de imágenes a partir de texto (text-to-image) para publicaciones
- Regeneración de imágenes con prompts personalizados
- Edición simple de imágenes existentes (modificaciones con instrucciones)
- Edición avanzada de imágenes con micro-prompts especializados (agregar elementos, reemplazar, fusionar, transferir estilo, borrar)

La generación de textos (copys, hashtags, CTAs) se maneja con la API de OpenAI (documentada en un archivo aparte).

### 1.4 Stack Tecnológico

- **Backend:** Node.js + Express.js + TypeScript
- **Base de Datos:** PostgreSQL con Drizzle ORM
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **IA Visual:** Google Gemini (gemini-3.1-flash-image-preview / gemini-2.0-flash) — este documento
- **IA Textual:** OpenAI (gpt-4.1-mini) — documento separado
- **Autenticación:** Sesiones con express-session + PostgreSQL session store
- **Comunicación en tiempo real:** WebSocket para progreso de generación

---

## 2. Arquitectura de Claves API (Multi-Tenant)

### 2.1 Modelo de claves

La plataforma implementa un sistema **multi-tenant** de claves API donde cada usuario puede configurar su propia clave de Gemini. Si no la configura, el sistema utiliza una clave global del servidor como respaldo.

### 2.2 Flujo de resolución de clave

```
1. El usuario solicita una acción que requiere Gemini
2. El sistema busca en la tabla `api_keys` una clave activa para ese usuario con service="gemini"
3. Si encuentra una clave del usuario:
   a. La desencripta usando AES-256-GCM (derivada de SESSION_SECRET con PBKDF2)
   b. Devuelve la clave desencriptada como string
4. Si NO encuentra clave del usuario:
   a. Busca la variable de entorno GEMINI_API_KEY (clave global del servidor)
   b. Si existe, usa esa clave
   c. Si NO existe, lanza error: "No se encontró una clave de Gemini. Configure su clave API en la sección de configuración."
```

### 2.3 Encriptación de claves de usuario

Las claves API de los usuarios se almacenan encriptadas en la base de datos:

- **Algoritmo:** AES-256-GCM
- **Derivación de clave:** PBKDF2 con SHA-512, 100,000 iteraciones
- **Salt:** `"postialo-rrss-encryption-salt"` (estático)
- **Fuente de la clave maestra:** Variable de entorno `SESSION_SECRET`
- **Almacenamiento:** Tabla `api_keys` con campos `encrypted_key`, `iv` (vector de inicialización en hex), `auth_tag` (tag de autenticación en hex)

**Nota importante:** Cambiar el `SESSION_SECRET` invalidará todas las claves API almacenadas de los usuarios, ya que no se podrán desencriptar.

### 2.4 Código de resolución de clave (literal)

```typescript
async function getApiKeyForUser(userId: number): Promise<string> {
  // Paso 1: Buscar clave del usuario en BD
  const userKey = await storage.getApiKeyByService(userId, "gemini");
  if (userKey) {
    // Desencriptar y devolver clave del usuario
    return decryptApiKey(userKey.encryptedKey, userKey.iv, userKey.authTag);
  }
  // Paso 2: Usar clave global como respaldo
  const globalKey = getGlobalApiKey();
  if (!globalKey) {
    throw new Error("No se encontró una clave de Gemini. Configure su clave API en la sección de configuración.");
  }
  return globalKey;
}
```

---

## 3. Modelos de IA Utilizados

| Parámetro | Modelo Principal | Modelo de Respaldo |
|-----------|-----------------|-------------------|
| **Nombre** | `gemini-3.1-flash-image-preview` | `gemini-2.0-flash` |
| **API Endpoint** | Google Generative Language API v1beta | Mismo |
| **URL Base** | `https://generativelanguage.googleapis.com/v1beta/models` | Mismo |
| **Modalidad de respuesta** | `IMAGE` | `IMAGE` |
| **Formato de imagen** | 1:1 (cuadrado, ideal para redes sociales) | 1:1 |
| **Autenticación** | API Key en query parameter | API Key en query parameter |

### 3.1 URL de petición

```
POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={apiKey}
```

---

## 4. Mecanismos de Resiliencia

### 4.1 Sistema de reintentos con backoff exponencial

Cada petición a Gemini pasa por un sistema de reintentos:

```
Intento 1: Petición inmediata
Intento 2: Espera 2 segundos, luego reintenta
Intento 3: Espera 4 segundos, luego reintenta
```

**Códigos HTTP que activan reintento:** `500`, `502`, `503`, `429`

**Reintentos máximos:** 3 para modelo principal, 2 para modelo de respaldo

### 4.2 Sistema de failsafe (modelo de respaldo)

Si el modelo principal (`gemini-3.1-flash-image-preview`) falla tras agotar reintentos o devuelve un código retryable, el sistema automáticamente cambia al modelo de respaldo (`gemini-2.0-flash`):

```
1. Intentar con gemini-3.1-flash-image-preview (hasta 3 reintentos)
2. Si falla → Log de advertencia
3. Intentar con gemini-2.0-flash (hasta 2 reintentos)
4. Si también falla → Lanzar error definitivo
```

**Mensaje de error si ambos fallan:**
```
"Error de red al contactar Gemini tras agotar modelo principal (gemini-3.1-flash-image-preview) y respaldo (gemini-2.0-flash): {detalle del error}"
```

### 4.3 Manejo de respuestas de seguridad

Gemini tiene filtros de seguridad de contenido que pueden bloquear solicitudes. El sistema maneja cada caso:

| Escenario | Detección | Mensaje al usuario |
|-----------|-----------|-------------------|
| Prompt bloqueado antes de procesar | `promptFeedback.blockReason` presente | "El prompt fue bloqueado por los filtros de seguridad de Google ({razón}). Intente con un prompt diferente." |
| Sin candidatos devueltos | `candidates` vacío o ausente | "Gemini no devolvió resultados. Es posible que el prompt haya sido bloqueado por seguridad. Intente con un prompt diferente." |
| finishReason = SAFETY | Candidato marcado como unsafe | "El prompt fue bloqueado por los filtros de seguridad de Google. Intente con un prompt diferente que no contenga contenido sensible." |
| finishReason = RECITATION | Política de recitación | "El prompt fue bloqueado por políticas de recitación. Intente reformular el prompt." |
| finishReason = PROHIBITED_CONTENT | Contenido prohibido | "El contenido solicitado está prohibido por las políticas de Google. Intente con un prompt diferente." |
| Categorías de seguridad bloqueadas | `safetyRatings` con `blocked: true` | "Imagen bloqueada por filtros de seguridad en las categorías: {categorías}. Intente con un prompt diferente." |
| Respuesta sin contenido | Parts vacíos o ausentes, sin categorías bloqueadas | "Respuesta de Gemini sin contenido. Intente con un prompt más descriptivo." |
| Sin imagen en las parts | Parts presentes pero ninguno tiene inlineData | "Gemini no generó una imagen. Intente con un prompt más descriptivo." |
| Error general de API | `data.error` presente | "Error de Gemini: {mensaje}" |

### 4.4 Progreso en tiempo real (WebSocket)

Durante todas las operaciones con Gemini, se envían mensajes de progreso por WebSocket:

| Operación | Mensajes |
|-----------|----------|
| Generación inicial | `"Generando imagen..."` → `"Imagen generada."` o `"Imagen no disponible."` |
| Regeneración | `"Regenerando imagen..."` → `"Imagen regenerada."` |
| Edición simple | `"Editando imagen..."` → `"Imagen editada."` |
| Edición avanzada | `"Editando imagen (avanzado)..."` → `"Imagen editada (avanzado)."` |
| Error | `"{mensaje del error}"` |

---

## 5. Funcionalidad A: Generación de Imagen para Publicación

### 5.1 ¿Qué hace?

Genera una imagen profesional para una publicación de redes sociales a partir de la idea del post. La imagen se genera en formato cuadrado (1:1), ideal para Facebook e Instagram.

### 5.2 ¿Qué problema resuelve?

Elimina la necesidad de que el usuario diseñe o busque imágenes manualmente. La IA genera una imagen relevante, profesional y lista para publicar basada en el concepto del post.

### 5.3 Endpoint del backend

```
POST /api/posts/:id/generate
```

(Este endpoint genera tanto el texto como la imagen. La generación de imagen es el paso 2 del flujo.)

### 5.4 Prompt de generación de imagen (literal)

```
Create a professional social media post image for: {idea del post}. The image should be modern, eye-catching, and suitable for Facebook and Instagram. Style: clean, professional, high-quality. Aspect ratio: 1:1 (square).
```

**Nota:** El prompt está en inglés porque los modelos de generación de imagen de Gemini producen mejores resultados con prompts en inglés.

### 5.5 Payload enviado a la API de Gemini

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Create a professional social media post image for: {idea}. The image should be modern, eye-catching, and suitable for Facebook and Instagram. Style: clean, professional, high-quality. Aspect ratio: 1:1 (square)."
        }
      ]
    }
  ],
  "generation_config": {
    "response_modalities": ["IMAGE"],
    "image_config": {
      "aspect_ratio": "1:1"
    }
  }
}
```

### 5.6 Respuesta de Gemini

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "{base64 de la imagen generada}"
            }
          }
        ]
      },
      "finishReason": "STOP"
    }
  ]
}
```

### 5.7 Procesamiento de la respuesta

1. Se extrae `candidates[0].content.parts[0].inlineData`
2. Se construye una data URL: `data:{mimeType};base64,{data}`
3. Se guarda el archivo en el servidor: `uploads/post-{id}-v1-{timestamp}.{ext}`
4. Se almacena la URL relativa (`/uploads/post-{id}-v1-{timestamp}.png`) en la BD
5. Se crea una versión del post con la imagen (tipo `"initial"`)

### 5.8 Resultado para el usuario

- La imagen aparece en el editor del post, lista para usar
- Si la generación de imagen falla (por filtros de seguridad o errores), el post se crea solo con texto y sin imagen
- El usuario puede regenerar la imagen con un prompt personalizado

### 5.9 Manejo de fallos en la generación de imagen

La generación de imagen es **no-bloqueante**: si falla, el post se crea igualmente con texto pero sin imagen. El error se registra en los logs y se envía un mensaje de progreso `"Imagen no disponible."` al frontend.

---

## 6. Funcionalidad B: Regeneración de Imagen

### 6.1 ¿Qué hace?

Genera una nueva imagen para un post existente, opcionalmente con un prompt personalizado proporcionado por el usuario.

### 6.2 ¿Qué problema resuelve?

Cuando la imagen generada inicialmente no satisface al usuario, puede solicitar una nueva imagen con instrucciones más específicas sin necesidad de editar la imagen pixel por pixel.

### 6.3 Endpoint del backend

```
POST /api/posts/:id/regenerate-image
```

**Payload del frontend:**
```json
{
  "prompt": "Una imagen minimalista con fondo blanco y el producto centrado, estilo Apple"
}
```

Si no se envía prompt, se usa el prompt almacenado del post o el prompt por defecto.

### 6.4 Prompt de regeneración

Se usa el prompt proporcionado por el usuario, o como fallback:

```
{prompt del usuario}
```

O si no hay prompt:

```
Create a professional social media post image for: {idea del post}. Style: modern, clean, eye-catching. Aspect ratio: 1:1 (square).
```

### 6.5 Payload enviado a Gemini

Idéntico al de generación (sección 5.5), pero con el prompt personalizado.

### 6.6 Resultado para el usuario

- Se incrementa el contador de regeneraciones de imagen (`imageRegenCount`)
- Se crea una nueva versión de imagen (tipo `"image_regen"`)
- La nueva imagen se marca como seleccionada
- El prompt se actualiza en el post (`imagePrompt`)
- Versiones anteriores de imagen se mantienen en el historial

---

## 7. Funcionalidad C: Edición Simple de Imagen

### 7.1 ¿Qué hace?

Toma una imagen existente y aplica modificaciones basadas en un prompt de texto. Permite editar una imagen ya generada con instrucciones como "agrega un texto que diga '20% de descuento'" o "cambia el fondo a azul".

### 7.2 ¿Qué problema resuelve?

Permite refinamientos rápidos a la imagen sin regenerarla desde cero. Útil para ajustes menores como agregar texto, cambiar colores, o modificar detalles.

### 7.3 Endpoint del backend

```
POST /api/posts/:id/edit-image
```

**Payload del frontend:**
```json
{
  "currentImage": "data:image/png;base64,{base64 de la imagen actual}",
  "editPrompt": "Agrega un texto en la parte inferior que diga '¡Oferta especial!'"
}
```

### 7.4 Procesamiento de la imagen de entrada

El sistema procesa la imagen base64 antes de enviarla a Gemini:
1. Separa el mimeType del data URI: `data:(image/png);base64,...` → mimeType = `"image/png"`
2. Extrae solo los datos base64 (sin el prefijo `data:...;base64,`)

### 7.5 Payload enviado a Gemini

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "inline_data": {
            "mime_type": "image/png",
            "data": "{base64 de la imagen actual sin prefijo}"
          }
        },
        {
          "text": "{prompt de edición del usuario}"
        }
      ]
    }
  ],
  "generation_config": {
    "response_modalities": ["IMAGE"],
    "image_config": {
      "aspect_ratio": "1:1"
    }
  }
}
```

**Nota:** La imagen se envía como `inline_data` antes del texto para que Gemini la use como referencia visual.

### 7.6 Resultado para el usuario

- Se crea una nueva versión de imagen (tipo `"image_edit"`)
- Se incrementa `imageRegenCount`
- La imagen editada reemplaza la seleccionada en el post
- La imagen original se mantiene en el historial de versiones

---

## 8. Funcionalidad D: Edición Avanzada de Imagen (Micro-Prompts)

### 8.1 ¿Qué hace?

Ofrece un sistema de edición de imágenes avanzado con 5 acciones especializadas, cada una con un micro-prompt de ingeniería optimizado para esa tarea específica. Permite operaciones complejas como composición de múltiples imágenes, transferencia de estilo, y eliminación de elementos.

### 8.2 ¿Qué problema resuelve?

Para ediciones complejas que requieren precisión (como integrar un logo en una foto, fusionar dos imágenes, o eliminar un elemento no deseado), un prompt genérico no es suficiente. Los micro-prompts especializados guían al modelo con instrucciones técnicas precisas para cada tipo de operación.

### 8.3 Endpoint del backend

```
POST /api/posts/:id/edit-image-advanced
```

**Payload del frontend:**
```json
{
  "currentImageBase64": "data:image/png;base64,{imagen principal}",
  "referenceImagesBase64": ["data:image/png;base64,{imagen de referencia 1}"],
  "userText": "Integra el logo en la esquina superior derecha",
  "selectedAction": "agregar"
}
```

### 8.4 Las 5 Acciones Disponibles

#### Acción 1: `agregar` (Agregar elemento)

**Objetivo:** Integrar una imagen de referencia (logo, producto, elemento visual) en la imagen principal preservando la fidelidad al 100%.

**Micro-Prompt completo (literal):**
```
Actúa como un diseñador experto. Usa la imagen de referencia adjunta exactamente como es, preservando su diseño, texto, proporciones y detalles de alta fidelidad al 100%. Intégrala de forma natural en la imagen principal manteniendo la iluminación y perspectiva original, siguiendo esta instrucción: {texto del usuario}
```

**Caso de uso típico:** Agregar un logo corporativo a una imagen promocional, insertar un producto en una escena.

---

#### Acción 2: `reemplazar` (Reemplazar elemento)

**Objetivo:** Identificar un elemento específico en la imagen y reemplazarlo por otro, manteniendo el resto intacto.

**Micro-Prompt completo (literal):**
```
Realiza un enmascaramiento semántico en la imagen principal. Identifica el elemento mencionado y reemplázalo usando la imagen de referencia como guía visual. Es crucial que cambies SOLO ese elemento y mantengas el resto de la imagen original intacto. Instrucción exacta: {texto del usuario}
```

**Caso de uso típico:** Reemplazar un producto por otro en una foto existente, cambiar un elemento del diseño.

---

#### Acción 3: `fusionar` (Fusionar/Componer imágenes)

**Objetivo:** Crear una composición fotográfica avanzada combinando la imagen principal con la imagen de referencia.

**Micro-Prompt completo (literal):**
```
Realiza una composición fotográfica avanzada. Toma la imagen principal como base y la imagen de referencia como contexto. Crea una escena compuesta que combine ambas de forma natural, respetando las escalas y la siguiente directriz: {texto del usuario}
```

**Caso de uso típico:** Combinar una foto de producto con un fondo de escena, crear composiciones de antes/después.

---

#### Acción 4: `estilo` (Transferir estilo)

**Objetivo:** Aplicar el estilo artístico, paleta de colores y estética de la imagen de referencia a la imagen principal.

**Micro-Prompt completo (literal):**
```
Transforma la imagen principal. Aplica el estilo artístico, la paleta de colores y la estética visual general de la imagen de referencia adjunta a la imagen principal. Recrea el contenido original fielmente pero bajo este nuevo estilo. Instrucción adicional: {texto del usuario}
```

**Caso de uso típico:** Convertir una foto en estilo acuarela, aplicar un look vintage, adaptar los colores de marca.

---

#### Acción 5: `borrar_elemento` (Eliminar elemento / Inpainting)

**Objetivo:** Eliminar un elemento de la imagen y rellenar el espacio de forma natural (inpainting).

**Micro-Prompt completo (literal):**
```
Edita la imagen principal para eliminar el elemento especificado. Rellena el espacio vacío de forma fluida y natural (inpainting) para que coincida a la perfección con el fondo existente. Deja el resto de la composición exactamente igual. Elemento a eliminar: {texto del usuario}
```

**Caso de uso típico:** Eliminar texto no deseado de una imagen, quitar un objeto del fondo, limpiar una foto.

**Nota:** Esta acción no requiere imagen de referencia.

---

### 8.5 Construcción del prompt final

El prompt final que se envía a Gemini se construye concatenando:

```
{micro-prompt de la acción seleccionada} + {texto/instrucciones del usuario}
```

Ejemplo para la acción `agregar` con texto "Pon el logo en la esquina inferior derecha":

```
Actúa como un diseñador experto. Usa la imagen de referencia adjunta exactamente como es, preservando su diseño, texto, proporciones y detalles de alta fidelidad al 100%. Intégrala de forma natural en la imagen principal manteniendo la iluminación y perspectiva original, siguiendo esta instrucción: Pon el logo en la esquina inferior derecha
```

### 8.6 Validaciones previas al envío

Antes de enviar la petición a Gemini, se realizan validaciones:

1. **Acción válida:** Verifica que `selectedAction` sea una de las 5 acciones definidas
2. **Tipo MIME soportado:** Verifica que todas las imágenes sean `image/jpeg`, `image/png`, o `image/webp`
3. **Tamaño total:** Verifica que el peso total de todas las imágenes (base + referencias) no exceda 20 MB

```typescript
const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20 MB
```

### 8.7 Payload enviado a Gemini

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "{micro-prompt + texto del usuario}"
        },
        {
          "inline_data": {
            "mime_type": "image/png",
            "data": "{base64 de la imagen principal}"
          }
        },
        {
          "inline_data": {
            "mime_type": "image/png",
            "data": "{base64 de la imagen de referencia 1}"
          }
        }
      ]
    }
  ],
  "generation_config": {
    "response_modalities": ["IMAGE"],
    "image_config": {
      "aspect_ratio": "1:1"
    }
  }
}
```

**Orden de las parts:**
1. Texto (prompt final con micro-prompt)
2. Imagen principal (base)
3. Imagen(es) de referencia (0 o más)

**Nota:** Para la acción `borrar_elemento`, el array `referenceImagesBase64` típicamente estará vacío, ya que no se necesita una imagen de referencia.

### 8.8 Resultado para el usuario

- Se crea una nueva versión de imagen (tipo `"image_advanced_edit"`)
- Se incrementa `imageRegenCount`
- La imagen editada reemplaza la seleccionada en el post
- Todas las versiones anteriores se mantienen accesibles

---

## 9. Almacenamiento de Imágenes

### 9.1 Flujo de almacenamiento

```
1. Gemini devuelve imagen como base64 en la respuesta
2. Se construye data URL: data:{mimeType};base64,{data}
3. Se decodifica el base64 a Buffer binario
4. Se guarda como archivo en uploads/{nombre}.{ext}
5. Se almacena la URL relativa /uploads/{nombre}.{ext} en la BD
```

### 9.2 Convención de nombres de archivo

| Operación | Patrón de nombre |
|-----------|-----------------|
| Generación inicial | `post-{postId}-v1-{timestamp}.{ext}` |
| Regeneración | `post-{postId}-img-regen-{timestamp}.{ext}` |
| Edición simple | `post-{postId}-edit-{timestamp}.{ext}` |
| Edición avanzada | `post-{postId}-adv-edit-{timestamp}.{ext}` |
| Imagen seleccionada | `post-{postId}-selected-{timestamp}.{ext}` |

### 9.3 Limpieza de archivos

Cuando se elimina un post, se eliminan todos los archivos de imagen asociados:
- La imagen seleccionada (`selectedImageUrl`)
- Todas las imágenes de todas las versiones del post

---

## 10. Variables de Entorno Requeridas

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `GEMINI_API_KEY` | No* | Clave global de Gemini (respaldo si el usuario no configura la suya) |
| `SESSION_SECRET` | Sí | Secreto para firmar sesiones y derivar clave de encriptación de claves API de usuarios |
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL |

*Al menos una clave (global o del usuario) es necesaria para que las funcionalidades de generación/edición de imagen funcionen.

---

## 11. Resumen de Funcionalidades

| Funcionalidad | Endpoint | Modelo | Requiere imagen base | Requiere referencia | Micro-Prompt |
|---------------|----------|--------|---------------------|--------------------|----|
| Generar imagen | `POST /api/posts/:id/generate` (paso 2) | gemini-3.1-flash-image-preview | No | No | No |
| Regenerar imagen | `POST /api/posts/:id/regenerate-image` | gemini-3.1-flash-image-preview | No | No | No |
| Editar imagen (simple) | `POST /api/posts/:id/edit-image` | gemini-3.1-flash-image-preview | Sí | No | No |
| Editar imagen (avanzado) | `POST /api/posts/:id/edit-image-advanced` | gemini-3.1-flash-image-preview | Sí | Opcional | Sí  |

---

## 12. Tabla de Micro-Prompts

| Acción | Clave | Requiere referencia | Prompt Engineering |
|--------|-------|--------------------|--------------------|
| Agregar | `agregar` | Sí | Preservar referencia al 100%, integrar naturalmente |
| Reemplazar | `reemplazar` | Sí | Enmascaramiento semántico, cambiar SOLO el elemento |
| Fusionar | `fusionar` | Sí | Composición fotográfica avanzada, respetar escalas |
| Estilo | `estilo` | Sí | Transferir estilo artístico y paleta de colores |
| Borrar | `borrar_elemento` | No | Inpainting, rellenar espacio naturalmente |

---

## 13. Estructura de Respuesta de Gemini (Referencia técnica)

```typescript
interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;   // "image/png", "image/jpeg", etc.
          data: string;       // Imagen en base64
        };
        text?: string;        // Texto (si aplica)
      }>;
    };
    finishReason?: string;    // "STOP", "SAFETY", "RECITATION", "PROHIBITED_CONTENT"
    safetyRatings?: Array<{
      category: string;
      probability: string;
      blocked?: boolean;
    }>;
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
  error?: {
    message: string;
    code: number;
  };
}
```

---

## 14. Preguntas para Auditoría

1. ¿El prompt de generación de imagen en inglés es la mejor estrategia, o debería incluir contexto en español para marcas hispanohablantes?
2. ¿Los micro-prompts para edición avanzada son suficientemente específicos para producir resultados consistentes?
3. ¿El sistema de failsafe (modelo principal → modelo de respaldo) es adecuado, o debería implementarse una cola de reintentos más sofisticada?
4. ¿El límite de 20 MB para imágenes totales es apropiado o debería ajustarse?
5. ¿Deberían implementarse filtros de calidad en las imágenes generadas antes de mostrarlas al usuario?
6. ¿La acción `borrar_elemento` funciona adecuadamente sin imagen de referencia, o se beneficiaría de recibir una imagen de referencia del resultado deseado?
7. ¿El aspect ratio fijo de 1:1 es suficiente, o deberían soportarse otros formatos (9:16 para Stories, 16:9 para portadas)?
8. ¿Es adecuado el manejo de seguridad (múltiples checks de finishReason y safetyRatings), o deberían implementarse controles adicionales previos al envío?
9. ¿Los backoff exponenciales (2s, 4s) son tiempos apropiados para reintentos, o deberían ser más conservadores para evitar rate limiting?
