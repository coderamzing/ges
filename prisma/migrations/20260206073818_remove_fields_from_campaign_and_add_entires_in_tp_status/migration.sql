/*
Warnings:

- You are about to drop the column `followup_mode` on the `Campaign` table. All the data in the column will be lost.
- You are about to drop the column `invitation_mode` on the `Campaign` table. All the data in the column will be lost.
- You are about to drop the column `thankyou_mode` on the `Campaign` table. All the data in the column will be lost.
- A unique constraint covering the columns `[thread_id]` on the table `CampaignInvitation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey

-- AlterTable
ALTER TABLE "Campaign"
DROP COLUMN "followup_mode",
DROP COLUMN "invitation_mode",
DROP COLUMN "thankyou_mode";