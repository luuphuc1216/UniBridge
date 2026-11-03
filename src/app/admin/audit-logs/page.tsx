import Link from "next/link";
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Nhật ký hoạt động</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tổng cộng {total.toLocaleString("vi-VN")} hoạt động. Nhật ký chỉ đọc.
      </p>
      {logs.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu
        </p>
      ) : (
        <ol className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card px-5">
          {logs.map((log, index) => (
            <li className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-center" key={`${log.createdAt.toISOString()}-${index}`}>
              <div>
                <p className="font-semibold">{log.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {log.targetType} · {log.actor.name}
                </p>
              </div>
              <time className="text-sm text-muted-foreground" dateTime={log.createdAt.toISOString()}>
                {dateFormatter.format(log.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
      <nav aria-label="Phân trang nhật ký" className="mt-6 flex items-center justify-between gap-4">
        {page > 1 ? (
          <Link className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href={`/admin/audit-logs?page=${page - 1}`}>
            ← Trang trước
          </Link>
        ) : <span />}
        <span className="text-sm text-muted-foreground">
          Trang {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Link className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href={`/admin/audit-logs?page=${page + 1}`}>
            Trang sau →
          </Link>
        ) : <span />}
      </nav>
    </main>
  );
}
