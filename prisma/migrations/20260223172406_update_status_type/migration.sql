-- AlterTable
ALTER TABLE "CampaignInvitation"
ALTER COLUMN "status" TYPE VARCHAR(255)
USING "status"::text;

-- Make it nullable (if needed)
ALTER TABLE "CampaignInvitation" ALTER COLUMN "status" DROP NOT NULL;

-- Drop enum type (only if not used elsewhere)