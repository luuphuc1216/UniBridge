import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";

const BASE_TIME = new Date("2026-10-01T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("Prototype reminders", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let ensureGroupSubmissionReminders: typeof import("@/lib/prototype-reminders")["ensureGroupSubmissionReminders"];
  let ensureAdminHandoffReminders: typeof import("@/lib/prototype-reminders")["ensureAdminHandoffReminders"];
  let ensureBusinessPrototypeReminders: typeof import("@/lib/prototype-reminders")["ensureBusinessPrototypeReminders"];
  let getWorkspacePrototypeOverdueStatus: typeof import("@/lib/prototype-reminders")["getWorkspacePrototypeOverdueStatus"];
  let isAdminHandoffOverdue: typeof import("@/lib/prototype-reminders")["isAdminHandoffOverdue"];

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-prototype-reminders-import.db";
    database = await createTestDatabase("unibridge-prototype-reminders");
    ({
      ensureGroupSubmissionReminders,
      ensureAdminHandoffReminders,
      ensureBusinessPrototypeReminders,
      getWorkspacePrototypeOverdueStatus,
      isAdminHandoffOverdue,
    } = await import("@/lib/prototype-reminders"));
    await database.prisma.user.update({
      where: { id: "business-owner" },
      data: { role: "BUSINESS" },
    });
    await database.prisma.user.createMany({
      data: [
        {
          id: "team-owner",
          email: "team-owner@example.com",
          name: "Team owner",
          passwordHash: "test",
          role: "STUDENT",
          updatedAt: BASE_TIME,
        },
        {
          id: "admin-one",
          email: "admin-one@example.com",
          name: "Admin one",
          passwordHash: "test",
          role: "ADMIN",
          updatedAt: BASE_TIME,
        },
        {
          id: "admin-two",
          email: "admin-two@example.com",
          name: "Admin two",
          passwordHash: "test",
          role: "ADMIN",
          updatedAt: BASE_TIME,
        },
        {
          id: "other-business-owner",
          email: "other-business-owner@example.com",
          name: "Other business owner",
          passwordHash: "test",
          role: "BUSINESS",
          updatedAt: BASE_TIME,
        },
        {
          id: "other-team-owner",
          email: "other-team-owner@example.com",
          name: "Other team owner",
          passwordHash: "test",
          role: "STUDENT",
          updatedAt: BASE_TIME,
        },
      ],
    });
    await database.prisma.studentTeam.create({
      data: {
        id: "team",
        ownerId: "team-owner",
        name: "Team",
        slug: "team",
        university: "University",
        description: "Test team",
      },
    });
    await database.prisma.studentTeam.create({
      data: {
        id: "other-team",
        ownerId: "other-team-owner",
        name: "Other team",
        slug: "other-team",
        university: "Other university",
        description: "Other test team",
      },
    });
    await database.prisma.businessProfile.create({
      data: {
        id: "other-business",
        userId: "other-business-owner",
        companyName: "Other business",
        industry: "Technology",
        description: "Other test business",
      },
    });
    await database.prisma.problem.create({
      data: {
        id: "problem",
        businessProfileId: "business",
        title: "Prototype problem",
        slug: "prototype-problem",
        description: "Mô tả bài toán",
        goal: "Mục tiêu",
        field: "Công nghệ",
        requirements: "Yêu cầu",
        expectedDuration: "1 tuần",
        status: "PROTOTYPING",
        prototypeLegacy: false,
        updatedAt: BASE_TIME,
      },
    });
    await database.prisma.application.create({
      data: {
        id: "application",
        problemId: "problem",
        teamId: "team",
        approach: "Hướng giải quyết thử nghiệm",
        estimatedDuration: "1 tuần",
        status: "SELECTED",
        submittedAt: BASE_TIME,
      },
    });
    await database.prisma.application.create({
      data: {
        id: "pending-application",
        problemId: "problem",
        teamId: "other-team",
        approach: "Pending confirmation",
        estimatedDuration: "1 week",
        status: "PENDING_CONFIRMATION",
        submittedAt: BASE_TIME,
      },
    });
    await database.prisma.problem.create({
      data: {
        id: "other-team-problem",
        businessProfileId: "business",
        title: "Other team problem",
        slug: "other-team-problem",
        description: "Other problem",
        goal: "Other goal",
        field: "Technology",
        requirements: "Other requirements",
        expectedDuration: "1 week",
        status: "PROTOTYPING",
        prototypeLegacy: false,
        updatedAt: BASE_TIME,
      },
    });
    await database.prisma.application.create({
      data: {
        id: "other-team-selected-application",
        problemId: "other-team-problem",
        teamId: "other-team",
        approach: "Other selected application",
        estimatedDuration: "1 week",
        status: "SELECTED",
        submittedAt: BASE_TIME,
      },
    });
    await database.prisma.trialBriefVersion.create({
      data: {
        id: "brief",
        problemId: "problem",
        version: 1,
        objective: "Objective",
        scope: "Scope",
        deliverables: "Deliverables",
        deadline: BASE_TIME,
        evaluationCriteria: "Criteria",
        maxRevisionRequests: 2,
        confidentialityTerms: "Confidential",
        ownershipTerms: "Ownership",
        createdByUserId: "business-owner",
        createdAt: BASE_TIME,
        lockedAt: BASE_TIME,
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  async function createProposal({
    handoffStatus = "PENDING_REVIEW",
    submittedAt = BASE_TIME,
    attempt = 1,
    id = `attempt-${attempt}`,
  }: {
    handoffStatus?: string;
    submittedAt?: Date;
    attempt?: number;
    id?: string;
  } = {}) {
    const proposalId = `proposal-${id}`;
    await database.prisma.proposal.create({
      data: {
        id: proposalId,
        applicationId: "application",
        version: attempt,
        type: "PROTOTYPE",
        description: "Proposal description",
        status: "SUBMITTED",
        submissionStatus: "SUBMITTED",
        handoffStatus,
        submittedByUserId: "team-owner",
        submittedAt,
        createdAt: submittedAt,
      },
    });
    const submissionAttempt = await database.prisma.proposalSubmissionAttempt.create({
      data: {
        id,
        proposalId,
        attempt,
        submittedByUserId: "team-owner",
        description: "Attempt description",
        submittedAt,
      },
    });
    return { proposalId, attemptId: submissionAttempt.id };
  }

  async function approveHandoff(
    proposalId: string,
    attemptId: string,
    createdAt = BASE_TIME,
  ) {
    await database.prisma.proposalHandoffReview.create({
      data: {
        problemId: "problem",
        proposalId,
        attemptId,
        reviewedByUserId: "admin-one",
        filesOrLinksComplete: true,
        withinTrialBriefScope: true,
        compliesWithRules: true,
        note: "Đủ nội dung bàn giao.",
        result: "APPROVED",
        createdAt,
      },
    });
  }

  async function createAcceptedEvaluation(proposalId: string, createdAt = BASE_TIME) {
    await database.prisma.proposalEvaluation.create({
      data: {
        proposalId,
        problemResponse: 4,
        feasibility: 4,
        goalAlignment: 4,
        practicalImplementation: 4,
        estimatedCost: 4,
        implementationTime: 4,
        valueDelivered: 4,
        comment: "Đạt yêu cầu.",
        decision: "ACCEPTED",
        evaluationResult: "ACCEPTED",
        implementationDecision: "PENDING",
        createdAt,
      },
    });
    await database.prisma.problem.update({
      where: { id: "problem" },
      data: {
        status: "EVALUATING",
        evaluationResult: "ACCEPTED",
        implementationDecision: "PENDING",
        prototypeLegacy: false,
      },
    });
  }

  async function reminders() {
    return database.prisma.notification.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  it("uses the due date and exact configured thresholds without changing workflow state", async () => {
    const clockBefore = { now: () => new Date(BASE_TIME.getTime() - 1) };
    const clockAt = { now: () => BASE_TIME };
    const groupProblem = {
      status: "PROTOTYPING",
      prototypeLegacy: false,
      evaluationResult: null,
      implementationDecision: null,
    };
    const groupInput = {
      problem: groupProblem,
      trialBriefVersions: [{ deadline: BASE_TIME, lockedAt: BASE_TIME }],
      proposals: [],
    };
    assert.equal(
      getWorkspacePrototypeOverdueStatus(groupInput, "STUDENT", clockBefore.now()).submission,
      false,
    );
    assert.equal(
      getWorkspacePrototypeOverdueStatus(groupInput, "STUDENT", clockAt.now()).submission,
      true,
    );

    const handoff = await createProposal();
    assert.equal(
      isAdminHandoffOverdue(groupProblem, "PENDING_REVIEW", new Date(BASE_TIME.getTime() - 2 * DAY + 1), BASE_TIME),
      false,
    );
    assert.equal(
      isAdminHandoffOverdue(groupProblem, "PENDING_REVIEW", new Date(BASE_TIME.getTime() - 2 * DAY), BASE_TIME),
      true,
    );
    await ensureAdminHandoffReminders({
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 2 * DAY - 1) },
    });
    assert.equal((await reminders()).length, 0);
    await ensureAdminHandoffReminders({
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 2 * DAY) },
    });
    const adminNotifications = await reminders();
    assert.equal(adminNotifications.length, 2);
    assert.ok(
      adminNotifications.every(
        ({ title }) => title === "Bàn giao Prototype đang chờ kiểm tra",
      ),
    );
    assert.deepEqual(
      adminNotifications.map(({ userId }) => userId).sort(),
      ["admin-one", "admin-two"],
    );
    await ensureAdminHandoffReminders({
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 2 * DAY) },
    });
    assert.equal((await reminders()).length, 2);
    await approveHandoff(handoff.proposalId, handoff.attemptId);
    await database.prisma.proposal.update({
      where: { id: handoff.proposalId },
      data: { handoffStatus: "APPROVED" },
    });
    await database.prisma.problem.update({
      where: { id: "problem" },
      data: { status: "EVALUATING", evaluationResult: null },
    });
    const evaluatingInput = {
      problem: {
        status: "EVALUATING",
        prototypeLegacy: false,
        evaluationResult: null,
        implementationDecision: null,
      },
      trialBriefVersions: [{ deadline: BASE_TIME, lockedAt: BASE_TIME }],
      proposals: [
        {
          handoffStatus: "APPROVED",
          submissionAttempts: [
            {
              submittedAt: BASE_TIME,
              handoffReviews: [{ result: "APPROVED", createdAt: BASE_TIME }],
            },
          ],
          evaluations: [],
        },
      ],
    };
    assert.equal(
      getWorkspacePrototypeOverdueStatus(
        evaluatingInput,
        "BUSINESS",
        new Date(BASE_TIME.getTime() + 3 * DAY - 1),
      ).evaluation,
      false,
    );
    assert.equal(
      getWorkspacePrototypeOverdueStatus(
        evaluatingInput,
        "BUSINESS",
        new Date(BASE_TIME.getTime() + 3 * DAY),
      ).evaluation,
      true,
    );
    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 3 * DAY - 1) },
    });
    assert.equal((await reminders()).length, 2);
    await ensureBusinessPrototypeReminders("problem", "other-business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 3 * DAY) },
    });
    assert.equal((await reminders()).length, 2);
    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 3 * DAY) },
    });
    const businessEvaluationReminder = (await reminders()).find(
      ({ title }) => title === "Prototype đang chờ doanh nghiệp đánh giá",
    );
    assert.equal(businessEvaluationReminder?.userId, "business-owner");
    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 3 * DAY) },
    });
    assert.equal(
      (await reminders()).filter(({ title }) => title === "Prototype đang chờ doanh nghiệp đánh giá").length,
      1,
    );

    await createAcceptedEvaluation(handoff.proposalId);
    assert.equal(
      getWorkspacePrototypeOverdueStatus(
        {
          ...evaluatingInput,
          problem: {
            status: "EVALUATING",
            prototypeLegacy: false,
            evaluationResult: "ACCEPTED",
            implementationDecision: "PENDING",
          },
          proposals: [
            {
              ...evaluatingInput.proposals[0],
              evaluations: [{ evaluationResult: "ACCEPTED", createdAt: BASE_TIME }],
            },
          ],
        },
        "BUSINESS",
        new Date(BASE_TIME.getTime() + 5 * DAY - 1),
      ).implementationDecision,
      false,
    );
    assert.equal(
      getWorkspacePrototypeOverdueStatus(
        {
          ...evaluatingInput,
          problem: {
            status: "EVALUATING",
            prototypeLegacy: false,
            evaluationResult: "ACCEPTED",
            implementationDecision: "PENDING",
          },
          proposals: [
            {
              ...evaluatingInput.proposals[0],
              evaluations: [{ evaluationResult: "ACCEPTED", createdAt: BASE_TIME }],
            },
          ],
        },
        "BUSINESS",
        new Date(BASE_TIME.getTime() + 5 * DAY),
      ).implementationDecision,
      true,
    );
    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 5 * DAY) },
    });
    const decisionReminder = (await reminders()).find(
      ({ title }) => title === "Prototype đã được chấp nhận, cần quyết định",
    );
    assert.equal(decisionReminder?.userId, "business-owner");
    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 5 * DAY) },
    });
    assert.equal(
      (await reminders()).filter(({ title }) => title === "Prototype đã được chấp nhận, cần quyết định").length,
      1,
    );
    const currentProblem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "problem" },
    });
    assert.equal(currentProblem.status, "EVALUATING");
    assert.equal(currentProblem.evaluationResult, "ACCEPTED");
    assert.equal(currentProblem.implementationDecision, "PENDING");
  });

  it("deduplicates group reminders, advances milestones, and starts a new series after resubmission", async () => {
    const run = (now: Date) =>
      ensureGroupSubmissionReminders("problem", {
        database: database.prisma,
        clock: { now: () => now },
      });
    await run(BASE_TIME);
    await run(BASE_TIME);
    assert.equal((await reminders()).length, 1);
    await run(new Date(BASE_TIME.getTime() + 3 * DAY));
    assert.equal((await reminders()).length, 2);

    const returned = await createProposal({
      handoffStatus: "RETURNED",
      submittedAt: new Date(BASE_TIME.getTime() + 3 * DAY),
      attempt: 2,
      id: "attempt-after-return",
    });
    await run(new Date(BASE_TIME.getTime() + 6 * DAY));
    const groupNotifications = (await reminders()).filter(({ userId }) => userId === "team-owner");
    assert.equal(groupNotifications.length, 3);
    assert.ok((await reminders()).every(({ userId }) => userId === "team-owner"));
    assert.match(groupNotifications[2].dedupeKey ?? "", /attempt-after-return-2-3-team-owner$/);
    await run(new Date(BASE_TIME.getTime() + 9 * DAY));
    assert.equal((await reminders()).length, 3);
    await run(new Date(BASE_TIME.getTime() + 30 * DAY));
    assert.equal((await reminders()).length, 3);
    assert.equal(
      await database.prisma.notification.count({
        where: { userId: "other-team-owner" },
      }),
      0,
    );

    await database.prisma.proposal.update({
      where: { id: returned.proposalId },
      data: { handoffStatus: "PENDING_REVIEW" },
    });
    await run(new Date(BASE_TIME.getTime() + 12 * DAY));
    assert.equal((await reminders()).length, 3);
    const currentProblem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "problem" },
    });
    assert.equal(currentProblem.status, "PROTOTYPING");
    assert.equal(currentProblem.evaluationResult, null);
  });

  it("does not remind legacy or closed Problems and marks neither overdue", async () => {
    await database.prisma.problem.update({
      where: { id: "problem" },
      data: { prototypeLegacy: true },
    });
    await ensureGroupSubmissionReminders("problem", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 10 * DAY) },
    });
    assert.equal((await reminders()).length, 0);

    await database.prisma.problem.update({
      where: { id: "problem" },
      data: { prototypeLegacy: false, status: "CLOSED" },
    });
    await ensureGroupSubmissionReminders("problem", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 10 * DAY) },
    });
    assert.equal((await reminders()).length, 0);
    const closedStatus = getWorkspacePrototypeOverdueStatus(
      {
        problem: {
          status: "CLOSED",
          prototypeLegacy: false,
          evaluationResult: "STOPPED",
          implementationDecision: null,
        },
        trialBriefVersions: [{ deadline: BASE_TIME, lockedAt: BASE_TIME }],
        proposals: [],
      },
      "STUDENT",
      new Date(BASE_TIME.getTime() + 10 * DAY),
    );
    assert.deepEqual(closedStatus, {
      submission: false,
      evaluation: false,
      implementationDecision: false,
    });
  });

  it("does not let notification write failures escape page-load reminder checks", async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;
    try {
      await assert.doesNotReject(
        ensureGroupSubmissionReminders("problem", {
          database: database.prisma,
          clock: { now: () => BASE_TIME },
          writer: async () => {
            throw new Error("notification storage unavailable");
          },
        }),
      );
    } finally {
      console.error = originalConsoleError;
    }
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "problem" },
    });
    assert.equal(problem.status, "PROTOTYPING");
    assert.equal(problem.evaluationResult, null);
  });

  it("uses the newest approved handoff as the evaluation clock origin after a resubmission", async () => {
    const first = await createProposal({
      handoffStatus: "RETURNED",
      submittedAt: new Date(BASE_TIME.getTime() - 10 * DAY),
      id: "old-attempt",
    });
    await approveHandoff(
      first.proposalId,
      first.attemptId,
      new Date(BASE_TIME.getTime() - 10 * DAY),
    );
    const latest = await createProposal({
      handoffStatus: "APPROVED",
      submittedAt: BASE_TIME,
      attempt: 2,
      id: "new-attempt",
    });
    await approveHandoff(latest.proposalId, latest.attemptId, BASE_TIME);
    await database.prisma.problem.update({
      where: { id: "problem" },
      data: { status: "EVALUATING" },
    });

    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 3 * DAY - 1) },
    });
    assert.equal((await reminders()).length, 0);
    await ensureBusinessPrototypeReminders("problem", "business-owner", {
      database: database.prisma,
      clock: { now: () => new Date(BASE_TIME.getTime() + 3 * DAY) },
    });
    const reminder = (await reminders())[0];
    const latestReview = await database.prisma.proposalHandoffReview.findFirstOrThrow({
      where: { attemptId: latest.attemptId, result: "APPROVED" },
    });
    assert.equal(
      reminder.dedupeKey,
      `prototype-business-evaluation-problem-${latestReview.id}-1-business-owner`,
    );
  });
});
