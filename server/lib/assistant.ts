import OpenAI from "openai";
import type { AssistantSection } from "@shared/schema";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export function getAssistantInstructions(section: AssistantSection): string {
  const base = `Eres un asistente de IA experto en email marketing para la plataforma PostIAlo Mailing.
Responde siempre en español, de forma clara, concisa y útil.
Usa formato Markdown cuando ayude a organizar la respuesta (listas, negrita, etc.).
Nunca menciones nombres de proveedores de IA ni detalles técnicos internos.`;

  const sectionInstructions: Record<AssistantSection, string> = {
    brand: `${base}
El usuario está en la sección de Identidad de Marca.
Ayúdale con: definir misión, visión, tono de comunicación, colores, tipografía, audiencia objetivo, guía de estilo, productos/servicios, y configuración del remitente de email.
Ofrece sugerencias concretas para construir una identidad de marca sólida para email marketing.`,

    calendar: `${base}
El usuario está en el Calendario de Campañas.
Ayúdale con: planificar y programar campañas de email, elegir fechas óptimas de envío, crear campañas con objetivos claros, entender los estados de campaña (borrador, programada, enviada), y estrategias de frecuencia de envío.
Ofrece consejos sobre mejores días y horarios para enviar emails según tipo de audiencia.`,

    templates: `${base}
El usuario está en la sección de Plantillas de Email.
Ayúdale con: diseñar plantillas efectivas, entender los placeholders ({{CONTENIDO}}, {{IMAGEN_URL}}, {{LOGO_URL}}, {{CTA_TEXTO}}, {{CTA_URL}}, {{ASUNTO}}, {{PREHEADER}}), estructurar el layout de un email, y consejos de diseño visual.
Explica cómo crear plantillas que conviertan bien y sean compatibles con clientes de email.`,

    contacts: `${base}
El usuario está en la sección de Base de Datos de Contactos.
Ayúdale con: gestión de listas de contactos, segmentación por campos (nombre, cargo, segmento), importación de contactos CSV, mejores prácticas de higiene de lista, y estrategias de segmentación para mejorar tasas de apertura.`,

    history: `${base}
El usuario está en el Historial de Emails enviados.
Ayúdale con: interpretar estadísticas de envío (enviados, fallidos, pendientes), entender qué campañas funcionaron mejor, analizar patrones de envío, y tomar decisiones basadas en el historial.`,

    dashboard: `${base}
El usuario está en el Dashboard de métricas.
Ayúdale con: interpretar los gráficos y métricas mostradas, entender KPIs de email marketing (tasa de apertura, clics, conversiones), leer las métricas de campañas por mes, y tomar decisiones estratégicas basadas en datos.`,

    provider: `${base}
El usuario está en la sección de Proveedor de Email (Brevo o Mailchimp).
Ayúdale con: configurar correctamente su proveedor de email, entender los campos necesarios (API key, email remitente, nombre remitente), diferencias entre Brevo y Mailchimp, y solucionar problemas de configuración.`,

    settings: `${base}
El usuario está en la sección de Configuración.
Ayúdale con: gestión de su cuenta, cambio de contraseña, configuración general de la plataforma, y cualquier ajuste de preferencias disponible.`,

    general: `${base}
Ayuda al usuario con cualquier aspecto de la plataforma PostIAlo Mailing:
- Crear y gestionar campañas de email marketing
- Configurar identidad de marca
- Gestionar plantillas y contactos
- Analizar resultados y métricas
- Configurar proveedores de email (Brevo, Mailchimp)
Ofrece guía general sobre cómo usar la plataforma de forma efectiva.`,
  };

  return sectionInstructions[section] || sectionInstructions.general;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function streamAssistantResponse(params: {
  userMessage: string;
  section: AssistantSection;
  lastResponseId: string | null;
  onDelta: (text: string) => void;
  onDone: (responseId: string | null) => void;
  onError: (err: Error) => void;
}): Promise<void> {
  const { userMessage, section, lastResponseId, onDelta, onDone, onError } = params;
  const client = getClient();
  const instructions = getAssistantInstructions(section);

  try {
    const stream = await (client.responses as any).create({
      model: "gpt-4.1-mini",
      instructions,
      input: userMessage,
      ...(lastResponseId ? { previous_response_id: lastResponseId } : {}),
      stream: true,
    });

    let finalResponseId: string | null = null;

    for await (const event of stream as AsyncIterable<any>) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        onDelta(event.delta);
      } else if (event.type === "response.completed" && event.response?.id) {
        finalResponseId = event.response.id;
      }
    }

    onDone(finalResponseId);
  } catch (err: any) {
    console.error("[assistant] streamAssistantResponse error:", err?.message);
    onError(err instanceof Error ? err : new Error(String(err?.message || "Error desconocido")));
  }
}
