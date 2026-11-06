import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const item = await prisma.portfolioItem.findFirst({
    where: { id: itemId, isVisible: true },
    select: { fileStorageKey: true, fileName: true },
  });
  if (!item?.fileStorageKey) return new NextResponse("Not found", { status: 404 });
  try {
    const content = await attachmentStorage.read(item.fileStorageKey);
    const contentType = item.fileName?.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : item.fileName?.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(item.fileName ?? "portfolio-file")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
