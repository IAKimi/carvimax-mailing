import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateImage, editImage, editImageAdvanced, isGeminiConfigured, type AdvancedAction } from "./gemini";
import { generateEmailContent, regenerateEmailContent, generateTemplateHtml, editTemplateHtml, analyzeTemplatePlaceholders, isOpenAIConfigured } from "./openai";
import { validateTemplatePlaceholders, validateTemplateStructure, renderTemplateWithContent } from "./templates";
import { campaigns as campaignsTable } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { decryptApiKey } from "./encryption";
import { sendBatchEmails } from "./providers/brevo";

let wss: WebSocketServer | null = null;

interface ResolvedCampaignContent {
  contentJson: Record<string, unknown>;
  imageUrl: string | null;
}

type ResolverVersion = { id?: number; type: string; isSelected: boolean | null; contentJson: unknown; imageUrl: string | null; versionNumber?: number; sentHtml?: string | null };

// Returns the active text-type version (initial or text). User edits always land on these versions.
// image-type versions bake in a text snapshot at creation time but never receive user edits.
function pickTextSourceVersion(versions: ResolverVersion[]): ResolverVersion | undefined {
  const ordered = [...versions].sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));
  const textVersions = ordered.filter(v => v.type === "initial" || v.type === "text");
  const lastSelected = [...textVersions].reverse().find(v => v.isSelected);
  return lastSelected || textVersions[textVersions.length - 1];
}

function getResolvedCampaignContent(versions: ResolverVersion[]): ResolvedCampaignContent {
  const ordered = [...versions].sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));

  // Text MUST come from initial/text-type versions only — the frontend edits land there.
  // image-type versions carry a stale text snapshot and must never override user edits.
  const selectedText = pickTextSourceVersion(ordered);

  // Image source must be a version that actually carries an image (initial or image type).
  const imageVersions = ordered.filter(v => v.type === "initial" || v.type === "image");
  const lastSelectedImage = [...imageVersions].reverse().find(v => v.isSelected);
  const selectedImage = lastSelectedImage || imageVersions[imageVersions.length - 1];

  const contentJson = (selectedText?.contentJson as Record<string, unknown>) || {};
  const imageUrl = selectedImage?.imageUrl || selectedText?.imageUrl || null;

  return { contentJson, imageUrl };
}

// ─── Error sanitisation helper ────────────────────────────────────────────────
// Messages from AI providers (Gemini, OpenAI) are never shown directly to users.
// We log the raw error internally and return a clean Spanish generic message.
const USER_SAFE_MESSAGES: Record<string, string> = {
  image_generate:    "Error al generar tu imagen. Por favor intenta de nuevo en unos minutos.",
  image_edit:        "Error al editar la imagen. Por favor intenta de nuevo en unos minutos.",
  text_generate:     "No pudimos generar el texto en este momento. Por favor intenta de nuevo.",
  text_regenerate:   "No pudimos regenerar el texto en este momento. Por favor intenta de nuevo.",
  template_generate: "Error al generar la plantilla. Por favor intenta de nuevo.",
};

// Allowlist of message prefixes produced by our own modules (gemini.ts / openai.ts).
// IMPORTANT: a message must also pass the secondary PROVIDER_TERMS_RE check below.
const SAFE_MESSAGE_ALLOWLIST = [
  "El prompt fue bloqueado por políticas de recitación",
  "Imagen bloqueada por filtros de seguridad en las categorías",
  "La edición fue bloqueada por políticas de recitación",
  "Edición bloqueada por filtros de seguridad en las categorías",
  "La idea fue rechazada por las políticas de contenido",
  "El contenido fue rechazado por las políticas de contenido",
  "Tipo de imagen no soportado",
  "Imagen de referencia",
  "El peso total de las imágenes",
];

// Secondary blocklist applied even on allowlisted messages — catches any provider name
// or HTTP code that slipped through despite matching an allowlist prefix.
const PROVIDER_TERMS_RE = /\b(gemini|openai|google|base64|api[\s\-]?key)\b|\(\d{3}\)/i;

function toUserSafeMessage(err: any, kind: keyof typeof USER_SAFE_MESSAGES): string {
  const msg: string = typeof err?.message === "string" ? err.message : "";
  const status: number | undefined = err?.status;

  // Always log the full technical detail internally for diagnosis.
  console.error(`[AI][${kind}]`, {
    message: msg || "(empty)",
    status,
    code: err?.code,
    type: err?.type,
    name: err?.name,
  });

  const fallback = USER_SAFE_MESSAGES[kind] ?? "Ocurrió un error. Por favor intenta de nuevo.";

  // Map known HTTP status codes to user-safe Spanish messages.
  if (status === 401) return "La configuración del servicio de IA no está activa. Contacta al administrador.";
  if (status === 429) return "El servicio de IA está temporalmente saturado. Intenta de nuevo en unos minutos.";
  if (status === 503 || status === 500) return fallback;

  if (!msg) return fallback;

  // Only allow through messages that:
  //   1) Match an explicit allowlist prefix (known internal module message), AND
  //   2) Contain no provider names, HTTP codes, or technical terms (secondary guard).
  if (SAFE_MESSAGE_ALLOWLIST.some(safe => msg.startsWith(safe)) && !PROVIDER_TERMS_RE.test(msg)) {
    return msg;
  }

  // Block everything else — provider names, HTTP codes, English SDK text, raw errors.
  return fallback;
}

// Returns true when the image URL cannot be loaded as real base64 by Gemini:
// placehold.co placeholders and external URLs that are not from our own uploads dir.
function isInvalidImageSource(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.includes("placehold.co")) return true;
  // External URLs not from our own /uploads/campaigns/ can't be loaded as base64
  if ((url.startsWith("http://") || url.startsWith("https://")) &&
      !url.includes("/uploads/campaigns/")) return true;
  return false;
}

// Resolves what was actually sent, for historical fidelity (resend popup, duplications of sent campaigns).
// Falls back to the current resolved content when no sentHtml exists yet.
function getSentCampaignContent(versions: ResolverVersion[]): ResolvedCampaignContent {
  const ordered = [...versions].sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));
  // Prefer the FIRST version that received a sentHtml stamp — that's the snapshot
  // that triggered the real send. Later sentHtml stamps (re-sends, retries) shouldn't
  // shadow the original send for resend prefill purposes.
  const sentVersions = ordered.filter(v => v.sentHtml);
  const firstSent = sentVersions[0];
  if (!firstSent) return getResolvedCampaignContent(versions);

  const imageVersions = ordered.filter(v => v.type === "initial" || v.type === "image");
  // Prefer the image version closest to (and not after) the sent version.
  const sentVN = firstSent.versionNumber ?? 0;
  const imageAtOrBeforeSend = [...imageVersions].reverse().find(v => (v.versionNumber ?? 0) <= sentVN);
  const imageSrc = imageAtOrBeforeSend || imageVersions[imageVersions.length - 1];

  const contentJson = (firstSent.contentJson as Record<string, unknown>) || {};
  const imageUrl = imageSrc?.imageUrl || firstSent.imageUrl || null;
  return { contentJson, imageUrl };
}

function pickContentByStatus(status: string | null | undefined, versions: ResolverVersion[]): ResolvedCampaignContent {
  if (status === "sent" || status === "partial" || status === "failed") {
    return getSentCampaignContent(versions);
  }
  return getResolvedCampaignContent(versions);
}

function broadcastWs(type: string, data: any) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Demasiados intentos. Intente de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: "Demasiadas solicitudes de generación. Intente de nuevo en 5 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede exceder 200 caracteres"),
  email: z.string().email("Correo electrónico inválido").max(255, "El correo no puede exceder 255 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(128, "La contraseña no puede exceder 128 caracteres")
    .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "La contraseña debe contener al menos un número"),
  company: z.string().max(200, "La empresa no puede exceder 200 caracteres").optional(),
});

const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200, "El nombre no puede exceder 200 caracteres"),
  idea: z.string().min(1).max(1000, "La idea no puede exceder 1000 caracteres"),
  objective: z.string().min(1).max(1000, "El objetivo no puede exceder 1000 caracteres"),
  tone: z.string().min(1).max(100, "El tono no puede exceder 100 caracteres"),
  layoutPreference: z.string().max(100).optional(),
  imagePrompt: z.string().max(1200, "El prompt de imagen no puede exceder 1200 caracteres").nullable().optional(),
  targetDatabase: z.string().max(200).nullable().optional(),
  targetAudience: z.string().max(1000, "El público objetivo no puede exceder 1000 caracteres").nullable().optional(),
  templateId: z.number().int().positive().nullable().optional(),
  providerId: z.number().int().positive().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
});

const updateCampaignSchema = createCampaignSchema.partial().extend({
  textApproved: z.boolean().optional(),
  imageApproved: z.boolean().optional(),
});

const createContactSchema = z.object({
  email: z.string().email("Correo electrónico inválido").max(255, "El correo no puede exceder 255 caracteres"),
  name: z.string().max(200, "El nombre no puede exceder 200 caracteres").optional(),
  position: z.string().max(100, "El cargo no puede exceder 100 caracteres").optional(),
  segment: z.string().max(100, "El segmento no puede exceder 100 caracteres").optional(),
});

const updateContactSchema = createContactSchema.partial();

const updateBrandIdentitySchema = z.object({
  companyName: z.string().max(200).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  website: z.string().max(500).transform(
    (val) => {
      if (!val || val.length === 0) return val;
      if (!val.startsWith("http://") && !val.startsWith("https://")) {
        return "https://" + val;
      }
      return val;
    }
  ).nullable().optional(),
  whatsapp: z.string().max(30).refine(
    (val) => !val || val.length === 0 || /^[+\d\s()-]+$/.test(val),
    "El WhatsApp solo puede contener números, +, espacios, guiones y paréntesis"
  ).nullable().optional(),
  mission: z.string().max(2000).nullable().optional(),
  vision: z.string().max(2000).nullable().optional(),
  products: z.string().max(2000).nullable().optional(),
  history: z.string().max(2000).nullable().optional(),
  styleGuide: z.string().max(2000).nullable().optional(),
  targetAudience: z.string().max(2000).nullable().optional(),
  tone: z.string().max(200).nullable().optional(),
  primaryColor: z.string().max(20).nullable().optional(),
  secondaryColor: z.string().max(20).nullable().optional(),
  accentColor: z.string().max(20).nullable().optional(),
  headingFont: z.string().max(100).nullable().optional(),
  bodyFont: z.string().max(100).nullable().optional(),
  logoUrl: z.string().max(3000000).nullable().optional(),
  visualStyle: z.string().max(50).nullable().optional(),
  senderName: z.string().max(200).nullable().optional(),
  senderEmail: z.string().max(200).refine(
    (val) => !val || val.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    "El correo del remitente no es válido"
  ).nullable().optional(),
});

const updateVersionSchema = z.object({
  contentJson: z.record(z.unknown()).optional(),
  isSelected: z.boolean().optional(),
  imageUrl: z.string().optional(),
  textApproved: z.boolean().optional(),
  imageApproved: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200, "El nombre no puede exceder 200 caracteres").optional(),
  html: z.string().min(1).max(50000, "El HTML no puede exceder 50000 caracteres").optional(),
  favorite: z.boolean().optional(),
});

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["scheduled", "draft", "cancelled", "sending", "sent"],
  sending: ["sent", "partial", "failed", "cancelled"],
  sent: [],
  partial: ["draft", "scheduled"],
  failed: ["draft", "scheduled"],
  cancelled: ["draft", "scheduled"],
};


function deleteUploadedFile(filePath: string): void {
  try {
    if (!filePath || filePath.startsWith("http")) return;
    const safeName = path.basename(filePath);
    if (!safeName || safeName === "." || safeName === "..") return;
    const campaignsDir = path.resolve(process.cwd(), "uploads", "campaigns");
    const fullPath = path.join(campaignsDir, safeName);
    if (!fullPath.startsWith(campaignsDir + path.sep)) return;
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err: any) {
    console.error("Error deleting file:", filePath, err.message);
  }
}

function deleteLogoFile(logoUrl: string): void {
  try {
    if (!logoUrl) return;
    const match = logoUrl.match(/\/uploads\/logos\/([^/?]+)/);
    if (!match) return;
    const safeName = path.basename(match[1]);
    if (!safeName || safeName === "." || safeName === "..") return;
    const logosDir = path.resolve(process.cwd(), "uploads", "logos");
    const fullPath = path.join(logosDir, safeName);
    if (!fullPath.startsWith(logosDir + path.sep)) return;
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err: any) {
    console.error("Error deleting logo file:", err.message);
  }
}

async function cleanupCampaignFiles(campaignId: number): Promise<void> {
  try {
    const versions = await storage.getCampaignVersions(campaignId);
    for (const v of versions) {
      if (v.imageUrl) {
        deleteUploadedFile(v.imageUrl);
      }
    }
    const campaign = await storage.getCampaign(campaignId);
    if (campaign?.selectedImageUrl) {
      deleteUploadedFile(campaign.selectedImageUrl);
    }
  } catch (err: any) {
    console.error("Error cleaning up campaign files:", campaignId, err.message);
  }
}

function normalizeKey(k: string): string {
  return k
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
const EMAIL_ALIASES = new Set(['email', 'correo', 'correo electronico', 'e-mail', 'mail']);
const NAME_ALIASES = new Set(['name', 'nombre', 'nombre completo', 'nombres', 'full name']);
const POSITION_ALIASES = new Set(['position', 'cargo', 'puesto']);
const SEGMENT_ALIASES = new Set(['segment', 'segmento', 'categoria', 'tipo']);

function resolveContactRow(row: Record<string, string>): { email: string; name: string; position: string; segment: string } {
  let email = '', name = '', position = '', segment = '';
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeKey(k);
    const val = String(v ?? '').trim();
    if (!email && EMAIL_ALIASES.has(nk)) email = val.toLowerCase();
    else if (!name && NAME_ALIASES.has(nk)) name = val;
    else if (!position && POSITION_ALIASES.has(nk)) position = val;
    else if (!segment && SEGMENT_ALIASES.has(nk)) segment = val;
  }
  return { email, name, position, segment };
}

function saveBase64Image(base64DataUrl: string, prefix: string = "img"): string {
  const match = base64DataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!match) return base64DataUrl;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const filename = `${prefix}_${crypto.randomBytes(12).toString("hex")}.${ext}`;
  const uploadsDir = path.resolve(process.cwd(), "uploads", "campaigns");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return filename;
}

