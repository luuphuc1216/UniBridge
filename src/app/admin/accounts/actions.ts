"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-access";
import { changeAccountStatus } from "@/lib/account-lock";
import { prisma } from "@/lib/prisma";

export async function setAccountStatusAction(formData: FormData): Promise<void> {
  const { userId: actorId } = await requireAdmin();
  const targetId = formData.get("userId");
  const desiredStatus = formData.get("status");
  const reason = formData.get("reason");
  if (
    typeof targetId !== "string" ||
    !targetId ||
    (desiredStatus !== "ACTIVE" && desiredStatus !== "LOCKED") ||
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.trim().length > 1000
  ) {
    redirect("/admin/accounts?result=invalid");
  }

  const result = await changeAccountStatus(prisma, {
    actorId,
    targetId,
    desiredStatus,
    reason: reason.trim(),
  });

  if (result === "updated") {
    revalidatePath("/admin/accounts");
    redirect("/admin/accounts?result=updated");
  }
  if (result === "unchanged") redirect("/admin/accounts?result=unchanged");
  redirect(`/admin/accounts?result=${result}`);
}
