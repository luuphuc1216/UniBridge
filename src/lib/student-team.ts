import { prisma } from "@/lib/prisma";
export { canRespondForTeam } from "./team-permissions";

export async function getOwnedTeam(userId: string) {
  const team = await prisma.studentTeam.findUnique({
    where: { ownerId: userId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      slug: true,
      university: true,
      description: true,
      experience: true,
      relevantProducts: true,
      achievements: true,
      interests: true,
      memberships: {
        orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }],
        select: {
          studentProfileId: true,
          name: true,
          major: true,
          title: true,
          isLead: true,
        },
      },
      skills: { select: { skill: { select: { name: true } } } },
      portfolioItems: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, description: true, demoUrl: true, field: true, isVisible: true, fileName: true, fileStorageKey: true },
      },
    },
  });
  if (!team) return null;

  return {
    ...team,
    memberships: team.memberships.map(({ studentProfileId, ...membership }) => ({
      ...membership,
      isLinked: studentProfileId !== null,
    })),
  };
}

export async function requireOwnedTeam(userId: string) {
  const team = await getOwnedTeam(userId);
  if (!team) {
    throw new Error("Bạn cần tạo hồ sơ nhóm trước.");
  }

  return team;
}

export function getTeamForUser(userId: string) {
  return prisma.studentTeam.findFirst({
    where: {
      OR: [
        { ownerId: userId },
        { memberships: { some: { studentProfile: { userId } } } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      name: true,
      university: true,
      description: true,
      experience: true,
      relevantProducts: true,
      achievements: true,
      interests: true,
      memberships: {
        orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }],
        select: { name: true, major: true, title: true, isLead: true },
      },
      skills: { select: { skill: { select: { name: true } } } },
    },
  });
}
