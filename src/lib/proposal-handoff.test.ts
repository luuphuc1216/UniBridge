import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";

const now = new Date("2026-10-27T08:00:00.000Z");
const clock = { now: () => now };

function fakeStorage() {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    adapter: {
      async save(key: string, content: Uint8Array) {
        files.set(key, content);
      },
      async read(key: string) {
        const content = files.get(key);
        if (!content) throw new Error("Missing file");
        return content;
      },
      async delete(key: string) {
        files.delete(key);
      },
    },
  };
}

describe("Prototype handoff workflow", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let submitPrototypeProposal: typeof import("@/lib/proposal-handoff")["submitPrototypeProposal"];
  let reviewProposalHandoff: typeof import("@/lib/proposal-handoff")["reviewProposalHandoff"];
  let findAuthorizedProposalFile: typeof import("@/lib/proposal-handoff-access")["findAuthorizedProposalFile"];
  let findAuthorizedWorkspace: typeof import("@/lib/workspace-access")["findAuthorizedWorkspace"];
  let isAdminRole: typeof import("@/lib/admin-access")["isAdminRole"];
  let storage: ReturnType<typeof fakeStorage>;
  const problemId = "handoff-problem";
  const applicationId = "handoff-application";

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-proposal-handoff-import.db";
    ({ submitPrototypeProposal, reviewProposalHandoff } = await import("@/lib/proposal-handoff"));
    ({ findAuthorizedProposalFile } = await import("@/lib/proposal-handoff-access"));
    ({ findAuthorizedWorkspace } = await import("@/lib/workspace-access"));
    ({ isAdminRole } = await import("@/lib/admin-access"));
    database = await createTestDatabase("unibridge-proposal-handoff");
    storage = fakeStorage();

    await database.prisma.user.createMany({
      data: [
        { id: "team-owner", email: "team-owner@example.com", name: "Team owner", passwordHash: "test", updatedAt: now },
        { id: "team-b-owner", email: "team-b-owner@example.com", name: "Team B owner", passwordHash: "test", updatedAt: now },
        { id: "handoff-admin", email: "handoff-admin@example.com", name: "Admin", passwordHash: "test", role: "ADMIN", updatedAt: now },
        { id: "other-business", email: "other-business@example.com", name: "Other business", passwordHash: "test", role: "BUSINESS", updatedAt: now },
      ],
    });
    const profile = await database.prisma.studentProfile.create({
      data: { id: "team-profile", userId: "team-owner", major: "CNTT", university: "Đại học" },
    });
    const team = await database.prisma.studentTeam.create({
      data: {
        id: "selected-team",
        ownerId: "team-owner",
        name: "Selected team",
        slug: "selected-team",
        university: "Đại học",
        description: "Selected team",
        memberships: {
          create: {
            id: "team-membership",
            studentProfileId: profile.id,
            name: "Team owner",
            title: "Chủ nhóm",
            isLead: true,
          },
        },
      },
    });
    const teamBProfile = await database.prisma.studentProfile.create({
      data: { id: "team-b-profile", userId: "team-b-owner", major: "CNTT", university: "Đại học" },
    });
    const teamB = await database.prisma.studentTeam.create({
      data: {
        id: "unselected-team",
        ownerId: "team-b-owner",
        name: "Unselected team",
        slug: "unselected-team",
        university: "Đại học",
        description: "Unselected team",
        memberships: {
          create: {
            id: "team-b-membership",
            studentProfileId: teamBProfile.id,
            name: "Team B owner",
            title: "Chủ nhóm",
            isLead: true,
          },
        },
      },
    });
    await database.prisma.problem.create({
      data: {
        id: problemId,
        businessProfileId: "business",
        title: "Handoff problem",
        slug: "handoff-problem",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "PROTOTYPING",
        prototypeLegacy: false,
        evaluationResult: "REVISION_REQUESTED",
        trialBriefLockedAt: now,
        applications: {
          create: [
            {
              id: applicationId,
              teamId: team.id,
              approach: "Hướng A",
              estimatedDuration: "4 tuần",
              status: "SELECTED",
            },
            {
              id: "unselected-application",
              teamId: teamB.id,
              approach: "Hướng B",
              estimatedDuration: "4 tuần",
              status: "PENDING_CONFIRMATION",
            },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  async function submit({
    proposalId,
    submitterId = "team-owner",
    files = [{ originalName: "result.pdf", contentType: "application/pdf", sizeBytes: 4, content: new Uint8Array([1, 2, 3, 4]) }],
  }: {
    proposalId?: string | null;
    submitterId?: string;
    files?: {
      originalName: string;
      contentType: string;
      sizeBytes: number;
      content: Uint8Array;
    }[];
  } = {}) {
    return submitPrototypeProposal({
      database: database.prisma,
      storage: storage.adapter,
      applicationId,
      proposalId,
      submitterId,
      type: "DETAILED_SOLUTION_PROPOSAL",
      description: "Mô tả nội dung bàn giao đầy đủ",
      files,
      clock,
    });
  }

  async function review(
    attemptId: string,
    decision: "APPROVED" | "RETURNED",
    options: {
      filesOrLinksComplete?: boolean;
      withinTrialBriefScope?: boolean;
      compliesWithRules?: boolean;
      missingItems?: string[];
      reviewerRole?: string;
    } = {},
  ) {
    return database.prisma.$transaction((transaction) =>
      reviewProposalHandoff(transaction, {
        attemptId,
        reviewerId: "handoff-admin",
        reviewerRole: options.reviewerRole ?? "ADMIN",
        decision,
        filesOrLinksComplete: options.filesOrLinksComplete ?? true,
        withinTrialBriefScope: options.withinTrialBriefScope ?? true,
        compliesWithRules: options.compliesWithRules ?? true,
        note: "Đã kiểm tra bàn giao",
        missingItems: options.missingItems,
        clock,
      }),
    );
  }

  it("submits a locked, selected team's Proposal as a numbered handoff attempt", async () => {
    const result = await submit();
    const proposal = await database.prisma.proposal.findUniqueOrThrow({
      where: { id: result.proposalId },
      include: { submissionAttempts: { include: { files: true } } },
    });
    const problem = await database.prisma.problem.findUniqueOrThrow({ where: { id: problemId } });

    assert.equal(proposal.status, "DRAFT");
    assert.equal(proposal.submissionStatus, "SUBMITTED");
    assert.equal(proposal.handoffStatus, "PENDING_REVIEW");
    assert.equal(proposal.submissionAttempts[0]?.attempt, 1);
    assert.equal(proposal.submissionAttempts[0]?.files[0]?.attemptId, result.attemptId);
    assert.equal(problem.status, "PROTOTYPING");
    assert.equal(await database.prisma.project.count(), 0);
    assert.equal(await database.prisma.projectTransaction.count(), 0);
    assert.equal(await database.prisma.platformCharge.count(), 0);
    assert.equal(await database.prisma.notification.count({ where: { title: "Có Proposal cần kiểm tra bàn giao" } }), 1);
  });

  it("rejects submission before the trial brief is locked", async () => {
    await database.prisma.problem.update({ where: { id: problemId }, data: { trialBriefLockedAt: null } });
    await assert.rejects(submit(), /hồ sơ thử nghiệm đã khóa/);
  });

  it("rejects submission unless Problem is PROTOTYPING", async () => {
    await database.prisma.problem.update({ where: { id: problemId }, data: { status: "EVALUATING" } });
    await assert.rejects(submit(), /đang xây dựng/);
  });

  it("keeps legacy Problems out of the new handoff submission path", async () => {
    await database.prisma.problem.update({ where: { id: problemId }, data: { prototypeLegacy: true } });
    await assert.rejects(submit(), /chủ nhóm được chọn/);
  });

  it("rejects submission when the application is not SELECTED", async () => {
    await database.prisma.application.update({ where: { id: applicationId }, data: { status: "SUBMITTED" } });
    await assert.rejects(submit(), /hồ sơ thử nghiệm đã khóa/);
  });

  it("rejects submission by a student who is not the selected team's owner", async () => {
    await assert.rejects(submit({ submitterId: "buyer" }), /chủ nhóm/);
  });

  it("rejects another submission while handoff is PENDING_REVIEW", async () => {
    await submit();
    await assert.rejects(submit(), /đang chờ kiểm tra/);
  });

  it("rejects another submission after handoff is APPROVED", async () => {
    const submitted = await submit();
    await database.prisma.proposal.update({
      where: { id: submitted.proposalId },
      data: { handoffStatus: "APPROVED" },
    });
    await assert.rejects(submit(), /đã được duyệt/);
  });

  it("rejects an Admin review for a superseded submission attempt", async () => {
    const first = await submit();
    await review(first.attemptId, "RETURNED", {
      filesOrLinksComplete: false,
      missingItems: ["Tài liệu"],
    });
    const second = await submit({ proposalId: first.proposalId });
    await assert.rejects(review(first.attemptId, "APPROVED"), /không còn chờ kiểm tra/);
    assert.equal(
      (await database.prisma.proposal.findUniqueOrThrow({ where: { id: second.proposalId } })).handoffStatus,
      "PENDING_REVIEW",
    );
    const problem = await database.prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    assert.equal(problem.status, "PROTOTYPING");
  });

  it("resubmits a returned version as a new immutable attempt with new files", async () => {
    const first = await submit();
    const oldFile = await database.prisma.proposalFile.findFirstOrThrow({
      where: { attemptId: first.attemptId },
    });
    await review(first.attemptId, "RETURNED", {
      filesOrLinksComplete: false,
      missingItems: ["Tài liệu đầu ra"],
    });
    const second = await submit({ proposalId: first.proposalId });
    const attempts = await database.prisma.proposalSubmissionAttempt.findMany({
      where: { proposalId: first.proposalId },
      orderBy: { attempt: "asc" },
      include: { files: true },
    });
    const proposal = await database.prisma.proposal.findUniqueOrThrow({
      where: { id: first.proposalId },
    });

    assert.equal(second.proposalId, first.proposalId);
    assert.deepEqual(attempts.map(({ attempt }) => attempt), [1, 2]);
    assert.equal(attempts[0]?.files[0]?.id, oldFile.id);
    assert.equal(attempts[1]?.files[0]?.attemptId, second.attemptId);
    assert.equal(proposal.handoffStatus, "PENDING_REVIEW");
    assert.equal(await database.prisma.proposalFile.count({ where: { proposalId: first.proposalId } }), 2);
    assert.equal(storage.files.size, 2);
  });

  it("creates a new Proposal version after a returned attempt without replacing history", async () => {
    const first = await submit();
    await review(first.attemptId, "RETURNED", {
      filesOrLinksComplete: false,
      missingItems: ["Tệp đính kèm"],
    });
    const second = await submit({ proposalId: null });
    const proposals = await database.prisma.proposal.findMany({
      where: { applicationId },
      orderBy: { version: "asc" },
    });
    assert.deepEqual(proposals.map(({ version }) => version), [1, 2]);
    assert.notEqual(first.proposalId, second.proposalId);
    assert.equal(await database.prisma.proposalSubmissionAttempt.count(), 2);
  });

  it("approves only when all three checklist items pass and resets the evaluation result", async () => {
    const first = await submit();
    await review(first.attemptId, "RETURNED", {
      filesOrLinksComplete: false,
      missingItems: ["Tài liệu còn thiếu"],
    });
    await database.prisma.problem.update({
      where: { id: problemId },
      data: { evaluationResult: "REVISION_REQUESTED" },
    });
    const submitted = await submit({ proposalId: first.proposalId });
    const reviewResult = await review(submitted.attemptId, "APPROVED");
    const proposal = await database.prisma.proposal.findUniqueOrThrow({
      where: { id: submitted.proposalId },
    });
    const problem = await database.prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    const handoffReview = await database.prisma.proposalHandoffReview.findFirstOrThrow({
      where: { attemptId: submitted.attemptId },
    });
    assert.equal(reviewResult.result, "APPROVED");
    assert.equal(proposal.handoffStatus, "APPROVED");
    assert.equal(proposal.status, "SUBMITTED");
    assert.equal(problem.status, "EVALUATING");
    assert.equal(problem.evaluationResult, null);
    assert.equal(handoffReview.result, "APPROVED");
    assert.equal(handoffReview.attemptId, submitted.attemptId);
    assert.equal(await database.prisma.notification.count({ where: { userId: "business-owner", title: "Proposal đã qua kiểm tra bàn giao" } }), 1);
    assert.equal(await database.prisma.project.count(), 0);
    assert.equal(await database.prisma.projectTransaction.count(), 0);
    assert.equal(await database.prisma.platformCharge.count(), 0);
  });

  it("returns the persisted outcome when automatic completeness blocks Admin approval", async () => {
    const submitted = await submit();
    await database.prisma.trialBriefVersion.create({
      data: {
        problemId,
        version: 1,
        objective: "Mục tiêu",
        scope: "Phạm vi",
        deliverables: "Sơ đồ kiến trúc chưa được nộp",
        deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        evaluationCriteria: "Tiêu chí",
        maxRevisionRequests: 2,
        createdByUserId: "business-owner",
        createdAt: now,
        lockedAt: now,
        confidentialityTerms: "Bảo mật",
        ownershipTerms: "Quyền sở hữu",
      },
    });

    const reviewResult = await review(submitted.attemptId, "APPROVED");
    const proposal = await database.prisma.proposal.findUniqueOrThrow({
      where: { id: submitted.proposalId },
    });
    const problem = await database.prisma.problem.findUniqueOrThrow({
      where: { id: problemId },
    });
    const handoffReview = await database.prisma.proposalHandoffReview.findFirstOrThrow({
      where: { attemptId: submitted.attemptId },
    });

    assert.equal(reviewResult.result, "RETURNED");
    assert.equal(proposal.handoffStatus, "RETURNED");
    assert.equal(proposal.status, "DRAFT");
    assert.equal(problem.status, "PROTOTYPING");
    assert.equal(handoffReview.result, "RETURNED");
    assert.match(handoffReview.missingItems ?? "", /Chưa thấy sản phẩm đầu ra/);
    assert.equal(
      await database.prisma.notification.count({
        where: {
          userId: "team-owner",
          title: "Proposal cần bổ sung trước khi chuyển cho doanh nghiệp",
        },
      }),
      1,
    );
  });

  it("does not allow approval when any checklist item is false", async () => {
    const submitted = await submit();
    await assert.rejects(
      review(submitted.attemptId, "APPROVED", { compliesWithRules: false }),
      /cả ba mục đạt/,
    );
    assert.equal(await database.prisma.proposalHandoffReview.count(), 0);
  });

  it("requires a failed checklist item and missingItems when returning handoff", async () => {
    const submitted = await submit();
    await assert.rejects(review(submitted.attemptId, "RETURNED"), /cả ba mục đạt/);
    await assert.rejects(
      review(submitted.attemptId, "RETURNED", {
        withinTrialBriefScope: false,
        missingItems: [],
      }),
      /ít nhất một mục cần bổ sung/,
    );
    assert.equal(await database.prisma.proposalHandoffReview.count(), 0);
  });

  it("returns handoff without incrementing prototype revision request count", async () => {
    const submitted = await submit();
    const reviewResult = await review(submitted.attemptId, "RETURNED", {
      withinTrialBriefScope: false,
      missingItems: ["Phạm vi bàn giao"],
    });
    const problem = await database.prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    const notification = await database.prisma.notification.findFirstOrThrow({
      where: { userId: "team-owner", title: "Proposal cần bổ sung trước khi chuyển cho doanh nghiệp" },
    });
    assert.equal(reviewResult.result, "RETURNED");
    assert.equal(problem.status, "PROTOTYPING");
    assert.equal(problem.prototypeRevisionRequestCount, 0);
    assert.match(notification.message, /Phạm vi bàn giao/);
  });

  it("processes a pending attempt only once", async () => {
    const submitted = await submit();
    await review(submitted.attemptId, "APPROVED");
    await assert.rejects(review(submitted.attemptId, "APPROVED"), /không còn chờ kiểm tra/);
    assert.equal(await database.prisma.proposalHandoffReview.count(), 1);
  });

  it("rejects non-admin review requests", async () => {
    const submitted = await submit();
    assert.equal(isAdminRole("STUDENT"), false);
    assert.equal(isAdminRole("BUSINESS"), false);
    assert.equal(isAdminRole("ADMIN"), true);
    await assert.rejects(review(submitted.attemptId, "APPROVED", { reviewerRole: "BUSINESS" }), /Chỉ quản trị viên/);
  });

  it("rolls back Proposal and file rows and removes files when the transaction fails", async () => {
    await database.prisma.$executeRawUnsafe(`
      CREATE TRIGGER fail_proposal_handoff_notification
      BEFORE INSERT ON Notification
      WHEN NEW.title = 'Có Proposal cần kiểm tra bàn giao'
      BEGIN
        SELECT RAISE(ABORT, 'notification write failed');
      END;
    `);
    await assert.rejects(submit());
    assert.equal(await database.prisma.proposal.count(), 0);
    assert.equal(await database.prisma.proposalSubmissionAttempt.count(), 0);
    assert.equal(await database.prisma.proposalFile.count(), 0);
    assert.equal(storage.files.size, 0);
  });

  it("isolates file reads to selected-team members, Admin, and approved business handoffs", async () => {
    const submitted = await submit();
    const file = await database.prisma.proposalFile.findFirstOrThrow({
      where: { attemptId: submitted.attemptId },
    });
    assert.ok(await findAuthorizedProposalFile(file.id, "team-owner", "STUDENT", database.prisma));
    assert.ok(await findAuthorizedProposalFile(file.id, "handoff-admin", "ADMIN", database.prisma));
    assert.equal(await findAuthorizedProposalFile(file.id, "team-b-owner", "STUDENT", database.prisma), null);
    assert.equal(await findAuthorizedProposalFile(file.id, "business-owner", "BUSINESS", database.prisma), null);
    assert.equal(await findAuthorizedProposalFile(file.id, "other-business", "BUSINESS", database.prisma), null);

    const pendingWorkspace = await findAuthorizedWorkspace(
      problemId,
      "business-owner",
      "BUSINESS",
      applicationId,
      database.prisma,
    );
    assert.equal(pendingWorkspace?.applications[0]?.proposals.length, 0);
    const teamBWorkspace = await findAuthorizedWorkspace(
      problemId,
      "team-b-owner",
      "STUDENT",
      "unselected-application",
      database.prisma,
    );
    assert.equal(teamBWorkspace?.applications[0]?.proposals.length, 0);
    assert.equal(
      await findAuthorizedWorkspace(
        problemId,
        "other-business",
        "BUSINESS",
        applicationId,
        database.prisma,
      ),
      null,
    );
    await review(submitted.attemptId, "RETURNED", {
      filesOrLinksComplete: false,
      missingItems: ["Tài liệu"],
    });
    assert.ok(await findAuthorizedProposalFile(file.id, "team-owner", "STUDENT", database.prisma));
    assert.ok(await findAuthorizedProposalFile(file.id, "handoff-admin", "ADMIN", database.prisma));
    assert.equal(await findAuthorizedProposalFile(file.id, "business-owner", "BUSINESS", database.prisma), null);
    assert.ok(await findAuthorizedProposalFile(file.id, "handoff-admin", "ADMIN", database.prisma));
    const returnedWorkspace = await findAuthorizedWorkspace(
      problemId,
      "business-owner",
      "BUSINESS",
      applicationId,
      database.prisma,
    );
    assert.equal(returnedWorkspace?.applications[0]?.proposals.length, 0);

    const resubmitted = await submit({ proposalId: submitted.proposalId });
    const newFile = await database.prisma.proposalFile.findFirstOrThrow({
      where: { attemptId: resubmitted.attemptId },
    });
    await review(resubmitted.attemptId, "APPROVED");
    assert.equal(await findAuthorizedProposalFile(file.id, "business-owner", "BUSINESS", database.prisma), null);
    assert.ok(await findAuthorizedProposalFile(file.id, "team-owner", "STUDENT", database.prisma));
    assert.ok(await findAuthorizedProposalFile(newFile.id, "team-owner", "STUDENT", database.prisma));
    assert.ok(await findAuthorizedProposalFile(file.id, "handoff-admin", "ADMIN", database.prisma));
    assert.ok(await findAuthorizedProposalFile(newFile.id, "handoff-admin", "ADMIN", database.prisma));
    assert.ok(await findAuthorizedProposalFile(newFile.id, "business-owner", "BUSINESS", database.prisma));
    assert.equal(await findAuthorizedProposalFile(newFile.id, "team-b-owner", "STUDENT", database.prisma), null);
    assert.equal(await findAuthorizedProposalFile(newFile.id, "other-business", "BUSINESS", database.prisma), null);
    const approvedWorkspace = await findAuthorizedWorkspace(
      problemId,
      "business-owner",
      "BUSINESS",
      applicationId,
      database.prisma,
    );
    assert.equal(approvedWorkspace?.applications[0]?.proposals.length, 1);
    assert.equal(approvedWorkspace?.applications[0]?.proposals[0]?.submissionAttempts.length, 1);
  });
});
