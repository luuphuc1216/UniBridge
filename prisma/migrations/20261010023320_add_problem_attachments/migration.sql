-- CreateTable
CREATE TABLE "ProblemAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProblemAttachment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Problem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "expectedDuration" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Problem_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Problem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Problem" ("approvedAt", "budgetMax", "budgetMin", "businessProfileId", "createdAt", "description", "expectedDuration", "field", "goal", "id", "requirements", "reviewNote", "reviewedById", "slug", "status", "submittedAt", "title", "updatedAt") SELECT "approvedAt", "budgetMax", "budgetMin", "businessProfileId", "createdAt", "description", "expectedDuration", "field", "goal", "id", "requirements", "reviewNote", "reviewedById", "slug", "status", "submittedAt", "title", "updatedAt" FROM "Problem";
DROP TABLE "Problem";
ALTER TABLE "new_Problem" RENAME TO "Problem";
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");
CREATE INDEX "Problem_status_field_idx" ON "Problem"("status", "field");
CREATE INDEX "Problem_businessProfileId_idx" ON "Problem"("businessProfileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProblemAttachment_storageKey_key" ON "ProblemAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ProblemAttachment_problemId_idx" ON "ProblemAttachment"("problemId");
