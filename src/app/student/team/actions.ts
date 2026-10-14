"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/student-access";

export type TeamProfileActionState = { error: string | null };

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseMembers(value: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const members: { name: string; major: string }[] = [];
  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    members.push({ name: parts[0], major: parts[1] });
  }
  return members;
}

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

export async function saveTeamProfileAction(
  _previousState: TeamProfileActionState,
  formData: FormData,
): Promise<TeamProfileActionState> {
  const { userId } = await requireStudent();
  const name = readText(formData, "name");
  const university = readText(formData, "university");
  const description = readText(formData, "description");
  const memberText = readText(formData, "members");
  const members = parseMembers(memberText);
  const experience = readText(formData, "experience");
  const relevantProducts = readText(formData, "relevantProducts");
  const achievements = readText(formData, "achievements");
  const interests = readText(formData, "interests");
  const skills = [
    ...new Set(
      readText(formData, "skills")
        .split(/\r?\n|,/)
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ];

  if (!name || !university || !description) {
    return { error: "Vui lòng nhập tên nhóm, trường và giới thiệu nhóm." };
  }
  if (!members) {
    return { error: "Mỗi thành viên cần nhập đúng định dạng: Tên thành viên | Chuyên ngành." };
  }
  if (members.length === 0) {
    return { error: "Hãy thêm ít nhất một thành viên kèm chuyên ngành." };
  }
  if (
    name.length > 100 ||
    university.length > 160 ||
    description.length > 3000 ||
    memberText.length > 4000 ||
    members.length > 20 ||
    members.some(({ name: memberName, major }) => memberName.length > 120 || major.length > 160) ||
    skills.length > 30 ||
    skills.some((skill) => skill.length > 80) ||
    [experience, relevantProducts, achievements, interests].some((value) => value.length > 4000)
  ) {
    return { error: "Một số trường trong hồ sơ vượt quá giới hạn độ dài hoặc số lượng cho phép." };
  }

  try {
    const existingTeam = await prisma.studentTeam.findUnique({
      where: { ownerId: userId },
    });
    const teamId = existingTeam?.id;
    const slug = existingTeam?.slug ?? `${toSlug(name) || "nhom-sinh-vien"}-${userId.slice(-8)}`;

    await prisma.$transaction(async (transaction) => {
      const team = teamId
        ? await transaction.studentTeam.update({
            where: { id: teamId, ownerId: userId },
            data: {
              name,
              university,
              description,
              experience,
              relevantProducts,
              achievements,
              interests,
            },
          })
        : await transaction.studentTeam.create({
            data: {
              ownerId: userId,
              name,
              slug,
              university,
              description,
              experience,
              relevantProducts,
              achievements,
              interests,
            },
          });

      await transaction.teamMembership.deleteMany({ where: { teamId: team.id } });
      await transaction.teamSkill.deleteMany({ where: { teamId: team.id } });
      for (const skillName of skills) {
        const skill = await transaction.skill.upsert({
          where: { name: skillName },
          update: {},
          create: { name: skillName },
        });
        await transaction.teamSkill.create({
          data: { teamId: team.id, skillId: skill.id },
        });
      }
      await transaction.teamMembership.createMany({
        data: members.map((member, index) => ({
          teamId: team.id,
          studentProfileId: null,
          name: member.name,
          major: member.major,
          title: index === 0 ? "Trưởng nhóm" : "Thành viên",
          isLead: index === 0,
        })),
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    console.error("Lưu hồ sơ nhóm thất bại:", error);
    return { error: "Không thể lưu hồ sơ nhóm. Vui lòng thử lại." };
  }

  revalidatePath("/student/team");
  revalidatePath("/student/problems");
  revalidatePath("/student/applications");
  revalidatePath("/business/problems");
  return { error: null };
}
