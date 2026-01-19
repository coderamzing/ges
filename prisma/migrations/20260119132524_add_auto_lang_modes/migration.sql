-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvitationStatus" ADD VALUE 'interested';
ALTER TYPE "InvitationStatus" ADD VALUE 'optout';
ALTER TYPE "InvitationStatus" ADD VALUE 'moved';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "followup_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invitation_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thankyou_mode" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "TalentPromoterState" ADD CONSTRAINT "TalentPromoterState_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPromoterState" ADD CONSTRAINT "TalentPromoterState_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "talent_pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentBlacklist" ADD CONSTRAINT "TalentBlacklist_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentBlacklist" ADD CONSTRAINT "TalentBlacklist_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "talent_pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
