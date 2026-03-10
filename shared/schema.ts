import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  company: text("company"),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  idea: text("idea").notNull(),
  objective: text("objective").notNull(),
  tone: text("tone").notNull(),
  status: text("status").notNull().default("draft"),
  layoutPreference: text("layout_preference").notNull().default("Hero_Centered"),
  imagePrompt: text("image_prompt"),
  targetDatabase: text("target_database"),
  selectedImageUrl: text("selected_image_url"),
  targetAudience: text("target_audience"),
  templateId: integer("template_id"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignVersions = pgTable("campaign_versions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  contentJson: jsonb("content_json").notNull(),
  imageUrl: text("image_url"),
  isSelected: boolean("is_selected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactDatabases = pgTable("contact_databases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  databaseId: integer("database_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  position: text("position"),
  segment: text("segment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brandIdentity = pgTable("brand_identity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  companyName: text("company_name"),
  industry: text("industry"),
  website: text("website"),
  whatsapp: text("whatsapp"),
  mission: text("mission"),
  vision: text("vision"),
  products: text("products"),
  history: text("history"),
  styleGuide: text("style_guide"),
  targetAudience: text("target_audience"),
  tone: text("tone"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  headingFont: text("heading_font"),
  bodyFont: text("body_font"),
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  html: text("html").notNull(),
  favorite: boolean("favorite").default(false),
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiEditCount: integer("ai_edit_count").default(0),
  originalHtml: text("original_html"),
  hasAllPlaceholders: boolean("has_all_placeholders").default(false),
  isConfirmed: boolean("is_confirmed").default(true),
  parentTemplateId: integer("parent_template_id"),
  versionNumber: integer("version_number").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const TEMPLATE_PLACEHOLDERS = {
  ASUNTO: { key: "{{ASUNTO}}", field: "asunto", label: "Asunto del correo", description: "Línea de asunto que aparece en la bandeja de entrada" },
  PREHEADER: { key: "{{PREHEADER}}", field: "preheader", label: "Vista previa (Preheader)", description: "Texto que aparece después del asunto en la bandeja" },
  CONTENIDO: { key: "{{CONTENIDO}}", field: "cuerpo_html", label: "Cuerpo del correo", description: "Contenido principal del email en HTML" },
  CTA_TEXTO: { key: "{{CTA_TEXTO}}", field: "cta_text", label: "Texto del botón", description: "Texto visible del botón de acción (CTA)" },
  CTA_URL: { key: "{{CTA_URL}}", field: "cta_url", label: "Enlace del botón", description: "URL de destino del botón de acción" },
  IMAGEN_URL: { key: "{{IMAGEN_URL}}", field: "imageUrl", label: "Imagen principal", description: "URL de la imagen hero del correo" },
} as const;

export const ALL_PLACEHOLDER_KEYS = Object.values(TEMPLATE_PLACEHOLDERS).map(p => p.key);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, role: true, isActive: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, status: true });
export const insertCampaignVersionSchema = createInsertSchema(campaignVersions).omit({ id: true, createdAt: true });
export const insertContactDatabaseSchema = createInsertSchema(contactDatabases).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });
export const insertBrandIdentitySchema = createInsertSchema(brandIdentity).omit({ id: true, updatedAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type CampaignVersion = typeof campaignVersions.$inferSelect;
export type InsertCampaignVersion = z.infer<typeof insertCampaignVersionSchema>;

export type ContactDatabase = typeof contactDatabases.$inferSelect;
export type InsertContactDatabase = z.infer<typeof insertContactDatabaseSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type BrandIdentity = typeof brandIdentity.$inferSelect;
export type InsertBrandIdentity = z.infer<typeof insertBrandIdentitySchema>;

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
