-- CreateTable
CREATE TABLE "PostCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostCredit_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessProfileId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformCharge_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformCharge_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "consumedCreditId" TEXT,
    "creditRefundedAt" DATETIME,
    CONSTRAINT "Problem_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Problem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Problem_consumedCreditId_fkey" FOREIGN KEY ("consumedCreditId") REFERENCES "PostCredit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Problem" ("approvedAt", "budgetMax", "budgetMin", "businessProfileId", "createdAt", "description", "expectedDuration", "field", "goal", "id", "requirements", "reviewNote", "reviewedById", "slug", "status", "submittedAt", "title", "updatedAt") SELECT "approvedAt", "budgetMax", "budgetMin", "businessProfileId", "createdAt", "description", "expectedDuration", "field", "goal", "id", "requirements", "reviewNote", "reviewedById", "slug", "status", "submittedAt", "title", "updatedAt" FROM "Problem";
DROP TABLE "Problem";
ALTER TABLE "new_Problem" RENAME TO "Problem";
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");
CREATE UNIQUE INDEX "Problem_consumedCreditId_key" ON "Problem"("consumedCreditId");
CREATE INDEX "Problem_status_field_idx" ON "Problem"("status", "field");
CREATE INDEX "Problem_businessProfileId_idx" ON "Problem"("businessProfileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PostCredit_businessProfileId_source_expiresAt_idx" ON "PostCredit"("businessProfileId", "source", "expiresAt");

-- CreateIndex
CREATE INDEX "Subscription_businessProfileId_status_endsAt_idx" ON "Subscription"("businessProfileId", "status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessProfileId_package_key" ON "Subscription"("businessProfileId", "package");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCharge_idempotencyKey_key" ON "PlatformCharge"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PlatformCharge_businessProfileId_createdAt_idx" ON "PlatformCharge"("businessProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformCharge_type_createdAt_idx" ON "PlatformCharge"("type", "createdAt");

-- BUSINESS_POST_CONFIG.freePostCredits = 2. Idempotent grant for legacy business accounts.
INSERT INTO "PostCredit" ("id", "businessProfileId", "source", "remaining", "updatedAt")
SELECT lower(hex(randomblob(16))), "BusinessProfile"."id", 'FREE', 2, CURRENT_TIMESTAMP
FROM "BusinessProfile"
WHERE NOT EXISTS (
    SELECT 1
    FROM "PostCredit"
    WHERE "PostCredit"."businessProfileId" = "BusinessProfile"."id"
      AND "PostCredit"."source" = 'FREE'
);
