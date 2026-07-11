-- CreateEnum
CREATE TYPE "ReportReviewAction" AS ENUM ('APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED');

-- AlterTable
ALTER TABLE "AuditReport" ADD COLUMN     "reviewAction" "ReportReviewAction",
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "consultantName" TEXT,
ADD COLUMN     "hourlyRate" DECIMAL(12,2),
ADD COLUMN     "hours" DECIMAL(6,2),
ADD COLUMN     "managerName" TEXT,
ADD COLUMN     "matchedTimesheetId" TEXT,
ADD COLUMN     "project" TEXT;

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "managerName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_matchedTimesheetId_key" ON "Invoice"("matchedTimesheetId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_matchedTimesheetId_fkey" FOREIGN KEY ("matchedTimesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

