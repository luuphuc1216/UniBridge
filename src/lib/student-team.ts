import { prisma } from "@/lib/prisma";

export function getOwnedTeam(userId: string) {
  return prisma.studentTeam.findUnique({
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
        select: { name: true, major: true, title: true, isLead: true },
      },
      skills: { select: { skill: { select: { name: true } } } },
    },
  });
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
