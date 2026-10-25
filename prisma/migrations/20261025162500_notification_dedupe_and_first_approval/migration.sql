ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- Backfill only legacy APPROVED problems; approvedAt is part of the existing Problem schema.
UPDATE "Problem"
SET "firstApprovedAt" = COALESCE("approvedAt", "updatedAt")
WHERE "status" = 'APPROVED'
  AND "firstApprovedAt" IS NULL;
