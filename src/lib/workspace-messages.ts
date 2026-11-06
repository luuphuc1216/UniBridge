import { prisma } from "@/lib/prisma";

export async function markWorkspaceRead(applicationId: string, userId: string) {
  await prisma.workspaceReadCursor.upsert({
    where: { applicationId_userId: { applicationId, userId } },
    create: { applicationId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

export async function getUnreadWorkspaceMessageCount(userId: string, role: string) {
  const applications = role === "BUSINESS"
    ? await prisma.application.findMany({
        where: { problem: { businessProfile: { userId } } },
        select: { id: true },
      })
    : await prisma.application.findMany({
        where: {
          team: {
            OR: [
              { ownerId: userId },
              { memberships: { some: { studentProfile: { userId } } } },
            ],
          },
        },
        select: { id: true },
      });
  if (applications.length === 0) return 0;
  const cursors = await prisma.workspaceReadCursor.findMany({
    where: { userId, applicationId: { in: applications.map(({ id }) => id) } },
    select: { applicationId: true, lastReadAt: true },
  });
  const cursorMap = new Map(cursors.map((cursor) => [cursor.applicationId, cursor.lastReadAt]));
  const counts = await Promise.all(applications.map(({ id }) =>
    prisma.workspaceMessage.count({
      where: {
        applicationId: id,
        senderId: { not: userId },
        ...(cursorMap.get(id) ? { createdAt: { gt: cursorMap.get(id)! } } : {}),
      },
    }),
  ));
  return counts.reduce((total, count) => total + count, 0);
}
