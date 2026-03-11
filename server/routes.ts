import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateImage, editImage, editImageAdvanced, isGeminiConfigured, type AdvancedAction } from "./gemini";
import { generateEmailContent, regenerateEmailContent, generateTemplateHtml, editTemplateHtml, analyzeTemplatePlaceholders, isOpenAIConfigured } from "./openai";
import { validateTemplatePlaceholders, renderTemplateWithContent } from "./templates";

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
  imagePrompt: z.string().max(1000, "El prompt de imagen no puede exceder 1000 caracteres").nullable().optional(),
  targetDatabase: z.string().max(200).nullable().optional(),
  targetAudience: z.string().max(1000, "El público objetivo no puede exceder 1000 caracteres").nullable().optional(),
  templateId: z.number().int().positive().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

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
  scheduled: ["cancelled", "sent"],
  sent: [],
  cancelled: [],
};

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
      const metrics = await storage.getDashboardMetrics(req.session.userId!);
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
    res.json(campaigns);
  });

  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(id);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    res.json(campaign);
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
        status: scheduledAt ? "scheduled" : "draft",
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
        if (newDate.getTime() < Date.now()) {
          return res.status(400).json({ message: "La fecha programada debe ser en el futuro." });
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
      result[t.campaignId] = t.imageUrl;
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
    res.json(versions);
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

    const [imageUrl, emailContent] = await Promise.all([imagePromise, textPromise]);

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
    const versions = await storage.getCampaignVersions(campaignId);
    const versionNumber = versions.length + 1;
    if (versionNumber > 3) {
      return res.status(400).json({ message: "Máximo 3 generaciones alcanzado." });
    }

    const { corrections } = req.body || {};
    if (!corrections || typeof corrections !== "string") {
      return res.status(400).json({ message: "Debe proporcionar correcciones de texto." });
    }
    if (corrections.length > 1000) {
      return res.status(400).json({ message: "Las correcciones no pueden exceder 1000 caracteres." });
    }

    const selectedVersion = versions.find(v => v.isSelected) || versions[versions.length - 1];
    if (!selectedVersion) {
      return res.status(400).json({ message: "No hay versión previa para regenerar." });
    }

    const previousContent = selectedVersion.contentJson as any;
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
      };
    } catch (err: any) {
      console.error("Error regenerando texto con OpenAI:", err.message);
      return res.status(500).json({ message: err.message || "Error regenerando texto." });
    }

    await storage.deselectAllVersions(campaignId);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson,
      imageUrl: selectedVersion.imageUrl,
      isSelected: true,
    });
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
    const versions = await storage.getCampaignVersions(campaignId);
    const versionNumber = versions.length + 1;
    if (versionNumber > 3) {
      return res.status(400).json({ message: "Máximo 3 generaciones alcanzado." });
    }

    const { imagePrompt } = req.body || {};
    if (!imagePrompt || typeof imagePrompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar un prompt de imagen." });
    }
    if (imagePrompt.length > 500) {
      return res.status(400).json({ message: "El prompt de imagen no puede exceder 500 caracteres." });
    }

    const selectedVersion = versions.find(v => v.isSelected) || versions[versions.length - 1];

    let imageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "Gemini no está configurado." });
      }
      imageUrl = await generateImage(imagePrompt);
    } catch (err: any) {
      console.error("Error regenerando imagen con Gemini:", err.message);
      return res.status(500).json({ message: err.message || "Error regenerando imagen." });
    }

    await storage.deselectAllVersions(campaignId);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson: selectedVersion?.contentJson || { asunto: "", preheader: "", cuerpo_html: "", cta_text: "Ver más" },
      imageUrl,
      isSelected: true,
    });
    await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl } as any);
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
    const versions = await storage.getCampaignVersions(campaignId);
    const versionNumber = versions.length + 1;
    if (versionNumber > 3) {
      return res.status(400).json({ message: "Máximo 3 generaciones alcanzado." });
    }

    const { editPrompt } = req.body || {};
    if (!editPrompt || typeof editPrompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar instrucciones de edición." });
    }
    if (editPrompt.length > 1000) {
      return res.status(400).json({ message: "Las instrucciones de edición no pueden exceder 1000 caracteres." });
    }

    const selectedVersion = versions.find(v => v.isSelected) || versions[versions.length - 1];
    if (!selectedVersion?.imageUrl) {
      return res.status(400).json({ message: "No hay imagen previa para editar." });
    }

    const base64Portion = selectedVersion.imageUrl.includes(",")
      ? selectedVersion.imageUrl.split(",")[1]
      : selectedVersion.imageUrl;
    const imageSizeBytes = Math.ceil((base64Portion.length * 3) / 4);
    const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
    if (imageSizeBytes > MAX_IMAGE_SIZE) {
      return res.status(400).json({ message: "La imagen es demasiado grande para editar (máximo 20 MB)." });
    }

    let imageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "Gemini no está configurado." });
      }
      imageUrl = await editImage(selectedVersion.imageUrl, editPrompt);
    } catch (err: any) {
      console.error("Error editando imagen con Gemini:", err.message);
      return res.status(500).json({ message: err.message || "Error editando imagen." });
    }

    await storage.deselectAllVersions(campaignId);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson: selectedVersion.contentJson as Record<string, unknown>,
      imageUrl,
      isSelected: true,
    });
    await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl } as any);
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
    const versions = await storage.getCampaignVersions(campaignId);
    const versionNumber = versions.length + 1;
    if (versionNumber > 3) {
      return res.status(400).json({ message: "Máximo 3 generaciones alcanzado." });
    }

    const { editPrompt, selectedAction, referenceImages } = req.body || {};

    if (!editPrompt || typeof editPrompt !== "string") {
      return res.status(400).json({ message: "Debe proporcionar instrucciones de edición." });
    }
    if (editPrompt.length > 1000) {
      return res.status(400).json({ message: "Las instrucciones no pueden exceder 1000 caracteres." });
    }
    if (!selectedAction || !VALID_ADVANCED_ACTIONS.includes(selectedAction)) {
      return res.status(400).json({ message: "Acción no válida. Opciones: agregar, reemplazar, fusionar, estilo, borrar_elemento." });
    }

    const refs: string[] = Array.isArray(referenceImages) ? referenceImages : [];
    if (refs.length > 3) {
      return res.status(400).json({ message: "Máximo 3 imágenes de referencia permitidas." });
    }
    for (const ref of refs) {
      if (typeof ref !== "string" || !ref.startsWith("data:image/")) {
        return res.status(400).json({ message: "Cada imagen de referencia debe ser un data URL válido (data:image/...)." });
      }
    }
    const selectedVersion = versions.find(v => v.isSelected) || versions[versions.length - 1];
    if (!selectedVersion?.imageUrl) {
      return res.status(400).json({ message: "No hay imagen previa para editar." });
    }

    let imageUrl: string;
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({ message: "Gemini no está configurado." });
      }
      imageUrl = await editImageAdvanced({
        currentImageBase64: selectedVersion.imageUrl,
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

    await storage.deselectAllVersions(campaignId);
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson: selectedVersion.contentJson as Record<string, unknown>,
      imageUrl,
      isSelected: true,
    });
    await storage.updateCampaign(campaignId, { selectedImageUrl: imageUrl } as any);
    res.status(201).json(newVersion);
  });

  app.delete("/api/campaigns", requireAuth, async (req, res) => {
    await storage.deleteAllCampaigns(req.session.userId!);
    res.json({ message: "Historial eliminado." });
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

  app.get("/api/brand-identity", requireAuth, async (req, res) => {
    const brand = await storage.getBrandIdentity(req.session.userId!);
    res.json(brand || null);
  });

  app.put("/api/brand-identity", requireAuth, async (req, res) => {
    try {
      const input = updateBrandIdentitySchema.parse(req.body);
      const brand = await storage.upsertBrandIdentity(req.session.userId!, input);
      res.json(brand);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
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
    const selected = versions.find(v => v.isSelected) || versions[0];
    if (!selected) return res.status(400).json({ message: "No hay versiones generadas para esta campaña." });
    const result = renderTemplateWithContent(
      template.html,
      selected.contentJson as Record<string, unknown> | null,
      selected.imageUrl || null
    );
    res.json({ html: result.html, missingFields: result.missingFields, templateName: template.name });
  });

  async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autenticado." });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") {
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
    if (user.role === "admin") {
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
    if (targetUser.role === "admin") {
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

  return httpServer;
}
