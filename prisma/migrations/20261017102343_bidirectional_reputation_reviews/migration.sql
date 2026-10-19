/*
  Warnings:

  - You are about to alter the column `rating` on the `Review` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'BUSINESS_TO_TEAM',
    "reviewedTeamId" TEXT,
    "reviewedBusinessProfileId" TEXT,
    "rating" REAL NOT NULL,
    "criteriaScores" TEXT NOT NULL DEFAULT '{}',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewedTeamId_fkey" FOREIGN KEY ("reviewedTeamId") REFERENCES "StudentTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewedBusinessProfileId_fkey" FOREIGN KEY ("reviewedBusinessProfileId") REFERENCES "BusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Các Review cũ chưa có chiều; gộp các bản ghi cùng Project thành một đánh giá doanh nghiệp → nhóm.
-- Nội dung cũ được giữ lại, điểm cũ được lấy trung bình để thỏa ràng buộc một đánh giá mỗi chiều.
INSERT INTO "new_Review" ("content", "createdAt", "id", "projectId", "rating", "reviewedTeamId", "reviewerId")
SELECT
    group_concat("content", char(10) || char(10)),
    MIN("createdAt"),
    MIN("id"),
    "projectId",
    AVG("rating"),
    MIN("reviewedTeamId"),
    MIN("reviewerId")
FROM "Review"
GROUP BY "projectId";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_reviewedTeamId_createdAt_idx" ON "Review"("reviewedTeamId", "createdAt");
CREATE INDEX "Review_reviewedBusinessProfileId_createdAt_idx" ON "Review"("reviewedBusinessProfileId", "createdAt");
CREATE UNIQUE INDEX "Review_projectId_direction_key" ON "Review"("projectId", "direction");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
