import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAttachmentDownloadResponse } from "@/lib/storage/download-response";
import { canDownloadProblemAttachment } from "@/lib/business-attachments/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Vui lòng đăng nhập để tải tài liệu.", { status: 401 });
  }

  const { attachmentId } = await params;
  const attachment = await prisma.problemAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      problem: {
        select: {
          status: true,
          approvedAt: true,
          hiddenByAdmin: true,
          businessProfile: { select: { userId: true } },
        },
      },
    },
  });
  if (!attachment) {
    return new Response("Không tìm thấy tài liệu.", { status: 404 });
  }

  if (
    !canDownloadProblemAttachment({
      role: session.user.role,
      userId: session.user.id,
      businessUserId: attachment.problem.businessProfile.userId,
      status: attachment.problem.status,
      approvedAt: attachment.problem.approvedAt,
      hiddenByAdmin: attachment.problem.hiddenByAdmin,
    })
  ) {
    return new Response("Bạn không có quyền tải tài liệu này.", { status: 403 });
  }

  try {
    return await createAttachmentDownloadResponse({
      storageKey: attachment.storageKey,
      contentType: attachment.contentType,
      fileName: attachment.originalName,
    });
  } catch (error) {
    console.error("Không thể đọc tệp đính kèm:", error);
    return new Response("Không thể tải tài liệu lúc này.", { status: 500 });
  }
}
