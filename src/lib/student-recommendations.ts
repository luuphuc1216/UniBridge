import "server-only";
import { recommendationConfig } from "@/lib/recommendation-config";
import {
  scoreRecommendation,
  selectRecommendations,
  type RecommendationHistoryProblem,
  type RecommendationProfile,
  type RecommendationProblem,
} from "@/lib/recommendation-scoring";
import { prisma } from "@/lib/prisma";
import { getTeamReputations } from "@/lib/reputation-data";
import {
  getEffectiveApplicationStatuses,
  PROBLEM_ACCEPTING_APPLICATION_STATUSES,
} from "@/lib/problem-workflow";

function mapHistoryProblem(problem: {
  field: string;
  skills: { skill: { name: string } }[];
}): RecommendationHistoryProblem {
  return {
    field: problem.field,
    skills: problem.skills.map(({ skill }) => skill.name),
  };
}

export async function getStudentRecommendations(userId: string) {
  const [team, studentProfile] = await Promise.all([
    prisma.studentTeam.findUnique({
      where: { ownerId: userId },
      select: {
        id: true,
        interests: true,
        skills: { select: { skill: { select: { name: true } } } },
        memberships: {
          select: {
            major: true,
            studentProfile: { select: { userId: true, major: true } },
          },
        },
      },
    }),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: { major: true },
    }),
  ]);

  if (!team) {
    return { hasTeam: false, recommendations: [] };
  }
  const reputation = (await getTeamReputations([team.id])).get(team.id);

  const memberUserIds = [
    ...new Set([
      userId,
      ...team.memberships
        .map((membership) => membership.studentProfile?.userId)
        .filter((memberId): memberId is string => Boolean(memberId)),
    ]),
  ];
  const majors = [
    studentProfile?.major ?? "",
    ...team.memberships.flatMap((membership) => [
      membership.major,
      membership.studentProfile?.major ?? "",
    ]),
  ].filter(Boolean);
  const profileSkills = team.skills.map(({ skill }) => skill.name);

  const [problems, viewLogs, savedProblems, searchLogs, applications] = await Promise.all([
    prisma.problem.findMany({
      where: {
        status: { in: [...PROBLEM_ACCEPTING_APPLICATION_STATUSES] },
        applications: {
          none: { teamId: team.id, status: { in: getEffectiveApplicationStatuses() } },
        },
      },
      select: {
        id: true,
        title: true,
        field: true,
        description: true,
        expectedDuration: true,
        budgetMin: true,
        budgetMax: true,
        createdAt: true,
        businessProfile: { select: { companyName: true } },
        skills: { select: { skill: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.viewLog.findMany({
      where: { userId: { in: memberUserIds } },
      select: {
        problem: {
          select: {
            field: true,
            skills: { select: { skill: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: recommendationConfig.historyLimit,
    }),
    prisma.savedProblem.findMany({
      where: { userId: { in: memberUserIds } },
      select: {
        problem: {
          select: {
            field: true,
            skills: { select: { skill: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: recommendationConfig.historyLimit,
    }),
    prisma.searchLog.findMany({
      where: { userId: { in: memberUserIds } },
      select: { field: true, skill: true, query: true },
      orderBy: { createdAt: "desc" },
      take: recommendationConfig.historyLimit,
    }),
    prisma.application.findMany({
      where: { teamId: team.id },
      select: {
        problem: {
          select: {
            field: true,
            skills: { select: { skill: { select: { name: true } } } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: recommendationConfig.historyLimit,
    }),
  ]);

  const profile: RecommendationProfile = {
    majors: [...new Set(majors)],
    skills: profileSkills,
    interests: team.interests
      .split(/[,;\n]/)
      .map((interest) => interest.trim())
      .filter(Boolean),
    viewedProblems: viewLogs.map(({ problem }) => mapHistoryProblem(problem)),
    savedProblems: savedProblems.map(({ problem }) => mapHistoryProblem(problem)),
    searchedFields: searchLogs.flatMap(({ field }) => (field ? [field] : [])),
    searchedSkills: searchLogs.flatMap(({ skill }) => (skill ? [skill] : [])),
    searchQueries: searchLogs.map(({ query }) => query).filter(Boolean),
    appliedProblems: applications.map(({ problem }) => mapHistoryProblem(problem)),
    ratingAverage: reputation?.ratingAverage ?? 0,
    ratingCount: reputation?.ratingCount ?? 0,
  };

  const scored = problems.map((problem) => {
    const recommendationProblem: RecommendationProblem = {
      id: problem.id,
      title: problem.title,
      field: problem.field,
      skills: problem.skills.map(({ skill }) => skill.name),
      createdAt: problem.createdAt,
    };
    return scoreRecommendation(recommendationProblem, profile);
  });
  const { recommendations: selected, usedFallback } = selectRecommendations(scored);
  const recommendationCards = selected.map(({ problem, reasons }) => {
    const problemDetails = problems.find(({ id }) => id === problem.id);
    if (!problemDetails) {
      throw new Error(`Không tìm thấy dữ liệu Problem được gợi ý: ${problem.id}`);
    }
    return {
      id: problem.id,
      title: problem.title,
      field: problem.field,
      description: problemDetails.description,
      expectedDuration: problemDetails.expectedDuration,
      budgetMin: problemDetails.budgetMin,
      budgetMax: problemDetails.budgetMax,
      companyName: problemDetails.businessProfile.companyName,
      skills: problem.skills,
      reasons,
      isNew: usedFallback,
    };
  });

  return {
    hasTeam: true,
    recommendations: recommendationCards,
  };
}
