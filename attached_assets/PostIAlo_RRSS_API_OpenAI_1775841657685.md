# PostIAlo Redes Sociales — Documentación de Integración con la API de OpenAI

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

### 1.3 Rol de OpenAI en la plataforma

OpenAI se utiliza exclusivamente para la **generación y refinamiento de contenido textual**. Esto incluye:

- Generación de copys para publicaciones (captions, hashtags, CTAs)
- Regeneración de copys con correcciones del usuario
- Generación de plantillas reutilizables para publicaciones recurrentes

La generación de imágenes se maneja por separado con la API de Gemini (documentada en un archivo aparte).

### 1.4 Stack Tecnológico

- **Backend:** Node.js + Express.js + TypeScript
- **Base de Datos:** PostgreSQL con Drizzle ORM
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **IA Textual:** OpenAI (gpt-4.1-mini) — este documento
- **IA Visual:** Google Gemini — documento separado
- **Autenticación:** Sesiones con express-session + PostgreSQL session store
- **Comunicación en tiempo real:** WebSocket para progreso de generación

---

## 2. Arquitectura de Claves API (Multi-Tenant)

### 2.1 Modelo de claves

La plataforma implementa un sistema **multi-tenant** de claves API donde cada usuario puede configurar su propia clave de OpenAI. Si no la configura, el sistema utiliza una clave global del servidor como respaldo.

### 2.2 Flujo de resolución de clave

```
1. El usuario solicita una acción que requiere OpenAI
2. El sistema busca en la tabla `api_keys` una clave activa para ese usuario con service="openai"
3. Si encuentra una clave del usuario:
   a. La desencripta usando AES-256-GCM (derivada de SESSION_SECRET con PBKDF2)
   b. Crea un cliente OpenAI con esa clave
4. Si NO encuentra clave del usuario:
   a. Busca la variable de entorno OPENAI_API_KEY (clave global del servidor)
   b. Si existe, usa esa clave
   c. Si NO existe, lanza error: "No se encontró una clave de OpenAI. Configure su clave API en la sección de configuración."
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
async function getClientForUser(userId: number): Promise<OpenAI> {
  // Paso 1: Buscar clave del usuario en BD
  const userKey = await storage.getApiKeyByService(userId, "openai");
  if (userKey) {
    // Desencriptar y usar clave del usuario
    const decrypted = decryptApiKey(userKey.encryptedKey, userKey.iv, userKey.authTag);
    return new OpenAI({ apiKey: decrypted });
  }

  // Paso 2: Usar clave global como respaldo
  const fallback = getGlobalClient();
  if (!fallback) {
    throw new Error("No se encontró una clave de OpenAI. Configure su clave API en la sección de configuración.");
  }
  return fallback;
}
```

---

## 3. Modelo de IA Utilizado

| Parámetro | Valor |
|-----------|-------|
| **Modelo** | `gpt-4.1-mini` |
| **API Endpoint** | OpenAI Responses API (`client.responses.create`) |
| **Formato de salida** | Structured Outputs (JSON Schema estricto) |
| **Temperatura** | 0.7 (generación de posts) / 0.8 (generación de plantillas) |
| **Max output tokens** | 800 (posts) / sin límite explícito (plantillas) |
| **Almacenamiento** | `store: false` en generación/regeneración de posts (no se guardan las conversaciones en OpenAI). La generación de plantillas no establece este parámetro explícitamente. |
| **Idioma** | Español (forzado por el system prompt) |

---

## 4. Funcionalidad A: Generación de Contenido para Publicación

### 4.1 ¿Qué hace?

Genera automáticamente el texto completo de una publicación para Facebook e Instagram a partir de una idea y un objetivo proporcionados por el usuario. La IA actúa como "Head of Social Media" de la empresa del usuario.

### 4.2 ¿Qué problema resuelve?

Elimina la necesidad de que el usuario redacte copys profesionales desde cero. Incluso si el usuario proporciona una idea vaga o mal redactada, la IA asume el control creativo y genera contenido de calidad profesional alineado con la identidad de marca.

### 4.3 Endpoint del backend

