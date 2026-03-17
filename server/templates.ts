import { ALL_PLACEHOLDER_KEYS, TEMPLATE_PLACEHOLDERS } from "@shared/schema";
import type { BrandIdentity } from "@shared/schema";

export interface PlaceholderValidation {
  valid: boolean;
  present: string[];
  missing: string[];
}

const LOCKED_FIELD_TO_PLACEHOLDERS: Record<string, string[]> = {
  imagen: ["{{IMAGEN_URL}}"],
  cta: ["{{CTA_TEXTO}}"],
  cta_url: ["{{CTA_URL}}"],
  footer: [],
};

export function validateTemplatePlaceholders(html: string, lockedFields?: string[] | null): PlaceholderValidation {
  const present: string[] = [];
  const missing: string[] = [];

  const coveredByLock = new Set<string>();
  if (lockedFields && Array.isArray(lockedFields)) {
    for (const lf of lockedFields) {
      const mapped = LOCKED_FIELD_TO_PLACEHOLDERS[lf];
      if (mapped) {
        for (const key of mapped) coveredByLock.add(key);
      }
    }
  }

  for (const key of ALL_PLACEHOLDER_KEYS) {
    if (html.includes(key) || coveredByLock.has(key)) {
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

export interface StructureValidation {
  valid: boolean;
  errors: string[];
}

export function validateTemplateStructure(html: string): StructureValidation {
  const errors: string[] = [];
  const lower = html.toLowerCase();

  const asuntoIdx = html.indexOf("{{ASUNTO}}");
  const imagenIdx = html.indexOf("{{IMAGEN_URL}}");
  const contenidoIdx = html.indexOf("{{CONTENIDO}}");
  const ctaTextoIdx = html.indexOf("{{CTA_TEXTO}}");

  if (asuntoIdx === -1 || imagenIdx === -1 || contenidoIdx === -1 || ctaTextoIdx === -1) {
    return { valid: true, errors: [] };
  }

  if (imagenIdx < asuntoIdx) {
    errors.push("La imagen debe aparecer después del header/asunto.");
  }
  if (contenidoIdx < imagenIdx) {
    errors.push("El contenido debe aparecer después de la imagen.");
  }
  if (ctaTextoIdx < contenidoIdx) {
    errors.push("El botón CTA debe aparecer después del contenido.");
  }

  return { valid: errors.length === 0, errors };
}

function fixGradientsForEmail(html: string): string {
  return html.replace(
    /background(?:-image)?:\s*(?:linear|radial)-gradient\([^)]+\)/gi,
    (match) => {
      const hexMatch = match.match(/#[0-9a-fA-F]{3,8}/);
      if (hexMatch) return `background-color:${hexMatch[0]}`;
      const rgbMatch = match.match(/rgb\([^)]+\)/);
      if (rgbMatch) return `background-color:${rgbMatch[0]}`;
      return `background-color:#e3001b`;
    }
  );
}

export interface RenderResult {
  html: string;
  missingFields: string[];
}

export function renderTemplateWithContent(
  templateHtml: string,
  contentJson: Record<string, unknown> | null,
  imageUrl: string | null,
  brandData?: Partial<BrandIdentity> | null
): RenderResult {
  let html = templateHtml;
  const missingFields: string[] = [];

  const ctaEnabled = contentJson?.cta_enabled !== false;
  const asunto = (contentJson?.asunto as string) || "";
  const preheader = (contentJson?.preheader as string) || "";
  const contenido = (contentJson?.cuerpo_html as string) || (contentJson?.html as string) || (contentJson?.body as string) || "";
  const ctaTexto = ctaEnabled ? ((contentJson?.cta_text as string) || "") : "";
  const ctaUrl = ctaEnabled ? ((contentJson?.cta_url as string) || "#") : "";

  if (!asunto) missingFields.push(TEMPLATE_PLACEHOLDERS.ASUNTO.label);
  if (!preheader) missingFields.push(TEMPLATE_PLACEHOLDERS.PREHEADER.label);
  if (!contenido) missingFields.push(TEMPLATE_PLACEHOLDERS.CONTENIDO.label);
  if (ctaEnabled) {
    if (!ctaTexto) missingFields.push(TEMPLATE_PLACEHOLDERS.CTA_TEXTO.label);
    if (!ctaUrl || ctaUrl === "#") missingFields.push(TEMPLATE_PLACEHOLDERS.CTA_URL.label);
  }
  if (!imageUrl) missingFields.push(TEMPLATE_PLACEHOLDERS.IMAGEN_URL.label);

  if (!ctaEnabled) {
    html = html.replace(/<!--\s*(?:BLOQUE\s*\d+\s*:\s*)?Botón CTA\s*-->\s*<tr>[\s\S]*?<\/tr>/i, '<!-- Botón CTA desactivado -->');
    html = html.replace(/<tr[^>]*>[\s\S]*?\{\{CTA_TEXTO\}\}[\s\S]*?<\/tr>/gi, '');
    html = html.replace(/<a[^>]*href=["'][^"']*\{\{CTA_URL\}\}[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  }

  html = html.replace(/\{\{ASUNTO\}\}/g, asunto);
  html = html.replace(/\{\{PREHEADER\}\}/g, preheader);
  html = html.replace(/\{\{CONTENIDO\}\}/g, contenido);
  html = html.replace(/\{\{CTA_TEXTO\}\}/g, ctaTexto);
  html = html.replace(/\{\{CTA_URL\}\}/g, ctaUrl);
  html = html.replace(/\{\{IMAGEN_URL\}\}/g, imageUrl || "https://placehold.co/600x300/002073/white?text=Sin+Imagen");

  html = fixGradientsForEmail(html);

  if (html.includes("{{LOGO_URL}}")) {
    if (brandData?.logoUrl) {
      html = html.replace(/\{\{LOGO_URL\}\}/g, brandData.logoUrl);
    } else {
      html = html.replace(/\{\{LOGO_URL\}\}/g, "");
    }
  }

  return { html, missingFields };
}
