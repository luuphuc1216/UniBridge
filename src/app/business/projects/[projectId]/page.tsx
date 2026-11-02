import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { findAccessibleProject } from "@/lib/project-access";
import { ensurePaidMilestoneReminders } from "@/lib/project-milestone-workflow";
import { ensurePendingProjectChangeRequestReminders } from "@/lib/project-change-requests";
import { prisma } from "@/lib/prisma";
import { getProjectReviewState } from "@/lib/reputation-data";

export const instant = false;

export default async function BusinessProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") notFound();
  const { projectId } = await params;
  const project = await findAccessibleProject(projectId, session.user.id, session.user.role);
  if (!project) notFound();
  await ensurePaidMilestoneReminders(project.id, { database: prisma });
  try {
    await ensurePendingProjectChangeRequestReminders(project.id, { database: prisma });
  } catch (error) {
    console.error("Không thể tạo thông báo nhắc yêu cầu thay đổi dự án:", error);
  }
  const reviewState =
    project.status === "COMPLETED"
      ? await getProjectReviewState(project.id, "BUSINESS_TO_TEAM", project.completedAt)
      : null;

  return (
    <ProjectDetailView
      applicationId={project.applicationId}
      project={project}
      reviewState={reviewState}
      role="BUSINESS"
    />
  );
}
