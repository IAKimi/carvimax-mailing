/** Brand fields used when assembling campaign HTML without a saved template. */
export interface BrandEmailData {
  companyName?: string | null;
  website?: string | null;
  whatsapp?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  logoUrl?: string | null;
  visualStyle?: string | null;
  tone?: string | null;
  styleGuide?: string | null;
  industry?: string | null;
  products?: string | null;
}

/**
 * Builds a branded email shell for prompt-based campaigns (no template).
 * Applies logo, colors, fonts and footer contact from brand identity.
 */
export function buildBrandedCampaignHtml(
  contentJson: Record<string, unknown> | null,
  imagePublicUrl: string | null,
  brand?: BrandEmailData | null
): string {
  const primaryColor = brand?.primaryColor || "#002073";
  const secondaryColor = brand?.secondaryColor || "#e3001b";
  const headingFont = brand?.headingFont || "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif";
  const bodyFont = brand?.bodyFont || "'Poppins', 'Helvetica Neue', Arial, sans-serif";
  const companyName = brand?.companyName || "";
  const logoUrl = brand?.logoUrl || "";
  const asunto = (contentJson?.asunto as string) || "";
  const preheader = (contentJson?.preheader as string) || "";
  const body = (contentJson?.cuerpo_html as string) || "";
  const ctaEnabled = contentJson?.cta_enabled !== false;
  const ctaText = ctaEnabled ? ((contentJson?.cta_text as string) || "") : "";
  const ctaUrl = ctaEnabled && ctaText ? ((contentJson?.cta_url as string) || "#") : "";

  const logoCell = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName || "Logo"}" width="120" style="display:block;border:0;max-width:120px;height:auto;" />`
    : companyName
      ? `<span style="font-family:${headingFont};font-size:15px;font-weight:700;color:#ffffff;">${companyName}</span>`
      : "";

  const footerParts: string[] = [];
  if (companyName) footerParts.push(companyName);
  if (brand?.whatsapp) footerParts.push(`WhatsApp: ${brand.whatsapp}`);
  if (brand?.website) {
    const display = String(brand.website).replace(/^https?:\/\//, "");
    footerParts.push(
      `<a href="${brand.website}" target="_blank" style="color:${primaryColor};text-decoration:none;">${display}</a>`
    );
  }
  const footerContact =
    footerParts.length > 0
      ? `<div style="padding-bottom:8px;">${footerParts.join(" · ")}</div>`
      : "";

  const headerBlock = `
        <tr>
          <td bgcolor="${primaryColor}" style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="130" valign="middle" style="padding-right:12px;">${logoCell}</td>
                <td align="center" valign="middle" style="font-family:${headingFont};font-size:22px;line-height:30px;font-weight:700;color:#ffffff;">
                  ${asunto || companyName || ""}
                </td>
                <td width="130"></td>
              </tr>
            </table>
          </td>
        </tr>`;

  const imgBlock = imagePublicUrl
    ? `<tr>
          <td style="padding:20px;background:#ffffff;">
            <img src="${imagePublicUrl}" alt="" width="600" style="display:block;border:0;width:100%;max-width:600px;border-radius:16px;" />
          </td>
        </tr>`
    : "";

  const ctaBlock =
    imagePublicUrl && ctaText
      ? `<tr>
          <td align="center" style="padding:0 30px 30px;background:#ffffff;">
            <a href="${ctaUrl}" target="_blank" style="background-color:${secondaryColor};border-radius:12px;color:#ffffff;display:inline-block;font-family:${headingFont};font-size:16px;font-weight:700;line-height:48px;text-align:center;text-decoration:none;width:240px;max-width:100%;">
              ${ctaText}
            </a>
          </td>
        </tr>`
      : "";

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${asunto || companyName || "Correo"}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:${bodyFont};">
${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : ""}
<table align="center" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f6fb" style="padding:20px 0;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        ${headerBlock}
        ${imgBlock}
        <tr>
          <td style="padding:20px 30px;font-family:${bodyFont};font-size:16px;line-height:24px;color:#333333;background:#ffffff;">
            ${body}
          </td>
        </tr>
        ${ctaBlock}
        <tr>
          <td style="padding:20px 30px;font-family:${bodyFont};font-size:12px;line-height:18px;color:#555555;background:#f9f9f9;border-top:1px solid #dddddd;text-align:center;">
            ${footerContact}
            <div>
              <a href="#" target="_blank" style="color:#777777;text-decoration:underline;">Cancelar suscripción</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
}

/** Appends brand visual cues to an image-generation prompt. */
export function enrichImagePromptWithBrand(prompt: string, brand?: BrandEmailData | null): string {
  if (!brand) return prompt;
  const cues: string[] = [];
  if (brand.companyName) cues.push(`marca: ${brand.companyName}`);
  if (brand.industry) cues.push(`industria: ${brand.industry}`);
  if (brand.visualStyle) cues.push(`estilo visual: ${brand.visualStyle}`);
  if (brand.primaryColor) cues.push(`color primario: ${brand.primaryColor}`);
  if (brand.secondaryColor) cues.push(`color secundario: ${brand.secondaryColor}`);
  if (brand.accentColor) cues.push(`color de acento: ${brand.accentColor}`);
  if (cues.length === 0) return prompt;

  return `${prompt.trim()}

Identidad visual de marca (aplicar de forma coherente salvo que el prompt pida omitirla de forma explícita): ${cues.join("; ")}.`;
}
