"use client";

import { useActionState } from "react";
import {
  submitProjectReviewAction,
  type ReviewActionState,
} from "@/app/projects/reviews/actions";
import { reputationConfig, type ReviewDirection } from "@/lib/reputation-config";

const initialState: ReviewActionState = { error: null };

export function ProjectReviewForm({
  projectId,
  direction,
}: {
  projectId: string;
  direction: ReviewDirection;
}) {
  const [state, formAction, isPending] = useActionState(
    submitProjectReviewAction,
    initialState,
  );
  const criteria = reputationConfig.criteria[direction];

  return (
    <form action={formAction} className="space-y-5">
      <input name="projectId" type="hidden" value={projectId} />
      <p className="text-sm leading-6 text-muted-foreground">
        Mỗi tiêu chí dùng thang 1–5. Đánh giá sẽ được giữ kín cho đến khi hai bên cùng gửi
        hoặc đủ {reputationConfig.reviewVisibilityDelayDays} ngày từ khi dự án hoàn tất.
      </p>
      {criteria.map((criterion) => (
        <fieldset className="rounded-xl border border-border p-4" key={criterion.key}>
          <legend className="px-1 text-sm font-semibold">{criterion.label}</legend>
          <p className="mt-1 text-sm text-muted-foreground">{criterion.explanation}</p>
          <label className="mt-3 block text-sm font-medium" htmlFor={`score_${criterion.key}`}>
            Mức đánh giá
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            defaultValue=""
            id={`score_${criterion.key}`}
            name={`score_${criterion.key}`}
            required
          >
            <option disabled value="">Chọn mức điểm</option>
            {reputationConfig.ratingScale.map(({ value, label, explanation }) => (
              <option key={value} value={value}>
                {value} — {label}: {explanation}
              </option>
            ))}
          </select>
        </fieldset>
      ))}
      <label className="block text-sm font-semibold" htmlFor="review-content">
        Nhận xét
      </label>
      <textarea
        className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        id="review-content"
        maxLength={3000}
        name="content"
        required
      />
      {state.error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          {state.success}
        </p>
      )}
      <button
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </form>
  );
}
