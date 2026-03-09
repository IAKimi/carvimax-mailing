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
    },
    required: ["asunto", "preheader", "cuerpo_html", "cta_text"],
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

export async function generateEmailContent(
  idea: string,
  objective: string,
  brandIdentity: BrandIdentityData | null
): Promise<EmailContent> {
  const client = getClient();
  const instructions = buildInstructions(brandIdentity);
  const userInput = `Idea: ${idea}\nObjetivo: ${objective}`;

  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      instructions,
      input: userInput,
      text: {
        format: emailSchema,
      },
      max_output_tokens: 800,
      temperature: 0.7,
      store: false,
    });

    const outputText = response.output_text;
    if (!outputText) {
      throw new Error("OpenAI no devolvió contenido de texto.");
    }

    const parsed: EmailContent = JSON.parse(outputText);

    if (!parsed.asunto || !parsed.cuerpo_html || !parsed.cta_text) {
      throw new Error("La respuesta de OpenAI no contiene todos los campos requeridos.");
    }

    return parsed;
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
    const response = await client.responses.create({
      model: "gpt-5-mini",
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
      text: {
        format: emailSchema,
      },
      max_output_tokens: 800,
      temperature: 0.7,
      store: false,
    });

    const outputText = response.output_text;
    if (!outputText) {
      throw new Error("OpenAI no devolvió contenido de texto.");
    }

    const parsed: EmailContent = JSON.parse(outputText);

    if (!parsed.asunto || !parsed.cuerpo_html || !parsed.cta_text) {
      throw new Error("La respuesta de OpenAI no contiene todos los campos requeridos tras la corrección.");
    }

    return parsed;
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
