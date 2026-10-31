import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { findAccessibleProject } from "@/lib/project-access";
import {
  createProjectAgreementVersion,
  createProjectWithFirstAgreementVersion,
  getAgreementResponseMode,
  getAgreementErrorMessage,
  getAcceptedProjectAgreementSnapshot,
  respondToLegacyProjectAgreement,
  respondToProjectAgreementVersion,
  saveProjectAgreementVersion,
  staleAgreementMessage,
  type AgreementVersionInput,
} from "@/lib/project-agreements";
import {
  calculateLegacyProjectFinancialBreakdown,
  calculateProjectFinancialBreakdown,
} from "@/lib/project-money";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import {
  assertBusinessCanDeposit,
  recordProjectDeposit,
} from "@/lib/project-deposits";

const agreementInput = (
  title = "Dự án phiên bản 1",
  totalAmount = 1_000_001,
): AgreementVersionInput => ({
  title,
  agreedScope: "Phạm vi công việc",
  deliverables: "Sản phẩm bàn giao",
  duration: "4 tuần",
  totalAmount,
  generalAcceptanceCriteria: "Tiêu chí nghiệm thu chung",
  businessResponsibilities: "Trách nhiệm doanh nghiệp",
  teamResponsibilities: "Trách nhiệm nhóm",
  paymentMethod: "Escrow giả lập",
  maxMilestoneRevisions: 2,
  ownershipTerms: "Quyền sở hữu theo thỏa thuận",
  usageTerms: "Quyền sử dụng theo thỏa thuận",
  confidentialityTerms: "Bảo mật thông tin",
  extensionTerms: "Gia hạn cần hai bên xác nhận",
  suspensionTerms: "Tạm dừng cần hai bên xác nhận",
  terminationTerms: "Chấm dứt theo thỏa thuận",
  disputeTerms: "Bất đồng được ghi nhận để hỗ trợ",
  milestones: [
    {
      title: "Mốc 1",
      description: "Thực hiện mốc 1",
      acceptanceCriteria: "Đạt yêu cầu mốc 1",
      dueAt: "2030-01-15",
      paymentPercent: 70,
    },
    {
      title: "Mốc 2",
      description: "Thực hiện mốc 2",
      acceptanceCriteria: "Đạt yêu cầu mốc 2",
      dueAt: "2030-02-15",
      paymentPercent: 30,
    },
  ],
});

