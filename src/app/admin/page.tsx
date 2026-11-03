import { requireAdmin } from "@/lib/admin-access";
import { getAdminDashboardMetrics } from "@/lib/admin-dashboard";
import { prisma } from "@/lib/prisma";

export const instant = false;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </article>
  );
}

export default async function AdminDashboard() {
  await requireAdmin();
  const metrics = await getAdminDashboardMetrics(prisma);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tổng quan</h1>
      <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Thanh toán giả lập — các số liệu phản ánh dữ liệu giao dịch mô phỏng trong hệ thống.
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
          <MetricCard label="Phí legacy 15%" value={formatCurrency(metrics.projectFees.legacy)} />
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
    </main>
  );
}
