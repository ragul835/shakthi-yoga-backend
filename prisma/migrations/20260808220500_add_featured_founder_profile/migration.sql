ALTER TABLE "instructor_profiles"
ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "users" (
  "id", "name", "email", "password_hash", "role", "experience_level",
  "purpose_of_joining", "digital_media_waiver", "liability_waiver",
  "email_verified", "is_active", "created_at", "updated_at"
)
VALUES (
  'd11f6315-cf65-4591-a5e2-311532169a01',
  'Saranya Prabakaran',
  'raji.saran2010@gmail.com',
  '$2b$12$xCvBLLEQCducwcTAg3h7puA.Ntm8kwQGgbDZooWWjHza2aghOslv.',
  'INSTRUCTOR', 'ALL', ARRAY[]::TEXT[], false, false, true, true, NOW(), NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = 'INSTRUCTOR',
  "is_active" = true,
  "updated_at" = NOW();

INSERT INTO "instructor_profiles" (
  "id", "user_id", "bio", "specialization", "qualifications",
  "years_experience", "photo_url", "is_active", "is_featured", "created_at"
)
SELECT
  'e22f7426-d076-4616-b6f3-422643270b02',
  "id",
  'With nearly a decade of personal practice and more than two years of experience teaching adults, Saranya brings mindful, accessible yoga to the Pleasanton community. She also volunteers as a yoga instructor at local elementary and middle schools, using creative storytelling and engaging activities to introduce children to yoga’s core values. Her holistic teaching philosophy makes the mat a place for physical well-being, mindfulness, and character building.',
  'Founder & Lead Instructor',
  'RYT-500',
  2,
  '/images/instructors/saranya-prabakaran.webp',
  true,
  true,
  NOW()
FROM "users"
WHERE "email" = 'raji.saran2010@gmail.com'
ON CONFLICT ("user_id") DO UPDATE SET
  "is_active" = true,
  "is_featured" = true;
