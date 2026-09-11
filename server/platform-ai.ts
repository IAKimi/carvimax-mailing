import { eq } from "drizzle-orm";
import { db } from "./db";
import { encryptApiKey, decryptApiKey } from "./encryption";
import {
  platformAiSettings,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  OPENAI_MODEL_OPTIONS,
  GEMINI_IMAGE_MODEL_OPTIONS,
  GEMINI_FALLBACK_MODEL_OPTIONS,
  type PlatformAiSettings,
} from "@shared/schema";

const SINGLETON_ID = 1;
const CACHE_TTL_MS = 15_000;

export type PlatformAiPublicSettings = {
  openaiConfigured: boolean;
  openaiKeyHint: string | null;
  /** Valor completo solo para endpoints de superadmin. */
  openaiApiKey: string | null;
  geminiConfigured: boolean;
  geminiKeyHint: string | null;
  /** Valor completo solo para endpoints de superadmin. */
  geminiApiKey: string | null;
  openaiModel: string;
  geminiImageModel: string;
  geminiFallbackModel: string;
  openaiModelOptions: readonly string[];
  geminiImageModelOptions: readonly string[];
  geminiFallbackModelOptions: readonly string[];
  source: {
    openaiKey: "database" | "env" | "none";
    geminiKey: "database" | "env" | "none";
  };
  updatedAt: string | null;
};

type ResolvedConfig = {
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  openaiModel: string;
  geminiImageModel: string;
  geminiFallbackModel: string;
  openaiKeySource: "database" | "env" | "none";
  geminiKeySource: "database" | "env" | "none";
  row: PlatformAiSettings | null;
};

let cache: { at: number; value: ResolvedConfig } | null = null;

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function decryptField(
  encrypted: string | null | undefined,
  iv: string | null | undefined,
  authTag: string | null | undefined,
): string | null {
  if (!encrypted || !iv || !authTag) return null;
  try {
    return decryptApiKey(encrypted, iv, authTag);
  } catch (err) {
    console.error("[platform-ai] Failed to decrypt API key:", err);
    return null;
  }
}

async function ensureRow(): Promise<PlatformAiSettings> {
  const [existing] = await db.select().from(platformAiSettings).where(eq(platformAiSettings.id, SINGLETON_ID));
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(platformAiSettings)
      .values({
        id: SINGLETON_ID,
        openaiModel: DEFAULT_OPENAI_MODEL,
        geminiImageModel: DEFAULT_GEMINI_IMAGE_MODEL,
        geminiFallbackModel: DEFAULT_GEMINI_FALLBACK_MODEL,
      })
      .returning();
    if (created) return created;
  } catch {
    // concurrent insert
  }

  const [again] = await db.select().from(platformAiSettings).where(eq(platformAiSettings.id, SINGLETON_ID));
  if (!again) throw new Error("No se pudo inicializar la configuración de IA de la plataforma.");
  return again;
}

function isUsableKey(key: string | null | undefined): key is string {
  if (!key) return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.includes("placeholder")) return false;
  if (trimmed === "sk-..." || trimmed === "AIza...") return false;
  return true;
}

async function loadResolvedConfig(): Promise<ResolvedConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  let row: PlatformAiSettings | null = null;
  try {
    const [existing] = await db.select().from(platformAiSettings).where(eq(platformAiSettings.id, SINGLETON_ID));
    row = existing ?? null;
  } catch (err) {
    console.error("[platform-ai] Error reading platform_ai_settings (¿falta migración?):", err);
  }

  const dbOpenAi = decryptField(row?.openaiEncryptedApiKey, row?.openaiIv, row?.openaiAuthTag);
  const dbGemini = decryptField(row?.geminiEncryptedApiKey, row?.geminiIv, row?.geminiAuthTag);
  const envOpenAi = process.env.OPENAI_API_KEY?.trim() || null;
  const envGemini = process.env.GEMINI_API_KEY?.trim() || null;

  let openaiApiKey: string | null = null;
  let openaiKeySource: ResolvedConfig["openaiKeySource"] = "none";
  if (isUsableKey(dbOpenAi)) {
    openaiApiKey = dbOpenAi;
    openaiKeySource = "database";
  } else if (isUsableKey(envOpenAi)) {
    openaiApiKey = envOpenAi;
    openaiKeySource = "env";
  }

  let geminiApiKey: string | null = null;
  let geminiKeySource: ResolvedConfig["geminiKeySource"] = "none";
  if (isUsableKey(dbGemini)) {
    geminiApiKey = dbGemini;
    geminiKeySource = "database";
  } else if (isUsableKey(envGemini)) {
    geminiApiKey = envGemini;
    geminiKeySource = "env";
  }

  const value: ResolvedConfig = {
    openaiApiKey,
    geminiApiKey,
    openaiModel: row?.openaiModel || DEFAULT_OPENAI_MODEL,
    geminiImageModel: row?.geminiImageModel || DEFAULT_GEMINI_IMAGE_MODEL,
    geminiFallbackModel: row?.geminiFallbackModel || DEFAULT_GEMINI_FALLBACK_MODEL,
    openaiKeySource,
    geminiKeySource,
    row,
  };

  cache = { at: Date.now(), value };
  return value;
}

