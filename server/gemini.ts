const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface SafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inline_data?: {
          mime_type: string;
          data: string;
        };
        text?: string;
      }>;
    };
    finish_reason?: string;
    safety_ratings?: SafetyRating[];
  }>;
  prompt_feedback?: {
    block_reason?: string;
    safety_ratings?: SafetyRating[];
  };
  error?: {
    message: string;
    code: number;
  };
}

export async function generateImage(prompt: string, aspectRatio: string = "16:9"): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada. Configure la clave de API en las variables de entorno.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;

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

  if (data.prompt_feedback?.block_reason) {
    throw new Error(`El prompt fue bloqueado por los filtros de seguridad de Google (${data.prompt_feedback.block_reason}). Intente con un prompt diferente.`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini no devolvió resultados. Es posible que el prompt haya sido bloqueado por seguridad. Intente con un prompt diferente.");
  }

  const candidate = data.candidates[0];

  const finishReason = candidate.finish_reason;
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
    const blockedCategories = candidate.safety_ratings
      ?.filter(r => r.blocked)
      .map(r => r.category)
      .join(", ");
    if (blockedCategories) {
      throw new Error(`Imagen bloqueada por filtros de seguridad en las categorías: ${blockedCategories}. Intente con un prompt diferente.`);
    }
    throw new Error("Respuesta de Gemini sin contenido. Intente con un prompt más descriptivo.");
  }

  for (const part of parts) {
    if (part.inline_data) {
      const { mime_type, data: base64Data } = part.inline_data;
      return `data:${mime_type};base64,${base64Data}`;
    }
  }

  throw new Error("Gemini no generó una imagen. Intente con un prompt más descriptivo.");
}

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}
