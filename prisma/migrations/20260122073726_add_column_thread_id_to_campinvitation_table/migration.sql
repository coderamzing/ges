/*
  Warnings:

  - Made the column `spintaxEnabled` on table `CampaignTemplate` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CampaignInvitation" ADD COLUMN  IF NOT EXISTS "thread_id" VARCHAR(255);

-- AlterTable
ALTER TABLE "CampaignTemplate" ALTER COLUMN "spintaxEnabled" SET NOT NULL;