```
POST /api/posts/:id/generate
```

**Requisitos previos:**
- El post debe existir previamente en la base de datos (creado a través de `POST /api/posts`)
- El usuario debe tener una clave de OpenAI configurada (propia o global)
- El usuario debe tener una clave de Gemini configurada (para la imagen, que se genera en el mismo endpoint)

### 4.4 System Prompt completo (literal)

Este es el prompt de sistema que se envía a OpenAI. Se construye dinámicamente incorporando la identidad de marca del usuario:

```
Eres el Head of Social Media de la empresa descrita a continuación. Tu objetivo es crear contenido de alto impacto para publicaciones en redes sociales (Facebook e Instagram).

IDENTIDAD DE MARCA:
- Empresa: {companyName || "No especificada"}
- Industria: {industry || "No especificada"}
- Misión: {mission || "No especificada"}
- Visión: {vision || "No especificada"}
- Productos/Servicios: {products || "No especificados"}
- Historia: {history || "No especificada"}
- Guía de estilo: {styleGuide || "No especificada"}
- Público objetivo: {targetAudience || "No especificado"}
- Tono de comunicación: {tone || "Profesional"}

REGLAS ESTRICTAS DE REDACCIÓN:
1. Independientemente de si las ideas u objetivos proporcionados por el usuario son vagos, cortos, mal redactados o de baja calidad, tú debes asumir el control creativo. Expande la idea de forma profesional, lógica y alineada a la marca. No pidas aclaraciones, asume la mejor intención y genera un copy brillante.
2. El caption debe tener entre 100 y 500 caracteres. Debe ser atractivo, directo y generar engagement.
3. Incluye emojis relevantes de forma moderada en el caption para aumentar el atractivo visual.
4. Los hashtags deben ser relevantes, una mezcla de populares y de nicho. Entre 5 y 15 hashtags.
5. El cta_text debe ser un texto corto y accionable (máximo 40 caracteres) como "Descubre más", "Compra ahora", etc.
6. Todo el contenido debe estar en español.
7. Respeta estrictamente el tono y la personalidad de la marca descrita arriba.
8. Adapta el contenido para que funcione tanto en Facebook como en Instagram.
```

**Nota:** Si el usuario no ha configurado su identidad de marca, se reemplaza toda la sección de identidad por: `"IDENTIDAD DE MARCA: No configurada. Usa un tono profesional y genérico."`

### 4.5 Datos de la identidad de marca (campos disponibles)

La identidad de marca se carga de la tabla `brand_identities` y puede incluir:

| Campo | Descripción |
|-------|-------------|
| `companyName` | Nombre de la empresa |
| `industry` | Industria o sector |
| `website` | Sitio web (no incluido en el prompt) |
| `whatsapp` | WhatsApp (no incluido en el prompt) |
| `mission` | Misión de la empresa |
| `vision` | Visión de la empresa |
| `products` | Productos o servicios que ofrece |
| `history` | Historia de la empresa |
| `styleGuide` | Guía de estilo de comunicación |
| `targetAudience` | Público objetivo general |
| `tone` | Tono de comunicación (ej: "Profesional", "Casual", "Formal") |
| `primaryColor` | Color primario de la marca (no incluido en prompt de posts) |
| `secondaryColor` | Color secundario (no incluido en prompt de posts) |
| `accentColor` | Color de acento (no incluido en prompt de posts) |
| `headingFont` | Tipografía de títulos (no incluida en prompt de posts) |
| `bodyFont` | Tipografía de cuerpo (no incluida en prompt de posts) |
| `logoUrl` | URL del logo (no incluida en prompt de posts) |
| `visualStyle` | Estilo visual (no incluido en prompt de posts) |

### 4.6 Input del usuario (lo que se envía como mensaje del usuario)

```
Idea: {idea del post proporcionada por el usuario}
Objetivo: {objetivo del post proporcionado por el usuario}
```

Si el usuario especificó un público objetivo específico para esta publicación (diferente al público general de la marca), se añade:

```
Público objetivo de esta publicación: {targetAudience}. Adapta el tono, vocabulario y enfoque del contenido para resonar con este público específico.
```

