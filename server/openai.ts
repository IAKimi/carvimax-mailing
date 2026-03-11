import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY no está configurada.");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface EmailContent {
  asunto: string;
  preheader: string;
  cuerpo_html: string;
  cta_text: string;
  cta_url: string;
}

interface BrandIdentityData {
  companyName?: string | null;
  industry?: string | null;
  website?: string | null;
  whatsapp?: string | null;
  mission?: string | null;
  vision?: string | null;
  products?: string | null;
  history?: string | null;
  styleGuide?: string | null;
  targetAudience?: string | null;
  tone?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  logoUrl?: string | null;
  visualStyle?: string | null;
}

function buildInstructions(brand: BrandIdentityData | null): string {
  const brandContext = brand
    ? `
IDENTIDAD DE MARCA:
- Empresa: ${brand.companyName || "No especificada"}
- Industria: ${brand.industry || "No especificada"}
- Sitio web: ${brand.website || "No especificado"}
- WhatsApp: ${brand.whatsapp || "No especificado"}
- Misión: ${brand.mission || "No especificada"}
- Visión: ${brand.vision || "No especificada"}
- Productos/Servicios: ${brand.products || "No especificados"}
- Historia: ${brand.history || "No especificada"}
- Guía de estilo: ${brand.styleGuide || "No especificada"}
- Público objetivo: ${brand.targetAudience || "No especificado"}
- Tono de comunicación: ${brand.tone || "Profesional"}
- Color primario: ${brand.primaryColor || "No especificado"}
- Color secundario: ${brand.secondaryColor || "No especificado"}
- Color de acento: ${brand.accentColor || "No especificado"}
- Fuente de títulos: ${brand.headingFont || "No especificada"}
- Fuente de cuerpo: ${brand.bodyFont || "No especificada"}
`
    : `
IDENTIDAD DE MARCA: No configurada. Usa un tono profesional y genérico.
`;

  return `Eres el Head of Copywriting de la empresa descrita a continuación. Tu objetivo es redactar un correo electrónico de alta conversión.
${brandContext}
REGLAS ESTRICTAS DE REDACCIÓN:
1. Independientemente de si las ideas u objetivos proporcionados por el usuario son vagos, cortos, mal redactados o de baja calidad, tú debes asumir el control creativo. Expande la idea de forma profesional, lógica y alineada a la marca. No pidas aclaraciones, asume la mejor intención y genera un copy brillante.
2. El contenido de cuerpo_html debe tener un máximo de 500 caracteres.
3. El cuerpo_html debe ser HTML limpio sin etiquetas <html>, <head> ni <body>. Solo contenido formateado con <p>, <strong>, <em>, <ul>, <li>, etc.
4. Escribe directo al punto, ve al grano. No incluyas introducciones, conclusiones ni texto conversacional.
5. El asunto debe ser persuasivo, corto (máximo 60 caracteres) y generar curiosidad.
6. El preheader debe complementar el asunto y enganchar al lector (máximo 100 caracteres).
7. El cta_text debe ser un texto corto y accionable para el botón principal del correo (máximo 25 caracteres).
8. Todo el contenido debe estar en español.
9. Respeta estrictamente el tono y la personalidad de la marca descrita arriba.`;
}

const emailSchema = {
  type: "json_schema" as const,
  name: "email_content",
  schema: {
    type: "object",
    properties: {
      asunto: {
        type: "string",
        description: "Asunto persuasivo del correo (máximo 60 caracteres)",
      },
      preheader: {
        type: "string",
        description: "Texto de preview enganchador (máximo 100 caracteres)",
      },
      cuerpo_html: {
        type: "string",
        description: "Contenido del correo en HTML limpio sin etiquetas html/head/body (máximo 500 caracteres)",
      },
      cta_text: {
        type: "string",
        description: "Texto corto para el botón principal (máximo 25 caracteres)",
      },
      cta_url: {
        type: "string",
        description: "URL sugerida para el botón CTA basada en el contexto de la campaña (ej: https://ejemplo.com/promo). Si no se puede determinar, usar '#'",
      },
    },
    required: ["asunto", "preheader", "cuerpo_html", "cta_text", "cta_url"],
    additionalProperties: false,
  },
  strict: true,
};

