/*
  Warnings:

  - You are about to drop the column `fieldId` on the `policies` table. All the data in the column will be lost.
  - You are about to drop the `fields` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `weather_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "fields" DROP CONSTRAINT "fields_userId_fkey";

-- DropForeignKey
ALTER TABLE "policies" DROP CONSTRAINT "policies_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "weather_logs" DROP CONSTRAINT "weather_logs_policyId_fkey";

-- AlterTable
ALTER TABLE "policies" DROP COLUMN "fieldId",
ADD COLUMN     "geometry" JSONB;

-- DropTable
DROP TABLE "fields";

-- DropTable
DROP TABLE "weather_logs";
