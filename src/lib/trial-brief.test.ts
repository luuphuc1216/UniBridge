import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import {
  createTrialBriefVersion,
  respondToTrialBrief,
  type TrialBriefInput,
} from "@/lib/trial-brief";
import { canOpenPaidImplementationAgreement } from "@/lib/agreement-access";
import {
  assertLegacyEvaluationEnabled,
  LEGACY_EVALUATION_DISABLED_MESSAGE,
} from "@/lib/proposal-evaluation-access";

const futureDeadline = new Date("2030-01-01T00:00:00.000Z");

function briefInput(maxRevisionRequests = 1): TrialBriefInput {
  return {
    objective: "Kiểm chứng quy trình thử nghiệm.",
    scope: "Bản thử nghiệm giới hạn.",
    deliverables: "Bản demo và tài liệu hướng dẫn.",
    deadline: futureDeadline,
    evaluationCriteria: "Đủ phạm vi và có thể trình diễn.",
    maxRevisionRequests,
    businessProvidedData: "",
    confidentialityTerms: "Không chia sẻ dữ liệu ra ngoài phạm vi.",
    ownershipTerms: "Hai bên thống nhất quyền sử dụng.",
    compensationTerms: "",
  };
}

async function fixture() {
  const database = await createTestDatabase("unibridge-trial-brief");
  const { prisma } = database;
  await prisma.user.createMany({
    data: [
      { id: "lead", email: "lead@example.com", name: "Lead", passwordHash: "test", updatedAt: new Date() },
      { id: "delegate", email: "delegate@example.com", name: "Delegate", passwordHash: "test", updatedAt: new Date() },
      { id: "outsider", email: "outsider@example.com", name: "Outsider", passwordHash: "test", updatedAt: new Date() },
    ],
  });
  const leadProfile = await prisma.studentProfile.create({
    data: { id: "lead-profile", userId: "lead", major: "CNTT", university: "Đại học" },
  });
  const delegateProfile = await prisma.studentProfile.create({
    data: { id: "delegate-profile", userId: "delegate", major: "CNTT", university: "Đại học" },
  });
  const team = await prisma.studentTeam.create({
    data: {
      id: "trial-team",
      ownerId: "lead",
      name: "Trial Team",
      slug: "trial-team",
      university: "Đại học",
      description: "Nhóm thử nghiệm",
      memberships: {
        create: [
          { id: "lead-membership", studentProfileId: leadProfile.id, name: "Lead", title: "Trưởng nhóm", isLead: true },
          { id: "delegate-membership", studentProfileId: delegateProfile.id, name: "Delegate", title: "Thành viên", isLead: false },
        ],
      },
    },
  });
  const problem = await prisma.problem.create({
    data: {
      id: "trial-problem",
      businessProfileId: "business",
      title: "Trial problem",
      slug: "trial-problem",
      description: "Mô tả",
      goal: "Mục tiêu",
      field: "CNTT",
      requirements: "Yêu cầu",
      expectedDuration: "4 tuần",
      status: "TEAM_SELECTED",
      applications: {
        create: {
          id: "trial-application",
          teamId: team.id,
          approach: "Hướng tiếp cận",
          estimatedDuration: "4 tuần",
          status: "SELECTED",
        },
      },
    },
  });
  return { database, prisma, problemId: problem.id };
}

