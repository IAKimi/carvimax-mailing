import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Dashboard
  app.get(api.dashboard.stats.path, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // Campaigns
  app.get(api.campaigns.list.path, async (req, res) => {
    const campaigns = await storage.getCampaigns();
    res.json(campaigns);
  });

  app.get(api.campaigns.get.path, async (req, res) => {
    const campaign = await storage.getCampaign(Number(req.params.id));
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    res.json(campaign);
  });

  app.post(api.campaigns.create.path, async (req, res) => {
    try {
      const input = api.campaigns.create.input.parse(req.body);
      const campaign = await storage.createCampaign(input);
      res.status(201).json(campaign);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.campaigns.update.path, async (req, res) => {
    try {
      const input = api.campaigns.update.input.parse(req.body);
      const campaign = await storage.updateCampaign(Number(req.params.id), input);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Campaign Versions
  app.get(api.campaignVersions.list.path, async (req, res) => {
    const versions = await storage.getCampaignVersions(Number(req.params.id));
    res.json(versions);
  });

  // AI Generation Mock Endpoint
  app.post(api.campaignVersions.generate.path, async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = await storage.getCampaign(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const versions = await storage.getCampaignVersions(campaignId);
    const versionNumber = versions.length + 1;

    if (versionNumber > 3) {
      return res.status(400).json({ message: "Maximum number of generations (3) reached." });
    }

    // Mock generated version
    const newVersion = await storage.createCampaignVersion({
      campaignId,
      versionNumber,
      contentJson: {
        title: `Propuesta generada #${versionNumber}`,
        body: `Este es el cuerpo del correo generado por la IA para el tono: ${campaign.tone} y la idea: ${campaign.idea}.`,
        cta: "Ver más"
      },
      imageUrl: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=2070&auto=format&fit=crop",
      isSelected: false
    });

    res.status(201).json(newVersion);
  });

  app.patch(api.campaignVersions.update.path, async (req, res) => {
    try {
      const input = api.campaignVersions.update.input.parse(req.body);
      const version = await storage.updateCampaignVersion(Number(req.params.id), input);
      
      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }
      res.json(version);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Contacts
  app.get(api.contacts.list.path, async (req, res) => {
    const contacts = await storage.getContacts();
    res.json(contacts);
  });

  return httpServer;
}
