function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

interface SafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType: string;
          data: string;
        };
        text?: string;
      }>;
    };
    finishReason?: string;
    safetyRatings?: SafetyRating[];
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: SafetyRating[];
  };
  error?: {
    message: string;
    code: number;
  };
}

export async function generateImage(prompt: string, aspectRatio: string = "16:9"): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada. Configure la clave de API en las variables de entorno.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generation_config: {
      response_modalities: ["IMAGE"],
      image_config: {
        aspect_ratio: aspectRatio,
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Error de la API de Gemini (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data: GeminiImageResponse = await response.json();

  if (data.error) {
    throw new Error(`Error de Gemini: ${data.error.message}`);
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(`El prompt fue bloqueado por los filtros de seguridad de Google (${data.promptFeedback.blockReason}). Intente con un prompt diferente.`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini no devolvió resultados. Es posible que el prompt haya sido bloqueado por seguridad. Intente con un prompt diferente.");
  }

  const candidate = data.candidates[0];

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY") {
    throw new Error("El prompt fue bloqueado por los filtros de seguridad de Google. Intente con un prompt diferente que no contenga contenido sensible.");
  }
  if (finishReason === "RECITATION") {
    throw new Error("El prompt fue bloqueado por políticas de recitación. Intente reformular el prompt.");
  }
  if (finishReason === "PROHIBITED_CONTENT") {
    throw new Error("El contenido solicitado está prohibido por las políticas de Google. Intente con un prompt diferente.");
  }

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) {
    const blockedCategories = candidate.safetyRatings
      ?.filter(r => r.blocked)
      .map(r => r.category)
      .join(", ");
    if (blockedCategories) {
      throw new Error(`Imagen bloqueada por filtros de seguridad en las categorías: ${blockedCategories}. Intente con un prompt diferente.`);
    }
    throw new Error("Respuesta de Gemini sin contenido. Intente con un prompt más descriptivo.");
  }

  for (const part of parts) {
    if (part.inlineData) {
      const { mimeType, data: base64Data } = part.inlineData;
      return `data:${mimeType};base64,${base64Data}`;
    }
  }

  throw new Error("Gemini no generó una imagen. Intente con un prompt más descriptivo.");
}

export async function editImage(base64Image: string, editPrompt: string, aspectRatio: string = "16:9"): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada. Configure la clave de API en las variables de entorno.");
  }

  const imageData = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
  const mimeType = base64Image.match(/data:(.*?);/)?.[1] || "image/png";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageData,
            },
          },
          {
            text: editPrompt,
          },
        ],
      },
    ],
    generation_config: {
      response_modalities: ["IMAGE"],
      image_config: {
        aspect_ratio: aspectRatio,
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini edit API error:", response.status, errorText);
    throw new Error(`Error de la API de Gemini (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data: GeminiImageResponse = await response.json();

  if (data.error) {
    throw new Error(`Error de Gemini: ${data.error.message}`);
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(`El prompt fue bloqueado por los filtros de seguridad de Google (${data.promptFeedback.blockReason}). Intente con un prompt diferente.`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini no devolvió resultados para la edición. Intente con instrucciones más específicas.");
  }

  const candidate = data.candidates[0];

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY") {
    throw new Error("La edición fue bloqueada por los filtros de seguridad de Google. Intente con instrucciones diferentes.");
  }
  if (finishReason === "RECITATION") {
    throw new Error("La edición fue bloqueada por políticas de recitación. Intente reformular las instrucciones.");
  }
  if (finishReason === "PROHIBITED_CONTENT") {
    throw new Error("El contenido solicitado está prohibido por las políticas de Google.");
  }

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) {
    const blockedCategories = candidate.safetyRatings
      ?.filter(r => r.blocked)
      .map(r => r.category)
      .join(", ");
    if (blockedCategories) {
      throw new Error(`Edición bloqueada por filtros de seguridad en las categorías: ${blockedCategories}.`);
    }
    throw new Error("Respuesta de Gemini sin contenido tras la edición.");
  }

  for (const part of parts) {
    if (part.inlineData) {
      const { mimeType: resMimeType, data: base64Data } = part.inlineData;
      return `data:${resMimeType};base64,${base64Data}`;
    }
  }

  throw new Error("Gemini no generó una imagen editada. Intente con instrucciones más descriptivas.");
}

export type AdvancedAction = "agregar" | "reemplazar" | "fusionar" | "estilo" | "borrar_elemento";

const MICRO_PROMPTS: Record<AdvancedAction, string> = {
  agregar: "Actúa como un diseñador experto. Usa la imagen de referencia adjunta exactamente como es, preservando su diseño, texto, proporciones y detalles de alta fidelidad al 100%. Intégrala de forma natural en la imagen principal manteniendo la iluminación y perspectiva original, siguiendo esta instrucción: ",
  reemplazar: "Realiza un enmascaramiento semántico en la imagen principal. Identifica el elemento mencionado y reemplázalo usando la imagen de referencia como guía visual. Es crucial que cambies SOLO ese elemento y mantengas el resto de la imagen original intacto. Instrucción exacta: ",
  fusionar: "Realiza una composición fotográfica avanzada. Toma la imagen principal como base y la imagen de referencia como contexto. Crea una escena compuesta que combine ambas de forma natural, respetando las escalas y la siguiente directriz: ",
  estilo: "Transforma la imagen principal. Aplica el estilo artístico, la paleta de colores y la estética visual general de la imagen de referencia adjunta a la imagen principal. Recrea el contenido original fielmente pero bajo este nuevo estilo. Instrucción adicional: ",
  borrar_elemento: "Edita la imagen principal para eliminar el elemento especificado. Rellena el espacio vacío de forma fluida y natural (inpainting) para que coincida a la perfección con el fondo existente. Deja el resto de la composición exactamente igual. Elemento a eliminar: ",
};

const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function parseBase64Image(dataUrl: string): { data: string; mimeType: string } {
  const mimeMatch = dataUrl.match(/data:(image\/[a-z+]+);base64,/);
  const mimeType = mimeMatch?.[1] || "image/png";
  const data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  return { data, mimeType };
}

function getBase64SizeBytes(base64: string): number {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  return Math.ceil((raw.length * 3) / 4);
}

export interface EditImageAdvancedParams {
  currentImageBase64: string;
  referenceImagesBase64: string[];
  userText: string;
  selectedAction: AdvancedAction;
  aspectRatio?: string;
}

export async function editImageAdvanced(params: EditImageAdvancedParams): Promise<string> {
  const { currentImageBase64, referenceImagesBase64, userText, selectedAction, aspectRatio = "16:9" } = params;

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada. Configure la clave de API en las variables de entorno.");
  }

  const microPrompt = MICRO_PROMPTS[selectedAction];
  if (!microPrompt) {
    throw new Error(`Acción no válida: ${selectedAction}`);
  }
  const finalPrompt = microPrompt + userText;

  const baseImage = parseBase64Image(currentImageBase64);
  if (!SUPPORTED_MIME_TYPES.includes(baseImage.mimeType)) {
    throw new Error(`Tipo de imagen no soportado: ${baseImage.mimeType}. Use JPEG, PNG o WebP.`);
  }

  const refImages = referenceImagesBase64.map((img, i) => {
    const parsed = parseBase64Image(img);
    if (!SUPPORTED_MIME_TYPES.includes(parsed.mimeType)) {
      throw new Error(`Imagen de referencia ${i + 1}: tipo no soportado (${parsed.mimeType}). Use JPEG, PNG o WebP.`);
    }
    return parsed;
  });

  let totalSizeBytes = getBase64SizeBytes(currentImageBase64);
  for (const img of referenceImagesBase64) {
    totalSizeBytes += getBase64SizeBytes(img);
  }
  const MAX_TOTAL_SIZE = 20 * 1024 * 1024;
  if (totalSizeBytes > MAX_TOTAL_SIZE) {
    const totalMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);
    throw new Error(`El peso total de las imágenes (${totalMB} MB) excede el límite de 20 MB. Reduzca el tamaño o cantidad de imágenes.`);
  }

  const parts: Array<Record<string, unknown>> = [];

  parts.push({ text: finalPrompt });

  parts.push({
    inline_data: {
      mime_type: baseImage.mimeType,
      data: baseImage.data,
    },
  });

  for (const ref of refImages) {
    parts.push({
      inline_data: {
        mime_type: ref.mimeType,
        data: ref.data,
      },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generation_config: {
      response_modalities: ["IMAGE"],
      image_config: {
        aspect_ratio: aspectRatio,
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini advanced edit API error:", response.status, errorText);
    throw new Error(`Error de la API de Gemini (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data: GeminiImageResponse = await response.json();

  if (data.error) {
    throw new Error(`Error de Gemini: ${data.error.message}`);
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(`El prompt fue bloqueado por los filtros de seguridad de Google (${data.promptFeedback.blockReason}). Intente con instrucciones diferentes.`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini no devolvió resultados para la edición avanzada. Intente con instrucciones más específicas.");
  }

  const candidate = data.candidates[0];
  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY") {
    throw new Error("La edición fue bloqueada por los filtros de seguridad de Google. Intente con instrucciones diferentes.");
  }
  if (finishReason === "RECITATION") {
    throw new Error("La edición fue bloqueada por políticas de recitación. Intente reformular las instrucciones.");
  }
  if (finishReason === "PROHIBITED_CONTENT") {
    throw new Error("El contenido solicitado está prohibido por las políticas de Google.");
  }

  const responseParts = candidate.content?.parts;
  if (!responseParts || responseParts.length === 0) {
    const blockedCategories = candidate.safetyRatings
      ?.filter(r => r.blocked)
      .map(r => r.category)
      .join(", ");
    if (blockedCategories) {
      throw new Error(`Edición bloqueada por filtros de seguridad en las categorías: ${blockedCategories}.`);
    }
    throw new Error("Respuesta de Gemini sin contenido tras la edición avanzada.");
  }

  for (const part of responseParts) {
    if (part.inlineData) {
      const { mimeType: resMimeType, data: base64Data } = part.inlineData;
      return `data:${resMimeType};base64,${base64Data}`;
    }
  }

  throw new Error("Gemini no generó una imagen editada. Intente con instrucciones más descriptivas.");
}

export function isGeminiConfigured(): boolean {
  return !!getApiKey();
}
