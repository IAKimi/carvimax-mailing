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
import { eq } from "drizzle-orm";
import { db } from "./db";

let wss: WebSocketServer | null = null;

interface ResolvedCampaignContent {
  contentJson: Record<string, unknown>;
  imageUrl: string | null;
}

function getResolvedCampaignContent(versions: Array<{ type: string; isSelected: boolean | null; contentJson: unknown; imageUrl: string | null }>): ResolvedCampaignContent {
  const textVersions = versions.filter(v => v.type === "initial" || v.type === "text");
  const imageVersions = versions.filter(v => v.type === "initial" || v.type === "image");

  const selectedText = textVersions.find(v => v.isSelected) || textVersions[textVersions.length - 1];
  const selectedImage = imageVersions.find(v => v.isSelected) || imageVersions[imageVersions.length - 1];

  const contentJson = (selectedText?.contentJson as Record<string, unknown>) || {};
  const imageUrl = selectedImage?.imageUrl || selectedText?.imageUrl || null;

  return { contentJson, imageUrl };
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
  draft: ["scheduled", "sending", "cancelled"],
  scheduled: ["cancelled", "sending", "sent"],
  sending: ["sent", "cancelled"],
  sent: [],
  cancelled: [],
};

const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/zmq7ppo7dusjmowvqznkbc6etvqvonr4";

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
  } else {
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
    baseUrl = `https://${domain}`;
  }
  return `${baseUrl}/uploads/campaigns/${filename}`;
}

