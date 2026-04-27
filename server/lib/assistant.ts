import OpenAI from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
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

const SECTION_NAMES: Record<AssistantSection, string> = {
  brand: "Identidad de Marca",
  calendar: "Calendario de Campañas",
  templates: "Plantillas",
  contacts: "Base de Contactos",
  history: "Historial de Emails",
  dashboard: "Dashboard",
  provider: "Proveedor de Email",
  settings: "Configuración",
  general: "inicio",
};

const SCOPE_REDIRECT = (section: AssistantSection) =>
  `Si el usuario pregunta sobre algo que no corresponde a la sección de "${SECTION_NAMES[section]}", responde exactamente así: "Esa pregunta corresponde a la sección de [nombre correcto de la sección]. Cerrá esta burbuja, navegá a esa sección y abrí el chat ahí." No profundices en temas de otras secciones.`;

export function getAssistantInstructions(section: AssistantSection): string {
  const base = `Eres un asistente de IA experto en email marketing para la plataforma PostIAlo Mailing.
Responde siempre en español, de forma clara, concisa y útil.
Usa formato Markdown cuando ayude a organizar la respuesta (listas, negrita, etc.).
Nunca menciones nombres de proveedores de IA ni detalles técnicos internos de la plataforma.
${SCOPE_REDIRECT(section)}`;

  const sectionInstructions: Record<AssistantSection, string> = {
    brand: `${base}
El usuario está en la sección de Identidad de Marca.
Tu especialidad aquí: misión, visión, tono de comunicación, paleta de colores, tipografía, audiencia objetivo, guía de estilo, descripción de productos/servicios, e-mail y nombre del remitente.
Ofrece sugerencias concretas para construir una identidad de marca sólida orientada al email marketing.`,

    calendar: `${base}
El usuario está en el Calendario de Campañas.
Tu especialidad aquí: planificar y programar campañas de email, elegir fechas y horarios óptimos de envío, crear campañas con objetivos claros, entender los estados de campaña (borrador, programada, enviando, enviada, fallida, cancelada), y estrategias de frecuencia de envío.
Ofrece consejos sobre mejores días y horarios según tipo de audiencia e industria.`,

    templates: `${base}
El usuario está en la sección de Plantillas de Email.
Tu especialidad aquí: diseñar plantillas efectivas, los placeholders disponibles ({{CONTENIDO}}, {{IMAGEN_URL}}, {{LOGO_URL}}, {{CTA_TEXTO}}, {{CTA_URL}}, {{ASUNTO}}, {{PREHEADER}}), estructura de layout del email, y buenas prácticas de diseño visual.
Explica cómo crear plantillas que conviertan bien y sean compatibles con los principales clientes de email.`,

    contacts: `${base}
El usuario está en la sección de Base de Datos de Contactos.
Tu especialidad aquí: gestión de listas de contactos, segmentación por campos (nombre, cargo, segmento), importación de contactos mediante CSV, buenas prácticas de higiene de lista, y estrategias de segmentación para mejorar tasas de apertura y conversión.`,

    history: `${base}
El usuario está en el Historial de Emails enviados.
Tu especialidad aquí: interpretar estadísticas de envío (enviados, fallidos, pendientes), identificar qué campañas funcionaron mejor, analizar patrones y tendencias, y tomar decisiones basadas en el historial de envíos.`,

    dashboard: `${base}
El usuario está en el Dashboard de métricas.
Tu especialidad aquí: interpretar los gráficos y métricas mostradas, entender KPIs de email marketing (campañas por mes, bases usadas, plantillas favoritas), leer la actividad reciente, y tomar decisiones estratégicas basadas en datos.`,

    provider: `${base}
El usuario está en la sección de Proveedor de Email (Brevo o Mailchimp).
Tu especialidad aquí: configurar correctamente el proveedor de email, entender los campos necesarios (API key, email remitente, nombre remitente), diferencias entre Brevo y Mailchimp, y orientación para resolver problemas de configuración o validación.`,

    settings: `${base}
El usuario está en la sección de Configuración de su cuenta.
Tu especialidad aquí: gestión de datos de cuenta, cambio de contraseña, configuración general de la plataforma, y ajustes de preferencias disponibles.`,

    general: `${base}
Ayuda al usuario con cualquier aspecto de la plataforma PostIAlo Mailing:
crear y gestionar campañas de email marketing, configurar identidad de marca, gestionar plantillas y contactos, analizar resultados y métricas, o configurar proveedores de email (Brevo, Mailchimp).
Ofrece guía general sobre cómo usar la plataforma de forma efectiva.`,
  };

  return sectionInstructions[section] ?? sectionInstructions.general;
}

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
    const stream = client.responses.stream({
      model: "gpt-4.1-mini",
      instructions,
      input: userMessage,
      ...(lastResponseId ? { previous_response_id: lastResponseId } : {}),
    });

    let finalResponseId: string | null = null;

    for await (const event of stream) {
      const e = event as ResponseStreamEvent;
      if (e.type === "response.output_text.delta") {
        onDelta(e.delta);
      } else if (e.type === "response.completed") {
        finalResponseId = e.response?.id ?? null;
      }
    }

    onDone(finalResponseId);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error("Error desconocido al contactar el asistente.");
    console.error("[assistant] streamAssistantResponse error:", error.message);
    onError(error);
  }
}
