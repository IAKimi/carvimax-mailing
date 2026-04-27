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
  isVerified: boolean("is_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiresAt: timestamp("verification_token_expires_at"),
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
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  totalExpectedSends: integer("total_expected_sends").default(0),
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  imageRegenCount: integer("image_regen_count").default(0),
  textRegenCount: integer("text_regen_count").default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  providerId: integer("provider_id"),
  schedulerRetryCount: integer("scheduler_retry_count").default(0),
  schedulerLastError: text("scheduler_last_error"),
  textApproved: boolean("text_approved").default(false),
  imageApproved: boolean("image_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignVersions = pgTable("campaign_versions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  contentJson: jsonb("content_json").notNull(),
  imageUrl: text("image_url"),
  isSelected: boolean("is_selected").default(false),
  type: text("type").notNull().default("initial"),
  sentHtml: text("sent_html"),
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
  visualStyle: text("visual_style").default("moderno"),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
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
  lockedFields: jsonb("locked_fields").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const campaignSends = pgTable("campaign_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name"),
  status: text("status").notNull().default("pending"),
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailProviders = pgTable("email_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  provider: text("provider").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  webhookId: text("webhook_id"),
  accountEmail: text("account_email"),
  accountPlan: text("account_plan"),
  mailchimpDataCenter: text("mailchimp_data_center"),
  mailchimpAudienceId: text("mailchimp_audience_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const TEMPLATE_PLACEHOLDERS = {
  ASUNTO: { key: "{{ASUNTO}}", field: "asunto", label: "Asunto del correo", description: "Línea de asunto que aparece en la bandeja de entrada" },
  PREHEADER: { key: "{{PREHEADER}}", field: "preheader", label: "Vista previa (Preheader)", description: "Texto que aparece después del asunto en la bandeja" },
  CONTENIDO: { key: "{{CONTENIDO}}", field: "cuerpo_html", label: "Cuerpo del correo", description: "Contenido principal del email en HTML" },
  CTA_TEXTO: { key: "{{CTA_TEXTO}}", field: "cta_text", label: "Texto del botón", description: "Texto visible del botón de acción (CTA)" },
  CTA_URL: { key: "{{CTA_URL}}", field: "cta_url", label: "Enlace del botón", description: "URL de destino del botón de acción" },
  IMAGEN_URL: { key: "{{IMAGEN_URL}}", field: "imageUrl", label: "Imagen principal", description: "URL de la imagen hero del correo" },
  LOGO_URL: { key: "{{LOGO_URL}}", field: "logoUrl", label: "Logo de la empresa", description: "URL del logo de la empresa en la cabecera" },
} as const;

export const ALL_PLACEHOLDER_KEYS = Object.values(TEMPLATE_PLACEHOLDERS).map(p => p.key);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, role: true, isActive: true, isVerified: true, verificationToken: true, verificationTokenExpiresAt: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, status: true, totalExpectedSends: true, sentCount: true, failedCount: true, imageRegenCount: true, textRegenCount: true, schedulerRetryCount: true, schedulerLastError: true, textApproved: true, imageApproved: true });
export const insertCampaignVersionSchema = createInsertSchema(campaignVersions).omit({ id: true, createdAt: true });
export const insertContactDatabaseSchema = createInsertSchema(contactDatabases).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });
export const insertBrandIdentitySchema = createInsertSchema(brandIdentity).omit({ id: true, updatedAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertCampaignSendSchema = createInsertSchema(campaignSends).omit({ id: true, createdAt: true, updatedAt: true });
export const EMAIL_PROVIDER_TYPES = ["brevo", "mailchimp"] as const;
export type EmailProviderType = typeof EMAIL_PROVIDER_TYPES[number];
export const insertEmailProviderSchema = createInsertSchema(emailProviders).omit({ id: true, createdAt: true }).extend({
  provider: z.enum(EMAIL_PROVIDER_TYPES),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type UpdateCampaign = Partial<typeof campaigns.$inferInsert>;

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

export type CampaignSend = typeof campaignSends.$inferSelect;
export type InsertCampaignSend = z.infer<typeof insertCampaignSendSchema>;

export type EmailProvider = typeof emailProviders.$inferSelect;
export type InsertEmailProvider = z.infer<typeof insertEmailProviderSchema>;

export const ASSISTANT_SECTIONS = ["brand", "calendar", "templates", "contacts", "history", "dashboard", "provider", "settings", "general"] as const;
export type AssistantSection = typeof ASSISTANT_SECTIONS[number];

export const assistantConversations = pgTable("assistant_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  section: text("section").notNull(),
  lastResponseId: text("last_response_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssistantConversationSchema = createInsertSchema(assistantConversations).omit({ id: true, updatedAt: true });
export type AssistantConversation = typeof assistantConversations.$inferSelect;
export type InsertAssistantConversation = z.infer<typeof insertAssistantConversationSchema>;
