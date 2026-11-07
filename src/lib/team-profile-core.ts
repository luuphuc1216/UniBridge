import type { PrismaClient } from "@/generated/prisma/client";

type TeamProfileDatabase = Pick<PrismaClient, "$transaction">;

export type TeamProfileMemberInput = {
  name: string;
  major: string;
};

export type TeamProfileInput = {
  name: string;
  university: string;
  description: string;
  experience: string;
  relevantProducts: string;
  achievements: string;
  interests: string;
  members: TeamProfileMemberInput[];
  skills: string[];
};

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getMemberKey({ name, major }: TeamProfileMemberInput): string {
  return `${name.trim().toLocaleLowerCase("vi-VN")}\0${major.trim().toLocaleLowerCase("vi-VN")}`;
}

export async function saveTeamProfileCore(
  userId: string,
  input: TeamProfileInput,
  database: TeamProfileDatabase,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const existingTeam = await transaction.studentTeam.findUnique({
      where: { ownerId: userId },
      select: { id: true, slug: true },
    });
    const existingMembership = existingTeam
      ? null
      : await transaction.teamMembership.findFirst({
          where: { studentProfile: { userId } },
          select: { id: true },
        });
    if (existingMembership) {
      throw new Error("Bạn đã là thành viên của một nhóm và không thể tạo hồ sơ nhóm mới.");
    }

    const existingLinkedMemberships = existingTeam
      ? await transaction.teamMembership.findMany({
          where: { teamId: existingTeam.id, studentProfileId: { not: null } },
          select: { id: true, isLead: true },
        })
      : [];
    const existingDisplayMemberships = existingTeam
      ? await transaction.teamMembership.findMany({
          where: { teamId: existingTeam.id, studentProfileId: null },
          orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }],
          select: { id: true },
        })
      : [];

    if (existingLinkedMemberships.length + input.members.length > 20) {
      throw new Error("Một số trường trong hồ sơ vượt quá giới hạn độ dài hoặc số lượng cho phép.");
    }
    if (existingLinkedMemberships.length === 0 && input.members.length === 0) {
      throw new Error("Hãy thêm ít nhất một thành viên kèm chuyên ngành.");
    }
    if (new Set(input.members.map(getMemberKey)).size !== input.members.length) {
      throw new Error("Danh sách thành viên không được có dòng trùng lặp.");
    }

    const team = existingTeam
      ? await transaction.studentTeam.update({
          where: { id: existingTeam.id, ownerId: userId },
          data: {
            name: input.name,
            university: input.university,
            description: input.description,
            experience: input.experience,
            relevantProducts: input.relevantProducts,
            achievements: input.achievements,
            interests: input.interests,
          },
        })
      : await transaction.studentTeam.create({
          data: {
            ownerId: userId,
            name: input.name,
            slug: `${toSlug(input.name) || "nhom-sinh-vien"}-${userId.slice(-8)}`,
            university: input.university,
            description: input.description,
            experience: input.experience,
            relevantProducts: input.relevantProducts,
            achievements: input.achievements,
            interests: input.interests,
          },
        });

    const hasLinkedLead = existingLinkedMemberships.some(({ isLead }) => isLead);
    for (const [index, member] of input.members.entries()) {
      const membershipData = {
        name: member.name,
        major: member.major,
        title: !hasLinkedLead && index === 0 ? "Trưởng nhóm" : "Thành viên",
        isLead: !hasLinkedLead && index === 0,
      };
      const existingDisplayMembership = existingDisplayMemberships[index];

      if (existingDisplayMembership) {
        const updated = await transaction.teamMembership.updateMany({
          where: {
            id: existingDisplayMembership.id,
            teamId: team.id,
            studentProfileId: null,
          },
          data: membershipData,
        });
        if (updated.count !== 1) {
          throw new Error("Danh sách thành viên đã thay đổi. Vui lòng tải lại trang.");
        }
      } else {
        await transaction.teamMembership.create({
          data: {
            teamId: team.id,
            studentProfileId: null,
            ...membershipData,
          },
        });
      }
    }

    const removedDisplayMemberships = existingDisplayMemberships.slice(input.members.length);
    if (removedDisplayMemberships.length > 0) {
      const removed = await transaction.teamMembership.deleteMany({
        where: {
          teamId: team.id,
          studentProfileId: null,
          id: { in: removedDisplayMemberships.map(({ id }) => id) },
        },
      });
      if (removed.count !== removedDisplayMemberships.length) {
        throw new Error("Danh sách thành viên đã thay đổi. Vui lòng tải lại trang.");
      }
    }

    await transaction.teamSkill.deleteMany({ where: { teamId: team.id } });
    for (const skillName of input.skills) {
      const skill = await transaction.skill.upsert({
        where: { name: skillName },
        update: {},
        create: { name: skillName },
      });
      await transaction.teamSkill.create({
        data: { teamId: team.id, skillId: skill.id },
      });
    }
  });
}
