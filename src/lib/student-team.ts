import { prisma } from "@/lib/prisma";

export function getOwnedTeam(userId: string) {
  return prisma.studentTeam.findUnique({
    where: { ownerId: userId },
    include: {
      memberships: { orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }] },
      skills: { include: { skill: { select: { name: true } } } },
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