describe("ProjectAgreementVersion SQLite workflow", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let applicationId: string;
  let teamAId: string;

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-project-agreements-import.db";
    database = await createTestDatabase("unibridge-project-agreements");
    const { prisma } = database;
    await prisma.user.createMany({
      data: [
        { id: "team-a-owner", email: "team-a-owner@example.com", name: "Team A", passwordHash: "test", updatedAt: new Date() },
        { id: "team-a-member", email: "team-a-member@example.com", name: "Team A member", passwordHash: "test", updatedAt: new Date() },
        { id: "team-b-owner", email: "team-b-owner@example.com", name: "Team B", passwordHash: "test", updatedAt: new Date() },
        { id: "business-other", email: "business-other@example.com", name: "Other business", passwordHash: "test", updatedAt: new Date() },
      ],
    });
    await prisma.businessProfile.create({
      data: {
        id: "business-other-profile",
        userId: "business-other",
        companyName: "Other business",
        industry: "Công nghệ",
        description: "Khác",
      },
    });
    const [teamAOwner, teamAMember, teamBOwner] = await Promise.all([
      prisma.studentProfile.create({
        data: { id: "team-a-profile", userId: "team-a-owner", major: "CNTT", university: "ĐH A" },
      }),
      prisma.studentProfile.create({
        data: { id: "team-a-member-profile", userId: "team-a-member", major: "CNTT", university: "ĐH A" },
      }),
      prisma.studentProfile.create({
        data: { id: "team-b-profile", userId: "team-b-owner", major: "CNTT", university: "ĐH B" },
      }),
    ]);
    const teamA = await prisma.studentTeam.create({
      data: {
        id: "team-a",
        ownerId: teamAOwner.userId,
        name: "Team A",
        slug: "project-agreement-team-a",
        university: "ĐH A",
        description: "Team A",
        memberships: {
          create: [
            { studentProfileId: teamAOwner.id, title: "Chủ nhóm", isLead: true },
            { studentProfileId: teamAMember.id, title: "Thành viên", isLead: false },
          ],
        },
      },
    });
    teamAId = teamA.id;
    const teamB = await prisma.studentTeam.create({
      data: {
        id: "team-b",
        ownerId: teamBOwner.userId,
        name: "Team B",
        slug: "project-agreement-team-b",
        university: "ĐH B",
        description: "Team B",
      },
    });
    await prisma.problem.create({
      data: {
        id: "agreement-problem-a",
        businessProfileId: "business",
        title: "Problem A",
        slug: "agreement-problem-a",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "READY_FOR_IMPLEMENTATION",
        applications: {
          create: {
            id: "agreement-application-a",
            teamId: teamA.id,
            approach: "Approach A",
            estimatedDuration: "4 tuần",
            status: "SELECTED",
          },
        },
      },
    });
    await prisma.problem.create({
      data: {
        id: "agreement-problem-b",
        businessProfileId: "business-other-profile",
        title: "Problem B",
        slug: "agreement-problem-b",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "READY_FOR_IMPLEMENTATION",
        applications: {
          create: {
            id: "agreement-application-b",
            teamId: teamB.id,
            approach: "Approach B",
            estimatedDuration: "4 tuần",
            status: "SELECTED",
          },
        },
      },
    });
    applicationId = "agreement-application-a";
    await prisma.project.create({
      data: {
        id: "agreement-project-b",
        applicationId: "agreement-application-b",
        teamId: teamB.id,
        title: "Project B",
        agreedScope: "Scope B",
        totalAmount: 50_000,
        legacyTermsExempt: false,
        milestones: {
          create: {
            title: "Mốc B",
            description: "Mốc B",
            sortOrder: 0,
            paymentPercent: 100,
          },
        },
      },
    });
  });

  afterEach(async () => {
    await database.close();
  });

  async function createFirstVersion(input = agreementInput()) {
    return database.prisma.$transaction((transaction) =>
      createProjectWithFirstAgreementVersion(transaction, {
        applicationId,
        teamId: teamAId,
        createdByUserId: "business-owner",
        input,
        team: { ownerId: "team-a-owner", memberships: [] },
        now: new Date("2026-10-31T00:00:00.000Z"),
      }),
    );
  }

  async function createNextVersion(
    projectId: string,
    expectedVersionNumber: number,
    input: AgreementVersionInput,
  ) {
    return database.prisma.$transaction((transaction) =>
      createProjectAgreementVersion(transaction, {
        projectId,
        expectedVersionNumber,
        createdByUserId: "business-owner",
        input,
        now: new Date("2026-10-31T00:00:00.000Z"),
      }),
    );
  }

  it("creates a non-legacy project with immutable versioned terms and no money transaction", async () => {
    const project = await createFirstVersion();
    const stored = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    const version = await database.prisma.projectAgreementVersion.findFirstOrThrow({
      where: { projectId: project.id },
    });

    assert.equal(stored.legacyTermsExempt, false);
    assert.equal(stored.status, "AGREEING");
    assert.equal(stored.businessAcceptedAt, null);
    assert.equal(stored.teamAcceptedAt, null);
    assert.equal(version.versionNumber, 1);
    assert.equal(version.status, "PENDING_TEAM");
    assert.equal(version.businessAcceptedAt?.toISOString(), "2026-10-31T00:00:00.000Z");
    assert.equal(await database.prisma.projectTransaction.count({ where: { projectId: project.id } }), 0);
    assert.equal(
      await database.prisma.notification.count({
        where: { userId: "team-a-owner", dedupeKey: `agreement-version:${project.id}:v1:team-a-owner` },
      }),
      1,
    );
  });

  it("isolates agreement and financial data between projects and accepts only the team owner", async () => {
    const projectA = await createFirstVersion();
    const ownerCanRead = await findAccessibleProject(
      projectA.id,
      "team-a-owner",
      "STUDENT",
      database.prisma,
    );
    const memberCanRead = await findAccessibleProject(
      projectA.id,
      "team-a-member",
      "STUDENT",
      database.prisma,
    );
    assert.ok(ownerCanRead?.agreementVersions[0]);
    assert.ok(memberCanRead?.agreementVersions[0]);
    assert.equal(
      await findAccessibleProject(projectA.id, "team-b-owner", "STUDENT", database.prisma),
      null,
    );
    assert.equal(
      await findAccessibleProject(projectA.id, "business-other", "BUSINESS", database.prisma),
      null,
    );
    assert.ok(
      await findAccessibleProject(projectA.id, "business-owner", "BUSINESS", database.prisma),
    );

    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: projectA.id,
          versionNumber: 1,
          actorUserId: "team-a-member",
          response: "ACCEPT",
        }),
      ),
      /chủ nhóm/,
    );
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: projectA.id,
          versionNumber: 1,
          actorUserId: "business-other",
          response: "ACCEPT",
        }),
      ),
      /chủ nhóm/,
    );
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: projectA.id,
          versionNumber: 1,
          actorUserId: "team-a-member",
          response: "REQUEST_CHANGES",
          note: "Yêu cầu sửa",
        }),
      ),
      /chủ nhóm/,
    );
    assert.equal(await database.prisma.projectTransaction.count(), 0);
    assert.throws(() => assertBusinessCanDeposit("STUDENT"), /Chỉ doanh nghiệp/);
  });

  it("records requests for changes, rejects old versions, and supersedes open requests", async () => {
    const project = await createFirstVersion();
    const transactionsBeforeRequest = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await database.prisma.$transaction((transaction) =>
      respondToProjectAgreementVersion(transaction, {
        projectId: project.id,
        versionNumber: 1,
        actorUserId: "team-a-owner",
        response: "REQUEST_CHANGES",
        note: "Làm rõ quyền sử dụng.",
      }),
    );
    const request = await database.prisma.projectChangeRequest.findFirstOrThrow({
      where: { projectId: project.id, kind: "AGREEMENT_REVISION" },
    });
    assert.equal(request.reason, "Làm rõ quyền sử dụng.");
    assert.equal(
      await database.prisma.notification.count({
        where: { userId: "business-owner", dedupeKey: `agreement-response:${project.id}:v1:business` },
      }),
      1,
    );
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBeforeRequest,
    );

    const transactionsBeforeNewVersion = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await createNextVersion(project.id, 1, agreementInput("Dự án phiên bản 2", 2_000_001));
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBeforeNewVersion,
    );
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: project.id,
          versionNumber: 1,
          actorUserId: "team-a-owner",
          response: "ACCEPT",
        }),
      ),
      new RegExp(staleAgreementMessage),
    );
    const latestRequest = await database.prisma.projectChangeRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    assert.equal(latestRequest.status, "SUPERSEDED");
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      0,
    );
  });

  it("accepts only the latest version, synchronizes its snapshot atomically, and prevents duplicate acceptance", async () => {
    const project = await createFirstVersion();
    const version = await createNextVersion(
      project.id,
      1,
      agreementInput("Phiên bản mới nhất", 2_000_001),
    );
    await database.prisma.project.update({
      where: { id: project.id },
      data: { title: "Giá trị sửa ngoài snapshot", totalAmount: 900_000 },
    });
    const transactionsBeforeAcceptance = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    const confirmations = await Promise.allSettled([
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: project.id,
          versionNumber: version.versionNumber,
          actorUserId: "team-a-owner",
          response: "ACCEPT",
          now: new Date("2026-10-31T01:00:00.000Z"),
        }),
      ),
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: project.id,
          versionNumber: version.versionNumber,
          actorUserId: "team-a-owner",
          response: "ACCEPT",
          now: new Date("2026-10-31T01:00:00.000Z"),
        }),
      ),
    ]);
    assert.equal(confirmations.filter(({ status }) => status === "fulfilled").length, 2);

    const acceptedProject = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    assert.equal(acceptedProject.status, "AWAITING_PAYMENT");
    assert.equal(acceptedProject.title, "Phiên bản mới nhất");
    assert.equal(acceptedProject.totalAmount, 2_000_001);
    assert.deepEqual(
      acceptedProject.milestones.map(({ paymentPercent }) => paymentPercent),
      [70, 30],
    );
    assert.equal(acceptedProject.businessAcceptedAt, null);
    assert.equal(acceptedProject.teamAcceptedAt, null);
    assert.equal(acceptedProject.agreementRevision, 1);
    assert.equal(
      await database.prisma.notification.count({
        where: { dedupeKey: { startsWith: `agreement-awaiting-payment:${project.id}:v2:` } },
      }),
      3,
    );
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBeforeAcceptance,
    );
  });

  it("rolls back version acceptance when its milestone snapshot is invalid", async () => {
    const project = await createFirstVersion();
    const transactionsBeforeAcceptance = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await database.prisma.projectAgreementVersion.update({
      where: { projectId_versionNumber: { projectId: project.id, versionNumber: 1 } },
      data: {
        milestonesSnapshot: JSON.stringify([
          { title: "Invalid", description: "Invalid", acceptanceCriteria: "Invalid", dueAt: "2030-01-15", paymentPercent: 99 },
        ]),
      },
    });
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        respondToProjectAgreementVersion(transaction, {
          projectId: project.id,
          versionNumber: 1,
          actorUserId: "team-a-owner",
          response: "ACCEPT",
        }),
      ),
      /tổng bằng 100%/,
    );
    const version = await database.prisma.projectAgreementVersion.findUniqueOrThrow({
      where: { projectId_versionNumber: { projectId: project.id, versionNumber: 1 } },
    });
    const storedProject = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(version.status, "PENDING_TEAM");
    assert.equal(version.teamAcceptedAt, null);
    assert.equal(storedProject.status, "AGREEING");
    assert.equal(await database.prisma.notification.count({ where: { userId: "business-owner" } }), 0);
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBeforeAcceptance,
    );
  });

  it("requires both version signatures for deposit terms and uses the signed snapshot, not mutable Project fields", async () => {
    const project = await createFirstVersion(agreementInput("Signed amount", 3_000_001));
    await assert.rejects(
      database.prisma.$transaction((transaction) =>
        getAcceptedProjectAgreementSnapshot(transaction, project.id),
      ),
      /Chưa có phiên bản thỏa thuận/,
    );
    await assert.rejects(
      recordProjectDeposit(database.prisma, { projectId: project.id }),
      /chưa được hai bên đồng ý/,
    );
    const transactionsBeforeResponse = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await database.prisma.$transaction((transaction) =>
      respondToProjectAgreementVersion(transaction, {
        projectId: project.id,
        versionNumber: 1,
        actorUserId: "team-a-owner",
        response: "ACCEPT",
      }),
    );
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBeforeResponse,
    );
    await database.prisma.project.update({
      where: { id: project.id },
      data: { totalAmount: 777, title: "Giá trị bị sửa", milestones: { updateMany: {
        where: { projectId: project.id },
        data: { paymentPercent: 100, title: "Milestone bị sửa", amount: 777 },
      } } },
    });
    const concurrentDeposits = await Promise.allSettled([
      recordProjectDeposit(database.prisma, {
        projectId: project.id,
        now: new Date("2026-10-31T02:00:00.000Z"),
      }),
      recordProjectDeposit(database.prisma, {
        projectId: project.id,
        now: new Date("2026-10-31T02:00:00.000Z"),
      }),
    ]);
    assert.equal(
      concurrentDeposits.filter(
        (result) => result.status === "fulfilled" && !result.value.alreadyDeposited,
      ).length,
      1,
    );
    assert.equal(
      concurrentDeposits.filter(
        (result) => result.status === "fulfilled" && result.value.alreadyDeposited,
      ).length,
      1,
    );
    const deposit = concurrentDeposits.find(
      (result) => result.status === "fulfilled" && !result.value.alreadyDeposited,
    );
    assert.ok(deposit && deposit.status === "fulfilled");
    const depositBreakdown = deposit.value.breakdown;
    assert.equal(depositBreakdown.totalDeposit, 3_300_001);
    assert.equal(
      depositBreakdown.totalTeamAmount + depositBreakdown.totalPlatformFee,
      depositBreakdown.totalDeposit,
    );
    assert.deepEqual(
      depositBreakdown.milestones.map(({ grossAmount }) => grossAmount),
      [2_100_000, 900_001],
    );
    const stored = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    assert.equal(stored.totalAmount, 3_000_001);
    assert.equal(stored.title, "Signed amount");
    assert.deepEqual(stored.milestones.map(({ paymentPercent }) => paymentPercent), [70, 30]);
    const transaction = await database.prisma.projectTransaction.findFirstOrThrow({
      where: { projectId: project.id, type: "DEPOSIT" },
    });
    assert.equal(transaction.amount, 3_300_001);
    assert.equal(transaction.platformFee, depositBreakdown.totalPlatformFee);
    assert.equal(transaction.businessFeeBasisPoints, businessFeeRate);
    assert.equal(transaction.studentFeeBasisPoints, studentFeeRate);
    assert.equal(transaction.businessFee, depositBreakdown.totalBusinessFee);
    assert.equal(
      transaction.amount,
      depositBreakdown.totalTeamAmount + transaction.platformFee,
    );
  });

  it("blocks version creation through both save paths after deposit without changing project data", async () => {
    const project = await createFirstVersion();
    await database.prisma.$transaction((transaction) =>
      respondToProjectAgreementVersion(transaction, {
        projectId: project.id,
        versionNumber: 1,
        actorUserId: "team-a-owner",
        response: "ACCEPT",
      }),
    );
    await recordProjectDeposit(database.prisma, {
      projectId: project.id,
      now: new Date("2026-10-31T02:00:00.000Z"),
    });
    const versionCount = await database.prisma.projectAgreementVersion.count({
      where: { projectId: project.id },
    });
    const projectBeforeBlockedSaves = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    await assert.rejects(
      createNextVersion(project.id, 1, agreementInput("After deposit")),
      /không thể tạo phiên bản mới/,
    );
    await assert.rejects(
      database.prisma.$transaction((transactionClient) =>
        saveProjectAgreementVersion(transactionClient, {
          projectId: project.id,
          expectedVersionNumber: versionCount,
          createdByUserId: "business-owner",
          input: agreementInput("Via save flow"),
          team: { ownerId: "team-a-owner", memberships: [] },
        }),
      ),
      /sau khi nạp hoặc đổi trạng thái/,
    );
    assert.equal(
      await database.prisma.projectAgreementVersion.count({ where: { projectId: project.id } }),
      versionCount,
    );
    assert.deepEqual(
      await database.prisma.project.findUniqueOrThrow({
        where: { id: project.id },
        include: { milestones: { orderBy: { sortOrder: "asc" } } },
      }),
      projectBeforeBlockedSaves,
    );
    assert.equal(
      await database.prisma.projectTransaction.count({
        where: { projectId: project.id, type: "DEPOSIT" },
      }),
      1,
    );
  });

  it("creates only one escrow deposit for repeated or concurrent requests with different idempotency keys", async () => {
    const project = await createFirstVersion(agreementInput("Deposit idempotency", 1_000_003));
    await database.prisma.$transaction((transaction) =>
      respondToProjectAgreementVersion(transaction, {
        projectId: project.id,
        versionNumber: 1,
        actorUserId: "team-a-owner",
        response: "ACCEPT",
      }),
    );
    const concurrent = await Promise.allSettled([
      recordProjectDeposit(database.prisma, {
        projectId: project.id,
        idempotencyKey: `deposit:${project.id}:tab-a`,
      }),
      recordProjectDeposit(database.prisma, {
        projectId: project.id,
        idempotencyKey: `deposit:${project.id}:tab-b`,
      }),
    ]);
    assert.equal(
      concurrent.filter(
        (result) => result.status === "fulfilled" && !result.value.alreadyDeposited,
      ).length,
      1,
    );
    assert.equal(
      concurrent.filter(
        (result) => result.status === "fulfilled" && result.value.alreadyDeposited,
      ).length,
      1,
    );

    const repeated = await Promise.all([
      recordProjectDeposit(database.prisma, { projectId: project.id }),
      recordProjectDeposit(database.prisma, {
        projectId: project.id,
        idempotencyKey: `deposit:${project.id}:new-key`,
      }),
    ]);
    assert.ok(repeated.every(({ alreadyDeposited }) => alreadyDeposited));
    const deposits = await database.prisma.projectTransaction.findMany({
      where: { projectId: project.id, type: "DEPOSIT" },
    });
    assert.equal(deposits.length, 1);
    const deposit = deposits[0];
    assert.ok(deposit);
    const financials = calculateProjectFinancialBreakdown(
      1_000_003,
      [70, 30],
      businessFeeRate,
      studentFeeRate,
    );
    assert.equal(deposit.amount, financials.totalDeposit);
    assert.equal(deposit.amount, financials.totalTeamAmount + deposit.platformFee);
    assert.equal(deposit.platformFee, financials.totalPlatformFee);
    assert.equal(
      await database.prisma.projectTransaction.count({
        where: { projectId: project.id, type: "DEPOSIT" },
      }),
      1,
    );
  });

  it("rejects stale simultaneous version submissions and keeps one version number", async () => {
    const project = await createFirstVersion();
    const attempts = await Promise.allSettled([
      createNextVersion(project.id, 1, agreementInput("Version 2A")),
      createNextVersion(project.id, 1, agreementInput("Version 2B")),
    ]);
    assert.equal(attempts.filter(({ status }) => status === "fulfilled").length, 1);
    const concurrentFailure = attempts.find(({ status }) => status === "rejected");
    assert.ok(concurrentFailure && concurrentFailure.status === "rejected");
    assert.equal(
      getAgreementErrorMessage(concurrentFailure.reason) ??
        (concurrentFailure.reason instanceof Error
          ? concurrentFailure.reason.message
          : null),
      staleAgreementMessage,
    );
    const versions = await database.prisma.projectAgreementVersion.findMany({
      where: { projectId: project.id },
      orderBy: { versionNumber: "asc" },
    });
    assert.deepEqual(versions.map(({ versionNumber }) => versionNumber), [1, 2]);
    const retry = await Promise.allSettled([
      createNextVersion(project.id, 1, agreementInput("Stale tab")),
    ]);
    assert.equal(retry[0]?.status, "rejected");
    if (retry[0]?.status === "rejected") {
      assert.equal(
        retry[0].reason instanceof Error ? retry[0].reason.message : "",
        staleAgreementMessage,
      );
    }
    assert.equal(await database.prisma.projectTransaction.count({ where: { projectId: project.id } }), 0);
  });

  it("leaves legacy projects outside the versioned workflow", async () => {
    const legacy = await database.prisma.project.create({
      data: {
        id: "legacy-project",
        applicationId: "agreement-application-a",
        teamId: teamAId,
        title: "Legacy project",
        agreedScope: "Legacy scope",
        totalAmount: 123_456,
        legacyTermsExempt: true,
        status: "AGREEING",
        businessAcceptedAt: null,
        teamAcceptedAt: null,
      },
    });
    const before = {
      title: legacy.title,
      totalAmount: legacy.totalAmount,
      status: legacy.status,
      businessAcceptedAt: legacy.businessAcceptedAt,
      teamAcceptedAt: legacy.teamAcceptedAt,
      agreementRevision: legacy.agreementRevision,
    };
    await assert.rejects(
      createNextVersion(legacy.id, 0, agreementInput()),
      /không thể tạo phiên bản mới/,
    );
    const after = await database.prisma.project.findUniqueOrThrow({
      where: { id: legacy.id },
    });
    assert.deepEqual(
      {
        title: after.title,
        totalAmount: after.totalAmount,
        status: after.status,
        businessAcceptedAt: after.businessAcceptedAt,
        teamAcceptedAt: after.teamAcceptedAt,
        agreementRevision: after.agreementRevision,
      },
      before,
    );
    assert.equal(await database.prisma.projectAgreementVersion.count({ where: { projectId: legacy.id } }), 0);
    assert.equal(await database.prisma.projectTransaction.count({ where: { projectId: legacy.id } }), 0);
  });

  it("blocks legacy acceptance for new projects while preserving the legacy agreement and 15% deposit flow", async () => {
    const nonLegacy = await createFirstVersion();
    assert.throws(
      () =>
        getAgreementResponseMode({
          legacyTermsExempt: false,
          role: "BUSINESS",
          teamOwnerId: "team-a-owner",
          actorUserId: "business-owner",
        }),
      /phiên bản điều khoản/,
    );
    assert.equal(
      getAgreementResponseMode({
          legacyTermsExempt: false,
          role: "STUDENT",
          teamOwnerId: "team-a-owner",
          actorUserId: "team-a-owner",
        }),
      "VERSIONED",
    );
    for (const [role, actorUserId] of [
      ["BUSINESS", "business-owner"],
      ["STUDENT", "team-a-owner"],
    ] as const) {
      await assert.rejects(
        database.prisma.$transaction((transaction) =>
          respondToLegacyProjectAgreement(transaction, {
            projectId: nonLegacy.id,
            actorUserId,
            role,
            response: "ACCEPT",
          }),
        ),
        /phiên bản điều khoản/,
      );
    }
    assert.equal(await database.prisma.projectTransaction.count({ where: { projectId: nonLegacy.id } }), 0);

    await database.prisma.problem.create({
      data: {
        id: "legacy-agreement-problem",
        businessProfileId: "business",
        title: "Legacy problem",
        slug: "legacy-agreement-problem",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "4 tuần",
        status: "READY_FOR_IMPLEMENTATION",
        applications: {
          create: {
            id: "legacy-agreement-application",
            teamId: teamAId,
            approach: "Legacy approach",
            estimatedDuration: "4 tuần",
            status: "SELECTED",
          },
        },
      },
    });
    const legacy = await database.prisma.project.create({
      data: {
        id: "legacy-project-acceptance",
        applicationId: "legacy-agreement-application",
        teamId: teamAId,
        title: "Legacy project",
        agreedScope: "Legacy scope",
        totalAmount: 123_456,
        legacyTermsExempt: true,
        status: "AGREEING",
        milestones: {
          create: {
            title: "Legacy milestone",
            description: "Legacy work",
            sortOrder: 0,
            paymentPercent: 100,
            amount: 123_456,
          },
        },
      },
    });
    const before = {
      title: legacy.title,
      totalAmount: legacy.totalAmount,
      milestoneAmount: 123_456,
      agreementRevision: legacy.agreementRevision,
    };
    for (const [role, actorUserId] of [
      ["BUSINESS", "business-owner"],
      ["STUDENT", "team-a-owner"],
    ] as const) {
      await database.prisma.$transaction((transaction) =>
        respondToLegacyProjectAgreement(transaction, {
          projectId: legacy.id,
          actorUserId,
          role,
          response: "ACCEPT",
          now: new Date("2026-10-31T03:00:00.000Z"),
        }),
      );
    }
    const agreed = await database.prisma.project.findUniqueOrThrow({
      where: { id: legacy.id },
      include: { milestones: true },
    });
    assert.equal(agreed.status, "AWAITING_PAYMENT");
    assert.equal(agreed.title, before.title);
    assert.equal(agreed.totalAmount, before.totalAmount);
    assert.equal(agreed.agreementRevision, before.agreementRevision);
    assert.equal(agreed.milestones[0]?.amount, before.milestoneAmount);
    const expected = calculateLegacyProjectFinancialBreakdown(
      before.totalAmount,
      [100],
      legacyPlatformFeeRate,
    );
    const deposit = await recordProjectDeposit(database.prisma, {
      projectId: legacy.id,
      now: new Date("2026-10-31T04:00:00.000Z"),
    });
    assert.equal(deposit.breakdown.totalDeposit, before.totalAmount);
    assert.equal(deposit.breakdown.totalPlatformFee, expected.totalPlatformFee);
    assert.equal(deposit.breakdown.totalTeamAmount, expected.totalTeamAmount);
    assert.equal(deposit.breakdown.platformFeeBasisPoints, legacyPlatformFeeRate);
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: legacy.id } }),
      1,
    );
  });
});
