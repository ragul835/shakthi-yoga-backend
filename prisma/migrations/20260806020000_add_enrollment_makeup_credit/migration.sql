ALTER TABLE "enrollments" ADD COLUMN "makeup_credit_id" TEXT;

CREATE INDEX "enrollments_makeup_credit_id_idx" ON "enrollments"("makeup_credit_id");
