"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/student-access";
import { saveTeamProfileCore } from "@/lib/team-profile-core";

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
    await saveTeamProfileCore(userId, {
      name,
      university,
      description,
      experience,
      relevantProducts,
      achievements,
      interests,
      members,
      skills,
    }, prisma);
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
