-- CreateEnum
CREATE TYPE "ClusterName" AS ENUM ('DEVNET', 'TESTNET', 'MAINNET_BETA', 'LOCAL');

-- CreateTable
CREATE TABLE "WalletProfile" (
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletProfile_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "cluster" "ClusterName" NOT NULL,
    "protocolSlug" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolSnapshot" (
    "id" TEXT NOT NULL,
    "protocolSlug" TEXT NOT NULL,
    "cluster" "ClusterName" NOT NULL,
    "tvlUsd" DOUBLE PRECISION,
    "change1dPct" DOUBLE PRECISION,
    "change7dPct" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'defillama',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletProfile_createdAt_idx" ON "WalletProfile"("createdAt");

-- CreateIndex
CREATE INDEX "WatchlistItem_walletAddress_cluster_idx" ON "WatchlistItem"("walletAddress", "cluster");

-- CreateIndex
CREATE INDEX "WatchlistItem_protocolSlug_cluster_idx" ON "WatchlistItem"("protocolSlug", "cluster");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_walletAddress_cluster_protocolSlug_key" ON "WatchlistItem"("walletAddress", "cluster", "protocolSlug");

-- CreateIndex
CREATE INDEX "ProtocolSnapshot_protocolSlug_cluster_capturedAt_idx" ON "ProtocolSnapshot"("protocolSlug", "cluster", "capturedAt");

-- CreateIndex
CREATE INDEX "ProtocolSnapshot_capturedAt_idx" ON "ProtocolSnapshot"("capturedAt");

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "WalletProfile"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;
