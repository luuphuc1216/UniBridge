/*
  Warnings:

  - You are about to drop the column `platformFeeRate` on the `Project` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "MilestoneSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "milestoneId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MilestoneSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MilestoneSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MilestoneSubmissionFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MilestoneSubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "MilestoneSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL DEFAULT '',
    "paymentPercent" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER,
    "dueAt" DATETIME,
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" DATETIME,
    "acceptedAt" DATETIME,
    "progressNote" TEXT,
    "revisionFeedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Milestone" ("acceptedAt", "amount", "createdAt", "description", "dueAt", "id", "projectId", "sortOrder", "status", "submittedAt", "title", "updatedAt") SELECT "acceptedAt", "amount", "createdAt", "description", "dueAt", "id", "projectId", "sortOrder", "status", "submittedAt", "title", "updatedAt" FROM "Milestone";
DROP TABLE "Milestone";
ALTER TABLE "new_Milestone" RENAME TO "Milestone";
CREATE UNIQUE INDEX "Milestone_projectId_sortOrder_key" ON "Milestone"("projectId", "sortOrder");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agreedScope" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '',
    "totalAmount" INTEGER NOT NULL,
    "generalAcceptanceCriteria" TEXT NOT NULL DEFAULT '',
    "businessResponsibilities" TEXT NOT NULL DEFAULT '',
    "teamResponsibilities" TEXT NOT NULL DEFAULT '',
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "revisionNote" TEXT,
    "agreementRevision" INTEGER NOT NULL DEFAULT 1,
    "businessAcceptedAt" DATETIME,
    "teamAcceptedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'AGREEING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("agreedScope", "applicationId", "completedAt", "createdAt", "id", "startedAt", "status", "teamId", "title", "totalAmount", "updatedAt") SELECT "agreedScope", "applicationId", "completedAt", "createdAt", "id", "startedAt", "status", "teamId", "title", "totalAmount", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_applicationId_key" ON "Project"("applicationId");
CREATE TABLE "new_ProjectTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "idempotencyKey" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DEPOSIT',
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "platformFeeBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectTransaction_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProjectTransaction" ("amount", "createdAt", "id", "paidAt", "platformFee", "projectId", "status", "updatedAt") SELECT "amount", "createdAt", "id", "paidAt", "platformFee", "projectId", "status", "updatedAt" FROM "ProjectTransaction";
DROP TABLE "ProjectTransaction";
ALTER TABLE "new_ProjectTransaction" RENAME TO "ProjectTransaction";
CREATE UNIQUE INDEX "ProjectTransaction_idempotencyKey_key" ON "ProjectTransaction"("idempotencyKey");
CREATE INDEX "ProjectTransaction_projectId_type_status_idx" ON "ProjectTransaction"("projectId", "type", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MilestoneSubmission_milestoneId_createdAt_idx" ON "MilestoneSubmission"("milestoneId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneSubmissionFile_storageKey_key" ON "MilestoneSubmissionFile"("storageKey");

-- CreateIndex
CREATE INDEX "MilestoneSubmissionFile_submissionId_idx" ON "MilestoneSubmissionFile"("submissionId");
