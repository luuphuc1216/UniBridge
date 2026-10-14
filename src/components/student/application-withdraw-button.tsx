"use client";

import { useActionState } from "react";
import {
  withdrawApplicationAction,
  type ApplicationActionState,
} from "@/app/student/applications/actions";

export function ApplicationWithdrawButton({ problemId }: { problemId: string }) {
  const [state, formAction, isPending] = useActionState<
    ApplicationActionState,
    FormData
  >(withdrawApplicationAction, { error: null });

  return (
    <form action={formAction} className="mt-3">
      <input name="problemId" type="hidden" value={problemId} />
      {state.error && (
        <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="w-full rounded-xl border border-destructive/40 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Đang rút..." : "Rút hồ sơ"}
      </button>
    </form>
  );
}
