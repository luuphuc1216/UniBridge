import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";

const now = new Date("2026-10-28T10:00:00.000Z");
const clock = { now: () => now };
const scores = {
  problemResponse: 4,
  feasibility: 4,
  goalAlignment: 4,
  practicalImplementation: 4,
  estimatedCost: 4,
  implementationTime: 4,
  valueDelivered: 4,
};

describe("Prototype evaluation workflow", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let evaluatePrototypeProposal: typeof import("@/lib/prototype-evaluation")["evaluatePrototypeProposal"];
  let decidePrototypeImplementation: typeof import("@/lib/prototype-evaluation")["decidePrototypeImplementation"];
  let closePrototypeWithoutSubmission: typeof import("@/lib/prototype-evaluation")["closePrototypeWithoutSubmission"];
  let prototypeClosureResults: typeof import("@/lib/prototype-evaluation")["prototypeClosureResults"];
  let parsePrototypeImplementationFormData: typeof import("@/lib/prototype-evaluation")["parsePrototypeImplementationFormData"];
  let submitPrototypeProposal: typeof import("@/lib/proposal-handoff")["submitPrototypeProposal"];
  let reviewProposalHandoff: typeof import("@/lib/proposal-handoff")["reviewProposalHandoff"];
  let canOpenPaidImplementationAgreement: typeof import("@/lib/agreement-access")["canOpenPaidImplementationAgreement"];
  let assertLegacyEvaluationEnabled: typeof import("@/lib/proposal-evaluation-access")["assertLegacyEvaluationEnabled"];
  let getPrototypeProblemStatusLabel: typeof import("@/lib/prototype-status")["getPrototypeProblemStatusLabel"];
  let proposalId: string;
  let attemptId: string;

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-prototype-evaluation-import.db";
    ({
      evaluatePrototypeProposal,
      decidePrototypeImplementation,
      closePrototypeWithoutSubmission,
      prototypeClosureResults,
      parsePrototypeImplementationFormData,
    } =
      await import("@/lib/prototype-evaluation"));
    ({ submitPrototypeProposal, reviewProposalHandoff } = await import("@/lib/proposal-handoff"));
    ({ canOpenPaidImplementationAgreement } = await import("@/lib/agreement-access"));
    ({ assertLegacyEvaluationEnabled } = await import("@/lib/proposal-evaluation-access"));
    ({ getPrototypeProblemStatusLabel } = await import("@/lib/prototype-status"));
    database = await createTestDatabase("unibridge-prototype-evaluation");
    await database.prisma.user.createMany({
      data: [
        { id: "prototype-admin", email: "prototype-admin@example.com", name: "Admin", passwordHash: "test", role: "ADMIN", updatedAt: now },
        { id: "prototype-team-owner", email: "prototype-team@example.com", name: "Chủ nhóm", passwordHash: "test", role: "STUDENT", updatedAt: now },
        { id: "prototype-other-business", email: "prototype-other@example.com", name: "Doanh nghiệp khác", passwordHash: "test", role: "BUSINESS", updatedAt: now },
      ],
    });
    const studentProfile = await database.prisma.studentProfile.create({
      data: {
        id: "prototype-student-profile",
        userId: "prototype-team-owner",
        major: "CNTT",
        university: "Đại học",
      },
    });
    const team = await database.prisma.studentTeam.create({
      data: {
        id: "prototype-team",
        ownerId: "prototype-team-owner",
        name: "Nhóm thử nghiệm",
        slug: "prototype-team",
        university: "Đại học",
        description: "Nhóm thử nghiệm",
        memberships: {
          create: {
            id: "prototype-membership",
            studentProfileId: studentProfile.id,
            name: "Chủ nhóm",
            title: "Chủ nhóm",
            isLead: true,
          },
        },
      },
    });
    await database.prisma.problem.create({
      data: {
        id: "prototype-problem",
        businessProfileId: "business",
        title: "Prototype test",
        slug: "prototype-test",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "EVALUATING",
        prototypeLegacy: false,
        trialBriefLockedAt: now,
        applications: {
          create: {
            id: "prototype-application",
            teamId: team.id,
            approach: "Hướng giải quyết",
            estimatedDuration: "4 tuần",
            status: "SELECTED",
          },
        },
      },
    });
    await database.prisma.trialBriefVersion.create({
      data: {
        id: "prototype-brief",
        problemId: "prototype-problem",
        version: 1,
        objective: "Mục tiêu",
        scope: "Phạm vi",
        deliverables: "Sản phẩm bàn giao",
        deadline: now,
        evaluationCriteria: "Tiêu chí",
        maxRevisionRequests: 2,
        createdByUserId: "business-owner",
        createdAt: now,
        lockedAt: now,
        confidentialityTerms: "Bảo mật",
        ownershipTerms: "Quyền sở hữu",
      },
    });
    const proposal = await database.prisma.proposal.create({
      data: {
        id: "prototype-proposal",
        applicationId: "prototype-application",
        version: 1,
        type: "DETAILED_SOLUTION_PROPOSAL",
        description: "Proposal đã bàn giao",
        status: "SUBMITTED",
        submissionStatus: "SUBMITTED",
        handoffStatus: "APPROVED",
        submittedAt: now,
      },
      select: { id: true },
    });
    proposalId = proposal.id;
    const attempt = await database.prisma.proposalSubmissionAttempt.create({
      data: {
        id: "prototype-attempt",
        proposalId,
        attempt: 1,
        submittedByUserId: "prototype-team-owner",
        description: "Bàn giao đã được duyệt",
        submittedAt: now,
      },
      select: { id: true },
    });
    attemptId = attempt.id;
    await database.prisma.proposalHandoffReview.create({
      data: {
        id: "prototype-handoff-review",
        problemId: "prototype-problem",
        proposalId,
        attemptId,
        reviewedByUserId: "prototype-admin",
        filesOrLinksComplete: true,
        withinTrialBriefScope: true,
        compliesWithRules: true,
        note: "Đã đủ bàn giao",
        result: "APPROVED",
        createdAt: now,
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  async function evaluate(
    decision: "ACCEPTED" | "REVISION_REQUESTED" | "STOPPED",
    options: {
      businessUserId?: string;
      rating?: typeof scores;
      comment?: string;
    } = {},
  ) {
    return database.prisma.$transaction((transaction) =>
      evaluatePrototypeProposal(transaction, {
        problemId: "prototype-problem",
        applicationId: "prototype-application",
        proposalId,
        businessUserId: options.businessUserId ?? "business-owner",
        decision,
        scores: options.rating ?? scores,
        comment: options.comment ?? "Nhận xét đánh giá",
        clock,
      }),
    );
  }

  async function decide(
    decision: "IMPLEMENT" | "ENDED",
    reason = "Lý do kết thúc",
  ) {
    return database.prisma.$transaction((transaction) =>
      decidePrototypeImplementation(transaction, {
        problemId: "prototype-problem",
        applicationId: "prototype-application",
        businessUserId: "business-owner",
        decision,
        reason,
        clock,
      }),
    );
  }

  it("accepts a Prototype without creating a Project or financial records", async () => {
    await evaluate("ACCEPTED");
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    const proposal = await database.prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    assert.equal(problem.status, "EVALUATING");
    assert.equal(problem.evaluationResult, "ACCEPTED");
    assert.equal(problem.implementationDecision, "PENDING");
    assert.equal(proposal.status, "ACCEPTED");
    assert.equal(await database.prisma.proposalEvaluation.count({ where: { proposalId } }), 1);
    assert.equal(await database.prisma.project.count(), 0);
    assert.equal(await database.prisma.projectTransaction.count(), 0);
    assert.equal(await database.prisma.platformCharge.count(), 0);
    assert.equal(await database.prisma.notification.count({ where: { userId: "prototype-team-owner" } }), 1);
  });

  it("rejects an evaluation missing any required score", async () => {
    const incompleteScores = { ...scores, valueDelivered: 0 };
    await assert.rejects(evaluate("ACCEPTED", { rating: incompleteScores }), /Mỗi tiêu chí/);
    assert.equal(await database.prisma.proposalEvaluation.count(), 0);
  });

  it("requires a comment for every evaluation result, including STOPPED", async () => {
    await assert.rejects(evaluate("STOPPED", { comment: " " }), /Nhận xét là bắt buộc/);
    assert.equal(await database.prisma.problem.findUniqueOrThrow({ where: { id: "prototype-problem" } }).then(({ status }) => status), "EVALUATING");
  });

  it("records REVISION_REQUESTED and increments the count once", async () => {
    await evaluate("REVISION_REQUESTED");
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    const evaluation = await database.prisma.proposalEvaluation.findFirstOrThrow({
      where: { proposalId },
    });
    assert.equal(problem.status, "PROTOTYPING");
    assert.equal(problem.evaluationResult, "REVISION_REQUESTED");
    assert.equal(problem.prototypeRevisionRequestCount, 1);
    assert.equal(evaluation.revisionRequestNumber, 1);
    assert.equal((await database.prisma.proposal.findUniqueOrThrow({ where: { id: proposalId } })).status, "CHANGES_REQUESTED");
  });

  it("rejects revision requests at zero, at the limit, and above the limit", async () => {
    for (const [limit, count] of [[0, 0], [1, 1], [1, 2]]) {
      await database.prisma.trialBriefVersion.update({
        where: { id: "prototype-brief" },
        data: { maxRevisionRequests: limit },
      });
      await database.prisma.problem.update({
        where: { id: "prototype-problem" },
        data: { prototypeRevisionRequestCount: count },
      });
      await assert.rejects(evaluate("REVISION_REQUESTED"), /hết số lần/);
      assert.equal(
        (await database.prisma.problem.findUniqueOrThrow({ where: { id: "prototype-problem" } })).prototypeRevisionRequestCount,
        count,
      );
    }
  });

  it("allows a revision, resubmission, a second Admin review, and resets the result", async () => {
    await evaluate("REVISION_REQUESTED");
    const storage = {
      async save() {},
      async read() { return new Uint8Array(); },
      async delete() {},
    };
    const submission = await submitPrototypeProposal({
      database: database.prisma,
      storage,
      applicationId: "prototype-application",
      proposalId,
      submitterId: "prototype-team-owner",
      type: "DETAILED_SOLUTION_PROPOSAL",
      description: "Bản đã chỉnh sửa",
      files: [],
      clock,
    });
    assert.equal(submission.proposalId, proposalId);
    const refreshedProposal = await database.prisma.proposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    assert.equal(refreshedProposal.status, "SUBMITTED");
    assert.equal(refreshedProposal.handoffStatus, "PENDING_REVIEW");
    await database.prisma.$transaction((transaction) =>
      reviewProposalHandoff(transaction, {
        attemptId: submission.attemptId,
        reviewerId: "prototype-admin",
        reviewerRole: "ADMIN",
        decision: "APPROVED",
        filesOrLinksComplete: true,
        withinTrialBriefScope: true,
        compliesWithRules: true,
        note: "Đủ nội dung",
        clock,
      }),
    );
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    assert.equal(problem.status, "EVALUATING");
    assert.equal(problem.evaluationResult, null);
    assert.equal(problem.prototypeRevisionRequestCount, 1);
  });

  it("stops a Prototype and stores its reason in evaluation history", async () => {
    await evaluate("STOPPED", { comment: "Không tiếp tục vì không phù hợp." });
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    const evaluation = await database.prisma.proposalEvaluation.findFirstOrThrow({
      where: { proposalId },
    });
    assert.equal(problem.status, "CLOSED");
    assert.equal(problem.evaluationResult, "STOPPED");
    assert.equal(evaluation.comment, "Không tiếp tục vì không phù hợp.");
    assert.equal(await database.prisma.prototypeClosure.count(), 0);
  });

  it("requires the owning business and rejects legacy Problems in the new evaluation path", async () => {
    await assert.rejects(evaluate("ACCEPTED", { businessUserId: "prototype-admin" }), /doanh nghiệp sở hữu/);
    await assert.rejects(evaluate("ACCEPTED", { businessUserId: "prototype-other-business" }), /doanh nghiệp sở hữu/);
    await database.prisma.problem.update({
      where: { id: "prototype-problem" },
      data: { prototypeLegacy: true },
    });
    await assert.rejects(evaluate("ACCEPTED"), /doanh nghiệp sở hữu/);
    assert.doesNotThrow(() => assertLegacyEvaluationEnabled(true));
    assert.throws(() => assertLegacyEvaluationEnabled(false), /chưa được bật/);
  });

  it("only evaluates the latest approved attempt while the Problem is EVALUATING", async () => {
    await database.prisma.problem.update({
      where: { id: "prototype-problem" },
      data: { status: "PROTOTYPING" },
    });
    await assert.rejects(evaluate("ACCEPTED"), /không chờ doanh nghiệp/);
    assert.equal(await database.prisma.proposalEvaluation.count(), 0);
  });

  it("blocks duplicate evaluations", async () => {
    const results = await Promise.allSettled([evaluate("ACCEPTED"), evaluate("STOPPED")]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(await database.prisma.proposalEvaluation.count(), 1);
    assert.notEqual(
      (await database.prisma.problem.findUniqueOrThrow({ where: { id: "prototype-problem" } })).evaluationResult,
      null,
    );
  });

  it("opens the non-legacy agreement gate only after IMPLEMENT, without creating a Project", async () => {
    await evaluate("ACCEPTED");
    assert.equal(
      canOpenPaidImplementationAgreement({
        status: "EVALUATING",
        prototypeLegacy: false,
        evaluationResult: "ACCEPTED",
        implementationDecision: "PENDING",
      }),
      false,
    );
    await decide("IMPLEMENT");
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    assert.equal(problem.status, "READY_FOR_IMPLEMENTATION");
    assert.equal(problem.implementationDecision, "IMPLEMENT");
    assert.equal(
      canOpenPaidImplementationAgreement(problem),
      true,
    );
    assert.equal(
      (await database.prisma.proposalEvaluation.findFirstOrThrow({ where: { proposalId } })).implementationDecision,
      "IMPLEMENT",
    );
    assert.equal(await database.prisma.project.count(), 0);
    assert.equal(await database.prisma.projectTransaction.count(), 0);
    assert.equal(await database.prisma.platformCharge.count(), 0);
  });

  it("labels ACCEPTED with PENDING, ENDED, and IMPLEMENT as distinct outcomes", async () => {
    const base = { prototypeLegacy: false, evaluationResult: "ACCEPTED" };
    assert.match(
      getPrototypeProblemStatusLabel({
        ...base,
        status: "EVALUATING",
        implementationDecision: "PENDING",
      }),
      /chờ quyết định triển khai/,
    );
    assert.match(
      getPrototypeProblemStatusLabel({
        ...base,
        status: "CLOSED",
        implementationDecision: "ENDED",
      }),
      /kết thúc sau khi chấp nhận/,
    );
    assert.match(
      getPrototypeProblemStatusLabel({
        ...base,
        status: "READY_FOR_IMPLEMENTATION",
        implementationDecision: "IMPLEMENT",
      }),
      /chờ thỏa thuận/,
    );
  });

  it("prevents competing IMPLEMENT and ENDED decisions from both succeeding", async () => {
    await evaluate("ACCEPTED");
    const results = await Promise.allSettled([decide("IMPLEMENT"), decide("ENDED")]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    assert.ok(["IMPLEMENT", "ENDED"].includes(problem.implementationDecision ?? ""));
    assert.equal(await database.prisma.project.count(), 0);
  });

  it("stores ENDED separately from STOPPED and requires a reason", async () => {
    await evaluate("ACCEPTED");
    await assert.rejects(decide("ENDED", " "), /lý do kết thúc/);
    const formData = new FormData();
    formData.set("decision", "ENDED");
    formData.set("reason", "Doanh nghiệp chưa sẵn sàng triển khai.");
    const parsedForm = parsePrototypeImplementationFormData(formData);
    await database.prisma.$transaction((transaction) =>
      decidePrototypeImplementation(transaction, {
        problemId: "prototype-problem",
        applicationId: "prototype-application",
        businessUserId: "business-owner",
        ...parsedForm,
        clock,
      }),
    );
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    const closure = await database.prisma.prototypeClosure.findFirstOrThrow({
      where: { problemId: "prototype-problem" },
    });
    assert.equal(problem.status, "CLOSED");
    assert.equal(problem.evaluationResult, "ACCEPTED");
    assert.equal(problem.implementationDecision, "ENDED");
    assert.equal(
      (await database.prisma.proposalEvaluation.findFirstOrThrow({ where: { proposalId } })).implementationDecision,
      "ENDED",
    );
    assert.equal(closure.result, prototypeClosureResults.endedAfterAcceptance);
    assert.equal(
      canOpenPaidImplementationAgreement({
        status: problem.status,
        prototypeLegacy: problem.prototypeLegacy,
        evaluationResult: problem.evaluationResult,
        implementationDecision: problem.implementationDecision,
      }),
      false,
    );
    assert.equal(await database.prisma.project.count(), 0);
  });

  it("rejects empty or unknown implementation decisions without changing data", async () => {
    await evaluate("ACCEPTED");
    for (const decision of ["", "UNKNOWN", "ENDED ", "IMPLEMENTED"]) {
      const formData = new FormData();
      formData.set("decision", decision);
      formData.set("reason", "Lý do");
      assert.throws(
        () => parsePrototypeImplementationFormData(formData),
        /chọn quyết định triển khai hợp lệ/,
      );
    }
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        decidePrototypeImplementation(transaction, {
          problemId: "prototype-problem",
          applicationId: "prototype-application",
          businessUserId: "business-owner",
          decision: "UNKNOWN" as "IMPLEMENT",
          reason: "Lý do",
          clock,
        }),
      ),
      /Quyết định triển khai không hợp lệ/,
    );
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    assert.equal(problem.status, "EVALUATING");
    assert.equal(problem.implementationDecision, "PENDING");
    assert.equal(await database.prisma.prototypeClosure.count(), 0);
  });

  it("rejects selecting an implementation result again after a decision", async () => {
    await evaluate("ACCEPTED");
    await decide("IMPLEMENT");
    await assert.rejects(decide("ENDED"), /Quyết định đã được lưu trước đó/);
    assert.equal(await database.prisma.prototypeClosure.count(), 0);
  });

  it("reports inconsistent decision history without modifying either record", async () => {
    await evaluate("ACCEPTED");
    await database.prisma.proposalEvaluation.updateMany({
      where: { proposalId, evaluationResult: "ACCEPTED" },
      data: { implementationDecision: "IMPLEMENT" },
    });
    const notificationsBefore = await database.prisma.notification.count();
    await assert.rejects(
      decide("ENDED"),
      /Dữ liệu quyết định không nhất quán, liên hệ quản trị/,
    );
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    const evaluation = await database.prisma.proposalEvaluation.findFirstOrThrow({
      where: { proposalId, evaluationResult: "ACCEPTED" },
    });
    assert.equal(problem.status, "EVALUATING");
    assert.equal(problem.implementationDecision, "PENDING");
    assert.equal(evaluation.implementationDecision, "IMPLEMENT");
    assert.equal(await database.prisma.prototypeClosure.count(), 0);
    assert.equal(await database.prisma.notification.count(), notificationsBefore);
  });

  it("reports when no accepted evaluation exists for an implementation decision", async () => {
    await assert.rejects(
      decide("IMPLEMENT"),
      /Chưa có đánh giá được chấp nhận để quyết định/,
    );
    assert.equal(
      (await database.prisma.problem.findUniqueOrThrow({ where: { id: "prototype-problem" } }))
        .implementationDecision,
      null,
    );
  });

  it("closes a Prototype without a pending Admin handoff and records a distinct result", async () => {
    await database.prisma.problem.update({
      where: { id: "prototype-problem" },
      data: { status: "PROTOTYPING" },
    });
    await database.prisma.proposal.update({
      where: { id: proposalId },
      data: { handoffStatus: "RETURNED" },
    });
    await database.prisma.$transaction((transaction) =>
      closePrototypeWithoutSubmission(transaction, {
        problemId: "prototype-problem",
        applicationId: "prototype-application",
        businessUserId: "business-owner",
        reason: "Không có lần nộp đang chờ kiểm tra.",
        clock,
      }),
    );
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    const closure = await database.prisma.prototypeClosure.findFirstOrThrow({
      where: { problemId: "prototype-problem" },
    });
    assert.equal(problem.status, "CLOSED");
    assert.equal(closure.result, prototypeClosureResults.endedWithoutSubmission);
    assert.notEqual(closure.result, prototypeClosureResults.endedAfterAcceptance);
    assert.equal(await database.prisma.project.count(), 0);
  });

  it("rejects closing while an Admin handoff is pending", async () => {
    await database.prisma.problem.update({
      where: { id: "prototype-problem" },
      data: { status: "PROTOTYPING" },
    });
    await database.prisma.proposal.update({
      where: { id: proposalId },
      data: { handoffStatus: "PENDING_REVIEW" },
    });
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        closePrototypeWithoutSubmission(transaction, {
          problemId: "prototype-problem",
          applicationId: "prototype-application",
          businessUserId: "business-owner",
          reason: "Đóng khi đang chờ",
          clock,
        }),
      ),
      /đang có lần nộp chờ Admin/,
    );
    assert.equal((await database.prisma.problem.findUniqueOrThrow({ where: { id: "prototype-problem" } })).status, "PROTOTYPING");
  });

  it("allows only one of closing and Admin approval to win a race", async () => {
    await database.prisma.problem.update({
      where: { id: "prototype-problem" },
      data: { status: "PROTOTYPING" },
    });
    await database.prisma.proposal.update({
      where: { id: proposalId },
      data: { handoffStatus: "PENDING_REVIEW" },
    });
    await database.prisma.proposalHandoffReview.delete({
      where: { id: "prototype-handoff-review" },
    });
    const results = await Promise.allSettled([
      database.prisma.$transaction((transaction) =>
        closePrototypeWithoutSubmission(transaction, {
          problemId: "prototype-problem",
          applicationId: "prototype-application",
          businessUserId: "business-owner",
          reason: "Kết thúc thử nghiệm",
          clock,
        }),
      ),
      database.prisma.$transaction((transaction) =>
        reviewProposalHandoff(transaction, {
          attemptId,
          reviewerId: "prototype-admin",
          reviewerRole: "ADMIN",
          decision: "APPROVED",
          filesOrLinksComplete: true,
          withinTrialBriefScope: true,
          compliesWithRules: true,
          note: "Bàn giao đạt",
          clock,
        }),
      ),
    ]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    const finalProblem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: "prototype-problem" },
    });
    assert.ok(["CLOSED", "EVALUATING"].includes(finalProblem.status));
    if (finalProblem.status === "CLOSED") {
      assert.equal(await database.prisma.prototypeClosure.count(), 1);
      assert.equal(await database.prisma.proposalHandoffReview.count({ where: { result: "APPROVED" } }), 0);
    } else {
      assert.equal(await database.prisma.prototypeClosure.count(), 0);
      assert.equal(finalProblem.evaluationResult, null);
    }
  });
});
