import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUnreadMessageCount } from "@/lib/workspace-message-scope";

type WorkspaceMessagesDatabase = Pick<
  PrismaClient,
  "application" | "workspaceReadCursor" | "workspaceMessage"
>;

export async function markWorkspaceRead(applicationId: string, userId: string) {
  await prisma.workspaceReadCursor.upsert({
    where: { applicationId_userId: { applicationId, userId } },
    create: { applicationId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

export async function getUnreadWorkspaceMessageCount(
  userId: string,
  role: string,
  database: WorkspaceMessagesDatabase = prisma,
) {
  const applications =
    role === "BUSINESS"
      ? await database.application.findMany({
        where: {
          problem: { businessProfile: { userId } },
          status: { in: ["PENDING_CONFIRMATION", "SELECTED"] },
        },
        select: { id: true },
      })
      : await database.application.findMany({
        where: {
          status: { in: ["PENDING_CONFIRMATION", "SELECTED"] },
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
  const cursors = await database.workspaceReadCursor.findMany({
    where: { userId, applicationId: { in: applications.map(({ id }) => id) } },
    select: { applicationId: true, lastReadAt: true },
  });
  const cursorMap = new Map(cursors.map((cursor) => [cursor.applicationId, cursor.lastReadAt]));
  const counts = await Promise.all(
    applications.map(({ id }) =>
      database.workspaceMessage
        .findMany({
          where: { applicationId: id, hiddenByAdmin: false },
          select: { senderId: true, createdAt: true },
        })
        .then((messages) =>
          getUnreadMessageCount(messages, userId, cursorMap.get(id) ?? null),
        ),
    ),
  );
  return counts.reduce((total, count) => total + count, 0);
}
