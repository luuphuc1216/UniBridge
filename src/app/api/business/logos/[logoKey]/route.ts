import { NextResponse } from "next/server";
import { attachmentStorage } from "@/lib/storage";
import { createAttachmentDownloadResponse } from "@/lib/storage/download-response";
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
    return await createAttachmentDownloadResponse({
      storageKey: logoKey,
      contentType,
      fileName: "business-logo",
      inline: true,
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
