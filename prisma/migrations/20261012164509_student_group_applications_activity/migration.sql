-- CreateTable
CREATE TABLE "SavedProblem" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentTeamId" TEXT,

    PRIMARY KEY ("userId", "problemId"),
    CONSTRAINT "SavedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedProblem_studentTeamId_fkey" FOREIGN KEY ("studentTeamId") REFERENCES "StudentTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ViewLog_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "field" TEXT,
    "skill" TEXT,
    "duration" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    CONSTRAINT "Application_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("approach", "estimatedDuration", "id", "problemId", "proposedBudget", "status", "submittedAt", "teamId", "updatedAt") SELECT "approach", "estimatedDuration", "id", "problemId", "proposedBudget", "status", "submittedAt", "teamId", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_status_idx" ON "Application"("status");
CREATE UNIQUE INDEX "Application_problemId_teamId_key" ON "Application"("problemId", "teamId");
CREATE TABLE "new_StudentTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "experience" TEXT NOT NULL DEFAULT '',
    "relevantProducts" TEXT NOT NULL DEFAULT '',
    "achievements" TEXT NOT NULL DEFAULT '',
    "interests" TEXT NOT NULL DEFAULT '',
    "ratingAverage" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentTeam" ("createdAt", "description", "id", "name", "ratingAverage", "ratingCount", "slug", "university", "updatedAt") SELECT "createdAt", "description", "id", "name", "ratingAverage", "ratingCount", "slug", "university", "updatedAt" FROM "StudentTeam";
DROP TABLE "StudentTeam";
ALTER TABLE "new_StudentTeam" RENAME TO "StudentTeam";
CREATE UNIQUE INDEX "StudentTeam_ownerId_key" ON "StudentTeam"("ownerId");
CREATE UNIQUE INDEX "StudentTeam_slug_key" ON "StudentTeam"("slug");
CREATE TABLE "new_TeamMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "studentProfileId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "major" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamMembership" ("id", "isLead", "joinedAt", "studentProfileId", "teamId", "title") SELECT "id", "isLead", "joinedAt", "studentProfileId", "teamId", "title" FROM "TeamMembership";
DROP TABLE "TeamMembership";
ALTER TABLE "new_TeamMembership" RENAME TO "TeamMembership";
CREATE UNIQUE INDEX "TeamMembership_teamId_studentProfileId_key" ON "TeamMembership"("teamId", "studentProfileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SavedProblem_userId_createdAt_idx" ON "SavedProblem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ViewLog_userId_problemId_createdAt_idx" ON "ViewLog"("userId", "problemId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_userId_createdAt_idx" ON "SearchLog"("userId", "createdAt");
