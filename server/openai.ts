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
- Misión: ${brand.mission || "No especificada"}
- Visión: ${brand.vision || "No especificada"}
- Productos/Servicios: ${brand.products || "No especificados"}
- Historia: ${brand.history || "No especificada"}
- Guía de estilo: ${brand.styleGuide || "No especificada"}
- Público objetivo: ${brand.targetAudience || "No especificado"}
- Tono de comunicación: ${brand.tone || "Profesional"}
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
7. El cta_text debe ser un texto corto y accionable para el botón principal del correo (máximo 40 caracteres).
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
  targetAudience?: string | null,
  lockedFields?: string[]
): Promise<EmailContent> {
  const client = getClient();
  let instructions = buildInstructions(brandIdentity);
  
  if (lockedFields && lockedFields.length > 0) {
    const lockedDescriptions: string[] = [];
    if (lockedFields.includes("cta") || lockedFields.includes("cta_url")) {
      lockedDescriptions.push("El botón CTA (cta_text y cta_url) ya existe en la plantilla del usuario. Genera valores genéricos cortos para estos campos ya que no se usarán.");
    }
    if (lockedFields.includes("imagen")) {
      lockedDescriptions.push("La imagen ya existe en la plantilla del usuario.");
    }
    instructions += `\n\nIMPORTANTE — CAMPOS FIJOS DE LA PLANTILLA:\nLa plantilla del usuario ya contiene ciertos elementos fijos. ${lockedDescriptions.join(" ")} Concentra tu creatividad en el asunto, preheader y cuerpo del correo.`;
  }

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
  targetAudience?: string | null,
  lockedFields?: string[]
): Promise<EmailContent> {
  const client = getClient();
  let instructions = buildInstructions(brandIdentity);
  
  if (lockedFields && lockedFields.length > 0) {
    const lockedDescriptions: string[] = [];
    if (lockedFields.includes("cta") || lockedFields.includes("cta_url")) {
      lockedDescriptions.push("El botón CTA ya existe en la plantilla. Genera valores genéricos para cta_text y cta_url.");
    }
    instructions += `\n\nCAMPOS FIJOS DE LA PLANTILLA: ${lockedDescriptions.join(" ")} Concentra tu creatividad en asunto, preheader y cuerpo.`;
  }

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
          content: `INSTRUCCIÓN: Reescribe COMPLETAMENTE el correo electrónico basándote en las siguientes instrucciones del usuario. NO hagas cambios mínimos ni conservadores. Si el usuario pide cambiar el tono, REESCRIBE TODO el correo en ese tono desde cero. Si pide agregar emojis, inclúyelos generosamente. Si pide un enfoque diferente, cambia la estructura y el contenido por completo. El resultado debe ser un correo SUSTANCIALMENTE DIFERENTE al anterior, reflejando fielmente lo que pide el usuario. Mantén el formato JSON original.\n\nInstrucciones del usuario: ${userCorrections}`,
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

function buildBaseTemplateHtml(brand: BrandIdentityData | null): string {
  const primaryColor = brand?.primaryColor || "#002073";
  const secondaryColor = brand?.secondaryColor || "#e3001b";
  const headingFont = brand?.headingFont || "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif";
  const bodyFont = brand?.bodyFont || "'Poppins', 'Helvetica Neue', Arial, sans-serif";

  const logoUrl = brand?.logoUrl && !brand.logoUrl.startsWith("data:") ? brand.logoUrl : null;
  const logoPlaceholder = logoUrl || "{{LOGO_URL}}";
  const companyName = brand?.companyName || "Logo";

  const headerContent = logoUrl || brand?.logoUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="120" valign="middle" style="padding-right:15px;">
                  <img src="${logoPlaceholder}" alt="${companyName}" width="120" style="display:block;border:0;" />
                </td>
                <td align="center" valign="middle" style="font-family:${headingFont}; font-size:24px; line-height:32px; font-weight:700; color:#ffffff;">
                  {{ASUNTO}}
                </td>
                <td width="120"></td>
              </tr>
            </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="font-family:${headingFont}; font-size:28px; line-height:36px; font-weight:700; color:#ffffff;">
                  {{ASUNTO}}
                </td>
              </tr>
            </table>`;

  const footerParts: string[] = [];
  if (brand?.whatsapp) footerParts.push(`WhatsApp: ${brand.whatsapp}`);
  if (brand?.website) footerParts.push(`<a href="${brand.website}" target="_blank" style="color:${primaryColor}; text-decoration:none;">${brand.website.replace(/^https?:\/\//, '')}</a>`);
  const footerContact = footerParts.length > 0
    ? `<div>Contacto: ${footerParts.join(" | ")}</div>`
    : "";

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ASUNTO}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:${bodyFont};">
<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>
<table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6fb" style="padding:20px 0;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- BLOQUE 1: Header/Banner con logo y asunto -->
        <tr>
          <td bgcolor="${primaryColor}" style="padding:20px;">
            ${headerContent}
          </td>
        </tr>
        <!-- BLOQUE 2: Imagen hero -->
        <tr>
          <td style="padding:20px; background:#ffffff;">
            <img src="{{IMAGEN_URL}}" alt="Imagen del correo" width="600" style="display:block;border:0;width:100%;max-width:600px;border-radius:16px;" />
          </td>
        </tr>
        <!-- BLOQUE 3: Contenido principal -->
        <tr>
          <td style="padding:20px 30px; font-family:${bodyFont}; font-size:16px; line-height:24px; color:#333333; background:#ffffff;">
            {{CONTENIDO}}
          </td>
        </tr>
        <!-- BLOQUE 4: Botón CTA -->
        <tr>
          <td align="center" style="padding:0 30px 30px 30px; background:#ffffff;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{CTA_URL}}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="${secondaryColor}" fillcolor="${secondaryColor}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:${headingFont};font-size:16px;font-weight:bold;">{{CTA_TEXTO}}</center>
            </v:roundrect>
            <![endif]-->
            <a href="{{CTA_URL}}" target="_blank" style="background-color:${secondaryColor}; border-radius:12px; color:#ffffff; display:inline-block; font-family:${headingFont}; font-size:16px; font-weight:700; line-height:48px; text-align:center; text-decoration:none; width:240px; -webkit-text-size-adjust:none; mso-hide:all;">
              {{CTA_TEXTO}}
            </a>
          </td>
        </tr>
        <!-- BLOQUE 5: Footer -->
        <tr>
          <td style="padding:20px 30px; font-family:${bodyFont}; font-size:12px; line-height:18px; color:#555555; background:#f9f9f9; border-top:1px solid #dddddd; text-align:center; border-radius:0 0 16px 16px;">
            ${footerContact}
            <div style="padding-top:8px;">
              <a href="{{UNSUBSCRIBE_LINK}}" target="_blank" style="color:#777777; text-decoration:underline;"></a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
}

function buildTemplateInstructions(brand: BrandIdentityData | null): string {
  const primaryColor = brand?.primaryColor || "#002073";
  const secondaryColor = brand?.secondaryColor || "#e3001b";
  const accentColor = brand?.accentColor || "#f59e0b";
  const headingFont = brand?.headingFont || "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif";
  const bodyFont = brand?.bodyFont || "'Poppins', 'Helvetica Neue', Arial, sans-serif";

  const baseHtml = buildBaseTemplateHtml(brand);

  const brandContext = brand
    ? `
IDENTIDAD VISUAL DEL USUARIO:
- Empresa: ${brand.companyName || "No especificada"}
- Industria: ${brand.industry || "No especificada"}
- Productos/Servicios: ${brand.products || "No especificados"}
- Color primario: ${primaryColor}
- Color secundario: ${secondaryColor}
- Color de acento: ${accentColor}
- Fuente de títulos: ${headingFont}
- Fuente de cuerpo: ${bodyFont}
- Logo: ${brand.logoUrl ? "Configurado" : "No configurado"}
- Sitio web: ${brand.website || "No configurado"}
- WhatsApp: ${brand.whatsapp || "No configurado"}
`
    : "IDENTIDAD VISUAL: No configurada. Usa colores corporativos genéricos profesionales.";

  return `Eres un diseñador senior experto en plantillas HTML de email marketing con 15 años de experiencia en compatibilidad cross-client (Gmail, Outlook, Apple Mail, Yahoo).

${brandContext}

PLANTILLA HTML BASE (ESTRUCTURA INMUTABLE):
A continuación se te proporciona la plantilla HTML base que DEBES usar como fundamento. La estructura de bloques es FIJA e INMUTABLE. Tu trabajo es ADAPTAR esta plantilla según las preferencias cosméticas del usuario, SIN alterar el orden ni la posición de los bloques.

\`\`\`html
${baseHtml}
\`\`\`

ESTRUCTURA DE BLOQUES FIJA (NUNCA cambiar el orden):
1. BLOQUE 1 — HEADER/BANNER: Fondo del color primario. Logo en esquina superior izquierda + {{ASUNTO}} centrado. Este bloque SIEMPRE va primero.
2. BLOQUE 2 — IMAGEN HERO: {{IMAGEN_URL}} siempre va DESPUÉS del header y ANTES del contenido.
3. BLOQUE 3 — CONTENIDO: {{CONTENIDO}} siempre va DESPUÉS de la imagen.
4. BLOQUE 4 — BOTÓN CTA: {{CTA_TEXTO}} y {{CTA_URL}} siempre van DESPUÉS del contenido.
5. BLOQUE 5 — FOOTER: Datos de contacto y enlace de cancelación. Siempre al final.

⚠️ REGLAS CRÍTICAS DE ESTRUCTURA:
- NUNCA cambies el orden de los 5 bloques. El orden siempre es: Header → Imagen → Contenido → CTA → Footer.
- NUNCA muevas la imagen después del contenido ni el CTA antes del contenido.
- NUNCA elimines ningún bloque.
- El {{ASUNTO}} SIEMPRE debe aparecer centrado en el banner del header.
- El logo SIEMPRE debe estar en la esquina superior izquierda del header (si está configurado).

QUÉ PUEDE PERSONALIZAR EL USUARIO (a través de su prompt):
- Colores de texto, fondos de secciones, bordes
- Estilos de fuente (negrita, tamaño, cursiva)
- Formato del contenido (tablas, listas, relieves, secciones internas)
- Dimensiones y alineación de la imagen (centrada, full-width, con márgenes, bordes redondeados)
- Estilo del botón CTA (colores, bordes, tamaño)
- Añadir elementos decorativos DENTRO de los bloques existentes (separadores, íconos, badges)
- Estilos del footer

QUÉ NO PUEDE PERSONALIZAR:
- El orden de los bloques (siempre Header → Imagen → Contenido → CTA → Footer)
- La posición del logo (siempre esquina superior izquierda del header)
- La posición del {{ASUNTO}} (siempre centrado en el header)
- Eliminar bloques obligatorios

SISTEMA DE PLACEHOLDERS OBLIGATORIOS (los 6 deben estar presentes):
1. {{ASUNTO}} — En <title> del <head> Y visible centrado en el header/banner.
2. {{PREHEADER}} — Primer elemento del <body>, en <span> oculto.
3. {{IMAGEN_URL}} — src="" de la imagen hero en el BLOQUE 2.
4. {{CONTENIDO}} — Bloque de texto principal en el BLOQUE 3. Ya viene en HTML, NO envolver en <p>.
5. {{CTA_TEXTO}} — Texto del botón en el BLOQUE 4.
6. {{CTA_URL}} — href="" del botón en el BLOQUE 4.

REGLAS TÉCNICAS DE HTML PARA EMAIL:
1. SOLO estilos inline (style="..."). Los clientes de email ignoran <style> y CSS externo.
2. Ancho máximo: max-width: 600px con width: 100% para responsive.
3. Layout con TABLAS HTML (<table>, <tr>, <td>).
4. Incluye MSO conditional comments para Outlook en botones.
5. Atributos bgcolor="" además de background-color en style.
6. Todas las imágenes con alt="", width="" explícito, y style="display:block;border:0;".
7. NUNCA uses linear-gradient, radial-gradient ni gradientes CSS.
8. NUNCA uses JavaScript ni event handlers.
9. Todo texto auxiliar o decorativo en español.
10. El nombre de la plantilla debe ser descriptivo y corto (máx 100 chars), en español.
11. Los placeholders deben quedar EXACTAMENTE como {{NOMBRE}} — nunca texto de ejemplo.
12. El botón CTA DEBE usar el patrón "bulletproof button" con bgcolor="" sólido.`;
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
      input: `Adapta la plantilla HTML base según estas preferencias del usuario. Recuerda: MANTÉN la estructura de bloques exactamente igual (Header→Imagen→Contenido→CTA→Footer). Solo personaliza aspectos cosméticos (colores, fuentes, estilos, formato del contenido, dimensiones de imagen) según lo que el usuario solicite:\n\n${prompt}`,
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
      instructions: instructions + `\n\nIMPORTANTE: Se te proporcionará un HTML de plantilla y las instrucciones del usuario para editarlo. DEBES mantener la estructura de bloques EXACTAMENTE igual (Header→Imagen→Contenido→CTA→Footer). Solo aplica cambios cosméticos: colores, fuentes, estilos de texto, formato del contenido, dimensiones de imagen. Si el usuario pide cambiar el orden de los bloques, IGNORA esa parte y mantén el orden original. Devuelve el HTML completo editado.`,
      input: [
        {
          role: "user" as const,
          content: `HTML original de la plantilla:\n\`\`\`html\n${originalHtml}\n\`\`\``,
        },
        {
          role: "user" as const,
          content: `Aplica los siguientes cambios cosméticos a la plantilla (sin alterar el orden de bloques Header→Imagen→Contenido→CTA→Footer):\n${userInstructions}`,
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

export interface TemplateAnalysisResult {
  html: string;
  lockedFields: string[];
}

export async function analyzeTemplatePlaceholders(
  originalHtml: string,
  brandIdentity: BrandIdentityData | null
): Promise<TemplateAnalysisResult> {
  const client = getClient();

  const analyzeSchema = {
    type: "json_schema" as const,
    name: "analyzed_template",
    schema: {
      type: "object",
      properties: {
        html: {
          type: "string",
          description: "HTML completo de la plantilla adaptada. Solo se insertan placeholders donde corresponde según el análisis.",
        },
        lockedFields: {
          type: "array",
          items: { type: "string" },
          description: "Lista de campos que YA existen en la plantilla original y NO deben ser modificados. Valores posibles: 'imagen', 'cta', 'cta_url', 'footer'",
        },
      },
      required: ["html", "lockedFields"],
      additionalProperties: false,
    },
    strict: true,
  };

  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `Eres un experto en plantillas HTML de email marketing. Tu tarea es analizar una plantilla HTML subida por un usuario, detectar qué elementos ya existen y SOLO insertar placeholders donde el contenido es realmente variable.

ANÁLISIS INTELIGENTE — Detecta qué elementos ya existen:
1. LOGO: Si la plantilla ya tiene una imagen de logo (usualmente en el header/banner), NO la toques. Agrégala a lockedFields como referencia pero no insertes placeholder.
2. IMAGEN HERO: Si ya hay una imagen principal/hero/banner con un src real (no placeholder), NO la reemplaces. Agrega "imagen" a lockedFields.
3. BOTÓN CTA: Si ya existe un botón de acción con texto real (ej: "Agendar reunión", "Comprar ahora"), NO reemplaces su texto ni su URL. Agrega "cta" y "cta_url" a lockedFields.
4. FOOTER: Si ya existe un pie de página con información de contacto, firma, enlaces, redes sociales, etc., NO lo modifiques. Agrega "footer" a lockedFields.
5. CONTENIDO VARIABLE: Identifica el bloque de texto principal que cambiaría entre campañas (ej: descripción de producto, mensaje promocional, párrafos informativos). SOLO en esta sección inserta {{CONTENIDO}}.

PLACEHOLDERS A INSERTAR (SOLO si no existen o son técnicos/invisibles):
- {{ASUNTO}} — SIEMPRE insertarlo dentro del tag <title> en el <head>. Si no hay <title>, agrégalo. Esto es invisible para el usuario.
- {{PREHEADER}} — SIEMPRE insertarlo como primer elemento dentro del <body>, en un <span> oculto:
  <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">{{PREHEADER}}</span>
  Esto también es invisible para el usuario.
- {{CONTENIDO}} — SOLO insertar si identificas texto variable que cambiaría entre campañas. Reemplaza ÚNICAMENTE ese bloque de texto.
- {{IMAGEN_URL}} — SOLO insertar si NO hay imagen hero real. Si la plantilla ya trae imagen, NO tocar.
- {{CTA_TEXTO}} — SOLO insertar si NO hay botón con texto real. Si el botón ya existe con texto, NO tocar.
- {{CTA_URL}} — SOLO insertar si NO hay URL real en el botón CTA. Si ya tiene URL, NO tocar.

REGLAS ESTRICTAS:
- NO cambies la estructura HTML, layout, tablas ni estilos CSS/inline.
- NO cambies colores, fuentes, márgenes ni ningún aspecto visual.
- NO elimines ni modifiques contenido existente que el usuario ya diseñó.
- Si la plantilla ya tiene algún placeholder ({{...}}), déjalo como está.
- Mantén todo el HTML original intacto excepto donde insertas {{CONTENIDO}}, {{ASUNTO}} y {{PREHEADER}}.
- El array lockedFields debe contener SOLO los campos que ya existen en la plantilla. Valores válidos: "imagen", "cta", "cta_url", "footer".`,
      input: `Analiza esta plantilla HTML. Detecta qué elementos ya existen (logo, imagen, botón, footer) y solo inserta placeholders donde el contenido es variable:\n\n\`\`\`html\n${originalHtml}\n\`\`\``,
      text: { format: analyzeSchema },
      max_output_tokens: 8000,
      temperature: 0.3,
      store: false,
    });

    const outputText = response.output_text;
    if (!outputText) throw new Error("OpenAI no devolvió contenido.");

    const parsed = JSON.parse(outputText) as { html: string; lockedFields: string[] };
    if (!parsed.html) throw new Error("La respuesta no contiene HTML analizado.");
    if (!Array.isArray(parsed.lockedFields)) parsed.lockedFields = [];
    
    const validFields = ["imagen", "cta", "cta_url", "footer"];
    parsed.lockedFields = parsed.lockedFields.filter(f => validFields.includes(f));
    
    return parsed;
  } catch (err: any) {
    handleOpenAIError(err);
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
