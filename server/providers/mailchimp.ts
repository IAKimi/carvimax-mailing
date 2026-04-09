const MAILCHIMP_API_VERSION = "3.0";

interface MailchimpAccountInfo {
  accountName: string;
  email: string;
  firstName: string;
  lastName: string;
  totalSubscribers: number;
}

interface MailchimpVerifiedDomain {
  domain: string;
  verified: boolean;
  authenticationType: string;
}

export interface MailchimpAudience {
  id: string;
  name: string;
  memberCount: number;
  defaultFromName?: string;
  defaultFromEmail?: string;
}

function extractDataCenter(apiKey: string): string {
  const parts = apiKey.split("-");
  if (parts.length < 2) throw new Error("API key inválida: no contiene data center (ej: xxxxx-us21)");
  return parts[parts.length - 1];
}

function baseUrl(dataCenter: string): string {
  return `https://${dataCenter}.api.mailchimp.com/${MAILCHIMP_API_VERSION}`;
}

function authHeaders(apiKey: string): Record<string, string> {
  const encoded = Buffer.from(`anystring:${apiKey}`).toString("base64");
  return {
    "Authorization": `Basic ${encoded}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  account?: MailchimpAccountInfo;
  dataCenter?: string;
  error?: string;
}> {
  try {
    const dc = extractDataCenter(apiKey);
    const res = await fetch(`${baseUrl(dc)}/`, {
      method: "GET",
      headers: authHeaders(apiKey),
    });

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      return {
        valid: true,
        dataCenter: dc,
        account: {
          accountName: String(data.account_name || ""),
          email: String(data.email || ""),
          firstName: String(data.first_name || ""),
          lastName: String(data.last_name || ""),
          totalSubscribers: Number(data.total_subscribers || 0),
        },
      };
    }

    if (res.status === 401) {
      return { valid: false, error: "API key inválida. Verifica que la key sea correcta." };
    }

    const errText = await res.text().catch(() => "Error desconocido");
    return { valid: false, error: `Error de Mailchimp (${res.status}): ${errText}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { valid: false, error: `Error de conexión con Mailchimp: ${message}` };
  }
}

export async function getAudiences(
  apiKey: string,
  dataCenter: string
): Promise<{ audiences: MailchimpAudience[]; error?: string }> {
  try {
    const res = await fetch(`${baseUrl(dataCenter)}/lists?count=100`, {
      method: "GET",
      headers: authHeaders(apiKey),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Error desconocido");
      return { audiences: [], error: `Error al consultar audiencias (${res.status}): ${errText}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const rawLists = Array.isArray(data.lists) ? data.lists : [];
    const audiences: MailchimpAudience[] = rawLists.map((l: Record<string, unknown>) => {
      const stats = l.stats as Record<string, unknown> | undefined;
      const defaults = l.campaign_defaults as Record<string, unknown> | undefined;
      return {
        id: String(l.id || ""),
        name: String(l.name || ""),
        memberCount: Number(stats?.member_count || 0),
        defaultFromName: defaults?.from_name ? String(defaults.from_name) : undefined,
        defaultFromEmail: defaults?.from_email ? String(defaults.from_email) : undefined,
      };
    });

    return { audiences };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { audiences: [], error: `Error de conexión: ${message}` };
  }
}

export async function getVerifiedDomains(
  apiKey: string,
  dataCenter: string
): Promise<{ domains: MailchimpVerifiedDomain[]; error?: string }> {
  try {
    const res = await fetch(`${baseUrl(dataCenter)}/verified-domains`, {
      method: "GET",
      headers: authHeaders(apiKey),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Error desconocido");
      return { domains: [], error: `Error al consultar dominios (${res.status}): ${errText}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const rawDomains = Array.isArray(data.domains) ? data.domains : [];
    const domains: MailchimpVerifiedDomain[] = rawDomains.map((d: Record<string, unknown>) => ({
      domain: String(d.domain || ""),
      verified: d.verified === true,
      authenticationType: String(d.authentication_type || ""),
    }));

    return { domains };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { domains: [], error: `Error de conexión: ${message}` };
  }
}

export async function syncContactsToAudience(
  apiKey: string,
  dataCenter: string,
  audienceId: string,
  contacts: Array<{ name: string; email: string }>,
  tagName: string
): Promise<{ audienceId: string; error?: string }> {
  if (!audienceId) {
    return { audienceId: "", error: "No hay una audiencia de Mailchimp seleccionada. Ve a Configuración > Proveedor de Email y selecciona una audiencia." };
  }

  const headers = authHeaders(apiKey);
  const base = baseUrl(dataCenter);

  try {
    const members = contacts.map(c => ({
      email_address: c.email,
      status: "subscribed" as const,
      merge_fields: { FNAME: c.name.split(" ")[0] || "", LNAME: c.name.split(" ").slice(1).join(" ") || "" },
      tags: [tagName],
    }));

    const batchRes = await fetch(`${base}/lists/${audienceId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        members,
        update_existing: true,
      }),
    });

    if (!batchRes.ok) {
      const errText = await batchRes.text().catch(() => "");
      return { audienceId, error: `Error al sincronizar contactos (${batchRes.status}): ${errText}` };
    }

    const batchData = await batchRes.json() as Record<string, unknown>;
    const errorCount = Array.isArray(batchData.errors) ? batchData.errors.length : 0;
    if (errorCount > 0) {
      console.warn(`[Mailchimp] ${errorCount} contactos con error al sincronizar a audiencia ${audienceId}`);
    }

    return { audienceId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { audienceId: audienceId || "", error: `Error al sincronizar contactos: ${message}` };
  }
}

export async function createAndSendCampaign(
  apiKey: string,
  dataCenter: string,
  audienceId: string,
  subject: string,
  fromName: string,
  replyTo: string,
  htmlContent: string
): Promise<{ campaignId: string | null; error?: string }> {
  const headers = authHeaders(apiKey);
  const base = baseUrl(dataCenter);

  let campaignId: string | null = null;

  try {
    const createRes = await fetch(`${base}/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: audienceId },
        settings: {
          subject_line: subject,
          from_name: fromName,
          reply_to: replyTo,
          auto_footer: false,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      return { campaignId: null, error: `Error al crear campaña en Mailchimp (${createRes.status}): ${errText}` };
    }

    const campaignData = await createRes.json() as Record<string, unknown>;
    campaignId = String(campaignData.id || "");
    if (!campaignId) {
      return { campaignId: null, error: "Mailchimp no devolvió un ID de campaña." };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { campaignId: null, error: `Error al crear campaña: ${message}` };
  }

  try {
    const contentRes = await fetch(`${base}/campaigns/${campaignId}/content`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ html: htmlContent }),
    });

    if (!contentRes.ok) {
      const errText = await contentRes.text().catch(() => "");
      return { campaignId, error: `Error al establecer contenido de campaña (${contentRes.status}): ${errText}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { campaignId, error: `Error al establecer contenido: ${message}` };
  }

  try {
    const sendRes = await fetch(`${base}/campaigns/${campaignId}/actions/send`, {
      method: "POST",
      headers,
    });

    if (sendRes.status === 204 || sendRes.ok) {
      return { campaignId };
    }

    const errText = await sendRes.text().catch(() => "");
    return { campaignId, error: `Error al enviar campaña (${sendRes.status}): ${errText}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { campaignId, error: `Error al enviar campaña: ${message}` };
  }
}
