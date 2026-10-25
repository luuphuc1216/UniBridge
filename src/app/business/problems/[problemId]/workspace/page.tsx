import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";

export const instant = false;

export default async function BusinessWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ problemId: string }>;
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") {
    notFound();
  }
  const { problemId } = await params;
  const { applicationId } = await searchParams;
  const problem = await findAuthorizedWorkspace(
    problemId,
    session.user.id,
    session.user.role,
    applicationId,
  );
  const application = problem?.applications[0];
  if (!problem || !application) {
    notFound();
  }

  return (
    <WorkspaceView
      data={{
        problem: {
          id: problem.id,
          title: problem.title,
          status: problem.status,
          description: problem.description,
          goal: problem.goal,
          companyName: problem.businessProfile.companyName,
          teamName: application.team.name,
          applicationId: application.id,
        },
        messages: problem.workspaceMessages,
        proposals: application.proposals,
        project: application.project,
        isBusiness: true,
      }}
    />
  );
}
