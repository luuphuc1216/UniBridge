/*
  Warnings:

  - You are about to drop the column `studentTeamId` on the `SavedProblem` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SavedProblem" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "problemId"),
    CONSTRAINT "SavedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SavedProblem" ("createdAt", "problemId", "userId") SELECT "createdAt", "problemId", "userId" FROM "SavedProblem";
DROP TABLE "SavedProblem";
ALTER TABLE "new_SavedProblem" RENAME TO "SavedProblem";
CREATE INDEX "SavedProblem_userId_createdAt_idx" ON "SavedProblem"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
