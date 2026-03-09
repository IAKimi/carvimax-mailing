const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export async function generateImage(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada. Configure la clave de API en las variables de entorno.");
  }

  const enhancedPrompt = `Generate a professional, clean image for an email marketing campaign. The image should have no text overlaid on it, use a clean background suitable for email clients. Style: modern, professional, high quality. Description: ${prompt}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: enhancedPrompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 1,
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

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Gemini no devolvió resultados. Intente con un prompt diferente.");
  }

  const parts = data.candidates[0]?.content?.parts;
  if (!parts) {
    throw new Error("Respuesta de Gemini sin contenido.");
  }

  for (const part of parts) {
    if (part.inlineData) {
      const { mimeType, data: base64Data } = part.inlineData;
      return `data:${mimeType};base64,${base64Data}`;
    }
  }

  throw new Error("Gemini no generó una imagen. Intente con un prompt más descriptivo.");
}

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}