### 4.7 Structured Output Schema (JSON Schema estricto)

Este schema fuerza a OpenAI a devolver un JSON con la estructura exacta requerida. Se usa el modo `strict: true` de Structured Outputs:

```json
{
  "type": "json_schema",
  "name": "social_post_content",
  "schema": {
    "type": "object",
    "properties": {
      "caption": {
        "type": "string",
        "description": "Texto del post para redes sociales (100-500 caracteres), con emojis relevantes"
      },
      "hashtags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Lista de hashtags relevantes sin el símbolo # (5-15 hashtags)"
      },
      "cta_text": {
        "type": "string",
        "description": "Texto corto para el call-to-action (máximo 40 caracteres)"
      },
      "cta_url": {
        "type": "string",
        "description": "URL sugerida para el CTA basada en el contexto del post. Si no se puede determinar, usar '#'"
      }
    },
    "required": ["caption", "hashtags", "cta_text", "cta_url"],
    "additionalProperties": false
  },
  "strict": true
}
```

### 4.8 Payload completo enviado a la API de OpenAI

```json
{
  "model": "gpt-4.1-mini",
  "instructions": "{system prompt con identidad de marca}",
  "input": "Idea: {idea}\nObjetivo: {objetivo}\nPúblico objetivo de esta publicación: {targetAudience}...",
  "text": {
    "format": {
      "type": "json_schema",
      "name": "social_post_content",
      "schema": { "..." },
      "strict": true
    }
  },
  "max_output_tokens": 800,
  "temperature": 0.7,
  "store": false
}
```

### 4.9 Respuesta esperada de OpenAI

```json
{
  "caption": "🚀 ¡Transforma tu negocio con nuestra nueva herramienta digital! Descubre cómo automatizar tu marketing y llegar a más clientes sin esfuerzo. La revolución está aquí y es para ti 💪✨",
  "hashtags": ["marketing", "digital", "automatización", "negocios", "emprendimiento", "redes", "crecimiento", "innovación", "pymes", "tecnología"],
  "cta_text": "Descubre más",
  "cta_url": "https://ejemplo.com/producto"
}
```

### 4.10 Resultado para el usuario

