import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAttachmentDownloadResponse } from "@/lib/storage/download-response";
import { canViewPortfolioFile } from "@/lib/portfolio-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await auth();
  const { itemId } = await params;
  const item = await prisma.portfolioItem.findFirst({
    where: { id: itemId },
    select: { fileStorageKey: true, fileName: true, teamId: true, isVisible: true },
  });
  if (!item?.fileStorageKey) return new NextResponse("Not found", { status: 404 });
  const teamMembership = session?.user
    ? await prisma.studentTeam.findFirst({
        where: {
          id: item.teamId,
          OR: [
            { ownerId: session.user.id },
            { memberships: { some: { isLead: true, studentProfile: { userId: session.user.id } } } },
          ],
        },
        select: { ownerId: true, memberships: { where: { isLead: true, studentProfile: { userId: session.user.id } }, select: { id: true } } },
      })
    : null;
  if (!canViewPortfolioFile({
    viewer: session?.user ? { userId: session.user.id, role: session.user.role } : null,
    item,
    teamMembership: teamMembership ? { isOwner: teamMembership.ownerId === session?.user.id, isLead: teamMembership.memberships.length > 0 } : null,
  })) {
    return item.isVisible ? new NextResponse("Unauthorized", { status: 401 }) : new NextResponse("Not found", { status: 404 });
  }
  try {
    const contentType = item.fileName?.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : item.fileName?.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    return await createAttachmentDownloadResponse({
      storageKey: item.fileStorageKey,
      contentType,
      fileName: item.fileName ?? "portfolio-file",
      inline: true,
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
