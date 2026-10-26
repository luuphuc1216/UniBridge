-- Additive columns for the trial brief and prototype workflow.
ALTER TABLE "Problem" ADD COLUMN "prototypeLegacy" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Problem" ADD COLUMN "evaluationResult" TEXT;
ALTER TABLE "Problem" ADD COLUMN "implementationDecision" TEXT;
ALTER TABLE "Problem" ADD COLUMN "prototypeRevisionRequestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Problem" ADD COLUMN "trialBriefLockedAt" DATETIME;
ALTER TABLE "Proposal" ADD COLUMN "submissionStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Proposal" ADD COLUMN "handoffStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Proposal" ADD COLUMN "submittedByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD COLUMN "lastResubmittedAt" DATETIME;
ALTER TABLE "ProposalEvaluation" ADD COLUMN "evaluationResult" TEXT;
ALTER TABLE "ProposalEvaluation" ADD COLUMN "implementationDecision" TEXT;
ALTER TABLE "ProposalEvaluation" ADD COLUMN "revisionRequestNumber" INTEGER;

-- Backfill legacy records without creating trial briefs.
UPDATE "Problem"
SET "prototypeLegacy" = 1
WHERE "status" IN ('PROTOTYPING', 'EVALUATING', 'READY_FOR_IMPLEMENTATION', 'IN_PROGRESS', 'COMPLETED');

-- Existing proposals bypass the new handoff queue as legacy records.
UPDATE "Proposal"
SET "submissionStatus" = CASE
      WHEN "status" = 'DRAFT' THEN 'NOT_SUBMITTED'
      ELSE 'LEGACY'
    END,
    "handoffStatus" = CASE
      WHEN "status" = 'DRAFT' THEN 'NOT_SUBMITTED'
      ELSE 'APPROVED'
    END;

-- Preserve the meaning of historical evaluation decisions.
UPDATE "ProposalEvaluation"
SET "evaluationResult" = CASE "decision"
  WHEN 'CHANGES_REQUESTED' THEN 'REVISION_REQUESTED'
  WHEN 'CLOSED' THEN 'STOPPED'
  WHEN 'READY_FOR_IMPLEMENTATION' THEN 'ACCEPTED'
  WHEN 'ACCEPTED' THEN 'ACCEPTED'
  ELSE NULL
END,
"implementationDecision" = CASE "decision"
  WHEN 'READY_FOR_IMPLEMENTATION' THEN 'IMPLEMENT'
  ELSE NULL
END;

CREATE TABLE "TrialBriefVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "objective" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "evaluationCriteria" TEXT NOT NULL,
    "maxRevisionRequests" INTEGER NOT NULL,
    "businessProvidedData" TEXT,
    "confidentialityTerms" TEXT NOT NULL,
    "ownershipTerms" TEXT NOT NULL,
    "compensationTerms" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    CONSTRAINT "TrialBriefVersion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrialBriefVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TrialBriefResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trialBriefVersionId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "respondedByUserId" TEXT NOT NULL,
    "respondedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrialBriefResponse_trialBriefVersionId_fkey" FOREIGN KEY ("trialBriefVersionId") REFERENCES "TrialBriefVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrialBriefResponse_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProposalSubmissionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalSubmissionAttempt_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalSubmissionAttempt_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "ProposalFile"
  ADD COLUMN "attemptId" TEXT
  REFERENCES "ProposalSubmissionAttempt"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProposalHandoffReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "attemptId" TEXT,
    "reviewedByUserId" TEXT NOT NULL,
    "filesOrLinksComplete" BOOLEAN NOT NULL,
    "withinTrialBriefScope" BOOLEAN NOT NULL,
    "compliesWithRules" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL,
    "missingItems" TEXT,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalHandoffReview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalHandoffReview_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalHandoffReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProposalSubmissionAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProposalHandoffReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PrototypeClosure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrototypeClosure_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrototypeClosure_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TrialBriefVersion_problemId_version_key" ON "TrialBriefVersion"("problemId", "version");
CREATE UNIQUE INDEX "TrialBriefResponse_trialBriefVersionId_party_key" ON "TrialBriefResponse"("trialBriefVersionId", "party");
CREATE INDEX "ProposalSubmissionAttempt_proposalId_submittedAt_idx" ON "ProposalSubmissionAttempt"("proposalId", "submittedAt");
CREATE UNIQUE INDEX "ProposalSubmissionAttempt_proposalId_attempt_key" ON "ProposalSubmissionAttempt"("proposalId", "attempt");
CREATE INDEX "ProposalHandoffReview_problemId_createdAt_idx" ON "ProposalHandoffReview"("problemId", "createdAt");
CREATE INDEX "ProposalHandoffReview_proposalId_createdAt_idx" ON "ProposalHandoffReview"("proposalId", "createdAt");
CREATE INDEX "PrototypeClosure_problemId_createdAt_idx" ON "PrototypeClosure"("problemId", "createdAt");
