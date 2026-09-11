/**
 * Proveedor genérico "API HTTP personalizada".
 * Compatible con APIs REST de envío: POST JSON con to/subject/htmlContent
 * y autenticación por header de API key.
 */

export interface CustomHttpConfig {
  endpointUrl: string;
  apiKey: string;
  authHeaderName: string;
  rateLimitPerMinute: number;
}

export interface CustomHttpSendResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeEndpointUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function validateCustomHttpConfig(input: {
  endpointUrl?: string;
  apiKey?: string;
  authHeaderName?: string;
  rateLimitPerMinute?: number;
}): { valid: boolean; error?: string; config?: CustomHttpConfig } {
  const endpointUrl = typeof input.endpointUrl === "string" ? normalizeEndpointUrl(input.endpointUrl) : "";
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const authHeaderName = (typeof input.authHeaderName === "string" && input.authHeaderName.trim())
    ? input.authHeaderName.trim()
    : "X-API-Key";
  const rateLimitPerMinute = typeof input.rateLimitPerMinute === "number"
    ? input.rateLimitPerMinute
    : Number(input.rateLimitPerMinute);

  if (!endpointUrl) {
    return { valid: false, error: "La URL del endpoint es requerida." };
  }
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    return { valid: false, error: "La URL del endpoint no es válida." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, error: "La URL debe usar http:// o https://." };
  }
  if (!apiKey) {
    return { valid: false, error: "La API key es requerida." };
  }
  if (!authHeaderName || !/^[A-Za-z0-9\-]+$/.test(authHeaderName)) {
    return { valid: false, error: "El nombre del header de autenticación no es válido." };
  }
  if (!Number.isFinite(rateLimitPerMinute) || rateLimitPerMinute < 1 || rateLimitPerMinute > 10000) {
    return { valid: false, error: "El límite de peticiones por minuto debe estar entre 1 y 10.000." };
  }

  return {
    valid: true,
    config: {
      endpointUrl,
      apiKey,
      authHeaderName,
      rateLimitPerMinute: Math.floor(rateLimitPerMinute),
    },
  };
}

/**
 * Prueba liviana: envía un body inválido a propósito.
 * - 401 → key incorrecta
 * - 400 / 422 → la API aceptó la autenticación (éxito de conexión)
 * - 200 → también se considera ok
 */
export async function probeCustomHttpConnection(config: CustomHttpConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(config.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [config.authHeaderName]: config.apiKey,
      },
      body: JSON.stringify({
        to: "not-an-email",
        subject: "postialo-connection-probe",
        htmlContent: "<p>probe</p>",
        attachments: null,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: body
          ? `Autenticación rechazada (${res.status}). Verifique la API key y el nombre del header.`
          : `Autenticación rechazada (${res.status}). Verifique la API key y el nombre del header.`,
      };
    }

    if (res.status === 404) {
      return { ok: false, error: "El endpoint no existe (404). Verifique la URL completa (por ejemplo .../mail)." };
    }

    if (res.status >= 500) {
      return { ok: false, error: `El servidor remoto respondió con error ${res.status}. Intente más tarde.` };
    }

    // 200 / 400 / 422 / etc. → autenticación pasó o al menos el host respondió
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: `No se pudo contactar el endpoint: ${err?.message || "error de red"}. Verifique la URL y la conectividad.`,
    };
  }
}

export async function sendOneCustomHttpEmail(
  config: CustomHttpConfig,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(config.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [config.authHeaderName]: config.apiKey,
      },
      body: JSON.stringify({
        to,
        subject,
        htmlContent,
        attachments: null,
      }),
    });

    if (res.ok) {
      return { success: true };
    }

    let detail = "";
    try {
      const data = await res.json();
      if (typeof data?.message === "string") detail = data.message;
      else if (Array.isArray(data?.message)) detail = data.message.join("; ");
      else detail = JSON.stringify(data).slice(0, 300);
    } catch {
      detail = await res.text().catch(() => "");
    }

    if (res.status === 401 || res.status === 403) {
      return { success: false, error: `Autenticación fallida (${res.status}). ${detail}`.trim() };
    }
    if (res.status === 429) {
      return { success: false, error: `Límite de tasa excedido (429). ${detail}`.trim() };
    }
    return { success: false, error: `Error del proveedor (${res.status}): ${detail || "sin detalle"}`.trim() };
  } catch (err: any) {
    return { success: false, error: `Error de red al enviar: ${err?.message || "desconocido"}` };
  }
}

/**
 * Envía un correo por destinatario respetando rateLimitPerMinute.
 * onProgress se invoca tras cada intento (útil para WS).
 */
export async function sendCustomHttpBatch(
  config: CustomHttpConfig,
  subject: string,
  htmlContent: string,
  contacts: Array<{ email: string; name?: string }>,
  onProgress?: (info: { sent: number; failed: number; total: number }) => void | Promise<void>,
): Promise<CustomHttpSendResult> {
  const intervalMs = Math.ceil(60_000 / Math.max(1, config.rateLimitPerMinute));
  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const started = Date.now();
    const result = await sendOneCustomHttpEmail(config, contact.email, subject, htmlContent);
    if (result.success) {
      sent += 1;
    } else {
      failed += 1;
      errors.push({ email: contact.email, error: result.error || "Error desconocido" });
    }

    if (onProgress) {
      await onProgress({ sent, failed, total: contacts.length });
    }

    if (i < contacts.length - 1) {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, intervalMs - elapsed);
      if (wait > 0) await sleep(wait);
    }
  }

  return { sent, failed, errors };
}
