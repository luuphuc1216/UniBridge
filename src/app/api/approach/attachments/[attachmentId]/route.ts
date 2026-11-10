import { auth } from "@/auth";
import { createAttachmentDownloadResponse } from "@/lib/storage/download-response";
import { prisma } from "@/lib/prisma";
import { canDownloadApproachAttachment } from "@/lib/approach-attachments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Vui lòng đăng nhập để tải tài liệu.", { status: 401 });
  }

  const { attachmentId } = await params;
  const attachment = await prisma.approachAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      application: {
        select: {
          status: true,
          teamId: true,
          problem: {
            select: { businessProfile: { select: { userId: true } } },
          },
        },
      },
    },
  });
  if (!attachment) {
    return new Response("Không tìm thấy tài liệu.", { status: 404 });
  }

  const isProblemOwner =
    attachment.application.problem.businessProfile.userId === session.user.id;
  const teamMembership =
    session.user.role === "STUDENT"
      ? await prisma.studentTeam.findFirst({
          where: {
            id: attachment.application.teamId,
            OR: [
              { ownerId: session.user.id },
              {
                memberships: {
                  some: { studentProfile: { userId: session.user.id } },
                },
              },
            ],
          },
          select: { id: true },
        })
      : null;
  const isAllowed = canDownloadApproachAttachment({
    role: session.user.role,
    isTeamMember: Boolean(teamMembership),
    isProblemOwner,
    applicationStatus: attachment.application.status,
  });
  if (!isAllowed) {
    return new Response("Không tìm thấy tài liệu.", { status: 404 });
  }

  try {
    return await createAttachmentDownloadResponse({
      storageKey: attachment.storageKey,
      contentType: attachment.contentType,
      fileName: attachment.originalName,
    });
  } catch (error) {
    console.error("Không thể đọc tài liệu Approach:", error);
    return new Response("Không thể tải tài liệu lúc này.", { status: 500 });
  }
}
