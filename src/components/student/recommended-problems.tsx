import Link from "next/link";
import { recommendationConfig } from "@/lib/recommendation-config";

export type RecommendedProblemCard = {
  id: string;
  title: string;
  field: string;
  description: string;
  expectedDuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  companyName: string;
  skills: string[];
  reasons: string[];
  isNew: boolean;
};

function formatCurrency(amount: number | null): string {
  return amount === null
    ? "Chưa xác định"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
}

export function RecommendedProblems({
  hasTeam,
  problems,
}: {
  hasTeam: boolean;
  problems: RecommendedProblemCard[];
}) {
  if (!hasTeam) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Gợi ý cho nhóm bạn</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Hãy tạo hồ sơ nhóm để nhận gợi ý phù hợp với chuyên ngành, kỹ năng và lĩnh vực quan tâm.
        </p>
        <Link
          className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          href="/student/team"
        >
          Tạo hồ sơ nhóm
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-4">
        <p className="text-sm font-semibold text-primary">Dành riêng cho nhóm bạn</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Gợi ý cho nhóm bạn</h2>
      </div>
      {problems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
          Hiện chưa có bài toán APPROVED phù hợp để hiển thị. Bài đã ứng tuyển hoặc đã chọn nhóm sẽ không xuất hiện ở đây.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {problems.slice(0, recommendationConfig.maxItems).map((problem) => (
            <article
              className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"
              key={problem.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">{problem.field}</p>
                {problem.isNew && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    Bài mới
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-lg font-semibold leading-6">{problem.title}</h3>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {problem.companyName}
              </p>
              <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                {problem.description}
              </p>
              {problem.reasons.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Lý do gợi ý">
                  {problem.reasons.slice(0, recommendationConfig.maxReasons).map((reason) => (
                    <li
                      className="rounded-full bg-muted px-2.5 py-1 text-xs leading-5 text-muted-foreground"
                      key={reason}
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
              {problem.skills.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {problem.skills.slice(0, 4).map((skill) => (
                    <li
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      key={skill}
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Thời gian: {problem.expectedDuration}</span>
                <span>
                  Ngân sách: {formatCurrency(problem.budgetMin)} –{" "}
                  {formatCurrency(problem.budgetMax)}
                </span>
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
    </section>
  );
}
