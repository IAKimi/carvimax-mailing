import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users, campaigns, campaignVersions, contacts, contactDatabases,
  type User, type InsertUser,
  type Campaign, type InsertCampaign,
  type CampaignVersion, type InsertCampaignVersion,
  type Contact, type InsertContact,
  type ContactDatabase, type InsertContactDatabase
} from "@shared/schema";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;

  getCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign | undefined>;

  getCampaignVersions(campaignId: number): Promise<CampaignVersion[]>;
  createCampaignVersion(version: InsertCampaignVersion): Promise<CampaignVersion>;
  updateCampaignVersion(id: number, updates: Partial<InsertCampaignVersion>): Promise<CampaignVersion | undefined>;

  getDashboardStats(userId: number): Promise<any>;

  getContactDatabases(userId: number): Promise<ContactDatabase[]>;
  createContactDatabase(db: InsertContactDatabase): Promise<ContactDatabase>;
  deleteContactDatabase(id: number): Promise<void>;

  getContacts(databaseId: number): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
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

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: number, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const [updated] = await db.update(contacts).set(updates).where(eq(contacts.id, id)).returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }
}

export const storage = new DatabaseStorage();
