"use client";

import { useActionState } from "react";
import {
  withdrawApplicationAction,
  type ApplicationActionState,
} from "@/app/student/applications/actions";
import { Button } from "@/components/ui/button";

export function ApplicationWithdrawButton({ problemId }: { problemId: string }) {
  const [state, formAction, isPending] = useActionState<
    ApplicationActionState,
    FormData
  >(withdrawApplicationAction, { error: null });

  return (
    <form action={formAction} className="mt-3">
      <input name="problemId" type="hidden" value={problemId} />
      {state.error && (
        <p className="mb-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success" role="status">
          Đã rút hồ sơ ứng tuyển.
        </p>
      )}
      <Button
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive motion-reduce:transition-none sm:w-auto"
        disabled={isPending}
        type="submit"
        variant="outline"
      >
        {isPending ? "Đang rút..." : "Rút hồ sơ"}
      </Button>
    </form>
  );
}
