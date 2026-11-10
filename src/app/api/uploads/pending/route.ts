import { auth } from "@/auth";
import { deletePendingUpload } from "@/lib/storage/upload-grants";

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string") {
    return Response.json({ error: "Quyền tải tệp không hợp lệ." }, { status: 400 });
  }
  try {
    await deletePendingUpload(body.token, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Không thể xóa tệp tải lên đang chờ:", error);
    return Response.json({ error: "Không thể xóa tệp." }, { status: 500 });
  }
}
