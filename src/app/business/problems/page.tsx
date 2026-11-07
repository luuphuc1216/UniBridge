import Link from "next/link";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";
import {
  BUSINESS_PROBLEM_STATUS_GROUPS,
  getBusinessProblemStatusFilter,
  getEffectiveApplicationCounts,
} from "@/lib/business-dashboard";
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Search,
  Tag,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const instant = false;

const statusVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  NEEDS_REVISION: "destructive",
  CHANGES_REQUESTED: "destructive",
  REJECTED: "destructive",
  APPROVED: "success",
  PUBLISHED: "success",
  TEAM_SELECTED: "default",
  PROTOTYPING: "default",
  EVALUATING: "warning",
  CLOSED: "secondary",
  READY_FOR_IMPLEMENTATION: "success",
  COMPLETED: "success",
};

export default async function BusinessProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; field?: string; query?: string }>;
}) {
  const { businessProfileId } = await requireBusinessProfile();
  const filters = await searchParams;
  const problems = await prisma.problem.findMany({
    where: {
      businessProfileId,
      ...(filters.status ? { status: getBusinessProblemStatusFilter(filters.status) } : {}),
      ...(filters.field ? { field: filters.field } : {}),
      ...(filters.query ? { title: { contains: filters.query } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { attachments: true } },
    },
  });
  const effectiveApplicationCounts = await getEffectiveApplicationCounts(
    problems.map(({ id }) => id),
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
            Bài toán của tôi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý nội dung, hồ sơ ứng tuyển và trạng thái duyệt của các bài toán.
          </p>
        </div>
        <Link
          className={`${buttonVariants({ size: "lg" })} w-full shrink-0 sm:w-auto`}
          href="/business/problems/new"
        >
          Đăng bài toán mới
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </header>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Tìm kiếm và lọc</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Thu hẹp danh sách theo tên, lĩnh vực hoặc trạng thái.
            </p>
          </div>
          <form
            aria-label="Tìm kiếm và lọc bài toán"
            className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
            method="get"
          >
            <div className="min-w-0 space-y-2">
              <label className="text-sm font-medium" htmlFor="problem-query">
                Tên bài toán
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-9 text-base sm:text-sm"
                  defaultValue={filters.query}
                  id="problem-query"
                  name="query"
                  placeholder="Tìm theo tên bài toán"
                  type="search"
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-sm font-medium" htmlFor="problem-field">
                Lĩnh vực
              </label>
              <Input
                className="text-base sm:text-sm"
                defaultValue={filters.field}
                id="problem-field"
                name="field"
                placeholder="Nhập lĩnh vực"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-sm font-medium" htmlFor="problem-status">
                Trạng thái
              </label>
              <Select
                className="text-base sm:text-sm"
                defaultValue={filters.status ?? ""}
                id="problem-status"
                name="status"
              >
                <option value="">Tất cả trạng thái</option>
                {BUSINESS_PROBLEM_STATUS_GROUPS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <Button className="w-full sm:col-span-2 lg:col-span-1" type="submit">
              <Search aria-hidden="true" className="h-4 w-4" />
              Lọc bài toán
            </Button>
          </form>
        </CardContent>
      </Card>

      {problems.length === 0 ? (
        <EmptyState
          action={
            <Link
              className={buttonVariants({ size: "default" })}
              href="/business/problems/new"
            >
              Đăng bài toán mới
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          }
          className="px-5 py-10 sm:py-14"
          description="Tạo bản nháp hoặc gửi bài toán để bắt đầu kết nối với các nhóm sinh viên."
          title="Bạn chưa đăng bài toán nào"
        />
      ) : (
        <section aria-label="Danh sách bài toán" className="space-y-4">
          <h2 className="sr-only">Danh sách bài toán</h2>
          {problems.map((problem) => (
            <Card
              className="group transition-colors hover:border-primary/30 motion-reduce:transition-none"
              key={problem.id}
            >
              <CardContent className="p-5 sm:p-6">
                <article className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <h3 className="min-w-0 break-words text-lg font-semibold leading-6 tracking-tight [overflow-wrap:anywhere]">
                        {problem.title}
                      </h3>
                      <Badge
                        className="w-fit max-w-full shrink-0 whitespace-normal break-words"
                        variant={statusVariants[problem.status] ?? "secondary"}
                      >
                        {getPrototypeProblemStatusLabel(problem)}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">
                      {problem.description}
                    </p>
                    <ul
                      aria-label="Thông tin bài toán"
                      className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground"
                    >
                      <li className="inline-flex min-w-0 items-center gap-2">
                        <Tag aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                        <span className="break-words [overflow-wrap:anywhere]">{problem.field}</span>
                      </li>
                      <li className="inline-flex items-center gap-2">
                        <UsersRound aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                        <span>{effectiveApplicationCounts.get(problem.id) ?? 0} hồ sơ</span>
                      </li>
                      <li className="inline-flex items-center gap-2">
                        <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                        <span>{problem._count.attachments} tài liệu</span>
                      </li>
                      <li className="inline-flex items-center gap-2">
                        <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                        <span>
                          Cập nhật{" "}
                          {new Intl.DateTimeFormat("vi-VN", {
                            dateStyle: "medium",
                          }).format(problem.updatedAt)}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <Link
                    className={`${buttonVariants({ variant: "outline" })} w-full shrink-0 sm:w-auto`}
                    href={`/business/problems/${problem.id}`}
                  >
                    Xem chi tiết
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </article>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
