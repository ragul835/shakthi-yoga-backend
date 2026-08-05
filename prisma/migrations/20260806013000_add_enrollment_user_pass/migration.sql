ALTER TABLE "enrollments" ADD COLUMN "user_pass_id" TEXT;

CREATE INDEX "enrollments_user_pass_id_idx" ON "enrollments"("user_pass_id");

ALTER TABLE "enrollments"
ADD CONSTRAINT "enrollments_user_pass_id_fkey"
FOREIGN KEY ("user_pass_id") REFERENCES "user_passes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
