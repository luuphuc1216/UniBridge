import Link from "next/link";
import { AdminDashboardCharts } from "@/components/admin/admin-dashboard-charts";
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

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </article>
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
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <Link className="shrink-0 text-sm font-semibold text-primary hover:underline" href={href}>
          Xem tất cả
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboard() {
  await requireAdmin();
  const data = await getAdminDashboardData(prisma);
  const { metrics } = data;
  const revenueBreakdown = getDashboardRevenueBreakdown(metrics);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] bg-brand-navy p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-brand-light">Khu vực quản trị</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tổng quan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          Theo dõi hoạt động nền tảng, kiểm duyệt nội dung và xử lý các báo cáo cần chú ý.
        </p>
      </section>
      <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Thanh toán mô phỏng — các số liệu phản ánh dữ liệu giao dịch mô phỏng trong hệ thống.
      </p>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Tài khoản doanh nghiệp" value={metrics.businessAccounts} />
        <MetricCard label="Tài khoản sinh viên" value={metrics.studentAccounts} />
        <MetricCard label="Nhóm sinh viên (Team)" value={metrics.teams} />
        <MetricCard label="Problem chờ duyệt" value={metrics.pendingProblems} />
        <MetricCard label="Problem đang mở" value={metrics.openProblems} />
        <MetricCard label="Dự án đang thực hiện" value={metrics.ongoingProjects} />
        <MetricCard label="Dự án đã hoàn tất" value={metrics.completedProjects} />
        <MetricCard label="Báo cáo chưa xử lý" value={metrics.openReports} />
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-bold">Giao dịch và doanh thu</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Tổng giá trị DEPOSIT" value={formatCurrency(metrics.depositValue)} />
          <MetricCard label="Tổng REFUND (hiển thị riêng)" value={formatCurrency(metrics.refundValue)} />
          <MetricCard label="Phụ phí doanh nghiệp 10%" value={formatCurrency(metrics.projectFees.business)} />
          <MetricCard label="Phí nhóm sinh viên 5%" value={formatCurrency(metrics.projectFees.student)} />
          <MetricCard label="Phí nền tảng (dự kiến)" value={formatCurrency(metrics.projectFees.legacy)} />
          <MetricCard label="Tổng doanh thu phí dự án" value={formatCurrency(metrics.projectFeeRevenue)} />
          <MetricCard
            label={`Mua lẻ · ${metrics.postPurchaseOrders} đơn`}
            value={`${metrics.postPurchaseUnits} lượt · ${formatCurrency(metrics.postPurchaseRevenue)}`}
          />
          <MetricCard
            label={`Lượt mua Premium · ${formatCurrency(metrics.premiumRevenue)}`}
            value={metrics.premiumOrders}
          />
          <MetricCard label="Doanh thu mua dịch vụ" value={formatCurrency(metrics.addOnRevenue)} />
          <MetricCard label="Tổng doanh thu nền tảng" value={formatCurrency(metrics.totalPlatformRevenue)} />
        </div>
      </section>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AdminDashboardCharts
          monthlyRevenue={data.monthlyRevenue}
          projectStatuses={data.projectStatuses}
          revenueBreakdown={revenueBreakdown}
          trends={data.trends}
          weeklyActivity={data.weeklyActivity}
        />
        <aside className="grid gap-5">
          <RecentSection href="/admin/reports" title="Báo cáo mới nhất">
            {data.recentReports.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {data.recentReports.map((report) => (
                  <li className="py-3 first:pt-0 last:pb-0" key={report.id}>
                    <Link className="block rounded-md hover:text-primary" href={`/admin/reports/${report.id}`}>
                      <span className="font-medium">
                        {reportTargetLabels[report.targetType] ?? report.targetType}
                        {" · "}
                        {reportStatusLabels[report.status] ?? report.status}
                      </span>
                      <time className="mt-1 block text-xs text-muted-foreground" dateTime={report.createdAt.toISOString()}>
                        {dateFormatter.format(report.createdAt)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </RecentSection>

          <RecentSection href="/admin/accounts" title="Tài khoản đăng ký gần đây">
            {data.recentUsers.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
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

          <RecentSection href="/admin/audit-logs" title="Nhật ký hoạt động gần đây">
            {data.recentAuditLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Chưa có dữ liệu</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
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
    </main>
  );
}
