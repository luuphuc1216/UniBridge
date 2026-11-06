"use client";

import { useActionState } from "react";
import {
  reviewProblemAction,
  runAiProblemReviewAction,
  overrideProblemReviewAction,
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
          Lý do xử lý (bắt buộc khi yêu cầu chỉnh sửa hoặc từ chối)
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          id="reviewNote"
          maxLength={2000}
          name="reviewNote"
          placeholder="Nêu rõ nội dung cần bổ sung, chỉnh sửa hoặc lý do từ chối..."
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
          className="rounded-xl border border-destructive/40 px-5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
          disabled={isPending}
          name="decision"
          type="submit"
          value="reject"
        >
          {isPending ? "Đang xử lý..." : "Từ chối"}
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

export function AiProblemReviewPanel({
  problemId,
  initialResult,
}: {
  problemId: string;
  initialResult?: ReviewActionState["aiResult"];
}) {
  const [state, action, isPending] = useActionState(runAiProblemReviewAction, {
    error: null,
    aiResult: initialResult,
  });
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">AI kiểm tra</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI chỉ gợi ý; quản trị viên vẫn có quyền quyết định cuối cùng.
          </p>
        </div>
        <form action={action}>
          <input name="problemId" type="hidden" value={problemId} />
          <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isPending} type="submit">
            {isPending ? "Đang kiểm tra..." : "AI kiểm tra"}
          </button>
        </form>
      </div>
      {state.error && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}
      {state.aiResult && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Kết luận đề xuất: {state.aiResult.conclusion}</p>
          <ul className="space-y-2 text-sm">
            {state.aiResult.checklist.map((item) => (
              <li className="rounded-lg border border-border bg-background p-3" key={item.key}>
                <strong>{item.passed ? "ĐẠT" : "KHÔNG ĐẠT"}</strong> · {item.key}: {item.reason}
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-wrap text-sm">{state.aiResult.reason}</p>
        </div>
      )}
    </section>
  );
}

export function ProblemOverrideForm({ problemId }: { problemId: string }) {
  const [state, action, isPending] = useActionState(overrideProblemReviewAction, { error: null });
  return (
    <form action={action} className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Admin ghi đè kết quả</h2>
      <input name="problemId" type="hidden" value={problemId} />
      <textarea className="mt-3 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm" name="reviewNote" placeholder="Lý do khi yêu cầu chỉnh sửa hoặc từ chối" />
      {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["withdraw", "Thu hồi duyệt"],
          ["requestRevision", "Cần chỉnh sửa"],
          ["reject", "Từ chối"],
          ["approve", "Duyệt lại"],
        ].map(([value, label]) => (
          <button className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={isPending} name="decision" type="submit" value={value} key={value}>
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}
