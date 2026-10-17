import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { findAccessibleProject } from "@/lib/project-access";

export const instant = false;

export default async function StudentProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") notFound();
  const { projectId } = await params;
  const project = await findAccessibleProject(projectId, session.user.id, session.user.role);
  if (!project) notFound();

  return <ProjectDetailView project={project} role="STUDENT" />;
}
