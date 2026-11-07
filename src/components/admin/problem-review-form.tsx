"use client";

import { useActionState } from "react";
import {
  reviewProblemAction,
  runAiProblemReviewAction,
  overrideProblemReviewAction,
  type ReviewActionState,
} from "@/app/admin/problems/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStoredAdminAiAssistStatus } from "@/lib/ai/admin-assist";

const checklist = [
  ["businessInfo", "Thông tin doanh nghiệp"],
  ["problemDescription", "Mô tả vấn đề"],
  ["requirements", "Mức độ đầy đủ của yêu cầu"],
  ["field", "Lĩnh vực"],
  ["attachments", "Tài liệu đính kèm"],
  ["policy", "Vi phạm quy định"],
] as const;

const initialState: ReviewActionState = { error: null };

const aiKeyLabels: Record<string, string> = {
  clarity: "Độ rõ ràng",
  scope: "Phạm vi",
  student_fit: "Mức độ phù hợp với sinh viên",
  policy: "Quy định",
};

const aiConclusionLabels: Record<string, string> = {
  APPROVE: "Đề xuất duyệt",
  REQUEST_REVISION: "Đề xuất yêu cầu chỉnh sửa",
  REJECT: "Đề xuất từ chối",
  UNCERTAIN: "Chưa đủ cơ sở kết luận",
};

