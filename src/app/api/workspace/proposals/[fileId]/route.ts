import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Vui lòng đăng nhập để tải Proposal.", { status: 401 });
  }
  const { fileId } = await params;
  const file = await prisma.proposalFile.findUnique({
    where: { id: fileId },
    select: {
      originalName: true,
      contentType: true,
      sizeBytes: true,
      storageKey: true,
      proposal: {
        select: {
          application: {
            select: { problemId: true, status: true },
          },
        },
      },
    },
  });
  if (!file) {
    return new Response("Không tìm thấy tệp Proposal.", { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const workspace = isAdmin
    ? null
    : ["BUSINESS", "STUDENT"].includes(session.user.role)
      ? await findAuthorizedWorkspace(
          file.proposal.application.problemId,
          session.user.id,
          session.user.role,
        )
      : null;
  const belongsToSelectedTeam = file.proposal.application.status === "SELECTED";
  if (!isAdmin && (!workspace || !belongsToSelectedTeam)) {
    return new Response("Không tìm thấy tệp Proposal.", { status: 404 });
  }

  try {
    const content = await attachmentStorage.read(file.storageKey);
    const body = new ArrayBuffer(content.byteLength);
    new Uint8Array(body).set(content);
    return new Response(body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          file.originalName,
        )}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Không thể đọc tệp Proposal:", error);
    return new Response("Không thể tải Proposal lúc này.", { status: 500 });
  }
}
