import { ALL_PLACEHOLDER_KEYS, TEMPLATE_PLACEHOLDERS } from "@shared/schema";

export interface PlaceholderValidation {
  valid: boolean;
  present: string[];
  missing: string[];
}

export function validateTemplatePlaceholders(html: string): PlaceholderValidation {
  const present: string[] = [];
  const missing: string[] = [];

  for (const key of ALL_PLACEHOLDER_KEYS) {
    if (html.includes(key)) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    present,
    missing,
  };
}

export interface RenderResult {
  html: string;
  missingFields: string[];
}

export function renderTemplateWithContent(
  templateHtml: string,
  contentJson: Record<string, unknown> | null,
  imageUrl: string | null
): RenderResult {
  let html = templateHtml;
  const missingFields: string[] = [];

  const asunto = (contentJson?.asunto as string) || "";
  const preheader = (contentJson?.preheader as string) || "";
  const contenido = (contentJson?.cuerpo_html as string) || (contentJson?.html as string) || (contentJson?.body as string) || "";
  const ctaTexto = (contentJson?.cta_text as string) || "";
  const ctaUrl = (contentJson?.cta_url as string) || "#";

  if (!asunto) missingFields.push(TEMPLATE_PLACEHOLDERS.ASUNTO.label);
  if (!preheader) missingFields.push(TEMPLATE_PLACEHOLDERS.PREHEADER.label);
  if (!contenido) missingFields.push(TEMPLATE_PLACEHOLDERS.CONTENIDO.label);
  if (!ctaTexto) missingFields.push(TEMPLATE_PLACEHOLDERS.CTA_TEXTO.label);
  if (!ctaUrl || ctaUrl === "#") missingFields.push(TEMPLATE_PLACEHOLDERS.CTA_URL.label);
  if (!imageUrl) missingFields.push(TEMPLATE_PLACEHOLDERS.IMAGEN_URL.label);

  html = html.replace(/\{\{ASUNTO\}\}/g, asunto);
  html = html.replace(/\{\{PREHEADER\}\}/g, preheader);
  html = html.replace(/\{\{CONTENIDO\}\}/g, contenido);
  html = html.replace(/\{\{CTA_TEXTO\}\}/g, ctaTexto);
  html = html.replace(/\{\{CTA_URL\}\}/g, ctaUrl);
  html = html.replace(/\{\{IMAGEN_URL\}\}/g, imageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen");

  return { html, missingFields };
}
