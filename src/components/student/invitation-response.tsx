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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
      <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
        Nhóm trưởng mới có thể phản hồi lời mời này.
      </p>
    );
  }

  return (
    <section aria-label="Phản hồi lời mời hợp tác" className="mt-4 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="motion-reduce:transition-none" variant="warning">
          {formatInvitationRemaining(expiresAt)}
        </Badge>
        <p className="text-xs text-muted-foreground">{formatInvitationExpiry(expiresAt)}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <form action={acceptAction}>
          <input name="applicationId" type="hidden" value={applicationId} />
          <input name="problemId" type="hidden" value={problemId} />
          <Button
            className="motion-reduce:transition-none"
            disabled={accepting || declining}
            type="submit"
          >
            {accepting ? "Đang đồng ý..." : "Đồng ý hợp tác"}
          </Button>
        </form>
        <Link
          className={cn(
            buttonVariants({ variant: "outline" }),
            "motion-reduce:transition-none",
          )}
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
          <Textarea
            className="text-base motion-reduce:transition-none sm:text-sm"
            name="declineReason"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        <Button
          className="motion-reduce:transition-none"
          variant="destructive"
          disabled={accepting || declining}
          type="submit"
        >
          {declining ? "Đang từ chối..." : "Từ chối lời mời"}
        </Button>
      </form>
      {(acceptState.error || declineState.error) && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {acceptState.error ?? declineState.error}
        </p>
      )}
      {declineState.success && (
        <p className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success" role="status">
          Đã gửi phản hồi từ chối lời mời.
        </p>
      )}
    </section>
  );
}
