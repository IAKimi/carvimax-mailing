import { pool } from "./db";
import fs from "fs";
import path from "path";

export async function seedProductionDatabase(): Promise<void> {
  try {
    const userCount = await pool.query("SELECT COUNT(*) as c FROM users");
    if (parseInt(userCount.rows[0].c) > 0) {
      console.log("[seed] Database already has data, skipping seed.");
      return;
    }

    const seedPaths = [
      path.resolve(process.cwd(), "server", "seed-data.json"),
      path.resolve(process.cwd(), "dist", "server", "seed-data.json"),
      path.resolve(__dirname, "seed-data.json"),
    ];
    const seedPath = seedPaths.find(p => fs.existsSync(p));
    if (!seedPath) {
      console.log("[seed] No seed-data.json found, skipping seed.");
      return;
    }

    console.log("[seed] Empty database detected. Seeding production data...");
    const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (data.users?.length) {
        for (const u of data.users) {
          await client.query(
            `INSERT INTO users (id, name, email, password, company, role, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [u.id, u.name, u.email, u.password, u.company, u.role, u.is_active, u.created_at]
          );
        }
        const maxId = Math.max(...data.users.map((u: any) => u.id));
        await client.query(`SELECT setval('users_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Users: ${data.users.length} rows`);
      }

      if (data.brand_identity?.length) {
        for (const b of data.brand_identity) {
          await client.query(
            `INSERT INTO brand_identity (id, user_id, company_name, industry, website, whatsapp, mission, vision, products, history, style_guide, target_audience, tone, primary_color, secondary_color, accent_color, heading_font, body_font, logo_url, visual_style, sender_name, sender_email, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT (id) DO NOTHING`,
            [b.id, b.user_id, b.company_name, b.industry, b.website, b.whatsapp, b.mission, b.vision, b.products, b.history, b.style_guide, b.target_audience, b.tone, b.primary_color, b.secondary_color, b.accent_color, b.heading_font, b.body_font, b.logo_url, b.visual_style, b.sender_name, b.sender_email, b.updated_at]
          );
        }
        const maxId = Math.max(...data.brand_identity.map((b: any) => b.id));
        await client.query(`SELECT setval('brand_identity_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Brand identity: ${data.brand_identity.length} rows`);
      }

      if (data.templates?.length) {
        for (const t of data.templates) {
          await client.query(
            `INSERT INTO templates (id, user_id, name, html, favorite, is_ai_generated, ai_edit_count, original_html, has_all_placeholders, is_confirmed, parent_template_id, version_number, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
            [t.id, t.user_id, t.name, t.html, t.favorite, t.is_ai_generated, t.ai_edit_count, t.original_html, t.has_all_placeholders, t.is_confirmed, t.parent_template_id, t.version_number, t.created_at]
          );
        }
        const maxId = Math.max(...data.templates.map((t: any) => t.id));
        await client.query(`SELECT setval('templates_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Templates: ${data.templates.length} rows`);
      }

      if (data.contact_databases?.length) {
        for (const cd of data.contact_databases) {
          await client.query(
            `INSERT INTO contact_databases (id, user_id, name, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
            [cd.id, cd.user_id, cd.name, cd.created_at]
          );
        }
        const maxId = Math.max(...data.contact_databases.map((cd: any) => cd.id));
        await client.query(`SELECT setval('contact_databases_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Contact databases: ${data.contact_databases.length} rows`);
      }

      if (data.contacts?.length) {
        for (const c of data.contacts) {
          await client.query(
            `INSERT INTO contacts (id, user_id, database_id, email, name, position, segment, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [c.id, c.user_id, c.database_id, c.email, c.name, c.position, c.segment, c.created_at]
          );
        }
        const maxId = Math.max(...data.contacts.map((c: any) => c.id));
        await client.query(`SELECT setval('contacts_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Contacts: ${data.contacts.length} rows`);
      }

      if (data.campaigns?.length) {
        for (const c of data.campaigns) {
          await client.query(
            `INSERT INTO campaigns (id, user_id, name, idea, objective, tone, status, layout_preference, image_prompt, target_database, selected_image_url, target_audience, template_id, scheduled_at, total_expected_sends, sent_count, failed_count, image_regen_count, text_regen_count, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT (id) DO NOTHING`,
            [c.id, c.user_id, c.name, c.idea, c.objective, c.tone, c.status, c.layout_preference, c.image_prompt, c.target_database, c.selected_image_url, c.target_audience, c.template_id, c.scheduled_at, c.total_expected_sends, c.sent_count, c.failed_count, c.image_regen_count, c.text_regen_count, c.created_at]
          );
        }
        const maxId = Math.max(...data.campaigns.map((c: any) => c.id));
        await client.query(`SELECT setval('campaigns_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Campaigns: ${data.campaigns.length} rows`);
      }

      if (data.campaign_versions?.length) {
        for (const cv of data.campaign_versions) {
          await client.query(
            `INSERT INTO campaign_versions (id, campaign_id, version_number, content_json, image_url, is_selected, type, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [cv.id, cv.campaign_id, cv.version_number, JSON.stringify(cv.content_json), cv.image_url, cv.is_selected, cv.type, cv.created_at]
          );
        }
        const maxId = Math.max(...data.campaign_versions.map((cv: any) => cv.id));
        await client.query(`SELECT setval('campaign_versions_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Campaign versions: ${data.campaign_versions.length} rows`);
      }

      if (data.campaign_sends?.length) {
        for (const cs of data.campaign_sends) {
          await client.query(
            `INSERT INTO campaign_sends (id, campaign_id, contact_email, contact_name, status, message_id, error_message, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
            [cs.id, cs.campaign_id, cs.contact_email, cs.contact_name, cs.status, cs.message_id, cs.error_message, cs.created_at, cs.updated_at]
          );
        }
        const maxId = Math.max(...data.campaign_sends.map((cs: any) => cs.id));
        await client.query(`SELECT setval('campaign_sends_id_seq', $1, true)`, [maxId]);
        console.log(`[seed] Campaign sends: ${data.campaign_sends.length} rows`);
      }

      await client.query("COMMIT");
      console.log("[seed] Production database seeded successfully!");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[seed] Error seeding database:", err);
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[seed] Failed to seed database:", err);
  }
}
