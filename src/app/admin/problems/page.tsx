import Link from "next/link";
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
  ["PROTOTYPING", "Đang xây dựng Bản thử nghiệm (Prototype) / Đề xuất giải pháp"],
  ["EVALUATING", "Doanh nghiệp đang đánh giá"],
  ["CLOSED", "Đã kết thúc – không triển khai"],
  ["READY_FOR_IMPLEMENTATION", "Sẵn sàng soạn thỏa thuận triển khai"],
  ["COMPLETED", "Đã hoàn thành"],
  ["DRAFT", "Bản nháp"],
] as const;

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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Duyệt bài toán</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kiểm tra nội dung trước khi công khai cho sinh viên.
          </p>
        </div>
        <form action="/admin/problems" className="flex flex-col gap-2 sm:flex-row sm:items-center" method="get">
          <label className="text-sm font-medium" htmlFor="status">
            Lọc theo trạng thái
          </label>
          <select
            className="min-w-48 rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            type="submit"
          >
            Lọc
          </button>
        </form>
      </div>

      {problems.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          <h2 className="text-lg font-semibold">Không có bài toán ở trạng thái này</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Hãy chọn trạng thái khác hoặc quay lại khi có bài toán mới.
          </p>
        </section>
      ) : (
        <div className="mt-8 grid gap-4">
          {problems.map((problem) => (
            <article
              className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
              key={problem.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{problem.title}</h2>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      {getPrototypeProblemStatusLabel(problem)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    {problem.businessProfile.companyName}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {problem.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{problem.field}</span>
                    <span>{problem._count.attachments} tài liệu</span>
                    <span>
                      Gửi lúc{" "}
                      {problem.submittedAt
                        ? new Intl.DateTimeFormat("vi-VN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(problem.submittedAt)
                        : "Chưa gửi"}
                    </span>
                  </div>
                </div>
                <Link
                  className="shrink-0 rounded-xl border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted"
                  href={`/admin/problems/${problem.id}`}
                >
                  Xem và kiểm duyệt
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