function getImagePublicUrl(filename: string, req?: Request): string {
  if (filename.startsWith("http://") || filename.startsWith("https://") || filename.startsWith("data:")) {
    return filename;
  }
  let baseUrl: string;
  if (req && req.headers) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    baseUrl = `${protocol}://${host}`;
  } else if (process.env.APP_URL || process.env.PRODUCTION_URL) {
    baseUrl = (process.env.APP_URL || process.env.PRODUCTION_URL)!.replace(/\/$/, "");
  } else {
    if (process.env.NODE_ENV === 'production') {
      baseUrl = 'https://mailing.postialo.com';
    } else {
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
      baseUrl = domain.startsWith('localhost') ? `http://${domain}` : `https://${domain}`;
    }
  }
  if (process.env.NODE_ENV === 'production' && baseUrl.includes('localhost')) {
    console.error('[getImagePublicUrl] CRITICAL: localhost fallback en producción. Filename:', filename);
  }
  return `${baseUrl}/uploads/campaigns/${filename}`;
}

function loadImageAsBase64(imageUrl: string): string {
  if (imageUrl.startsWith("data:")) return imageUrl;
  let candidate = imageUrl;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    if (imageUrl.includes("/uploads/campaigns/")) {
      candidate = imageUrl.split("/uploads/campaigns/").pop() || imageUrl;
    } else {
      return imageUrl;
    }
  }
  const basename = path.basename(candidate);
  if (basename !== candidate || basename.includes("..")) return imageUrl;
  const uploadsDir = path.resolve(process.cwd(), "uploads", "campaigns");
  const filePath = path.join(uploadsDir, basename);
  if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) return imageUrl;
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(basename).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function cleanHtmlForEmail(html: string): string {
  return html
    .replace(/\s+xmlns="[^"]*"/g, "")
    .replace(/\s+xmlns:[a-z]+="[^"]*"/g, "")
    .replace(/<([a-z]+)([^>]*?)\s*\/>/gi, (match, tag, attrs) => {
      const voidElements = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"];
      if (voidElements.includes(tag.toLowerCase())) {
        return `<${tag}${attrs}>`;
      }
      return `<${tag}${attrs}></${tag}>`;
    });
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function sanitizeUser(user: Record<string, unknown>) {
  const { password, verificationToken, verificationTokenExpiresAt, ...safe } = user;
  return safe;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autenticado." });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "Usuario no encontrado." });
  }
  if (!user.isActive) {
    req.session.destroy(() => {});
    return res.status(403).json({ message: "Cuenta desactivada. Contacte al administrador." });
  }
  next();
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    ws.on("error", () => {});
  });
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
      wss!.handleUpgrade(req, socket, head, (ws) => {
        wss!.emit("connection", ws, req);
      });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health/storage", (_req, res) => {
    const uploadsDir = path.resolve(process.cwd(), "uploads", "campaigns");
    const isProd = process.env.NODE_ENV === "production";
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const testFile = path.join(uploadsDir, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
      const files = fs.readdirSync(uploadsDir).filter((f) => !f.startsWith("."));
      res.json({
        status: "ok",
        writable: true,
        ...(isProd ? {} : { directory: uploadsDir }),
        fileCount: files.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        status: "error",
        writable: false,
        ...(isProd ? {} : { directory: uploadsDir }),
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(409).json({ message: "Ya existe una cuenta con este correo electrónico." });
      }
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const verificationToken = crypto.randomUUID();
      const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await storage.createUser({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        company: input.company || null,
      });

      await storage.setVerificationToken(user.id, verificationToken, verificationTokenExpiresAt);

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["host"] || "localhost:5000";
      const verificationLink = `${protocol}://${host}/api/auth/verify/${verificationToken}`;

      const webhookUrl = process.env.MAKE_VERIFICATION_WEBHOOK_URL || "https://hook.us2.make.com/8cvfysvskqxngepd1aczaaxckbchfv6l";
      try {
        const webhookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "verification",
            email: user.email,
            name: user.name,
            company: user.company || "",
            verificationLink,
          }),
        });
        if (!webhookRes.ok) {
          console.error(`[register] Verification webhook returned ${webhookRes.status}: ${await webhookRes.text().catch(() => "")}`);
        }
      } catch (webhookErr) {
        console.error("[register] Failed to call verification webhook:", webhookErr);
      }

      res.status(201).json({ 
        success: true,
        message: "Cuenta creada. Revisa tu correo para verificar tu cuenta.",
        needsVerification: true,
        email: user.email,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        return res.status(401).json({ message: "Correo o contraseña incorrectos." });
      }
      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Correo o contraseña incorrectos." });
      }
      if (!user.isActive) {
        return res.status(403).json({ message: "Cuenta desactivada. Contacte al administrador." });
      }
      if (!user.isVerified) {
        return res.status(403).json({ message: "Cuenta no verificada. Revisa tu correo electrónico para confirmar tu cuenta.", needsVerification: true, email: user.email });
      }
      req.session.userId = user.id;
      res.json(sanitizeUser(user));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autenticado." });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado." });
    }
    const result: any = sanitizeUser(user);
    if (req.session.originalAdminId) {
      result.impersonating = true;
      result.impersonatingUserName = req.session.impersonatingUserName;
      result.originalAdminId = req.session.originalAdminId;
    }
    res.json(result);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión." });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Sesión cerrada." });
    });
  });

  app.get("/api/auth/verify/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.redirect("/verify/error?reason=invalid");
      }
      if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
        return res.redirect("/verify/error?reason=expired");
      }
      if (!user.isVerified) {
        await storage.verifyUser(user.id);
      }
      req.session.userId = user.id;
      res.redirect("/");
    } catch (err) {
      console.error("[verify] Error:", err);
      res.redirect("/verify/error?reason=server");
    }
  });

  app.get("/api/auth/verification-status/:email", async (req, res) => {
    const email = req.params.email;
    if (!email) {
      return res.status(400).json({ message: "Email requerido." });
    }
    const user = await storage.getUserByEmail(email);
    res.json({ verified: user?.isVerified === true });
  });

  app.post("/api/auth/resend-verification", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email requerido." });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "Si el correo existe, se enviará un nuevo enlace de verificación." });
      }
      if (user.isVerified) {
        return res.json({ message: "La cuenta ya está verificada." });
      }
      const verificationToken = crypto.randomUUID();
      const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.setVerificationToken(user.id, verificationToken, verificationTokenExpiresAt);

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["host"] || "localhost:5000";
      const verificationLink = `${protocol}://${host}/api/auth/verify/${verificationToken}`;

      const webhookUrl = process.env.MAKE_VERIFICATION_WEBHOOK_URL || "https://hook.us2.make.com/8cvfysvskqxngepd1aczaaxckbchfv6l";
      try {
        const webhookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "verification",
            email: user.email,
            name: user.name,
            company: user.company || "",
            verificationLink,
          }),
        });
        if (!webhookRes.ok) {
          console.error(`[resend-verification] Webhook returned ${webhookRes.status}: ${await webhookRes.text().catch(() => "")}`);
        }
      } catch (webhookErr) {
        console.error("[resend-verification] Failed to call webhook:", webhookErr);
      }
      res.json({ message: "Si el correo existe, se enviará un nuevo enlace de verificación." });
    } catch (err) {
      console.error("[resend-verification] Error:", err);
      res.status(500).json({ message: "Error al reenviar verificación." });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats(req.session.userId!);
    res.json(stats);
  });

  app.get("/api/dashboard/metrics", requireAuth, async (req, res) => {
    try {
      const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
      const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
      const metrics = await storage.getDashboardMetrics(req.session.userId!, dateFrom, dateTo);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Error al obtener métricas del dashboard" });
    }
  });

  app.get("/api/campaigns", requireAuth, async (req, res) => {
    const yearParam = req.query.year ? Number(req.query.year) : undefined;
    const monthParam = req.query.month ? Number(req.query.month) : undefined;
    const campaigns = await storage.getCampaignsLight(req.session.userId!, yearParam, monthParam);
    const resolved = campaigns.map((c: any) => ({
      ...c,
      selectedImageUrl: c.selectedImageUrl ? getImagePublicUrl(c.selectedImageUrl, req) : c.selectedImageUrl,
    }));
    res.json(resolved);
  });

  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    const resolved = {
      ...campaign,
      selectedImageUrl: (campaign as any).selectedImageUrl ? getImagePublicUrl((campaign as any).selectedImageUrl, req) : (campaign as any).selectedImageUrl,
    };
    res.json(resolved);
  });

  app.post("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const input = createCampaignSchema.parse(req.body);
      const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      if (scheduledAt && isNaN(scheduledAt.getTime())) {
        return res.status(400).json({ message: "La fecha programada no es válida." });
      }
      if (scheduledAt && scheduledAt.getTime() < Date.now()) {
        return res.status(400).json({ message: "La fecha programada debe ser en el futuro." });
      }
      const campaign = await storage.createCampaign({
        ...input,
        userId: req.session.userId!,
        scheduledAt,
        status: "draft",
      } as any);
      res.status(201).json(campaign);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/campaigns/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const existing = await storage.getCampaign(id);
    if (!existing || existing.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    try {
      const { status, ...rest } = req.body;
      const input = updateCampaignSchema.parse(rest);
      const updates: any = {};
      if (existing.status === "sent") {
        const contentKeys = ["name", "idea", "objective", "tone", "imagePrompt", "layoutPreference", "targetAudience"];
        const hasContentChanges = contentKeys.some(k => (input as any)[k] !== undefined);
        if (hasContentChanges) {
          return res.status(400).json({ message: "No se puede editar el contenido de un correo ya enviado." });
        }
      }
      Object.assign(updates, input);
      if (updates.imageApproved === true) {
        const currentImageUrl = existing.selectedImageUrl || "";
        if (currentImageUrl.includes("placehold.co")) {
          return res.status(400).json({ message: "No se puede aprobar una imagen placeholder. Regenere o cargue una imagen real primero." });
        }
      }
      if (input.scheduledAt) {
        const newDate = new Date(input.scheduledAt);
        if (isNaN(newDate.getTime())) {
          return res.status(400).json({ message: "La fecha programada no es válida." });
        }
        const fifteenMinutesFromNow = Date.now() + 15 * 60 * 1000;
        if (newDate.getTime() < fifteenMinutesFromNow) {
          return res.status(400).json({ message: "La fecha programada debe ser al menos 15 minutos en el futuro." });
        }
        if (existing.status === "scheduled" && existing.scheduledAt) {
          const existingTime = new Date(existing.scheduledAt).getTime();
          const now = Date.now();
          const fifteenMinFromNow = now + 15 * 60 * 1000;
          // Only block when the scheduled send is still in the future but within the 15-min window.
          // If the scheduled time has already passed, allow rescheduling — the user needs that path.
          if (existingTime > now && existingTime <= fifteenMinFromNow) {
            return res.status(400).json({ message: "No puedes cambiar la fecha porque estás a menos de 15 minutos del envío programado." });
          }
        }
        updates.scheduledAt = newDate;
      }
      if (status) {
        if (!["draft", "scheduled", "sent", "cancelled"].includes(status)) {
          return res.status(400).json({ message: "Estado inválido." });
        }
        const allowed = VALID_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(status)) {
          return res.status(400).json({ message: `No se puede cambiar el estado de "${existing.status}" a "${status}".` });
        }
        if (status === "scheduled") {
          const mergedTextApproved = updates.textApproved !== undefined ? updates.textApproved : existing.textApproved;
          const mergedImageApproved = updates.imageApproved !== undefined ? updates.imageApproved : existing.imageApproved;
          if (!mergedTextApproved || !mergedImageApproved) {
            return res.status(400).json({ message: "Ambas aprobaciones (texto e imagen) son requeridas para programar." });
          }
        }
        if (status === "sent") {
          if (!existing.templateId) {
            return res.status(400).json({ message: "Debe seleccionar una plantilla antes de enviar." });
          }
          if (!existing.targetDatabase) {
            return res.status(400).json({ message: "Debe seleccionar una base de datos de contactos antes de enviar." });
          }
        }
        updates.status = status;
      }
      const campaign = await storage.updateCampaign(id, updates);
      res.json(campaign);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/campaigns/thumbnails", requireAuth, async (req, res) => {
    const { campaignIds } = req.body || {};
    if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
      return res.json({});
    }
    const ids = campaignIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id)).slice(0, 50);
    const userCampaigns = await storage.getCampaignsLight(req.session.userId!);
    const ownedIds = new Set(userCampaigns.map(c => c.id));
    const validIds = ids.filter(id => ownedIds.has(id));
    if (validIds.length === 0) return res.json({});
    const thumbnails = await storage.getCampaignThumbnails(validIds);
    const result: Record<number, string | null> = {};
    for (const t of thumbnails) {
      result[t.campaignId] = t.imageUrl ? getImagePublicUrl(t.imageUrl, req) : null;
    }
    res.json(result);
  });

  app.get("/api/campaigns/:id/versions", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    const versions = await storage.getCampaignVersions(id);
    const resolvedVersions = versions.map(v => ({
      ...v,
      imageUrl: v.imageUrl ? getImagePublicUrl(v.imageUrl, req) : v.imageUrl,
    }));
    res.json(resolvedVersions);
  });

  app.post("/api/campaigns/:id/generate", requireAuth, aiLimiter, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled" || campaign.status === "sent") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado o enviado." });
    }
    const versions = await storage.getCampaignVersions(campaignId);
    const versionNumber = versions.length + 1;
    if (versionNumber > 3) {
      return res.status(400).json({ message: "Máximo 3 generaciones alcanzado." });
    }

    try {
    const imagePromise = (async () => {
      if (campaign.imagePrompt && isGeminiConfigured()) {
        try {
          return await generateImage(campaign.imagePrompt);
        } catch (err: any) {
          console.error("[Image API][image_generate] Error generando imagen inicial:", err.message);
          return "https://placehold.co/600x300/e3001b/white?text=Error+generando+imagen";
        }
      }
      if (!isGeminiConfigured()) {
        return "https://placehold.co/600x300/002073/white?text=Sin+API+Key";
      }
      return "https://placehold.co/600x300/002073/white?text=Sin+imagen";
    })();

    const templateLocked: string[] = campaign.templateId
      ? ((await storage.getTemplate(campaign.templateId))?.lockedFields as string[] || [])
      : [];

    const textPromise = (async () => {
      if (campaign.idea && campaign.objective && isOpenAIConfigured()) {
        try {
          const brandData = await storage.getBrandIdentity(req.session.userId!);
          const result = await generateEmailContent(campaign.idea, campaign.objective, brandData || null, campaign.targetAudience, templateLocked);
          console.log("[OpenAI] Texto generado exitosamente:", JSON.stringify({ asunto: result.asunto, cta: result.cta_text }));
          return result;
        } catch (err: any) {
          console.error("[OpenAI] ERROR generando texto:", {
            message: err.message,
            status: err.status,
            code: err.code,
            type: err.type,
            name: err.name,
            stack: err.stack?.split("\n").slice(0, 3).join(" | "),
          });
          return null;
        }
      }
      console.warn("[OpenAI] Skipped: idea=", !!campaign.idea, "objective=", !!campaign.objective, "configured=", isOpenAIConfigured());
      return null;
    })();

    const [rawImageUrl, emailContent] = await Promise.all([imagePromise, textPromise]);

    const imageFilename = rawImageUrl ? saveBase64Image(rawImageUrl, `campaign_${campaignId}`) : null;
    const imageUrl = imageFilename ? getImagePublicUrl(imageFilename, req) : null;

    const contentJson = emailContent
      ? {
          asunto: emailContent.asunto,
          preheader: emailContent.preheader,
          cuerpo_html: emailContent.cuerpo_html,
          cta_text: emailContent.cta_text,
        }
      : (() => {
          console.warn("OpenAI no disponible — usando texto placeholder");
          return {
            asunto: "Borrador - Pendiente de generación IA",
            preheader: "",
            cuerpo_html: `<p>El contenido de este correo no pudo ser generado automáticamente. Use el botón <strong>Regenerar Texto</strong> para intentar de nuevo, o edite este texto manualmente.</p>`,
            cta_text: "Ver más",
          };
        })();

    if (versionNumber === 1) {
      await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl } as any);
    }
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson,
      imageUrl,
      isSelected: versionNumber === 1
    });
    res.status(201).json(newVersion);
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "text_generate") });
    }
  });

  app.post("/api/campaigns/:id/regenerate-text", requireAuth, aiLimiter, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled" || campaign.status === "sent") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado o enviado." });
    }
    const textRegenCount = campaign.textRegenCount || 0;
    if (textRegenCount >= 2) {
      return res.status(400).json({ message: "Máximo 2 regeneraciones de texto alcanzado." });
    }

    const { corrections } = req.body || {};
    if (!corrections || typeof corrections !== "string") {
      return res.status(400).json({ message: "Debe proporcionar correcciones de texto." });
    }
    if (corrections.length > 1000) {
      return res.status(400).json({ message: "Las correcciones no pueden exceder 1000 caracteres." });
    }

    const versions = await storage.getCampaignVersions(campaignId);
    const textVersions = versions.filter(v => v.type === "initial" || v.type === "text");
    const selectedTextVersion = textVersions.find(v => v.isSelected) || textVersions[textVersions.length - 1];
    if (!selectedTextVersion) {
      return res.status(400).json({ message: "No hay versión previa para regenerar." });
    }

    const previousContent = selectedTextVersion.contentJson as any;
    const previousEmail = {
      asunto: previousContent?.asunto || "",
      preheader: previousContent?.preheader || "",
      cuerpo_html: previousContent?.cuerpo_html || previousContent?.html || "",
      cta_text: previousContent?.cta_text || previousContent?.cta || "Ver más",
    };

    const templateLockedRegen: string[] = campaign.templateId
      ? ((await storage.getTemplate(campaign.templateId))?.lockedFields as string[] || [])
      : [];

    let contentJson;
    try {
      if (!isOpenAIConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de texto no está disponible en este momento." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const emailContent = await regenerateEmailContent(
        campaign.idea,
        campaign.objective,
        previousEmail,
        corrections,
        brandData || null,
        campaign.targetAudience,
        templateLockedRegen
      );
      contentJson = {
        asunto: emailContent.asunto,
        preheader: emailContent.preheader,
        cuerpo_html: emailContent.cuerpo_html,
        cta_text: emailContent.cta_text,
        cta_url: previousContent?.cta_url || "",
        cta_enabled: previousContent?.cta_enabled !== false,
      };
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "text_regenerate") });
    }

    const resolved = getResolvedCampaignContent(versions);
    const textVersionNumber = textVersions.length + 1;
    await storage.deselectVersionsByType(campaignId, ["initial", "text"]);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber: textVersionNumber,
      contentJson,
      imageUrl: resolved.imageUrl || null,
      isSelected: true,
      type: "text",
    });
    await storage.incrementRegenCount(campaignId, "textRegenCount");
    await storage.updateCampaign(campaignId, { textApproved: false } as any);
    res.status(201).json(newVersion);
  });

  app.post("/api/campaigns/:id/regenerate-image", requireAuth, aiLimiter, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled" || campaign.status === "sent") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado o enviado." });
    }
    const imageRegenCount = campaign.imageRegenCount || 0;
    if (imageRegenCount >= 2) {
      return res.status(400).json({ message: "Máximo 2 regeneraciones de imagen alcanzado." });
    }

    const { imagePrompt } = req.body || {};
    if (!imagePrompt || typeof imagePrompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar un prompt de imagen." });
    }
    if (imagePrompt.length > 1200) {
      return res.status(400).json({ message: "El prompt de imagen no puede exceder 1200 caracteres." });
    }

    let rawImageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de imágenes no está disponible en este momento." });
      }
      rawImageUrl = await generateImage(imagePrompt);
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "image_generate") });
    }

    const imageUrl = getImagePublicUrl(saveBase64Image(rawImageUrl, `campaign_${campaignId}`), req);

    const versions = await storage.getCampaignVersions(campaignId);
    const resolved = getResolvedCampaignContent(versions);
    const imageVersions = versions.filter(v => v.type === "initial" || v.type === "image");
    const imageVersionNumber = imageVersions.length + 1;

    await storage.deselectVersionsByType(campaignId, ["initial", "image"]);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber: imageVersionNumber,
      contentJson: resolved.contentJson,
      imageUrl,
      isSelected: true,
      type: "image",
    });
    await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl, imageApproved: false } as any);
    await storage.incrementRegenCount(campaignId, "imageRegenCount");
    res.status(201).json(newVersion);
  });

  app.post("/api/campaigns/:id/edit-image", requireAuth, aiLimiter, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled" || campaign.status === "sent") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado o enviado." });
    }
    const imageRegenCount = campaign.imageRegenCount || 0;
    if (imageRegenCount >= 2) {
      return res.status(400).json({ message: "Máximo 2 regeneraciones de imagen alcanzado." });
    }

    const { editPrompt } = req.body || {};
    if (!editPrompt || typeof editPrompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar instrucciones de edición." });
    }
    if (editPrompt.length > 1200) {
      return res.status(400).json({ message: "Las instrucciones de edición no pueden exceder 1200 caracteres." });
    }

    const versions = await storage.getCampaignVersions(campaignId);
    const imageVersions = versions.filter(v => v.type === "initial" || v.type === "image");
    const selectedImageVersion = imageVersions.find(v => v.isSelected) || imageVersions[imageVersions.length - 1];
    if (!selectedImageVersion?.imageUrl) {
      return res.status(400).json({ message: "No hay imagen previa para editar." });
    }
    if (isInvalidImageSource(selectedImageVersion.imageUrl)) {
      return res.status(400).json({ message: "Primero genera o sube una imagen real antes de editarla con IA." });
    }

    const currentImageBase64 = loadImageAsBase64(selectedImageVersion.imageUrl);

    let rawImageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de imágenes no está disponible en este momento." });
      }
      rawImageUrl = await editImage(currentImageBase64, editPrompt);
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "image_edit") });
    }

    const imageUrl = getImagePublicUrl(saveBase64Image(rawImageUrl, `campaign_${campaignId}`), req);
    const resolved = getResolvedCampaignContent(versions);
    const imageVersionNumber = imageVersions.length + 1;

    await storage.deselectVersionsByType(campaignId, ["initial", "image"]);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber: imageVersionNumber,
      contentJson: resolved.contentJson,
      imageUrl,
      isSelected: true,
      type: "image",
    });
    await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl, imageApproved: false } as any);
    await storage.incrementRegenCount(campaignId, "imageRegenCount");
    res.status(201).json(newVersion);
  });

  app.post("/api/campaigns/:id/upload-image", requireAuth, async (req, res) => {
    try {
      const campaignId = parseId(req.params.id);
      if (!campaignId) return res.status(400).json({ message: "ID inválido." });
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== req.session.userId) {
        return res.status(404).json({ message: "Campaña no encontrada." });
      }
      if (campaign.status === "cancelled" || campaign.status === "sent") {
        return res.status(400).json({ message: "No se puede modificar un correo cancelado o enviado." });
      }
      const { imageBase64 } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/")) {
        return res.status(400).json({ message: "Imagen inválida. Debe ser una imagen en formato base64." });
      }
      const imageUrl = getImagePublicUrl(saveBase64Image(imageBase64, `campaign_${campaignId}`), req);
      const versions = await storage.getCampaignVersions(campaignId);
      const imageVersions = versions.filter(v => v.type === "initial" || v.type === "image");
      const resolved = getResolvedCampaignContent(versions);
      const imageVersionNumber = imageVersions.length + 1;
      await storage.deselectVersionsByType(campaignId, ["initial", "image"]);
      const newVersion = await storage.createCampaignVersion({
        campaignId,
        versionNumber: imageVersionNumber,
        contentJson: resolved.contentJson,
        imageUrl,
        isSelected: true,
        type: "image",
      });
      await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl, imageApproved: false } as any);
      res.json({ version: newVersion, imageUrl });
    } catch (err: any) {
      console.error("Error subiendo imagen:", err.message);
      res.status(500).json({ message: "Error al guardar la imagen." });
    }
  });

  const VALID_ADVANCED_ACTIONS: AdvancedAction[] = ["agregar", "reemplazar", "fusionar", "estilo", "borrar_elemento"];

  app.post("/api/campaigns/:id/edit-image-advanced", requireAuth, aiLimiter, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled" || campaign.status === "sent") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado o enviado." });
    }
    const imageRegenCount = campaign.imageRegenCount || 0;
    if (imageRegenCount >= 2) {
      return res.status(400).json({ message: "Máximo 2 regeneraciones de imagen alcanzado." });
    }

    const { editPrompt, selectedAction, referenceImages } = req.body || {};

    if (!editPrompt || typeof editPrompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar instrucciones de edición." });
    }
    if (editPrompt.length > 1200) {
      return res.status(400).json({ message: "Las instrucciones no pueden exceder 1200 caracteres." });
    }
    if (!selectedAction || !VALID_ADVANCED_ACTIONS.includes(selectedAction)) {
      return res.status(400).json({ message: "Acción no válida. Opciones: agregar, reemplazar, fusionar, estilo, borrar_elemento." });
    }

    const rawRefs: string[] = Array.isArray(referenceImages) ? referenceImages : [];
    if (rawRefs.length > 3) {
      return res.status(400).json({ message: "Máximo 3 imágenes de referencia permitidas." });
    }
    const refs: string[] = [];
    for (const ref of rawRefs) {
      if (typeof ref !== "string") {
        return res.status(400).json({ message: "Cada imagen de referencia debe ser un string válido." });
      }
      if (ref.startsWith("data:image/")) {
        refs.push(ref);
      } else if (ref.includes("/uploads/campaigns/")) {
        const rawFilename = ref.split("/uploads/campaigns/").pop() || "";
        const safeFilename = path.basename(rawFilename);
        if (!safeFilename || safeFilename.includes("..")) {
          return res.status(400).json({ message: "Nombre de archivo de referencia inválido." });
        }
        refs.push(loadImageAsBase64(safeFilename));
      } else {
        return res.status(400).json({ message: "Formato de imagen de referencia no válido." });
      }
    }
    const versions = await storage.getCampaignVersions(campaignId);
    const imageVersions = versions.filter(v => v.type === "initial" || v.type === "image");
    const selectedImageVersion = imageVersions.find(v => v.isSelected) || imageVersions[imageVersions.length - 1];
    if (!selectedImageVersion?.imageUrl) {
      return res.status(400).json({ message: "No hay imagen previa para editar." });
    }
    if (isInvalidImageSource(selectedImageVersion.imageUrl)) {
      return res.status(400).json({ message: "Primero genera o sube una imagen real antes de editarla con IA." });
    }

    const currentImageBase64 = loadImageAsBase64(selectedImageVersion.imageUrl);

    let rawImageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de imágenes no está disponible en este momento." });
      }
      rawImageUrl = await editImageAdvanced({
        currentImageBase64,
        referenceImagesBase64: refs,
        userText: editPrompt,
        selectedAction: selectedAction as AdvancedAction,
      });
    } catch (err: any) {
      const msg: string = err?.message || "";
      // Detect user-input validation errors (format, size, action type) that warrant a 400.
      // These specific prefixes come from gemini.ts and never contain provider names.
      const is400 = msg.startsWith("Tipo de imagen no soportado")
        || msg.startsWith("Imagen de referencia")
        || msg.startsWith("El peso total de las imágenes")
        || msg.startsWith("Acción no válida");
      if (is400) {
        // Even for 400s, run through the sanitizer — it logs and applies the secondary
        // provider-term guard, guaranteeing no provider name ever reaches the user.
        return res.status(400).json({ message: toUserSafeMessage(err, "image_edit") });
      }
      return res.status(500).json({ message: toUserSafeMessage(err, "image_edit") });
    }

    const imageUrl = getImagePublicUrl(saveBase64Image(rawImageUrl, `campaign_${campaignId}`), req);
    const resolved = getResolvedCampaignContent(versions);
    const imageVersionNumber = imageVersions.length + 1;

    await storage.deselectVersionsByType(campaignId, ["initial", "image"]);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber: imageVersionNumber,
      contentJson: resolved.contentJson,
      imageUrl,
      isSelected: true,
      type: "image",
    });
    await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl, imageApproved: false } as any);
    await storage.incrementRegenCount(campaignId, "imageRegenCount");
    res.status(201).json(newVersion);
  });

  app.delete("/api/campaigns", requireAuth, async (req, res) => {
    const { ids } = req.body || {};
    if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0)) {
      return res.status(400).json({ message: "Debe proporcionar una lista válida de IDs." });
    }
    const userCampaigns = await storage.getCampaigns(req.session.userId!);
    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.filter((id: number) => userCampaigns.some(c => c.id === id));
      for (const id of validIds) {
        await cleanupCampaignFiles(id);
      }
      await storage.deleteCampaigns(validIds, req.session.userId!);
      res.json({ message: `${validIds.length} campaña(s) eliminada(s).` });
    } else {
      for (const c of userCampaigns) {
        await cleanupCampaignFiles(c.id);
      }
      await storage.deleteAllCampaigns(req.session.userId!);
      res.json({ message: "Historial eliminado." });
    }
  });

  app.post("/api/campaigns/:id/resend", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const original = await storage.getCampaign(id);
    if (!original || original.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }

    const { subject, preheader, body, cta, ctaUrl, targetDatabase, scheduledAt } = req.body || {};

    const originalVersions = await storage.getCampaignVersions(id);
    const resolved = originalVersions.length > 0
      ? pickContentByStatus(original.status, originalVersions)
      : { contentJson: {}, imageUrl: null };
    const origContent = resolved.contentJson;
    const selectedVersion = originalVersions.find(v => v.isSelected) || originalVersions[0];

    const campaignName = subject || (origContent.asunto as string) || `${original.name} (reenvío)`;

    const newCampaign = await storage.createCampaign({
      userId: req.session.userId!,
      name: `${campaignName} (reenvío)`,
      idea: original.idea,
      objective: original.objective,
      tone: original.tone,
      layoutPreference: original.layoutPreference,
      imagePrompt: original.imagePrompt || null,
      targetDatabase: targetDatabase || original.targetDatabase || null,
      selectedImageUrl: original.selectedImageUrl || null,
      targetAudience: original.targetAudience || null,
      templateId: original.templateId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    if (selectedVersion) {
      await storage.updateCampaign(newCampaign.id, {
        textApproved: true,
        imageApproved: true,
        ...(scheduledAt ? { status: "scheduled" } : {}),
      });
    } else if (scheduledAt) {
      await storage.updateCampaign(newCampaign.id, { status: "draft" });
    }

    if (selectedVersion) {
      const newContentJson: Record<string, unknown> = {
        ...origContent,
        asunto: subject ?? origContent.asunto,
        preheader: preheader ?? origContent.preheader,
        cuerpo_html: body ?? origContent.cuerpo_html,
        cta_text: cta ?? origContent.cta_text,
        cta_url: ctaUrl ?? origContent.cta_url,
      };

      await storage.createCampaignVersion({
        campaignId: newCampaign.id,
        versionNumber: 1,
        contentJson: newContentJson,
        imageUrl: resolved.imageUrl || selectedVersion.imageUrl || null,
        isSelected: true,
        type: "initial",
      });
    }

    const updated = await storage.getCampaign(newCampaign.id);
    res.status(201).json(updated);
  });

  app.patch("/api/versions/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const allCampaigns = await storage.getCampaigns(req.session.userId!);
    const campaignMap = new Map(allCampaigns.map(c => [c.id, c]));
    const existingVersions: any[] = [];
    for (const cId of campaignMap.keys()) {
      const vs = await storage.getCampaignVersions(cId);
      existingVersions.push(...vs);
    }
    const versionData = existingVersions.find(v => v.id === id);
    if (!versionData) {
      return res.status(404).json({ message: "Versión no encontrada." });
    }
    const parentCampaign = campaignMap.get(versionData.campaignId);
    if (parentCampaign && (parentCampaign.status === "sent" || parentCampaign.status === "cancelled")) {
      return res.status(400).json({ message: "No se puede modificar versiones de un correo enviado o cancelado." });
    }
    try {
      const rawInput = updateVersionSchema.parse(req.body);
      // When text content is edited on an initial/text version, auto-promote it
      // as the active text source so the resolver picks up the user's changes.
      let autoSelect = false;
      if (rawInput.contentJson && (versionData.type === "initial" || versionData.type === "text")) {
        await storage.deselectVersionsByType(versionData.campaignId, ["initial", "text"]);
        autoSelect = true;
      }
      const input = autoSelect ? { ...rawInput, isSelected: true } : rawInput;
      if (input.isSelected && !autoSelect) {
        if (versionData) {
          await storage.deselectAllVersions(versionData.campaignId);
          if (versionData.imageUrl) {
            await storage.updateCampaign(versionData.campaignId, { selectedImageUrl: versionData.imageUrl } as any);
          }
        }
      }
      const version = await storage.updateCampaignVersion(id, input);
      if (!version) {
        return res.status(404).json({ message: "Versión no encontrada." });
      }
      res.json(version);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/contact-databases", requireAuth, async (req, res) => {
    const dbs = await storage.getContactDatabases(req.session.userId!);
    res.json(dbs);
  });

  app.post("/api/contact-databases", requireAuth, async (req, res) => {
    const name = req.body.name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Nombre es requerido." });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ message: "El nombre no puede exceder 100 caracteres." });
    }
    const existingDbs = await storage.getContactDatabases(req.session.userId!);
    if (existingDbs.some(d => d.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({ message: "Ya existe una base de datos con ese nombre." });
    }
    const db = await storage.createContactDatabase({ userId: req.session.userId!, name: name.trim() });
    res.status(201).json(db);
  });

  app.delete("/api/contact-databases/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const dbs = await storage.getContactDatabases(req.session.userId!);
    if (!dbs.some(d => d.id === id)) {
      return res.status(404).json({ message: "Base de datos no encontrada." });
    }

    const userCampaigns = await storage.getCampaigns(req.session.userId!);
    const activeCampaignsUsingDb = userCampaigns.filter(
      c => c.targetDatabase === String(id) && (c.status === "draft" || c.status === "scheduled")
    );
    if (activeCampaignsUsingDb.length > 0) {
      const names = activeCampaignsUsingDb.map(c => c.name).join(", ");
      return res.status(400).json({
        message: `No se puede eliminar: esta base de datos está en uso por ${activeCampaignsUsingDb.length} campaña(s) activa(s): ${names}. Cambie la base de datos de esas campañas antes de eliminarla.`,
      });
    }

    await storage.deleteContactDatabase(id);
    res.json({ message: "Eliminada." });
  });

  app.get("/api/contact-databases/:id/contacts", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const dbs = await storage.getContactDatabases(req.session.userId!);
    if (!dbs.some(d => d.id === id)) {
      return res.status(404).json({ message: "Base de datos no encontrada." });
    }
    const contacts = await storage.getContacts(id);
    res.json(contacts);
  });

  app.post("/api/contact-databases/:id/contacts", requireAuth, async (req, res) => {
    const dbId = parseId(req.params.id);
    if (!dbId) return res.status(400).json({ message: "ID inválido." });
    const dbs = await storage.getContactDatabases(req.session.userId!);
    if (!dbs.some(d => d.id === dbId)) {
      return res.status(404).json({ message: "Base de datos no encontrada." });
    }
    try {
      const input = createContactSchema.parse(req.body);
      const existingContacts = await storage.getContacts(dbId);
      if (existingContacts.some(c => c.email.toLowerCase() === input.email.toLowerCase())) {
        return res.status(409).json({ message: "Ya existe un contacto con ese correo en esta base de datos." });
      }
      const contact = await storage.createContact({
        ...input,
        userId: req.session.userId!,
        databaseId: dbId,
      });
      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/contacts/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const existing = await storage.getContact(id);
    if (!existing || existing.userId !== req.session.userId) {
      return res.status(404).json({ message: "Contacto no encontrado." });
    }
    try {
      const input = updateContactSchema.parse(req.body);
      if (input.email && input.email.toLowerCase() !== existing.email.toLowerCase()) {
        const dbContacts = await storage.getContacts(existing.databaseId);
        if (dbContacts.some(c => c.id !== id && c.email.toLowerCase() === input.email!.toLowerCase())) {
          return res.status(409).json({ message: "Ya existe un contacto con ese email en esta base de datos." });
        }
      }
      const contact = await storage.updateContact(id, input);
      if (!contact) return res.status(404).json({ message: "Contacto no encontrado." });
      res.json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const existing = await storage.getContact(id);
    if (!existing || existing.userId !== req.session.userId) {
      return res.status(404).json({ message: "Contacto no encontrado." });
    }
    await storage.deleteContact(id);
    res.json({ message: "Eliminado." });
  });

  app.post("/api/contact-databases/:id/import", requireAuth, async (req, res) => {
    const dbId = parseId(req.params.id);
    if (!dbId) return res.status(400).json({ message: "ID inválido." });
    const dbs = await storage.getContactDatabases(req.session.userId!);
    if (!dbs.some(d => d.id === dbId)) {
      return res.status(404).json({ message: "Base de datos no encontrada." });
    }
    const { contacts: contactRows, mode } = req.body || {};
    if (!Array.isArray(contactRows) || contactRows.length === 0) {
      return res.status(400).json({ message: "Debe proporcionar al menos un contacto." });
    }
    if (contactRows.length > 5000) {
      return res.status(400).json({ message: "No se pueden importar más de 5000 contactos a la vez." });
    }
    if (contactRows.length > 0) {
      const firstRowKeys = Object.keys(contactRows[0]);
      const hasEmailColumn = firstRowKeys.some(k => EMAIL_ALIASES.has(normalizeKey(k)));
      if (!hasEmailColumn) {
        const detectedCols = firstRowKeys.map(k => k.replace(/^\uFEFF/, '').trim()).join('", "');
        return res.status(400).json({
          message: `No encontramos una columna de correo en el archivo. Las columnas detectadas son: "${detectedCols}". Renómbrela como "email" o "correo" e intente de nuevo.`,
        });
      }
    }
    const validContacts: Array<{ email: string; name?: string; position?: string; segment?: string }> = [];
    const errors: string[] = [];
    const seenEmails = new Set<string>();
    let duplicatesInCsv = 0;
    for (let i = 0; i < contactRows.length; i++) {
      const { email, name, position, segment } = resolveContactRow(contactRows[i]);
      if (!email || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email)) {
        errors.push(`Fila ${i + 1}: email inválido "${email}"`);
        continue;
      }
      if (seenEmails.has(email)) {
        duplicatesInCsv++;
        continue;
      }
      seenEmails.add(email);
      validContacts.push({
        email,
        name: name || undefined,
        position: position || undefined,
        segment: segment || undefined,
      });
    }
    if (validContacts.length === 0) {
      return res.status(400).json({ message: "No se encontraron contactos válidos.", errors });
    }
    if (mode === "overwrite") {
      await storage.deleteAllContacts(dbId);
    }
    let duplicatesInDb = 0;
    let contactsToInsert = validContacts;
    if (mode !== "overwrite") {
      const existingContacts = await storage.getContacts(dbId);
      const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase()));
      contactsToInsert = validContacts.filter(c => {
        if (existingEmails.has(c.email.toLowerCase())) {
          duplicatesInDb++;
          return false;
        }
        return true;
      });
      if (contactsToInsert.length === 0) {
        return res.status(200).json({ imported: 0, duplicates: duplicatesInDb + duplicatesInCsv, errors, message: "Todos los contactos ya existen en la base de datos." });
      }
    }
    const insertData = contactsToInsert.map(c => ({
      userId: req.session.userId!,
      databaseId: dbId,
      email: c.email,
      name: c.name || null,
      position: c.position || null,
      segment: c.segment || null,
    }));
    const created = await storage.createContacts(insertData);
    res.status(201).json({ imported: created.length, duplicates: duplicatesInCsv + duplicatesInDb, errors });
  });

  app.get("/api/system/outbound-ip", requireAuth, async (_req, res) => {
    try {
      const resp = await fetch("https://api.ipify.org?format=json");
      const data = await resp.json() as { ip?: string };
      res.json({ ip: data.ip || null });
    } catch {
      res.json({ ip: null });
    }
  });

  app.get("/api/onboarding-status", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const brand = await storage.getBrandIdentity(userId);
    const hasBrand = !!(brand && brand.companyName && brand.industry);
    const providers = await storage.getEmailProviders(userId);
    const hasProvider = providers.some(p => p.isActive);
    const templates = await storage.getTemplates(userId);
    const hasTemplates = templates.length > 0;
    const contactDbs = await storage.getContactDatabases(userId);
    const hasContactDatabases = contactDbs.length > 0;
    res.json({ hasBrand, hasProvider, hasTemplates, hasContactDatabases });
  });

  app.get("/api/brand-identity", requireAuth, async (req, res) => {
    const brand = await storage.getBrandIdentity(req.session.userId!);
    res.json(brand || null);
  });

  app.put("/api/brand-identity", requireAuth, async (req, res) => {
    try {
      const input = updateBrandIdentitySchema.parse(req.body);
      const existingBrand = await storage.getBrandIdentity(req.session.userId!);
      if (existingBrand?.logoUrl && input.logoUrl !== undefined && input.logoUrl !== existingBrand.logoUrl) {
        deleteLogoFile(existingBrand.logoUrl);
      }
      const brand = await storage.upsertBrandIdentity(req.session.userId!, input);
      res.json(brand);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post("/api/brand/logo-upload", requireAuth, async (req, res) => {
    try {
      const { base64 } = req.body;
      if (!base64 || typeof base64 !== "string") {
        return res.status(400).json({ message: "Debe proporcionar la imagen en base64." });
      }
      const match = base64.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ message: "Formato de imagen inválido." });
      }
      const originalFormat = match[2];
      const originalBuffer = Buffer.from(match[3], "base64");
      if (originalBuffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ message: "La imagen no puede exceder 2MB." });
      }
      const existingBrand = await storage.getBrandIdentity(req.session.userId!);
      if (existingBrand?.logoUrl) {
        deleteLogoFile(existingBrand.logoUrl);
      }

      const needsConversion = originalFormat !== "png";
      let finalBuffer: Buffer;
      if (needsConversion) {
        const sharp = (await import("sharp")).default;
        finalBuffer = await sharp(originalBuffer).png().toBuffer();
      } else {
        finalBuffer = originalBuffer;
      }

      const filename = `${req.session.userId}_${crypto.randomBytes(8).toString("hex")}.png`;
      const uploadsDir = path.resolve(process.cwd(), "uploads", "logos");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, filename), finalBuffer);
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const logoUrl = `${protocol}://${host}/uploads/logos/${filename}`;
      await storage.upsertBrandIdentity(req.session.userId!, { logoUrl });
      res.json({ logoUrl, converted: needsConversion });
    } catch (err: any) {
      console.error("Error uploading logo:", err.message);
      return res.status(500).json({ message: "Error al subir el logo." });
    }
  });

  // ── Email Provider Configuration ──

  app.post("/api/email-provider/connect", requireAuth, async (req, res) => {
    try {
      const { provider, apiKey: rawApiKey } = req.body;
      if (!provider || !rawApiKey) {
        return res.status(400).json({ message: "Proveedor y API key son requeridos." });
      }
      const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : rawApiKey;
      if (!["brevo", "mailchimp"].includes(provider)) {
        return res.status(400).json({ message: "Proveedor no soportado. Use 'brevo' o 'mailchimp'." });
      }

      if (provider === "brevo") {
        const { validateApiKey: validateBrevo, getSenders: getBrevoSenders, createTrackingWebhook } = await import("./providers/brevo");
        const validation = await validateBrevo(apiKey);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error || "API key inválida." });
        }

        const existing = await storage.getEmailProvider(req.session.userId!, provider);
        if (existing) {
          if (existing.webhookId) {
            const { deleteWebhook } = await import("./providers/brevo");
            const { decryptApiKey } = await import("./encryption");
            try {
              const oldKey = decryptApiKey(existing.encryptedApiKey, existing.iv, existing.authTag);
              await deleteWebhook(oldKey, existing.webhookId);
            } catch {}
          }
          await storage.deleteEmailProvider(existing.id);
        }

        const { encryptApiKey } = await import("./encryption");
        const encrypted = encryptApiKey(apiKey);

        const protocol = req.headers["x-forwarded-proto"] || req.protocol;
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        const callbackUrl = `${protocol}://${host}/api/webhooks/brevo`;
        const webhookResult = await createTrackingWebhook(apiKey, callbackUrl);

        const sendersResult = await getBrevoSenders(apiKey);
        const defaultSender = sendersResult.senders.find(s => s.active) || sendersResult.senders[0];

        const planInfo = validation.account?.plan?.map(p => `${p.type}`).join(", ") || "N/A";

        const created = await storage.createEmailProvider({
          userId: req.session.userId!,
          provider,
          encryptedApiKey: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          isActive: true,
          senderEmail: defaultSender?.email || null,
          senderName: defaultSender?.name || null,
          webhookId: webhookResult.webhookId,
          accountEmail: validation.account?.email || null,
          accountPlan: planInfo,
        });

        const allProviders = await storage.getEmailProviders(req.session.userId!);
        const activeProviders = allProviders.filter(p => p.isActive);
        if (activeProviders.length === 1) {
          await storage.updateEmailProvider(created.id, { isDefault: true });
        }

        res.status(201).json({
          id: created.id,
          provider: created.provider,
          isActive: created.isActive,
          senderEmail: created.senderEmail,
          senderName: created.senderName,
          accountEmail: created.accountEmail,
          accountPlan: created.accountPlan,
          webhookConfigured: !!webhookResult.webhookId,
          senders: sendersResult.senders,
        });
      } else if (provider === "mailchimp") {
        const { validateApiKey: validateMailchimp, getAudiences } = await import("./providers/mailchimp");
        const validation = await validateMailchimp(apiKey);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error || "API key inválida." });
        }

        const existing = await storage.getEmailProvider(req.session.userId!, provider);
        if (existing) {
          await storage.deleteEmailProvider(existing.id);
        }

        const { encryptApiKey } = await import("./encryption");
        const encrypted = encryptApiKey(apiKey);

        let autoAudienceId: string | null = null;
        let audiencesList: Array<{ id: string; name: string; memberCount: number; defaultFromName?: string; defaultFromEmail?: string }> = [];
        let audienceWarning: string | null = null;
        let autoSenderEmail: string | null = null;
        let autoSenderName: string | null = null;
        if (validation.dataCenter) {
          const audiencesResult = await getAudiences(apiKey, validation.dataCenter);
          if (audiencesResult.error) {
            audienceWarning = "Conectado exitosamente, pero no se pudieron obtener las audiencias. Inténtalo de nuevo desde la tarjeta de Mailchimp.";
          } else {
            audiencesList = audiencesResult.audiences;
            if (audiencesList.length === 1) {
              autoAudienceId = audiencesList[0].id;
              autoSenderEmail = audiencesList[0].defaultFromEmail || null;
              autoSenderName = audiencesList[0].defaultFromName || null;
            }
          }
        }
        if (!autoSenderEmail && validation.account?.email) {
          autoSenderEmail = validation.account.email;
          autoSenderName = autoSenderName || `${validation.account.firstName || ""} ${validation.account.lastName || ""}`.trim() || validation.account.accountName || null;
        }

        const created = await storage.createEmailProvider({
          userId: req.session.userId!,
          provider,
          encryptedApiKey: encrypted.encrypted,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          isActive: true,
          senderEmail: autoSenderEmail,
          senderName: autoSenderName,
          webhookId: null,
          accountEmail: validation.account?.email || null,
          accountPlan: `${validation.account?.totalSubscribers || 0} suscriptores`,
          mailchimpDataCenter: validation.dataCenter || null,
          mailchimpAudienceId: autoAudienceId,
        });

        const allProviders = await storage.getEmailProviders(req.session.userId!);
        const activeProviders = allProviders.filter(p => p.isActive);
        if (activeProviders.length === 1) {
          await storage.updateEmailProvider(created.id, { isDefault: true });
        }

        res.status(201).json({
          id: created.id,
          provider: created.provider,
          isActive: created.isActive,
          senderEmail: created.senderEmail,
          senderName: created.senderName,
          accountEmail: created.accountEmail,
          accountPlan: created.accountPlan,
          accountName: validation.account?.accountName || null,
          audiences: audiencesList,
          selectedAudienceId: autoAudienceId,
          ...(audienceWarning ? { warning: audienceWarning } : {}),
        });
      }
    } catch (err: any) {
      console.error("Error connecting email provider:", err.message);
      return res.status(500).json({ message: "Error al conectar el proveedor." });
    }
  });

  app.delete("/api/email-provider/:provider", requireAuth, async (req, res) => {
    try {
      const { provider } = req.params;
      const existing = await storage.getEmailProvider(req.session.userId!, provider);
      if (!existing) {
        return res.status(404).json({ message: "Proveedor no encontrado." });
      }

      if (existing.webhookId && provider === "brevo") {
        try {
          const { decryptApiKey } = await import("./encryption");
          const { deleteWebhook } = await import("./providers/brevo");
          const apiKey = decryptApiKey(existing.encryptedApiKey, existing.iv, existing.authTag);
          await deleteWebhook(apiKey, existing.webhookId);
        } catch (err: any) {
          console.error("Error deleting webhook during disconnect:", err.message);
        }
      }

      await storage.deleteEmailProvider(existing.id);

      const remaining = await storage.getEmailProviders(req.session.userId!);
      const activeRemaining = remaining.filter(p => p.isActive);
      if (activeRemaining.length === 1 && !activeRemaining[0].isDefault) {
        await storage.updateEmailProvider(activeRemaining[0].id, { isDefault: true });
      }

      res.json({ message: "Proveedor desconectado exitosamente." });
    } catch (err: any) {
      console.error("Error disconnecting email provider:", err.message);
      return res.status(500).json({ message: "Error al desconectar el proveedor." });
    }
  });

  app.get("/api/email-provider/status", requireAuth, async (req, res) => {
    try {
      const providers = await storage.getEmailProviders(req.session.userId!);
      const { decryptApiKey } = await import("./encryption");
      const safe = providers.map(p => {
        let maskedKey = "";
        try {
          const fullKey = decryptApiKey(p.encryptedApiKey, p.iv, p.authTag);
          maskedKey = fullKey.slice(-4);
        } catch {}
        return {
          id: p.id,
          provider: p.provider,
          isActive: p.isActive,
          isDefault: p.isDefault,
          senderEmail: p.senderEmail,
          senderName: p.senderName,
          accountEmail: p.accountEmail,
          accountPlan: p.accountPlan,
          webhookConfigured: !!p.webhookId,
          maskedKey,
          createdAt: p.createdAt,
        };
      });
      res.json(safe);
    } catch (err: any) {
      console.error("Error fetching email provider status:", err.message);
      return res.status(500).json({ message: "Error al obtener el estado de proveedores." });
    }
  });

  app.get("/api/email-provider/:provider/senders", requireAuth, async (req, res) => {
    try {
      const { provider } = req.params;
      const existing = await storage.getEmailProvider(req.session.userId!, provider);
      if (!existing) {
        return res.status(404).json({ message: "Proveedor no configurado." });
      }

      const { decryptApiKey } = await import("./encryption");
      const apiKey = decryptApiKey(existing.encryptedApiKey, existing.iv, existing.authTag);

      if (provider === "brevo") {
        const { getSenders } = await import("./providers/brevo");
        const result = await getSenders(apiKey);
        if (result.error) {
          return res.status(502).json({ message: result.error });
        }
        res.json({ senders: result.senders });
      } else if (provider === "mailchimp") {
        const { getVerifiedDomains, getAudiences } = await import("./providers/mailchimp");
        const dc = existing.mailchimpDataCenter || "";
        const domainsResult = await getVerifiedDomains(apiKey, dc);
        const audiencesResult = await getAudiences(apiKey, dc);
        const audienceSenders = (audiencesResult.audiences || [])
          .filter(a => a.defaultFromEmail)
          .map(a => ({ email: a.defaultFromEmail!, name: a.defaultFromName || "", source: `Audiencia: ${a.name}` }));
        res.json({
          domains: domainsResult.error ? [] : domainsResult.domains,
          senders: audienceSenders,
          currentSender: { email: existing.senderEmail, name: existing.senderName },
        });
      } else {
        return res.status(400).json({ message: "Proveedor no soportado." });
      }
    } catch (err: any) {
      console.error("Error fetching senders:", err.message);
      return res.status(500).json({ message: "Error al obtener los remitentes." });
    }
  });

  app.get("/api/email-provider/mailchimp/audiences", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getEmailProvider(req.session.userId!, "mailchimp");
      if (!existing) {
        return res.status(404).json({ message: "Mailchimp no está configurado." });
      }

      const { decryptApiKey } = await import("./encryption");
      const apiKey = decryptApiKey(existing.encryptedApiKey, existing.iv, existing.authTag);
      const { getAudiences } = await import("./providers/mailchimp");
      const dc = existing.mailchimpDataCenter || "";
      const result = await getAudiences(apiKey, dc);
      if (result.error) {
        return res.status(502).json({ message: result.error });
      }
      res.json({ audiences: result.audiences, selectedAudienceId: existing.mailchimpAudienceId || null });
    } catch (err: any) {
      console.error("Error fetching Mailchimp audiences:", err.message);
      return res.status(500).json({ message: "Error al obtener las audiencias de Mailchimp." });
    }
  });

  app.patch("/api/email-provider/:id/audience", requireAuth, async (req, res) => {
    try {
      const providerId = parseInt(req.params.id);
      if (isNaN(providerId)) {
        return res.status(400).json({ message: "ID de proveedor inválido." });
      }
      const { audienceId } = req.body;
      if (!audienceId) {
        return res.status(400).json({ message: "ID de audiencia es requerido." });
      }

      const provider = await storage.getEmailProviderById(providerId);
      if (!provider || provider.userId !== req.session.userId!) {
        return res.status(404).json({ message: "Proveedor no encontrado." });
      }
      if (provider.provider !== "mailchimp") {
        return res.status(400).json({ message: "Solo Mailchimp usa audiencias." });
      }

      const { decryptApiKey } = await import("./encryption");
      const apiKey = decryptApiKey(provider.encryptedApiKey, provider.iv, provider.authTag);
      const { getAudiences } = await import("./providers/mailchimp");
      const dc = provider.mailchimpDataCenter || "";
      const audiencesResult = await getAudiences(apiKey, dc);
      if (audiencesResult.error) {
        return res.status(502).json({ message: "No se pudo verificar la audiencia con Mailchimp. Inténtalo de nuevo." });
      }
      const selectedAudience = audiencesResult.audiences.find((a) => a.id === audienceId);
      if (!selectedAudience) {
        return res.status(400).json({ message: "La audiencia seleccionada no existe en tu cuenta de Mailchimp." });
      }

      const updateData: Record<string, unknown> = { mailchimpAudienceId: audienceId };
      if (selectedAudience.defaultFromEmail) {
        updateData.senderEmail = selectedAudience.defaultFromEmail;
      }
      if (selectedAudience.defaultFromName) {
        updateData.senderName = selectedAudience.defaultFromName;
      }

      const updated = await storage.updateEmailProvider(providerId, updateData);
      res.json({ id: updated!.id, mailchimpAudienceId: updated!.mailchimpAudienceId, senderEmail: updated!.senderEmail, senderName: updated!.senderName });
    } catch (err: any) {
      console.error("Error updating audience:", err.message);
      return res.status(500).json({ message: "Error al actualizar la audiencia." });
    }
  });

  app.patch("/api/email-provider/:provider/sender", requireAuth, async (req, res) => {
    try {
      const { provider } = req.params;
      const { senderEmail, senderName } = req.body;
      if (!senderEmail) {
        return res.status(400).json({ message: "Email del remitente es requerido." });
      }

      const existing = await storage.getEmailProvider(req.session.userId!, provider);
      if (!existing) {
        return res.status(404).json({ message: "Proveedor no configurado." });
      }

      const updated = await storage.updateEmailProvider(existing.id, { senderEmail, senderName: senderName || null });
      res.json({
        id: updated!.id,
        provider: updated!.provider,
        senderEmail: updated!.senderEmail,
        senderName: updated!.senderName,
      });
    } catch (err: any) {
      console.error("Error updating sender:", err.message);
      return res.status(500).json({ message: "Error al actualizar el remitente." });
    }
  });

  app.patch("/api/email-provider/:id/default", requireAuth, async (req, res) => {
    try {
      const providerId = parseInt(req.params.id);
      if (isNaN(providerId)) {
        return res.status(400).json({ message: "ID de proveedor inválido." });
      }

      const provider = await storage.getEmailProviderById(providerId);
      if (!provider || provider.userId !== req.session.userId!) {
        return res.status(404).json({ message: "Proveedor no encontrado." });
      }

      const updated = await storage.setDefaultProvider(providerId, req.session.userId!);
      res.json({ id: updated!.id, provider: updated!.provider, isDefault: updated!.isDefault });
    } catch (err: any) {
      console.error("Error setting default provider:", err.message);
      return res.status(500).json({ message: "Error al establecer proveedor predeterminado." });
    }
  });

  app.delete("/api/email-provider/:id/default", requireAuth, async (req, res) => {
    try {
      const providerId = parseInt(req.params.id);
      if (isNaN(providerId)) {
        return res.status(400).json({ message: "ID de proveedor inválido." });
      }

      const provider = await storage.getEmailProviderById(providerId);
      if (!provider || provider.userId !== req.session.userId!) {
        return res.status(404).json({ message: "Proveedor no encontrado." });
      }

      const updated = await storage.updateEmailProvider(providerId, { isDefault: false } as any);
      res.json({ id: updated!.id, provider: updated!.provider, isDefault: false });
    } catch (err: any) {
      console.error("Error removing default provider:", err.message);
      return res.status(500).json({ message: "Error al quitar proveedor predeterminado." });
    }
  });

  // ── Templates ──

  app.get("/api/templates", requireAuth, async (req, res) => {
    const tpls = await storage.getTemplates(req.session.userId!);
    res.json(tpls);
  });

  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const createTemplateSchema = z.object({
        name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede exceder 200 caracteres"),
        html: z.string().min(1, "El HTML es requerido").max(50000, "El HTML no puede exceder 50000 caracteres"),
        lockedFields: z.array(z.string()).optional(),
      });
      const input = createTemplateSchema.parse(req.body);
      const sanitizedHtml = sanitizeHtml(input.html);
      const lockedFields = input.lockedFields || null;
      const validation = validateTemplatePlaceholders(sanitizedHtml, lockedFields);
      const tpl = await storage.createTemplate({ userId: req.session.userId!, name: input.name, html: sanitizedHtml, favorite: false, hasAllPlaceholders: validation.valid, lockedFields });
      res.status(201).json({ ...tpl, missingPlaceholders: validation.missing });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpls = await storage.getTemplates(req.session.userId!);
    if (!tpls.some(t => t.id === id)) return res.status(404).json({ message: "Plantilla no encontrada." });
    try {
      const input = updateTemplateSchema.parse(req.body);
      if (input.html) {
        input.html = sanitizeHtml(input.html);
        const existingTpl = tpls.find(t => t.id === id);
        const lf = (input as any).lockedFields ?? existingTpl?.lockedFields ?? null;
        const validation = validateTemplatePlaceholders(input.html, lf);
        (input as any).hasAllPlaceholders = validation.valid;
      }
      const tpl = await storage.updateTemplate(id, input);
      res.json(tpl);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpls = await storage.getTemplates(req.session.userId!);
    if (!tpls.some(t => t.id === id)) return res.status(404).json({ message: "Plantilla no encontrada." });

    const userCampaigns = await storage.getCampaigns(req.session.userId!);
    const activeCampaignsUsingTemplate = userCampaigns.filter(
      c => c.templateId === id && (c.status === "draft" || c.status === "scheduled")
    );
    if (activeCampaignsUsingTemplate.length > 0) {
      const names = activeCampaignsUsingTemplate.map(c => c.name).join(", ");
      return res.status(400).json({
        message: `No se puede eliminar: esta plantilla está en uso por ${activeCampaignsUsingTemplate.length} campaña(s) activa(s): ${names}. Cambie la plantilla de esas campañas antes de eliminarla.`,
      });
    }

    await storage.deleteTemplate(id);
    res.json({ message: "Eliminada." });
  });

  app.post("/api/templates/generate", requireAuth, aiLimiter, async (req, res) => {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar un prompt para la plantilla." });
    }
    if (prompt.length > 1000) {
      return res.status(400).json({ message: "El prompt no puede exceder 1000 caracteres." });
    }
    try {
      if (!isOpenAIConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de texto no está disponible en este momento." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const result = await generateTemplateHtml(prompt, brandData || null);

      const sanitizedHtml = sanitizeHtml(result.html);
      const validation = validateTemplatePlaceholders(sanitizedHtml);
      if (validation.missing.length > 0) {
        console.warn("AI template missing placeholders:", validation.missing);
      }
      const structureCheck = validateTemplateStructure(sanitizedHtml);
      if (!structureCheck.valid) {
        console.warn("AI template structure violation:", structureCheck.errors);
        return res.status(422).json({
          message: `La plantilla generada no cumple con la estructura estándar: ${structureCheck.errors.join(" ")} Se regenerará automáticamente.`,
        });
      }
      const existingTemplates = await storage.getTemplates(req.session.userId!);
      const templateNumber = existingTemplates.filter(t => t.isAiGenerated).length + 1;
      const standardName = `Plantilla ${templateNumber}`;
      const tpl = await storage.createTemplate({
        userId: req.session.userId!,
        name: standardName,
        html: sanitizedHtml,
        favorite: false,
        isAiGenerated: true,
        aiEditCount: 0,
        originalHtml: sanitizedHtml,
        hasAllPlaceholders: validation.valid,
        isConfirmed: false,
        versionNumber: 1,
      });
      const confirmed = await storage.updateTemplate(tpl.id, {
        parentTemplateId: tpl.id,
      });

      res.status(201).json(confirmed);
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "template_generate") });
    }
  });

  app.post("/api/templates/:id/edit-ai", requireAuth, aiLimiter, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpls = await storage.getTemplates(req.session.userId!);
    const tpl = tpls.find(t => t.id === id);
    if (!tpl) return res.status(404).json({ message: "Plantilla no encontrada." });
    if (tpl.isConfirmed) {
      return res.status(400).json({ message: "No se puede editar una plantilla confirmada con IA." });
    }
    const parentId = tpl.parentTemplateId || tpl.id;
    const siblings = await storage.getTemplateVersions(parentId);
    const totalVersions = siblings.length;
    if (totalVersions >= 3) {
      return res.status(400).json({ message: "Máximo 3 versiones alcanzado. Confirme una versión antes de generar más." });
    }
    const { instructions } = req.body || {};
    if (!instructions || typeof instructions !== "string") {
      return res.status(400).json({ message: "Debe proporcionar instrucciones de edición." });
    }
    if (instructions.length > 1000) {
      return res.status(400).json({ message: "Las instrucciones no pueden exceder 1000 caracteres." });
    }
    try {
      if (!isOpenAIConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de texto no está disponible en este momento." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const editedHtml = await editTemplateHtml(tpl.html, instructions, brandData || null);
      const sanitizedHtml = sanitizeHtml(editedHtml);
      const validation = validateTemplatePlaceholders(sanitizedHtml);
      const structureCheck = validateTemplateStructure(sanitizedHtml);
      if (!structureCheck.valid) {
        console.warn("AI edit structure violation:", structureCheck.errors);
        return res.status(422).json({
          message: `La edición no cumple con la estructura estándar: ${structureCheck.errors.join(" ")} Intente de nuevo con instrucciones diferentes.`,
        });
      }
      const newVersion = await storage.createTemplate({
        userId: req.session.userId!,
        name: tpl.name.replace(/ \(v\d+\)$/, '') + ` (v${totalVersions + 1})`,
        html: sanitizedHtml,
        favorite: false,
        isAiGenerated: true,
        aiEditCount: (tpl.aiEditCount || 0) + 1,
        originalHtml: tpl.originalHtml,
        hasAllPlaceholders: validation.valid,
        isConfirmed: false,
        parentTemplateId: parentId,
        versionNumber: totalVersions + 1,
      });
      res.status(201).json(newVersion);
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "template_generate") });
    }
  });

  app.post("/api/templates/analyze-html", requireAuth, aiLimiter, async (req, res) => {
    const { html } = req.body;
    if (!html || typeof html !== "string") return res.status(400).json({ message: "HTML requerido." });
    try {
      if (!isOpenAIConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de texto no está disponible en este momento." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const result = await analyzeTemplatePlaceholders(html, brandData || null);
      const sanitizedResult = sanitizeHtml(result.html);
      const validation = validateTemplatePlaceholders(sanitizedResult, result.lockedFields);
      res.json({ html: sanitizedResult, valid: validation.valid, missing: validation.missing, lockedFields: result.lockedFields });
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "template_generate") });
    }
  });

  app.post("/api/templates/:id/analyze", requireAuth, aiLimiter, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpls = await storage.getTemplates(req.session.userId!);
    const tpl = tpls.find(t => t.id === id);
    if (!tpl) return res.status(404).json({ message: "Plantilla no encontrada." });
    if (tpl.hasAllPlaceholders) return res.status(400).json({ message: "Esta plantilla ya tiene todos los placeholders." });
    try {
      if (!isOpenAIConfigured()) {
        return res.status(400).json({ message: "El servicio de generación de texto no está disponible en este momento." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const result = await analyzeTemplatePlaceholders(tpl.html, brandData || null);
      const sanitizedHtml = sanitizeHtml(result.html);
      const validation = validateTemplatePlaceholders(sanitizedHtml, result.lockedFields);
      const updated = await storage.updateTemplate(id, {
        html: sanitizedHtml,
        hasAllPlaceholders: validation.valid,
        lockedFields: result.lockedFields,
      } as any);
      res.json({ ...updated, missingPlaceholders: validation.missing });
    } catch (err: any) {
      return res.status(500).json({ message: toUserSafeMessage(err, "template_generate") });
    }
  });

  app.get("/api/templates/:id/versions", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpl = await storage.getTemplate(id);
    if (!tpl || tpl.userId !== req.session.userId) {
      return res.status(404).json({ message: "Plantilla no encontrada." });
    }
    const parentId = tpl.parentTemplateId || tpl.id;
    const versions = await storage.getTemplateVersions(parentId);
    res.json(versions);
  });

  app.post("/api/templates/:id/confirm", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpl = await storage.getTemplate(id);
    if (!tpl || tpl.userId !== req.session.userId) {
      return res.status(404).json({ message: "Plantilla no encontrada." });
    }
    const parentId = tpl.parentTemplateId || tpl.id;
    const confirmed = await storage.confirmTemplate(id, parentId);
    res.json(confirmed);
  });

  app.get("/api/campaigns/:id/preview-final", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const userCampaigns = await storage.getCampaigns(req.session.userId!);
    const campaign = userCampaigns.find(c => c.id === id);
    if (!campaign) return res.status(404).json({ message: "Campaña no encontrada." });
    if (!campaign.templateId) return res.status(400).json({ message: "Esta campaña no tiene una plantilla asignada." });
    const tpls = await storage.getTemplates(req.session.userId!);
    const template = tpls.find(t => t.id === campaign.templateId);
    if (!template) return res.status(404).json({ message: "Plantilla no encontrada." });
    const versions = await storage.getCampaignVersions(id);
    if (versions.length === 0) return res.status(400).json({ message: "No hay versiones generadas para esta campaña." });
    const resolved = getResolvedCampaignContent(versions);
    const brandData = await storage.getBrandIdentity(req.session.userId!);
    const imagePublicUrl = resolved.imageUrl ? getImagePublicUrl(resolved.imageUrl, req) : null;
    const result = renderTemplateWithContent(
      template.html,
      resolved.contentJson,
      imagePublicUrl,
      brandData
    );
    res.json({ html: result.html, missingFields: result.missingFields, templateName: template.name });
  });

  async function sendCampaignDirect(campaignId: number, userId: number, req?: Request): Promise<{ success: boolean; error?: string }> {
    let previousStatus = "draft";
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== userId) {
        return { success: false, error: "Campaña no encontrada." };
      }

      const providers = await storage.getEmailProviders(userId);
      let activeProvider = campaign.providerId
        ? providers.find(p => p.id === campaign.providerId && p.isActive)
        : null;
      if (!activeProvider) {
        activeProvider = providers.find(p => p.isDefault && p.isActive) || null;
      }
      if (!activeProvider) {
        activeProvider = providers.find(p => p.isActive) || null;
      }
      if (!activeProvider) {
        return { success: false, error: "No tienes un proveedor de email configurado. Ve a Configuración > Proveedor de Email para conectar tu cuenta." };
      }

      let apiKey: string;
      try {
        apiKey = decryptApiKey(activeProvider.encryptedApiKey, activeProvider.iv, activeProvider.authTag);
      } catch {
        return { success: false, error: "Error al descifrar la API key del proveedor. Reconecta tu proveedor de email." };
      }
      if (!campaign.templateId) {
        return { success: false, error: "La campaña no tiene plantilla asignada." };
      }
      if (!campaign.targetDatabase) {
        return { success: false, error: "La campaña no tiene base de datos de contactos asignada." };
      }

      const tpls = await storage.getTemplates(userId);
      const template = tpls.find(t => t.id === campaign.templateId);
      if (!template) {
        return { success: false, error: "Plantilla no encontrada." };
      }

      const versions = await storage.getCampaignVersions(campaignId);
      if (versions.length === 0) {
        return { success: false, error: "No hay versiones generadas para esta campaña." };
      }

      const resolved = getResolvedCampaignContent(versions);
      const brandData = await storage.getBrandIdentity(userId);

      const imagePublicUrl = resolved.imageUrl ? getImagePublicUrl(resolved.imageUrl, req) : null;

      const renderedHtml = renderTemplateWithContent(
        template.html,
        resolved.contentJson,
        imagePublicUrl,
        brandData
      ).html;

      const imageFilename = resolved.imageUrl;
      const isLocalImage = !!imageFilename && !imageFilename.startsWith("http://") && !imageFilename.startsWith("https://") && !imageFilename.startsWith("data:");
      const fileExists: boolean | null = isLocalImage
        ? fs.existsSync(path.resolve(process.cwd(), "uploads", "campaigns", imageFilename!))
        : null;
      const source = req
        ? "request-header"
        : process.env.APP_URL
          ? "APP_URL env"
          : process.env.PRODUCTION_URL
            ? "PRODUCTION_URL env"
            : "hardcoded fallback";
      console.log("[CAMPAIGN SEND]", {
        campaignId,
        imageFilename,
        imagePublicUrl,
        fileExists,
        isLocalImage,
        source,
        appUrlEnv: process.env.APP_URL || "(not set)",
        productionUrlEnv: process.env.PRODUCTION_URL || "(not set)",
        nodeEnv: process.env.NODE_ENV,
      });

      if (isLocalImage && fileExists === false) {
        const errMsg = `La imagen "${imageFilename}" no existe en el servidor (uploads/campaigns/). Regenera o sube la imagen de nuevo antes de enviar.`;
        console.error("[CAMPAIGN SEND] ABORT — archivo de imagen ausente:", { campaignId, imageFilename });
        return { success: false, error: errMsg };
      }

      // Stamp sentHtml on the text-type version that contributed the content,
      // so future resends can recover exactly what was sent (Task #17).
      const sourceVersion = pickTextSourceVersion(versions);
      if (sourceVersion?.id) {
        await storage.updateCampaignVersion(sourceVersion.id, { sentHtml: renderedHtml } as any);
      }

      const dbId = parseInt(campaign.targetDatabase, 10);
      if (isNaN(dbId)) {
        return { success: false, error: "Base de datos de contactos inválida." };
      }
      const contactDbs = await storage.getContactDatabases(userId);
      const targetDb = contactDbs.find(db => db.id === dbId);
      if (!targetDb) {
        return { success: false, error: "La base de datos de contactos no pertenece a este usuario." };
      }
      const contactsList = await storage.getContacts(dbId);
      if (contactsList.length === 0) {
        return { success: false, error: "La base de datos de contactos está vacía." };
      }

      const subject = (resolved.contentJson?.asunto as string) || campaign.name || "Sin asunto";

      const senderName = activeProvider.senderName || brandData?.senderName || brandData?.companyName || "PostIAlo Mailing";
      const senderEmail = activeProvider.senderEmail || brandData?.senderEmail || "noreply@postialo.com";

      await storage.deleteCampaignSends(campaignId);
      const sendRecords = contactsList.map(c => ({
        campaignId,
        contactEmail: c.email,
        contactName: c.name || null,
        status: "pending" as const,
      }));
      await storage.createCampaignSends(sendRecords);

      previousStatus = campaign.status || "draft";
      await storage.updateCampaign(campaignId, {
        status: "sending",
      } as any);
      await db.update(campaignsTable).set({
        totalExpectedSends: contactsList.length,
        sentCount: 0,
        failedCount: 0,
      }).where(eq(campaignsTable.id, campaignId));

      broadcastWs("campaign-progress", {
        campaignId,
        totalExpectedSends: contactsList.length,
        sentCount: 0,
        failedCount: 0,
        status: "sending",
      });

      if (activeProvider.provider === "brevo") {
        const campaignTag = `postialo_campaign_${campaignId}`;
        const brevoContacts = contactsList.map(c => ({
          name: c.name || "",
          email: c.email,
        }));

        const batchResult = await sendBatchEmails(
          apiKey,
          { name: senderName, email: senderEmail },
          subject,
          cleanHtmlForEmail(renderedHtml),
          brevoContacts,
          campaignTag
        );

        for (const errEntry of batchResult.errors) {
          await storage.updateCampaignSend(campaignId, errEntry.email, {
            status: "failed",
            errorMessage: errEntry.error,
          });
        }

        if (batchResult.sent > 0) {
          const failedEmails = new Set(batchResult.errors.map(e => e.email));
          const sentEmails = contactsList.filter(c => !failedEmails.has(c.email));
          for (const contact of sentEmails) {
            await storage.updateCampaignSend(campaignId, contact.email, { status: "sent" });
          }
          await db.update(campaignsTable).set({
            sentCount: batchResult.sent,
            failedCount: batchResult.failed,
          }).where(eq(campaignsTable.id, campaignId));
        } else {
          await db.update(campaignsTable).set({
            failedCount: batchResult.failed,
          }).where(eq(campaignsTable.id, campaignId));
        }

        if (batchResult.noCredits && batchResult.sent === 0) {
          await storage.updateCampaign(campaignId, { status: "failed" } as any);
          broadcastWs("campaign-progress", {
            campaignId,
            totalExpectedSends: contactsList.length,
            sentCount: 0,
            failedCount: batchResult.failed,
            status: "failed",
            completed: true,
          });
          return { success: false, error: "Sin créditos en Brevo. No se pudo enviar ningún correo." };
        }

        if (batchResult.noCredits && batchResult.sent > 0) {
          await storage.updateCampaign(campaignId, { status: "partial" } as any);
          broadcastWs("campaign-progress", {
            campaignId,
            totalExpectedSends: contactsList.length,
            sentCount: batchResult.sent,
            failedCount: batchResult.failed,
            status: "partial",
            completed: true,
          });
          return { success: false, error: `Sin créditos en Brevo. Se enviaron ${batchResult.sent} de ${contactsList.length} correos. Los restantes fallaron.` };
        }

        if (batchResult.sent === 0) {
          await storage.updateCampaign(campaignId, { status: "failed" } as any);
          broadcastWs("campaign-progress", {
            campaignId,
            totalExpectedSends: contactsList.length,
            sentCount: 0,
            failedCount: batchResult.failed,
            status: "failed",
            completed: true,
          });
          return { success: false, error: "No se pudo enviar ningún correo. Verifica tu configuración de Brevo." };
        }

        const finalStatus = batchResult.failed === 0 ? "sent" : "partial";
        await storage.updateCampaign(campaignId, { status: finalStatus, sentAt: new Date() } as any);
        broadcastWs("campaign-progress", {
          campaignId,
          totalExpectedSends: contactsList.length,
          sentCount: batchResult.sent,
          failedCount: batchResult.failed,
          status: finalStatus,
          completed: true,
        });

        return { success: true };

      } else if (activeProvider.provider === "mailchimp") {
        const { syncContactsToAudience, createAndSendCampaign } = await import("./providers/mailchimp");
        const dc = activeProvider.mailchimpDataCenter || "";
        const selectedAudienceId = activeProvider.mailchimpAudienceId || "";

        if (!selectedAudienceId) {
          await storage.updateCampaign(campaignId, { status: "failed" });
          broadcastWs("campaign-progress", { campaignId, totalExpectedSends: contactsList.length, sentCount: 0, failedCount: contactsList.length, status: "failed", completed: true });
          return { success: false, error: "No hay una audiencia de Mailchimp seleccionada. Ve a Configuración > Proveedor de Email y selecciona una audiencia." };
        }

        const mcContacts = contactsList.map(c => ({
          name: c.name || "",
          email: c.email,
        }));

        const tagName = `postialo_campaign_${campaignId}`;
        const syncResult = await syncContactsToAudience(
          apiKey, dc,
          selectedAudienceId,
          mcContacts, tagName
        );

        if (syncResult.error) {
          await storage.updateCampaign(campaignId, { status: "failed" });
          broadcastWs("campaign-progress", { campaignId, totalExpectedSends: contactsList.length, sentCount: 0, failedCount: contactsList.length, status: "failed", completed: true });
          return { success: false, error: `Error al sincronizar contactos con Mailchimp: ${syncResult.error}` };
        }

        const sendResult = await createAndSendCampaign(
          apiKey, dc,
          syncResult.audienceId,
          subject, senderName, senderEmail,
          cleanHtmlForEmail(renderedHtml)
        );

        if (sendResult.error) {
          await storage.updateCampaign(campaignId, { status: "failed" });
          broadcastWs("campaign-progress", { campaignId, totalExpectedSends: contactsList.length, sentCount: 0, failedCount: contactsList.length, status: "failed", completed: true });
          return { success: false, error: `Error en Mailchimp: ${sendResult.error}` };
        }

        for (const contact of contactsList) {
          await storage.updateCampaignSend(campaignId, contact.email, { status: "sent" });
        }
        await db.update(campaignsTable).set({
          sentCount: contactsList.length,
          failedCount: 0,
        }).where(eq(campaignsTable.id, campaignId));

        await storage.updateCampaign(campaignId, { status: "sent", sentAt: new Date() } as any);
        broadcastWs("campaign-progress", {
          campaignId,
          totalExpectedSends: contactsList.length,
          sentCount: contactsList.length,
          failedCount: 0,
          status: "sent",
          completed: true,
        });

        return { success: true };
      } else {
        return { success: false, error: "Proveedor de email no soportado." };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error interno al enviar.";
      console.error("Error sending campaign directly:", message);
      try {
        await storage.updateCampaign(campaignId, { status: previousStatus as any });
      } catch {}
      return { success: false, error: message };
    }
  }

  app.post("/api/campaigns/:id/send", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "sending") {
      return res.status(400).json({ message: "La campaña ya se está enviando. Espere a que termine." });
    }
    if (!campaign.textApproved || !campaign.imageApproved) {
      return res.status(400).json({ message: "Ambas aprobaciones (texto e imagen) son requeridas antes de enviar." });
    }
    const sendImageUrl = campaign.selectedImageUrl || "";
    if (sendImageUrl.includes("placehold.co")) {
      return res.status(400).json({ message: "No se puede enviar con una imagen placeholder. Regenere o cargue una imagen real primero." });
    }
    const retryableStatuses = ["scheduled", "draft", "failed", "partial", "cancelled"];
    if (!retryableStatuses.includes(campaign.status)) {
      return res.status(400).json({ message: "Solo campañas en estado programado, borrador, fallido, parcial o cancelado pueden enviarse." });
    }
    // Reset progress counters so the retry starts clean (per Task #18 spec).
    // sendCampaignDirect also resets sentCount/failedCount after preconditions pass, but doing
    // it here too ensures the visible counts reflect the new attempt immediately.
    if (["failed", "partial", "cancelled"].includes(campaign.status)) {
      await storage.updateCampaign(id, {
        sentCount: 0,
        failedCount: 0,
        schedulerRetryCount: 0,
        schedulerLastError: null,
      });
    }
    const result = await sendCampaignDirect(id, req.session.userId!, req);
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ message: "Campaña enviada exitosamente." });
  });

  app.post("/api/campaigns/:id/send-test", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    const user = await storage.getUserById(req.session.userId!);
    if (!user?.email) return res.status(400).json({ message: "No se pudo obtener el correo del usuario." });

    const providers = await storage.getEmailProviders(req.session.userId!);
    const activeProvider = providers.find(p => p.isDefault) || providers.find(p => p.isActive) || null;
    if (!activeProvider?.isActive) {
      return res.status(400).json({ message: "No hay proveedor de email configurado." });
    }

    const subject = (campaign as any).contentJson?.asunto || campaign.name || "Prueba de correo";
    const preheader = (campaign as any).contentJson?.preheader || "";
    const contenido = (campaign as any).contentJson?.cuerpo || "";
    const ctaTexto = (campaign as any).contentJson?.cta_texto || "";
    const ctaUrl = (campaign as any).contentJson?.cta_url || "#";
    const imageUrl = campaign.selectedImageUrl || "";

    let htmlBody = campaign.templateHtml || "";
    if (htmlBody) {
      htmlBody = htmlBody
        .replace(/\{\{ASUNTO\}\}/g, subject)
        .replace(/\{\{PREHEADER\}\}/g, preheader)
        .replace(/\{\{IMAGEN_URL\}\}/g, imageUrl)
        .replace(/\{\{CONTENIDO\}\}/g, contenido)
        .replace(/\{\{CTA_TEXTO\}\}/g, ctaTexto)
        .replace(/\{\{CTA_URL\}\}/g, ctaUrl)
        .replace(/\{\{UNSUBSCRIBE_LINK\}\}/g, "#");
    } else {
      htmlBody = `<p>${contenido}</p>`;
    }

    try {
      if (activeProvider.provider === "brevo") {
        const result = await sendBatchEmails({
          apiKey: activeProvider.apiKey,
          senderEmail: activeProvider.senderEmail || user.email,
          senderName: activeProvider.senderName || user.email,
          contacts: [{ email: user.email, firstName: "", lastName: "" }],
          subject: `[PRUEBA] ${subject}`,
          htmlContent: htmlBody,
          tags: [],
        });
        if (result.sent === 0) {
          return res.status(500).json({ message: result.errors[0]?.error || "No se pudo enviar el correo de prueba." });
        }
      } else if (activeProvider.provider === "mailchimp") {
        return res.status(400).json({ message: "El envío de prueba solo está disponible para Brevo en este momento." });
      }
      res.json({ to: user.email });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error interno.";
      res.status(500).json({ message });
    }
  });

  const brevoWebhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5000,
    message: { message: "Demasiadas solicitudes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  async function processBrevoEvent(eventData: { event: string; email: string; tags?: unknown[]; "message-id"?: string; reason?: string }): Promise<void> {
    const { event, email, tags } = eventData;
    if (!event || !email) return;
    if (!Array.isArray(tags) || tags.length === 0) return;

    const campaignTag = tags.find((t: unknown) => typeof t === "string" && (t as string).startsWith("postialo_campaign_"));
    if (!campaignTag) return;

    const campaignId = parseInt(String(campaignTag).replace("postialo_campaign_", ""), 10);
    if (isNaN(campaignId)) return;

    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) return;

    const existingSend = await storage.getCampaignSendByEmail(campaignId, email);
    if (!existingSend) return;

    const brevoEvent = String(event).toLowerCase();

    if (brevoEvent === "delivered") {
      if (existingSend.status === "pending") {
        await storage.updateCampaignSend(campaignId, email, { status: "sent", messageId: eventData["message-id"] || null });
        await storage.incrementCampaignSendCount(campaignId, "sentCount");
      } else if (existingSend.status === "sent") {
        await storage.updateCampaignSend(campaignId, email, { messageId: eventData["message-id"] || existingSend.messageId || null });
      }
    } else if (brevoEvent === "hard_bounce" || brevoEvent === "hardbounce") {
      if (existingSend.status !== "failed") {
        await storage.updateCampaignSend(campaignId, email, { status: "failed", errorMessage: `Hard bounce: ${eventData.reason || "dirección inválida"}` });
        if (existingSend.status === "sent") {
          await db.update(campaignsTable).set({ sentCount: sql`GREATEST(COALESCE(${campaignsTable.sentCount}, 0) - 1, 0)`, failedCount: sql`COALESCE(${campaignsTable.failedCount}, 0) + 1` }).where(eq(campaignsTable.id, campaignId));
        } else {
          await storage.incrementCampaignSendCount(campaignId, "failedCount");
        }
      }
    } else if (brevoEvent === "soft_bounce" || brevoEvent === "softbounce") {
      if (existingSend.status !== "failed") {
        await storage.updateCampaignSend(campaignId, email, { status: "failed", errorMessage: `Soft bounce: ${eventData.reason || "error temporal"}` });
        if (existingSend.status === "sent") {
          await db.update(campaignsTable).set({ sentCount: sql`GREATEST(COALESCE(${campaignsTable.sentCount}, 0) - 1, 0)`, failedCount: sql`COALESCE(${campaignsTable.failedCount}, 0) + 1` }).where(eq(campaignsTable.id, campaignId));
        } else {
          await storage.incrementCampaignSendCount(campaignId, "failedCount");
        }
      }
    } else if (brevoEvent === "opened" || brevoEvent === "open" || brevoEvent === "click") {
      if (existingSend.status === "pending") {
        await storage.updateCampaignSend(campaignId, email, { status: "sent", messageId: eventData["message-id"] || null });
        await storage.incrementCampaignSendCount(campaignId, "sentCount");
      } else if (existingSend.status === "sent") {
        await storage.updateCampaignSend(campaignId, email, { messageId: eventData["message-id"] || existingSend.messageId || null });
      }
    }

    const updatedCampaign = await storage.getCampaign(campaignId);
    if (updatedCampaign) {
      const sent = updatedCampaign.sentCount || 0;
      const failed = updatedCampaign.failedCount || 0;
      const total = updatedCampaign.totalExpectedSends || 0;
      if (total > 0 && (sent + failed) >= total && updatedCampaign.status === "sending") {
        const finalStatus = failed === 0 ? "sent" : (sent === 0 ? "failed" : "partial");
        await storage.updateCampaign(campaignId, { status: finalStatus } as any);
        broadcastWs("campaign-progress", { campaignId, totalExpectedSends: total, sentCount: sent, failedCount: failed, status: finalStatus, completed: true });
      } else {
        broadcastWs("campaign-progress", { campaignId, totalExpectedSends: total, sentCount: sent, failedCount: failed, status: updatedCampaign.status });
      }
    }
  }

  app.post("/api/webhooks/brevo", brevoWebhookLimiter, async (req, res) => {
    try {
      const body = req.body;
      if (Array.isArray(body)) {
        for (const evt of body) {
          try {
            await processBrevoEvent(evt);
          } catch (innerErr: unknown) {
            const msg = innerErr instanceof Error ? innerErr.message : "Error desconocido";
            console.error(`[Brevo webhook batch] Error processing event:`, msg);
          }
        }
        console.log(`[Brevo webhook] Processed batch of ${body.length} events`);
      } else if (body && body.event && body.email) {
        await processBrevoEvent(body);
        console.log(`[Brevo webhook] event=${body.event} email=${body.email}`);
      } else {
        return res.status(400).json({ message: "Formato de webhook inválido." });
      }
      res.json({ received: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      console.error("[Brevo webhook] Error:", message);
      return res.status(500).json({ message: "Error procesando webhook de Brevo." });
    }
  });

  app.get("/api/campaigns/:id/sends", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    const sends = await storage.getCampaignSends(id);
    res.json(sends);
  });

  app.get("/api/campaigns/:id/send-stats", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    const stats = await storage.getCampaignSendStats(id);
    res.json({
      ...stats,
      totalExpectedSends: campaign.totalExpectedSends || 0,
      sentCount: campaign.sentCount || 0,
      failedCount: campaign.failedCount || 0,
      status: campaign.status,
    });
  });

  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autenticado." });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({ message: "Acceso denegado. Se requieren permisos de administrador." });
    }
    next();
  }

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    const usersWithStats = await Promise.all(
      allUsers.map(async (u) => {
        const stats = await storage.getUserStats(u.id);
        const { password, ...safe } = u;
        return { ...safe, stats };
      })
    );
    res.json(usersWithStats);
  });

  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    const stats = await storage.getUserStats(id);
    const { password, ...safe } = user;
    res.json({ ...safe, stats });
  });

  const adminUpdateUserSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().max(255).optional(),
    company: z.string().max(200).nullable().optional(),
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    try {
      const input = adminUpdateUserSchema.parse(req.body);
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.email !== undefined) {
        const cleanEmail = input.email.trim().toLowerCase();
        if (cleanEmail !== user.email) {
          const existing = await storage.getUserByEmail(cleanEmail);
          if (existing) return res.status(409).json({ message: "Ya existe un usuario con ese correo electrónico." });
        }
        updates.email = cleanEmail;
      }
      if (input.company !== undefined) updates.company = input.company ? input.company.trim() : null;
      const updated = await storage.updateUser(id, updates);
      if (!updated) return res.status(500).json({ message: "Error actualizando usuario." });
      const { password, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  const adminResetPasswordSchema = z.object({
    newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(128, "La contraseña no puede exceder 128 caracteres"),
  });

  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    try {
      const input = adminResetPasswordSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      await storage.updateUserPassword(id, hashedPassword);
      res.json({ message: "Contraseña restablecida exitosamente." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (id === req.session.userId) {
      return res.status(400).json({ message: "No puede eliminarse a sí mismo." });
    }
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    if (user.role === "superadmin") {
      return res.status(400).json({ message: "No puede eliminar al superadministrador." });
    }
    const currentUser = await storage.getUserById(req.session.userId!);
    if (user.role === "admin" && currentUser?.role !== "superadmin") {
      return res.status(400).json({ message: "No puede eliminar a otro administrador." });
    }
    await storage.deleteUser(id);
    res.json({ message: "Usuario eliminado exitosamente." });
  });

  app.post("/api/admin/impersonate/:id", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (id === req.session.userId) {
      return res.status(400).json({ message: "No puede impersonarse a sí mismo." });
    }
    const targetUser = await storage.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado." });
    const currentUser = await storage.getUserById(req.session.userId!);
    if ((targetUser.role === "admin" || targetUser.role === "superadmin") && currentUser?.role !== "superadmin") {
      return res.status(400).json({ message: "No puede impersonar a otro administrador." });
    }
    req.session.originalAdminId = req.session.userId;
    req.session.impersonatingUserName = targetUser.name;
    req.session.userId = id;
    res.json({ message: `Ahora estás viendo como ${targetUser.name}.` });
  });

  const adminCreateUserSchema = z.object({
    name: z.string().min(1, "El nombre es requerido").max(200),
    email: z.string().email("Correo electrónico inválido").max(255),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(128),
    company: z.string().max(200).optional(),
    role: z.enum(["user", "admin"]).default("user"),
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const input = adminCreateUserSchema.parse(req.body);
      const existing = await storage.getUserByEmail(input.email.trim().toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Ya existe un usuario con ese correo electrónico." });
      }
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: hashedPassword,
        company: input.company?.trim() || null,
      });
      if (input.role === "admin") {
        await storage.updateUser(user.id, { role: "admin" });
      }
      const created = await storage.getUserById(user.id);
      if (!created) return res.status(500).json({ message: "Error creando usuario." });
      const { password, ...safe } = created;
      res.status(201).json(safe);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/admin/users/:id/toggle-active", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (id === req.session.userId) {
      return res.status(400).json({ message: "No puede desactivarse a sí mismo." });
    }
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    if (user.role === "superadmin") {
      return res.status(400).json({ message: "No puede desactivar al superadministrador." });
    }
    const updated = await storage.updateUser(id, { isActive: !user.isActive } as any);
    if (!updated) return res.status(500).json({ message: "Error actualizando usuario." });
    const { password, ...safe } = updated;
    res.json(safe);
  });

  const adminChangeRoleSchema = z.object({
    role: z.enum(["user", "admin"]),
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (id === req.session.userId) {
      return res.status(400).json({ message: "No puede cambiar su propio rol." });
    }
    const user = await storage.getUserById(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    if (user.role === "superadmin") {
      return res.status(400).json({ message: "No puede cambiar el rol del superadministrador." });
    }
    const currentUser = await storage.getUserById(req.session.userId!);
    if (user.role === "admin" && currentUser?.role !== "superadmin") {
      return res.status(400).json({ message: "No puede cambiar el rol de otro administrador." });
    }
    try {
      const input = adminChangeRoleSchema.parse(req.body);
      const updated = await storage.updateUser(id, { role: input.role });
      if (!updated) return res.status(500).json({ message: "Error actualizando rol." });
      const { password, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get("/api/admin/activity", requireAdmin, async (_req, res) => {
    const activity = await storage.getRecentActivity();
    res.json(activity);
  });

  app.post("/api/admin/stop-impersonate", requireAuth, async (req, res) => {
    if (!req.session.originalAdminId) {
      return res.status(400).json({ message: "No estás en modo de impersonación." });
    }
    const adminId = req.session.originalAdminId;
    req.session.userId = adminId;
    delete req.session.originalAdminId;
    delete req.session.impersonatingUserName;
    res.json({ message: "Has vuelto a tu cuenta de administrador." });
  });

  const MAX_SCHEDULER_RETRIES = 3;

  const stuckCampaignSnapshots = new Map<number, { sentCount: number; failedCount: number; firstSeenAt: number }>();

  function startCampaignScheduler() {
    console.log("Campaign scheduler started (checking every 60s)");
    setInterval(async () => {
      try {
        const allCampaigns = await storage.getAllScheduledCampaigns();
        const now = new Date();

        const sendingCampaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.status, "sending"));
        const sendingIds = new Set(sendingCampaigns.map(c => c.id));
        for (const [id] of stuckCampaignSnapshots) {
          if (!sendingIds.has(id)) stuckCampaignSnapshots.delete(id);
        }

        for (const stuck of sendingCampaigns) {
          const sent = stuck.sentCount || 0;
          const failed = stuck.failedCount || 0;
          const prev = stuckCampaignSnapshots.get(stuck.id);

          if (!prev) {
            stuckCampaignSnapshots.set(stuck.id, { sentCount: sent, failedCount: failed, firstSeenAt: now.getTime() });
            continue;
          }

          if (prev.sentCount !== sent || prev.failedCount !== failed) {
            stuckCampaignSnapshots.set(stuck.id, { sentCount: sent, failedCount: failed, firstSeenAt: now.getTime() });
            continue;
          }

          const noProgressMinutes = (now.getTime() - prev.firstSeenAt) / (1000 * 60);
          if (noProgressMinutes >= 30) {
            const finalStatus = sent > 0 ? (failed > 0 ? "partial" : "sent") : "failed";
            console.log(`Scheduler: campaign #${stuck.id} no progress for ${Math.round(noProgressMinutes)}min, forcing to '${finalStatus}' (sent=${sent}, failed=${failed})`);
            await storage.updateCampaign(stuck.id, { status: finalStatus } as any);
            broadcastWs("campaign-progress", {
              campaignId: stuck.id,
              totalExpectedSends: stuck.totalExpectedSends || 0,
              sentCount: sent,
              failedCount: failed,
              status: finalStatus,
              completed: true,
            });
            stuckCampaignSnapshots.delete(stuck.id);
          }
        }

        for (const campaign of allCampaigns) {
          if (campaign.status === "scheduled" && campaign.scheduledAt && new Date(campaign.scheduledAt) <= now) {
            if (!campaign.textApproved || !campaign.imageApproved) {
              console.warn(`Scheduler: campaign #${campaign.id} skipped — missing approvals (text: ${campaign.textApproved}, image: ${campaign.imageApproved}). Keeping status "scheduled".`);
              continue;
            }
            const schedulerImageUrl = campaign.selectedImageUrl || "";
            if (schedulerImageUrl.includes("placehold.co")) {
              console.warn(`Scheduler: campaign #${campaign.id} skipped — placeholder image detected. Keeping status "scheduled".`);
              continue;
            }
            const retryCount = campaign.schedulerRetryCount || 0;
            if (retryCount >= MAX_SCHEDULER_RETRIES) {
              console.error(`Scheduler: campaign #${campaign.id} exceeded ${MAX_SCHEDULER_RETRIES} retries, marking as failed.`);
              await storage.updateCampaign(campaign.id, {
                status: "failed",
              } as any);
              await db.update(campaignsTable).set({
                schedulerLastError: `Fallo después de ${MAX_SCHEDULER_RETRIES} intentos automáticos. Último error: ${campaign.schedulerLastError || "desconocido"}`,
              }).where(eq(campaignsTable.id, campaign.id));
              broadcastWs("campaign-progress", {
                campaignId: campaign.id,
                status: "failed",
                completed: true,
              });
              continue;
            }
            const providerList = await storage.getEmailProviders(campaign.userId);
            const hasProvider = providerList.some(p => p.isActive);
            if (!hasProvider) {
              console.error(`Scheduler: campaign #${campaign.id} skipped — user ${campaign.userId} has no email provider configured.`);
              await storage.updateCampaign(campaign.id, { status: "failed" } as any);
              await db.update(campaignsTable).set({
                schedulerLastError: "No hay proveedor de email configurado. Configura tu cuenta antes de programar campañas.",
              }).where(eq(campaignsTable.id, campaign.id));
              broadcastWs("campaign-progress", {
                campaignId: campaign.id,
                status: "failed",
                completed: true,
              });
              continue;
            }
            console.log(`Scheduler: firing campaign #${campaign.id} (scheduled for ${campaign.scheduledAt}, attempt ${retryCount + 1}/${MAX_SCHEDULER_RETRIES})`);
            const result = await sendCampaignDirect(campaign.id, campaign.userId);
            if (!result.success) {
              const newRetryCount = retryCount + 1;
              console.error(`Scheduler: failed to send campaign #${campaign.id}: ${result.error} (attempt ${newRetryCount}/${MAX_SCHEDULER_RETRIES})`);
              if (newRetryCount >= MAX_SCHEDULER_RETRIES) {
                console.error(`Scheduler: campaign #${campaign.id} reached ${MAX_SCHEDULER_RETRIES} failed attempts, marking as failed.`);
                await storage.updateCampaign(campaign.id, { status: "failed" } as any);
                await db.update(campaignsTable).set({
                  schedulerRetryCount: newRetryCount,
                  schedulerLastError: `Fallo después de ${MAX_SCHEDULER_RETRIES} intentos automáticos. Último error: ${result.error || "desconocido"}`,
                }).where(eq(campaignsTable.id, campaign.id));
                broadcastWs("campaign-progress", {
                  campaignId: campaign.id,
                  status: "failed",
                  completed: true,
                });
              } else {
                await db.update(campaignsTable).set({
                  schedulerRetryCount: newRetryCount,
                  schedulerLastError: result.error || "Error desconocido",
                }).where(eq(campaignsTable.id, campaign.id));
              }
            } else {
              console.log(`Scheduler: campaign #${campaign.id} sent successfully`);
              if (retryCount > 0) {
                await db.update(campaignsTable).set({
                  schedulerRetryCount: 0,
                  schedulerLastError: null,
                }).where(eq(campaignsTable.id, campaign.id));
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Scheduler error:", err.message);
      }
    }, 60 * 1000);
  }

  app.all("/api", (_req, res) => {
    res.status(404).json({ message: "Ruta no encontrada." });
  });
  app.all("/api/{*path}", (_req, res) => {
    res.status(404).json({ message: "Ruta no encontrada." });
  });

  return { httpServer, startCampaignScheduler };
}
