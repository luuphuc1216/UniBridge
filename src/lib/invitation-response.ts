import type { Prisma } from "@/generated/prisma/client";

export async function expireInvitationDuringResponse(
  transaction: Prisma.TransactionClient,
  input: {
    invitationId: string;
    applicationId: string;
    problemId: string;
    businessUserId: string;
    problemTitle: string;
    now: Date;
  },
): Promise<boolean> {
  const expiredInvitation = await transaction.applicationInvitation.updateMany({
    where: {
      id: input.invitationId,
      status: "PENDING_CONFIRMATION",
      expiresAt: { lte: input.now },
    },
    data: {
      status: "EXPIRED",
      respondedAt: input.now,
      responseStatus: "EXPIRED",
      responseReason: "Hết hạn phản hồi",
    },
  });
  if (expiredInvitation.count !== 1) return false;

  const expiredApplication = await transaction.application.updateMany({
    where: { id: input.applicationId, status: "PENDING_CONFIRMATION" },
    data: { status: "EXPIRED" },
  });
  if (expiredApplication.count !== 1) {
    throw new Error("Hồ sơ đã thay đổi. Vui lòng tải lại trang.");
  }

  await transaction.notification.create({
    data: {
      userId: input.businessUserId,
      title: "Lời mời hợp tác đã hết hạn",
      message: `Lời mời cho bài toán “${input.problemTitle}” đã hết hạn.`,
      href: `/business/problems/${input.problemId}/applications`,
    },
  });
  return true;
}
