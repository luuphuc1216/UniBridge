import { Prisma as PrismaNamespace, type PrismaClient } from "@/generated/prisma/client";
import {
  prototypeReminderConfig,
  prototypeReminderDayMs,
} from "@/lib/prototype-reminder-config";
import { prisma } from "@/lib/prisma";

export type PrototypeReminderClock = { now(): Date };
export const systemPrototypeReminderClock: PrototypeReminderClock = {
  now: () => new Date(),
};

type ReminderDatabase = Pick<
  PrismaClient,
  "problem" | "proposalSubmissionAttempt" | "user" | "notification"
>;

type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  href: string;
  dedupeKey: string;
  createdAt: Date;
};

type NotificationWriter = (notification: NotificationInput) => Promise<unknown>;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function writeReminder(
  notification: NotificationInput,
  writer: NotificationWriter,
): Promise<void> {
  try {
    await writer(notification);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error("Không thể tạo thông báo nhắc Prototype:", error);
    }
  }
}

function getElapsedReminderIndex(
  now: Date,
  dueAt: Date,
  intervalMs: number,
  limit: number,
): number | null {
  const elapsed = now.getTime() - dueAt.getTime();
  if (elapsed < 0) return null;
  return Math.min(Math.floor(elapsed / intervalMs), limit - 1);
}

export type WorkspacePrototypeOverdueInput = {
  problem: {
    status: string;
    prototypeLegacy: boolean;
    evaluationResult: string | null;
    implementationDecision: string | null;
  };
  trialBriefVersions: { deadline: Date; lockedAt: Date | null }[];
  proposals: {
    handoffStatus: string;
    submissionAttempts: {
      submittedAt: Date;
      handoffReviews: { result: string; createdAt: Date }[];
    }[];
    evaluations: { evaluationResult: string | null; createdAt: Date }[];
  }[];
};

export type WorkspacePrototypeOverdueStatus = {
  submission: boolean;
  evaluation: boolean;
  implementationDecision: boolean;
};

export function getWorkspacePrototypeOverdueStatus(
  input: WorkspacePrototypeOverdueInput,
  role: "BUSINESS" | "STUDENT",
  now: Date,
): WorkspacePrototypeOverdueStatus {
  const overdue = {
    submission: false,
    evaluation: false,
    implementationDecision: false,
  };
  if (input.problem.prototypeLegacy || input.problem.status === "CLOSED") {
    return overdue;
  }

  if (role === "STUDENT" && input.problem.status === "PROTOTYPING") {
    const hasPendingHandoff = input.proposals.some(
      ({ handoffStatus }) => handoffStatus === "PENDING_REVIEW",
    );
    const latestBrief = input.trialBriefVersions
      .filter(
        (brief): brief is { deadline: Date; lockedAt: Date } =>
          brief.lockedAt !== null,
      )
      .sort((left, right) => right.lockedAt.getTime() - left.lockedAt.getTime())[0];
    overdue.submission =
      !hasPendingHandoff && Boolean(latestBrief && now >= latestBrief.deadline);
  }

  if (
    role === "BUSINESS" &&
    input.problem.status === "EVALUATING" &&
    input.problem.evaluationResult === null
  ) {
    const latestApprovedReview = input.proposals
      .filter(({ handoffStatus }) => handoffStatus === "APPROVED")
      .flatMap(({ submissionAttempts }) =>
        submissionAttempts.flatMap(({ handoffReviews }) => handoffReviews),
      )
      .filter(({ result }) => result === "APPROVED")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    overdue.evaluation = Boolean(
      latestApprovedReview &&
        now.getTime() - latestApprovedReview.createdAt.getTime() >=
          prototypeReminderConfig.businessEvaluationDelayDays *
            prototypeReminderDayMs,
    );
  }

  if (
    role === "BUSINESS" &&
    input.problem.status === "EVALUATING" &&
    input.problem.evaluationResult === "ACCEPTED" &&
    input.problem.implementationDecision === "PENDING"
  ) {
    const acceptedEvaluation = input.proposals
      .flatMap(({ evaluations }) => evaluations)
      .filter(({ evaluationResult }) => evaluationResult === "ACCEPTED")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    overdue.implementationDecision = Boolean(
      acceptedEvaluation &&
        now.getTime() - acceptedEvaluation.createdAt.getTime() >=
          prototypeReminderConfig.implementationDecisionDelayDays *
            prototypeReminderDayMs,
    );
  }

  return overdue;
}

