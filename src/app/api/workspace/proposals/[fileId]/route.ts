import { auth } from "@/auth";
import { createAttachmentDownloadResponse } from "@/lib/storage/download-response";
import { findAuthorizedProposalFile } from "@/lib/proposal-handoff-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Vui lòng đăng nhập để tải Proposal.", { status: 401 });
  }
  const { fileId } = await params;
  const file = await findAuthorizedProposalFile(fileId, session.user.id, session.user.role);
  if (!file) {
    return new Response("Không tìm thấy tệp Proposal.", { status: 404 });
  }

  try {
    return await createAttachmentDownloadResponse({
      storageKey: file.storageKey,
      contentType: file.contentType,
      fileName: file.originalName,
    });
  } catch (error) {
    console.error("Không thể đọc tệp Proposal:", error);
    return new Response("Không thể tải Proposal lúc này.", { status: 500 });
  }
}
