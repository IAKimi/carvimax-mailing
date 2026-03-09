import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  company: text("company"),
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
  country: text("country"),
  segment: text("segment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, status: true });
export const insertCampaignVersionSchema = createInsertSchema(campaignVersions).omit({ id: true, createdAt: true });
export const insertContactDatabaseSchema = createInsertSchema(contactDatabases).omit({ id: true, createdAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });

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
