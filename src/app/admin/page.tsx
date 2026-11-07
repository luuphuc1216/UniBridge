import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ClipboardCheck,
  GraduationCap,
  Flag,
  Users,
  UsersRound,
} from "lucide-react";
import { AdminDashboardCharts } from "@/components/admin/admin-dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-access";
import {
  getAdminDashboardData,
  getDashboardRevenueBreakdown,
} from "@/lib/admin-dashboard";
import { prisma } from "@/lib/prisma";

export const instant = false;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

const reportTargetLabels: Record<string, string> = {
  PROBLEM: "Problem",
  TEAM: "Hồ sơ nhóm",
  MESSAGE: "Tin nhắn",
  REVIEW: "Đánh giá",
};

const reportStatusLabels: Record<string, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Bác bỏ",
};

const roleLabels: Record<string, string> = {
  BUSINESS: "Doanh nghiệp",
  STUDENT: "Sinh viên",
  ADMIN: "Quản trị viên",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function MetricCard({
  label,
  value,
  icon,
  simulated = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  simulated?: boolean;
}) {
  return (
    <Card
      className={`min-w-0 p-5 ${simulated ? "border-white/15 bg-white/10 text-white shadow-none" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm leading-5 ${simulated ? "text-white/75" : "text-muted-foreground"}`}>
          {label}
        </p>
        <span
          aria-hidden="true"
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            simulated ? "bg-white/10 text-white" : "bg-accent text-accent-foreground"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 break-words text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
    </Card>
  );
}

function RecentSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          href={href}
        >
          Xem tất cả <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {children}
    </Card>
  );
}

