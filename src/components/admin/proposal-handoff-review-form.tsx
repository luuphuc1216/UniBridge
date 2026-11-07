"use client";

import { useActionState } from "react";
import {
  reviewProposalHandoffAction,
  type ProposalHandoffActionState,
} from "@/app/admin/prototype-handoffs/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const checklist = [
  ["filesOrLinksComplete", "Tệp hoặc đường dẫn bàn giao đầy đủ"],
  ["withinTrialBriefScope", "Nằm trong phạm vi hồ sơ thử nghiệm đã thống nhất"],
  ["compliesWithRules", "Tuân thủ quy định của nền tảng"],
] as const;

export function ProposalHandoffReviewForm({
  attemptId,
  automaticCheckPassed,
  problemId,
}: {
  attemptId: string;
  automaticCheckPassed: boolean;
  problemId: string;
}) {
  const [state, action, pending] = useActionState<
    ProposalHandoffActionState,
    FormData
  >(reviewProposalHandoffAction, { error: null });

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span aria-hidden="true" className="text-sm font-bold">
            1
          </span>
        </span>
        <div>
          <Badge className="mb-2" variant="outline">
            Đánh giá của Admin
          </Badge>
          <h2 className="text-lg font-semibold">Checklist kiểm tra</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Đánh giá tính đầy đủ, phạm vi bàn giao và việc tuân thủ; không thay cho
            đánh giá chất lượng chuyên môn của sản phẩm.
          </p>
        </div>
      </div>

      <form action={action} className="mt-5 space-y-5">
        <input name="attemptId" type="hidden" value={attemptId} />
        <input name="problemId" type="hidden" value={problemId} />

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Ba tiêu chí bắt buộc</legend>
          <p className="text-sm leading-6 text-muted-foreground">
            Chọn Đạt hoặc Chưa đạt cho từng mục. Duyệt yêu cầu cả ba mục đạt; trả nhóm
            bổ sung yêu cầu ít nhất một mục chưa đạt và nêu nội dung cần bổ sung.
          </p>
          <div className="grid gap-3">
            {checklist.map(([name, label], index) => (
              <fieldset
                className="min-w-0 rounded-xl border border-border bg-background p-3 sm:p-4"
                key={name}
              >
                <legend className="max-w-full px-1 text-sm font-medium leading-6">
                  <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  {label}
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[
                    ["true", "Đạt"],
                    ["false", "Chưa đạt"],
                  ].map(([value, choice]) => (
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                      htmlFor={`${name}-${value}`}
                      key={value}
                    >
                      <input
                        className="size-4 shrink-0 accent-primary"
                        id={`${name}-${value}`}
                        name={name}
                        required
                        type="radio"
                        value={value}
                      />
                      {choice}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            className="text-sm font-semibold"
            htmlFor="handoff-review-note"
          >
            Ghi chú kiểm tra <span className="text-destructive">*</span>
          </label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            id="handoff-review-note"
            maxLength={4000}
            name="note"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Bắt buộc, tối đa 4.000 ký tự.
          </p>
        </div>

        <div>
          <label
            className="text-sm font-semibold"
            htmlFor="handoff-missing-items"
          >
            Mục cần bổ sung
          </label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Mỗi dòng một mục; bắt buộc nếu có tiêu chí Chưa đạt.
          </p>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            id="handoff-missing-items"
            name="missingItems"
          />
        </div>

        {automaticCheckPassed ? (
          <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm leading-6">
            Kiểm tra tự động hiện không phát hiện thiếu sót. Kết quả duyệt vẫn cần đủ
 ba tiêu chí và được workflow xác nhận khi gửi.
          </p>
        ) : (
          <aside className="rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="font-semibold">Kiểm tra tự động có mục chưa đạt</p>
            <p className="mt-1 text-sm leading-6">
              Bạn vẫn có thể gửi lựa chọn “Đạt kiểm tra bàn giao” nếu cả ba tiêu chí
              Admin đều đạt; tuy nhiên, kiểm tra tự động có thể khiến hồ sơ được trả
              nhóm bổ sung. Gửi lựa chọn này không đảm bảo duyệt thành công. Ghi rõ các
              thiếu sót đã phát hiện.
            </p>
          </aside>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="w-full whitespace-normal"
            disabled={pending}
            name="decision"
            type="submit"
            value="APPROVED"
          >
            {pending ? "Đang lưu..." : "Gửi lựa chọn đạt kiểm tra"}
          </Button>
          <Button
            className="w-full whitespace-normal"
            disabled={pending}
            name="decision"
            type="submit"
            value="RETURNED"
            variant="outline"
          >
            {pending ? "Đang lưu..." : "Trả nhóm bổ sung"}
          </Button>
        </div>

        {pending && (
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
            Đang lưu kết quả kiểm tra...
          </p>
        )}
        {state.error && (
          <p
            aria-live="assertive"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        )}
      </form>
    </Card>
  );
}
