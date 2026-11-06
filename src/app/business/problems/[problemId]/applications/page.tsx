import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationComparison } from "@/components/business/application-comparison";
import { displayApplicationsWhere } from "@/lib/application-visibility";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { getTeamReputations } from "@/lib/reputation-data";
import { expireInvitations } from "@/jobs/expire-invitations";
import { getAiUsageRemaining } from "@/lib/ai/usage";
import { scoreTeamForProblem } from "@/lib/recommendation-scoring";

export const instant = false;

function getProfileSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as {
    name?: string;
    university?: string;
    description?: string;
    experience?: string;
    relevantProducts?: string;
    achievements?: string;
    interests?: string;
    skills?: string[];
    members?: { name: string; major: string; title?: string; isLead?: boolean }[];
  };
}

export default async function BusinessProblemApplicationsPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  const { businessProfileId } = await requireBusinessProfile();
  await expireInvitations();
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, businessProfileId },
    include: {
      skills: { include: { skill: { select: { name: true } } } },
      applications: {
        where: displayApplicationsWhere,
        orderBy: { submittedAt: "asc" },
        include: {
          invitations: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              expiresAt: true,
              status: true,
              responseReason: true,
            },
          },
          team: {
            include: {
              skills: { include: { skill: { select: { name: true } } } },
              memberships: { orderBy: [{ isLead: "desc" }, { joinedAt: "asc" }] },
              projects: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (
    !problem ||
    !["APPROVED", "PUBLISHED", "TEAM_SELECTED", "PROTOTYPING", "EVALUATING"].includes(
      problem.status,
    )
  ) {
    notFound();
  }

  const reputations = await getTeamReputations(
    problem.applications.map(({ team }) => team.id),
  );
  const hasPendingInvitation = problem.applications.some((application) =>
    application.invitations.some(({ status }) => status === "PENDING_CONFIRMATION"),
  );
  const applications = problem.applications.map((application) => {
    const snapshot = getProfileSnapshot(application.profileSnapshot);
    const recommendation = scoreTeamForProblem(
      {
        id: problem.id,
        title: problem.title,
        field: problem.field,
        skills: problem.skills.map(({ skill }) => skill.name),
        createdAt: problem.createdAt,
      },
      {
        id: application.team.id,
        name: application.team.name,
        majors: (snapshot?.members ?? application.team.memberships)
          .map(({ major }) => major)
          .filter(Boolean),
        skills: snapshot?.skills ?? application.team.skills.map(({ skill }) => skill.name),
        interests: (snapshot?.interests ?? application.team.interests).split(/[,;\n]/).filter(Boolean),
        createdAt: application.submittedAt,
      },
    );
    return {
    id: application.id,
    approach: application.approach,
    problemUnderstanding: application.problemUnderstanding,
    solutionDirection: application.solutionDirection,
    methodology: application.methodology,
    keySteps: application.keySteps,
    tools: application.tools,
    resources: application.resources,
    estimatedDuration: application.estimatedDuration,
    proposedBudget: application.proposedBudget,
    status: application.status,
    needsReview: application.needsReview,
    businessReviewNote: application.businessReviewNote,
    invitation: application.invitations[0] ?? null,
    approachLinks: application.approachLinks,
    team: {
      id: application.team.id,
      name: snapshot?.name ?? application.team.name,
      university: snapshot?.university ?? application.team.university,
      description: snapshot?.description ?? application.team.description,
      experience: snapshot?.experience ?? application.team.experience,
      relevantProducts: snapshot?.relevantProducts ?? application.team.relevantProducts,
      achievements: snapshot?.achievements ?? application.team.achievements,
      interests: snapshot?.interests ?? application.team.interests,
      reputation: reputations.get(application.team.id),
      skills: snapshot?.skills ?? application.team.skills.map(({ skill }) => skill.name),
      members: snapshot?.members?.map(({ name, major }) => ({ name, major })) ??
        application.team.memberships.map(({ name, major }) => ({ name, major })),
      projects: application.team.projects,
    },
    recommendationScore: recommendation.score,
    recommendationReasons: recommendation.reasons,
  };
  });
  applications.sort((left, right) => right.recommendationScore - left.recommendationScore);
  const aiRemaining = await getAiUsageRemaining(prisma, businessProfileId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href={`/business/problems/${problem.id}`}
      >
        ← Chi tiết bài toán
      </Link>
      <p className="mt-4 text-sm font-semibold text-primary">{problem.field}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">So sánh nhóm ứng tuyển</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{problem.title}</p>
      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
        So sánh hồ sơ theo kỹ năng, chuyên môn, kinh nghiệm, Approach, Reputation,
        thời gian và chi phí. Việc chọn nhóm sẽ kết thúc nhận hồ sơ cho bài toán này.
      </div>
      <section className="mt-6">
        <ApplicationComparison
          applications={applications}
          problemId={problem.id}
          problemSkills={problem.skills.map(({ skill }) => skill.name)}
          problemStatus={problem.status}
          hasPendingInvitation={hasPendingInvitation}
          aiRemaining={aiRemaining}
        />
      </section>
    </main>
  );
}
