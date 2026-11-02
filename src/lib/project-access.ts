import type { PrismaClient } from "@/generated/prisma/client";

type ProjectAccessDatabase = Pick<PrismaClient, "project">;

export async function findAccessibleProject(
  projectId: string,
  userId: string,
  role: string,
  database?: ProjectAccessDatabase,
) {
  if (role !== "BUSINESS" && role !== "STUDENT" && role !== "ADMIN") {
    return null;
  }

  const projectDatabase = database ?? (await import("@/lib/prisma")).prisma;
  // Read access is shared with team members for now; finer-grained permissions come later.
  return projectDatabase.project.findFirst({
    where: {
      id: projectId,
      ...(role === "ADMIN"
        ? {}
        : role === "BUSINESS"
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
          progressUpdates: {
            orderBy: { createdAt: "desc" },
            include: { createdBy: { select: { name: true } } },
          },
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
      agreementVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        include: { milestone: { select: { id: true, title: true } } },
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
