import { auth } from "@/auth";
import { isLocalAttachmentStorage } from "@/lib/storage";
import { storeLocalUpload } from "@/lib/storage/upload-grants";

export async function POST(request: Request) {
  if (!isLocalAttachmentStorage) {
    return new Response("Not found", { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Vui lòng đăng nhập để tải tệp lên." }, { status: 401 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Dữ liệu tệp không hợp lệ." }, { status: 400 });
  }
  const token = formData.get("token");
  const file = formData.get("file");
  if (typeof token !== "string" || !(file instanceof File)) {
    return Response.json({ error: "Thiếu tệp hoặc quyền tải lên." }, { status: 400 });
  }
  try {
    await storeLocalUpload(token, session.user.id, file);
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Không thể lưu tệp tải lên local:", error);
    return Response.json({ error: "Không thể lưu tệp." }, { status: 500 });
  }
}
