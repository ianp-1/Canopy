-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'INSURER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';
