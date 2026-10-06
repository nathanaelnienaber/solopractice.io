-- Superbill request status on invoices (ops only; no clinical columns).
-- Apply with: cd apps/web && pnpm db:push
-- Or run this SQL against Neon.

DO $$ BEGIN
  CREATE TYPE "public"."superbill_request_status" AS ENUM('none', 'requested', 'sent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "superbill_request_status" "public"."superbill_request_status" DEFAULT 'none' NOT NULL;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "superbill_requested_at" timestamp;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "superbill_sent_at" timestamp;
