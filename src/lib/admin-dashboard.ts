import type { PrismaClient } from "@/generated/prisma/client";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import {
  findDashboardPeriodIndex,
  getDashboardTrend,
  getRecentDashboardPeriods,
  getRecentThirtyDayWindows,
} from "@/lib/admin-dashboard-periods";

type DashboardDatabase = Pick<
  PrismaClient,
  | "user"
  | "studentTeam"
  | "problem"
  | "application"
  | "project"
  | "projectTransaction"
  | "platformCharge"
  | "report"
  | "auditLog"
>;

export type DepositRevenueInput = {
  amount: number;
  platformFee: number;
  platformFeeBasisPoints: number;
  businessFeeBasisPoints: number | null;
  studentFeeBasisPoints: number | null;
  businessFee: number | null;
};

export type PlatformChargeRevenueInput = {
  type: string;
  amount: number;
  units?: number;
};

export type PlatformRevenue = {
  projectFees: { business: number; student: number; legacy: number };
  projectFeeRevenue: number;
  postPurchaseRevenue: number;
  postPurchaseUnits: number;
  postPurchaseOrders: number;
  premiumRevenue: number;
  premiumOrders: number;
  addOnRevenue: number;
  totalPlatformRevenue: number;
};

export function getDashboardRevenueBreakdown(revenue: PlatformRevenue) {
  return [
    { label: "Phụ phí doanh nghiệp 10%", value: revenue.projectFees.business },
    { label: "Phí nhóm sinh viên 5%", value: revenue.projectFees.student },
    { label: "Phí legacy 15%", value: revenue.projectFees.legacy },
    { label: "Doanh thu dịch vụ (Premium + mua lẻ)", value: revenue.addOnRevenue },
  ];
}

