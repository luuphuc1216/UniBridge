import Link from "next/link";
import { Clock3, Coins, SearchX, Sparkles } from "lucide-react";
import { SavedProblemButton } from "@/components/student/saved-problem-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export type StudentProblemCard = {
  id: string;
  title: string;
  status: string;
  field: string;
  description: string;
  expectedDuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  businessProfile: { companyName: string };
  skills: { skill: { name: string } }[];
  saved: boolean;
  relevanceScore?: number;
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
  const statusLabels: Record<string, string> = {
    APPROVED: "Đã duyệt",
    PUBLISHED: "Đang nhận hồ sơ",
    TEAM_SELECTED: "Đã chọn nhóm",
    PROTOTYPING: "Đang xây dựng giải pháp",
    EVALUATING: "Đang được doanh nghiệp đánh giá",
  };
  if (problems.length === 0) {
    return (
      <EmptyState
        className="py-12"
        description="Thử thay đổi từ khóa hoặc bộ lọc để xem thêm kết quả."
        icon={<SearchX aria-hidden="true" className="h-5 w-5" />}
        title="Không tìm thấy bài toán phù hợp"
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
      {problems.map((problem) => (
        <Card className="flex flex-col p-5 transition-shadow hover:shadow-md motion-reduce:transition-none sm:p-6" key={problem.id}>
          <article className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge className="motion-reduce:transition-none" variant="secondary">
                {problem.field}
              </Badge>
              <Badge
                className="motion-reduce:transition-none"
                variant={problem.status === "PUBLISHED" ? "success" : "outline"}
              >
                {statusLabels[problem.status] ?? problem.status}
              </Badge>
            </div>
            <h2 className="mt-4 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
              {problem.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {problem.businessProfile.companyName}
            </p>
            <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
              {problem.description}
            </p>
            {problem.skills.length > 0 && (
              <ul aria-label="Kỹ năng liên quan" className="mt-4 flex flex-wrap gap-2">
                {problem.skills.map(({ skill }) => (
                  <li key={skill.name}>
                    <Badge className="font-normal motion-reduce:transition-none" variant="outline">
                      {skill.name}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {problem.relevanceScore !== undefined && (
              <p className="mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Mức phù hợp: {problem.relevanceScore}
              </p>
            )}
            <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-xs">Thời gian dự kiến</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {problem.expectedDuration}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Coins aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-xs">Ngân sách</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatCurrency(problem.budgetMin)} – {formatCurrency(problem.budgetMax)}
                  </dd>
                </div>
              </div>
            </dl>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Link
                className={cn(buttonVariants(), "w-full motion-reduce:transition-none")}
                href={`/student/problems/${problem.id}`}
              >
                Xem chi tiết
              </Link>
              <SavedProblemButton isSaved={problem.saved} problemId={problem.id} />
            </div>
          </article>
        </Card>
      ))}
    </div>
  );
}
