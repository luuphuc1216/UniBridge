"use client";

import { useActionState } from "react";
import {
  reviewProposalHandoffAction,
  type ProposalHandoffActionState,
} from "@/app/admin/prototype-handoffs/actions";

const checklist = [
  ["filesOrLinksComplete", "Tệp hoặc đường dẫn bàn giao đầy đủ"],
  ["withinTrialBriefScope", "Nằm trong phạm vi hồ sơ thử nghiệm đã thống nhất"],
  ["compliesWithRules", "Tuân thủ quy định của nền tảng"],
] as const;

export function ProposalHandoffReviewForm({
  attemptId,
  problemId,
}: {
  attemptId: string;
  problemId: string;
}) {
  const [state, action, pending] = useActionState<ProposalHandoffActionState, FormData>(
    reviewProposalHandoffAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5">
      <input name="attemptId" type="hidden" value={attemptId} />
      <input name="problemId" type="hidden" value={problemId} />
      <h2 className="text-lg font-semibold">Danh sách kiểm tra</h2>
      <p className="text-sm text-muted-foreground">
        Chọn Đạt hoặc Chưa đạt cho từng mục. Kết quả đạt yêu cầu cả ba mục; kết quả trả về cần ít nhất một mục chưa đạt và nêu nội dung cần bổ sung.
      </p>
      {checklist.map(([name, label]) => (
        <fieldset className="rounded-xl border border-border p-3" key={name}>
          <legend className="px-1 text-sm font-medium">{label}</legend>
          <div className="mt-2 flex gap-5 text-sm">
            {[
              ["true", "Đạt"],
              ["false", "Chưa đạt"],
            ].map(([value, choice]) => (
              <label className="flex items-center gap-2" key={value}>
                <input name={name} required type="radio" value={value} />
                {choice}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="block text-sm font-medium">
        Ghi chú kiểm tra
        <textarea className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3" maxLength={4000} name="note" required />
      </label>
      <label className="block text-sm font-medium">
        Mục cần bổ sung (mỗi dòng một mục; bắt buộc nếu có mục Chưa đạt)
        <textarea className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3" name="missingItems" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={pending}
          name="decision"
          type="submit"
          value="APPROVED"
        >
          {pending ? "Đang lưu..." : "Đạt kiểm tra bàn giao"}
        </button>
        <button
          className="rounded-xl border border-destructive px-4 py-2.5 text-sm font-semibold text-destructive disabled:opacity-60"
          disabled={pending}
          name="decision"
          type="submit"
          value="RETURNED"
        >
          Trả nhóm bổ sung
        </button>
      </div>
      {state.error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{state.error}</p>}
    </form>
  );
}
