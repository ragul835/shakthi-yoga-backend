-- Pass payments are independent of class enrollments.
ALTER TABLE "payments" ALTER COLUMN "enrollment_id" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "user_pass_id" TEXT;

CREATE TABLE "pass_options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "total_classes" INTEGER,
    "validity_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pass_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_passes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pass_option_id" TEXT NOT NULL,
    "remaining_classes" INTEGER,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_passes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pass_options_name_key" ON "pass_options"("name");
CREATE INDEX "user_passes_user_id_idx" ON "user_passes"("user_id");
CREATE INDEX "payments_user_pass_id_idx" ON "payments"("user_pass_id");

ALTER TABLE "user_passes"
ADD CONSTRAINT "user_passes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_passes"
ADD CONSTRAINT "user_passes_pass_option_id_fkey"
FOREIGN KEY ("pass_option_id") REFERENCES "pass_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_user_pass_id_fkey"
FOREIGN KEY ("user_pass_id") REFERENCES "user_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