El usuario ve en el editor de post:
- El **caption** completo con emojis, listo para publicar
- Los **hashtags** formateados (se les agrega el símbolo # al mostrarlos)
- El **CTA** como botón o enlace sugerido
- La capacidad de editar cualquier campo manualmente o regenerar con correcciones

### 4.11 Flujo completo en el servidor

1. Se recibe la petición `POST /api/posts/:id/generate`
2. Se verifica que OpenAI y Gemini estén configurados para el usuario
3. Se envía progreso por WebSocket: `"Generando contenido..."`
4. Se carga la identidad de marca del usuario desde la BD
5. Se construye el system prompt con la marca
6. Se envía la petición a OpenAI con Structured Outputs
7. Se parsea la respuesta JSON
8. Se envía progreso: `"Contenido generado."`
9. Luego se genera la imagen con Gemini (ver documento de Gemini)
10. Se crea una versión del post (version 1, tipo "initial")
11. Se actualiza el estado del post a "generated"
12. Se envía progreso: `"Generación completada."`
13. Se devuelve el post actualizado, la versión y el contenido

---

## 5. Funcionalidad B: Regeneración de Contenido con Correcciones

### 5.1 ¿Qué hace?

Permite al usuario solicitar una reescritura completa del contenido de un post ya generado, proporcionando instrucciones específicas de corrección. La IA usa la conversación previa como contexto para generar contenido sustancialmente diferente.

### 5.2 ¿Qué problema resuelve?

Cuando el contenido generado no cumple las expectativas del usuario, en lugar de empezar desde cero, el usuario puede indicar qué cambiar (tono, enfoque, longitud, emojis, estilo) y la IA reescribe todo el contenido de forma coherente.

### 5.3 Endpoint del backend

```
POST /api/posts/:id/regenerate-text
```

**Payload del frontend:**
```json
{
  "corrections": "Hazlo más casual y con más emojis. Enfócate en el precio.",
  "previousContent": {
    "caption": "...",
    "hashtags": ["..."],
    "cta_text": "...",
    "cta_url": "..."
  }
}
```

### 5.4 Estructura de la conversación multi-turno

La regeneración utiliza un formato de conversación multi-turno para que OpenAI tenga el contexto completo:

**Mensaje 1 — Usuario (contexto original):**
```
Idea: {idea original del post}
Objetivo: {objetivo original del post}
Público objetivo de esta publicación: {targetAudience}. Adapta el tono, vocabulario y enfoque del contenido para resonar con este público específico.
```

**Mensaje 2 — Asistente (contenido previo):**
```json
{
  "caption": "{caption previo}",
  "hashtags": ["{hashtags previos}"],
  "cta_text": "{cta previo}",
  "cta_url": "{url previa}"
}
```

**Mensaje 3 — Usuario (instrucción de corrección):**
```
INSTRUCCIÓN: Reescribe COMPLETAMENTE el contenido de la publicación basándote en las siguientes instrucciones del usuario. NO hagas cambios mínimos ni conservadores. Si el usuario pide cambiar el tono, REESCRIBE TODO el contenido en ese tono desde cero. Si pide agregar emojis, inclúyelos generosamente. Si pide un enfoque diferente, cambia la estructura y el contenido por completo. El resultado debe ser un contenido SUSTANCIALMENTE DIFERENTE al anterior, reflejando fielmente lo que pide el usuario. Mantén el formato JSON original.

Instrucciones del usuario: {correcciones del usuario}
```

### 5.5 Payload completo enviado a OpenAI

```json
{
  "model": "gpt-4.1-mini",
  "instructions": "{system prompt con identidad de marca — mismo que en generación}",
  "input": [
    {
      "role": "user",
      "content": "Idea: {idea}\nObjetivo: {objetivo}"
    },
    {
      "role": "assistant",
      "content": "{JSON del contenido previo}"
    },
    {
      "role": "user",
      "content": "INSTRUCCIÓN: Reescribe COMPLETAMENTE el contenido... Instrucciones del usuario: {correcciones}"
    }
  ],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "social_post_content",
      "schema": { "..." },
      "strict": true
    }
  },
  "max_output_tokens": 800,
  "temperature": 0.7,
  "store": false
}
```

### 5.6 Respuesta esperada

Mismo formato JSON que la generación inicial:

```json
{
  "caption": "{nuevo caption sustancialmente diferente}",
  "hashtags": ["{nuevos hashtags}"],
  "cta_text": "{nuevo CTA}",
  "cta_url": "{nueva URL}"
}
```

### 5.7 Resultado para el usuario

- Se crea una nueva versión del texto (tipo `"text_regen"`)
- El contador de regeneraciones de texto (`textRegenCount`) se incrementa
- El editor muestra el nuevo contenido con la posibilidad de seguir refinando
- Las versiones anteriores se mantienen en el historial de versiones

### 5.8 Flujo en el servidor

1. Se recibe `POST /api/posts/:id/regenerate-text` con `corrections` y `previousContent`
2. Se envía progreso por WebSocket: `"Regenerando texto..."`
3. Se carga la identidad de marca
4. Se construye la conversación multi-turno (3 mensajes)
5. Se envía a OpenAI con Structured Outputs
6. Se incrementa `textRegenCount` en el post
7. Se deseleccionan versiones de texto anteriores
8. Se crea nueva versión de tipo `"text_regen"` marcada como seleccionada
9. Se envía progreso: `"Texto regenerado."`
10. Se devuelve la nueva versión y el contenido

---

## 6. Funcionalidad C: Generación de Plantillas Reutilizables

### 6.1 ¿Qué hace?

Genera plantillas de publicación reutilizables con marcadores/placeholders que el usuario puede rellenar con datos específicos cada vez que crea un post. La plantilla incluye un texto base con variables como `{{producto}}`, `{{beneficio}}`, `{{precio}}`.

### 6.2 ¿Qué problema resuelve?

Empresas que publican contenido recurrente (promociones, tips, anuncios) no necesitan generar desde cero cada vez. Las plantillas les permiten tener estructuras pre-definidas con el tono de la marca, solo rellenando los datos específicos.

### 6.3 Endpoint del backend

```
POST /api/templates/generate
```

**Payload del frontend:**
```json
{
  "topic": "Promoción de producto",
  "style": "casual y juvenil"
}
```

### 6.4 System Prompt completo (literal)

```
Eres un experto en marketing de redes sociales. Genera una plantilla reutilizable para publicaciones de Facebook e Instagram.
Responde SOLO con un JSON válido con la siguiente estructura:
{
  "name": "Nombre corto de la plantilla",
  "description": "Descripción breve de cuándo usar esta plantilla",
  "captionTemplate": "Texto de la publicación con marcadores como {{producto}}, {{beneficio}}, {{precio}}. Incluye emojis y llamada a la acción.",
  "hashtagSuggestions": "Lista de hashtags recomendados separados por espacios",
  "imageStyle": "Descripción del estilo visual recomendado para la imagen"
}
```

Si el usuario tiene identidad de marca configurada, se añade al final del system prompt:

```
Identidad de marca: Nombre: {companyName || "N/A"}, Tono: {tone || "profesional"}, Colores: {primaryColor, secondaryColor, accentColor || "N/A"}.
```

### 6.5 Input del usuario

```
Tema: {topic}
Estilo deseado: {style}
```

### 6.6 Payload completo enviado a OpenAI

```json
{
  "model": "gpt-4.1-mini",
  "instructions": "{system prompt de plantillas + identidad de marca}",
  "input": "Tema: {topic}\nEstilo deseado: {style}",
  "temperature": 0.8
}
```

**Nota:** A diferencia de la generación de posts, las plantillas **no usan Structured Outputs** (`strict: true`). En su lugar, se usa un prompt que indica "Responde SOLO con un JSON válido" y luego se extrae el JSON de la respuesta con una expresión regular (`text.match(/\{[\s\S]*\}/)`). La temperatura es 0.8 (más alta que los posts) para favorecer la creatividad.

### 6.7 Respuesta esperada de OpenAI

```json
{
  "name": "Promo Flash",
  "description": "Ideal para promociones de productos con descuento por tiempo limitado",
  "captionTemplate": "🔥 ¡Oferta imperdible! {{producto}} ahora con {{descuento}}% de descuento 🎉\n\n✅ {{beneficio}}\n💰 Antes: ${{precioAnterior}} → Ahora: ${{precio}}\n\n⏰ Válido hasta {{fechaLímite}}\n\n👉 {{cta}}",
  "hashtagSuggestions": "#oferta #descuento #promo #compraahora #ahorra #oportunidad #tiendaonline",
  "imageStyle": "Fondo vibrante con colores cálidos, producto centrado, texto grande con el porcentaje de descuento, sensación de urgencia"
}
```

### 6.8 Resultado para el usuario

- Se crea una nueva plantilla en la BD marcada como `isAiGenerated: true` e `isConfirmed: false`
- El usuario ve la plantilla en estado "pendiente de confirmación"
- Puede confirmar la plantilla, regenerarla con variaciones, o descartarla
- Las plantillas confirmadas aparecen en el selector de plantillas al crear posts

### 6.9 Regeneración de plantillas

Existe también un endpoint para regenerar una plantilla existente:

```
POST /api/templates/:id/regenerate
```

Este endpoint:
- Reutiliza la misma función `generateTemplateContent()` con topic y style
- Crea una nueva plantilla vinculada a la original (`parentTemplateId`)
- Incrementa el `versionNumber` y `aiEditCount`
- La plantilla regenerada queda sin confirmar hasta que el usuario la apruebe

---

## 7. Mecanismos de Resiliencia y Manejo de Errores

### 7.1 Reintentos automáticos

La función `callOpenAI` implementa reintentos automáticos:
- **Máximo de reintentos:** 1 (2 intentos en total)
- **Condición de reintento:** Si la respuesta tiene `status: "incomplete"`
- **Comportamiento:** Tras agotar reintentos con respuesta incompleta, se intenta parsear lo que haya devuelto

### 7.2 Detección de rechazos (Refusals)

Antes de parsear la respuesta, se verifica si OpenAI rechazó la solicitud por políticas de contenido:
- Se busca en `response.output` un item de tipo `"message"` con contenido de tipo `"refusal"`
- Si se detecta, se lanza un error explicativo al usuario

### 7.3 Manejo de errores HTTP

| Código HTTP | Error mostrado al usuario |
|-------------|--------------------------|
| 401 | "API key de OpenAI inválida. Verifique la configuración." |
| 429 | "Límite de solicitudes de OpenAI alcanzado. Intente de nuevo en unos minutos." |
| 400 + content_policy | "El contenido fue rechazado por las políticas de OpenAI. Intente con una idea diferente." |
| 500 / 503 | "Los servidores de OpenAI no están disponibles en este momento. Intente de nuevo más tarde." |
| ETIMEDOUT / ECONNABORTED / 408 | "La solicitud a OpenAI tardó demasiado. Intente de nuevo." |

### 7.4 Validación de respuesta

Después de parsear el JSON, se valida que contenga los campos requeridos:
- `caption` debe existir y no estar vacío
- `hashtags` debe existir y ser un array
- Si `cta_url` falta, se establece como `"#"`
- Si `cta_text` falta, se establece como `"Ver más"`

### 7.5 Progreso en tiempo real (WebSocket)

Durante la generación, el servidor envía mensajes de progreso por WebSocket al frontend:

| Paso | Mensaje |
|------|---------|
| Inicio de texto | `"Generando contenido..."` |
| Texto completado | `"Contenido generado."` |
| Inicio de imagen | `"Generando imagen..."` |
| Imagen completada | `"Imagen generada."` |
| Todo completado | `"Generación completada."` |
| Error | `"{mensaje del error}"` |

---

## 8. Variables de Entorno Requeridas

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `OPENAI_API_KEY` | No* | Clave global de OpenAI (respaldo si el usuario no configura la suya) |
| `SESSION_SECRET` | Sí | Secreto para firmar sesiones y derivar clave de encriptación de claves API de usuarios |
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL |

*Al menos una clave (global o del usuario) es necesaria para que las funcionalidades de IA textual funcionen.

---

## 9. Resumen de Funcionalidades

| Funcionalidad | Endpoint | Modelo | Temperatura | Structured Output | System Prompt |
|---------------|----------|--------|-------------|-------------------|---------------|
| Generar contenido de post | `POST /api/posts/:id/generate` | gpt-4.1-mini | 0.7 | Sí (strict) | Head of Social Media + Marca |
| Regenerar texto con correcciones | `POST /api/posts/:id/regenerate-text` | gpt-4.1-mini | 0.7 | Sí (strict) | Head of Social Media + Marca |
| Generar plantilla reutilizable | `POST /api/templates/generate` | gpt-4.1-mini | 0.8 | No (regex JSON) | Experto en marketing + Marca |
| Regenerar plantilla | `POST /api/templates/:id/regenerate` | gpt-4.1-mini | 0.8 | No (regex JSON) | Experto en marketing + Marca |

---

## 10. Preguntas para Auditoría

1. ¿El system prompt de generación de posts es suficientemente específico para producir contenido de alta calidad consistentemente?
2. ¿La instrucción de regeneración ("REESCRIBE COMPLETAMENTE") logra variaciones sustanciales o tiende a producir cambios cosméticos?
3. ¿La temperatura de 0.7 para posts y 0.8 para plantillas es apropiada para el balance entre creatividad y coherencia?
4. ¿El schema de Structured Outputs cubre todas las necesidades o debería incluir campos adicionales?
5. ¿La estrategia de un solo reintento para respuestas incompletas es suficiente?
6. ¿El enfoque de no usar Structured Outputs para plantillas (usando regex) es robusto o debería migrarse a strict mode?
7. ¿Los hashtags deberían incluir el símbolo # en la respuesta de la IA o está bien agregarlos en el frontend?
8. ¿El manejo de la identidad de marca en el prompt es óptimo o se pierde contexto relevante (colores, tipografías, logo)?
