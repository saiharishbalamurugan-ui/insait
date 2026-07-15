-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DiscrepancyType" ADD VALUE 'HOLIDAY_OVERBILLING';
ALTER TYPE "DiscrepancyType" ADD VALUE 'DUE_DATE_MISMATCH';

-- DropIndex
DROP INDEX "Timesheet_quickbooksId_key";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "extractedFieldPositions" JSONB;

-- AlterTable
ALTER TABLE "Timesheet" DROP COLUMN "quickbooksId",
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "weekEnd" TIMESTAMP(3),
ADD COLUMN     "weekStart" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_sourceId_key" ON "Timesheet"("sourceId");

