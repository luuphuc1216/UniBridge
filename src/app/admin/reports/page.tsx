import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
  PROBLEM: "Vấn đề",
  TEAM: "Hồ sơ nhóm",
  MESSAGE: "Tin nhắn",
  REVIEW: "Đánh giá",
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getStatusVariant(status: string) {
  if (status === "NEW") return "warning" as const;
  if (status === "IN_PROGRESS") return "default" as const;
  if (status === "RESOLVED") return "success" as const;
  if (status === "DISMISSED") return "secondary" as const;
  return "outline" as const;
}

function getResultMessage(result: string | undefined) {
  switch (result) {
    case "updated":
      return {
        message: "Đã lưu kết quả xử lý báo cáo.",
        variant: "success" as const,
      };
    case "invalid":
      return {
        message: "Thông tin xử lý chưa hợp lệ. Hãy kiểm tra trạng thái và lý do.",
        variant: "destructive" as const,
      };
    case "unchanged":
      return {
        message: "Báo cáo đã ở trạng thái được chọn, chưa có thay đổi.",
        variant: "warning" as const,
      };
    case "missing":
      return {
        message: "Không tìm thấy báo cáo hoặc nội dung liên quan để cập nhật.",
        variant: "destructive" as const,
      };
    case "conflict":
      return {
        message: "Báo cáo đã được cập nhật trước đó. Hãy tải lại danh sách.",
        variant: "warning" as const,
      };
    default:
      return null;
  }
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; result?: string }>;
}) {
  await requireAdmin();
  const { status: requestedStatus, result: actionResult } = await searchParams;
  const selectedStatus = reportStatuses.includes(requestedStatus as ReportStatus)
    ? (requestedStatus as ReportStatus)
    : undefined;
  const reports = await prisma.report.findMany({
    where: selectedStatus ? { status: selectedStatus } : undefined,
    orderBy: { createdAt: "desc" },
    include: { reporter: { select: { name: true, role: true } } },
  });
  const resultMessage = getResultMessage(actionResult);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Quản lý báo cáo
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Xem xét báo cáo vi phạm, căn cứ được gửi và trạng thái xử lý của từng nội dung.
          </p>
        </div>
        <form
          action="/admin/reports"
          className="grid gap-2 sm:grid-cols-[auto_minmax(11rem,1fr)_auto] sm:items-center"
          method="get"
        >
          <label className="text-sm font-medium" htmlFor="status">
            Lọc trạng thái
          </label>
          <select
            className="min-h-11 min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            defaultValue={selectedStatus ?? ""}
            id="status"
            name="status"
          >
            <option value="">Tất cả</option>
            {reportStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <Button type="submit">Lọc báo cáo</Button>
        </form>
      </header>

      {resultMessage && (
        <p
          aria-live="polite"
          className={`mt-5 rounded-xl border p-4 text-sm ${
            resultMessage.variant === "success"
              ? "border-success/30 bg-success/10 text-foreground"
              : resultMessage.variant === "warning"
                ? "border-warning/40 bg-warning/10 text-foreground"
                : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
          role={resultMessage.variant === "destructive" ? "alert" : "status"}
        >
          {resultMessage.message}
        </p>
      )}

      <section aria-label="Danh sách báo cáo" className="mt-7">
        {reports.length === 0 ? (
          <EmptyState
            className="bg-card"
            description="Thử chọn trạng thái khác để xem các báo cáo tương ứng."
            icon={<ShieldCheck aria-hidden="true" className="size-5" />}
            title="Không có báo cáo ở trạng thái này"
          />
        ) : (
          <ul className="grid gap-4">
            {reports.map((report) => {
              const status = report.status as ReportStatus;
              const targetType =
                report.targetType as (typeof reportTargetTypes)[number];
              return (
                <li key={report.id}>
                  <Card className="min-w-0 overflow-hidden p-0">
                    <Link
                      className="group block min-w-0 rounded-2xl p-5 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-6"
                      href={`/admin/reports/${report.id}`}
                    >
                      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getStatusVariant(report.status)}>
                              {statusLabels[status] ?? report.status}
                            </Badge>
                            <span className="text-sm font-medium text-muted-foreground">
                              {targetLabels[targetType] ?? report.targetType}
                            </span>
                          </div>
                          <p className="mt-3 break-all text-xs text-muted-foreground">
                            Mã nội dung: {report.targetId}
                          </p>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                            {report.reason}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
                          Xem báo cáo
                          <ArrowRight
                            aria-hidden="true"
                            className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                          />
                        </span>
                      </div>
                      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
                        <div className="flex min-w-0 items-start gap-2">
                          <dt className="text-muted-foreground">Người gửi</dt>
                          <dd className="break-words font-medium">
                            {report.reporter.name} ({report.reporter.role})
                          </dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <dt className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarClock aria-hidden="true" className="size-4" />
                            Gửi lúc
                          </dt>
                          <dd className="font-medium">
                            <time dateTime={report.createdAt.toISOString()}>
                              {dateFormatter.format(report.createdAt)}
                            </time>
                          </dd>
                        </div>
                      </dl>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
