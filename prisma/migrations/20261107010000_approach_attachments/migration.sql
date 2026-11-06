ALTER TABLE "Application" ADD COLUMN "attachmentVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ApproachAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "submissionVersion" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApproachAttachment_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "Application" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ApproachAttachment_storageKey_key"
  ON "ApproachAttachment"("storageKey");
CREATE INDEX "ApproachAttachment_applicationId_submissionVersion_idx"
  ON "ApproachAttachment"("applicationId", "submissionVersion");