function handleOpenAIError(err: any): never {
  if (err.status === 401) {
    throw new Error("API key de OpenAI inválida. Verifique la configuración.");
  }
  if (err.status === 429) {
    throw new Error("Límite de solicitudes de OpenAI alcanzado. Intente de nuevo en unos minutos.");
  }
  if (err.status === 400 && err.message?.includes("content_policy")) {
    throw new Error("El contenido fue rechazado por las políticas de OpenAI. Intente con una idea diferente.");
  }
  if (err.status === 500 || err.status === 503) {
    throw new Error("Los servidores de OpenAI no están disponibles en este momento. Intente de nuevo más tarde.");
  }
  if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED" || err.status === 408) {
    throw new Error("La solicitud a OpenAI tardó demasiado. Intente de nuevo.");
  }
  throw err;
}

function parseEmailResponse(outputText: string | undefined | null): EmailContent {
  if (!outputText) {
    throw new Error("OpenAI no devolvió contenido de texto.");
  }

  let parsed: EmailContent;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("La respuesta de OpenAI no es JSON válido.");
  }

  if (!parsed.asunto || !parsed.preheader || !parsed.cuerpo_html || !parsed.cta_text) {
    throw new Error("La respuesta de OpenAI no contiene todos los campos requeridos.");
  }

  if (!parsed.cta_url) {
    parsed.cta_url = "#";
  }

  return parsed;
}

async function callOpenAI(client: OpenAI, params: any, maxRetries = 1): Promise<EmailContent> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await client.responses.create(params);

    const refusalItem = response.output?.find(
      (item: any) => item.type === "message" && item.content?.some((c: any) => c.type === "refusal")
    );
    if (refusalItem) {
      const refusalText = (refusalItem as any).content?.find((c: any) => c.type === "refusal")?.refusal || "";
      console.warn("[OpenAI] Refusal detectado:", refusalText);
      throw new Error("La idea fue rechazada por las políticas de contenido de OpenAI. Intente con una idea diferente.");
    }

    if (response.status === "incomplete" && attempt < maxRetries) {
      console.warn(`[OpenAI] Respuesta incompleta (intento ${attempt + 1}), reintentando...`);
      continue;
    }

    if (response.status === "incomplete") {
      console.warn("[OpenAI] Respuesta incompleta tras reintentos — incomplete_details:", JSON.stringify(response.incomplete_details));
    }

    return parseEmailResponse(response.output_text);
  }

  throw new Error("OpenAI no completó la respuesta tras múltiples intentos.");
}

export async function generateEmailContent(
  idea: string,
  objective: string,
  brandIdentity: BrandIdentityData | null,
  targetAudience?: string | null
): Promise<EmailContent> {
  const client = getClient();
  const instructions = buildInstructions(brandIdentity);
  let userInput = `Idea: ${idea}\nObjetivo: ${objective}`;
  if (targetAudience) {
    userInput += `\nPúblico objetivo de esta campaña: ${targetAudience}. Adapta el tono, vocabulario y enfoque del contenido para resonar con este público específico.`;
  }

  try {
    return await callOpenAI(client, {
      model: "gpt-4.1-mini",
      instructions,
      input: userInput,
      text: { format: emailSchema },
      max_output_tokens: 800,
      temperature: 0.7,
      store: false,
    });
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export async function regenerateEmailContent(
  originalIdea: string,
  originalObjective: string,
  previousEmailJson: EmailContent,
  userCorrections: string,
  brandIdentity: BrandIdentityData | null,
  targetAudience?: string | null
): Promise<EmailContent> {
  const client = getClient();
  const instructions = buildInstructions(brandIdentity);
  let originalContext = `Idea: ${originalIdea}\nObjetivo: ${originalObjective}`;
  if (targetAudience) {
    originalContext += `\nPúblico objetivo de esta campaña: ${targetAudience}. Adapta el tono, vocabulario y enfoque del contenido para resonar con este público específico.`;
  }

  try {
    return await callOpenAI(client, {
      model: "gpt-4.1-mini",
      instructions,
      input: [
        {
          role: "user" as const,
          content: originalContext,
        },
        {
          role: "assistant" as const,
          content: JSON.stringify(previousEmailJson),
        },
        {
          role: "user" as const,
          content: `Por favor aplica las siguientes correcciones al correo generado y devuelve la propuesta ajustada respetando el formato JSON original:\nCorrecciones: ${userCorrections}`,
        },
      ],
      text: { format: emailSchema },
      max_output_tokens: 800,
      temperature: 0.7,
      store: false,
    });
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export interface TemplateContent {
  html: string;
  name: string;
}

const templateSchema = {
  type: "json_schema" as const,
  name: "template_content",
  schema: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description: "HTML completo de la plantilla de email con estilos inline, responsive, máximo 600px de ancho",
      },
      name: {
        type: "string",
        description: "Nombre corto y descriptivo para la plantilla (máximo 100 caracteres)",
      },
    },
    required: ["html", "name"],
    additionalProperties: false,
  },
  strict: true,
};

const editTemplateSchema = {
  type: "json_schema" as const,
  name: "edited_template",
  schema: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description: "HTML completo editado de la plantilla con los cambios solicitados aplicados",
      },
    },
    required: ["html"],
    additionalProperties: false,
  },
  strict: true,
};

