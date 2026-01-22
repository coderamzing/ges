-- CreateTable
CREATE TABLE IF NOT EXISTS "aiprompt" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "defs" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aiprompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "aiprompt_key_key" ON "aiprompt"("key");
