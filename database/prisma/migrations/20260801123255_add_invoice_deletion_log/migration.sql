-- CreateTable
CREATE TABLE "InvoiceDeletionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "actorName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDeletionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDeletionLog_organizationId_idx" ON "InvoiceDeletionLog"("organizationId");

-- AddForeignKey
ALTER TABLE "InvoiceDeletionLog" ADD CONSTRAINT "InvoiceDeletionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

