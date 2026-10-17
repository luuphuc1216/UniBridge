-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Proposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalFile_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkspaceMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "problemId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMessage_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalEvaluation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE INDEX "ProposalEvaluation_proposalId_createdAt_idx" ON "ProposalEvaluation"("proposalId", "createdAt");