export function isAdminHandoffOverdue(
  problem: { status: string; prototypeLegacy: boolean },
  handoffStatus: string,
  submittedAt: Date,
  now: Date,
): boolean {
  return (
    !problem.prototypeLegacy &&
    problem.status === "PROTOTYPING" &&
    handoffStatus === "PENDING_REVIEW" &&
    now.getTime() - submittedAt.getTime() >=
      prototypeReminderConfig.adminHandoffDelayDays * prototypeReminderDayMs
  );
}

export async function ensureGroupSubmissionReminders(
  problemId: string,
  {
    database = prisma,
    clock = systemPrototypeReminderClock,
    writer = (notification) => database.notification.create({ data: notification }),
  }: {
    database?: ReminderDatabase;
    clock?: PrototypeReminderClock;
    writer?: NotificationWriter;
  } = {},
): Promise<void> {
  const now = clock.now();
  const problem = await database.problem.findFirst({
    where: {
      id: problemId,
      prototypeLegacy: false,
      status: "PROTOTYPING",
    },
    select: {
      id: true,
      title: true,
      trialBriefVersions: {
        where: { lockedAt: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { deadline: true },
      },
      applications: {
        where: { status: "SELECTED" },
        select: {
          id: true,
          team: { select: { ownerId: true } },
          proposals: {
            select: {
              handoffStatus: true,
              submissionAttempts: {
                orderBy: { submittedAt: "desc" },
                take: 1,
                select: { id: true, attempt: true, submittedAt: true },
              },
            },
          },
        },
      },
    },
  });
  const deadline = problem?.trialBriefVersions[0]?.deadline;
  if (!problem || !deadline) return;

  const applications = problem.applications.filter(
    ({ team, proposals }) =>
      team.ownerId !== null &&
      !proposals.some(({ handoffStatus }) => handoffStatus === "PENDING_REVIEW"),
  );
  const reminderIndex = getElapsedReminderIndex(
    now,
    deadline,
    prototypeReminderConfig.groupSubmissionReminderIntervalDays *
      prototypeReminderDayMs,
    prototypeReminderConfig.groupSubmissionReminderLimit,
  );
  if (reminderIndex === null) return;

  for (const application of applications) {
    const teamOwnerId = application.team.ownerId;
    if (!teamOwnerId) continue;
    const latestAttempt = application.proposals
      .flatMap(({ submissionAttempts }) => submissionAttempts)
      .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())[0];
    const attemptKey = latestAttempt
      ? `${latestAttempt.id}-${latestAttempt.attempt}`
      : "no-submission-0";
    await writeReminder(
      {
        userId: teamOwnerId,
        title: "Prototype đã quá hạn nộp",
        message:
          reminderIndex === 0
            ? `Đã quá hạn nộp Proposal cho bài toán “${problem.title}”. Vui lòng cập nhật tiến độ trong không gian làm việc.`
            : `Bài toán “${problem.title}” vẫn chưa có lần nộp Proposal mới sau hạn đã thống nhất.`,
        href: `/student/workspace/${problem.id}?applicationId=${application.id}`,
        dedupeKey: `prototype-submission-overdue-${problem.id}-${attemptKey}-${reminderIndex + 1}-${teamOwnerId}`,
        createdAt: now,
      },
      writer,
    );
  }
}

async function ensureAdminReminderForAttempt(
  attempt: {
    id: string;
    attempt: number;
    submittedAt: Date;
    proposal: {
      handoffStatus: string;
      application: {
        id: string;
        problem: { id: string; title: string; status: string; prototypeLegacy: boolean };
      };
    };
  },
  now: Date,
  database: ReminderDatabase,
  writer: NotificationWriter,
): Promise<void> {
  if (
    !isAdminHandoffOverdue(
      attempt.proposal.application.problem,
      attempt.proposal.handoffStatus,
      attempt.submittedAt,
      now,
    )
  ) {
    return;
  }
  const admins = await database.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  for (const admin of admins) {
    await writeReminder(
      {
        userId: admin.id,
        title: "Bàn giao Prototype đang chờ kiểm tra",
        message: `Đã quá ${prototypeReminderConfig.adminHandoffDelayDays} ngày kể từ lần nộp ${attempt.attempt} cho bài toán “${attempt.proposal.application.problem.title}”.`,
        href: `/admin/prototype-handoffs/${attempt.id}`,
        dedupeKey: `prototype-admin-handoff-${attempt.proposal.application.problem.id}-${attempt.id}-${attempt.attempt}-1-${admin.id}`,
        createdAt: now,
      },
      writer,
    );
  }
}

