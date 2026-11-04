import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  calculatePlatformRevenue,
  getAdminDashboardData,
  getAdminDashboardMetrics,
  getDashboardRevenueBreakdown,
} from "./admin-dashboard";
import {
  findDashboardPeriodIndex,
  getDashboardTrend,
  getRecentDashboardPeriods,
  getRecentThirtyDayWindows,
} from "./admin-dashboard-periods";
import { createTestDatabase } from "./test-database";

const deposit = (
  amount: number,
  platformFee: number,
  businessFee: number | null,
  legacy = false,
) => ({
  amount,
  platformFee,
  platformFeeBasisPoints: legacy ? 1500 : 1500,
  businessFeeBasisPoints: legacy ? null : 1000,
  studentFeeBasisPoints: legacy ? null : 500,
  businessFee,
});

describe("Admin dashboard analytics", () => {
  it("only grants the admin role the admin authorization policy", async () => {
    process.env.DATABASE_URL ??= "file:/tmp/unibridge-admin-authorization-import.db";
    const { isAdminRole } = await import("./admin-access");
    assert.equal(isAdminRole("ADMIN"), true);
    assert.equal(isAdminRole("BUSINESS"), false);
    assert.equal(isAdminRole("STUDENT"), false);
  });

  it("uses the same pure revenue calculation for legacy and split fees without rounding", () => {
    const legacy = calculatePlatformRevenue(
      [deposit(10_000_001, 1_500_000, null, true)],
      [],
    );
    const splitFees = calculatePlatformRevenue(
      [
        deposit(11_000_001, 1_500_000, 1_000_000),
        deposit(3_910_001, 510_000, 340_000),
      ],
      [],
    );

    assert.deepEqual(legacy.projectFees, {
      business: 0,
      student: 0,
      legacy: 1_500_000,
    });
    assert.deepEqual(splitFees.projectFees, {
      business: 1_340_000,
      student: 670_000,
      legacy: 0,
    });
    assert.equal(splitFees.projectFees.business - 1_000_000, 340_000);
    assert.equal(splitFees.projectFees.student - 500_000, 170_000);

    const revenue = calculatePlatformRevenue(
      [
        deposit(10_000_001, 1_500_000, null, true),
        deposit(11_000_001, 1_500_000, 1_000_000),
        deposit(3_910_001, 510_000, 340_000),
      ],
      [
        { type: "PREMIUM", amount: 699_000, units: 10 },
        { type: "POST_PURCHASE", amount: 99_000, units: 1 },
      ],
    );

    assert.deepEqual(revenue.projectFees, {
      business: 1_340_000,
      student: 670_000,
      legacy: 1_500_000,
    });
    assert.equal(revenue.projectFees.business - 1_000_000, 340_000);
    assert.equal(revenue.projectFees.student - 500_000, 170_000);
    assert.equal(revenue.projectFeeRevenue, 3_510_000);
    assert.equal(revenue.addOnRevenue, 798_000);
    assert.equal(revenue.totalPlatformRevenue, 4_308_000);
  });

  it("does not use REFUND or mixed legacy milestone releases as revenue", async () => {
    const database = await createTestDatabase("unibridge-admin-dashboard-refund");
    try {
      const team = await database.prisma.studentTeam.create({
        data: {
          id: "refund-team",
          ownerId: "buyer",
          name: "Refund Team",
          slug: "refund-team",
          university: "Đại học",
          description: "Nhóm kiểm thử",
        },
      });
      await database.prisma.problem.create({
        data: {
          id: "refund-problem",
          businessProfileId: "business",
          title: "Refund problem",
          slug: "refund-problem",
          description: "Mô tả",
          goal: "Mục tiêu",
          field: "Công nghệ",
          requirements: "Yêu cầu",
          expectedDuration: "4 tuần",
        },
      });
      const application = await database.prisma.application.create({
        data: {
          id: "refund-application",
          problemId: "refund-problem",
          teamId: team.id,
          approach: "Hướng tiếp cận",
          estimatedDuration: "4 tuần",
        },
      });
      const project = await database.prisma.project.create({
        data: {
          id: "refund-project",
          applicationId: application.id,
          teamId: team.id,
          title: "Refund project",
          agreedScope: "Phạm vi",
          totalAmount: 10_000_001,
          status: "IN_PROGRESS",
        },
      });
      await database.prisma.projectTransaction.createMany({
        data: [
          {
            projectId: project.id,
            idempotencyKey: "refund-test-deposit",
            type: "DEPOSIT",
            amount: 11_000_001,
            platformFee: 1_500_000,
            platformFeeBasisPoints: 1500,
            businessFeeBasisPoints: 1000,
            studentFeeBasisPoints: 500,
            businessFee: 1_000_000,
            status: "ESCROW",
          },
          {
            projectId: project.id,
            idempotencyKey: "refund-test-refund",
            type: "REFUND",
            amount: 11_000_001,
            platformFee: 0,
            platformFeeBasisPoints: 0,
            status: "REFUNDED",
          },
          {
            projectId: project.id,
            idempotencyKey: "refund-test-mixed-release",
            type: "MILESTONE_RELEASE",
            amount: 3_400_001,
            platformFee: 510_000,
            platformFeeBasisPoints: 1500,
            businessFeeBasisPoints: null,
            studentFeeBasisPoints: null,
            status: "RELEASED",
          },
        ],
      });

      const metrics = await getAdminDashboardMetrics(database.prisma);
      assert.equal(metrics.refundValue, 11_000_001);
      assert.equal(metrics.projectFees.business, 1_000_000);
      assert.equal(metrics.projectFees.student, 500_000);
      assert.equal(metrics.totalPlatformRevenue, 1_500_000);
    } finally {
      await database.close();
    }
  });

  it("keeps local day, Monday week, and month boundaries at UTC+7", () => {
    const now = new Date("2026-03-02T00:01:00+07:00");
    const sundayNight = new Date("2026-03-01T23:59:00+07:00");
    const mondayMinute = new Date("2026-03-02T00:01:00+07:00");
    const februaryEnd = new Date("2026-02-28T23:59:00+07:00");
    const weeks = getRecentDashboardPeriods(now, "week", 8);
    const months = getRecentDashboardPeriods(now, "month", 6);
    const thirtyDayWindows = getRecentThirtyDayWindows(now);

    assert.equal(thirtyDayWindows.current.start.toISOString(), "2026-01-31T17:00:00.000Z");
    assert.equal(thirtyDayWindows.current.end.toISOString(), "2026-03-02T17:00:00.000Z");
    assert.equal(thirtyDayWindows.previous.start.toISOString(), "2026-01-01T17:00:00.000Z");
    assert.equal(thirtyDayWindows.previous.end.toISOString(), thirtyDayWindows.current.start.toISOString());
    assert.equal(weeks.at(-1)?.start.toISOString(), "2026-03-01T17:00:00.000Z");
    assert.equal(findDashboardPeriodIndex(weeks, sundayNight), 6);
    assert.equal(findDashboardPeriodIndex(weeks, mondayMinute), 7);
    assert.equal(months.at(-1)?.start.toISOString(), "2026-02-28T17:00:00.000Z");
    assert.equal(findDashboardPeriodIndex(months, februaryEnd), 4);
    assert.equal(findDashboardPeriodIndex(months, mondayMinute), 5);
    assert.equal(findDashboardPeriodIndex(months, sundayNight), 5);
    assert.equal(getDashboardTrend(0, 0).label, "0");
    assert.equal(getDashboardTrend(1, 0).label, "Mới");
  });

  describe("database-backed dashboard", () => {
    let database: Awaited<ReturnType<typeof createTestDatabase>>;

    beforeEach(async () => {
      database = await createTestDatabase("unibridge-admin-dashboard-analytics");
    });

    afterEach(async () => {
      await database.close();
    });

    it("fills time series, matches revenue totals, prioritizes paused projects, and omits sensitive fields", async () => {
      const { prisma } = database;
      const team = await prisma.studentTeam.create({
        data: {
          id: "analytics-team",
          ownerId: "buyer",
          name: "Analytics Team",
          slug: "analytics-team",
          university: "Đại học",
          description: "Nhóm kiểm thử",
        },
      });
      const fixtures = [
        {
          suffix: "sunday",
          date: new Date("2026-03-01T23:59:00+07:00"),
          status: "IN_PROGRESS",
          pausedAt: null,
        },
        {
          suffix: "monday",
          date: new Date("2026-03-02T00:01:00+07:00"),
          status: "COMPLETED",
          pausedAt: new Date("2026-03-02T00:02:00+07:00"),
        },
      ] as const;
      const projects: string[] = [];

      for (const fixture of fixtures) {
        const problem = await prisma.problem.create({
          data: {
            id: `analytics-problem-${fixture.suffix}`,
            businessProfileId: "business",
            title: `Problem ${fixture.suffix}`,
            slug: `analytics-problem-${fixture.suffix}`,
            description: "Nội dung không được đưa xuống client",
            goal: "Mục tiêu",
            field: "Công nghệ",
            requirements: "Yêu cầu",
            expectedDuration: "4 tuần",
            createdAt: fixture.date,
            updatedAt: fixture.date,
          },
        });
        const application = await prisma.application.create({
          data: {
            id: `analytics-application-${fixture.suffix}`,
            problemId: problem.id,
            teamId: team.id,
            approach: "Hướng tiếp cận",
            estimatedDuration: "4 tuần",
            submittedAt: fixture.date,
            updatedAt: fixture.date,
          },
        });
        const project = await prisma.project.create({
          data: {
            id: `analytics-project-${fixture.suffix}`,
            applicationId: application.id,
            teamId: team.id,
            title: `Project ${fixture.suffix}`,
            agreedScope: "Phạm vi",
            totalAmount: 10_000_001,
            status: fixture.status,
            pausedAt: fixture.pausedAt,
          },
        });
        projects.push(project.id);
      }

      await prisma.projectTransaction.createMany({
        data: [
          {
            projectId: projects[0],
            idempotencyKey: "analytics-deposit-feb",
            type: "DEPOSIT",
            amount: 3_910_001,
            platformFee: 510_000,
            platformFeeBasisPoints: 1500,
            businessFeeBasisPoints: 1000,
            studentFeeBasisPoints: 500,
            businessFee: 340_000,
            status: "ESCROW",
            createdAt: new Date("2026-02-28T23:59:00+07:00"),
          },
          {
            projectId: projects[1],
            idempotencyKey: "analytics-deposit-mar",
            type: "DEPOSIT",
            amount: 11_000_001,
            platformFee: 1_500_000,
            platformFeeBasisPoints: 1500,
            businessFeeBasisPoints: 1000,
            studentFeeBasisPoints: 500,
            businessFee: 1_000_000,
            status: "ESCROW",
            createdAt: new Date("2026-03-01T00:01:00+07:00"),
          },
          {
            projectId: projects[0],
            idempotencyKey: "analytics-refund",
            type: "REFUND",
            amount: 1_000_000,
            platformFee: 0,
            platformFeeBasisPoints: 0,
            status: "REFUNDED",
            createdAt: new Date("2026-03-02T00:01:00+07:00"),
          },
          {
            projectId: projects[1],
            idempotencyKey: "analytics-mixed-release",
            type: "MILESTONE_RELEASE",
            amount: 3_400_001,
            platformFee: 510_000,
            platformFeeBasisPoints: 1500,
            businessFeeBasisPoints: null,
            studentFeeBasisPoints: null,
            status: "RELEASED",
            createdAt: new Date("2026-03-02T00:01:00+07:00"),
          },
        ],
      });
      await prisma.platformCharge.createMany({
        data: [
          {
            businessProfileId: "business",
            buyerId: "business-owner",
            type: "POST_PURCHASE",
            amount: 99_000,
            units: 1,
            quantity: 1,
            idempotencyKey: "analytics-credit",
            createdAt: new Date("2026-02-28T23:59:00+07:00"),
          },
          {
            businessProfileId: "business",
            buyerId: "business-owner",
            type: "PREMIUM",
            amount: 699_000,
            units: 10,
            quantity: 10,
            idempotencyKey: "analytics-premium",
            createdAt: new Date("2026-03-01T00:01:00+07:00"),
          },
        ],
      });
      await prisma.report.create({
        data: {
          reporterId: "buyer",
          targetType: "MESSAGE",
          targetId: "sensitive-message-id",
          snapshot: "PRIVATE_SNAPSHOT",
          reason: "PRIVATE_REPORT_REASON",
          openKey: "analytics-private-report",
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: "buyer",
          action: "ACCOUNT_LOCKED",
          targetType: "User",
          targetId: "business-owner",
          metadata: JSON.stringify({ privateValue: "PRIVATE_AUDIT_METADATA" }),
          createdAt: new Date("2026-03-02T00:01:00+07:00"),
        },
      });

      const now = new Date("2026-03-02T00:01:00+07:00");
      const data = await getAdminDashboardData(prisma, now);
      const donut = getDashboardRevenueBreakdown(data.metrics);
      const donutTotal = donut.reduce((total, item) => total + item.value, 0);
      const monthlyTotal = data.monthlyRevenue.values.reduce((total, month) => total + month.revenue, 0);
      const timePeriods = getRecentDashboardPeriods(now, "month", 6);
      const deposits = await prisma.projectTransaction.findMany({
        where: {
          type: "DEPOSIT",
          createdAt: { gte: timePeriods[0].start, lt: timePeriods.at(-1)!.end },
        },
        select: {
          amount: true,
          platformFee: true,
          platformFeeBasisPoints: true,
          businessFeeBasisPoints: true,
          studentFeeBasisPoints: true,
          businessFee: true,
        },
      });
      const charges = await prisma.platformCharge.findMany({
        where: {
          type: { in: ["PREMIUM", "POST_PURCHASE"] },
          createdAt: { gte: timePeriods[0].start, lt: timePeriods.at(-1)!.end },
        },
        select: { type: true, amount: true, units: true },
      });
      const oldCalculationForSameRange = calculatePlatformRevenue(deposits, charges);

      assert.equal(donutTotal, data.metrics.totalPlatformRevenue);
      assert.equal(monthlyTotal, oldCalculationForSameRange.totalPlatformRevenue);
      assert.equal(monthlyTotal, data.metrics.totalPlatformRevenue);
      assert.equal(data.metrics.refundValue, 1_000_000);
      assert.equal(data.metrics.projectFees.business, 1_340_000);
      assert.equal(data.metrics.projectFees.student, 670_000);
      assert.equal(data.metrics.totalPlatformRevenue, 2_808_000);
      assert.equal(data.trends[0].current, 2);
      assert.equal(data.trends[0].previous, 0);
      assert.equal(data.trends[0].trend.label, "Mới");
      assert.equal(data.trends[1].current, 2);
      assert.deepEqual(
        data.weeklyActivity.values.slice(-2).map(({ problems, applications }) => [problems, applications]),
        [[1, 1], [1, 1]],
      );
      assert.deepEqual(
        data.monthlyRevenue.values.slice(-2).map(({ deposit }) => deposit),
        [3_910_001, 11_000_001],
      );
      assert.equal(data.projectStatuses.reduce((total, status) => total + status.value, 0), 2);
      assert.equal(data.projectStatuses.find(({ label }) => label === "Tạm dừng")?.value, 1);
      assert.equal(data.projectStatuses.find(({ label }) => label === "Hoàn tất")?.value, 0);
      assert.equal(data.projectStatuses.find(({ label }) => label === "Đang thực hiện")?.value, 1);
      assert.deepEqual(Object.keys(data.recentReports[0]).sort(), ["createdAt", "id", "status", "targetType"]);
      assert.deepEqual(Object.keys(data.recentUsers[0]).sort(), ["createdAt", "name", "role"]);
      assert.deepEqual(
        Object.keys(data.recentAuditLogs[0]).sort(),
        ["action", "actor", "createdAt", "targetType"],
      );
      assert.deepEqual(Object.keys(data.recentAuditLogs[0].actor), ["name"]);
      const serialized = JSON.stringify(data);
      for (const forbidden of [
        "email",
        "reason",
        "message",
        "content",
        "snapshot",
        "metadata",
        "PRIVATE_REPORT_REASON",
        "PRIVATE_SNAPSHOT",
        "PRIVATE_AUDIT_METADATA",
      ]) {
        assert.equal(serialized.includes(forbidden), false);
      }
    });

    it("shows continuous empty series and propagates unclassifiable deposit errors", async () => {
      const empty = await getAdminDashboardData(database.prisma, new Date("2026-03-02T00:01:00+07:00"));
      assert.equal(empty.weeklyActivity.values.length, 8);
      assert.equal(empty.weeklyActivity.hasData, false);
      assert.deepEqual(empty.weeklyActivity.values.map(({ problems, applications }) => [problems, applications]), Array.from({ length: 8 }, () => [0, 0]));
      assert.equal(empty.monthlyRevenue.values.length, 6);
      assert.equal(empty.monthlyRevenue.hasData, false);
      assert.equal(empty.projectStatuses.reduce((total, item) => total + item.value, 0), 0);
      assert.equal(empty.trends.every(({ current, previous, trend }) => current === 0 && previous === 0 && trend.label === "0"), true);

      const team = await database.prisma.studentTeam.create({
        data: {
          id: "invalid-team",
          ownerId: "buyer",
          name: "Invalid Team",
          slug: "invalid-team",
          university: "Đại học",
          description: "Nhóm kiểm thử",
        },
      });
      await database.prisma.problem.create({
        data: {
          id: "invalid-problem",
          businessProfileId: "business",
          title: "Invalid problem",
          slug: "invalid-problem",
          description: "Mô tả",
          goal: "Mục tiêu",
          field: "Công nghệ",
          requirements: "Yêu cầu",
          expectedDuration: "4 tuần",
        },
      });
      const application = await database.prisma.application.create({
        data: {
          id: "invalid-application",
          problemId: "invalid-problem",
          teamId: team.id,
          approach: "Hướng tiếp cận",
          estimatedDuration: "4 tuần",
        },
      });
      const project = await database.prisma.project.create({
        data: {
          id: "invalid-project",
          applicationId: application.id,
          teamId: team.id,
          title: "Invalid project",
          agreedScope: "Phạm vi",
          totalAmount: 1000,
        },
      });
      await database.prisma.projectTransaction.create({
        data: {
          projectId: project.id,
          idempotencyKey: "invalid-unclassified-deposit",
          type: "DEPOSIT",
          amount: 1000,
          platformFee: 99,
          platformFeeBasisPoints: 999,
          status: "ESCROW",
          createdAt: new Date("2026-03-02T00:01:00+07:00"),
        },
      });

      await assert.rejects(getAdminDashboardMetrics(database.prisma), /Không thể phân loại phí/);
      await assert.rejects(
        getAdminDashboardData(database.prisma, new Date("2026-03-02T00:01:00+07:00")),
        /Không thể phân loại phí/,
      );
    });
  });
});
