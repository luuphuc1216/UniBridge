export function isActivePremium(subscription: {
  package: string;
  status: string;
  endsAt: Date;
} | null, now = new Date()): boolean {
  return Boolean(
    subscription &&
      subscription.package === "PREMIUM" &&
      subscription.status === "ACTIVE" &&
      subscription.endsAt > now,
  );
}

export function canExplainApplication(input: {
  ownsProblem: boolean;
  problemStatus: string;
  applicationStatus: string;
}): boolean {
  return (
    input.ownsProblem &&
    ["APPROVED", "PUBLISHED"].includes(input.problemStatus) &&
    ["SUBMITTED", "PENDING_CONFIRMATION"].includes(input.applicationStatus)
  );
}
