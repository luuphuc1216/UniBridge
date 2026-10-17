import { auth } from "@/auth";
import { findAccessibleProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user || !["BUSINESS", "STUDENT"].includes(session.user.role)) {
    return new Response("Vui lòng đăng nhập để tải tệp.", { status: 401 });
  }
  const { fileId } = await params;
  const file = await prisma.milestoneSubmissionFile.findUnique({
    where: { id: fileId },
    select: {
      originalName: true,
      contentType: true,
      sizeBytes: true,
      storageKey: true,
      submission: {
        select: {
          milestone: {
            select: { projectId: true },
          },
        },
      },
    },
  });
  if (!file) return new Response("Không tìm thấy tệp.", { status: 404 });

  const project = await findAccessibleProject(
    file.submission.milestone.projectId,
    session.user.id,
    session.user.role,
  );
  if (!project) return new Response("Không tìm thấy tệp.", { status: 404 });

  try {
    const content = await attachmentStorage.read(file.storageKey);
    const body = new ArrayBuffer(content.byteLength);
    new Uint8Array(body).set(content);
    return new Response(body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Không thể đọc tệp Milestone:", error);
    return new Response("Không thể tải tệp lúc này.", { status: 500 });
  }
}
