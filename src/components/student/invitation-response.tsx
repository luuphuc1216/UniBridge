"use client";

import { useEffect, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  acceptInvitationAction,
  declineInvitationAction,
  type ApplicationActionState,
} from "@/app/student/applications/actions";
import {
  formatInvitationExpiry,
  formatInvitationRemaining,
} from "@/lib/application-status";

export function InvitationResponse({
  applicationId,
  problemId,
  expiresAt,
  canRespond,
}: {
  applicationId: string;
  problemId: string;
  expiresAt: Date;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [acceptState, acceptAction, accepting] = useActionState<
    ApplicationActionState,
    FormData
  >(acceptInvitationAction, { error: null });
  const [declineState, declineAction, declining] = useActionState<
    ApplicationActionState,
    FormData
  >(declineInvitationAction, { error: null });
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (acceptState.success) {
      router.push(`/student/workspace/${problemId}?applicationId=${applicationId}`);
    }
  }, [acceptState.success, applicationId, problemId, router]);

  if (!canRespond) {
    return (
      <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Nhóm trưởng mới có thể phản hồi lời mời này.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="text-sm font-medium text-amber-800">
        <p>{formatInvitationRemaining(expiresAt)}</p>
        <p className="mt-1 text-xs font-normal">{formatInvitationExpiry(expiresAt)}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <form action={acceptAction}>
          <input name="applicationId" type="hidden" value={applicationId} />
          <input name="problemId" type="hidden" value={problemId} />
          <button
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={accepting || declining}
            type="submit"
          >
            {accepting ? "Đang đồng ý..." : "Đồng ý hợp tác"}
          </button>
        </form>
        <Link
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          href={`/student/workspace/${problemId}?applicationId=${applicationId}`}
        >
          Mở chat
        </Link>
      </div>
      <form action={declineAction} className="space-y-2">
        <input name="applicationId" type="hidden" value={applicationId} />
        <input name="problemId" type="hidden" value={problemId} />
        <label className="grid gap-2 text-sm font-medium">
          Lý do từ chối (không bắt buộc)
          <textarea
            className="min-h-20 rounded-xl border border-border bg-background px-3 py-2 font-normal"
            name="declineReason"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        <button
          className="rounded-xl border border-destructive px-4 py-2.5 text-sm font-semibold text-destructive disabled:opacity-60"
          disabled={accepting || declining}
          type="submit"
        >
          {declining ? "Đang từ chối..." : "Từ chối lời mời"}
        </button>
      </form>
      {(acceptState.error || declineState.error) && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {acceptState.error ?? declineState.error}
        </p>
      )}
    </div>
  );
}