export function invalidatePlatformAiCache(): void {
  cache = null;
}

export async function getOpenAIApiKey(): Promise<string | null> {
  const cfg = await loadResolvedConfig();
  return cfg.openaiApiKey;
}

export async function getOpenAIModel(): Promise<string> {
  const cfg = await loadResolvedConfig();
  return cfg.openaiModel;
}

export async function getGeminiApiKey(): Promise<string | null> {
  const cfg = await loadResolvedConfig();
  return cfg.geminiApiKey;
}

export async function getGeminiModels(): Promise<{ primary: string; fallback: string }> {
  const cfg = await loadResolvedConfig();
  return { primary: cfg.geminiImageModel, fallback: cfg.geminiFallbackModel };
}

export async function getPlatformAiPublicSettings(): Promise<PlatformAiPublicSettings> {
  const cfg = await loadResolvedConfig();
  return {
    openaiConfigured: !!cfg.openaiApiKey,
    openaiKeyHint: cfg.openaiApiKey ? maskKey(cfg.openaiApiKey) : null,
    openaiApiKey: cfg.openaiApiKey,
    geminiConfigured: !!cfg.geminiApiKey,
    geminiKeyHint: cfg.geminiApiKey ? maskKey(cfg.geminiApiKey) : null,
    geminiApiKey: cfg.geminiApiKey,
    openaiModel: cfg.openaiModel,
    geminiImageModel: cfg.geminiImageModel,
    geminiFallbackModel: cfg.geminiFallbackModel,
    openaiModelOptions: OPENAI_MODEL_OPTIONS,
    geminiImageModelOptions: GEMINI_IMAGE_MODEL_OPTIONS,
    geminiFallbackModelOptions: GEMINI_FALLBACK_MODEL_OPTIONS,
    source: {
      openaiKey: cfg.openaiKeySource,
      geminiKey: cfg.geminiKeySource,
    },
    updatedAt: cfg.row?.updatedAt ? new Date(cfg.row.updatedAt).toISOString() : null,
  };
}

export type UpdatePlatformAiInput = {
  openaiApiKey?: string;
  geminiApiKey?: string;
  clearOpenaiApiKey?: boolean;
  clearGeminiApiKey?: boolean;
  openaiModel?: string;
  geminiImageModel?: string;
  geminiFallbackModel?: string;
};

export async function updatePlatformAiSettings(input: UpdatePlatformAiInput): Promise<PlatformAiPublicSettings> {
  const row = await ensureRow();
  const patch: Partial<typeof platformAiSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.clearOpenaiApiKey) {
    patch.openaiEncryptedApiKey = null;
    patch.openaiIv = null;
    patch.openaiAuthTag = null;
  } else if (typeof input.openaiApiKey === "string" && input.openaiApiKey.trim()) {
    const enc = encryptApiKey(input.openaiApiKey.trim());
    patch.openaiEncryptedApiKey = enc.encrypted;
    patch.openaiIv = enc.iv;
    patch.openaiAuthTag = enc.authTag;
  }

  if (input.clearGeminiApiKey) {
    patch.geminiEncryptedApiKey = null;
    patch.geminiIv = null;
    patch.geminiAuthTag = null;
  } else if (typeof input.geminiApiKey === "string" && input.geminiApiKey.trim()) {
    const enc = encryptApiKey(input.geminiApiKey.trim());
    patch.geminiEncryptedApiKey = enc.encrypted;
    patch.geminiIv = enc.iv;
    patch.geminiAuthTag = enc.authTag;
  }

  if (input.openaiModel) {
    if (!(OPENAI_MODEL_OPTIONS as readonly string[]).includes(input.openaiModel)) {
      throw new Error("Modelo de OpenAI no válido.");
    }
    patch.openaiModel = input.openaiModel;
  }

  if (input.geminiImageModel) {
    if (!(GEMINI_IMAGE_MODEL_OPTIONS as readonly string[]).includes(input.geminiImageModel)) {
      throw new Error("Modelo de imagen de Gemini no válido.");
    }
    patch.geminiImageModel = input.geminiImageModel;
  }

  if (input.geminiFallbackModel) {
    if (!(GEMINI_FALLBACK_MODEL_OPTIONS as readonly string[]).includes(input.geminiFallbackModel)) {
      throw new Error("Modelo de respaldo de Gemini no válido.");
    }
    patch.geminiFallbackModel = input.geminiFallbackModel;
  }

  await db.update(platformAiSettings).set(patch).where(eq(platformAiSettings.id, row.id));
  invalidatePlatformAiCache();
  return getPlatformAiPublicSettings();
}
