-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('CHANGE_1D', 'CHANGE_7D');

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('BELOW', 'ABOVE');

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "protocolSlug" TEXT NOT NULL,
    "briefMarkdown" TEXT NOT NULL,
    "toolCalls" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "protocolSlug" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "protocolSlug" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchRun_walletAddress_createdAt_idx" ON "ResearchRun"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchRun_protocolSlug_createdAt_idx" ON "ResearchRun"("protocolSlug", "createdAt");

-- CreateIndex
CREATE INDEX "AlertRule_walletAddress_enabled_idx" ON "AlertRule"("walletAddress", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_protocolSlug_idx" ON "AlertRule"("protocolSlug");

-- CreateIndex
CREATE INDEX "AlertEvent_walletAddress_triggeredAt_idx" ON "AlertEvent"("walletAddress", "triggeredAt");

-- CreateIndex
CREATE INDEX "AlertEvent_ruleId_triggeredAt_idx" ON "AlertEvent"("ruleId", "triggeredAt");

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
