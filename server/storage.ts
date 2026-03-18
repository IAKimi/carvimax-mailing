import { eq, and, ne, gte, lt, isNull, or, sql, inArray, count } from "drizzle-orm";
import { db } from "./db";
import {
  users, campaigns, campaignVersions, contacts, contactDatabases, brandIdentity, templates, campaignSends,
  type User, type InsertUser,
  type Campaign, type InsertCampaign,
  type CampaignVersion, type InsertCampaignVersion,
  type Contact, type InsertContact,
  type ContactDatabase, type InsertContactDatabase,
  type BrandIdentity, type InsertBrandIdentity,
  type Template, type InsertTemplate,
  type CampaignSend, type InsertCampaignSend
} from "@shared/schema";

type CampaignListItem = Omit<Campaign, "selectedImageUrl">;

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyUser(id: number): Promise<User | undefined>;

  getCampaignsLight(userId: number, year?: number, month?: number): Promise<CampaignListItem[]>;
  getCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getAllScheduledCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteAllCampaigns(userId: number): Promise<void>;
  deleteCampaigns(campaignIds: number[], userId: number): Promise<void>;

  getCampaignVersions(campaignId: number): Promise<CampaignVersion[]>;
  createCampaignVersion(version: InsertCampaignVersion): Promise<CampaignVersion>;
  updateCampaignVersion(id: number, updates: Partial<InsertCampaignVersion>): Promise<CampaignVersion | undefined>;
  deselectAllVersions(campaignId: number): Promise<void>;
  deselectVersionsByType(campaignId: number, types: string[]): Promise<void>;
  incrementRegenCount(campaignId: number, field: "imageRegenCount" | "textRegenCount"): Promise<void>;

  getCampaignThumbnails(campaignIds: number[]): Promise<Array<{ campaignId: number; imageUrl: string | null }>>;
  getDashboardStats(userId: number): Promise<any>;
  getDashboardMetrics(userId: number, dateFrom?: string, dateTo?: string): Promise<any>;

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

  createCampaignSends(sends: InsertCampaignSend[]): Promise<CampaignSend[]>;
  getCampaignSendByEmail(campaignId: number, contactEmail: string): Promise<CampaignSend | undefined>;
  updateCampaignSend(campaignId: number, contactEmail: string, updates: Partial<InsertCampaignSend>): Promise<CampaignSend | undefined>;
  getCampaignSends(campaignId: number): Promise<CampaignSend[]>;
  getCampaignSendStats(campaignId: number): Promise<{ total: number; sent: number; failed: number; pending: number }>;
  incrementCampaignSendCount(campaignId: number, field: "sentCount" | "failedCount"): Promise<Campaign | undefined>;
  deleteCampaignSends(campaignId: number): Promise<void>;

  getAllUsers(): Promise<User[]>;
  updateUser(id: number, updates: Partial<{ name: string; email: string; company: string | null; role: string; isActive: boolean }>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  deleteUser(id: number): Promise<void>;
  getAdminStats(): Promise<{ totalUsers: number; totalCampaigns: number; totalCampaignsByStatus: Record<string, number>; totalTemplates: number; totalContacts: number; totalDatabases: number }>;
  getUserStats(userId: number): Promise<{ campaigns: number; templates: number; contacts: number; databases: number }>;
  getRecentActivity(): Promise<Array<{ campaignId: number; campaignName: string; status: string; createdAt: Date | null; userId: number; userName: string; userEmail: string }>>;
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

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user;
  }

  async verifyUser(id: number): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ isVerified: true, verificationToken: null, verificationTokenExpiresAt: null })
      .where(eq(users.id, id))
      .returning();
    return updated;
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
      targetAudience: campaigns.targetAudience,
      templateId: campaigns.templateId,
      scheduledAt: campaigns.scheduledAt,
      totalExpectedSends: campaigns.totalExpectedSends,
      sentCount: campaigns.sentCount,
      failedCount: campaigns.failedCount,
      textApproved: campaigns.textApproved,
      imageApproved: campaigns.imageApproved,
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

  async getAllScheduledCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.status, "scheduled"));
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

  async deleteCampaigns(campaignIds: number[], userId: number): Promise<void> {
    if (campaignIds.length === 0) return;
    for (const cId of campaignIds) {
      const campaign = await db.select().from(campaigns).where(and(eq(campaigns.id, cId), eq(campaigns.userId, userId))).limit(1);
      if (campaign.length > 0) {
        await db.delete(campaignVersions).where(eq(campaignVersions.campaignId, cId));
        await db.delete(campaigns).where(eq(campaigns.id, cId));
      }
    }
  }

  async getCampaignVersions(campaignId: number): Promise<CampaignVersion[]> {
    return db.select().from(campaignVersions).where(eq(campaignVersions.campaignId, campaignId));
  }

  async getCampaignThumbnails(campaignIds: number[]): Promise<Array<{ campaignId: number; imageUrl: string | null }>> {
    if (campaignIds.length === 0) return [];
    const rows = await db.select({
      campaignId: campaignVersions.campaignId,
      imageUrl: campaignVersions.imageUrl,
    }).from(campaignVersions).where(
      and(
        eq(campaignVersions.isSelected, true),
        inArray(campaignVersions.campaignId, campaignIds)
      )
    );
    return rows;
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

  async deselectVersionsByType(campaignId: number, types: string[]): Promise<void> {
    await db.update(campaignVersions)
      .set({ isSelected: false })
      .where(
        and(
          eq(campaignVersions.campaignId, campaignId),
          inArray(campaignVersions.type, types)
        )
      );
  }

  async incrementRegenCount(campaignId: number, field: "imageRegenCount" | "textRegenCount"): Promise<void> {
    await db.update(campaigns)
      .set({ [field]: sql`COALESCE(${field === "imageRegenCount" ? campaigns.imageRegenCount : campaigns.textRegenCount}, 0) + 1` })
      .where(eq(campaigns.id, campaignId));
  }

  async getDashboardStats(userId: number): Promise<any> {
    const userCampaigns = await this.getCampaigns(userId);
    const sentCampaigns = userCampaigns.filter(c => c.status === "sent");
    const recent = userCampaigns
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 5);

    const recentWithSubject = [];
    for (const c of recent) {
      const versions = await this.getCampaignVersions(c.id);
      const selected = versions.find(v => v.isSelected) || versions[0];
      const cj = selected?.contentJson as any;
      const subject = cj?.asunto || cj?.subject || c.name;
      recentWithSubject.push({ ...c, subject });
    }

    return {
      totalSent: sentCampaigns.length,
      byCountry: {},
      recentCampaigns: recentWithSubject,
    };
  }

  async getDashboardMetrics(userId: number, dateFrom?: string, dateTo?: string): Promise<any> {
    let userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
      userCampaigns = userCampaigns.filter(c => {
        const d = c.scheduledAt || c.createdAt;
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    const statusCounts: Record<string, number> = { draft: 0, scheduled: 0, sent: 0, cancelled: 0 };
    for (const c of userCampaigns) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const timeline: Record<string, number> = {};
    for (const c of userCampaigns) {
      const d = c.scheduledAt || c.createdAt;
      if (d && d >= currentMonthStart && d < currentMonthEnd) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        timeline[key] = (timeline[key] || 0) + 1;
      }
    }
    const campaignTimeline = Object.entries(timeline)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const userDbs = await db.select().from(contactDatabases).where(eq(contactDatabases.userId, userId));
    const dbIdToName: Record<string, string> = {};
    for (const d of userDbs) {
      dbIdToName[String(d.id)] = d.name;
    }

    const dbCounts: Record<string, number> = {};
    for (const c of userCampaigns) {
      if (c.targetDatabase) {
        const dbName = dbIdToName[c.targetDatabase] || c.targetDatabase;
        dbCounts[dbName] = (dbCounts[dbName] || 0) + 1;
      }
    }
    const topDatabases = Object.entries(dbCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const usedDbIds = new Set(userCampaigns.filter(c => c.status === "sent" && c.targetDatabase).map(c => c.targetDatabase!));
    let totalContactsReached = 0;
    if (usedDbIds.size > 0) {
      const matchingDbIds = userDbs.filter(d => usedDbIds.has(String(d.id))).map(d => d.id);
      if (matchingDbIds.length > 0) {
        const [contactCount] = await db.select({ c: count() }).from(contacts).where(inArray(contacts.databaseId, matchingDbIds));
        totalContactsReached = contactCount.c;
      }
    }

    const allVersions = await db.select({ campaignId: campaignVersions.campaignId })
      .from(campaignVersions)
      .where(inArray(campaignVersions.campaignId, userCampaigns.map(c => c.id).length > 0 ? userCampaigns.map(c => c.id) : [0]));
    const versionsBycamp: Record<number, number> = {};
    for (const v of allVersions) {
      versionsBycamp[v.campaignId] = (versionsBycamp[v.campaignId] || 0) + 1;
    }
    const vCounts = Object.values(versionsBycamp);
    const averageVersionsPerCampaign = vCounts.length > 0 ? Math.round((vCounts.reduce((s, n) => s + n, 0) / vCounts.length) * 10) / 10 : 0;

    const templateCounts: Record<number, number> = {};
    for (const c of userCampaigns) {
      if (c.templateId) {
        templateCounts[c.templateId] = (templateCounts[c.templateId] || 0) + 1;
      }
    }
    const topTemplateIds = Object.entries(templateCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const topTemplates: Array<{ name: string; count: number }> = [];
    for (const [tid, cnt] of topTemplateIds) {
      const tpl = await db.select({ name: templates.name }).from(templates).where(eq(templates.id, Number(tid)));
      topTemplates.push({ name: tpl[0]?.name || `Plantilla #${tid}`, count: cnt });
    }

    const campaignsByMonth: Array<{ month: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const key = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
      const cnt = userCampaigns.filter(c => {
        const d = c.scheduledAt || c.createdAt;
        return d && d >= mDate && d < mEnd;
      }).length;
      campaignsByMonth.push({ month: key, count: cnt });
    }

    const recentCampaigns = [...userCampaigns]
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 5)
      .map(c => ({ id: c.id, name: c.name, status: c.status, date: c.scheduledAt || c.createdAt }));

    const [dbCountResult] = await db.select({ c: count() }).from(contactDatabases).where(eq(contactDatabases.userId, userId));

    return {
      totalCampaigns: statusCounts,
      campaignTimeline,
      topDatabases,
      totalContactsReached,
      averageVersionsPerCampaign,
      topTemplates,
      campaignsByMonth,
      recentCampaigns,
      totalDatabases: dbCountResult.c,
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

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: number, updates: Partial<{ name: string; email: string; company: string | null; role: string; isActive: boolean }>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, id));
    for (const c of userCampaigns) {
      await db.delete(campaignVersions).where(eq(campaignVersions.campaignId, c.id));
    }
    await db.delete(campaigns).where(eq(campaigns.userId, id));
    await db.delete(contacts).where(eq(contacts.userId, id));
    await db.delete(contactDatabases).where(eq(contactDatabases.userId, id));
    await db.delete(templates).where(eq(templates.userId, id));
    await db.delete(brandIdentity).where(eq(brandIdentity.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalCampaigns: number; totalCampaignsByStatus: Record<string, number>; totalTemplates: number; totalContacts: number; totalDatabases: number }> {
    const [userCount] = await db.select({ c: count() }).from(users);
    const [campaignCount] = await db.select({ c: count() }).from(campaigns);
    const [templateCount] = await db.select({ c: count() }).from(templates);
    const [contactCount] = await db.select({ c: count() }).from(contacts);
    const [dbCount] = await db.select({ c: count() }).from(contactDatabases);
    const allCampaigns = await db.select({ status: campaigns.status }).from(campaigns);
    const byStatus: Record<string, number> = {};
    for (const c of allCampaigns) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    }
    return {
      totalUsers: userCount.c,
      totalCampaigns: campaignCount.c,
      totalCampaignsByStatus: byStatus,
      totalTemplates: templateCount.c,
      totalContacts: contactCount.c,
      totalDatabases: dbCount.c,
    };
  }

  async getUserStats(userId: number): Promise<{ campaigns: number; templates: number; contacts: number; databases: number }> {
    const [campaignCount] = await db.select({ c: count() }).from(campaigns).where(eq(campaigns.userId, userId));
    const [templateCount] = await db.select({ c: count() }).from(templates).where(eq(templates.userId, userId));
    const [contactCount] = await db.select({ c: count() }).from(contacts).where(eq(contacts.userId, userId));
    const [dbCount] = await db.select({ c: count() }).from(contactDatabases).where(eq(contactDatabases.userId, userId));
    return {
      campaigns: campaignCount.c,
      templates: templateCount.c,
      contacts: contactCount.c,
      databases: dbCount.c,
    };
  }

  async createCampaignSends(sends: InsertCampaignSend[]): Promise<CampaignSend[]> {
    if (sends.length === 0) return [];
    return await db.insert(campaignSends).values(sends).returning();
  }

  async getCampaignSendByEmail(campaignId: number, contactEmail: string): Promise<CampaignSend | undefined> {
    const [result] = await db.select().from(campaignSends)
      .where(and(eq(campaignSends.campaignId, campaignId), eq(campaignSends.contactEmail, contactEmail)));
    return result;
  }

  async updateCampaignSend(campaignId: number, contactEmail: string, updates: Partial<InsertCampaignSend>): Promise<CampaignSend | undefined> {
    const [result] = await db
      .update(campaignSends)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(campaignSends.campaignId, campaignId), eq(campaignSends.contactEmail, contactEmail)))
      .returning();
    return result;
  }

  async getCampaignSends(campaignId: number): Promise<CampaignSend[]> {
    return await db.select().from(campaignSends).where(eq(campaignSends.campaignId, campaignId)).orderBy(campaignSends.id);
  }

  async getCampaignSendStats(campaignId: number): Promise<{ total: number; sent: number; failed: number; pending: number }> {
    const rows = await db.select({ status: campaignSends.status, c: count() }).from(campaignSends).where(eq(campaignSends.campaignId, campaignId)).groupBy(campaignSends.status);
    const stats = { total: 0, sent: 0, failed: 0, pending: 0 };
    for (const r of rows) {
      const n = Number(r.c);
      stats.total += n;
      if (r.status === "sent") stats.sent = n;
      else if (r.status === "failed") stats.failed = n;
      else stats.pending += n;
    }
    return stats;
  }

  async incrementCampaignSendCount(campaignId: number, field: "sentCount" | "failedCount"): Promise<Campaign | undefined> {
    const col = field === "sentCount" ? campaigns.sentCount : campaigns.failedCount;
    const [result] = await db
      .update(campaigns)
      .set({ [field]: sql`COALESCE(${col}, 0) + 1` })
      .where(eq(campaigns.id, campaignId))
      .returning();
    return result;
  }

  async deleteCampaignSends(campaignId: number): Promise<void> {
    await db.delete(campaignSends).where(eq(campaignSends.campaignId, campaignId));
  }

  async getRecentActivity(): Promise<Array<{ campaignId: number; campaignName: string; status: string; createdAt: Date | null; userId: number; userName: string; userEmail: string }>> {
    const rows = await db
      .select({
        campaignId: campaigns.id,
        campaignName: campaigns.name,
        status: campaigns.status,
        createdAt: campaigns.createdAt,
        userId: campaigns.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(campaigns)
      .innerJoin(users, eq(campaigns.userId, users.id))
      .orderBy(sql`${campaigns.createdAt} DESC NULLS LAST`)
      .limit(20);

    const result = [];
    for (const row of rows) {
      const versions = await this.getCampaignVersions(row.campaignId);
      const selected = versions.find(v => v.isSelected) || versions[0];
      const cj = selected?.contentJson as any;
      const subject = cj?.asunto || cj?.subject || null;
      result.push({ ...row, campaignName: subject || row.campaignName });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
