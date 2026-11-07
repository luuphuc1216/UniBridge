import Link from "next/link";
import type { ReviewPage, TeamHistoryEntry } from "@/lib/reputation-data";
import { reputationConfig } from "@/lib/reputation-config";
import { ReportContentButton } from "@/components/reports/report-content-button";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

export function ReviewList({
  reviewPage,
  basePath,
  title = "Đánh giá đã công khai",
  presentation = "default",
}: {
  reviewPage: ReviewPage;
  basePath: string;
  title?: string;
  presentation?: "default" | "public";
}) {
  const isPublic = presentation === "public";
  const criteriaLabels = new Map<string, string>(
    Object.values(reputationConfig.criteria)
      .flat()
      .map(({ key, label }) => [key, label]),
  );

  return (
    <section
      className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${isPublic ? "shadow-sm" : ""}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={isPublic ? "text-lg font-semibold" : "text-xl font-bold"}>
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reviewPage.totalCount} đánh giá đã được công khai.
          </p>
        </div>
        {reviewPage.pageCount > 1 && (
          <nav aria-label="Phân trang đánh giá" className="flex items-center gap-2 text-sm">
            {reviewPage.page > 1 && (
              <Link
                className={`rounded-lg border border-border px-3 py-2 hover:bg-muted ${isPublic ? "inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none" : ""}`}
                href={`${basePath}?page=${reviewPage.page - 1}`}
              >
                Trước
              </Link>
            )}
            <span>
              Trang {reviewPage.page} / {reviewPage.pageCount}
            </span>
            {reviewPage.page < reviewPage.pageCount && (
              <Link
                className={`rounded-lg border border-border px-3 py-2 hover:bg-muted ${isPublic ? "inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none" : ""}`}
                href={`${basePath}?page=${reviewPage.page + 1}`}
              >
                Tiếp
              </Link>
            )}
          </nav>
        )}
      </div>
      {reviewPage.reviews.length === 0 ? (
        <p
          className={`mt-4 rounded-xl p-4 text-sm text-muted-foreground ${isPublic ? "border border-dashed border-border bg-background" : "bg-muted/50"}`}
        >
          Chưa có đánh giá nào được công khai.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {reviewPage.reviews.map((review) => (
            <li
              className={`rounded-xl border border-border p-4 ${isPublic ? "bg-background shadow-sm" : ""}`}
              key={review.id}
            >
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
              <ReportContentButton targetType="REVIEW" targetId={review.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TeamHistory({
  entries,
  presentation = "default",
}: {
  entries: TeamHistoryEntry[];
  presentation?: "default" | "public";
}) {
  const isPublic = presentation === "public";

  return (
    <section
      className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${isPublic ? "shadow-sm" : ""}`}
    >
      <h2 className={isPublic ? "text-lg font-semibold" : "text-xl font-bold"}>
        Lịch sử dự án và giao dịch
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chỉ hiển thị trạng thái và thời điểm; không hiển thị giá trị giao dịch của dự án.
      </p>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Chưa có lịch sử phù hợp để hiển thị.</p>
      ) : (
        isPublic ? (
          <ol className="relative mt-5 space-y-0 border-l border-border pl-6">
            {entries.map((entry) => (
              <li className="relative pb-5 last:pb-0" key={entry.id}>
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.925rem] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-card"
                />
                <p className="break-words text-sm font-medium">{entry.label}</p>
                <time
                  className="mt-1 block text-sm text-muted-foreground"
                  dateTime={entry.date.toISOString()}
                >
                  {formatDate(entry.date)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {entries.map((entry) => (
              <li className="flex justify-between gap-3 py-3 first:pt-0" key={entry.id}>
                <span className="text-sm font-medium">{entry.label}</span>
                <time className="text-sm text-muted-foreground" dateTime={entry.date.toISOString()}>
                  {formatDate(entry.date)}
                </time>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
