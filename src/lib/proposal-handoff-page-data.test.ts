import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";

describe("Proposal handoff detail page data", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let getProposalHandoffPageData: typeof import("@/lib/proposal-handoff-page-data")["getProposalHandoffPageData"];
  const problemId = "handoff-detail-problem";
  const applicationId = "handoff-detail-application";
  const pendingAttemptId = "handoff-detail-pending-attempt";
  const processedAttemptId = "handoff-detail-processed-attempt";
  const supersededAttemptId = "handoff-detail-superseded-attempt";
  const latestAttemptId = "handoff-detail-latest-attempt";
  const reviewedAt = new Date("2026-10-28T04:00:00.000Z");

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-proposal-handoff-page-data-import.db";
    ({ getProposalHandoffPageData } = await import("@/lib/proposal-handoff-page-data"));
    database = await createTestDatabase("unibridge-proposal-handoff-page-data");
    await database.prisma.user.createMany({
      data: [
        {
          id: "page-data-admin",
          email: "page-data-admin@example.com",
          name: "Quản trị viên",
          passwordHash: "test",
          role: "ADMIN",
          updatedAt: reviewedAt,
        },
        {
          id: "page-data-team-owner",
          email: "page-data-team@example.com",
          name: "Chủ nhóm",
          passwordHash: "test",
          updatedAt: reviewedAt,
        },
      ],
    });
    const profile = await database.prisma.studentProfile.create({
      data: {
        id: "page-data-profile",
        userId: "page-data-team-owner",
        major: "CNTT",
        university: "Đại học",
      },
    });
    const team = await database.prisma.studentTeam.create({
      data: {
        id: "page-data-team",
        ownerId: "page-data-team-owner",
        name: "Nhóm kiểm thử",
        slug: "nhom-kiem-thu",
        university: "Đại học",
        description: "Nhóm kiểm thử",
        memberships: {
          create: {
            id: "page-data-membership",
            studentProfileId: profile.id,
            name: "Chủ nhóm",
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
        title: "Bài toán kiểm tra bàn giao",
        slug: "bai-toan-kiem-tra-ban-giao",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "PROTOTYPING",
        prototypeLegacy: false,
        trialBriefLockedAt: reviewedAt,
        applications: {
          create: {
            id: applicationId,
            teamId: team.id,
            approach: "Hướng giải quyết",
            estimatedDuration: "4 tuần",
            status: "SELECTED",
          },
        },
      },
    });

    const pendingProposal = await database.prisma.proposal.create({
      data: {
        id: "handoff-detail-pending-proposal",
        applicationId,
        version: 1,
        type: "DETAILED_SOLUTION_PROPOSAL",
        description: "Mô tả lần nộp đang chờ",
        status: "DRAFT",
        submissionStatus: "SUBMITTED",
        handoffStatus: "PENDING_REVIEW",
      },
    });
    await database.prisma.proposalSubmissionAttempt.create({
      data: {
        id: pendingAttemptId,
        proposalId: pendingProposal.id,
        attempt: 1,
        submittedByUserId: "page-data-team-owner",
        description: "Nội dung lần nộp đang chờ",
      },
    });

    const processedProposal = await database.prisma.proposal.create({
      data: {
        id: "handoff-detail-processed-proposal",
        applicationId,
        version: 2,
        type: "DETAILED_SOLUTION_PROPOSAL",
        description: "Mô tả lần nộp đã xử lý",
        status: "DRAFT",
        submissionStatus: "SUBMITTED",
        handoffStatus: "RETURNED",
      },
    });
    await database.prisma.proposalSubmissionAttempt.create({
      data: {
        id: processedAttemptId,
        proposalId: processedProposal.id,
        attempt: 1,
        submittedByUserId: "page-data-team-owner",
        description: "Nội dung lần nộp đã xử lý",
      },
    });
    await database.prisma.proposalHandoffReview.create({
      data: {
        problemId,
        proposalId: processedProposal.id,
        attemptId: processedAttemptId,
        reviewedByUserId: "page-data-admin",
        filesOrLinksComplete: false,
        withinTrialBriefScope: true,
        compliesWithRules: true,
        note: "Thiếu tài liệu đầu ra.",
        missingItems: "Tài liệu đầu ra",
        result: "RETURNED",
        createdAt: reviewedAt,
      },
    });

    const supersededProposal = await database.prisma.proposal.create({
      data: {
        id: "handoff-detail-superseded-proposal",
        applicationId,
        version: 3,
        type: "DETAILED_SOLUTION_PROPOSAL",
        description: "Mô tả phiên bản nộp lại",
        status: "DRAFT",
        submissionStatus: "SUBMITTED",
        handoffStatus: "PENDING_REVIEW",
      },
    });
    await database.prisma.proposalSubmissionAttempt.createMany({
      data: [
        {
          id: supersededAttemptId,
          proposalId: supersededProposal.id,
          attempt: 1,
          submittedByUserId: "page-data-team-owner",
          description: "Lần nộp cũ",
        },
        {
          id: latestAttemptId,
          proposalId: supersededProposal.id,
          attempt: 2,
          submittedByUserId: "page-data-team-owner",
          description: "Lần nộp mới nhất",
        },
      ],
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("returns pending, reviewed and superseded details for existing attempt IDs", async () => {
    const pending = await getProposalHandoffPageData(
      pendingAttemptId,
      "ADMIN",
      database.prisma,
    );
    const processed = await getProposalHandoffPageData(
      processedAttemptId,
      "ADMIN",
      database.prisma,
    );
    const superseded = await getProposalHandoffPageData(
      supersededAttemptId,
      "ADMIN",
      database.prisma,
    );

    assert.equal(pending.kind, "pending");
    assert.equal(processed.kind, "processed");
    if (processed.kind === "processed") {
      assert.equal(processed.review?.result, "RETURNED");
      assert.equal(processed.review?.reviewedBy.name, "Quản trị viên");
      assert.equal(processed.review?.createdAt.getTime(), reviewedAt.getTime());
      assert.equal(processed.review?.filesOrLinksComplete, false);
      assert.equal(processed.review?.withinTrialBriefScope, true);
      assert.equal(processed.review?.compliesWithRules, true);
      assert.equal(processed.review?.note, "Thiếu tài liệu đầu ra.");
      assert.equal(processed.review?.missingItems, "Tài liệu đầu ra");
    }
    assert.equal(superseded.kind, "superseded");
    if (superseded.kind === "superseded") {
      assert.equal(superseded.latestAttempt.id, latestAttemptId);
      assert.equal(superseded.latestAttempt.attempt, 2);
    }
  });

  it("returns not-found only when the attempt ID does not exist", async () => {
    const missing = await getProposalHandoffPageData(
      "missing-handoff-attempt",
      "ADMIN",
      database.prisma,
    );
    assert.equal(missing.kind, "not-found");
  });

  it("rejects non-admin access for pending, processed and superseded attempts", async () => {
    for (const attemptId of [
      pendingAttemptId,
      processedAttemptId,
      supersededAttemptId,
    ]) {
      await assert.rejects(
        getProposalHandoffPageData(attemptId, "STUDENT", database.prisma),
        /Chỉ quản trị viên/,
      );
      await assert.rejects(
        getProposalHandoffPageData(attemptId, "BUSINESS", database.prisma),
        /Chỉ quản trị viên/,
      );
    }
  });
});
