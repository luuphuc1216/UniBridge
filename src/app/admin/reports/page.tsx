import Link from "next/link";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { reportStatuses, type ReportStatus, reportTargetTypes } from "@/lib/reports";

export const instant = false;

const statusLabels: Record<ReportStatus, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Bác bỏ",
};

const targetLabels: Record<(typeof reportTargetTypes)[number], string> = {
  PROBLEM: "Problem",
  TEAM: "Hồ sơ nhóm",
  MESSAGE: "Tin nhắn",
  REVIEW: "Đánh giá",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status: requestedStatus } = await searchParams;
  const selectedStatus = reportStatuses.includes(requestedStatus as ReportStatus)
    ? (requestedStatus as ReportStatus)
    : undefined;
  const reports = await prisma.report.findMany({
    where: selectedStatus ? { status: selectedStatus } : undefined,
    orderBy: { createdAt: "desc" },
    include: { reporter: { select: { name: true, role: true } } },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Báo cáo vi phạm</h1>
      <form action="/admin/reports" className="mt-5 flex flex-wrap items-center gap-2" method="get">
        <label className="text-sm font-medium" htmlFor="status">Lọc trạng thái</label>
        <select
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          defaultValue={selectedStatus ?? ""}
          id="status"
          name="status"
        >
          <option value="">Tất cả</option>
          {reportStatuses.map((status) => (
            <option key={status} value={status}>{statusLabels[status]}</option>
          ))}
        </select>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">
          Lọc
        </button>
      </form>
      {reports.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Không có báo cáo ở trạng thái này.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {reports.map((report) => (
            <li className="rounded-xl border border-border bg-card p-4" key={report.id}>
              <Link className="block hover:underline" href={`/admin/reports/${report.id}`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold">
                    {targetLabels[report.targetType as (typeof reportTargetTypes)[number]] ?? report.targetType}
                    {" · "}
                    {statusLabels[report.status as ReportStatus] ?? report.status}
                  </h2>
                  <time className="text-sm text-muted-foreground" dateTime={report.createdAt.toISOString()}>
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(report.createdAt)}
                  </time>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{report.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Người báo cáo: {report.reporter.name} ({report.reporter.role})
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
