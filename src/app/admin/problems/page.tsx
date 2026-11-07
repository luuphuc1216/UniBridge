import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";

export const instant = false;

const statusOptions = [
  ["PENDING_REVIEW", "Chờ duyệt"],
  ["NEEDS_REVISION", "Cần chỉnh sửa"],
  ["CHANGES_REQUESTED", "Cần chỉnh sửa (trạng thái cũ)"],
  ["REJECTED", "Bị từ chối"],
  ["APPROVED", "Đã duyệt"],
  ["PUBLISHED", "Đang nhận hồ sơ"],
  ["TEAM_SELECTED", "Đã chọn nhóm"],
  ["PROTOTYPING", "Đang xây dựng Prototype / Solution Proposal"],
  ["EVALUATING", "Doanh nghiệp đang đánh giá"],
  ["CLOSED", "Đã kết thúc – không triển khai"],
  ["READY_FOR_IMPLEMENTATION", "Sẵn sàng soạn thỏa thuận triển khai"],
  ["COMPLETED", "Đã hoàn thành"],
  ["DRAFT", "Bản nháp"],
] as const;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function getStatusVariant(status: string) {
  if (status === "PENDING_REVIEW") return "warning" as const;
  if (status === "REJECTED") return "destructive" as const;
  if (["APPROVED", "PUBLISHED", "TEAM_SELECTED"].includes(status)) {
    return "success" as const;
  }
  if (["NEEDS_REVISION", "CHANGES_REQUESTED"].includes(status)) {
    return "warning" as const;
  }
  return "secondary" as const;
}

export default async function AdminProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status: requestedStatus } = await searchParams;
  const selectedStatus =
    statusOptions.find(([status]) => status === requestedStatus)?.[0] ??
    "PENDING_REVIEW";
  const problems = await prisma.problem.findMany({
    where: { status: selectedStatus },
    orderBy: { submittedAt: "asc" },
    include: {
      businessProfile: {
        select: { companyName: true },
      },
      _count: { select: { attachments: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Quản lý vấn đề
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Rà soát nội dung và thông tin trước khi vấn đề được công khai cho sinh viên.
          </p>
        </div>
        <form
          action="/admin/problems"
          className="grid gap-2 sm:grid-cols-[auto_minmax(12rem,1fr)_auto] sm:items-center"
          method="get"
        >
          <label className="text-sm font-medium" htmlFor="status">
            Lọc theo trạng thái
          </label>
          <select
            className="min-h-11 min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            defaultValue={selectedStatus}
            id="status"
            name="status"
          >
            {statusOptions.map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit">Lọc danh sách</Button>
        </form>
      </header>

      <section aria-label="Danh sách vấn đề" className="mt-7">
        {problems.length === 0 ? (
          <EmptyState
            className="bg-card"
            description="Hãy chọn trạng thái khác hoặc quay lại khi có vấn đề mới."
            icon={<ClipboardCheck aria-hidden="true" className="size-5" />}
            title="Không có vấn đề ở trạng thái này"
          />
        ) : (
          <ul className="grid gap-4">
            {problems.map((problem) => {
              const statusLabel = getPrototypeProblemStatusLabel(problem);
              return (
                <li key={problem.id}>
                  <Card className="min-w-0 overflow-hidden p-0">
                    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0 p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className="gap-1.5"
                            variant={getStatusVariant(problem.status)}
                          >
                            {problem.status === "PENDING_REVIEW" ? (
                              <ShieldAlert aria-hidden="true" className="size-3.5" />
                            ) : (
                              <ClipboardCheck aria-hidden="true" className="size-3.5" />
                            )}
                            {statusLabel}
                          </Badge>
                          {problem.status === "PENDING_REVIEW" && (
                            <span className="text-xs font-medium text-muted-foreground">
                              Cần Admin xem xét
                            </span>
                          )}
                        </div>
                        <h2 className="mt-3 break-words text-lg font-semibold tracking-tight sm:text-xl">
                          {problem.title}
                        </h2>
                        <p className="mt-2 flex items-start gap-2 text-sm font-medium text-foreground">
                          <Building2
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          />
                          <span className="break-words">{problem.businessProfile.companyName}</span>
                        </p>
                        <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
                          {problem.description}
                        </p>
                        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm">
                          <div className="flex items-center gap-2">
                            <dt className="text-muted-foreground">Lĩnh vực</dt>
                            <dd className="font-medium">{problem.field}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                              <FileText aria-hidden="true" className="size-4" />
                              Tài liệu
                            </dt>
                            <dd className="font-medium">
                              {problem._count.attachments.toLocaleString("vi-VN")}
                            </dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarClock aria-hidden="true" className="size-4" />
                              Gửi lúc
                            </dt>
                            <dd className="font-medium">
                              {problem.submittedAt
                                ? dateFormatter.format(problem.submittedAt)
                                : "Chưa gửi"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex items-center border-t border-border bg-muted/30 p-5 sm:p-6 lg:border-l lg:border-t-0">
                        <Link
                          className={`${buttonVariants()} w-full sm:w-auto`}
                          href={`/admin/problems/${problem.id}`}
                        >
                            Xem và kiểm duyệt
                            <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                    </div>
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
