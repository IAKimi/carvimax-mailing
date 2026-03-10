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
  brandIdentity: BrandIdentityData | null
): Promise<EmailContent> {
  const client = getClient();
  const instructions = buildInstructions(brandIdentity);
  const userInput = `Idea: ${idea}\nObjetivo: ${objective}`;

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
  brandIdentity: BrandIdentityData | null
): Promise<EmailContent> {
  const client = getClient();
  const instructions = buildInstructions(brandIdentity);

  try {
    return await callOpenAI(client, {
      model: "gpt-4.1-mini",
      instructions,
      input: [
        {
          role: "user" as const,
          content: `Idea: ${originalIdea}\nObjetivo: ${originalObjective}`,
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

function buildTemplateInstructions(brand: BrandIdentityData | null): string {
  const brandContext = brand
    ? `
IDENTIDAD DE MARCA Y VISUAL:
- Empresa: ${brand.companyName || "No especificada"}
- Industria: ${brand.industry || "No especificada"}
- Productos/Servicios: ${brand.products || "No especificados"}
- Audiencia objetivo: ${brand.targetAudience || "No especificada"}
- Guía de estilo: ${brand.styleGuide || "No especificada"}
- Color primario: ${brand.primaryColor || "#002073"}
- Color secundario: ${brand.secondaryColor || "#e3001b"}
- Color de acento: ${brand.accentColor || "#f59e0b"}
- Fuente de títulos: ${brand.headingFont || "Arial, sans-serif"}
- Fuente de cuerpo: ${brand.bodyFont || "Arial, sans-serif"}
- Tono de comunicación: ${brand.tone || "Profesional"}
`
    : "IDENTIDAD DE MARCA: No configurada. Usa colores corporativos genéricos profesionales con fuentes Arial/Helvetica.";

  return `Eres un diseñador senior experto en plantillas HTML de email marketing con 15 años de experiencia en compatibilidad cross-client (Gmail, Outlook, Apple Mail, Yahoo).

${brandContext}

SISTEMA DE PLACEHOLDERS OBLIGATORIOS:
Tu plantilla DEBE incluir exactamente estos 6 placeholders. Son marcadores dinámicos que serán reemplazados programáticamente por el sistema. NUNCA uses texto real en su lugar — deben aparecer literalmente como se muestran aquí:

1. {{ASUNTO}} — Ubicación: dentro del tag <title> en el <head>. Es el asunto del correo.
2. {{PREHEADER}} — Ubicación: como primer elemento dentro del <body>, dentro de un <span> oculto:
   <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>
   Esta es la técnica estándar para controlar el texto de vista previa en la bandeja de entrada.
3. {{IMAGEN_URL}} — Ubicación: como valor del atributo src="" de la imagen hero/banner principal del correo. Ejemplo:
   <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="600" style="display:block;border:0;width:100%;max-width:600px;" />
4. {{CONTENIDO}} — Ubicación: como el bloque principal de texto dentro de un <td> de la tabla central. Este contenido ya viene en formato HTML (párrafos, negritas, etc.), así que NO lo envuelvas en tags <p> adicionales.
5. {{CTA_TEXTO}} — Ubicación: como texto visible dentro del botón principal de acción (<a> con estilo de botón).
6. {{CTA_URL}} — Ubicación: como valor del atributo href="" del mismo botón de acción.

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

export async function generateTemplateHtml(
  prompt: string,
  brandIdentity: BrandIdentityData | null
): Promise<TemplateContent> {
  const client = getClient();
  const instructions = buildTemplateInstructions(brandIdentity);

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions,
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

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
