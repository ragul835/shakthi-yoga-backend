ALTER TABLE "payments"
  ADD COLUMN "reference_text" TEXT,
  ADD COLUMN "screenshot_data" BYTEA,
  ADD COLUMN "screenshot_mime" TEXT,
  ADD COLUMN "verified_at" TIMESTAMP(3);
