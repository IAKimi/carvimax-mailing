import { 
  users, campaigns, campaignVersions, contacts,
  type User, type InsertUser,
  type Campaign, type InsertCampaign,
  type CampaignVersion, type InsertCampaignVersion,
  type Contact, type InsertContact
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  
  // Versions
  getCampaignVersions(campaignId: number): Promise<CampaignVersion[]>;
  createCampaignVersion(version: InsertCampaignVersion): Promise<CampaignVersion>;
  updateCampaignVersion(id: number, updates: Partial<InsertCampaignVersion>): Promise<CampaignVersion | undefined>;
  
  // Dashboard
  getDashboardStats(): Promise<any>;
  
  // Contacts
  getContacts(): Promise<Contact[]>;
}

export class MemStorage implements IStorage {
  private currentId = 1;
  private users: User[] = [{ id: 1, name: "Admin", email: "admin@example.com", company: "Mi Empresa" }];
  private campaigns: Campaign[] = [];
  private versions: CampaignVersion[] = [];
  private contacts: Contact[] = [
    { id: 1, userId: 1, email: "cliente1@gmail.com", name: "Juan Pérez", country: "MX", segment: "Premium", createdAt: new Date() },
    { id: 2, userId: 1, email: "cliente2@gmail.com", name: "María Gómez", country: "CO", segment: "Standard", createdAt: new Date() },
    { id: 3, userId: 1, email: "cliente3@gmail.com", name: "Carlos López", country: "ES", segment: "Premium", createdAt: new Date() },
  ];

  constructor() {
    // Seed some initial data so the dashboard looks good
    this.seedData();
  }

  private seedData() {
    this.campaigns.push({
      id: 1,
      userId: 1,
      name: "Campaña Día de Madres",
      idea: "Promoción del 20% en toda la tienda",
      objective: "Generar ventas directas",
      tone: "Emocional y cálido",
      status: "draft",
      layoutPreference: "Hero_Centered",
      scheduledAt: null,
      createdAt: new Date(Date.now() - 86400000 * 2)
    });
    
    this.versions.push({
      id: 1,
      campaignId: 1,
      versionNumber: 1,
      contentJson: { 
        title: "¡Feliz día a la mejor!", 
        body: "Aprovecha nuestro 20% de descuento en toda la tienda. Hazla sonreír hoy.",
        cta: "Comprar ahora"
      },
      imageUrl: "https://images.unsplash.com/photo-1581579186913-46eaacaec265?q=80&w=2070&auto=format&fit=crop",
      isSelected: true,
      createdAt: new Date(Date.now() - 86400000 * 2)
    });

    this.currentId = 10;
  }

  async getCampaigns(): Promise<Campaign[]> {
    return this.campaigns;
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    return this.campaigns.find(c => c.id === id);
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = this.currentId++;
    const campaign: Campaign = { 
      ...insertCampaign, 
      id, 
      status: "draft",
      layoutPreference: insertCampaign.layoutPreference ?? "Hero_Centered",
      createdAt: new Date(),
      scheduledAt: insertCampaign.scheduledAt ?? null
    };
    this.campaigns.push(campaign);
    return campaign;
  }

  async updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const idx = this.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    this.campaigns[idx] = { ...this.campaigns[idx], ...updates };
    return this.campaigns[idx];
  }

  async getCampaignVersions(campaignId: number): Promise<CampaignVersion[]> {
    return this.versions.filter(v => v.campaignId === campaignId);
  }

  async createCampaignVersion(insertVersion: InsertCampaignVersion): Promise<CampaignVersion> {
    const id = this.currentId++;
    const version: CampaignVersion = { 
      ...insertVersion, 
      id,
      isSelected: insertVersion.isSelected ?? false,
      imageUrl: insertVersion.imageUrl ?? null,
      createdAt: new Date()
    };
    this.versions.push(version);
    return version;
  }

  async updateCampaignVersion(id: number, updates: Partial<InsertCampaignVersion>): Promise<CampaignVersion | undefined> {
    const idx = this.versions.findIndex(v => v.id === id);
    if (idx === -1) return undefined;
    this.versions[idx] = { ...this.versions[idx], ...updates };
    return this.versions[idx];
  }

  async getDashboardStats(): Promise<any> {
    return {
      totalSent: 1450,
      byCountry: {
        "MX": 450,
        "CO": 600,
        "ES": 400
      },
      recentCampaigns: [...this.campaigns].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 5)
    };
  }

  async getContacts(): Promise<Contact[]> {
    return this.contacts;
  }
}

export const storage = new MemStorage();
