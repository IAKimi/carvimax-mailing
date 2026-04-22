-- Task #18: convert campaigns.scheduled_at from `timestamp without time zone`
-- to `timestamptz`, preserving existing values as UTC.
--
-- Run this script ONCE on each environment BEFORE deploying the matching
-- shared/schema.ts change (which now declares scheduledAt with
-- { withTimezone: true }) and BEFORE running `npm run db:push`.
--
-- Why USING ... AT TIME ZONE 'UTC':
--   The application has always sent ISO timestamps with `Z` (UTC) and the
--   browser/JS Date layer treats persisted values as UTC. The previous
--   `timestamp without time zone` column silently dropped the offset, so
--   stored values are wall-clock UTC. The USING clause re-anchors them
--   explicitly to UTC during the type change so timestamptz interprets
--   them correctly. Without it, Postgres would assume the server's local
--   timezone and shift every existing scheduled_at row.
--
-- Safe to re-run: the second run is a no-op because the column is
-- already timestamptz.

ALTER TABLE campaigns
  ALTER COLUMN scheduled_at TYPE timestamptz
  USING scheduled_at AT TIME ZONE 'UTC';

-- Sanity check (read-only):
-- SELECT id, scheduled_at FROM campaigns WHERE scheduled_at IS NOT NULL ORDER BY id DESC LIMIT 5;
