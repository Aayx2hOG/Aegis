-- CreateTable
CREATE TABLE "TestArtifact" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "protocolSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestArtifact_createdAt_idx" ON "TestArtifact"("createdAt");

-- CreateIndex
CREATE INDEX "TestArtifact_walletAddress_idx" ON "TestArtifact"("walletAddress");