export default async function AdminDashboard() {
  await requireAdmin();
  const data = await getAdminDashboardData(prisma);
  const { metrics } = data;
  const revenueBreakdown = getDashboardRevenueBreakdown(metrics);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tổng quan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Theo dõi hoạt động và các chỉ số hiện có của UniBridge.
          </p>
        </div>
        <Badge className="w-fit gap-2 px-3 py-1.5" variant="warning">
          <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
          Bảng điều khiển quản trị
        </Badge>
      </header>

      <section aria-labelledby="admin-overview-heading" className="mt-8">
        <h2 className="mb-4 text-lg font-bold tracking-tight" id="admin-overview-heading">
          Chỉ số tổng quan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<BriefcaseBusiness className="size-5" />} label="Tài khoản doanh nghiệp" value={metrics.businessAccounts} />
          <MetricCard icon={<GraduationCap className="size-5" />} label="Tài khoản sinh viên" value={metrics.studentAccounts} />
          <MetricCard icon={<Users className="size-5" />} label="Nhóm sinh viên (Team)" value={metrics.teams} />
          <MetricCard icon={<ClipboardCheck className="size-5" />} label="Problem chờ duyệt" value={metrics.pendingProblems} />
          <MetricCard icon={<BadgeCheck className="size-5" />} label="Problem đang mở" value={metrics.openProblems} />
          <MetricCard icon={<BriefcaseBusiness className="size-5" />} label="Dự án đang thực hiện" value={metrics.ongoingProjects} />
          <MetricCard icon={<UsersRound className="size-5" />} label="Dự án đã hoàn tất" value={metrics.completedProjects} />
          <MetricCard icon={<Flag className="size-5" />} label="Báo cáo chưa xử lý" value={metrics.openReports} />
        </div>
      </section>

      <section
        aria-labelledby="admin-simulated-revenue-heading"
        className="mt-8 rounded-3xl bg-[var(--brand-navy)] p-5 text-white sm:p-7"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/70">Theo dõi tài chính</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl" id="admin-simulated-revenue-heading">
              Giao dịch và doanh thu
            </h2>
          </div>
          <p className="max-w-xl rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm leading-5 text-white/90">
            Thanh toán giả lập — các số liệu phản ánh dữ liệu giao dịch mô phỏng trong hệ thống.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard simulated icon={<span className="text-xs font-bold">₫</span>} label="Tổng giá trị DEPOSIT" value={formatCurrency(metrics.depositValue)} />
          <MetricCard simulated icon={<span className="text-xs font-bold">₫</span>} label="Tổng REFUND (hiển thị riêng)" value={formatCurrency(metrics.refundValue)} />
          <MetricCard simulated icon={<span className="text-xs font-bold">10%</span>} label="Phụ phí doanh nghiệp 10%" value={formatCurrency(metrics.projectFees.business)} />
          <MetricCard simulated icon={<span className="text-xs font-bold">5%</span>} label="Phí nhóm sinh viên 5%" value={formatCurrency(metrics.projectFees.student)} />
          <MetricCard simulated icon={<span className="text-xs font-bold">15%</span>} label="Phí legacy 15%" value={formatCurrency(metrics.projectFees.legacy)} />
          <MetricCard simulated icon={<span className="text-xs font-bold">₫</span>} label="Tổng doanh thu phí dự án" value={formatCurrency(metrics.projectFeeRevenue)} />
          <MetricCard
            simulated
            icon={<span className="text-xs font-bold">×</span>}
            label={`Mua lẻ · ${metrics.postPurchaseOrders} đơn`}
            value={`${metrics.postPurchaseUnits} lượt · ${formatCurrency(metrics.postPurchaseRevenue)}`}
          />
          <MetricCard
            simulated
            icon={<span className="text-xs font-bold">P</span>}
            label={`Lượt mua Premium · ${formatCurrency(metrics.premiumRevenue)}`}
            value={metrics.premiumOrders}
          />
          <MetricCard simulated icon={<span className="text-xs font-bold">₫</span>} label="Doanh thu mua dịch vụ" value={formatCurrency(metrics.addOnRevenue)} />
          <MetricCard simulated icon={<span className="text-xs font-bold">₫</span>} label="Tổng doanh thu nền tảng" value={formatCurrency(metrics.totalPlatformRevenue)} />
        </div>
      </section>

      <AdminDashboardCharts
        monthlyRevenue={data.monthlyRevenue}
        projectStatuses={data.projectStatuses}
        revenueBreakdown={revenueBreakdown}
        trends={data.trends}
        weeklyActivity={data.weeklyActivity}
      />

      <section aria-labelledby="admin-recent-activity-heading" className="mt-10">
        <div className="mb-4">
          <p className="text-sm font-semibold text-primary">Cập nhật mới</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight" id="admin-recent-activity-heading">
            Hoạt động gần đây
          </h2>
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <aside>
          <RecentSection href="/admin/reports" title="Báo cáo mới nhất">
            {data.recentReports.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/60 px-3 py-5 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="mt-3 divide-y divide-border" aria-label="Năm báo cáo gần nhất">
                {data.recentReports.map((report) => (
                  <li className="py-3 first:pt-0 last:pb-0" key={report.id}>
                    <Link className="block rounded-lg p-2 -mx-2 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" href={`/admin/reports/${report.id}`}>
                      <span className="font-medium">
                        {reportTargetLabels[report.targetType] ?? report.targetType}
                        {" · "}
                        {reportStatusLabels[report.status] ?? report.status}
                      </span>
                      <time className="mt-1 block text-xs text-muted-foreground" dateTime={report.createdAt.toISOString()}>
                        {dateFormatter.format(report.createdAt)}
                      </time>
                      <span className="sr-only">Mở chi tiết báo cáo</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </RecentSection>
          </aside>
          <aside>
          <RecentSection href="/admin/accounts" title="Tài khoản đăng ký gần đây">
            {data.recentUsers.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/60 px-3 py-5 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="mt-3 divide-y divide-border" aria-label="Năm tài khoản đăng ký gần nhất">
                {data.recentUsers.map((user, index) => (
                  <li className="py-3 first:pt-0 last:pb-0" key={`${user.createdAt.toISOString()}-${index}`}>
                    <p className="font-medium">{user.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{roleLabels[user.role] ?? user.role}</p>
                    <time className="mt-1 block text-xs text-muted-foreground" dateTime={user.createdAt.toISOString()}>
                      {dateFormatter.format(user.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </RecentSection>
          </aside>
          <aside>
          <RecentSection href="/admin/audit-logs" title="Nhật ký hoạt động gần đây">
            {data.recentAuditLogs.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/60 px-3 py-5 text-center text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="mt-3 divide-y divide-border" aria-label="Năm hoạt động gần nhất">
                {data.recentAuditLogs.map((log, index) => (
                  <li className="py-3 first:pt-0 last:pb-0" key={`${log.createdAt.toISOString()}-${index}`}>
                    <p className="font-medium">{log.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {log.targetType} · {log.actor.name}
                    </p>
                    <time className="mt-1 block text-xs text-muted-foreground" dateTime={log.createdAt.toISOString()}>
                      {dateFormatter.format(log.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </RecentSection>
          </aside>
        </div>
      </section>
    </main>
  );
}
