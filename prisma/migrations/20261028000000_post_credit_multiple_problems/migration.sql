DROP INDEX "Problem_consumedCreditId_key";

CREATE INDEX "Problem_consumedCreditId_idx" ON "Problem"("consumedCreditId");
