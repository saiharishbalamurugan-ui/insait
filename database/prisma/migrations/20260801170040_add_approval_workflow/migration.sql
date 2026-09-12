-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';

-- CreateTable
CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "actorName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalLog_invoiceId_idx" ON "ApprovalLog"("invoiceId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_month_approvalStatus_idx" ON "Invoice"("organizationId", "month", "approvalStatus");

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: sync approvalStatus from any already-taken review decisions so existing
-- approve/reject actions aren't silently reset to PENDING_APPROVAL.
UPDATE "Invoice" i
SET "approvalStatus" = latest."reviewAction"::text::"ApprovalStatus"
FROM (
  SELECT DISTINCT ON ("invoiceId") "invoiceId", "reviewAction"
  FROM "AuditReport"
  WHERE "reviewAction" IN ('APPROVED', 'REJECTED')
  ORDER BY "invoiceId", "createdAt" DESC
) latest
WHERE i.id = latest."invoiceId";
