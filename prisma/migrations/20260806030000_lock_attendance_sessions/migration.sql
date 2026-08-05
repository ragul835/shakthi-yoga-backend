CREATE TABLE "attendance_sessions" (
  "id" TEXT NOT NULL,
  "class_id" TEXT NOT NULL,
  "session_date" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_sessions_class_id_session_date_key"
ON "attendance_sessions"("class_id", "session_date");

-- Backfill locks for attendance that existed before immutable submissions.
INSERT INTO "attendance_sessions" ("id", "class_id", "session_date")
SELECT md5("class_id" || ':' || "session_date"::text), "class_id", "session_date"
FROM "attendances"
GROUP BY "class_id", "session_date";
