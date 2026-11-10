import { auth } from "@/auth";
import {
  createUploadGrants,
  parseUploadScope,
} from "@/lib/storage/upload-grants";
import type { UploadFileDescription } from "@/lib/storage/upload-validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Vui lòng đăng nhập để tải tệp lên." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Thông tin tải tệp không hợp lệ." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Thông tin tải tệp không hợp lệ." }, { status: 400 });
  }
  const requestBody = body as {
    scope?: unknown;
    files?: unknown;
  };
  if (
    !Array.isArray(requestBody.files) ||
    requestBody.files.some(
      (file) =>
        !file ||
        typeof file !== "object" ||
        typeof file.name !== "string" ||
        typeof file.type !== "string" ||
        typeof file.size !== "number",
    )
  ) {
    return Response.json({ error: "Danh sách tệp không hợp lệ." }, { status: 400 });
  }
  try {
    const scope = parseUploadScope(requestBody.scope);
    const grants = await createUploadGrants(
      session.user.id,
      session.user.role,
      scope,
      requestBody.files as UploadFileDescription[],
    );
    return Response.json({ uploads: grants }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Không thể tạo quyền tải tệp:", error);
    return Response.json({ error: "Không thể cấp quyền tải tệp." }, { status: 500 });
  }
}
