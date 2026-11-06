-- CreateTable
CREATE TABLE "WorkspaceReadCursor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceReadCursor_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceReadCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "sourceProjectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "demoUrl" TEXT,
    "fileStorageKey" TEXT,
    "fileName" TEXT,
    "field" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortfolioItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortfolioItem_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "industries" TEXT NOT NULL DEFAULT '',
    "logo" TEXT,
    "website" TEXT,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT,
    "phone" TEXT,
    "representative" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BusinessProfile" ("companyName", "createdAt", "description", "id", "industry", "updatedAt", "userId", "website") SELECT "companyName", "createdAt", "description", "id", "industry", "updatedAt", "userId", "website" FROM "BusinessProfile";
DROP TABLE "BusinessProfile";
ALTER TABLE "new_BusinessProfile" RENAME TO "BusinessProfile";
CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceReadCursor_applicationId_userId_key" ON "WorkspaceReadCursor"("applicationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_sourceProjectId_key" ON "PortfolioItem"("sourceProjectId");

-- CreateIndex
CREATE INDEX "PortfolioItem_teamId_isVisible_idx" ON "PortfolioItem"("teamId", "isVisible");
