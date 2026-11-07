import Link from "next/link";
import { ArrowRight, Lightbulb, UsersRound } from "lucide-react";
import { recommendationConfig } from "@/lib/recommendation-config";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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
      <section aria-labelledby="recommendations-title" className="mt-10">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-wide text-primary">
            Dành cho nhóm của bạn
          </p>
          <h2
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
            id="recommendations-title"
          >
            Bài toán phù hợp với nhóm
          </h2>
        </div>
        <EmptyState
          action={
            <Link
              className={`${buttonVariants({ size: "lg" })} motion-reduce:transition-none`}
              href="/student/team"
            >
              Tạo hồ sơ nhóm
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
          description="Hãy tạo hồ sơ nhóm để nhận gợi ý phù hợp với chuyên ngành, kỹ năng và lĩnh vực quan tâm."
          icon={<UsersRound aria-hidden="true" className="size-5" />}
          title="Gợi ý cho nhóm bạn"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="recommendations-title" className="mt-10">
      <div className="mb-5">
        <p className="text-sm font-semibold tracking-wide text-primary">
          Dành riêng cho nhóm bạn
        </p>
        <h2
          className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          id="recommendations-title"
        >
          Bài toán phù hợp với nhóm
        </h2>
      </div>
      {problems.length === 0 ? (
        <EmptyState
          description="Bài đã ứng tuyển hoặc đã chọn nhóm sẽ không xuất hiện ở đây."
          icon={<Lightbulb aria-hidden="true" className="size-5" />}
          title="Hiện chưa có bài toán đã duyệt phù hợp để hiển thị."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {problems.slice(0, recommendationConfig.maxItems).map((problem) => (
            <Card
              className="flex min-w-0 flex-col p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md motion-reduce:transition-none"
              key={problem.id}
            >
              <article className="flex h-full min-w-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="secondary">{problem.field}</Badge>
                  {problem.isNew && <Badge variant="warning">Bài mới</Badge>}
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-6">
                  {problem.title}
                </h3>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {problem.companyName}
                </p>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {problem.description}
                </p>
                {problem.reasons.length > 0 && (
                  <ul
                    className="mt-4 flex flex-wrap gap-1.5"
                    aria-label="Lý do gợi ý"
                  >
                    {problem.reasons
                      .slice(0, recommendationConfig.maxReasons)
                      .map((reason) => (
                        <li key={reason}>
                          <Badge variant="outline">{reason}</Badge>
                        </li>
                      ))}
                  </ul>
                )}
                {problem.skills.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Kỹ năng yêu cầu">
                    {problem.skills.slice(0, 4).map((skill) => (
                      <li key={skill}>
                        <Badge variant="outline">{skill}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-muted-foreground">
                  <span>Thời gian: {problem.expectedDuration}</span>
                  <span>
                    Ngân sách: {formatCurrency(problem.budgetMin)} –{" "}
                    {formatCurrency(problem.budgetMax)}
                  </span>
                </div>
                <Link
                  aria-label={`Xem chi tiết bài toán: ${problem.title}`}
                  className={`${buttonVariants()} mt-5 w-full motion-reduce:transition-none`}
                  href={`/student/problems/${problem.id}`}
                >
                  Xem chi tiết
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </article>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
