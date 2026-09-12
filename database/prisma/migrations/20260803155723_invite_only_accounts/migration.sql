-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DEACTIVATED');

-- AlterTable: add new columns first (status defaults to ACTIVE for the backfill below)
ALTER TABLE "User"
  ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN     "inviteTokenHash" TEXT,
  ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Backfill: preserve existing isActive=false rows as DEACTIVATED before the column is dropped
UPDATE "User" SET "status" = 'DEACTIVATED' WHERE "isActive" = false;

ALTER TABLE "User" DROP COLUMN "isActive";

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteTokenHash_key" ON "User"("inviteTokenHash");
