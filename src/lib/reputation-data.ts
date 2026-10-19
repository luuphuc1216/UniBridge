import { prisma } from "@/lib/prisma";
import {
  calculateTeamReputation,
  type TeamReputation,
} from "@/lib/reputation";
import { reputationConfig, type ReviewDirection } from "@/lib/reputation-config";

const businessToTeam = "BUSINESS_TO_TEAM" satisfies ReviewDirection;
const teamToBusiness = "TEAM_TO_BUSINESS" satisfies ReviewDirection;

export type PublicReview = {
  id: string;
  direction: ReviewDirection;
  rating: number;
  criteriaScores: Record<string, number>;
  content: string;
  reviewerLabel: string;
  createdAt: Date;
};

export type ReviewPage = {
  reviews: PublicReview[];
  page: number;
  pageCount: number;
  totalCount: number;
};

export type TeamHistoryEntry = {
  id: string;
  label: string;
  date: Date;
};

export type ProjectReviewState = {
  hasSubmitted: boolean;
  publicReviews: PublicReview[];
};

function deadlineFor(completedAt: Date): Date {
  return new Date(
    completedAt.getTime() + reputationConfig.reviewVisibilityDelayDays * 86_400_000,
  );
}

function parseCriteriaScores(value: string): Record<string, number> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Dữ liệu tiêu chí đánh giá không hợp lệ.");
  }
  const criteriaScores: Record<string, number> = {};
  for (const [key, score] of Object.entries(parsed)) {
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error("Dữ liệu tiêu chí đánh giá không hợp lệ.");
    }
    criteriaScores[key] = score;
  }
  return criteriaScores;
}

function toPublicReview(review: {
  id: string;
  direction: string;
  rating: number;
  criteriaScores: string;
  content: string;
  createdAt: Date;
  reviewerLabel: string;
}): PublicReview {
  if (review.direction !== businessToTeam && review.direction !== teamToBusiness) {
    throw new Error("Chiều đánh giá không hợp lệ.");
  }
  return {
    id: review.id,
    direction: review.direction,
    rating: review.rating,
    criteriaScores: parseCriteriaScores(review.criteriaScores),
    content: review.content,
    reviewerLabel: review.reviewerLabel,
    createdAt: review.createdAt,
  };
}

function visibleReviewFilter(now: Date, oppositeDirection: ReviewDirection) {
  const deadline = new Date(
    now.getTime() - reputationConfig.reviewVisibilityDelayDays * 86_400_000,
  );
  return {
    status: "COMPLETED",
    OR: [
      { completedAt: { lte: deadline } },
      { reviews: { some: { direction: oppositeDirection } } },
    ],
  };
}

export async function getTeamReputations(teamIds: string[]): Promise<Map<string, TeamReputation>> {
  const uniqueTeamIds = [...new Set(teamIds)];
  if (uniqueTeamIds.length === 0) return new Map();
  const now = new Date();
  const [reviews, projects, transactions] = await Promise.all([
    prisma.review.findMany({
      where: {
        reviewedTeamId: { in: uniqueTeamIds },
        direction: businessToTeam,
        project: visibleReviewFilter(now, teamToBusiness),
      },
      select: { reviewedTeamId: true, rating: true },
    }),
    prisma.project.findMany({
      where: {
        teamId: { in: uniqueTeamIds },
        OR: [
          { status: "COMPLETED" },
          {
            status: "CANCELLED",
            transactions: {
              some: { type: "DEPOSIT", paidAt: { not: null } },
            },
          },
        ],
      },
      select: {
        teamId: true,
        status: true,
        transactions: {
          where: { type: "DEPOSIT", paidAt: { not: null } },
          select: { id: true },
        },
        milestones: {
          select: { dueAt: true, acceptedAt: true, submittedAt: true },
        },
      },
    }),
    prisma.projectTransaction.findMany({
      where: {
        paidAt: { not: null },
        project: { teamId: { in: uniqueTeamIds } },
      },
      select: { project: { select: { teamId: true } } },
    }),
  ]);

  return new Map(
    uniqueTeamIds.map((teamId) => {
      const teamReviews = reviews.filter((review) => review.reviewedTeamId === teamId);
      const teamProjects = projects
        .filter((project) => project.teamId === teamId)
        .map((project) => ({
          status: project.status,
          hasPaidDeposit: project.transactions.length > 0,
          milestones: project.milestones,
        }));
      const transactionCount = transactions.filter(
        ({ project }) => project.teamId === teamId,
      ).length;
      return [
        teamId,
        calculateTeamReputation({
          reviews: teamReviews,
          projects: teamProjects,
          transactionCount,
        }),
      ];
    }),
  );
}