export async function ensureAdminHandoffReminders(
  {
    attemptId,
    database = prisma,
    clock = systemPrototypeReminderClock,
    writer = (notification) => database.notification.create({ data: notification }),
  }: {
    attemptId?: string;
    database?: ReminderDatabase;
    clock?: PrototypeReminderClock;
    writer?: NotificationWriter;
  } = {},
): Promise<void> {
  const now = clock.now();
  const attempts = await database.proposalSubmissionAttempt.findMany({
    where: {
      ...(attemptId ? { id: attemptId } : {}),
      proposal: {
        is: {
          handoffStatus: "PENDING_REVIEW",
          application: {
            is: {
              status: "SELECTED",
              problem: {
                is: { status: "PROTOTYPING", prototypeLegacy: false },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      attempt: true,
      submittedAt: true,
      proposal: {
        select: {
          handoffStatus: true,
          submissionAttempts: {
            orderBy: { attempt: "desc" },
            take: 1,
            select: { id: true },
          },
          application: {
            select: {
              id: true,
              problem: {
                select: { id: true, title: true, status: true, prototypeLegacy: true },
              },
            },
          },
        },
      },
    },
  });
  for (const attempt of attempts) {
    if (attempt.proposal.submissionAttempts[0]?.id !== attempt.id) continue;
    await ensureAdminReminderForAttempt(attempt, now, database, writer);
  }
}

export async function ensureBusinessPrototypeReminders(
  problemId: string,
  businessUserId: string,
  {
    database = prisma,
    clock = systemPrototypeReminderClock,
    writer = (notification) => database.notification.create({ data: notification }),
  }: {
    database?: ReminderDatabase;
    clock?: PrototypeReminderClock;
    writer?: NotificationWriter;
  } = {},
): Promise<void> {
  const now = clock.now();
  const problem = await database.problem.findFirst({
    where: {
      id: problemId,
      prototypeLegacy: false,
      status: "EVALUATING",
      businessProfile: { is: { userId: businessUserId } },
    },
    select: {
      id: true,
      title: true,
      evaluationResult: true,
      implementationDecision: true,
      businessProfile: { select: { userId: true } },
      applications: {
        where: { status: "SELECTED" },
        select: {
          id: true,
          proposals: {
            select: {
              handoffStatus: true,
              handoffReviews: {
                where: { result: "APPROVED" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, createdAt: true },
              },
              evaluations: {
                where: { evaluationResult: "ACCEPTED" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, createdAt: true },
              },
            },
          },
        },
      },
    },
  });
  if (!problem) return;

  const userId = problem.businessProfile.userId;
  const approvedReview = problem.applications
    .flatMap(({ proposals }) =>
      proposals
        .filter(({ handoffStatus }) => handoffStatus === "APPROVED")
        .flatMap(({ handoffReviews }) => handoffReviews),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

  if (
    problem.evaluationResult === null &&
    approvedReview &&
    now.getTime() - approvedReview.createdAt.getTime() >=
      prototypeReminderConfig.businessEvaluationDelayDays *
        prototypeReminderDayMs
  ) {
    await writeReminder(
      {
        userId,
        title: "Prototype đang chờ doanh nghiệp đánh giá",
        message: `Đã quá ${prototypeReminderConfig.businessEvaluationDelayDays} ngày kể từ khi bàn giao được duyệt cho bài toán “${problem.title}”.`,
        href: `/business/problems/${problem.id}/workspace`,
        dedupeKey: `prototype-business-evaluation-${problem.id}-${approvedReview.id}-1-${userId}`,
        createdAt: now,
      },
      writer,
    );
  }

  if (
    problem.evaluationResult === "ACCEPTED" &&
    problem.implementationDecision === "PENDING"
  ) {
    const acceptedEvaluation = problem.applications
      .flatMap(({ proposals }) =>
        proposals.flatMap(({ evaluations }) => evaluations),
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    if (
      acceptedEvaluation &&
      now.getTime() - acceptedEvaluation.createdAt.getTime() >=
        prototypeReminderConfig.implementationDecisionDelayDays *
          prototypeReminderDayMs
    ) {
      await writeReminder(
        {
          userId,
          title: "Prototype đã được chấp nhận, cần quyết định",
          message: `Đã quá ${prototypeReminderConfig.implementationDecisionDelayDays} ngày kể từ khi chấp nhận Prototype cho bài toán “${problem.title}”.`,
          href: `/business/problems/${problem.id}/workspace`,
          dedupeKey: `prototype-implementation-decision-${problem.id}-${acceptedEvaluation.id}-1-${userId}`,
          createdAt: now,
        },
        writer,
      );
    }
  }
}
