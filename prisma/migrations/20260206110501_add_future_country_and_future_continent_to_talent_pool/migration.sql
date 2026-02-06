ALTER TABLE "talent_pool"
ADD COLUMN IF NOT EXISTS "future_continent" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "future_country" VARCHAR(255);
