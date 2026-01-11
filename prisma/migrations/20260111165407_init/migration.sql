-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'stopped');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('invitation', 'followup', 'postevent');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'confirmed', 'declined', 'maybe', 'ignored', 'attended');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('sent', 'received');

-- CreateTable
CREATE TABLE "Promoter" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "promoterId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "reach_time" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "lang" TEXT NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "postEventTriggerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTemplate" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSpintaxTemplate" (
    "id" SERIAL NOT NULL,
    "CampaignTemplateId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "lang" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSpintaxTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "talentType" TEXT NOT NULL,
    "currentCity" TEXT,
    "currentCountry" TEXT,
    "city" TEXT,
    "country" TEXT,
    "langPreferred" TEXT,
    "profilePic" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentPromoterState" (
    "id" SERIAL NOT NULL,
    "talentId" INTEGER NOT NULL,
    "promoterId" INTEGER NOT NULL,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "lastContacted" TIMESTAMP(3),
    "lastReply" TIMESTAMP(3),
    "optedOut" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TalentPromoterState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScoreLog" (
    "id" SERIAL NOT NULL,
    "talentId" INTEGER NOT NULL,
    "promoterId" INTEGER NOT NULL,
    "eventId" INTEGER,
    "change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignInvitation" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "promoterId" INTEGER NOT NULL,
    "talentId" INTEGER NOT NULL,
    "batch" INTEGER NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "invitationAt" TIMESTAMP(3),
    "isSeen" BOOLEAN NOT NULL DEFAULT false,
    "followupSent" BOOLEAN NOT NULL DEFAULT false,
    "thankYouSent" BOOLEAN NOT NULL DEFAULT false,
    "hasReplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampaignInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "promoterId" INTEGER NOT NULL,
    "invitationId" INTEGER NOT NULL,
    "talentId" INTEGER NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "isSeen" BOOLEAN NOT NULL DEFAULT false,
    "isInterpret" BOOLEAN NOT NULL DEFAULT false,
    "isScoreAnalyzed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CampaignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentBlacklist" (
    "id" SERIAL NOT NULL,
    "talentId" INTEGER NOT NULL,
    "promoterId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_email_key" ON "Promoter"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Talent_accountId_key" ON "Talent"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentPromoterState_talentId_promoterId_key" ON "TalentPromoterState"("talentId", "promoterId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInvitation_campaignId_talentId_key" ON "CampaignInvitation"("campaignId", "talentId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentBlacklist_talentId_promoterId_key" ON "TalentBlacklist"("talentId", "promoterId");

-- AddForeignKey
ALTER TABLE "CampaignTemplate" ADD CONSTRAINT "CampaignTemplate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSpintaxTemplate" ADD CONSTRAINT "CampaignSpintaxTemplate_CampaignTemplateId_fkey" FOREIGN KEY ("CampaignTemplateId") REFERENCES "CampaignTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSpintaxTemplate" ADD CONSTRAINT "CampaignSpintaxTemplate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInvitation" ADD CONSTRAINT "CampaignInvitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "CampaignInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
