import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { findAccessibleProject } from "@/lib/project-access";
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
