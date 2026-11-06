import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { attachmentStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logoKey: string }> },
) {
  const { logoKey } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(logoKey)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const content = await attachmentStorage.read(logoKey);
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": "image/*",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
