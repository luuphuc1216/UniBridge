import Link from "next/link";
import { activeApplicationsWhere } from "@/lib/applications";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING_REVIEW: "Chờ duyệt",
  NEEDS_REVISION: "Cần chỉnh sửa",
  CHANGES_REQUESTED: "Cần chỉnh sửa",
  APPROVED: "Đã duyệt",
  PUBLISHED: "Đang nhận hồ sơ",
  TEAM_SELECTED: "Đã chọn nhóm",
};

const statusClasses: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  NEEDS_REVISION: "bg-rose-100 text-rose-800",
  CHANGES_REQUESTED: "bg-rose-100 text-rose-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  TEAM_SELECTED: "bg-blue-100 text-blue-800",
};

export default async function BusinessProblemsPage() {
  const { businessProfileId } = await requireBusinessProfile();
  const problems = await prisma.problem.findMany({
    where: { businessProfileId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          applications: { where: activeApplicationsWhere },
          attachments: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bài toán của tôi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quản lý nội dung, hồ sơ ứng tuyển và trạng thái duyệt của các bài toán.
          </p>
        </div>
        <Link
          className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
          href="/business/problems/new"
        >
          Đăng bài toán mới
        </Link>
      </div>

      {problems.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          <h2 className="text-lg font-semibold">Bạn chưa đăng bài toán nào</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tạo bản nháp hoặc gửi bài toán để bắt đầu kết nối với các nhóm sinh viên.
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
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusClasses[problem.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {statusLabels[problem.status] ?? problem.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {problem.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{problem.field}</span>
                    <span>{problem._count.applications} hồ sơ</span>
                    <span>{problem._count.attachments} tài liệu</span>
                    <span>
                      Cập nhật{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "medium",
                      }).format(problem.updatedAt)}
                    </span>
                  </div>
                </div>
                <Link
                  className="shrink-0 rounded-xl border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-muted"
                  href={`/business/problems/${problem.id}`}
                >
                  Xem chi tiết
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
