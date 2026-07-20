-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "month" TEXT;

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "month" TEXT;

-- CreateTable
CREATE TABLE "Month" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Month_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Month_organizationId_idx" ON "Month"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Month_organizationId_label_key" ON "Month"("organizationId", "label");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_month_idx" ON "Invoice"("organizationId", "month");

-- CreateIndex
CREATE INDEX "Timesheet_organizationId_month_idx" ON "Timesheet"("organizationId", "month");

-- AddForeignKey
ALTER TABLE "Month" ADD CONSTRAINT "Month_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create a Month row per organization for every distinct month already
-- present in existing data (from createdAt, i.e. "when it was uploaded"), and mark
-- the most recent one per org as current.
INSERT INTO "Month" ("id", "organizationId", "label", "isCurrent")
SELECT gen_random_uuid()::text, sub."organizationId", sub.label, false
FROM (
  SELECT DISTINCT "organizationId", to_char("createdAt", 'YYYY-MM') AS label FROM "Invoice"
  UNION
  SELECT DISTINCT "organizationId", to_char("createdAt", 'YYYY-MM') AS label FROM "Timesheet"
) sub
ON CONFLICT ("organizationId", "label") DO NOTHING;

-- Ensure every organization has at least the current calendar month
INSERT INTO "Month" ("id", "organizationId", "label", "isCurrent")
SELECT gen_random_uuid()::text, "id", to_char(now(), 'YYYY-MM'), false
FROM "Organization"
ON CONFLICT ("organizationId", "label") DO NOTHING;

UPDATE "Month" SET "isCurrent" = false;
UPDATE "Month" m SET "isCurrent" = true
WHERE m."label" = (
  SELECT MAX(m2."label") FROM "Month" m2 WHERE m2."organizationId" = m."organizationId"
);

-- Backfill Invoice/Timesheet month columns from createdAt, then enforce NOT NULL
UPDATE "Invoice" SET "month" = to_char("createdAt", 'YYYY-MM') WHERE "month" IS NULL;
UPDATE "Timesheet" SET "month" = to_char("createdAt", 'YYYY-MM') WHERE "month" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "month" SET NOT NULL;
ALTER TABLE "Timesheet" ALTER COLUMN "month" SET NOT NULL;
