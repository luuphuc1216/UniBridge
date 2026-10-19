export const PROBLEM_ACCEPTING_APPLICATION_STATUSES = ["APPROVED"] as const;

export const STUDENT_DISCOVERABLE_PROBLEM_STATUSES = [
  "APPROVED",
  "PUBLISHED",
  "TEAM_SELECTED",
  "PROTOTYPING",
  "EVALUATING",
] as const;
export const PROBLEM_REVIEWABLE_STATUS = "PENDING_REVIEW";

export function isProblemAcceptingApplications(status: string): boolean {
  return PROBLEM_ACCEPTING_APPLICATION_STATUSES.some(
    (acceptingStatus) => acceptingStatus === status,
  );
}

export type ProblemReviewStatus = "APPROVED" | "NEEDS_REVISION" | "REJECTED";

export function getProblemReviewTransition(
  currentStatus: string,
  decision: string,
): ProblemReviewStatus | null {
  if (currentStatus !== PROBLEM_REVIEWABLE_STATUS) {
    return null;
  }

  switch (decision) {
    case "approve":
      return "APPROVED";
    case "requestRevision":
      return "NEEDS_REVISION";
    case "reject":
      return "REJECTED";
    default:
      return null;
  }
}

export function isValidProblemReviewNote(note: string): boolean {
  const normalizedNote = note.trim();
  return normalizedNote.length >= 3 && normalizedNote.length <= 2000;
}

export function getApplicationUnavailableReason(
  status: string,
  reviewNote: string | null,
): string {
  switch (status) {
    case "REJECTED":
      return reviewNote
        ? `Bài toán đã bị từ chối kiểm duyệt và không nhận hồ sơ mới. Lý do: ${reviewNote}`
        : "Bài toán đã bị từ chối kiểm duyệt và không nhận hồ sơ mới.";
    case "CLOSED":
      return "Bài toán đã kết thúc sau giai đoạn Prototype và không nhận hồ sơ mới.";
    case "TEAM_SELECTED":
      return "Doanh nghiệp đã chọn nhóm cho bài toán này nên bài toán không nhận hồ sơ mới.";
    case "PROTOTYPING":
      return "Bài toán đang trong giai đoạn xây dựng Prototype nên không nhận hồ sơ mới.";
    case "EVALUATING":
      return "Doanh nghiệp đang đánh giá giải pháp nên bài toán không nhận hồ sơ mới.";
    case "READY_FOR_IMPLEMENTATION":
      return "Bài toán đã sẵn sàng sang Paid Implementation nên không nhận hồ sơ mới.";
    case "COMPLETED":
      return "Dự án đã hoàn thành nên bài toán không nhận hồ sơ mới.";
    default:
      return "Bài toán hiện không nhận hồ sơ mới.";
  }
}
