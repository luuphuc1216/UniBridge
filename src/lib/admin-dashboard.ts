import type { PrismaClient } from "@/generated/prisma/client";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";

type DashboardDatabase = Pick<
  PrismaClient,
  "user" | "studentTeam" | "problem" | "project" | "projectTransaction" | "platformCharge" | "report"
>;

function sumSafe(values: number[], label: string): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Tổng ${label} vượt quá giới hạn số nguyên an toàn.`);
  }
  return total;
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
    deposits,
    refunds,
    feeDeposits,
    postPurchases,
    premiumPurchases,
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
      where: { type: "DEPOSIT" },
      _sum: { amount: true },
    }),
    database.projectTransaction.aggregate({
      where: { type: "REFUND" },
      _sum: { amount: true },
    }),
    database.projectTransaction.findMany({
      where: { type: "DEPOSIT" },
      select: {
        platformFee: true,
        platformFeeBasisPoints: true,
        businessFeeBasisPoints: true,
        studentFeeBasisPoints: true,
        businessFee: true,
      },
    }),
    database.platformCharge.aggregate({
      where: { type: "POST_PURCHASE" },
      _sum: { amount: true, units: true },
      _count: { _all: true },
    }),
    database.platformCharge.aggregate({
      where: { type: "PREMIUM" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  let businessFees = 0;
  let studentFees = 0;
  let legacyFees = 0;
  for (const deposit of feeDeposits) {
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
  const postPurchaseRevenue = postPurchases._sum.amount ?? 0;
  const premiumRevenue = premiumPurchases._sum.amount ?? 0;
  const addOnRevenue = sumSafe(
    [postPurchaseRevenue, premiumRevenue],
    "doanh thu dịch vụ",
  );

  return {
    businessAccounts,
    studentAccounts,
    teams,
    pendingProblems,
    openProblems,
    ongoingProjects,
    completedProjects,
    openReports,
    depositValue: deposits._sum.amount ?? 0,
    refundValue: refunds._sum.amount ?? 0,
    projectFees,
    projectFeeRevenue,
    postPurchaseUnits: postPurchases._sum.units ?? 0,
    postPurchaseOrders: postPurchases._count._all,
    postPurchaseRevenue,
    premiumOrders: premiumPurchases._count._all,
    premiumRevenue,
    addOnRevenue,
    totalPlatformRevenue: sumSafe([projectFeeRevenue, addOnRevenue], "doanh thu nền tảng"),
  };
}
