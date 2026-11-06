import type { Prisma } from "@/generated/prisma/client";

export const PROBLEM_ACCEPTING_APPLICATION_STATUSES = ["APPROVED", "PUBLISHED"] as const;

export const APPLICATION_EFFECTIVE_STATUSES = ["SUBMITTED", "PENDING_CONFIRMATION", "SELECTED"] as const;
export const APPLICATION_NON_EFFECTIVE_STATUSES = [
  "WITHDRAWN",
  "REJECTED",
  "DECLINED",
  "EXPIRED",
  "NOT_SELECTED",
] as const;

export const STUDENT_DISCOVERABLE_PROBLEM_STATUSES = [
  "APPROVED",
  "PUBLISHED",
  "TEAM_SELECTED",
  "PROTOTYPING",
  "EVALUATING",
] as const;
export const PROBLEM_REVIEWABLE_STATUS = "PENDING_REVIEW";

export function getStudentDiscoverableProblemWhere(): Prisma.ProblemWhereInput {
  return {
    status: { in: [...STUDENT_DISCOVERABLE_PROBLEM_STATUSES] },
    hiddenByAdmin: false,
    applications: { none: { status: "SELECTED" } },
  };
}

export function getStudentRecommendationProblemWhere(
  teamId: string,
): Prisma.ProblemWhereInput {
  return {
    status: { in: [...PROBLEM_ACCEPTING_APPLICATION_STATUSES] },
    hiddenByAdmin: false,
    AND: [
      { applications: { none: { status: "SELECTED" } } },
      {
        applications: {
          none: {
            teamId,
            status: { in: getEffectiveApplicationStatuses() },
          },
        },
      },
    ],
  };
}

export function getEffectiveApplicationStatuses(): string[] {
  return [...APPLICATION_EFFECTIVE_STATUSES];
}

export function isEffectiveApplicationStatus(status: string): boolean {
  return APPLICATION_EFFECTIVE_STATUSES.some((effectiveStatus) => effectiveStatus === status);
}

export function canEditApplication(status: string | null): boolean {
  return status === null || status === "SUBMITTED";
}

export function canCreatePendingInvitation(activeInvitationCount: number): boolean {
  return activeInvitationCount === 0;
}

export function isWorkspaceMessageWritableApplicationStatus(status: string): boolean {
  return status === "PENDING_CONFIRMATION" || status === "SELECTED";
}

export function shouldExpireInvitation(
  status: string,
  expiresAt: Date,
  now: Date,
): boolean {
  return status === "PENDING_CONFIRMATION" && expiresAt <= now;
}

export function shouldSendInvitationReminder(
  status: string,
  reminderAt: Date | null,
  reminderSentAt: Date | null,
  now: Date,
): boolean {
  return (
    status === "PENDING_CONFIRMATION" &&
    reminderAt !== null &&
    reminderSentAt === null &&
    reminderAt <= now
  );
}

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
  closedReason?: string | null,
): string {
  switch (status) {
    case "REJECTED":
      return reviewNote
        ? `Bài toán đã bị từ chối kiểm duyệt và không nhận hồ sơ mới. Lý do: ${reviewNote}`
        : "Bài toán đã bị từ chối kiểm duyệt và không nhận hồ sơ mới.";
    case "PENDING_CONFIRMATION":
      return "Nhóm đã nhận lời mời hợp tác và đang chờ phản hồi trong thời hạn quy định.";
    case "DECLINED":
      return "Nhóm đã từ chối lời mời hợp tác với bài toán này.";
    case "EXPIRED":
      return "Lời mời hợp tác đã hết hạn mà không có phản hồi.";
    case "NOT_SELECTED":
      return "Hồ sơ của nhóm không được chọn cho bài toán này.";
    case "CLOSED":
      return closedReason === "BUSINESS_CLOSED"
        ? "Bài toán đã được doanh nghiệp đóng và không nhận hồ sơ mới."
        : "Bài toán đã kết thúc sau giai đoạn Prototype và không nhận hồ sơ mới.";
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