function loadImageAsBase64(imageUrl: string): string {
  if (imageUrl.startsWith("data:")) return imageUrl;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  const basename = path.basename(imageUrl);
  if (basename !== imageUrl || basename.includes("..")) return imageUrl;
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

function sanitizeUser(user: { id: number; name: string; email: string; password: string; company: string | null; role: string; isActive: boolean; createdAt: Date | null }) {
  const { password, ...safe } = user;
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

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(409).json({ message: "Ya existe una cuenta con este correo electrónico." });
      }
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await storage.createUser({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        company: input.company || null,
      });
      req.session.userId = user.id;
      res.status(201).json(sanitizeUser(user));
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
          const fifteenMinFromNow = Date.now() + 15 * 60 * 1000;
          if (existingTime <= fifteenMinFromNow) {
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

    const imagePromise = (async () => {
      if (campaign.imagePrompt && isGeminiConfigured()) {
        try {
          return await generateImage(campaign.imagePrompt);
        } catch (err: any) {
          console.error("Error generando imagen con Gemini:", err.message);
          return "https://placehold.co/600x300/e3001b/white?text=Error+generando+imagen";
        }
      }
      if (!isGeminiConfigured()) {
        return "https://placehold.co/600x300/002073/white?text=Sin+API+Key";
      }
      return "https://placehold.co/600x300/002073/white?text=Sin+imagen";
    })();

    const textPromise = (async () => {
      if (campaign.idea && campaign.objective && isOpenAIConfigured()) {
        try {
          const brandData = await storage.getBrandIdentity(req.session.userId!);
          const result = await generateEmailContent(campaign.idea, campaign.objective, brandData || null, campaign.targetAudience);
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

    const imageUrl = rawImageUrl ? saveBase64Image(rawImageUrl, `campaign_${campaignId}`) : null;

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

    let contentJson;
    try {
      if (!isOpenAIConfigured()) {
        return res.status(400).json({ message: "OpenAI no está configurado." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const emailContent = await regenerateEmailContent(
        campaign.idea,
        campaign.objective,
        previousEmail,
        corrections,
        brandData || null,
        campaign.targetAudience
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
      console.error("Error regenerando texto con OpenAI:", err.message);
      return res.status(500).json({ message: err.message || "Error regenerando texto." });
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
        return res.status(400).json({ message: "Gemini no está configurado." });
      }
      rawImageUrl = await generateImage(imagePrompt);
    } catch (err: any) {
      console.error("Error regenerando imagen con Gemini:", err.message);
      return res.status(500).json({ message: err.message || "Error regenerando imagen." });
    }

    const imageUrl = saveBase64Image(rawImageUrl, `campaign_${campaignId}`);

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

    const currentImageBase64 = loadImageAsBase64(selectedImageVersion.imageUrl);

    let rawImageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "Gemini no está configurado." });
      }
      rawImageUrl = await editImage(currentImageBase64, editPrompt);
    } catch (err: any) {
      console.error("Error editando imagen con Gemini:", err.message);
      return res.status(500).json({ message: err.message || "Error editando imagen." });
    }

    const imageUrl = saveBase64Image(rawImageUrl, `campaign_${campaignId}`);
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

    const currentImageBase64 = loadImageAsBase64(selectedImageVersion.imageUrl);

    let rawImageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "Gemini no está configurado." });
      }
      rawImageUrl = await editImageAdvanced({
        currentImageBase64,
        referenceImagesBase64: refs,
        userText: editPrompt,
        selectedAction: selectedAction as AdvancedAction,
      });
    } catch (err: any) {
      console.error("Error en edición avanzada con Gemini:", err.message);
      const msg = err.message || "Error editando imagen.";
      const isInputError = msg.includes("no soportado") || msg.includes("excede el límite") || msg.includes("no válida") || msg.includes("bloqueado") || msg.includes("prohibido");
      return res.status(isInputError ? 400 : 500).json({ message: msg });
    }

    const imageUrl = saveBase64Image(rawImageUrl, `campaign_${campaignId}`);
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
    const userCampaigns = await storage.getCampaigns(req.session.userId!);
    for (const c of userCampaigns) {
      await cleanupCampaignFiles(c.id);
    }
    await storage.deleteAllCampaigns(req.session.userId!);
    res.json({ message: "Historial eliminado." });
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
    const resolved = originalVersions.length > 0 ? getResolvedCampaignContent(originalVersions) : { contentJson: {}, imageUrl: null };
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

    if (scheduledAt) {
      await storage.updateCampaign(newCampaign.id, { status: "scheduled" });
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
      const input = updateVersionSchema.parse(req.body);
      if (input.isSelected) {
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
    const validContacts: Array<{ email: string; name?: string; position?: string; segment?: string }> = [];
    const errors: string[] = [];
    const seenEmails = new Set<string>();
    let duplicatesInCsv = 0;
    for (let i = 0; i < contactRows.length; i++) {
      const row = contactRows[i];
      const email = (row.email || row.Email || row.correo || row.Correo || "").toString().trim().toLowerCase();
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
        name: (row.name || row.Name || row.nombre || row.Nombre || "").toString().trim() || undefined,
        position: (row.position || row.Position || row.cargo || row.Cargo || "").toString().trim() || undefined,
        segment: (row.segment || row.Segment || row.segmento || row.Segmento || "").toString().trim() || undefined,
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

  app.get("/api/onboarding-status", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const brand = await storage.getBrandIdentity(userId);
    const hasBrand = !!(brand && brand.companyName && brand.industry);
    const templates = await storage.getTemplates(userId);
    const hasTemplates = templates.length > 0;
    const contactDbs = await storage.getContactDatabases(userId);
    const hasContactDatabases = contactDbs.length > 0;
    res.json({ hasBrand, hasTemplates, hasContactDatabases });
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
      const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2];
      const buffer = Buffer.from(match[3], "base64");
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({ message: "La imagen no puede exceder 2MB." });
      }
      const existingBrand = await storage.getBrandIdentity(req.session.userId!);
      if (existingBrand?.logoUrl) {
        deleteLogoFile(existingBrand.logoUrl);
      }

      const filename = `${req.session.userId}_${crypto.randomBytes(8).toString("hex")}.${ext}`;
      const uploadsDir = path.resolve(process.cwd(), "uploads", "logos");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const logoUrl = `${protocol}://${host}/uploads/logos/${filename}`;
      await storage.upsertBrandIdentity(req.session.userId!, { logoUrl });
      res.json({ logoUrl });
    } catch (err: any) {
      console.error("Error uploading logo:", err.message);
      return res.status(500).json({ message: "Error al subir el logo." });
    }
  });

  app.get("/api/templates", requireAuth, async (req, res) => {
    const tpls = await storage.getTemplates(req.session.userId!);
    res.json(tpls);
  });

  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const createTemplateSchema = z.object({
        name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede exceder 200 caracteres"),
        html: z.string().min(1, "El HTML es requerido").max(50000, "El HTML no puede exceder 50000 caracteres"),
      });
      const input = createTemplateSchema.parse(req.body);
      const sanitizedHtml = sanitizeHtml(input.html);
      const validation = validateTemplatePlaceholders(sanitizedHtml);
      const tpl = await storage.createTemplate({ userId: req.session.userId!, name: input.name, html: sanitizedHtml, favorite: false, hasAllPlaceholders: validation.valid });
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
        const validation = validateTemplatePlaceholders(input.html);
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
        return res.status(400).json({ message: "OpenAI no está configurado." });
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
      const tpl = await storage.createTemplate({
        userId: req.session.userId!,
        name: result.name,
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
      console.error("Error generando plantilla con OpenAI:", err.message);
      return res.status(500).json({ message: err.message || "Error generando plantilla." });
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
        return res.status(400).json({ message: "OpenAI no está configurado." });
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
        name: tpl.name + ` (v${totalVersions + 1})`,
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
      console.error("Error editando plantilla con OpenAI:", err.message);
      return res.status(500).json({ message: err.message || "Error editando plantilla." });
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
        return res.status(400).json({ message: "OpenAI no está configurado." });
      }
      const brandData = await storage.getBrandIdentity(req.session.userId!);
      const analyzedHtml = await analyzeTemplatePlaceholders(tpl.html, brandData || null);
      const sanitizedHtml = sanitizeHtml(analyzedHtml);
      const validation = validateTemplatePlaceholders(sanitizedHtml);
      const updated = await storage.updateTemplate(id, {
        html: sanitizedHtml,
        hasAllPlaceholders: validation.valid,
      } as any);
      res.json({ ...updated, missingPlaceholders: validation.missing });
    } catch (err: any) {
      console.error("Error analizando plantilla:", err.message);
      return res.status(500).json({ message: err.message || "Error analizando plantilla." });
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

  async function sendCampaignToWebhook(campaignId: number, userId: number): Promise<{ success: boolean; error?: string }> {
    let previousStatus = "draft";
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign || campaign.userId !== userId) {
        return { success: false, error: "Campaña no encontrada." };
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

      const imagePublicUrl = resolved.imageUrl ? getImagePublicUrl(resolved.imageUrl) : null;

      let renderedHtml = renderTemplateWithContent(
        template.html,
        resolved.contentJson,
        imagePublicUrl,
        brandData
      ).html;

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

      const senderName = brandData?.senderName || brandData?.companyName || "PostIAlo Mailing";
      const senderEmail = brandData?.senderEmail || "noreply@postialo.com";

      const payload = {
        subject,
        html_content: cleanHtmlForEmail(renderedHtml),
        sender_name: senderName,
        sender_email: senderEmail,
        campaign_id: String(campaignId),
        contacts: contactsList.map(c => ({
          name: c.name || "",
          email: c.email,
        })),
      };

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

      const webhookRes = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!webhookRes.ok) {
        const errText = await webhookRes.text().catch(() => "Error desconocido");
        console.error(`Make webhook error (${webhookRes.status}):`, errText);
        await storage.updateCampaign(campaignId, { status: previousStatus as any });
        return { success: false, error: `Error al enviar al webhook: ${webhookRes.status}` };
      }

      // No cambiar a "sent" aquí — solo el callback de Make.com debe hacerlo
      return { success: true };
    } catch (err: any) {
      console.error("Error sending campaign to webhook:", err.message);
      try {
        await storage.updateCampaign(campaignId, { status: previousStatus as any });
      } catch {}
      return { success: false, error: err.message || "Error interno al enviar." };
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
    const result = await sendCampaignToWebhook(id, req.session.userId!);
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ message: "Campaña enviada exitosamente." });
  });

  const webhookCallbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 2000,
    message: { message: "Demasiadas solicitudes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/webhooks/make-callback", webhookCallbackLimiter, async (req, res) => {
    try {
      const webhookSecret = process.env.MAKE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("MAKE_WEBHOOK_SECRET no configurado. Rechazando callback.");
        return res.status(503).json({ message: "Webhook no configurado." });
      }
      const providedToken = (req.headers["x-webhook-secret"] as string) || (req.query.secret as string);
      if (providedToken !== webhookSecret) {
        return res.status(403).json({ message: "Token de webhook inválido." });
      }

      const { campaign_id, status, message_id, contact_email, error_message } = req.body || {};
      if (!campaign_id) {
        return res.status(400).json({ message: "campaign_id es requerido." });
      }
      const campaignId = parseInt(campaign_id, 10);
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: "campaign_id inválido." });
      }
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaña no encontrada." });
      }

      const sendStatus = (status === "success" || status === "sent") ? "sent" : (status === "error" || status === "failed") ? "failed" : "sent";

      if (contact_email) {
        const existingSend = await storage.getCampaignSendByEmail(campaignId, contact_email);
        if (!existingSend) {
          console.log(`Make callback: unknown contact ${contact_email} for campaign ${campaignId}, ignoring`);
          return res.json({ received: true, ignored: true });
        }

        if (existingSend.status !== "pending") {
          console.log(`Make callback: duplicate for ${contact_email} campaign ${campaignId} (already ${existingSend.status}), ignoring`);
          return res.json({ received: true, duplicate: true });
        }

        await storage.updateCampaignSend(campaignId, contact_email, {
          status: sendStatus,
          messageId: message_id || null,
          errorMessage: error_message || null,
        });

        const field = sendStatus === "sent" ? "sentCount" : "failedCount";
        const updatedCampaign = await storage.incrementCampaignSendCount(campaignId, field);

        if (updatedCampaign) {
          const sent = updatedCampaign.sentCount || 0;
          const failed = updatedCampaign.failedCount || 0;
          const total = updatedCampaign.totalExpectedSends || 0;

          broadcastWs("campaign-progress", {
            campaignId,
            totalExpectedSends: total,
            sentCount: sent,
            failedCount: failed,
            status: updatedCampaign.status,
          });

          if (total > 0 && (sent + failed) >= total) {
            const finalStatus = failed === 0 ? "sent" : (sent === 0 ? "failed" : "partial");
            await storage.updateCampaign(campaignId, { status: finalStatus } as any);
            broadcastWs("campaign-progress", {
              campaignId,
              totalExpectedSends: total,
              sentCount: sent,
              failedCount: failed,
              status: finalStatus,
              completed: true,
            });
          }
        }
      } else {
        const allSends = await storage.getCampaignSends(campaignId);
        const pendingSends = allSends.filter(s => s.status === "pending");

        for (const send of pendingSends) {
          await storage.updateCampaignSend(campaignId, send.contactEmail, {
            status: sendStatus,
            messageId: message_id || null,
            errorMessage: error_message || null,
          });
          const field = sendStatus === "sent" ? "sentCount" : "failedCount";
          await storage.incrementCampaignSendCount(campaignId, field);
        }

        const updatedCampaign = await storage.getCampaign(campaignId);
        if (updatedCampaign) {
          const sent = updatedCampaign.sentCount || 0;
          const failed = updatedCampaign.failedCount || 0;
          const total = updatedCampaign.totalExpectedSends || 0;
          const finalStatus = failed === 0 ? "sent" : (sent === 0 ? "failed" : "partial");

          await storage.updateCampaign(campaignId, { status: finalStatus } as any);
          broadcastWs("campaign-progress", {
            campaignId,
            totalExpectedSends: total,
            sentCount: sent,
            failedCount: failed,
            status: finalStatus,
            completed: true,
          });
        }
      }

      console.log(`Make callback: campaign=${campaign_id} contact=${contact_email || "N/A"} status=${status} messageId=${message_id || "N/A"}`);
      res.json({ received: true });
    } catch (err: any) {
      console.error("Error processing Make callback:", err.message);
      return res.status(500).json({ message: "Error procesando callback." });
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

  function startCampaignScheduler() {
    console.log("Campaign scheduler started (checking every 60s)");
    setInterval(async () => {
      try {
        const allCampaigns = await storage.getAllScheduledCampaigns();
        const now = new Date();
        for (const campaign of allCampaigns) {
          if (campaign.status === "scheduled" && campaign.scheduledAt && new Date(campaign.scheduledAt) <= now) {
            if (!campaign.textApproved || !campaign.imageApproved) {
              console.warn(`Scheduler: campaign #${campaign.id} skipped — missing approvals (text: ${campaign.textApproved}, image: ${campaign.imageApproved}). Keeping status "scheduled".`);
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
            console.log(`Scheduler: firing campaign #${campaign.id} (scheduled for ${campaign.scheduledAt}, attempt ${retryCount + 1}/${MAX_SCHEDULER_RETRIES})`);
            const result = await sendCampaignToWebhook(campaign.id, campaign.userId);
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

  return { httpServer, startCampaignScheduler };
}
