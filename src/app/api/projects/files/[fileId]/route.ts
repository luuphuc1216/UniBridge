import { auth } from "@/auth";
import { findAccessibleProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { createAttachmentDownloadResponse } from "@/lib/storage/download-response";

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
    return await createAttachmentDownloadResponse({
      storageKey: file.storageKey,
      contentType: file.contentType,
      fileName: file.originalName,
    });
  } catch (error) {
    console.error("Không thể đọc tệp Milestone:", error);
    return new Response("Không thể tải tệp lúc này.", { status: 500 });
  }
}
