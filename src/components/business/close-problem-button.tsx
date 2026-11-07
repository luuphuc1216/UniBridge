"use client";

import { useActionState } from "react";
import { closeProblemAction, type ProblemActionState } from "@/app/business/problems/actions";

export function CloseProblemButton({ problemId }: { problemId: string }) {
  const [state, action, pending] = useActionState<ProblemActionState, FormData>(
    closeProblemAction,
    { error: null },
  );
  return (
    <div>
      <form action={action} onSubmit={(event) => {
        if (!window.confirm("Đóng bài toán sẽ ngừng nhận hồ sơ mới và không hoàn lại lượt đăng. Bạn có chắc chắn không?")) {
          event.preventDefault();
        }
      }}>
        <input name="problemId" type="hidden" value={problemId} />
        <button className="rounded-xl border border-destructive px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:transition-none" disabled={pending} type="submit">
          {pending ? "Đang đóng..." : "Đóng vấn đề"}
        </button>
      </form>
      {state.error && <p className="mt-2 max-w-xs text-sm text-destructive" role="alert">{state.error}</p>}
    </div>
  );
}
