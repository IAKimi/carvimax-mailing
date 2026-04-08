const BREVO_API_BASE = "https://api.brevo.com/v3";

interface BrevoAccountResponse {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  plan?: Array<{ type?: string; credits?: number }>;
}

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

interface BrevoSendersResponse {
  senders?: Array<{ id?: number; name?: string; email?: string; active?: boolean }>;
}

interface BrevoWebhookResponse {
  id?: number;
}

interface BrevoBatchResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
  noCredits: boolean;
}

function parseAccountResponse(data: unknown): BrevoAccountInfo {
  const obj = (data && typeof data === "object" ? data : {}) as BrevoAccountResponse;
  return {
    email: obj.email || "",
    firstName: obj.firstName || "",
    lastName: obj.lastName || "",
    companyName: obj.companyName || "",
    plan: Array.isArray(obj.plan)
      ? obj.plan.map(p => ({ type: p.type || "", credits: p.credits || 0 }))
      : [],
  };
}

function parseSendersResponse(data: unknown): BrevoSender[] {
  const obj = (data && typeof data === "object" ? data : {}) as BrevoSendersResponse;
  if (!Array.isArray(obj.senders)) return [];
  return obj.senders.map(s => ({
    id: s.id || 0,
    name: s.name || "",
    email: s.email || "",
    active: s.active !== false,
  }));
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
      const data: unknown = await res.json();
      return { valid: true, account: parseAccountResponse(data) };
    }

    if (res.status === 401) {
      return { valid: false, error: "API key inválida. Verifica que la key sea correcta." };
    }

    if (res.status === 403) {
      const errText = await res.text().catch(() => "");
      if (errText.includes("account_under_validation")) {
        return { valid: false, error: "Tu cuenta de Brevo está en proceso de validación. Intenta más tarde." };
      }
      if (errText.includes("permission_denied")) {
        return { valid: false, error: "La API key no tiene permisos suficientes. Genera una nueva key con permisos completos." };
      }
      return { valid: false, error: "Acceso denegado por Brevo. Verifica el estado de tu cuenta." };
    }

    const errText = await res.text().catch(() => "Error desconocido");
    return { valid: false, error: `Error de Brevo (${res.status}): ${errText}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { valid: false, error: `Error de conexión con Brevo: ${message}` };
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

    const data: unknown = await res.json();
    const allSenders = parseSendersResponse(data);
    const activeSenders = allSenders.filter(s => s.active);

    return { senders: activeSenders };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { senders: [], error: `Error de conexión: ${message}` };
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
        batched: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Error desconocido");
      console.error(`[Brevo] Failed to create webhook (${res.status}): ${errText}`);
      return { webhookId: null, error: `Error al crear webhook (${res.status})` };
    }

    const data: unknown = await res.json();
    const webhookData = (data && typeof data === "object" ? data : {}) as BrevoWebhookResponse;
    return { webhookId: webhookData.id ? String(webhookData.id) : null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[Brevo] Webhook creation error:", message);
    return { webhookId: null, error: `Error de conexión: ${message}` };
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[Brevo] Webhook deletion error:", message);
  }
}

const BATCH_SIZE = 1000;

async function sendChunk(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch(`${BREVO_API_BASE}/smtp/email`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });
}

function markChunkFailed(
  result: BrevoBatchResult,
  chunk: Array<{ name: string; email: string }>,
  errorMsg: string
): void {
  result.failed += chunk.length;
  for (const c of chunk) {
    result.errors.push({ email: c.email, error: errorMsg });
  }
}

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
      markChunkFailed(result, chunk, "Sin créditos en Brevo");
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

      const res = await sendChunk(apiKey, payload);

      if (res.ok) {
        result.sent += chunk.length;
      } else if (res.status === 401) {
        console.error("[Brevo] 401 Unauthorized — API key is invalid or revoked");
        result.noCredits = true;
        markChunkFailed(result, chunk, "API key inválida o revocada");
      } else if (res.status === 402) {
        console.error("[Brevo] 402 Payment Required — no credits remaining");
        result.noCredits = true;
        markChunkFailed(result, chunk, "Sin créditos en Brevo");
      } else if (res.status === 429) {
        console.error("[Brevo] 429 Too Many Requests — rate limit exceeded, retrying after delay");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryRes = await sendChunk(apiKey, payload);
        if (retryRes.ok) {
          result.sent += chunk.length;
        } else {
          markChunkFailed(result, chunk, "Límite de tasa excedido en Brevo");
        }
      } else if (res.status === 403) {
        const errText = await res.text().catch(() => "");
        if (errText.includes("account_under_validation")) {
          console.error("[Brevo] 403 — account under validation");
          result.noCredits = true;
          markChunkFailed(result, chunk, "Cuenta de Brevo en proceso de validación");
        } else if (errText.includes("permission_denied")) {
          console.error("[Brevo] 403 — permission denied");
          result.noCredits = true;
          markChunkFailed(result, chunk, "Permisos insuficientes en la cuenta de Brevo");
        } else {
          console.error(`[Brevo] 403 Forbidden: ${errText}`);
          markChunkFailed(result, chunk, "Acceso denegado por Brevo");
        }
      } else {
        const errText = await res.text().catch(() => "Error desconocido");
        console.error(`[Brevo] Send error (${res.status}): ${errText}`);
        markChunkFailed(result, chunk, `Error ${res.status}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      console.error("[Brevo] Send batch error:", message);
      markChunkFailed(result, chunk, message);
    }
  }

  return result;
}
