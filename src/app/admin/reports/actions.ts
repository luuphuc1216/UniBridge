"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { updateReport, reportStatuses, type ReportStatus } from "@/lib/reports";

export async function updateReportAction(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const reportId = formData.get("reportId");
  const status = formData.get("status");
  const reason = formData.get("reason");
  const hideContent = formData.get("hideContent") === "on";
  if (
    typeof reportId !== "string" ||
    typeof status !== "string" ||
    !reportStatuses.includes(status as ReportStatus) ||
    typeof reason !== "string" ||
    reason.trim().length === 0 ||
    reason.trim().length > 500
  ) {
    redirect("/admin/reports?result=invalid");
  }

  const result = await updateReport(prisma, {
    actorId: userId,
    reportId,
    nextStatus: status as ReportStatus,
    reason,
    hideContent,
  });
  if (result === "updated") {
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/reports/${reportId}`);
    redirect("/admin/reports?result=updated");
  }
  redirect(`/admin/reports?result=${result}`);
}