const VISUAL_STYLE_PROMPTS: Record<string, string> = {
  minimalista: `ESTILO VISUAL — MINIMALISTA:
- Espacios en blanco generosos entre secciones (padding 40-60px)
- Máximo 2 colores (primario + blanco/gris claro)
- Sin sombras, sin gradientes, sin bordes decorativos
- Tipografía limpia y legible con tamaños grandes
- Separadores finos (1px) en color gris claro
- Botón CTA con diseño flat, sin sombras, bordes redondeados sutiles (4px)
- Imágenes sin bordes ni marcos`,

  corporativo: `ESTILO VISUAL — CORPORATIVO:
- Diseño estructurado y simétrico con líneas rectas
- Header con fondo del color primario de marca
- Secciones claramente delimitadas con bordes sutiles (1px solid)
- Tipografía serif o sans-serif profesional
- Paleta de colores sobria: primario + secundario + gris oscuro
- Botón CTA sólido, rectangular con esquinas apenas redondeadas (3px)
- Footer formal con datos de contacto bien organizados`,

  moderno: `ESTILO VISUAL — MODERNO:
- Bordes redondeados generosos (12-16px) en tarjetas y contenedores
- Sombras sutiles (box-shadow ligero) para dar profundidad
- Gradientes suaves en el header o el botón CTA
- Espaciado amplio y limpio entre elementos
- Uso estratégico del color de acento para destacar elementos
- Botón CTA con gradiente o sombra, bordes redondeados (8-12px)
- Transiciones visuales suaves entre secciones`,

  creativo: `ESTILO VISUAL — CREATIVO:
- Formas y layouts asimétricos cuando sea posible
- Uso audaz de los 3 colores de marca (primario, secundario, acento)
- Fondos con colores vibrantes en secciones alternas
- Tipografía expresiva con tamaños variados
- Elementos decorativos: íconos, separadores temáticos, badges
- Botón CTA grande y llamativo con color de acento
- Bordes redondeados grandes (16-24px)`,

  elegante: `ESTILO VISUAL — ELEGANTE:
- Paleta oscura o con tonos profundos del color primario
- Tipografía serif refinada para títulos, sans-serif para cuerpo
- Espaciado generoso, diseño aireado y sofisticado
- Líneas decorativas finas doradas o del color de acento
- Sombras muy sutiles, casi imperceptibles
- Botón CTA con borde fino y fondo transparente o sólido elegante
- Footer minimalista con separador fino`,
};

