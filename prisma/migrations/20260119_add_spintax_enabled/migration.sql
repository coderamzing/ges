ALTER TABLE "CampaignTemplate"
ADD COLUMN IF NOT EXISTS "spintaxEnabled" BOOLEAN DEFAULT true;