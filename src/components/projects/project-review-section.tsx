import { ProjectReviewForm } from "@/components/projects/project-review-form";
import type { ProjectReviewState } from "@/lib/reputation-data";
import { reputationConfig, type ReviewDirection } from "@/lib/reputation-config";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

export function ProjectReviewSection({
  projectId,
  direction,
  reviewState,
}: {
  projectId: string;
  direction: ReviewDirection;
  reviewState: ProjectReviewState;
}) {
  const criteriaLabels = new Map<string, string>(
    Object.values(reputationConfig.criteria)
      .flat()
      .map(({ key, label }) => [key, label]),
  );

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-xl font-bold">Đánh giá sau dự án</h2>
      {reviewState.hasSubmitted ? (
        <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Bạn đã gửi đánh giá. Hai bên chỉ xem được nội dung khi cả hai đã gửi hoặc sau{" "}
          {reputationConfig.reviewVisibilityDelayDays} ngày kể từ ngày hoàn tất.
        </p>
      ) : (
        <div className="mt-4">
          <ProjectReviewForm direction={direction} projectId={projectId} />
        </div>
      )}
      {reviewState.publicReviews.length > 0 && (
        <ul className="mt-5 space-y-4">
          {reviewState.publicReviews.map((review) => (
            <li className="rounded-xl border border-border p-4" key={review.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{review.reviewerLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {review.rating.toFixed(1)} / 5 · {formatDate(review.createdAt)}
                </p>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(review.criteriaScores).map(([key, score]) => (
                  <div className="text-sm" key={key}>
                    <dt className="inline text-muted-foreground">
                      {criteriaLabels.get(key) ?? "Tiêu chí"}:{" "}
                    </dt>
                    <dd className="inline font-medium">{score} / 5</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{review.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
