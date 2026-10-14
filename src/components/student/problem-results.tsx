import Link from "next/link";
import { SavedProblemButton } from "@/components/student/saved-problem-button";

export type StudentProblemCard = {
  id: string;
  title: string;
  field: string;
  description: string;
  expectedDuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  businessProfile: { companyName: string };
  skills: { skill: { name: string } }[];
  saved: boolean;
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

export function ProblemResults({ problems }: { problems: StudentProblemCard[] }) {
  if (problems.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
        <h2 className="text-lg font-semibold">Không tìm thấy bài toán phù hợp</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thử thay đổi từ khóa hoặc bộ lọc để xem thêm kết quả.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
          {problem.skills.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {problem.skills.map(({ skill }) => (
                <li
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  key={skill.name}
                >
                  {skill.name}
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
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Link
              className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
              href={`/student/problems/${problem.id}`}
            >
              Xem chi tiết
            </Link>
            <SavedProblemButton
              isSaved={problem.saved}
              problemId={problem.id}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
