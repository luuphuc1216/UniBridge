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
import {
  acceptLegacyMilestone,
  acceptPaidMilestone,
  acceptProjectFinalCompletion,
  ensurePaidMilestoneReminders,
  getPaidMilestoneOverdueStatus,
  requestPaidMilestoneRevision,
  submitPaidMilestone,
  updatePaidMilestoneProgress,
} from "@/lib/project-milestone-workflow";
import { projectReminderConfig, projectReminderHourMs } from "@/lib/project-reminder-config";

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

  async function fundProject(projectId: string, now = new Date("2026-10-31T02:00:00.000Z")) {
    await database.prisma.$transaction((transaction) =>
      respondToProjectAgreementVersion(transaction, {
        projectId,
        versionNumber: 1,
        actorUserId: "team-a-owner",
        response: "ACCEPT",
        now,
      }),
    );
    return recordProjectDeposit(database.prisma, { projectId, now });
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

  it("tracks progress, enforces owner-only sequential work, and submits for acceptance with a configured response deadline", async () => {
    const project = await createFirstVersion();
    const transactionCountBeforeFunding = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await fundProject(project.id);
    const milestones = await database.prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: "asc" },
    });
    const [first, second] = milestones;
    assert.ok(first && second);
    assert.deepEqual(
      milestones.map(({ status, acceptanceStatus, paymentStatus }) => ({
        status,
        acceptanceStatus,
        paymentStatus,
      })),
      [
        { status: "NOT_STARTED", acceptanceStatus: "NOT_SUBMITTED", paymentStatus: "ESCROW" },
        { status: "NOT_STARTED", acceptanceStatus: "NOT_SUBMITTED", paymentStatus: "ESCROW" },
      ],
    );
    assert.equal(
      await database.prisma.projectWorkflowEvent.count({
        where: { projectId: project.id, eventType: "PROJECT_DEPOSIT_RECORDED" },
      }),
      1,
    );

    await assert.rejects(
      updatePaidMilestoneProgress(database.prisma, {
        projectId: project.id,
        milestoneId: second.id,
        actorUserId: "team-a-owner",
        progressPercent: 10,
        workCompleted: "Đã làm",
        difficulties: "",
      }),
      /đúng thứ tự/,
    );
    await assert.rejects(
      updatePaidMilestoneProgress(database.prisma, {
        projectId: project.id,
        milestoneId: first.id,
        actorUserId: "team-a-member",
        progressPercent: 10,
        workCompleted: "Đã làm",
        difficulties: "",
      }),
      /chủ nhóm/,
    );
    await assert.rejects(
      updatePaidMilestoneProgress(database.prisma, {
        projectId: project.id,
        milestoneId: first.id,
        actorUserId: "team-a-owner",
        progressPercent: 101,
        workCompleted: "Đã làm",
        difficulties: "",
      }),
      /0 đến 100/,
    );
    const transactionsBeforeProgress = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    const now = new Date("2026-10-31T02:05:00.000Z");
    await updatePaidMilestoneProgress(database.prisma, {
      projectId: project.id,
      milestoneId: first.id,
      actorUserId: "team-a-owner",
      progressPercent: 0,
      workCompleted: "Đã bắt đầu phân tích yêu cầu.",
      difficulties: "Chưa có khó khăn.",
      now,
    });
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBeforeProgress,
    );
    const firstAfterProgress = await database.prisma.milestone.findUniqueOrThrow({
      where: { id: first.id },
      include: { progressUpdates: true },
    });
    assert.deepEqual(
      {
        status: firstAfterProgress.status,
        acceptanceStatus: firstAfterProgress.acceptanceStatus,
        paymentStatus: firstAfterProgress.paymentStatus,
        percent: firstAfterProgress.progressPercent,
        history: firstAfterProgress.progressUpdates.length,
      },
      {
        status: "IN_PROGRESS",
        acceptanceStatus: "NOT_SUBMITTED",
        paymentStatus: "ESCROW",
        percent: 0,
        history: 1,
      },
    );
    await submitPaidMilestone(database.prisma, {
      projectId: project.id,
      milestoneId: first.id,
      actorUserId: "team-a-owner",
      note: "Đã hoàn thành phân tích yêu cầu.",
      links: ["https://example.test/deliverable"],
      now,
    });
    const submitted = await database.prisma.milestone.findUniqueOrThrow({
      where: { id: first.id },
      include: { submissions: true },
    });
    assert.equal(submitted.status, "AWAITING_ACCEPTANCE");
    assert.equal(submitted.acceptanceStatus, "AWAITING_ACCEPTANCE");
    assert.equal(submitted.paymentStatus, "ESCROW");
    assert.equal(
      submitted.responseDueAt?.getTime(),
      now.getTime() + projectReminderConfig.businessAcceptanceResponseHours * projectReminderHourMs,
    );
    assert.equal(submitted.submissions.length, 1);
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionCountBeforeFunding + 1,
    );
  });

  it("enforces the signed milestone revision limit without creating money transactions", async () => {
    const project = await createFirstVersion();
    await fundProject(project.id);
    const milestone = await database.prisma.milestone.findFirstOrThrow({
      where: { projectId: project.id, sortOrder: 0 },
    });
    const startingTransactionCount = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    const now = new Date("2026-10-31T05:00:00.000Z");
    await updatePaidMilestoneProgress(database.prisma, {
      projectId: project.id,
      milestoneId: milestone.id,
      actorUserId: "team-a-owner",
      progressPercent: 100,
      workCompleted: "Đã hoàn thành công việc trước khi bàn giao.",
      difficulties: "",
      now,
    });
    for (let revision = 1; revision <= 2; revision += 1) {
      await submitPaidMilestone(database.prisma, {
        projectId: project.id,
        milestoneId: milestone.id,
        actorUserId: "team-a-owner",
        note: `Bàn giao lần ${revision} đủ mô tả.`,
        links: [],
        now,
      });
      await requestPaidMilestoneRevision(database.prisma, {
        projectId: project.id,
        milestoneId: milestone.id,
        actorUserId: "business-owner",
        feedback: `Cần chỉnh sửa lần ${revision}.`,
        now,
      });
      const state = await database.prisma.milestone.findUniqueOrThrow({
        where: { id: milestone.id },
      });
      assert.equal(state.status, "NEEDS_REVISION");
      assert.equal(state.acceptanceStatus, "NEEDS_REVISION");
      assert.equal(state.paymentStatus, "ESCROW");
      assert.equal(state.revisionCount, revision);
      assert.equal(
        await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
        startingTransactionCount,
      );
    }
    await submitPaidMilestone(database.prisma, {
      projectId: project.id,
      milestoneId: milestone.id,
      actorUserId: "team-a-owner",
      note: "Bàn giao sau lần chỉnh sửa thứ hai.",
      links: [],
      now,
    });
    await assert.rejects(
      requestPaidMilestoneRevision(database.prisma, {
        projectId: project.id,
        milestoneId: milestone.id,
        actorUserId: "business-owner",
        feedback: "Yêu cầu vượt hạn mức.",
        now,
      }),
      /lập phiên bản điều khoản mới hoặc mở bất đồng/,
    );
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      startingTransactionCount,
    );
  });

  it("opens each next milestone, records escrow for all milestones, and preserves the 13m VND ledger invariant", async () => {
    const project = await createFirstVersion({
      ...agreementInput("Three milestone ledger", 13_000_000),
      milestones: [
        {
          title: "Mốc 1",
          description: "Phân tích yêu cầu",
          acceptanceCriteria: "Đạt yêu cầu",
          dueAt: "2030-01-15",
          paymentPercent: 40,
        },
        {
          title: "Mốc 2",
          description: "Xây dựng chức năng",
          acceptanceCriteria: "Đạt yêu cầu",
          dueAt: "2030-02-15",
          paymentPercent: 50,
        },
        {
          title: "Mốc 3",
          description: "Kiểm thử và bàn giao",
          acceptanceCriteria: "Đạt yêu cầu",
          dueAt: "2030-03-15",
          paymentPercent: 10,
        },
      ],
    });
    const funded = await fundProject(project.id);
    const milestoneIds = (
      await database.prisma.milestone.findMany({
        where: { projectId: project.id },
        orderBy: { sortOrder: "asc" },
      })
    ).map(({ id }) => id);
    assert.equal(milestoneIds.length, 3);

    const assertLedgerInvariant = async (expectedEscrow: number) => {
      const transactions = await database.prisma.projectTransaction.findMany({
        where: { projectId: project.id },
      });
      const deposits = transactions.filter(({ type }) => type === "DEPOSIT");
      const releases = transactions.filter(({ type }) => type === "MILESTONE_RELEASE");
      const deposited = deposits.reduce((sum, { amount }) => sum + amount, 0);
      const businessFees = deposits.reduce((sum, { businessFee }) => sum + (businessFee ?? 0), 0);
      const teamNet = releases.reduce((sum, { amount }) => sum + amount, 0);
      const teamFees = releases.reduce((sum, { platformFee }) => sum + platformFee, 0);
      const escrow = deposited - businessFees - teamNet - teamFees;

      assert.equal(deposited, 14_300_000);
      assert.equal(deposited, businessFees + teamNet + teamFees + escrow);
      assert.equal(escrow, expectedEscrow);
      return { teamNet, businessFees, teamFees };
    };

    assert.equal(funded.breakdown.totalDeposit, 14_300_000);
    assert.deepEqual(
      (
        await database.prisma.milestone.findMany({
          where: { projectId: project.id },
          orderBy: { sortOrder: "asc" },
        })
      ).map(({ paymentStatus }) => paymentStatus),
      ["ESCROW", "ESCROW", "ESCROW"],
    );
    await assertLedgerInvariant(13_000_000);

    for (const [index, milestoneId] of milestoneIds.entries()) {
      await updatePaidMilestoneProgress(database.prisma, {
        projectId: project.id,
        milestoneId,
        actorUserId: "team-a-owner",
        progressPercent: 60,
        workCompleted: `Đã hoàn thành công việc mốc ${index + 1}.`,
        difficulties: "",
      });
      await assertLedgerInvariant([13_000_000, 7_800_000, 1_300_000][index]!);
      await submitPaidMilestone(database.prisma, {
        projectId: project.id,
        milestoneId,
        actorUserId: "team-a-owner",
        note: `Bàn giao mốc ${index + 1}.`,
        links: [],
      });
      await assertLedgerInvariant([13_000_000, 7_800_000, 1_300_000][index]!);

      const accepted = await acceptPaidMilestone(database.prisma, {
        projectId: project.id,
        milestoneId,
        actorUserId: "business-owner",
        now: new Date(`2026-10-31T0${6 + index}:00:00.000Z`),
      });
      assert.equal(accepted.alreadyAccepted, false);
      const stateAfterAcceptance = await database.prisma.milestone.findUniqueOrThrow({
        where: { id: milestoneId },
        include: { progressUpdates: true },
      });
      assert.equal(stateAfterAcceptance.status, "ACCEPTED");
      assert.equal(stateAfterAcceptance.progressPercent, 100);
      assert.equal(stateAfterAcceptance.progressUpdates.length, 1);
      assert.equal(
        await database.prisma.projectTransaction.count({
          where: { projectId: project.id, milestoneId, type: "MILESTONE_RELEASE" },
        }),
        1,
      );
      const { teamNet, businessFees, teamFees } = await assertLedgerInvariant(
        [7_800_000, 1_300_000, 0][index]!,
      );
      if (index === 0) {
        assert.deepEqual(
          { teamNet, businessFees, teamFees },
          { teamNet: 4_940_000, businessFees: 1_300_000, teamFees: 260_000 },
        );
      }

      const duplicate = await acceptPaidMilestone(database.prisma, {
        projectId: project.id,
        milestoneId,
        actorUserId: "business-owner",
      });
      assert.equal(duplicate.alreadyAccepted, true);
      assert.equal(
        await database.prisma.projectTransaction.count({
          where: { projectId: project.id, milestoneId, type: "MILESTONE_RELEASE" },
        }),
        1,
      );
      await assertLedgerInvariant([7_800_000, 1_300_000, 0][index]!);

      if (index < milestoneIds.length - 1) {
        const nextMilestone = await database.prisma.milestone.findUniqueOrThrow({
          where: { id: milestoneIds[index + 1] },
        });
        assert.equal(nextMilestone.status, "NOT_STARTED");
        assert.equal(nextMilestone.paymentStatus, "ESCROW");
      }
    }

    const finalLedger = await assertLedgerInvariant(0);
    assert.deepEqual(finalLedger, {
      teamNet: 12_350_000,
      businessFees: 1_300_000,
      teamFees: 650_000,
    });
  });

  it("releases each milestone once, preserves escrow invariants, and waits for final business acceptance", async () => {
    const project = await createFirstVersion(agreementInput("Final acceptance", 1_000_003));
    const funded = await fundProject(project.id);
    const milestones = await database.prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: "asc" },
    });
    const [first, second] = milestones;
    assert.ok(first && second);
    const transactionCountAfterDeposit = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await assert.rejects(
      acceptProjectFinalCompletion(database.prisma, {
        projectId: project.id,
        actorUserId: "business-owner",
      }),
      /chưa đủ điều kiện/,
    );
    await updatePaidMilestoneProgress(database.prisma, {
      projectId: project.id,
      milestoneId: first.id,
      actorUserId: "team-a-owner",
      progressPercent: 100,
      workCompleted: "Đã hoàn tất mốc đầu tiên.",
      difficulties: "",
    });
    await submitPaidMilestone(database.prisma, {
      projectId: project.id,
      milestoneId: first.id,
      actorUserId: "team-a-owner",
      note: "Bàn giao mốc phân tích đã hoàn tất.",
      links: [],
    });
    const firstAccepts = await Promise.all([
      acceptPaidMilestone(database.prisma, {
        projectId: project.id,
        milestoneId: first.id,
        actorUserId: "business-owner",
        now: new Date("2026-10-31T06:00:00.000Z"),
      }),
      acceptPaidMilestone(database.prisma, {
        projectId: project.id,
        milestoneId: first.id,
        actorUserId: "business-owner",
        now: new Date("2026-10-31T06:00:00.000Z"),
      }),
    ]);
    assert.equal(firstAccepts.filter(({ alreadyAccepted }) => !alreadyAccepted).length, 1);
    assert.equal(firstAccepts.filter(({ alreadyAccepted }) => alreadyAccepted).length, 1);
    const firstAfterAcceptance = await database.prisma.milestone.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.deepEqual(
      {
        status: firstAfterAcceptance.status,
        acceptanceStatus: firstAfterAcceptance.acceptanceStatus,
        paymentStatus: firstAfterAcceptance.paymentStatus,
      },
      { status: "ACCEPTED", acceptanceStatus: "ACCEPTED", paymentStatus: "RELEASED" },
    );
    assert.equal(
      await database.prisma.projectTransaction.count({
        where: { projectId: project.id, type: "MILESTONE_RELEASE" },
      }),
      1,
    );
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionCountAfterDeposit + 1,
    );

    const secondProgressTransactionCount = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await updatePaidMilestoneProgress(database.prisma, {
      projectId: project.id,
      milestoneId: second.id,
      actorUserId: "team-a-owner",
      progressPercent: 75,
      workCompleted: "Đã hoàn thành phần lớn chức năng.",
      difficulties: "Đang kiểm thử tích hợp.",
    });
    await submitPaidMilestone(database.prisma, {
      projectId: project.id,
      milestoneId: second.id,
      actorUserId: "team-a-owner",
      note: "Bàn giao mốc xây dựng chức năng.",
      links: [],
    });
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      secondProgressTransactionCount,
    );
    const lastAcceptance = await acceptPaidMilestone(database.prisma, {
      projectId: project.id,
      milestoneId: second.id,
      actorUserId: "business-owner",
      now: new Date("2026-10-31T07:00:00.000Z"),
    });
    assert.equal(lastAcceptance.finalAcceptancePending, true);
    const awaitingFinal = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { milestones: true, transactions: true },
    });
    assert.equal(awaitingFinal.status, "IN_PROGRESS");
    assert.equal(awaitingFinal.finalAcceptanceStatus, "AWAITING_FINAL_ACCEPTANCE");
    assert.equal(awaitingFinal.completedAt, null);
    assert.equal(awaitingFinal.transactions.find(({ type }) => type === "DEPOSIT")?.status, "RELEASED");
    assert.ok(
      awaitingFinal.milestones.every(
        ({ status, acceptanceStatus, paymentStatus }) =>
          status === "ACCEPTED" &&
          acceptanceStatus === "ACCEPTED" &&
          paymentStatus === "RELEASED",
      ),
    );
    const releases = awaitingFinal.transactions.filter(
      ({ type }) => type === "MILESTONE_RELEASE",
    );
    assert.equal(releases.reduce((sum, { amount }) => sum + amount, 0), funded.breakdown.totalTeamAmount);
    assert.equal(
      funded.breakdown.totalDeposit,
      funded.breakdown.totalTeamAmount + funded.breakdown.totalPlatformFee,
    );
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionCountAfterDeposit + 2,
    );
    await assert.rejects(
      acceptProjectFinalCompletion(database.prisma, {
        projectId: project.id,
        actorUserId: "business-other",
      }),
      /Chỉ doanh nghiệp sở hữu/,
    );
    const finalAt = new Date("2026-10-31T08:00:00.000Z");
    const finalFirst = await acceptProjectFinalCompletion(database.prisma, {
      projectId: project.id,
      actorUserId: "business-owner",
      now: finalAt,
    });
    const finalSecond = await acceptProjectFinalCompletion(database.prisma, {
      projectId: project.id,
      actorUserId: "business-owner",
      now: new Date(finalAt.getTime() + 1),
    });
    assert.equal(finalFirst.alreadyCompleted, false);
    assert.equal(finalSecond.alreadyCompleted, true);
    const completed = await database.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.finalAcceptanceStatus, "ACCEPTED");
    assert.equal(completed.finalAcceptedAt?.getTime(), finalAt.getTime());
    assert.equal(completed.finalAcceptedById, "business-owner");
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionCountAfterDeposit + 2,
    );
    assert.equal(
      await database.prisma.projectWorkflowEvent.count({
        where: { projectId: project.id, eventType: "PROJECT_FINAL_ACCEPTED" },
      }),
      1,
    );
  });

  it("computes overdue states on read, deduplicates reminders, and never changes milestone workflow state", async () => {
    const project = await createFirstVersion();
    await fundProject(project.id);
    const milestone = await database.prisma.milestone.findFirstOrThrow({
      where: { projectId: project.id, sortOrder: 0 },
    });
    const now = new Date("2026-10-31T10:00:00.000Z");
    const pastDue = new Date(now.getTime() - 1);
    await database.prisma.milestone.update({
      where: { id: milestone.id },
      data: { dueAt: pastDue },
    });
    const beforeReminder = await database.prisma.milestone.findUniqueOrThrow({
      where: { id: milestone.id },
    });
    assert.equal(getPaidMilestoneOverdueStatus(beforeReminder, now).status, "OVERDUE");
    const transactionsBefore = await database.prisma.projectTransaction.count({
      where: { projectId: project.id },
    });
    await ensurePaidMilestoneReminders(project.id, {
      database: database.prisma,
      clock: { now: () => now },
    });
    await ensurePaidMilestoneReminders(project.id, {
      database: database.prisma,
      clock: { now: () => now },
    });
    assert.equal(
      await database.prisma.notification.count({
        where: { dedupeKey: `paid-milestone-overdue:${milestone.id}:OVERDUE:team-a-owner` },
      }),
      1,
    );
    await updatePaidMilestoneProgress(database.prisma, {
      projectId: project.id,
      milestoneId: milestone.id,
      actorUserId: "team-a-owner",
      progressPercent: 100,
      workCompleted: "Đã hoàn tất trước khi nộp.",
      difficulties: "",
      now,
    });
    await submitPaidMilestone(database.prisma, {
      projectId: project.id,
      milestoneId: milestone.id,
      actorUserId: "team-a-owner",
      note: "Bàn giao để kiểm tra thời hạn phản hồi.",
      links: [],
      now,
    });
    const responseDeadline = new Date(
      now.getTime() +
        projectReminderConfig.businessAcceptanceResponseHours * projectReminderHourMs,
    );
    assert.equal(
      getPaidMilestoneOverdueStatus(
        {
          ...beforeReminder,
          status: "AWAITING_ACCEPTANCE",
          acceptanceStatus: "AWAITING_ACCEPTANCE",
          responseDueAt: responseDeadline,
        },
        responseDeadline,
      ).status,
      "AWAITING_RESPONSE_OVERDUE",
    );
    await ensurePaidMilestoneReminders(project.id, {
      database: database.prisma,
      clock: { now: () => responseDeadline },
    });
    await ensurePaidMilestoneReminders(project.id, {
      database: database.prisma,
      clock: { now: () => responseDeadline },
    });
    assert.equal(
      await database.prisma.notification.count({
        where: {
          dedupeKey: `paid-milestone-overdue:${milestone.id}:AWAITING_RESPONSE_OVERDUE:business-owner`,
        },
      }),
      1,
    );
    const afterReminders = await database.prisma.milestone.findUniqueOrThrow({
      where: { id: milestone.id },
    });
    assert.equal(afterReminders.status, "AWAITING_ACCEPTANCE");
    assert.equal(afterReminders.acceptanceStatus, "AWAITING_ACCEPTANCE");
    assert.equal(afterReminders.paymentStatus, "ESCROW");
    assert.equal(
      await database.prisma.projectTransaction.count({ where: { projectId: project.id } }),
      transactionsBefore,
    );
  });

  it("keeps legacy milestone acceptance auto-completion unchanged", async () => {
    await database.prisma.problem.create({
      data: {
        id: "legacy-milestone-problem",
        businessProfileId: "business",
        title: "Legacy completion",
        slug: "legacy-milestone-completion",
        description: "Mô tả",
        goal: "Mục tiêu",
        field: "CNTT",
        requirements: "Yêu cầu",
        expectedDuration: "1 tuần",
        status: "READY_FOR_IMPLEMENTATION",
        applications: {
          create: {
            id: "legacy-milestone-application",
            teamId: teamAId,
            approach: "Legacy",
            estimatedDuration: "1 tuần",
            status: "SELECTED",
          },
        },
      },
    });
    const legacy = await database.prisma.project.create({
      data: {
        id: "legacy-milestone-project",
        applicationId: "legacy-milestone-application",
        teamId: teamAId,
        title: "Legacy completion",
        agreedScope: "Legacy scope",
        totalAmount: 100_000,
        legacyTermsExempt: true,
        status: "AWAITING_PAYMENT",
        businessAcceptedAt: new Date("2026-10-31T00:00:00.000Z"),
        teamAcceptedAt: new Date("2026-10-31T00:00:00.000Z"),
        milestones: {
          create: {
            id: "legacy-milestone-final",
            title: "Final milestone",
            description: "Final work",
            sortOrder: 0,
            paymentPercent: 100,
            amount: 100_000,
          },
        },
      },
    });
    await recordProjectDeposit(database.prisma, {
      projectId: legacy.id,
      now: new Date("2026-10-31T01:00:00.000Z"),
    });
    await database.prisma.milestone.update({
      where: { id: "legacy-milestone-final" },
      data: { status: "SUBMITTED" },
    });
    const result = await acceptLegacyMilestone(database.prisma, {
      projectId: legacy.id,
      milestoneId: "legacy-milestone-final",
      now: new Date("2026-10-31T02:00:00.000Z"),
    });
    assert.equal(result.alreadyAccepted, false);
    const completed = await database.prisma.project.findUniqueOrThrow({
      where: { id: legacy.id },
      include: { milestones: true, transactions: true },
    });
    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.finalAcceptanceStatus, "NOT_REQUESTED");
    assert.equal(completed.finalAcceptedAt, null);
    assert.equal(completed.milestones[0]?.status, "ACCEPTED");
    assert.equal(
      completed.transactions.filter(({ type }) => type === "MILESTONE_RELEASE").length,
      1,
    );
  });
});
