"use client";

import { useActionState } from "react";
import {
  saveApplicationAction,
  type ApplicationActionState,
} from "@/app/student/applications/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ApplicationFormData = {
  problemUnderstanding: string;
  solutionDirection: string;
  methodology: string;
  keySteps: string;
  tools: string;
  resources: string;
  estimatedDuration: string;
  proposedBudget: number | null;
  approachLinks: string[];
  status: string | null;
  attachmentVersion: number;
  attachments: {
    id: string;
    originalName: string;
    sizeBytes: number;
    submissionVersion: number;
  }[];
};

const fields = [
  ["problemUnderstanding", "Cách nhóm hiểu vấn đề"],
  ["solutionDirection", "Hướng giải quyết dự kiến"],
  ["methodology", "Phương pháp thực hiện"],
  ["keySteps", "Các bước chính"],
  ["tools", "Công cụ hoặc công nghệ dự kiến"],
  ["resources", "Nguồn lực cần thiết"],
] as const;

export function ApplicationForm({
  problemId,
  application,
  isResubmission = false,
}: {
  problemId: string;
  application: ApplicationFormData | null;
  isResubmission?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    ApplicationActionState,
    FormData
  >(saveApplicationAction, { error: null });

  return (
    <form action={formAction} className="mt-5 space-y-5">
      <input name="problemId" type="hidden" value={problemId} />
      {state.error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success" role="status">
          {state.message}
        </p>
      )}
      <section className="rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="font-semibold">Profile + Approach</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chia sẻ cách nhóm hiểu bài toán và dự định triển khai.
          </p>
        </div>
        <div className="space-y-4">
          {fields.map(([name, label]) => (
            <label className="grid gap-2 text-sm font-medium" key={name}>
              <span>
                {label} <span className="text-xs font-normal text-muted-foreground">(bắt buộc)</span>
              </span>
              <Textarea
                className="text-base motion-reduce:transition-none sm:text-sm"
                defaultValue={application?.[name] ?? ""}
                maxLength={4000}
                name={name}
                required
              />
            </label>
          ))}
        </div>
      </section>
      <section className="grid gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:grid-cols-2 sm:p-5">
        <label className="grid gap-2 text-sm font-medium">
          Thời gian dự kiến <span className="text-xs font-normal text-muted-foreground">(bắt buộc)</span>
          <Input
            className="text-base motion-reduce:transition-none sm:text-sm"
            defaultValue={application?.estimatedDuration ?? ""}
            maxLength={120}
            name="estimatedDuration"
            placeholder="Ví dụ: 6–8 tuần"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Chi phí đề xuất (đồng, không bắt buộc)
          <Input
            className="text-base motion-reduce:transition-none sm:text-sm"
            defaultValue={application?.proposedBudget ?? ""}
            min="0"
            name="proposedBudget"
            step="1000"
            type="number"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">
          Liên kết tham khảo (tối đa 3, mỗi liên kết một dòng)
          <Textarea
            className="text-base motion-reduce:transition-none sm:text-sm"
            name="approachLinks"
            placeholder="https://..."
            defaultValue={application?.approachLinks.join("\n") ?? ""}
          />
        </label>
      </section>
      {application?.status !== "SUBMITTED" ? (
        <>
          {application?.attachments.some(
            ({ submissionVersion }) =>
              submissionVersion === application.attachmentVersion,
          ) && (
            <section className="rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
              <h3 className="text-sm font-semibold">
                {application?.status === "DRAFT"
                  ? "Tài liệu hiện có trong bản nháp"
                  : "Tài liệu của lần gửi trước"}
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {application.attachments
                  .filter(
                    ({ submissionVersion }) =>
                      submissionVersion === application.attachmentVersion,
                  )
                  .map((attachment) => (
                    <li key={attachment.id}>
                      {application.status === "DRAFT" && (
                        <label className="mr-2 inline-flex items-center gap-1">
                          <input
                            aria-label={`Xóa ${attachment.originalName} khỏi bản nháp`}
                            name="removeApproachAttachment"
                            type="checkbox"
                            value={attachment.id}
                          />
                          Xóa
                        </label>
                      )}
                      <a
                        className="break-all text-primary hover:underline"
                        href={`/api/approach/attachments/${attachment.id}`}
                      >
                        {attachment.originalName}
                      </a>{" "}
                      <span className="text-muted-foreground">
                        ({(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <label className="grid gap-2 rounded-2xl border border-border bg-background/50 p-4 text-sm font-medium sm:p-5">
            Tài liệu minh họa (không bắt buộc, tối đa 3 tệp)
            <input
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.csv"
              className="min-h-11 rounded-xl border border-border bg-background px-3 py-2.5 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary sm:text-sm"
              multiple
              name="approachAttachments"
              type="file"
            />
            <span className="text-xs font-normal text-muted-foreground">
              PDF, PNG, JPG, DOCX, XLSX, PPTX hoặc CSV; tối đa 20 MB mỗi tệp,
              tổng 60 MB. Chọn thêm tệp để bổ sung; dùng ô “Xóa” để bỏ tệp cũ
              trong bản nháp.
            </span>
          </label>
          {application?.status === "WITHDRAWN" && (
            <p className="text-xs text-muted-foreground">
              Tệp của lần gửi trước được lưu riêng; lần gửi lại chỉ dùng các tệp
              bạn chọn ở đây.
            </p>
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-border bg-background/50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold">Tài liệu minh họa đã gửi</h3>
          {application.attachments.filter(
            ({ submissionVersion }) =>
              submissionVersion === application.attachmentVersion,
          ).length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {application.attachments
                .filter(
                  ({ submissionVersion }) =>
                    submissionVersion === application.attachmentVersion,
                )
                .map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      className="break-all text-primary hover:underline"
                      href={`/api/approach/attachments/${attachment.id}`}
                    >
                      {attachment.originalName}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      ({(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Hồ sơ này không có tệp đính kèm.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Tệp được khóa theo phiên bản đã gửi và không thể sửa hoặc xóa.
          </p>
        </section>
      )}
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        {(application === null || application.status === "DRAFT") && (
          <Button
            className="motion-reduce:transition-none"
            disabled={isPending}
            formNoValidate
            name="intent"
            type="submit"
            variant="outline"
            value="draft"
          >
            {isPending ? "Đang lưu..." : "Lưu bản nháp"}
          </Button>
        )}
        <Button
          className="w-full motion-reduce:transition-none sm:w-auto"
          disabled={isPending}
          name="intent"
          type="submit"
          value="submit"
        >
          {isPending
            ? "Đang gửi..."
            : isResubmission
              ? "Gửi lại Profile + Approach"
              : application?.status === "SUBMITTED"
                ? "Lưu thay đổi hồ sơ"
                : "Gửi Profile + Approach"}
        </Button>
      </div>
    </form>
  );
}
