export type AiChecklistItem = {
  key: string;
  passed: boolean;
  reason: string;
};

export type AiReviewResult = {
  checklist: AiChecklistItem[];
  conclusion: "APPROVE" | "REQUEST_REVISION" | "REJECT" | "UNCERTAIN";
  reason: string;
};

export const REQUIRED_PROBLEM_AI_KEYS = ["clarity", "scope", "student_fit", "policy"] as const;

export function isAiReviewResult(value: unknown): value is AiReviewResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.checklist) ||
    !["APPROVE", "REQUEST_REVISION", "REJECT", "UNCERTAIN"].includes(
      String(candidate.conclusion),
    ) ||
    typeof candidate.reason !== "string"
  ) {
    return false;
  }
  return candidate.checklist.length <= 20 && candidate.checklist.every((item) => {
    if (!item || typeof item !== "object") return false;
    const checklistItem = item as Record<string, unknown>;
    return (
      typeof checklistItem.key === "string" &&
      typeof checklistItem.passed === "boolean" &&
      typeof checklistItem.reason === "string" &&
      checklistItem.reason.length <= 500
    );
  }) && new Set(candidate.checklist.map((item) => (
    item && typeof item === "object" ? (item as Record<string, unknown>).key : ""
  ))).size === candidate.checklist.length;
}
