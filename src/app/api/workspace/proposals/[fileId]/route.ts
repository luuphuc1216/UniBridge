import { auth } from "@/auth";
import { attachmentStorage } from "@/lib/storage";
import { findAuthorizedProposalFile } from "@/lib/proposal-handoff-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Vui lòng đăng nhập để tải đề xuất giải pháp.", { status: 401 });
  }
  const { fileId } = await params;
  const file = await findAuthorizedProposalFile(fileId, session.user.id, session.user.role);
  if (!file) {
    return new Response("Không tìm thấy tệp đề xuất giải pháp.", { status: 404 });
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
    console.error("Không thể đọc tệp đề xuất giải pháp:", error);
    return new Response("Không thể tải đề xuất giải pháp lúc này.", { status: 500 });
  }
}
