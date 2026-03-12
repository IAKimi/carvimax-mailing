import { pool } from "./db";

interface Migration {
  name: string;
  up: (client: import("pg").PoolClient) => Promise<void>;
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

    const applied = await client.query(`SELECT name FROM _migrations`);
    const appliedSet = new Set(applied.rows.map((r: any) => r.name));

    for (const migration of migrations) {
      if (appliedSet.has(migration.name)) continue;

      console.log(`[migrations] Running: ${migration.name}`);
      await client.query("BEGIN");
      try {
        await migration.up(client);
        await client.query(
          `INSERT INTO _migrations (name) VALUES ($1)`,
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
  } catch (err) {
    console.error("[migrations] Migration runner error:", err);
  } finally {
    client.release();
  }
}
