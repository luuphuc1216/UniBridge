ALTER TABLE "Project" ADD COLUMN "legacyTermsExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "finalAcceptanceStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "Project" ADD COLUMN "finalAcceptedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "finalAcceptedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "pausedTotalSeconds" INTEGER NOT NULL DEFAULT 0;

UPDATE "Project" SET "legacyTermsExempt" = true;
UPDATE "Project" SET "finalAcceptanceStatus" = 'COMPLETED' WHERE "status" = 'COMPLETED';

ALTER TABLE "Milestone" ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Milestone" ADD COLUMN "workCompleted" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Milestone" ADD COLUMN "difficulties" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Milestone" ADD COLUMN "acceptanceStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Milestone" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNFUNDED';
ALTER TABLE "Milestone" ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Milestone" ADD COLUMN "responseDueAt" DATETIME;
ALTER TABLE "Milestone" ADD COLUMN "overdueSince" DATETIME;
ALTER TABLE "Milestone" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "Milestone" ADD COLUMN "pausedTotalSeconds" INTEGER NOT NULL DEFAULT 0;

UPDATE "Milestone" SET
  "workCompleted" = COALESCE("progressNote", ''),
  "progressPercent" = CASE WHEN "status" = 'ACCEPTED' THEN 100 ELSE 0 END,
  "acceptanceStatus" = CASE "status"
    WHEN 'SUBMITTED' THEN 'AWAITING_REVIEW'
    WHEN 'REVISION_REQUESTED' THEN 'REVISION_REQUESTED'
    WHEN 'ACCEPTED' THEN 'ACCEPTED'
    ELSE 'NOT_SUBMITTED' END,
  "paymentStatus" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "ProjectTransaction" t
      WHERE t."milestoneId" = "Milestone"."id"
        AND t."type" = 'MILESTONE_RELEASE'
        AND t."status" = 'RELEASED'
    ) THEN 'RELEASED'
    WHEN EXISTS (
      SELECT 1 FROM "ProjectTransaction" t
      WHERE t."projectId" = "Milestone"."projectId"
        AND t."type" = 'DEPOSIT'
        AND t."status" = 'ESCROW'
    ) THEN 'ESCROW'
    ELSE 'UNFUNDED' END,
  "revisionCount" = MAX(
    (SELECT COUNT(*) FROM "MilestoneSubmission" s
      WHERE s."milestoneId" = "Milestone"."id") - 1,
    0
  );

CREATE TABLE "ProjectAgreementVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "agreedScope" TEXT NOT NULL,
  "deliverables" TEXT NOT NULL,
  "duration" TEXT NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "generalAcceptanceCriteria" TEXT NOT NULL,
  "businessResponsibilities" TEXT NOT NULL,
  "teamResponsibilities" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "maxMilestoneRevisions" INTEGER NOT NULL,
  "ownershipTerms" TEXT NOT NULL,
  "usageTerms" TEXT NOT NULL,
  "confidentialityTerms" TEXT NOT NULL,
  "extensionTerms" TEXT NOT NULL,
  "suspensionTerms" TEXT NOT NULL,
  "terminationTerms" TEXT NOT NULL,
  "disputeTerms" TEXT NOT NULL,
  "milestonesSnapshot" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "businessAcceptedAt" DATETIME,
  "teamAcceptedAt" DATETIME,
  "businessAcceptedByUserId" TEXT,
  "teamAcceptedByUserId" TEXT,
  "legacySnapshot" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAgreementVersion_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectAgreementVersion_creator_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectAgreementVersion_businessAccepter_fkey"
    FOREIGN KEY ("businessAcceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectAgreementVersion_teamAccepter_fkey"
    FOREIGN KEY ("teamAcceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectAgreementVersion_projectId_versionNumber_key"
  ON "ProjectAgreementVersion"("projectId", "versionNumber");
CREATE INDEX "ProjectAgreementVersion_projectId_createdAt_idx"
  ON "ProjectAgreementVersion"("projectId", "createdAt");

CREATE TABLE "MilestoneProgressUpdate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "milestoneId" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL,
  "workCompleted" TEXT NOT NULL,
  "difficulties" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MilestoneProgressUpdate_milestone_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MilestoneProgressUpdate_user_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MilestoneProgressUpdate_milestoneId_createdAt_idx"
  ON "MilestoneProgressUpdate"("milestoneId", "createdAt");

CREATE TABLE "ProjectChangeRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL DEFAULT '{}',
  "proposedDueAt" DATETIME,
  "requestedByUserId" TEXT NOT NULL,
  "businessAcceptedAt" DATETIME,
  "teamAcceptedAt" DATETIME,
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "resolvedAt" DATETIME,
  CONSTRAINT "ProjectChangeRequest_project_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectChangeRequest_milestone_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectChangeRequest_requester_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectChangeRequest_idempotencyKey_key"
  ON "ProjectChangeRequest"("idempotencyKey");
CREATE INDEX "ProjectChangeRequest_projectId_status_createdAt_idx"
  ON "ProjectChangeRequest"("projectId", "status", "createdAt");
CREATE INDEX "ProjectChangeRequest_milestoneId_status_idx"
  ON "ProjectChangeRequest"("milestoneId", "status");

CREATE TABLE "ProjectWorkflowEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "detailsJson" TEXT NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWorkflowEvent_project_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectWorkflowEvent_milestone_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectWorkflowEvent_actor_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectWorkflowEvent_idempotencyKey_key"
  ON "ProjectWorkflowEvent"("idempotencyKey");
CREATE INDEX "ProjectWorkflowEvent_projectId_createdAt_idx"
  ON "ProjectWorkflowEvent"("projectId", "createdAt");
CREATE INDEX "ProjectWorkflowEvent_milestoneId_createdAt_idx"
  ON "ProjectWorkflowEvent"("milestoneId", "createdAt");

CREATE TABLE "ProjectSupportNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "changeRequestId" TEXT,
  "adminUserId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectSupportNote_project_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectSupportNote_milestone_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectSupportNote_request_fkey"
    FOREIGN KEY ("changeRequestId") REFERENCES "ProjectChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectSupportNote_admin_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProjectSupportNote_projectId_createdAt_idx"
  ON "ProjectSupportNote"("projectId", "createdAt");