function buildTemplateInstructions(brand: BrandIdentityData | null): string {
  const primaryColor = brand?.primaryColor || "#002073";
  const secondaryColor = brand?.secondaryColor || "#e3001b";
  const accentColor = brand?.accentColor || "#f59e0b";
  const headingFont = brand?.headingFont || "Arial, sans-serif";
  const bodyFont = brand?.bodyFont || "Arial, sans-serif";
  const visualStyle = brand?.visualStyle || "moderno";

  const logoUrl = brand?.logoUrl && !brand.logoUrl.startsWith("data:") ? brand.logoUrl : null;
  const logoSection = logoUrl
    ? `- Logo de la empresa (URL): ${logoUrl}
- INSTRUCCIÓN DE LOGO: Incluir el logo como imagen en la ESQUINA SUPERIOR IZQUIERDA del header, debajo del titular y sobre el fondo de color del header. Usar <img src="${logoUrl}" alt="${brand.companyName || 'Logo'}" width="120" style="display:block;border:0;" />. El logo debe ser visible y estar alineado a la izquierda dentro de la tabla del header.`
    : brand?.logoUrl?.startsWith("data:")
      ? `- INSTRUCCIÓN DE LOGO: El usuario tiene un logo cargado. Incluir un placeholder {{LOGO_URL}} en la ESQUINA SUPERIOR IZQUIERDA del header como <img src="{{LOGO_URL}}" alt="${brand.companyName || 'Logo'}" width="120" style="display:block;border:0;" />. El logo debe estar alineado a la izquierda dentro de la tabla del header.`
      : "- Logo: No configurado. Usar solo el nombre de la empresa como texto en el header.";

  const footerContactSection = (() => {
    const parts: string[] = [];
    if (brand?.website) parts.push(`Sitio web: ${brand.website} (incluir como enlace clickeable)`);
    if (brand?.whatsapp) parts.push(`WhatsApp: ${brand.whatsapp} (incluir como texto visible)`);
    if (parts.length > 0) {
      return `\n- FOOTER CON DATOS DE CONTACTO: El footer DEBE incluir, además del enlace de cancelación de suscripción, una sección de contacto con: ${parts.join(" y ")}. Formatear de manera elegante con un texto como "Para más información:" o "Contáctanos:".`;
    }
    return "\n- FOOTER: Si no hay datos de contacto, la IA debe proponer una frase profesional de cierre coherente con el tono de la marca, además del enlace de cancelación de suscripción.";
  })();

  const brandContext = brand
    ? `
IDENTIDAD DE MARCA Y VISUAL:
- Empresa: ${brand.companyName || "No especificada"}
- Industria: ${brand.industry || "No especificada"}
- Misión: ${brand.mission || "No especificada"}
- Visión: ${brand.vision || "No especificada"}
- Historia: ${brand.history || "No especificada"}
- Audiencia objetivo: ${brand.targetAudience || "No especificada"}
- Tono de comunicación: ${brand.tone || "Profesional"}
- Color primario: ${primaryColor}
- Color secundario: ${secondaryColor}
- Color de acento: ${accentColor}
- Fuente de títulos: ${headingFont}
- Fuente de cuerpo: ${bodyFont}
${logoSection}
- Sitio web: ${brand.website || "No configurado"}
- WhatsApp: ${brand.whatsapp || "No configurado"}
`
    : "IDENTIDAD DE MARCA: No configurada. Usa colores corporativos genéricos profesionales con fuentes Arial/Helvetica.";

  const stylePrompt = VISUAL_STYLE_PROMPTS[visualStyle] || VISUAL_STYLE_PROMPTS["moderno"];

  return `Eres un diseñador senior experto en plantillas HTML de email marketing con 15 años de experiencia en compatibilidad cross-client (Gmail, Outlook, Apple Mail, Yahoo).

${brandContext}

${stylePrompt}

CALIDAD DE DISEÑO BASE (aplicar SIEMPRE además del estilo visual):
- Padding interno consistente en todas las celdas (mínimo 20px)
- Jerarquía visual clara: título > subtítulo > cuerpo > CTA
- Contraste adecuado entre texto y fondo (ratio mínimo 4.5:1)
- Imágenes con bordes redondeados cuando el estilo lo permita
- Separación visual clara entre secciones (espaciado o separadores)
- El botón CTA debe ser el elemento más prominente después de la imagen
- Colores de fondo alternos entre secciones para dar ritmo visual

SISTEMA DE PLACEHOLDERS OBLIGATORIOS (6 de 6 — TODOS son requeridos):
Tu plantilla DEBE incluir EXACTAMENTE estos 6 placeholders. Si falta CUALQUIERA de ellos, la plantilla será rechazada por el sistema. Son marcadores dinámicos que serán reemplazados programáticamente. NUNCA uses texto real en su lugar — deben aparecer literalmente como se muestran aquí:

1. {{ASUNTO}} — OBLIGATORIO. Ubicación: dentro del tag <title> en el <head>. Es el asunto del correo.
2. {{PREHEADER}} — OBLIGATORIO. Ubicación: como primer elemento dentro del <body>, dentro de un <span> oculto:
   <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>
3. {{IMAGEN_URL}} — OBLIGATORIO. Ubicación: como valor del atributo src="" de la imagen hero/banner principal del correo. Ejemplo:
   <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="600" style="display:block;border:0;width:100%;max-width:600px;" />
4. {{CONTENIDO}} — OBLIGATORIO. Ubicación: como el bloque principal de texto dentro de un <td> de la tabla central. Este contenido ya viene en formato HTML (párrafos, negritas, etc.), así que NO lo envuelvas en tags <p> adicionales.
5. {{CTA_TEXTO}} — OBLIGATORIO. Ubicación: como texto visible dentro del botón principal de acción (<a> con estilo de botón).
6. {{CTA_URL}} — OBLIGATORIO. Ubicación: como valor del atributo href="" del mismo botón de acción.

ESTRUCTURA VISUAL OBLIGATORIA (de arriba a abajo, en este orden EXACTO):
1. <head> con <title>{{ASUNTO}}</title>
2. <body> → preheader oculto con {{PREHEADER}}
3. Header con fondo del color primario: ${brand?.logoUrl ? "logo de la empresa en esquina superior izquierda" : "nombre de la empresa como texto"}
4. IMAGEN HERO/BANNER con {{IMAGEN_URL}} — SIEMPRE debe ir ANTES del contenido de texto
5. CONTENIDO principal con {{CONTENIDO}} — SIEMPRE DESPUÉS de la imagen
6. BOTÓN CTA con {{CTA_TEXTO}} y {{CTA_URL}} — DESPUÉS del contenido
7. Footer con datos de contacto (WhatsApp/sitio web si están disponibles) y enlace de cancelación de suscripción${footerContactSection}

⚠️ REGLA CRÍTICA: La imagen ({{IMAGEN_URL}}) NUNCA debe aparecer después del contenido ({{CONTENIDO}}) ni después del CTA. La imagen SIEMPRE va ARRIBA, como banner/hero, ANTES de cualquier texto del cuerpo del correo.

REGLAS TÉCNICAS DE HTML PARA EMAIL:
1. Estructura COMPLETA: <!DOCTYPE html>, <html lang="es">, <head> con meta charset y viewport, <body>.
2. SOLO estilos inline (style="..."). Los clientes de email ignoran <style>, CSS externo y clases.
3. Ancho máximo: max-width: 600px con width: 100% para responsive.
4. Layout con TABLAS HTML (<table>, <tr>, <td>) — es la única forma garantizada de layout en Outlook.
5. Incluye MSO conditional comments para Outlook donde sea necesario (botones, anchos fijos).
6. Atributos bgcolor="" además de background-color en style para máxima compatibilidad.
7. Todas las imágenes con atributo alt="", width="" explícito, y style="display:block;border:0;".
8. Font stacks seguros: usa la fuente de marca con fallbacks (ej: "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif").
9. Footer obligatorio con texto de cancelación de suscripción (placeholder).
10. Los colores DEBEN ser coherentes con la identidad de marca proporcionada.
11. Diseño limpio, moderno, profesional y visualmente atractivo.
12. Todo texto auxiliar o decorativo debe estar en español.
13. El nombre de la plantilla debe ser descriptivo y corto (máx 100 chars), en español.
14. NUNCA incluyas texto de ejemplo dentro de los placeholders. Los placeholders deben quedar EXACTAMENTE como {{NOMBRE}} para ser reemplazados por el sistema.
15. NO uses JavaScript ni event handlers (onclick, onmouseover, etc.).`;
}

