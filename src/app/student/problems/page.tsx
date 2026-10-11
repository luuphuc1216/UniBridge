import Link from "next/link";
import { requireStudent } from "@/lib/student-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

function formatCurrency(amount: number | null): string {
  return amount === null
    ? "Chưa xác định"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
}

export default async function StudentProblemsPage() {
  await requireStudent();
  const problems = await prisma.problem.findMany({
    where: { status: { in: ["APPROVED", "PUBLISHED", "TEAM_SELECTED"] } },
    orderBy: { approvedAt: "desc" },
    include: {
      businessProfile: { select: { companyName: true } },
      _count: { select: { attachments: true } },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực sinh viên</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Bài toán doanh nghiệp</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Khám phá những bài toán đã được kiểm duyệt và công khai.
      </p>

      {problems.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
          <h2 className="text-lg font-semibold">Chưa có bài toán công khai</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Các bài toán sẽ xuất hiện tại đây sau khi được nền tảng kiểm duyệt.
          </p>
        </section>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {problems.map((problem) => (
            <article
              className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
              key={problem.id}
            >
              <p className="text-sm font-semibold text-primary">{problem.field}</p>
              <h2 className="mt-2 text-lg font-semibold">{problem.title}</h2>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {problem.businessProfile.companyName}
              </p>
              <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                {problem.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Thời gian: {problem.expectedDuration}</span>
                <span>Ngân sách: {formatCurrency(problem.budgetMin)}</span>
                <span>{problem._count.attachments} tài liệu</span>
              </div>
              <Link
                className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
                href={`/student/problems/${problem.id}`}
              >
                Xem chi tiết
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
