ALTER TABLE "Problem" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT,
    "attemptId" TEXT,
    "feature" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'AI',
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "checklist" JSONB NOT NULL,
    "reason" TEXT,
    "problemVersion" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "new_AiReview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_AiReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProposalSubmissionAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiReview"
  ("id", "problemId", "attemptId", "feature", "actor", "status", "conclusion", "checklist", "reason", "problemVersion", "createdAt")
SELECT "id", "problemId", "attemptId", "feature", "actor", "status", "conclusion", "checklist", "reason",
  CASE WHEN "problemVersion" GLOB '[0-9]*' THEN CAST("problemVersion" AS INTEGER) ELSE NULL END,
  "createdAt"
FROM "AiReview";
DROP TABLE "AiReview";
ALTER TABLE "new_AiReview" RENAME TO "AiReview";
CREATE INDEX "AiReview_problemId_feature_createdAt_idx" ON "AiReview"("problemId", "feature", "createdAt");
CREATE INDEX "AiReview_attemptId_feature_createdAt_idx" ON "AiReview"("attemptId", "feature", "createdAt");
PRAGMA foreign_keys=ON;
