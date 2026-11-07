import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardList, Clock3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

const pageSize = 25;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function parsePage(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const [{ page: requestedPage }, total] = await Promise.all([
    searchParams,
    prisma.auditLog.count(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(parsePage(requestedPage), pageCount);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      action: true,
      targetType: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Nhật ký hoạt động
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Theo dõi các hoạt động được ghi nhận trên hệ thống. Nhật ký chỉ đọc.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tổng cộng {total.toLocaleString("vi-VN")} bản ghi.
          </p>
        </div>
        <Badge className="w-fit gap-1.5" variant="outline">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Chỉ đọc
        </Badge>
      </header>

      <section aria-label="Nhật ký hoạt động" className="mt-7">
        {logs.length === 0 ? (
          <EmptyState
            className="bg-card"
            description="Các hoạt động được ghi nhận sẽ xuất hiện tại đây."
            icon={<ClipboardList aria-hidden="true" className="size-5" />}
            title="Chưa có dữ liệu nhật ký"
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <p>
                Hiển thị {firstItem.toLocaleString("vi-VN")}–
                {lastItem.toLocaleString("vi-VN")}
              </p>
              <p>Tối đa {pageSize} bản ghi mỗi trang</p>
            </div>
            <Card className="overflow-hidden p-0">
              <ol className="divide-y divide-border">
                {logs.map((log, index) => (
                  <li
                    className="grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 sm:py-4"
                    key={`${log.createdAt.toISOString()}-${index}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {index === 0 && page === 1 ? (
                          <Clock3 aria-hidden="true" className="size-4" />
                        ) : (
                          <ClipboardList aria-hidden="true" className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-semibold">{log.action}</p>
                          {index === 0 && page === 1 && (
                            <Badge variant="default">Mới nhất</Badge>
                          )}
                        </div>
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Đối tượng</dt>
                            <dd className="break-words font-medium">{log.targetType}</dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Người thực hiện</dt>
                            <dd className="break-words font-medium">{log.actor.name}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                    <time
                      className="pl-12 text-sm text-muted-foreground sm:pl-0 sm:text-right"
                      dateTime={log.createdAt.toISOString()}
                    >
                      {dateFormatter.format(log.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        )}
      </section>

      <nav
        aria-label="Phân trang nhật ký"
        className="mt-6 flex flex-wrap items-center justify-between gap-3"
      >
        {page > 1 ? (
          <Link
            className={`${buttonVariants({ variant: "outline" })} min-w-0`}
            href={`/admin/audit-logs?page=${page - 1}`}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Trang trước
          </Link>
        ) : (
          <span />
        )}
        <p aria-current="page" className="text-sm text-muted-foreground">
          Trang {page.toLocaleString("vi-VN")} / {pageCount.toLocaleString("vi-VN")}
        </p>
        {page < pageCount ? (
          <Link
            className={`${buttonVariants({ variant: "outline" })} min-w-0`}
            href={`/admin/audit-logs?page=${page + 1}`}
          >
            Trang sau
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
