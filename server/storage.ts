import { eq, and, ne, gte, lt, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, campaigns, campaignVersions, contacts, contactDatabases, brandIdentity, templates,
  type User, type InsertUser,
  type Campaign, type InsertCampaign,
  type CampaignVersion, type InsertCampaignVersion,
  type Contact, type InsertContact,
  type ContactDatabase, type InsertContactDatabase,
  type BrandIdentity, type InsertBrandIdentity,
  type Template, type InsertTemplate
} from "@shared/schema";

type CampaignListItem = Omit<Campaign, "selectedImageUrl">;

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;

  getCampaignsLight(userId: number, year?: number, month?: number): Promise<CampaignListItem[]>;
  getCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteAllCampaigns(userId: number): Promise<void>;

  getCampaignVersions(campaignId: number): Promise<CampaignVersion[]>;
  createCampaignVersion(version: InsertCampaignVersion): Promise<CampaignVersion>;
  updateCampaignVersion(id: number, updates: Partial<InsertCampaignVersion>): Promise<CampaignVersion | undefined>;
  deselectAllVersions(campaignId: number): Promise<void>;

  getDashboardStats(userId: number): Promise<any>;

  getContactDatabases(userId: number): Promise<ContactDatabase[]>;
  createContactDatabase(data: InsertContactDatabase): Promise<ContactDatabase>;
  deleteContactDatabase(id: number): Promise<void>;

  getContacts(databaseId: number): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  createContacts(contactsList: InsertContact[]): Promise<Contact[]>;
  updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
  deleteAllContacts(databaseId: number): Promise<void>;

  getBrandIdentity(userId: number): Promise<BrandIdentity | undefined>;
  upsertBrandIdentity(userId: number, data: Partial<InsertBrandIdentity>): Promise<BrandIdentity>;

  getTemplates(userId: number): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  createTemplate(data: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, updates: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: number): Promise<void>;
  getTemplateVersions(parentTemplateId: number): Promise<Template[]>;
  deleteTemplatesByParent(parentTemplateId: number, excludeId: number): Promise<void>;
  confirmTemplate(id: number, parentId: number): Promise<Template>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getCampaignsLight(userId: number, year?: number, month?: number): Promise<CampaignListItem[]> {
    const cols = {
      id: campaigns.id,
      userId: campaigns.userId,
      name: campaigns.name,
      idea: campaigns.idea,
      objective: campaigns.objective,
      tone: campaigns.tone,
      status: campaigns.status,
      layoutPreference: campaigns.layoutPreference,
      imagePrompt: campaigns.imagePrompt,
      targetDatabase: campaigns.targetDatabase,
      templateId: campaigns.templateId,
      scheduledAt: campaigns.scheduledAt,
      createdAt: campaigns.createdAt,
    };

    if (year !== undefined && month !== undefined) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 1);
      return db.select(cols).from(campaigns).where(
        and(
          eq(campaigns.userId, userId),
          or(
            and(gte(campaigns.scheduledAt, startDate), lt(campaigns.scheduledAt, endDate)),
            isNull(campaigns.scheduledAt)
          )
        )
      );
    }

    return db.select(cols).from(campaigns).where(eq(campaigns.userId, userId));
  }

  async getCampaigns(userId: number): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values(campaign).returning();
    return created;
  }

  async updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [updated] = await db.update(campaigns).set(updates).where(eq(campaigns.id, id)).returning();
    return updated;
  }

  async deleteAllCampaigns(userId: number): Promise<void> {
    const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, userId));
    const campaignIds = userCampaigns.map(c => c.id);
    if (campaignIds.length > 0) {
      for (const cId of campaignIds) {
        await db.delete(campaignVersions).where(eq(campaignVersions.campaignId, cId));
      }
      await db.delete(campaigns).where(eq(campaigns.userId, userId));
    }
  }

  async getCampaignVersions(campaignId: number): Promise<CampaignVersion[]> {
    return db.select().from(campaignVersions).where(eq(campaignVersions.campaignId, campaignId));
  }

  async createCampaignVersion(version: InsertCampaignVersion): Promise<CampaignVersion> {
    const [created] = await db.insert(campaignVersions).values(version).returning();
    return created;
  }

  async updateCampaignVersion(id: number, updates: Partial<InsertCampaignVersion>): Promise<CampaignVersion | undefined> {
    const [updated] = await db.update(campaignVersions).set(updates).where(eq(campaignVersions.id, id)).returning();
    return updated;
  }

  async deselectAllVersions(campaignId: number): Promise<void> {
    await db.update(campaignVersions).set({ isSelected: false }).where(eq(campaignVersions.campaignId, campaignId));
  }

  async getDashboardStats(userId: number): Promise<any> {
    const userCampaigns = await this.getCampaigns(userId);
    const sentCampaigns = userCampaigns.filter(c => c.status === "sent");
    return {
      totalSent: sentCampaigns.length,
      byCountry: {},
      recentCampaigns: userCampaigns
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .slice(0, 5),
    };
  }

  async getContactDatabases(userId: number): Promise<ContactDatabase[]> {
    return db.select().from(contactDatabases).where(eq(contactDatabases.userId, userId));
  }

  async createContactDatabase(contactDb: InsertContactDatabase): Promise<ContactDatabase> {
    const [created] = await db.insert(contactDatabases).values(contactDb).returning();
    return created;
  }

  async deleteContactDatabase(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.databaseId, id));
    await db.delete(contactDatabases).where(eq(contactDatabases.id, id));
  }

  async getContacts(databaseId: number): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.databaseId, databaseId));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async createContacts(contactsList: InsertContact[]): Promise<Contact[]> {
    if (contactsList.length === 0) return [];
    const created = await db.insert(contacts).values(contactsList).returning();
    return created;
  }

  async updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const [updated] = await db.update(contacts).set(updates).where(eq(contacts.id, id)).returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async deleteAllContacts(databaseId: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.databaseId, databaseId));
  }

  async getBrandIdentity(userId: number): Promise<BrandIdentity | undefined> {
    const [brand] = await db.select().from(brandIdentity).where(eq(brandIdentity.userId, userId));
    return brand;
  }

  async upsertBrandIdentity(userId: number, data: Partial<InsertBrandIdentity>): Promise<BrandIdentity> {
    const existing = await this.getBrandIdentity(userId);
    if (existing) {
      const [updated] = await db.update(brandIdentity)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(brandIdentity.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(brandIdentity)
      .values({ ...data, userId })
      .returning();
    return created;
  }

  async getTemplates(userId: number): Promise<Template[]> {
    return db.select().from(templates).where(eq(templates.userId, userId));
  }

  async getTemplate(id: number): Promise<Template | undefined> {
    const [tpl] = await db.select().from(templates).where(eq(templates.id, id));
    return tpl;
  }

  async createTemplate(data: InsertTemplate): Promise<Template> {
    const [created] = await db.insert(templates).values(data).returning();
    return created;
  }

  async updateTemplate(id: number, updates: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [updated] = await db.update(templates).set(updates).where(eq(templates.id, id)).returning();
    return updated;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  async getTemplateVersions(parentTemplateId: number): Promise<Template[]> {
    return db.select().from(templates).where(eq(templates.parentTemplateId, parentTemplateId));
  }

  async deleteTemplatesByParent(parentTemplateId: number, excludeId: number): Promise<void> {
    await db.delete(templates).where(
      and(eq(templates.parentTemplateId, parentTemplateId), eq(templates.isConfirmed, false))
    );
  }

  async confirmTemplate(id: number, parentId: number): Promise<Template> {
    return await db.transaction(async (tx) => {
      await tx.delete(templates).where(
        and(
          eq(templates.parentTemplateId, parentId),
          ne(templates.id, id)
        )
      );
      const [confirmed] = await tx.update(templates)
        .set({ isConfirmed: true, parentTemplateId: id, versionNumber: 1 })
        .where(eq(templates.id, id))
        .returning();
      return confirmed;
    });
  }
}

export const storage = new DatabaseStorage();
