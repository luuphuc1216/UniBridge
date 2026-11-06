PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT,
    "quotaKey" TEXT NOT NULL DEFAULT 'BUSINESS',
    "targetId" TEXT,
    "feature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "new_AiUsage_businessProfileId_fkey"
      FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiUsage" ("id", "businessProfileId", "feature", "status", "createdAt", "completedAt")
SELECT "id", "businessProfileId", "feature", "status", "createdAt", "completedAt" FROM "AiUsage";
DROP TABLE "AiUsage";
ALTER TABLE "new_AiUsage" RENAME TO "AiUsage";
CREATE INDEX "AiUsage_quotaKey_feature_targetId_status_createdAt_idx"
  ON "AiUsage"("quotaKey", "feature", "targetId", "status", "createdAt");

CREATE TABLE "new_AiUsageBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT,
    "quotaKey" TEXT NOT NULL DEFAULT 'BUSINESS',
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "new_AiUsageBucket_businessProfileId_fkey"
      FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiUsageBucket"
  ("id", "businessProfileId", "quotaKey", "periodType", "periodStart", "used")
SELECT "id", "businessProfileId", "businessProfileId", "periodType", "periodStart", "used"
FROM "AiUsageBucket";
DROP TABLE "AiUsageBucket";
ALTER TABLE "new_AiUsageBucket" RENAME TO "AiUsageBucket";
CREATE UNIQUE INDEX "AiUsageBucket_quotaKey_periodType_periodStart_key"
  ON "AiUsageBucket"("quotaKey", "periodType", "periodStart");
CREATE INDEX "AiUsageBucket_quotaKey_periodType_periodStart_idx"
  ON "AiUsageBucket"("quotaKey", "periodType", "periodStart");

PRAGMA foreign_keys=ON;