export async function getTeamHistory(teamId: string): Promise<TeamHistoryEntry[]> {
  const [projects, closedApplications] = await Promise.all([
    prisma.project.findMany({
      where: {
        teamId,
        OR: [
          { status: "COMPLETED" },
          {
            status: "CANCELLED",
            transactions: {
              some: { type: "DEPOSIT", paidAt: { not: null } },
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        completedAt: true,
        cancelledAt: true,
        transactions: {
          where: { paidAt: { not: null } },
          select: { id: true, type: true, status: true, paidAt: true },
          orderBy: { paidAt: "desc" },
        },
      },
    }),
    prisma.application.findMany({
      where: {
        teamId,
        status: "SELECTED",
        problem: { status: "CLOSED" },
        proposals: { some: { status: "NOT_IMPLEMENTED" } },
      },
      select: {
        id: true,
        problem: { select: { updatedAt: true } },
      },
    }),
  ]);

  return [
    ...projects.flatMap((project) => {
      const outcome = {
        id: `${project.id}-outcome`,
        label:
          project.status === "COMPLETED"
            ? "Dự án hoàn thành"
            : "Dự án hủy sau khi nạp tiền",
        date:
          project.completedAt ??
          project.cancelledAt ??
          (() => {
            throw new Error("Thiếu thời điểm kết thúc trong lịch sử dự án.");
          })(),
      };
      const transactions = project.transactions.flatMap((transaction) => {
        if (!transaction.paidAt) {
          throw new Error("Thiếu thời điểm ghi nhận giao dịch.");
        }
        const label =
          transaction.type === "DEPOSIT"
            ? "Khoản nạp giả lập đã ghi nhận"
            : transaction.type === "MILESTONE_RELEASE"
              ? "Giải ngân Milestone đã ghi nhận"
              : "Giao dịch dự án đã ghi nhận";
        return [{
          id: transaction.id,
          label: `${label} · ${transaction.status === "RELEASED" ? "Đã giải ngân" : "Đã ghi nhận"}`,
          date: transaction.paidAt,
        }];
      });
      return [...transactions, outcome];
    }),
    ...closedApplications.map((application) => ({
      id: `not-implemented-${application.id}`,
      label: "Không triển khai (không tính vào tỷ lệ hoàn thành)",
      date: application.problem.updatedAt,
    })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime());
}

export async function getTeamReviewPage(
  teamId: string,
  requestedPage: number,
): Promise<ReviewPage> {
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const now = new Date();
  const where = {
    reviewedTeamId: teamId,
    direction: businessToTeam,
    project: visibleReviewFilter(now, teamToBusiness),
  };
  const totalCount = await prisma.review.count({ where });
  const pageCount = Math.max(1, Math.ceil(totalCount / reputationConfig.reviewsPerPage));
  const safePage = Math.min(page, pageCount);
  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * reputationConfig.reviewsPerPage,
    take: reputationConfig.reviewsPerPage,
    select: {
      id: true,
      direction: true,
      rating: true,
      criteriaScores: true,
      content: true,
      createdAt: true,
      project: {
        select: {
          application: {
            select: {
              problem: {
                select: {
                  businessProfile: { select: { companyName: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return {
    reviews: reviews.map((review) =>
      toPublicReview({
        ...review,
        reviewerLabel: review.project.application.problem.businessProfile.companyName,
      }),
    ),
    page: safePage,
    pageCount,
    totalCount,
  };
}

export async function getBusinessReviewPage(
  businessProfileId: string,
  requestedPage: number,
): Promise<ReviewPage> {
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const now = new Date();
  const where = {
    reviewedBusinessProfileId: businessProfileId,
    direction: teamToBusiness,
    project: visibleReviewFilter(now, businessToTeam),
  };
  const totalCount = await prisma.review.count({ where });
  const pageCount = Math.max(1, Math.ceil(totalCount / reputationConfig.reviewsPerPage));
  const safePage = Math.min(page, pageCount);
  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * reputationConfig.reviewsPerPage,
    take: reputationConfig.reviewsPerPage,
    select: {
      id: true,
      direction: true,
      rating: true,
      criteriaScores: true,
      content: true,
      createdAt: true,
      reviewedTeam: { select: { name: true } },
    },
  });
  return {
    reviews: reviews.map((review) =>
      toPublicReview({
        ...review,
        reviewerLabel: review.reviewedTeam?.name ?? "Nhóm sinh viên",
      }),
    ),
    page: safePage,
    pageCount,
    totalCount,
  };
}

export async function getProjectReviewState(
  projectId: string,
  direction: ReviewDirection,
  completedAt: Date | null,
): Promise<ProjectReviewState> {
  const ownReview = await prisma.review.findUnique({
    where: { projectId_direction: { projectId, direction } },
    select: { id: true },
  });
  const hasSubmitted = Boolean(ownReview);
  if (!completedAt) return { hasSubmitted, publicReviews: [] };

  const releasedByTime = new Date() >= deadlineFor(completedAt);
  if (!releasedByTime && !hasSubmitted) {
    return { hasSubmitted: false, publicReviews: [] };
  }

  if (!releasedByTime) {
    const oppositeDirection =
      direction === businessToTeam ? teamToBusiness : businessToTeam;
    const oppositeReview = await prisma.review.findUnique({
      where: {
        projectId_direction: {
          projectId,
          direction: oppositeDirection,
        },
      },
      select: { id: true },
    });
    if (!oppositeReview) return { hasSubmitted: true, publicReviews: [] };
  }

  const reviews = await prisma.review.findMany({
    where: { projectId, direction: { in: [businessToTeam, teamToBusiness] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      direction: true,
      rating: true,
      criteriaScores: true,
      content: true,
      createdAt: true,
      reviewedTeam: { select: { name: true } },
      reviewedBusinessProfile: { select: { companyName: true } },
    },
  });
  return {
    hasSubmitted,
    publicReviews: reviews.map((review) =>
      toPublicReview({
        ...review,
        reviewerLabel:
          review.direction === businessToTeam
            ? review.reviewedBusinessProfile?.companyName ?? "Doanh nghiệp"
            : review.reviewedTeam?.name ?? "Nhóm sinh viên",
      }),
    ),
  };
}