export function ProblemReviewForm({ problemId }: { problemId: string }) {
  const [state, action, isPending] = useActionState(
    reviewProblemAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <input name="problemId" type="hidden" value={problemId} />
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Sáu tiêu chí rà soát</legend>
        <p className="text-sm leading-6 text-muted-foreground">
          Đánh dấu từng tiêu chí sau khi đã kiểm tra. Cần hoàn thành cả sáu mục để duyệt.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {checklist.map(([name, label], index) => (
            <label
              className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              key={name}
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {index + 1}
              </span>
              <input
                className="mt-1 size-4 shrink-0 accent-primary"
                name={name}
                type="checkbox"
              />
              <span className="font-medium leading-6">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="text-sm font-semibold" htmlFor="reviewNote">
          Lý do xử lý
          <span className="font-normal text-muted-foreground">
            {" "}
            (bắt buộc khi yêu cầu chỉnh sửa hoặc từ chối)
          </span>
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="reviewNote"
          maxLength={2000}
          name="reviewNote"
          placeholder="Nêu rõ nội dung cần bổ sung, chỉnh sửa hoặc lý do từ chối..."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Tối đa 2.000 ký tự.
        </p>
      </div>
      {state.error && (
        <p
          aria-live="polite"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          className="w-full whitespace-normal text-center"
          disabled={isPending}
          name="decision"
          type="submit"
          value="requestRevision"
          variant="outline"
        >
          {isPending ? "Đang xử lý..." : "Yêu cầu chỉnh sửa"}
        </Button>
        <Button
          className="w-full"
          disabled={isPending}
          name="decision"
          type="submit"
          value="reject"
          variant="destructive"
        >
          {isPending ? "Đang xử lý..." : "Từ chối"}
        </Button>
        <Button
          className="w-full"
          disabled={isPending}
          name="decision"
          type="submit"
          value="approve"
        >
          {isPending ? "Đang xử lý..." : "Duyệt"}
        </Button>
      </div>
    </form>
  );
}

export function AiProblemReviewPanel({
  problemId,
  initialResult,
  initialReviewStatus,
  initialReviewVersion,
  problemVersion,
}: {
  problemId: string;
  initialResult?: ReviewActionState["aiResult"];
  initialReviewStatus?: string;
  initialReviewVersion?: number | null;
  problemVersion: number;
}) {
  const initialAiStatus =
    initialResult && initialReviewStatus
      ? getStoredAdminAiAssistStatus(
          initialReviewStatus,
          initialReviewVersion ?? null,
          problemVersion,
        )
      : undefined;
  const [state, action, isPending] = useActionState(runAiProblemReviewAction, {
    error: null,
    aiStatus: initialAiStatus,
    aiResult: initialResult,
  });
  const currentAiStatus = state.aiStatus ?? initialAiStatus;
  const currentAiMessage =
    state.aiMessage ??
    (currentAiStatus === "AI"
      ? "Kết quả AI chỉ mang tính tham khảo; Admin tự kiểm tra và quyết định."
      : currentAiStatus === "RULES_ONLY"
        ? "Đây là kết quả kiểm tra theo quy tắc, không phải phản hồi từ provider AI."
        : currentAiStatus === "UNAVAILABLE"
          ? "AI hiện không khả dụng. Các nhận xét theo quy tắc (nếu có) chỉ mang tính tham khảo."
          : currentAiStatus === "STALE"
            ? "Kết quả thuộc phiên bản bài toán cũ. Không dùng kết quả này để đưa ra quyết định hiện tại."
            : null);

  return (
    <section
      aria-labelledby="ai-review-heading"
      aria-busy={isPending}
      className="min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className="mb-3" variant="outline">
            Công cụ hỗ trợ
          </Badge>
          <h2 className="text-lg font-semibold" id="ai-review-heading">
            AI hỗ trợ kiểm duyệt
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            AI chỉ đưa ra gợi ý tham khảo; Admin tự kiểm tra và quyết định kết quả.
            Kết quả không tự cập nhật trạng thái bài toán hoặc checklist kiểm duyệt.
          </p>
        </div>
        <form action={action} className="shrink-0">
          <input name="problemId" type="hidden" value={problemId} />
          <Button className="w-full sm:w-auto" disabled={isPending} type="submit">
            {isPending ? "Đang kiểm tra..." : "Chạy AI kiểm tra"}
          </Button>
        </form>
      </div>

      {isPending && (
        <p aria-live="polite" className="mt-4 text-sm text-muted-foreground" role="status">
          Đang phân tích nội dung. Vui lòng chờ...
        </p>
      )}
      {state.error && (
        <p
          aria-live="assertive"
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      {!state.error && currentAiMessage && (
        <p
          aria-live="polite"
          className={`mt-4 rounded-xl border p-3 text-sm leading-6 ${
            currentAiStatus === "UNAVAILABLE" || currentAiStatus === "STALE"
              ? "border-warning/40 bg-warning/10 text-foreground"
              : "border-primary/20 bg-background text-muted-foreground"
          }`}
          role="status"
        >
          {currentAiMessage}
        </p>
      )}
      {state.aiResult ? (
        <div className="mt-5 space-y-4 border-t border-primary/15 pt-4">
          <p className="text-sm font-semibold">
            {aiConclusionLabels[state.aiResult.conclusion] ??
              state.aiResult.conclusion}
            <span className="ml-2 font-normal text-muted-foreground">
              {currentAiStatus === "RULES_ONLY"
                ? "(kiểm tra theo quy tắc)"
                : currentAiStatus === "UNAVAILABLE"
                  ? "(không có phản hồi AI)"
                  : currentAiStatus === "STALE"
                    ? "(phiên bản cũ)"
                    : "(gợi ý tham khảo)"}
            </span>
          </p>
          {state.aiResult.checklist.length > 0 ? (
            <ul className="grid gap-2">
              {state.aiResult.checklist.map((item) => (
                <li
                  className="min-w-0 rounded-xl border border-border bg-background p-3"
                  key={item.key}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.passed ? "success" : "destructive"}>
                      {item.passed ? "Đạt" : "Chưa đạt"}
                    </Badge>
                    <span className="break-words text-sm font-semibold">
                      {aiKeyLabels[item.key] ?? item.key}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Không có nhận xét theo từng tiêu chí.
            </p>
          )}
          {state.aiResult.reason && (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {state.aiResult.reason}
            </p>
          )}
        </div>
      ) : (
        !state.error &&
        !isPending && (
          <p className="mt-4 rounded-xl border border-dashed border-primary/25 bg-background/70 p-4 text-sm text-muted-foreground">
            Chưa có kết quả AI. Nếu cần, Admin có thể chạy kiểm tra và dùng kết quả như tài liệu tham khảo.
          </p>
        )
      )}
    </section>
  );
}

export function ProblemOverrideForm({ problemId }: { problemId: string }) {
  const [state, action, isPending] = useActionState(
    overrideProblemReviewAction,
    { error: null },
  );

  return (
    <form action={action} className="space-y-4">
      <input name="problemId" type="hidden" value={problemId} />
      <div>
        <label className="text-sm font-semibold" htmlFor="overrideReviewNote">
          Lý do xử lý
          <span className="font-normal text-muted-foreground">
            {" "}
            (bắt buộc với các lựa chọn cần chỉnh sửa hoặc từ chối)
          </span>
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          id="overrideReviewNote"
          name="reviewNote"
          placeholder="Nêu lý do chỉnh sửa hoặc từ chối"
        />
      </div>
      {state.error && (
        <p
          aria-live="polite"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["withdraw", "Thu hồi duyệt"],
          ["requestRevision", "Yêu cầu chỉnh sửa"],
          ["reject", "Từ chối"],
          ["approve", "Duyệt lại"],
        ].map(([value, label]) => (
          <Button
            className="w-full whitespace-normal"
            disabled={isPending}
            key={value}
            name="decision"
            type="submit"
            value={value}
            variant={
              value === "reject"
                ? "destructive"
                : value === "approve"
                  ? "default"
                  : "outline"
            }
          >
            {isPending ? "Đang xử lý..." : label}
          </Button>
        ))}
      </div>
    </form>
  );
}
