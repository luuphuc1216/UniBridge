import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";

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
          businessProfile: { select: { userId: true } },
        },
      },
    },
  });
  if (!attachment) {
    return new Response("Không tìm thấy tài liệu.", { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    session.user.role === "BUSINESS" &&
    attachment.problem.businessProfile.userId === session.user.id;
  const isStudentWithPublicProblem =
    session.user.role === "STUDENT" &&
    attachment.problem.approvedAt !== null &&
    ["PUBLISHED", "TEAM_SELECTED"].includes(attachment.problem.status);
  if (!isAdmin && !isOwner && !isStudentWithPublicProblem) {
    return new Response("Bạn không có quyền tải tài liệu này.", { status: 403 });
  }

  try {
    const content = await attachmentStorage.read(attachment.storageKey);
    const body = new ArrayBuffer(content.byteLength);
    new Uint8Array(body).set(content);
    return new Response(body, {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Length": String(attachment.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          attachment.originalName,
        )}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Không thể đọc tệp đính kèm:", error);
    return new Response("Không thể tải tài liệu lúc này.", { status: 500 });
  }
}
