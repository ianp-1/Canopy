/*
  Warnings:

  - You are about to drop the `Policy` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeatherLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OracleAction" AS ENUM ('CHECK_TRIGGERED', 'PAYOUT_SUCCESS', 'PAYOUT_FAILED', 'ESCROW_EXPIRED');

-- DropForeignKey
ALTER TABLE "Policy" DROP CONSTRAINT "Policy_userId_fkey";

-- DropForeignKey
ALTER TABLE "WeatherLog" DROP CONSTRAINT "WeatherLog_policyId_fkey";

-- DropTable
DROP TABLE "Policy";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "WeatherLog";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabaseUid" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "totalLiquidity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insurerId" TEXT,
    "region" TEXT NOT NULL,
    "coverageAmount" DECIMAL(18,6) NOT NULL,
    "premiumAmount" DECIMAL(18,6),
    "premiumDetails" JSONB,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "xrplEscrowId" TEXT,
    "escrowSequence" INTEGER,
    "escrowCondition" TEXT,
    "escrowFulfillment" TEXT,
    "nftTokenId" TEXT,
    "nftMintTxHash" TEXT,
    "weatherThumbnail" JSONB,
    "coordinates" JSONB,
    "thresholdRainfall" DOUBLE PRECISION,
    "thresholdTemp" DOUBLE PRECISION,
    "thresholdSoilMoisture" DOUBLE PRECISION,
    "claimTxHash" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_logs" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isTriggerMet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "weather_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oracle_logs" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "action" "OracleAction" NOT NULL,
    "consensusScore" DOUBLE PRECISION,
    "weatherData" JSONB,
    "txHash" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oracle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseUid_key" ON "users"("supabaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_supabaseUid_idx" ON "users"("supabaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_walletAddress_key" ON "insurers"("walletAddress");

-- CreateIndex
CREATE INDEX "insurers_walletAddress_idx" ON "insurers"("walletAddress");

-- CreateIndex
CREATE INDEX "policies_userId_idx" ON "policies"("userId");

-- CreateIndex
CREATE INDEX "policies_insurerId_idx" ON "policies"("insurerId");

-- CreateIndex
CREATE INDEX "policies_status_idx" ON "policies"("status");

-- CreateIndex
CREATE INDEX "policies_expiresAt_idx" ON "policies"("expiresAt");

-- CreateIndex
CREATE INDEX "weather_logs_policyId_idx" ON "weather_logs"("policyId");

-- CreateIndex
CREATE INDEX "weather_logs_timestamp_idx" ON "weather_logs"("timestamp");

-- CreateIndex
CREATE INDEX "oracle_logs_policyId_idx" ON "oracle_logs"("policyId");

-- CreateIndex
CREATE INDEX "oracle_logs_action_idx" ON "oracle_logs"("action");

-- CreateIndex
CREATE INDEX "oracle_logs_createdAt_idx" ON "oracle_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_logs" ADD CONSTRAINT "weather_logs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oracle_logs" ADD CONSTRAINT "oracle_logs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