function sumSafe(values: number[], label: string): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Tổng ${label} vượt quá giới hạn số nguyên an toàn.`);
  }
  return total;
}

export function calculatePlatformRevenue(
  deposits: DepositRevenueInput[],
  charges: PlatformChargeRevenueInput[],
): PlatformRevenue {
  let businessFees = 0;
  let studentFees = 0;
  let legacyFees = 0;
  for (const deposit of deposits) {
    if (
      deposit.businessFeeBasisPoints === businessFeeRate &&
      deposit.studentFeeBasisPoints === studentFeeRate &&
      deposit.businessFee !== null
    ) {
      businessFees += deposit.businessFee;
      studentFees += deposit.platformFee - deposit.businessFee;
    } else if (
      deposit.businessFeeBasisPoints === null &&
      deposit.studentFeeBasisPoints === null &&
      deposit.platformFeeBasisPoints === legacyPlatformFeeRate
    ) {
      legacyFees += deposit.platformFee;
    } else if (deposit.platformFee !== 0) {
      throw new Error("Không thể phân loại phí của một giao dịch nạp tiền.");
    }
  }

  const projectFees = {
    business: sumSafe([businessFees], "phụ phí doanh nghiệp"),
    student: sumSafe([studentFees], "phí nhóm sinh viên"),
    legacy: sumSafe([legacyFees], "phí legacy"),
  };
  const projectFeeRevenue = sumSafe(
    [projectFees.business, projectFees.student, projectFees.legacy],
    "phí dự án",
  );
  const postPurchase = charges.filter((charge) => charge.type === "POST_PURCHASE");
  const premium = charges.filter((charge) => charge.type === "PREMIUM");
  const postPurchaseRevenue = sumSafe(
    postPurchase.map(({ amount }) => amount),
    "doanh thu mua lẻ",
  );
  const premiumRevenue = sumSafe(
    premium.map(({ amount }) => amount),
    "doanh thu Premium",
  );
  const addOnRevenue = sumSafe(
    [postPurchaseRevenue, premiumRevenue],
    "doanh thu dịch vụ",
  );

  return {
    projectFees,
    projectFeeRevenue,
    postPurchaseRevenue,
    postPurchaseUnits: sumSafe(
      postPurchase.map(({ units = 0 }) => units),
      "lượt mua lẻ",
    ),
    postPurchaseOrders: postPurchase.length,
    premiumRevenue,
    premiumOrders: premium.length,
    addOnRevenue,
    totalPlatformRevenue: sumSafe(
      [projectFeeRevenue, addOnRevenue],
      "doanh thu nền tảng",
    ),
  };
}

export async function getAdminDashboardMetrics(database: DashboardDatabase) {
  const [
    businessAccounts,
    studentAccounts,
    teams,
    pendingProblems,
    openProblems,
    ongoingProjects,
    completedProjects,
    openReports,
    refunds,
    feeDeposits,
    platformCharges,
  ] = await Promise.all([
    database.user.count({ where: { role: "BUSINESS" } }),
    database.user.count({ where: { role: "STUDENT" } }),
    database.studentTeam.count(),
    database.problem.count({ where: { status: "PENDING_REVIEW" } }),
    database.problem.count({ where: { status: { in: ["APPROVED", "PUBLISHED"] } } }),
    database.project.count({ where: { status: "IN_PROGRESS" } }),
    database.project.count({ where: { status: "COMPLETED" } }),
    database.report.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    database.projectTransaction.aggregate({
      where: { type: "REFUND" },
      _sum: { amount: true },
    }),
    database.projectTransaction.findMany({
      where: { type: "DEPOSIT" },
      select: {
        amount: true,
        platformFee: true,
        platformFeeBasisPoints: true,
        businessFeeBasisPoints: true,
        studentFeeBasisPoints: true,
        businessFee: true,
      },
    }),
    database.platformCharge.findMany({
      where: { type: { in: ["PREMIUM", "POST_PURCHASE"] } },
      select: { type: true, amount: true, units: true },
    }),
  ]);
  const revenue = calculatePlatformRevenue(feeDeposits, platformCharges);

  return {
    businessAccounts,
    studentAccounts,
    teams,
    pendingProblems,
    openProblems,
    ongoingProjects,
    completedProjects,
    openReports,
    depositValue: sumSafe(
      feeDeposits.map(({ amount }) => amount),
      "giá trị DEPOSIT",
    ),
    refundValue: refunds._sum.amount ?? 0,
    ...revenue,
  };
}

async function getTrendCounts(database: DashboardDatabase, now: Date) {
  const windows = getRecentThirtyDayWindows(now);
  const [currentProblems, previousProblems, currentApplications, previousApplications, currentUsers, previousUsers] =
    await Promise.all([
      database.problem.count({
        where: { createdAt: { gte: windows.current.start, lt: windows.current.end } },
      }),
      database.problem.count({
        where: { createdAt: { gte: windows.previous.start, lt: windows.previous.end } },
      }),
      database.application.count({
        where: { submittedAt: { gte: windows.current.start, lt: windows.current.end } },
      }),
      database.application.count({
        where: { submittedAt: { gte: windows.previous.start, lt: windows.previous.end } },
      }),
      database.user.count({
        where: { createdAt: { gte: windows.current.start, lt: windows.current.end } },
      }),
      database.user.count({
        where: { createdAt: { gte: windows.previous.start, lt: windows.previous.end } },
      }),
    ]);

  return [
    {
      label: "Problem đăng mới",
      current: currentProblems,
      previous: previousProblems,
      trend: getDashboardTrend(currentProblems, previousProblems),
    },
    {
      label: "Hồ sơ ứng tuyển gửi mới",
      current: currentApplications,
      previous: previousApplications,
      trend: getDashboardTrend(currentApplications, previousApplications),
    },
    {
      label: "Tài khoản đăng ký mới",
      current: currentUsers,
      previous: previousUsers,
      trend: getDashboardTrend(currentUsers, previousUsers),
    },
  ];
}

async function getWeeklyActivity(database: DashboardDatabase, now: Date) {
  const periods = getRecentDashboardPeriods(now, "week", 8);
  const start = periods[0].start;
  const end = periods[periods.length - 1].end;
  const [problems, applications] = await Promise.all([
    database.problem.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    }),
    database.application.findMany({
      where: { submittedAt: { gte: start, lt: end } },
      select: { submittedAt: true },
    }),
  ]);
  const values = periods.map((period) => ({
    label: period.label,
    problems: 0,
    applications: 0,
  }));
  for (const problem of problems) {
    const index = findDashboardPeriodIndex(periods, problem.createdAt);
    if (index >= 0) values[index].problems += 1;
  }
  for (const application of applications) {
    const index = findDashboardPeriodIndex(periods, application.submittedAt);
    if (index >= 0) values[index].applications += 1;
  }
  return { values, hasData: problems.length > 0 || applications.length > 0 };
}

async function getMonthlyRevenue(database: DashboardDatabase, now: Date) {
  const periods = getRecentDashboardPeriods(now, "month", 6);
  const start = periods[0].start;
  const end = periods[periods.length - 1].end;
  const [deposits, charges] = await Promise.all([
    database.projectTransaction.findMany({
      where: { type: "DEPOSIT", createdAt: { gte: start, lt: end } },
      select: {
        amount: true,
        platformFee: true,
        platformFeeBasisPoints: true,
        businessFeeBasisPoints: true,
        studentFeeBasisPoints: true,
        businessFee: true,
        createdAt: true,
      },
    }),
    database.platformCharge.findMany({
      where: {
        type: { in: ["PREMIUM", "POST_PURCHASE"] },
        createdAt: { gte: start, lt: end },
      },
      select: { type: true, amount: true, units: true, createdAt: true },
    }),
  ]);
  const values = periods.map((period) => ({
    label: period.label,
    deposit: 0,
    revenue: 0,
  }));
  let rowsWithData = 0;
  for (const [index, period] of periods.entries()) {
    const periodDeposits = deposits.filter(
      (deposit) => deposit.createdAt >= period.start && deposit.createdAt < period.end,
    );
    const periodCharges = charges.filter(
      (charge) => charge.createdAt >= period.start && charge.createdAt < period.end,
    );
    const revenue = calculatePlatformRevenue(periodDeposits, periodCharges);
    values[index].deposit = sumSafe(
      periodDeposits.map(({ amount }) => amount),
      "DEPOSIT theo tháng",
    );
    values[index].revenue = revenue.totalPlatformRevenue;
    rowsWithData += periodDeposits.length + periodCharges.length;
  }
  return { values, hasData: rowsWithData > 0 };
}

async function getProjectStatusDistribution(database: DashboardDatabase) {
  const [paused, ongoing, completed, cancelled, other] = await Promise.all([
    database.project.count({ where: { pausedAt: { not: null } } }),
    database.project.count({ where: { status: "IN_PROGRESS", pausedAt: null } }),
    database.project.count({ where: { status: "COMPLETED", pausedAt: null } }),
    database.project.count({ where: { status: "CANCELLED", pausedAt: null } }),
    database.project.count({
      where: {
        status: { notIn: ["IN_PROGRESS", "COMPLETED", "CANCELLED"] },
        pausedAt: null,
      },
    }),
  ]);
  return [
    { label: "Đang thực hiện", value: ongoing },
    { label: "Hoàn tất", value: completed },
    { label: "Đã hủy", value: cancelled },
    { label: "Tạm dừng", value: paused },
    { label: "Khác", value: other },
  ];
}

export async function getAdminDashboardData(
  database: DashboardDatabase,
  now = new Date(),
) {
  const [
    metrics,
    trends,
    weeklyActivity,
    monthlyRevenue,
    projectStatuses,
    recentReports,
    recentUsers,
    recentAuditLogs,
  ] = await Promise.all([
    getAdminDashboardMetrics(database),
    getTrendCounts(database, now),
    getWeeklyActivity(database, now),
    getMonthlyRevenue(database, now),
    getProjectStatusDistribution(database),
    database.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, targetType: true, status: true, createdAt: true },
    }),
    database.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { name: true, role: true, createdAt: true },
    }),
    database.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        action: true,
        targetType: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  return {
    metrics,
    trends,
    weeklyActivity,
    monthlyRevenue,
    projectStatuses,
    recentReports,
    recentUsers,
    recentAuditLogs,
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;
