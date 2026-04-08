import { pool } from "./db";
import fs from "fs";
import path from "path";

interface Migration {
  name: string;
  up: (client: import("pg").PoolClient) => Promise<void>;
}

function loadSeedData(): Record<string, Array<Record<string, unknown>>> | null {
  const seedPaths = [
    path.resolve(process.cwd(), "server", "seed-data.json"),
    path.resolve(process.cwd(), "dist", "server", "seed-data.json"),
  ];
  const seedPath = seedPaths.find(p => fs.existsSync(p));
  if (!seedPath) return null;
  return JSON.parse(fs.readFileSync(seedPath, "utf-8"));
}

const migrations: Migration[] = [
  {
    name: "001_superadmin_role_and_cleanup",
    up: async (client) => {
      await client.query(
        `UPDATE users SET role = 'superadmin' WHERE email = 'admin@postialo.com' AND role != 'superadmin'`
      );

      const campaignIds = await client.query(
        `SELECT id FROM campaigns WHERE user_id = 9`
      );
      for (const c of campaignIds.rows) {
        await client.query(`DELETE FROM campaign_sends WHERE campaign_id = $1`, [c.id]);
        await client.query(`DELETE FROM campaign_versions WHERE campaign_id = $1`, [c.id]);
      }
      await client.query(`DELETE FROM campaigns WHERE user_id = 9`);
      await client.query(`DELETE FROM contacts WHERE user_id = 9`);
      await client.query(`DELETE FROM contact_databases WHERE user_id = 9`);
      await client.query(`DELETE FROM templates WHERE user_id = 9`);
      await client.query(`DELETE FROM brand_identity WHERE user_id = 9`);
      await client.query(`DELETE FROM users WHERE id = 9`);
    },
  },
  {
    name: "002_sync_all_seed_data",
    up: async (client) => {
      const data = loadSeedData();
      if (!data) {
        console.log("[migrations] No seed-data.json found, skipping data sync.");
        return;
      }

      if (data.users?.length) {
        for (const u of data.users) {
          await client.query(
            `INSERT INTO users (id, name, email, password, company, role, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [u.id, u.name, u.email, u.password, u.company, u.role, u.is_active, u.created_at]
          );
        }
        const maxId = Math.max(...data.users.map((u) => u.id as number));
        await client.query(`SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), $1), true)`, [maxId]);
        console.log(`[migrations] Synced users: ${data.users.length} rows`);
      }

      if (data.brand_identity?.length) {
        for (const b of data.brand_identity) {
          await client.query(
            `INSERT INTO brand_identity (id, user_id, company_name, industry, website, whatsapp, mission, vision, products, history, style_guide, target_audience, tone, primary_color, secondary_color, accent_color, heading_font, body_font, logo_url, visual_style, sender_name, sender_email, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT (id) DO NOTHING`,
            [b.id, b.user_id, b.company_name, b.industry, b.website, b.whatsapp, b.mission, b.vision, b.products, b.history, b.style_guide, b.target_audience, b.tone, b.primary_color, b.secondary_color, b.accent_color, b.heading_font, b.body_font, b.logo_url, b.visual_style, b.sender_name, b.sender_email, b.updated_at]
          );
        }
        const maxId = Math.max(...data.brand_identity.map((b) => b.id as number));
        await client.query(`SELECT setval('brand_identity_id_seq', GREATEST((SELECT MAX(id) FROM brand_identity), $1), true)`, [maxId]);
        console.log(`[migrations] Synced brand_identity: ${data.brand_identity.length} rows`);
      }

      if (data.templates?.length) {
        for (const t of data.templates) {
          await client.query(
            `INSERT INTO templates (id, user_id, name, html, favorite, is_ai_generated, ai_edit_count, original_html, has_all_placeholders, is_confirmed, parent_template_id, version_number, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
            [t.id, t.user_id, t.name, t.html, t.favorite, t.is_ai_generated, t.ai_edit_count, t.original_html, t.has_all_placeholders, t.is_confirmed, t.parent_template_id, t.version_number, t.created_at]
          );
        }
        const maxId = Math.max(...data.templates.map((t) => t.id as number));
        await client.query(`SELECT setval('templates_id_seq', GREATEST((SELECT MAX(id) FROM templates), $1), true)`, [maxId]);
        console.log(`[migrations] Synced templates: ${data.templates.length} rows`);
      }

      if (data.contact_databases?.length) {
        for (const cd of data.contact_databases) {
          await client.query(
            `INSERT INTO contact_databases (id, user_id, name, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
            [cd.id, cd.user_id, cd.name, cd.created_at]
          );
        }
        const maxId = Math.max(...data.contact_databases.map((cd) => cd.id as number));
        await client.query(`SELECT setval('contact_databases_id_seq', GREATEST((SELECT MAX(id) FROM contact_databases), $1), true)`, [maxId]);
        console.log(`[migrations] Synced contact_databases: ${data.contact_databases.length} rows`);
      }

      if (data.contacts?.length) {
        for (const c of data.contacts) {
          await client.query(
            `INSERT INTO contacts (id, user_id, database_id, email, name, position, segment, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [c.id, c.user_id, c.database_id, c.email, c.name, c.position, c.segment, c.created_at]
          );
        }
        const maxId = Math.max(...data.contacts.map((c) => c.id as number));
        await client.query(`SELECT setval('contacts_id_seq', GREATEST((SELECT MAX(id) FROM contacts), $1), true)`, [maxId]);
        console.log(`[migrations] Synced contacts: ${data.contacts.length} rows`);
      }

      if (data.campaigns?.length) {
        for (const c of data.campaigns) {
          await client.query(
            `INSERT INTO campaigns (id, user_id, name, idea, objective, tone, status, layout_preference, image_prompt, target_database, selected_image_url, target_audience, template_id, scheduled_at, total_expected_sends, sent_count, failed_count, image_regen_count, text_regen_count, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT (id) DO NOTHING`,
            [c.id, c.user_id, c.name, c.idea, c.objective, c.tone, c.status, c.layout_preference, c.image_prompt, c.target_database, c.selected_image_url, c.target_audience, c.template_id, c.scheduled_at, c.total_expected_sends, c.sent_count, c.failed_count, c.image_regen_count, c.text_regen_count, c.created_at]
          );
        }
        const maxId = Math.max(...data.campaigns.map((c) => c.id as number));
        await client.query(`SELECT setval('campaigns_id_seq', GREATEST((SELECT MAX(id) FROM campaigns), $1), true)`, [maxId]);
        console.log(`[migrations] Synced campaigns: ${data.campaigns.length} rows`);
      }

      if (data.campaign_versions?.length) {
        for (const cv of data.campaign_versions) {
          await client.query(
            `INSERT INTO campaign_versions (id, campaign_id, version_number, content_json, image_url, is_selected, type, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [cv.id, cv.campaign_id, cv.version_number, JSON.stringify(cv.content_json), cv.image_url, cv.is_selected, cv.type, cv.created_at]
          );
        }
        const maxId = Math.max(...data.campaign_versions.map((cv) => cv.id as number));
        await client.query(`SELECT setval('campaign_versions_id_seq', GREATEST((SELECT MAX(id) FROM campaign_versions), $1), true)`, [maxId]);
        console.log(`[migrations] Synced campaign_versions: ${data.campaign_versions.length} rows`);
      }

      if (data.campaign_sends?.length) {
        for (const cs of data.campaign_sends) {
          await client.query(
            `INSERT INTO campaign_sends (id, campaign_id, contact_email, contact_name, status, message_id, error_message, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
            [cs.id, cs.campaign_id, cs.contact_email, cs.contact_name, cs.status, cs.message_id, cs.error_message, cs.created_at, cs.updated_at]
          );
        }
        const maxId = Math.max(...data.campaign_sends.map((cs) => cs.id as number));
        await client.query(`SELECT setval('campaign_sends_id_seq', GREATEST((SELECT MAX(id) FROM campaign_sends), $1), true)`, [maxId]);
        console.log(`[migrations] Synced campaign_sends: ${data.campaign_sends.length} rows`);
      }

      console.log("[migrations] All seed data synced to database.");
    },
  },
  {
    name: "003_add_scheduler_retry_columns",
    up: async (client) => {
      await client.query(`
        ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS scheduler_retry_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS scheduler_last_error TEXT
      `);
    },
  },
  {
    name: "004_add_approval_columns",
    up: async (client) => {
      await client.query(`
        ALTER TABLE campaigns
        ADD COLUMN IF NOT EXISTS text_approved BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS image_approved BOOLEAN DEFAULT false
      `);
    },
  },
  {
    name: "005_cancel_stale_scheduled_campaigns",
    up: async (client) => {
      const result = await client.query(`
        UPDATE campaigns SET status = 'cancelled'
        WHERE status IN ('scheduled', 'sending')
      `);
      console.log(`[migration 005] Cancelled ${result.rowCount} stale scheduled/sending campaigns`);
    },
  },
  {
    name: "006_add_sent_html_to_campaign_versions",
    up: async (client) => {
      await client.query(`ALTER TABLE campaign_versions ADD COLUMN IF NOT EXISTS sent_html TEXT`);
      console.log("[migration 006] Added sent_html column to campaign_versions");
    },
  },
  {
    name: "007_add_locked_fields_to_templates",
    up: async (client) => {
      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS locked_fields jsonb`);
      console.log("[migration 007] Added locked_fields column to templates");
    },
  },
  {
    name: "008_add_email_verification_columns",
    up: async (client) => {
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS verification_token TEXT,
        ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP
      `);
      await client.query(`UPDATE users SET is_verified = true WHERE is_verified = false`);
      console.log("[migration 008] Added email verification columns and marked existing users as verified");
    },
  },
  {
    name: "009_create_email_providers_table",
    up: async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_providers (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          provider TEXT NOT NULL,
          encrypted_api_key TEXT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sender_email TEXT,
          sender_name TEXT,
          webhook_id TEXT,
          account_email TEXT,
          account_plan TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_email_providers_user_provider
        ON email_providers (user_id, provider)
      `);
      await client.query(`
        ALTER TABLE email_providers
        DROP CONSTRAINT IF EXISTS chk_email_providers_provider
      `);
      await client.query(`
        ALTER TABLE email_providers
        ADD CONSTRAINT chk_email_providers_provider
        CHECK (provider IN ('brevo', 'mailchimp'))
      `);
      console.log("[migration 009] Created email_providers table with unique index and provider check constraint");
    },
  },
];

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const applied = await client.query<{ name: string }>(`SELECT name FROM _migrations`);
    const appliedSet = new Set(applied.rows.map((r) => r.name));

    for (const migration of migrations) {
      if (appliedSet.has(migration.name)) continue;

      console.log(`[migrations] Running: ${migration.name}`);
      await client.query("BEGIN");
      try {
        await migration.up(client);
        await client.query(
          `INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [migration.name]
        );
        await client.query("COMMIT");
        console.log(`[migrations] Applied: ${migration.name}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrations] Failed: ${migration.name}`, err);
        throw err;
      }
    }

    console.log("[migrations] All migrations up to date.");
  } finally {
    client.release();
  }
}
