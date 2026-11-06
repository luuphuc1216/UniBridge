CREATE TABLE "AiUsageBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AiUsageBucket_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AiUsageBucket_businessProfileId_periodType_periodStart_key"
ON "AiUsageBucket"("businessProfileId", "periodType", "periodStart");

CREATE INDEX "AiUsageBucket_businessProfileId_periodType_periodStart_idx"
ON "AiUsageBucket"("businessProfileId", "periodType", "periodStart");
