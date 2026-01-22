-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


-- RUN THIS IF KEY IS ALRDY THERE
-- DO $$
-- BEGIN
--   -- TalentPromoterState → users
--   IF EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'TalentPromoterState_promoterId_fkey'
--   ) THEN
--     ALTER TABLE "TalentPromoterState"
--     DROP CONSTRAINT "TalentPromoterState_promoterId_fkey";
--   END IF;

--   -- TalentPromoterState → talent_pool
--   IF EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'TalentPromoterState_talentId_fkey'
--   ) THEN
--     ALTER TABLE "TalentPromoterState"
--     DROP CONSTRAINT "TalentPromoterState_talentId_fkey";
--   END IF;

--   -- TalentBlacklist → users
--   IF EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'TalentBlacklist_promoterId_fkey'
--   ) THEN
--     ALTER TABLE "TalentBlacklist"
--     DROP CONSTRAINT "TalentBlacklist_promoterId_fkey";
--   END IF;

--   -- TalentBlacklist → talent_pool
--   IF EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'TalentBlacklist_talentId_fkey'
--   ) THEN
--     ALTER TABLE "TalentBlacklist"
--     DROP CONSTRAINT "TalentBlacklist_talentId_fkey";
--   END IF;
-- END $$;

ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'interested';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'optout';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'moved';


-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN IF NOT EXISTS "followup_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "invitation_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "thankyou_mode" BOOLEAN NOT NULL DEFAULT false;


CREATE TABLE IF NOT EXISTS "users" (
  "id" BIGINT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS "talent_pool" (
  "id" TEXT PRIMARY KEY
);
-- AddForeignKey
ALTER TABLE "TalentPromoterState" ADD CONSTRAINT "TalentPromoterState_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPromoterState" ADD CONSTRAINT "TalentPromoterState_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "talent_pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentBlacklist" ADD CONSTRAINT "TalentBlacklist_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentBlacklist" ADD CONSTRAINT "TalentBlacklist_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "talent_pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
