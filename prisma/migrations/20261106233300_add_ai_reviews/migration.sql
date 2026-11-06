CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT,
    "attemptId" TEXT,
    "feature" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'AI',
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "checklist" JSONB NOT NULL,
    "reason" TEXT,
    "problemVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiReview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProposalSubmissionAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AiReview_problemId_feature_createdAt_idx"
ON "AiReview"("problemId", "feature", "createdAt");

CREATE INDEX "AiReview_attemptId_feature_createdAt_idx"
ON "AiReview"("attemptId", "feature", "createdAt");
