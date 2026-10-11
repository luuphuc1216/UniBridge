"use client";

import { useActionState } from "react";
import {
  reviewProblemAction,
  type ReviewActionState,
} from "@/app/admin/problems/actions";

const checklist = [
  ["businessInfo", "Thông tin doanh nghiệp"],
  ["problemDescription", "Mô tả vấn đề"],
  ["requirements", "Mức độ đầy đủ của yêu cầu"],
  ["field", "Lĩnh vực"],
  ["attachments", "Tài liệu đính kèm"],
  ["policy", "Vi phạm quy định"],
] as const;

const initialState: ReviewActionState = { error: null };

export function ProblemReviewForm({ problemId }: { problemId: string }) {
  const [state, action, isPending] = useActionState(
    reviewProblemAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <input name="problemId" type="hidden" value={problemId} />
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Checklist kiểm duyệt</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {checklist.map(([name, label]) => (
            <label
              className="flex min-h-12 items-start gap-3 rounded-xl border border-border p-3 text-sm"
              key={name}
            >
              <input
                className="mt-0.5 size-4 accent-primary"
                name={name}
                type="checkbox"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="text-sm font-semibold" htmlFor="reviewNote">
          Lý do yêu cầu chỉnh sửa
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          id="reviewNote"
          maxLength={2000}
          name="reviewNote"
          placeholder="Nêu rõ nội dung doanh nghiệp cần bổ sung hoặc chỉnh sửa..."
        />
      </div>
      {state.error && (
        <p aria-live="polite" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          className="rounded-xl border border-amber-300 px-5 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          disabled={isPending}
          name="decision"
          type="submit"
          value="requestRevision"
        >
          {isPending ? "Đang xử lý..." : "Yêu cầu chỉnh sửa"}
        </button>
        <button
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          disabled={isPending}
          name="decision"
          type="submit"
          value="approve"
        >
          {isPending ? "Đang xử lý..." : "Duyệt"}
        </button>
      </div>
    </form>
  );
}
