/*
Warnings:

- A unique constraint covering the columns `[thread_id]` on the table `CampaignInvitation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "InvitationStatus" ADD VALUE 'blacklist';