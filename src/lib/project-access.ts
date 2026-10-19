import { prisma } from "@/lib/prisma";

export async function findAccessibleProject(
  projectId: string,
  userId: string,
  role: string,
) {
  if (role !== "BUSINESS" && role !== "STUDENT") {
    return null;
  }

  return prisma.project.findFirst({
    where: {
      id: projectId,
      ...(role === "BUSINESS"
        ? { application: { problem: { businessProfile: { userId } } } }
        : {
            team: {
              OR: [
                { ownerId: userId },
                { memberships: { some: { studentProfile: { userId } } } },
              ],
            },
          }),
    },
    include: {
      application: {
        include: {
          problem: {
            select: {
              id: true,
              title: true,
              status: true,
              businessProfile: {
                select: { id: true, userId: true, companyName: true },
              },
            },
          },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          memberships: {
            select: { studentProfile: { select: { userId: true } } },
          },
        },
      },
      milestones: {
        orderBy: { sortOrder: "asc" },
        include: {
          submissions: {
            orderBy: { createdAt: "desc" },
            include: {
              submittedBy: { select: { name: true } },
              files: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
      transactions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export function getProjectTeamUserIds(team: {
  ownerId: string | null;
  memberships: { studentProfile: { userId: string } | null }[];
}): string[] {
  return [
    ...new Set(
      [
        team.ownerId,
        ...team.memberships.map(({ studentProfile }) => studentProfile?.userId),
      ].filter((userId): userId is string => Boolean(userId)),
    ),
  ];
}