const VARIANT_INSTRUCTIONS = [
  `ENFOQUE DE LAYOUT — VARIANTE A:
- Layout clásico centrado con imagen hero de ancho completo arriba
- Contenido en una sola columna, centrado
- CTA como botón prominente centrado debajo del texto
- Header con fondo sólido del color primario
- Espaciado generoso y simétrico
- Estilo visual limpio y directo`,

  `ENFOQUE DE LAYOUT — VARIANTE B:
- Layout más dinámico con secciones de fondo alterno (color/blanco)
- Imagen hero con bordes redondeados y margen lateral (no de ancho completo)
- CTA alineado a la izquierda o con diseño tipo tarjeta con borde
- Header minimalista con fondo blanco o transparente
- Uso de separadores visuales o líneas decorativas entre secciones
- Estructura más compacta con menos espaciado vertical`,
];

export async function generateTemplateHtml(
  prompt: string,
  brandIdentity: BrandIdentityData | null,
  variantIndex?: number
): Promise<TemplateContent> {
  const client = getClient();
  const instructions = buildTemplateInstructions(brandIdentity);
  const variantSuffix = variantIndex !== undefined && variantIndex < VARIANT_INSTRUCTIONS.length
    ? `\n\n${VARIANT_INSTRUCTIONS[variantIndex]}`
    : "";

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: instructions + variantSuffix,
      input: `Genera una plantilla HTML de email marketing basada en esta descripción:\n${prompt}`,
      text: { format: templateSchema },
      max_output_tokens: 4000,
      temperature: 0.7,
      store: false,
    });

    const outputText = response.output_text;
    if (!outputText) throw new Error("OpenAI no devolvió contenido.");

    const parsed = JSON.parse(outputText) as TemplateContent;
    if (!parsed.html || !parsed.name) {
      throw new Error("La respuesta de OpenAI no contiene los campos requeridos.");
    }
    return parsed;
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export async function editTemplateHtml(
  originalHtml: string,
  userInstructions: string,
  brandIdentity: BrandIdentityData | null
): Promise<string> {
  const client = getClient();
  const instructions = buildTemplateInstructions(brandIdentity);

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: instructions + `\n\nIMPORTANTE: Se te proporcionará un HTML original de plantilla y las instrucciones del usuario para editarlo. Debes mantener la estructura base y solo aplicar los cambios solicitados. Devuelve el HTML completo editado.`,
      input: [
        {
          role: "user" as const,
          content: `HTML original de la plantilla:\n\`\`\`html\n${originalHtml}\n\`\`\``,
        },
        {
          role: "user" as const,
          content: `Aplica los siguientes cambios a la plantilla:\n${userInstructions}`,
        },
      ],
      text: { format: editTemplateSchema },
      max_output_tokens: 4000,
      temperature: 0.7,
      store: false,
    });

    const outputText = response.output_text;
    if (!outputText) throw new Error("OpenAI no devolvió contenido.");

    const parsed = JSON.parse(outputText) as { html: string };
    if (!parsed.html) throw new Error("La respuesta no contiene HTML editado.");
    return parsed.html;
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export async function analyzeTemplatePlaceholders(
  originalHtml: string,
  brandIdentity: BrandIdentityData | null
): Promise<string> {
  const client = getClient();

  const analyzeSchema = {
    type: "json_schema" as const,
    name: "analyzed_template",
    schema: {
      type: "object",
      properties: {
        html: {
          type: "string",
          description: "HTML completo de la plantilla con los 6 placeholders insertados en las ubicaciones correctas",
        },
      },
      required: ["html"],
      additionalProperties: false,
    },
    strict: true,
  };

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `Eres un experto en plantillas HTML de email marketing. Tu ÚNICA tarea es analizar una plantilla HTML existente e insertar los 6 placeholders obligatorios en las ubicaciones correctas SIN cambiar la estructura, diseño, estilos ni contenido visual de la plantilla.

LOS 6 PLACEHOLDERS OBLIGATORIOS:
1. {{ASUNTO}} — Debe ir dentro del tag <title> en el <head>. Si no hay <title>, agrégalo.
2. {{PREHEADER}} — Debe ir como primer elemento dentro del <body>, en un <span> oculto:
   <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>
3. {{IMAGEN_URL}} — Debe reemplazar el src="" de la imagen principal/hero/banner del correo. Si no hay imagen hero, agrega una antes del contenido principal.
4. {{CONTENIDO}} — Debe reemplazar el bloque principal de texto/contenido del correo. Identifica el área de contenido principal y reemplázala.
5. {{CTA_TEXTO}} — Debe reemplazar el texto del botón principal de acción (CTA). Si no hay botón, agrega uno después del contenido.
6. {{CTA_URL}} — Debe reemplazar el href="" del botón CTA.

REGLAS ESTRICTAS:
- NO cambies la estructura HTML, layout, tablas ni estilos CSS/inline.
- NO cambies colores, fuentes, márgenes ni ningún aspecto visual.
- SOLO inserta/reemplaza los placeholders en las ubicaciones correctas.
- Si la plantilla ya tiene algún placeholder, déjalo como está.
- Si falta algún elemento estructural (como <title>, imagen hero, o botón CTA), agrégalo de forma mínima y coherente con el diseño existente.
- Mantén todo el HTML original intacto excepto donde se insertan los placeholders.`,
      input: `Analiza esta plantilla HTML e inserta los 6 placeholders obligatorios en las ubicaciones correctas:\n\n\`\`\`html\n${originalHtml}\n\`\`\``,
      text: { format: analyzeSchema },
      max_output_tokens: 4000,
      temperature: 0.3,
      store: false,
    });

    const outputText = response.output_text;
    if (!outputText) throw new Error("OpenAI no devolvió contenido.");

    const parsed = JSON.parse(outputText) as { html: string };
    if (!parsed.html) throw new Error("La respuesta no contiene HTML analizado.");
    return parsed.html;
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
