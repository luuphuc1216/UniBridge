-- CreateTable
CREATE TABLE "ApplicationInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedByBusinessProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "expiresAt" DATETIME NOT NULL,
    "reminderAt" DATETIME,
    "reminderSentAt" DATETIME,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "responseStatus" TEXT,
    "responseReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationInvitation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationInvitation_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationInvitation_invitedByBusinessProfileId_fkey" FOREIGN KEY ("invitedByBusinessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "approach" TEXT NOT NULL,
    "problemUnderstanding" TEXT NOT NULL DEFAULT '',
    "solutionDirection" TEXT NOT NULL DEFAULT '',
    "methodology" TEXT NOT NULL DEFAULT '',
    "keySteps" TEXT NOT NULL DEFAULT '',
    "tools" TEXT NOT NULL DEFAULT '',
    "resources" TEXT NOT NULL DEFAULT '',
    "estimatedDuration" TEXT NOT NULL,
    "proposedBudget" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "profileSnapshot" JSONB,
    "profileSnapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "businessReviewNote" TEXT,
    CONSTRAINT "Application_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("approach", "estimatedDuration", "id", "keySteps", "methodology", "problemId", "problemUnderstanding", "proposedBudget", "resources", "solutionDirection", "status", "submittedAt", "teamId", "tools", "updatedAt") SELECT "approach", "estimatedDuration", "id", "keySteps", "methodology", "problemId", "problemUnderstanding", "proposedBudget", "resources", "solutionDirection", "status", "submittedAt", "teamId", "tools", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_status_idx" ON "Application"("status");
CREATE UNIQUE INDEX "Application_problemId_teamId_key" ON "Application"("problemId", "teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ApplicationInvitation_problemId_status_expiresAt_idx" ON "ApplicationInvitation"("problemId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ApplicationInvitation_applicationId_status_idx" ON "ApplicationInvitation"("applicationId", "status");
