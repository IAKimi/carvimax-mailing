import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateImage, editImage, isGeminiConfigured } from "./gemini";
import { generateEmailContent, regenerateEmailContent, isOpenAIConfigured } from "./openai";

const registerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  company: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const createCampaignSchema = z.object({
  name: z.string().min(1),
  idea: z.string().min(1),
  objective: z.string().min(1),
  tone: z.string().min(1),
  layoutPreference: z.string().optional(),
  imagePrompt: z.string().nullable().optional(),
  targetDatabase: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

const createContactSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  country: z.string().optional(),
  segment: z.string().optional(),
});

const updateContactSchema = createContactSchema.partial();

function sanitizeUser(user: { id: number; name: string; email: string; password: string; company: string | null }) {
  const { password, ...safe } = user;
  return safe;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autenticado." });
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

  app.post("/api/auth/register", async (req, res) => {
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

  app.post("/api/auth/login", async (req, res) => {
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
    res.json(sanitizeUser(user));
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

  app.get("/api/campaigns", requireAuth, async (req, res) => {
    const campaigns = await storage.getCampaigns(req.session.userId!);
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
      const updates: any = { ...input };
      if (status && ["draft", "scheduled", "sent", "cancelled"].includes(status)) {
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

  app.post("/api/campaigns/:id/generate", requireAuth, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado." });
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
          const result = await generateEmailContent(campaign.idea, campaign.objective, brandData || null);
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

    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson,
      imageUrl,
      isSelected: versionNumber === 1
    });
    res.status(201).json(newVersion);
  });

  app.post("/api/campaigns/:id/regenerate-text", requireAuth, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado." });
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
        brandData || null
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

    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson,
      imageUrl: selectedVersion.imageUrl,
      isSelected: false,
    });
    res.status(201).json(newVersion);
  });

  app.post("/api/campaigns/:id/regenerate-image", requireAuth, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado." });
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

    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson: selectedVersion?.contentJson || { asunto: "", preheader: "", cuerpo_html: "", cta_text: "Ver más" },
      imageUrl,
      isSelected: false,
    });
    res.status(201).json(newVersion);
  });

  app.post("/api/campaigns/:id/edit-image", requireAuth, async (req, res) => {
    const campaignId = parseId(req.params.id);
    if (!campaignId) return res.status(400).json({ message: "ID inválido." });
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign || campaign.userId !== req.session.userId) {
      return res.status(404).json({ message: "Campaña no encontrada." });
    }
    if (campaign.status === "cancelled") {
      return res.status(400).json({ message: "No se puede modificar un correo cancelado." });
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

    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson: selectedVersion.contentJson as Record<string, unknown>,
      imageUrl,
      isSelected: false,
    });
    res.status(201).json(newVersion);
  });

  app.patch("/api/versions/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const allCampaigns = await storage.getCampaigns(req.session.userId!);
    const campaignIds = new Set(allCampaigns.map(c => c.id));
    const existingVersions = [];
    for (const cId of campaignIds) {
      const vs = await storage.getCampaignVersions(cId);
      existingVersions.push(...vs);
    }
    if (!existingVersions.some(v => v.id === id)) {
      return res.status(404).json({ message: "Versión no encontrada." });
    }
    const version = await storage.updateCampaignVersion(id, req.body);
    if (!version) {
      return res.status(404).json({ message: "Versión no encontrada." });
    }
    res.json(version);
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

  app.get("/api/brand-identity", requireAuth, async (req, res) => {
    const brand = await storage.getBrandIdentity(req.session.userId!);
    res.json(brand || null);
  });

  app.put("/api/brand-identity", requireAuth, async (req, res) => {
    const brand = await storage.upsertBrandIdentity(req.session.userId!, req.body);
    res.json(brand);
  });

  app.get("/api/templates", requireAuth, async (req, res) => {
    const tpls = await storage.getTemplates(req.session.userId!);
    res.json(tpls);
  });

  app.post("/api/templates", requireAuth, async (req, res) => {
    const { name, html } = req.body;
    if (!name || !html) return res.status(400).json({ message: "Nombre y HTML son requeridos." });
    const tpl = await storage.createTemplate({ userId: req.session.userId!, name, html, favorite: false });
    res.status(201).json(tpl);
  });

  app.patch("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpls = await storage.getTemplates(req.session.userId!);
    if (!tpls.some(t => t.id === id)) return res.status(404).json({ message: "Plantilla no encontrada." });
    const tpl = await storage.updateTemplate(id, req.body);
    res.json(tpl);
  });

  app.delete("/api/templates/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });
    const tpls = await storage.getTemplates(req.session.userId!);
    if (!tpls.some(t => t.id === id)) return res.status(404).json({ message: "Plantilla no encontrada." });
    await storage.deleteTemplate(id);
    res.json({ message: "Eliminada." });
  });

  return httpServer;
}
