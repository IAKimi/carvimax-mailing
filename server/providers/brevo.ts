const BREVO_API_BASE = "https://api.brevo.com/v3";

interface BrevoAccountInfo {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  plan: Array<{ type: string; credits: number }>;
}

interface BrevoSender {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface BrevoSendResult {
  messageId?: string;
  error?: string;
  statusCode?: number;
}

interface BrevoBatchResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
  noCredits: boolean;
}

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; account?: BrevoAccountInfo; error?: string }> {
  try {
    const res = await fetch(`${BREVO_API_BASE}/account`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
      },
    });

    if (res.ok) {
      const data = await res.json() as any;
      return {
        valid: true,
        account: {
          email: data.email || "",
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          companyName: data.companyName || "",
          plan: data.plan || [],
        },
      };
    }

    if (res.status === 401) {
      return { valid: false, error: "API key inválida. Verifica que la key sea correcta." };
    }

    const errText = await res.text().catch(() => "Error desconocido");
    return { valid: false, error: `Error de Brevo (${res.status}): ${errText}` };
  } catch (err: any) {
    return { valid: false, error: `Error de conexión con Brevo: ${err.message}` };
  }
}

export async function getSenders(apiKey: string): Promise<{ senders: BrevoSender[]; error?: string }> {
  try {
    const res = await fetch(`${BREVO_API_BASE}/senders`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Error desconocido");
      return { senders: [], error: `Error al consultar senders (${res.status}): ${errText}` };
    }

    const data = await res.json() as any;
    const senders: BrevoSender[] = (data.senders || []).map((s: any) => ({
      id: s.id,
      name: s.name || "",
      email: s.email,
      active: s.active !== false,
    }));

    return { senders };
  } catch (err: any) {
    return { senders: [], error: `Error de conexión: ${err.message}` };
  }
}

export async function createTrackingWebhook(
  apiKey: string,
  callbackUrl: string
): Promise<{ webhookId: string | null; error?: string }> {
  try {
    const res = await fetch(`${BREVO_API_BASE}/webhooks`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        type: "transactional",
        events: ["delivered", "hardBounce", "softBounce", "opened", "click"],
        url: callbackUrl,
        description: "PostIAlo Mailing Tracking Webhook",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Error desconocido");
      console.error(`[Brevo] Failed to create webhook (${res.status}): ${errText}`);
      return { webhookId: null, error: `Error al crear webhook (${res.status})` };
    }

    const data = await res.json() as any;
    return { webhookId: String(data.id || "") };
  } catch (err: any) {
    console.error("[Brevo] Webhook creation error:", err.message);
    return { webhookId: null, error: `Error de conexión: ${err.message}` };
  }
}

export async function deleteWebhook(apiKey: string, webhookId: string): Promise<void> {
  try {
    await fetch(`${BREVO_API_BASE}/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: {
        "api-key": apiKey,
      },
    });
  } catch (err: any) {
    console.error("[Brevo] Webhook deletion error:", err.message);
  }
}

const BATCH_SIZE = 1000;

export async function sendBatchEmails(
  apiKey: string,
  sender: { name: string; email: string },
  subject: string,
  htmlContent: string,
  contacts: Array<{ name: string; email: string }>,
  campaignTag: string
): Promise<BrevoBatchResult> {
  const result: BrevoBatchResult = { sent: 0, failed: 0, errors: [], noCredits: false };

  const chunks: Array<Array<{ name: string; email: string }>> = [];
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    chunks.push(contacts.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    if (result.noCredits) {
      result.failed += chunk.length;
      for (const c of chunk) {
        result.errors.push({ email: c.email, error: "Sin créditos en Brevo" });
      }
      continue;
    }

    try {
      const messageVersions = chunk.map(contact => ({
        to: [{ email: contact.email, name: contact.name }],
        params: { nombre: contact.name },
      }));

      const payload = {
        sender: { name: sender.name, email: sender.email },
        subject,
        htmlContent,
        messageVersions,
        tags: [campaignTag],
      };

      const res = await fetch(`${BREVO_API_BASE}/smtp/email`, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        result.sent += chunk.length;
      } else if (res.status === 401) {
        console.error("[Brevo] 401 Unauthorized — API key is invalid or revoked");
        result.failed += chunk.length;
        result.noCredits = true;
        for (const c of chunk) {
          result.errors.push({ email: c.email, error: "API key inválida o revocada" });
        }
      } else if (res.status === 402) {
        result.noCredits = true;
        result.failed += chunk.length;
        for (const c of chunk) {
          result.errors.push({ email: c.email, error: "Sin créditos en Brevo" });
        }
        console.error("[Brevo] 402 Payment Required — no credits remaining");
      } else if (res.status === 429) {
        console.error("[Brevo] 429 Too Many Requests — rate limit exceeded, will retry after delay");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryRes = await fetch(`${BREVO_API_BASE}/smtp/email`, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify(payload),
        });
        if (retryRes.ok) {
          result.sent += chunk.length;
        } else {
          result.failed += chunk.length;
          for (const c of chunk) {
            result.errors.push({ email: c.email, error: "Límite de tasa excedido en Brevo" });
          }
        }
      } else {
        const errText = await res.text().catch(() => "Error desconocido");
        console.error(`[Brevo] Send error (${res.status}): ${errText}`);
        result.failed += chunk.length;
        for (const c of chunk) {
          result.errors.push({ email: c.email, error: `Error ${res.status}` });
        }
      }
    } catch (err: any) {
      console.error("[Brevo] Send batch error:", err.message);
      result.failed += chunk.length;
      for (const c of chunk) {
        result.errors.push({ email: c.email, error: err.message });
      }
    }
  }

  return result;
}
