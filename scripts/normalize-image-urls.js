#!/usr/bin/env node
/**
 * normalize-image-urls.js
 *
 * One-shot migration script that normalizes `imageUrl` values in the
 * `campaign_versions` table from absolute URLs to bare filenames.
 *
 * Problem: Rows created before the refactor may store an absolute URL such as
 *   https://mailing.postialo.com/uploads/campaigns/campaign_47_xxx.jpg
 * instead of the expected bare filename:
 *   campaign_47_xxx.jpg
 *
 * The current `getImagePublicUrl` helper short-circuits when it sees "https://"
 * so these rows still work today — but if the production domain ever changes,
 * or the file is lost, the hardcoded URL gives no recovery information.
 *
 * Usage:
 *   node scripts/normalize-image-urls.js                         # dry-run (safe, read-only)
 *   node scripts/normalize-image-urls.js --apply --confirm PROD  # apply changes to the DB
 *
 * The --confirm PROD flag is required when using --apply to prevent accidental
 * production writes. Requires DATABASE_URL to be set in the environment.
 */

import path from "path";
import pg from "pg";

const { Pool } = pg;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const confirmIndex = args.indexOf("--confirm");
const CONFIRM_VALUE = confirmIndex !== -1 ? args[confirmIndex + 1] : undefined;
const DRY_RUN = !APPLY;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("normalize-image-urls migration");
  console.log("=".repeat(60));
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no changes will be written)" : "APPLY (writing changes to DB)"}`);
  console.log();

  if (APPLY && CONFIRM_VALUE !== "PROD") {
    console.error("ERROR: Apply mode requires explicit confirmation.");
    console.error('Run with: node scripts/normalize-image-urls.js --apply --confirm PROD');
    console.error();
    console.error("Before running --apply against production, ensure you have:");
    console.error("  1. Run a dry-run and reviewed the output.");
    console.error("  2. Obtained owner approval.");
    console.error("  3. Taken a database backup.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: affected } = await pool.query(
      `SELECT id, campaign_id, image_url
       FROM campaign_versions
       WHERE image_url LIKE 'http://%'
          OR image_url LIKE 'https://%'
       ORDER BY id`
    );

    if (affected.length === 0) {
      console.log("No rows found with absolute image URLs. Nothing to do.");
      return;
    }

    console.log(`Found ${affected.length} row(s) with absolute image URLs:\n`);
    console.log(
      `  ${"id".padEnd(6)}  ${"campaign_id".padEnd(12)}  ${"current image_url".padEnd(60)}  normalized basename`
    );
    console.log("  " + "-".repeat(100));

    const valid = [];
    const skipped = [];

    for (const row of affected) {
      try {
        const basename = path.basename(new URL(row.image_url).pathname);
        console.log(
          `  ${String(row.id).padEnd(6)}  ${String(row.campaign_id).padEnd(12)}  ${row.image_url.padEnd(60)}  → ${basename}`
        );
        valid.push({ id: row.id, basename });
      } catch {
        console.warn(
          `  ${String(row.id).padEnd(6)}  ${String(row.campaign_id).padEnd(12)}  ${row.image_url.padEnd(60)}  SKIPPED (malformed URL)`
        );
        skipped.push(row.id);
      }
    }

    console.log();

    if (skipped.length > 0) {
      console.warn(`Warning: ${skipped.length} row(s) with malformed URLs skipped (ids: ${skipped.join(", ")}). Manual review required.`);
      console.log();
    }

    if (DRY_RUN) {
      console.log(`Dry-run complete. ${valid.length} row(s) would be updated, ${skipped.length} skipped.`);
      console.log("Run with --apply --confirm PROD to write changes:");
      console.log("  node scripts/normalize-image-urls.js --apply --confirm PROD");
      return;
    }

    if (valid.length === 0) {
      console.log("No valid rows to update after skipping malformed URLs. Exiting.");
      return;
    }

    console.log(`Applying ${valid.length} update(s)...`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let updated = 0;
      for (const { id, basename } of valid) {
        await client.query(
          "UPDATE campaign_versions SET image_url = $1 WHERE id = $2",
          [basename, id]
        );
        updated++;
      }

      await client.query("COMMIT");
      console.log(`Done. ${updated} row(s) updated successfully.`);
      if (skipped.length > 0) {
        console.warn(`${skipped.length} row(s) were skipped due to malformed URLs and still require manual review.`);
      }
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("ERROR: Transaction rolled back due to:", err.message);
      process.exit(1);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
