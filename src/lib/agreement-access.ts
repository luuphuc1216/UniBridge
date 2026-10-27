export function canOpenPaidImplementationAgreement(problem: {
  status: string;
  prototypeLegacy: boolean;
  evaluationResult: string | null;
  implementationDecision: string | null;
}): boolean {
  return (
    problem.status === "READY_FOR_IMPLEMENTATION" &&
    (problem.prototypeLegacy ||
      (problem.evaluationResult === "ACCEPTED" &&
        problem.implementationDecision === "IMPLEMENT"))
  );
}
