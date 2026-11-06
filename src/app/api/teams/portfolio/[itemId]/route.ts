import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attachmentStorage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { itemId } = await params;
  const item = await prisma.portfolioItem.findFirst({
    where: { id: itemId },
    select: { fileStorageKey: true, fileName: true, teamId: true, isVisible: true },
  });
  if (!item?.fileStorageKey || !item.isVisible) return new NextResponse("Not found", { status: 404 });
  const canManage = await prisma.studentTeam.findFirst({
    where: {
      id: item.teamId,
      OR: [
        { ownerId: session.user.id },
        { memberships: { some: { isLead: true, studentProfile: { userId: session.user.id } } } },
      ],
    },
    select: { id: true },
  });
  if (!canManage) return new NextResponse("Forbidden", { status: 403 });
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
