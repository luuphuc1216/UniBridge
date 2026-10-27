import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { findAuthorizedWorkspace } from "@/lib/workspace-access";
import { canRespondForTeam } from "@/lib/team-permissions";

export const instant = false;

export default async function StudentWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    notFound();
  }
  const { id } = await params;
  const { applicationId } = await searchParams;
  const problem = await findAuthorizedWorkspace(
    id,
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
          trialBriefLockedAt: problem.trialBriefLockedAt,
          prototypeLegacy: problem.prototypeLegacy,
          canRespondToTrialBrief: canRespondForTeam(application.team.ownerId, session.user.id),
        },
        trialBriefVersions: problem.trialBriefVersions,
        messages: problem.workspaceMessages,
        proposals: application.proposals,
        project: application.project,
        isBusiness: false,
      }}
    />
  );
}
