-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "handlerId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "resolutionReason" TEXT,
    "contentHidden" BOOLEAN NOT NULL DEFAULT false,
    "openKey" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "industries" TEXT NOT NULL DEFAULT '',
    "logo" TEXT,
    "logoMimeType" TEXT,
    "website" TEXT,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT,
    "phone" TEXT,
    "representative" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT,
    "quotaKey" TEXT NOT NULL DEFAULT 'BUSINESS',
    "targetId" TEXT,
    "feature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageBucket" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT,
    "quotaKey" TEXT NOT NULL DEFAULT 'BUSINESS',
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUsageBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTeam" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "experience" TEXT NOT NULL DEFAULT '',
    "relevantProducts" TEXT NOT NULL DEFAULT '',
    "achievements" TEXT NOT NULL DEFAULT '',
    "interests" TEXT NOT NULL DEFAULT '',
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentProfileId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "major" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSkill" (
    "teamId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "TeamSkill_pkey" PRIMARY KEY ("teamId","skillId")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
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
    "closedReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "firstApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "consumedCreditId" TEXT,
    "creditRefundedAt" TIMESTAMP(3),
    "prototypeLegacy" BOOLEAN NOT NULL DEFAULT false,
    "evaluationResult" TEXT,
    "implementationDecision" TEXT,
    "prototypeRevisionRequestCount" INTEGER NOT NULL DEFAULT 0,
    "trialBriefLockedAt" TIMESTAMP(3),

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL,
    "problemId" TEXT,
    "attemptId" TEXT,
    "feature" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'AI',
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "checklist" JSONB NOT NULL,
    "reason" TEXT,
    "problemVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostCredit" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "package" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCharge" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "quantity" INTEGER,
    "periodStartsAt" TIMESTAMP(3),
    "periodEndsAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemAttachment" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemSkill" (
    "problemId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "ProblemSkill_pkey" PRIMARY KEY ("problemId","skillId")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "approach" TEXT NOT NULL,
    "problemUnderstanding" TEXT NOT NULL DEFAULT '',
    "solutionDirection" TEXT NOT NULL DEFAULT '',
    "methodology" TEXT NOT NULL DEFAULT '',
    "keySteps" TEXT NOT NULL DEFAULT '',
    "tools" TEXT NOT NULL DEFAULT '',
    "resources" TEXT NOT NULL DEFAULT '',
    "estimatedDuration" TEXT NOT NULL,
    "proposedBudget" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileSnapshot" JSONB,
    "profileSnapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "approachLinks" JSONB,
    "attachmentVersion" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "businessReviewNote" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApproachAttachment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "submissionVersion" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApproachAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationInvitation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedByBusinessProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reminderAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "responseStatus" TEXT,
    "responseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProblem" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProblem_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "ViewLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "field" TEXT,
    "skill" TEXT,
    "duration" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionProposal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "prototypeUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submissionStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "handoffStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submittedByUserId" TEXT,
    "lastResubmittedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalFile" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "attemptId" TEXT,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMessage" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "applicationId" TEXT,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceReadCursor" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceReadCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sourceProjectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "demoUrl" TEXT,
    "fileStorageKey" TEXT,
    "fileName" TEXT,
    "field" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvaluation" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "problemResponse" INTEGER NOT NULL,
    "feasibility" INTEGER NOT NULL,
    "goalAlignment" INTEGER NOT NULL,
    "practicalImplementation" INTEGER NOT NULL,
    "estimatedCost" INTEGER NOT NULL,
    "implementationTime" INTEGER NOT NULL,
    "valueDelivered" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "evaluationResult" TEXT,
    "implementationDecision" TEXT,
    "revisionRequestNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialBriefVersion" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "objective" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "evaluationCriteria" TEXT NOT NULL,
    "maxRevisionRequests" INTEGER NOT NULL,
    "businessProvidedData" TEXT,
    "confidentialityTerms" TEXT NOT NULL,
    "ownershipTerms" TEXT NOT NULL,
    "compensationTerms" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "TrialBriefVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialBriefResponse" (
    "id" TEXT NOT NULL,
    "trialBriefVersionId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "respondedByUserId" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialBriefResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSubmissionAttempt" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalHandoffReview" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalHandoffReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrototypeClosure" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrototypeClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
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
    "businessAcceptedAt" TIMESTAMP(3),
    "teamAcceptedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'AGREEING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "legacyTermsExempt" BOOLEAN NOT NULL DEFAULT false,
    "finalAcceptanceStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "finalAcceptedAt" TIMESTAMP(3),
    "finalAcceptedById" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pausedTotalSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL DEFAULT '',
    "paymentPercent" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER,
    "dueAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "progressNote" TEXT,
    "revisionFeedback" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "workCompleted" TEXT NOT NULL DEFAULT '',
    "difficulties" TEXT NOT NULL DEFAULT '',
    "acceptanceStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNFUNDED',
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "responseDueAt" TIMESTAMP(3),
    "overdueSince" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedTotalSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTransaction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "idempotencyKey" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DEPOSIT',
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "platformFeeBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "businessFeeBasisPoints" INTEGER,
    "studentFeeBasisPoints" INTEGER,
    "businessFee" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneSubmission" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "links" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneSubmissionFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneSubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAgreementVersion" (
    "id" TEXT NOT NULL,
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
    "businessAcceptedAt" TIMESTAMP(3),
    "teamAcceptedAt" TIMESTAMP(3),
    "businessAcceptedByUserId" TEXT,
    "teamAcceptedByUserId" TEXT,
    "legacySnapshot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAgreementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneProgressUpdate" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "workCompleted" TEXT NOT NULL,
    "difficulties" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChangeRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "proposedDueAt" TIMESTAMP(3),
    "requestedByUserId" TEXT NOT NULL,
    "businessAcceptedAt" TIMESTAMP(3),
    "teamAcceptedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWorkflowEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSupportNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "changeRequestId" TEXT,
    "adminUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'BUSINESS_TO_TEAM',
    "reviewedTeamId" TEXT,
    "reviewedBusinessProfileId" TEXT,
    "rating" DOUBLE PRECISION NOT NULL,
    "criteriaScores" TEXT NOT NULL DEFAULT '{}',
    "content" TEXT NOT NULL,
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStartedAt_idx" ON "RateLimitBucket"("windowStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_openKey_key" ON "Report"("openKey");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_createdAt_idx" ON "Report"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");

-- CreateIndex
CREATE INDEX "AiUsage_quotaKey_feature_targetId_status_createdAt_idx" ON "AiUsage"("quotaKey", "feature", "targetId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageBucket_quotaKey_periodType_periodStart_idx" ON "AiUsageBucket"("quotaKey", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageBucket_quotaKey_periodType_periodStart_key" ON "AiUsageBucket"("quotaKey", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTeam_ownerId_key" ON "StudentTeam"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTeam_slug_key" ON "StudentTeam"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_studentProfileId_key" ON "TeamMembership"("teamId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");

-- CreateIndex
CREATE INDEX "Problem_status_field_idx" ON "Problem"("status", "field");

-- CreateIndex
CREATE INDEX "Problem_businessProfileId_idx" ON "Problem"("businessProfileId");

-- CreateIndex
CREATE INDEX "Problem_consumedCreditId_idx" ON "Problem"("consumedCreditId");

-- CreateIndex
CREATE INDEX "AiReview_problemId_feature_createdAt_idx" ON "AiReview"("problemId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiReview_attemptId_feature_createdAt_idx" ON "AiReview"("attemptId", "feature", "createdAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "ProblemAttachment_storageKey_key" ON "ProblemAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ProblemAttachment_problemId_idx" ON "ProblemAttachment"("problemId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_problemId_teamId_key" ON "Application"("problemId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ApproachAttachment_storageKey_key" ON "ApproachAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ApproachAttachment_applicationId_submissionVersion_idx" ON "ApproachAttachment"("applicationId", "submissionVersion");

-- CreateIndex
CREATE INDEX "ApplicationInvitation_problemId_status_expiresAt_idx" ON "ApplicationInvitation"("problemId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ApplicationInvitation_applicationId_status_idx" ON "ApplicationInvitation"("applicationId", "status");

-- CreateIndex
CREATE INDEX "SavedProblem_userId_createdAt_idx" ON "SavedProblem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ViewLog_userId_problemId_createdAt_idx" ON "ViewLog"("userId", "problemId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_userId_createdAt_idx" ON "SearchLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionProposal_applicationId_key" ON "SolutionProposal"("applicationId");

-- CreateIndex
CREATE INDEX "Proposal_applicationId_submittedAt_idx" ON "Proposal"("applicationId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_applicationId_version_key" ON "Proposal"("applicationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalFile_storageKey_key" ON "ProposalFile"("storageKey");

-- CreateIndex
CREATE INDEX "ProposalFile_proposalId_idx" ON "ProposalFile"("proposalId");

-- CreateIndex
CREATE INDEX "WorkspaceMessage_problemId_createdAt_idx" ON "WorkspaceMessage"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceMessage_applicationId_createdAt_idx" ON "WorkspaceMessage"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceReadCursor_applicationId_userId_key" ON "WorkspaceReadCursor"("applicationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_sourceProjectId_key" ON "PortfolioItem"("sourceProjectId");

-- CreateIndex
CREATE INDEX "PortfolioItem_teamId_isVisible_idx" ON "PortfolioItem"("teamId", "isVisible");

-- CreateIndex
CREATE INDEX "ProposalEvaluation_proposalId_createdAt_idx" ON "ProposalEvaluation"("proposalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrialBriefVersion_problemId_version_key" ON "TrialBriefVersion"("problemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TrialBriefResponse_trialBriefVersionId_party_key" ON "TrialBriefResponse"("trialBriefVersionId", "party");

-- CreateIndex
CREATE INDEX "ProposalSubmissionAttempt_proposalId_submittedAt_idx" ON "ProposalSubmissionAttempt"("proposalId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSubmissionAttempt_proposalId_attempt_key" ON "ProposalSubmissionAttempt"("proposalId", "attempt");

-- CreateIndex
CREATE INDEX "ProposalHandoffReview_problemId_createdAt_idx" ON "ProposalHandoffReview"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "ProposalHandoffReview_proposalId_createdAt_idx" ON "ProposalHandoffReview"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "PrototypeClosure_problemId_createdAt_idx" ON "PrototypeClosure"("problemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_applicationId_key" ON "Project"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_projectId_sortOrder_key" ON "Milestone"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTransaction_idempotencyKey_key" ON "ProjectTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProjectTransaction_projectId_type_status_idx" ON "ProjectTransaction"("projectId", "type", "status");

-- CreateIndex
CREATE INDEX "MilestoneSubmission_milestoneId_createdAt_idx" ON "MilestoneSubmission"("milestoneId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneSubmissionFile_storageKey_key" ON "MilestoneSubmissionFile"("storageKey");

-- CreateIndex
CREATE INDEX "MilestoneSubmissionFile_submissionId_idx" ON "MilestoneSubmissionFile"("submissionId");

-- CreateIndex
CREATE INDEX "ProjectAgreementVersion_projectId_createdAt_idx" ON "ProjectAgreementVersion"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAgreementVersion_projectId_versionNumber_key" ON "ProjectAgreementVersion"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "MilestoneProgressUpdate_milestoneId_createdAt_idx" ON "MilestoneProgressUpdate"("milestoneId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectChangeRequest_idempotencyKey_key" ON "ProjectChangeRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProjectChangeRequest_projectId_status_createdAt_idx" ON "ProjectChangeRequest"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectChangeRequest_milestoneId_status_idx" ON "ProjectChangeRequest"("milestoneId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkflowEvent_idempotencyKey_key" ON "ProjectWorkflowEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProjectWorkflowEvent_projectId_createdAt_idx" ON "ProjectWorkflowEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectWorkflowEvent_milestoneId_createdAt_idx" ON "ProjectWorkflowEvent"("milestoneId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectSupportNote_projectId_createdAt_idx" ON "ProjectSupportNote"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_reviewedTeamId_createdAt_idx" ON "Review"("reviewedTeamId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_reviewedBusinessProfileId_createdAt_idx" ON "Review"("reviewedBusinessProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_projectId_direction_key" ON "Review"("projectId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_handlerId_fkey" FOREIGN KEY ("handlerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageBucket" ADD CONSTRAINT "AiUsageBucket_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTeam" ADD CONSTRAINT "StudentTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSkill" ADD CONSTRAINT "TeamSkill_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSkill" ADD CONSTRAINT "TeamSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_consumedCreditId_fkey" FOREIGN KEY ("consumedCreditId") REFERENCES "PostCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReview" ADD CONSTRAINT "AiReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProposalSubmissionAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostCredit" ADD CONSTRAINT "PostCredit_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCharge" ADD CONSTRAINT "PlatformCharge_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformCharge" ADD CONSTRAINT "PlatformCharge_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAttachment" ADD CONSTRAINT "ProblemAttachment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSkill" ADD CONSTRAINT "ProblemSkill_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSkill" ADD CONSTRAINT "ProblemSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApproachAttachment" ADD CONSTRAINT "ApproachAttachment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_invitedByBusinessProfileId_fkey" FOREIGN KEY ("invitedByBusinessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProblem" ADD CONSTRAINT "SavedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProblem" ADD CONSTRAINT "SavedProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewLog" ADD CONSTRAINT "ViewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewLog" ADD CONSTRAINT "ViewLog_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionProposal" ADD CONSTRAINT "SolutionProposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalFile" ADD CONSTRAINT "ProposalFile_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalFile" ADD CONSTRAINT "ProposalFile_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProposalSubmissionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessage" ADD CONSTRAINT "WorkspaceMessage_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessage" ADD CONSTRAINT "WorkspaceMessage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMessage" ADD CONSTRAINT "WorkspaceMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceReadCursor" ADD CONSTRAINT "WorkspaceReadCursor_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceReadCursor" ADD CONSTRAINT "WorkspaceReadCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvaluation" ADD CONSTRAINT "ProposalEvaluation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBriefVersion" ADD CONSTRAINT "TrialBriefVersion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBriefVersion" ADD CONSTRAINT "TrialBriefVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBriefResponse" ADD CONSTRAINT "TrialBriefResponse_trialBriefVersionId_fkey" FOREIGN KEY ("trialBriefVersionId") REFERENCES "TrialBriefVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBriefResponse" ADD CONSTRAINT "TrialBriefResponse_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSubmissionAttempt" ADD CONSTRAINT "ProposalSubmissionAttempt_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSubmissionAttempt" ADD CONSTRAINT "ProposalSubmissionAttempt_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHandoffReview" ADD CONSTRAINT "ProposalHandoffReview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHandoffReview" ADD CONSTRAINT "ProposalHandoffReview_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHandoffReview" ADD CONSTRAINT "ProposalHandoffReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProposalSubmissionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalHandoffReview" ADD CONSTRAINT "ProposalHandoffReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrototypeClosure" ADD CONSTRAINT "PrototypeClosure_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrototypeClosure" ADD CONSTRAINT "PrototypeClosure_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "StudentTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_finalAcceptedById_fkey" FOREIGN KEY ("finalAcceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTransaction" ADD CONSTRAINT "ProjectTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTransaction" ADD CONSTRAINT "ProjectTransaction_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSubmissionFile" ADD CONSTRAINT "MilestoneSubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "MilestoneSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgreementVersion" ADD CONSTRAINT "ProjectAgreementVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgreementVersion" ADD CONSTRAINT "ProjectAgreementVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgreementVersion" ADD CONSTRAINT "ProjectAgreementVersion_businessAcceptedByUserId_fkey" FOREIGN KEY ("businessAcceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAgreementVersion" ADD CONSTRAINT "ProjectAgreementVersion_teamAcceptedByUserId_fkey" FOREIGN KEY ("teamAcceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneProgressUpdate" ADD CONSTRAINT "MilestoneProgressUpdate_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneProgressUpdate" ADD CONSTRAINT "MilestoneProgressUpdate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeRequest" ADD CONSTRAINT "ProjectChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeRequest" ADD CONSTRAINT "ProjectChangeRequest_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeRequest" ADD CONSTRAINT "ProjectChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkflowEvent" ADD CONSTRAINT "ProjectWorkflowEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkflowEvent" ADD CONSTRAINT "ProjectWorkflowEvent_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkflowEvent" ADD CONSTRAINT "ProjectWorkflowEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupportNote" ADD CONSTRAINT "ProjectSupportNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupportNote" ADD CONSTRAINT "ProjectSupportNote_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupportNote" ADD CONSTRAINT "ProjectSupportNote_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ProjectChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupportNote" ADD CONSTRAINT "ProjectSupportNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedTeamId_fkey" FOREIGN KEY ("reviewedTeamId") REFERENCES "StudentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedBusinessProfileId_fkey" FOREIGN KEY ("reviewedBusinessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

