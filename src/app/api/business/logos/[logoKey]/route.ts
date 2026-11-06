import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { attachmentStorage } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

import { detectImageMime } from "@/lib/image-signature";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logoKey: string }> },
) {
  const { logoKey } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(logoKey)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const profile = await prisma.businessProfile.findFirst({
      where: { logo: logoKey },
      select: { logoMimeType: true },
    });
    if (!profile) return new NextResponse("Not found", { status: 404 });
    const content = await attachmentStorage.read(logoKey);
    const contentType = profile.logoMimeType ?? detectImageMime(content);
    if (!contentType) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
