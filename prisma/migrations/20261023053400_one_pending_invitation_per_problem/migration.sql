CREATE UNIQUE INDEX "ApplicationInvitation_one_pending_per_problem"
ON "ApplicationInvitation"("problemId")
WHERE "status" = 'PENDING_CONFIRMATION';
