-- AlterTable
ALTER TABLE "policies" ADD COLUMN     "heatThresholdK" DOUBLE PRECISION,
ADD COLUMN     "vpdThresholdKpa" DOUBLE PRECISION,
ADD COLUMN     "weeklyRainNeedMm" DOUBLE PRECISION;
