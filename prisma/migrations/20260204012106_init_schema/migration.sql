-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ACTIVE', 'CLAIMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "coverageAmount" DOUBLE PRECISION NOT NULL,
    "premiumDetails" JSONB,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "xrplEscrowId" TEXT,
    "weatherThumbnail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherLog" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isTriggerMet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WeatherLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherLog" ADD CONSTRAINT "WeatherLog_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
