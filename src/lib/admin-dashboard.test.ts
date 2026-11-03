import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createTestDatabase } from "@/lib/test-database";
import { getAdminDashboardMetrics } from "./admin-dashboard";

describe("Admin dashboard metrics", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    database = await createTestDatabase("unibridge-admin-dashboard");
    const { prisma } = database;
    await prisma.user.update({
      where: { id: "business-owner" },
      data: { role: "BUSINESS" },
    });
    const team = await prisma.studentTeam.create({
      data: {
        id: "dashboard-team",
        ownerId: "buyer",
        name: "Dashboard Team",
        slug: "dashboard-team",
        university: "Đại học",
        description: "Nhóm seed",
      },
    });
    const statuses = ["IN_PROGRESS", "COMPLETED"] as const;
    for (const [index, status] of statuses.entries()) {
      const problem = await prisma.problem.create({
        data: {
          id: `dashboard-problem-${index}`,
          businessProfileId: "business",
          title: `Problem ${index}`,
          slug: `dashboard-problem-${index}`,
          description: "Mô tả",
          goal: "Mục tiêu",
          field: "Công nghệ",
          requirements: "Yêu cầu",
          expectedDuration: "4 tuần",
          status: index === 0 ? "PUBLISHED" : "PENDING_REVIEW",
        },
      });
      const application = await prisma.application.create({
        data: {
          id: `dashboard-application-${index}`,
          problemId: problem.id,
          teamId: team.id,
          approach: "Hướng tiếp cận",
          estimatedDuration: "4 tuần",
          status: "SELECTED",
        },
      });
      await prisma.project.create({
        data: {
          id: `dashboard-project-${index}`,
          applicationId: application.id,
          teamId: team.id,
          title: `Project ${index}`,
          agreedScope: "Phạm vi",
          totalAmount: 1000,
          status,
        },
      });
    }

    await prisma.projectTransaction.createMany({
      data: [
        {
          projectId: "dashboard-project-0",
          idempotencyKey: "dashboard-deposit-legacy",
          type: "DEPOSIT",
          amount: 1000,
          platformFee: 150,
          platformFeeBasisPoints: 1500,
          status: "ESCROW",
          paidAt: new Date(),
        },
        {
          projectId: "dashboard-project-0",
          idempotencyKey: "dashboard-deposit-split",
          type: "DEPOSIT",
          amount: 1000,
          platformFee: 150,
          platformFeeBasisPoints: 1500,
          businessFeeBasisPoints: 1000,
          studentFeeBasisPoints: 500,
          businessFee: 100,
          status: "ESCROW",
          paidAt: new Date(),
        },
        {
          projectId: "dashboard-project-0",
          idempotencyKey: "dashboard-refund",
          type: "REFUND",
          amount: 200,
          platformFee: 0,
          platformFeeBasisPoints: 0,
          status: "REFUNDED",
          paidAt: new Date(),
        },
        {
          projectId: "dashboard-project-0",
          idempotencyKey: "dashboard-release",
          type: "MILESTONE_RELEASE",
          amount: 850,
          platformFee: 50,
          platformFeeBasisPoints: 500,
          businessFeeBasisPoints: 1000,
          studentFeeBasisPoints: 500,
          businessFee: 50,
          status: "RELEASED",
          paidAt: new Date(),
        },
      ],
    });
    await prisma.platformCharge.createMany({
      data: [
        {
          businessProfileId: "business",
          buyerId: "business-owner",
          type: "POST_PURCHASE",
          amount: 297000,
          units: 3,
          quantity: 3,
          idempotencyKey: "dashboard-post-purchase",
        },
        {
          businessProfileId: "business",
          buyerId: "business-owner",
          type: "PREMIUM",
          amount: 699000,
          units: 1,
          quantity: 10,
          idempotencyKey: "dashboard-premium",
        },
      ],
    });
    await prisma.report.createMany({
      data: [
        {
          reporterId: "buyer",
          targetType: "PROBLEM",
          targetId: "dashboard-problem-0",
          snapshot: "{}",
          reason: "Báo cáo đang mở",
          openKey: "dashboard-report-new",
        },
        {
          reporterId: "buyer",
          targetType: "TEAM",
          targetId: "dashboard-team",
          snapshot: "{}",
          reason: "Báo cáo đang xử lý",
          status: "IN_PROGRESS",
          openKey: "dashboard-report-processing",
        },
        {
          reporterId: "buyer",
          targetType: "REVIEW",
          targetId: "closed-report",
          snapshot: "{}",
          reason: "Báo cáo đã xử lý",
          status: "RESOLVED",
        },
      ],
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it("counts source data and separates deposits, refunds, split fees, and service purchases", async () => {
    const before = await database.prisma.projectTransaction.findMany({
      orderBy: { idempotencyKey: "asc" },
    });
    const metrics = await getAdminDashboardMetrics(database.prisma);
    const after = await database.prisma.projectTransaction.findMany({
      orderBy: { idempotencyKey: "asc" },
    });

    assert.deepEqual(
      {
        businessAccounts: metrics.businessAccounts,
        studentAccounts: metrics.studentAccounts,
        teams: metrics.teams,
        pendingProblems: metrics.pendingProblems,
        openProblems: metrics.openProblems,
        ongoingProjects: metrics.ongoingProjects,
        completedProjects: metrics.completedProjects,
        openReports: metrics.openReports,
        depositValue: metrics.depositValue,
        refundValue: metrics.refundValue,
        projectFees: metrics.projectFees,
        projectFeeRevenue: metrics.projectFeeRevenue,
        postPurchaseUnits: metrics.postPurchaseUnits,
        premiumOrders: metrics.premiumOrders,
        addOnRevenue: metrics.addOnRevenue,
        totalPlatformRevenue: metrics.totalPlatformRevenue,
      },
      {
        businessAccounts: 1,
        studentAccounts: 1,
        teams: 1,
        pendingProblems: 1,
        openProblems: 1,
        ongoingProjects: 1,
        completedProjects: 1,
        openReports: 2,
        depositValue: 2000,
        refundValue: 200,
        projectFees: { business: 100, student: 50, legacy: 150 },
        projectFeeRevenue: 300,
        postPurchaseUnits: 3,
        premiumOrders: 1,
        addOnRevenue: 996000,
        totalPlatformRevenue: 996300,
      },
    );
    assert.deepEqual(after, before);
  });
});
