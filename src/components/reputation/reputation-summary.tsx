import type { TeamReputation } from "@/lib/reputation";

function formatRate(rate: number | null): string {
  return rate === null ? "Chưa có dữ liệu" : `${rate}%`;
}

export function ReputationSummary({ reputation }: { reputation: TeamReputation }) {
  const metrics = [
    ["Đánh giá trung bình", reputation.ratingAverage === null ? "Chưa có đánh giá" : `${reputation.ratingAverage.toFixed(1)} / 5`],
    ["Số đánh giá", String(reputation.ratingCount)],
    ["Dự án hoàn tất", String(reputation.completedProjectCount)],
    ["Tỷ lệ hoàn thành", formatRate(reputation.completionRate)],
    ["Milestone đúng hạn", formatRate(reputation.onTimeRate)],
    ["Đánh giá tích cực", String(reputation.positiveReviewCount)],
    ["Giao dịch đã ghi nhận", String(reputation.transactionCount)],
  ];

  return (
    <section aria-label="Reputation nhóm" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Reputation nhóm</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Điểm tổng hợp được làm mượt theo số lượng đánh giá; hồ sơ mới không bị một lượt
            đánh giá chi phối.
          </p>
        </div>
        <p className="text-2xl font-bold text-primary">
          {reputation.score === null ? "Chưa có dữ liệu" : `${reputation.score} / 100`}
        </p>
      </div>
      {reputation.ratingCount > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Điểm đánh giá làm mượt: {reputation.smoothedRatingAverage.toFixed(1)} / 5
        </p>
      )}
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div className="rounded-xl bg-muted/50 p-3" key={label}>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
