export type AdminAiAssistStatus =
  | "AI"
  | "RULES_ONLY"
  | "UNAVAILABLE"
  | "STALE"
  | "ERROR";

type AdminReviewKind = "AI" | "RULE_REJECT" | "AI_UNAVAILABLE";
type StoredAdminReviewStatus = Exclude<AdminAiAssistStatus, "ERROR">;

export function getAdminAiAssistStatus(
  kind: AdminReviewKind,
  reviewedVersion: number,
  currentVersion: number | null,
): StoredAdminReviewStatus {
  if (currentVersion === null || reviewedVersion !== currentVersion) return "STALE";
  if (kind === "AI") return "AI";
  if (kind === "RULE_REJECT") return "RULES_ONLY";
  return "UNAVAILABLE";
}

export function getAdminAiAssistFailure(error: unknown): {
  status: "UNAVAILABLE" | "ERROR";
  message: string;
} {
  if (error instanceof Error) {
    if (
      error.message === "Bạn đã hết lượt AI trong ngày." ||
      error.message === "Bạn đã hết lượt AI trong tháng." ||
      error.message === "Bài toán đã đạt giới hạn số lần AI kiểm tra trong 24 giờ."
    ) {
      return { status: "UNAVAILABLE", message: error.message };
    }
    if (error.message === "Không tìm thấy bài toán.") {
      return { status: "ERROR", message: error.message };
    }
  }

  return {
    status: "ERROR",
    message: "Không thể hoàn tất AI Assist lúc này. Vui lòng tải lại trang và thử lại.",
  };
}

export function getStoredAdminAiAssistStatus(
  status: string,
  reviewedVersion: number | null,
  currentVersion: number,
): StoredAdminReviewStatus {
  if (reviewedVersion === null || reviewedVersion !== currentVersion || status === "STALE") {
    return "STALE";
  }
  if (status === "UNAVAILABLE") return "UNAVAILABLE";
  if (status === "RULES_ONLY") return "RULES_ONLY";
  return "AI";
}
