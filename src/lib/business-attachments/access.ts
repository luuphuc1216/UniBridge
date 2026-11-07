const studentVisibleProblemStatuses = [
  "APPROVED",
  "PUBLISHED",
  "TEAM_SELECTED",
  "PROTOTYPING",
  "EVALUATING",
] as const;

export function canDownloadProblemAttachment(input: {
  role: string;
  userId: string;
  businessUserId: string;
  status: string;
  approvedAt: Date | null;
  hiddenByAdmin: boolean;
}): boolean {
  if (input.role === "ADMIN") return true;
  if (input.role === "BUSINESS" && input.businessUserId === input.userId) {
    return true;
  }
  return (
    input.role === "STUDENT" &&
    input.approvedAt !== null &&
    !input.hiddenByAdmin &&
    studentVisibleProblemStatuses.some((status) => status === input.status)
  );
}