describe("trial brief flow", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let problemId: string;

  beforeEach(async () => {
    const setup = await fixture();
    database = setup.database;
    problemId = setup.problemId;
  });

  afterEach(async () => {
    await database.close();
  });

  it("creates a business-confirmed version and lets the group confirm it", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, {
        problemId,
        businessUserId: "business-owner",
        input: briefInput(),
      }),
    );
    await prisma.$transaction((transaction) =>
      respondToTrialBrief(transaction, {
        problemId,
        version: 1,
        studentUserId: "lead",
        decision: "CONFIRMED",
      }),
    );
    const problem = await prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    assert.equal(problem.status, "PROTOTYPING");
    assert.ok(problem.trialBriefLockedAt);
    assert.equal(await prisma.platformCharge.count(), 0);
    assert.equal(await prisma.projectTransaction.count(), 0);
    assert.equal(await prisma.project.count(), 0);
    assert.equal(await prisma.notification.count(), 3);
    assert.equal(await prisma.notification.count({ where: { userId: "lead" } }), 2);
    assert.equal(await prisma.notification.count({ where: { userId: "delegate" } }), 0);
  });

  it("requires a note for an adjustment request", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "REVISION_REQUESTED",
        }),
      ),
      /ghi chú/i,
    );
  });

  it("rejects a response to an old version", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "CONFIRMED",
        }),
      ),
      /phiên bản mới nhất/i,
    );
  });

  it("enforces group authorization and requires notes without limiting group adjustments", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput(0) }),
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "outsider",
          decision: "CONFIRMED",
        }),
      ),
      /chủ nhóm/i,
    );
    const adjustment = await prisma.$transaction((transaction) =>
      respondToTrialBrief(transaction, {
        problemId,
        version: 1,
        studentUserId: "lead",
        decision: "REVISION_REQUESTED",
        note: "Bổ sung tiêu chí.",
      }),
    );
    assert.equal(adjustment.decision, "REVISION_REQUESTED");
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "REVISION_REQUESTED",
          note: "",
        }),
      ),
      /ghi chú/i,
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "delegate",
          decision: "CONFIRMED",
        }),
      ),
      /chủ nhóm/i,
    );
  });

  it("accepts the configured maximum revision count", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, {
        problemId,
        businessUserId: "business-owner",
        input: briefInput(10),
      }),
    );
    const brief = await prisma.trialBriefVersion.findUniqueOrThrow({
      where: { problemId_version: { problemId, version: 1 } },
    });
    assert.equal(brief.maxRevisionRequests, 10);
  });

  it("validates future deadlines and configured revision bounds", async () => {
    const { prisma } = database;
    await assert.rejects(
      prisma.$transaction((transaction) =>
        createTrialBriefVersion(transaction, {
          problemId,
          businessUserId: "business-owner",
          input: { ...briefInput(), deadline: new Date("2020-01-01T00:00:00.000Z") },
        }),
      ),
      /tương lai/i,
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        createTrialBriefVersion(transaction, {
          problemId,
          businessUserId: "business-owner",
          input: briefInput(11),
        }),
      ),
      /từ 0 đến 10/i,
    );
  });

  it("allows legacy agreement access without a trial brief", () => {
    assert.equal(
      canOpenPaidImplementationAgreement({
        status: "READY_FOR_IMPLEMENTATION",
        prototypeLegacy: true,
        evaluationResult: null,
        implementationDecision: null,
      }),
      true,
    );
    assert.equal(
      canOpenPaidImplementationAgreement({
        status: "READY_FOR_IMPLEMENTATION",
        prototypeLegacy: false,
        evaluationResult: null,
        implementationDecision: null,
      }),
      false,
    );
  });

  it("only allows the legacy Proposal evaluation guard for legacy Problems", () => {
    assert.doesNotThrow(() => assertLegacyEvaluationEnabled(true));
    assert.throws(
      () => assertLegacyEvaluationEnabled(false),
      new RegExp(LEGACY_EVALUATION_DISABLED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("does not create duplicate versions when creation races", async () => {
    const { prisma } = database;
    const results = await Promise.allSettled([
      prisma.$transaction((transaction) =>
        createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
      ),
      prisma.$transaction((transaction) =>
        createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
      ),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    assert.deepEqual(
      (await prisma.trialBriefVersion.findMany({
        where: { problemId },
        orderBy: { version: "asc" },
        select: { version: true },
      })).map(({ version }) => version),
      [1, 2],
    );
  });

  it("keeps TEAM_SELECTED non-legacy until the brief is confirmed", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    const problem = await prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    assert.equal(problem.status, "TEAM_SELECTED");
    assert.equal(problem.prototypeLegacy, false);
  });

  it("rejects every operation after the brief is locked", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await prisma.$transaction((transaction) =>
      respondToTrialBrief(transaction, {
        problemId,
        version: 1,
        studentUserId: "lead",
        decision: "CONFIRMED",
      }),
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "CONFIRMED",
        }),
      ),
      /cập nhật hoặc khóa/i,
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "REVISION_REQUESTED",
          note: "Điều chỉnh",
        }),
      ),
      /cập nhật hoặc khóa/i,
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
      ),
      /chờ hồ sơ|cập nhật hoặc khóa/i,
    );
    assert.equal(await prisma.notification.count(), 3);
  });

  it("rejects a second response by the same party without changing the problem", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await prisma.$transaction((transaction) =>
      respondToTrialBrief(transaction, {
        problemId,
        version: 1,
        studentUserId: "lead",
        decision: "REVISION_REQUESTED",
        note: "Bổ sung tiêu chí.",
      }),
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "CONFIRMED",
        }),
      ),
      /cập nhật.*tải lại|phản hồi/i,
    );
    assert.equal((await prisma.problem.findUniqueOrThrow({ where: { id: problemId } })).status, "TEAM_SELECTED");
    assert.equal(await prisma.trialBriefResponse.count(), 2);
    assert.equal(await prisma.notification.count(), 2);
  });

  it("serializes the real race between confirming v1 and creating v2", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    const results = await Promise.allSettled([
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "CONFIRMED",
        }),
      ),
      prisma.$transaction((transaction) =>
        createTrialBriefVersion(transaction, {
          problemId,
          businessUserId: "business-owner",
          input: briefInput(),
        }),
      ),
    ]);
    const problem = await prisma.problem.findUniqueOrThrow({ where: { id: problemId } });
    const versionCount = await prisma.trialBriefVersion.count({ where: { problemId } });
    if (problem.status === "PROTOTYPING") {
      assert.equal(problem.trialBriefLockedAt !== null, true);
      assert.equal(versionCount, 1);
    } else {
      assert.equal(problem.status, "TEAM_SELECTED");
      assert.equal(problem.trialBriefLockedAt, null);
      assert.equal(versionCount, 2);
    }
    assert.ok(results.some((result) => result.status === "fulfilled"));
  });

  it("rejects a stale group confirmation when business creates a newer version", async () => {
    const { prisma } = database;
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await prisma.$transaction((transaction) =>
      createTrialBriefVersion(transaction, { problemId, businessUserId: "business-owner", input: briefInput() }),
    );
    await assert.rejects(
      prisma.$transaction((transaction) =>
        respondToTrialBrief(transaction, {
          problemId,
          version: 1,
          studentUserId: "lead",
          decision: "CONFIRMED",
        }),
      ),
    );
    assert.equal((await prisma.problem.findUniqueOrThrow({ where: { id: problemId } })).status, "TEAM_SELECTED");
  });
});
