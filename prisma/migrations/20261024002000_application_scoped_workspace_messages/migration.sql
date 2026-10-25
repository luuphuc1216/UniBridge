PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkspaceMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "applicationId" TEXT,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMessage_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMessage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkspaceMessage" ("id", "problemId", "senderId", "content", "createdAt")
SELECT "id", "problemId", "senderId", "content", "createdAt"
FROM "WorkspaceMessage";
DROP TABLE "WorkspaceMessage";
ALTER TABLE "new_WorkspaceMessage" RENAME TO "WorkspaceMessage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

UPDATE "WorkspaceMessage"
SET "applicationId" = (
  SELECT "Application"."id"
  FROM "Application"
  WHERE "Application"."problemId" = "WorkspaceMessage"."problemId"
    AND "Application"."status" = 'SELECTED'
  ORDER BY "Application"."updatedAt" DESC
  LIMIT 1
)
WHERE "applicationId" IS NULL;

CREATE INDEX "WorkspaceMessage_problemId_createdAt_idx"
ON "WorkspaceMessage"("problemId", "createdAt");
CREATE INDEX "WorkspaceMessage_applicationId_createdAt_idx"
ON "WorkspaceMessage"("applicationId", "createdAt");
