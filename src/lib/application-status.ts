export type ApplicationStatusDisplay = {
  label: string;
  tone: "neutral" | "pending" | "success" | "muted" | "danger";
  actions: "edit-withdraw" | "respond-invitation" | "workspace" | "readonly";
};

export const APPLICATION_STATUS_DISPLAY: Record<string, ApplicationStatusDisplay> = {
  SUBMITTED: { label: "Đang xem xét", tone: "pending", actions: "edit-withdraw" },
  PENDING_CONFIRMATION: {
    label: "Chờ xác nhận hợp tác",
    tone: "pending",
    actions: "respond-invitation",
  },
  SELECTED: { label: "Đã được lựa chọn", tone: "success", actions: "workspace" },
  DECLINED: { label: "Nhóm đã từ chối lời mời", tone: "danger", actions: "readonly" },
  EXPIRED: { label: "Lời mời hết hạn", tone: "muted", actions: "readonly" },
  NOT_SELECTED: { label: "Không được chọn", tone: "muted", actions: "readonly" },
  REJECTED: { label: "Không được chọn", tone: "muted", actions: "readonly" },
  WITHDRAWN: { label: "Đã rút hồ sơ", tone: "muted", actions: "readonly" },
};

export function getApplicationStatusDisplay(status: string): ApplicationStatusDisplay {
  return APPLICATION_STATUS_DISPLAY[status] ?? {
    label: `Trạng thái: ${status}`,
    tone: "neutral",
    actions: "readonly",
  };
}

export function formatInvitationExpiry(expiresAt: Date): string {
  return `Hạn phản hồi: ${new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt)}`;
}

export function formatInvitationRemaining(expiresAt: Date, now = new Date()): string {
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return "Lời mời đã hết hạn";
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  if (days > 0) return `Còn ${days} ngày${hours ? ` ${hours} giờ` : ""} để phản hồi`;
  return `Còn ${hours} giờ để phản hồi`;
}

export function canRespondToInvitation(status: string, isTeamOwner: boolean): boolean {
  return status === "PENDING_CONFIRMATION" && isTeamOwner;
}
