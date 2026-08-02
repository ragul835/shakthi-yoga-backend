ALTER TABLE "attendances"
ADD COLUMN "user_pass_id" TEXT;

CREATE INDEX "attendances_user_pass_id_idx" ON "attendances"("user_pass_id");

ALTER TABLE "attendances"
ADD CONSTRAINT "attendances_user_pass_id_fkey"
FOREIGN KEY ("user_pass_id") REFERENCES "user_passes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
