"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateSelectedAttachments } from "@/lib/business-attachments/client-validation";
import type { ProblemActionState } from "@/app/business/problems/actions";
import { FilePicker } from "@/components/uploads/file-picker";

type ProblemFormValues = {
  id: string;
  title: string;
  description: string;
  goal: string;
  field: string;
  requirements: string;
  expectedDuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  status: string;
  reviewNote: string | null;
};

type ExistingAttachment = {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

type ProblemFormProps = {
  action: (
    state: ProblemActionState,
    formData: FormData,
  ) => Promise<ProblemActionState>;
  problem?: ProblemFormValues;
  attachments?: ExistingAttachment[];
};

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

function formatSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 2 : 1)} MB`;
}

export function ProblemForm({
  action,
  problem,
  attachments = [],
}: ProblemFormProps) {
  const [state, setState] = useState<ProblemActionState>({ error: null });
  const [isPending, startPendingTransition] = useTransition();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const visibleAttachments = attachments.filter(
    (attachment) => !deletedIds.includes(attachment.id),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setClientError(null);
    setState({ error: null });

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("attachments");
    const selectedFiles =
      fileInput instanceof HTMLInputElement && fileInput.files
        ? Array.from(fileInput.files)
        : [];

    const validationError = validateSelectedAttachments(
      selectedFiles,
      visibleAttachments.length,
      visibleAttachments.reduce((total, attachment) => total + attachment.sizeBytes, 0),
    );
    if (validationError) {
      setClientError(validationError);
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData =
      submitter instanceof HTMLButtonElement && submitter.name
        ? new FormData(form, submitter)
        : new FormData(form);
    startPendingTransition(() => {
      void action(state, formData)
        .then(setState)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "";
          setClientError(
            /unexpected end of form/i.test(message)
              ? "Tệp quá lớn hoặc quá nhiều tệp, vui lòng kiểm tra lại"
              : "Không thể lưu bài toán lúc này. Vui lòng kiểm tra tài liệu và thử lại.",
          );
        });
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {problem && <input name="problemId" type="hidden" value={problem.id} />}
      {deletedIds.map((id) => (
        <input key={id} name="deletedAttachmentIds" type="hidden" value={id} />
      ))}

      {problem?.reviewNote && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Yêu cầu chỉnh sửa</p>
          <p className="mt-1">{problem.reviewNote}</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">
          Tên vấn đề
          <input
            className={inputClass}
            defaultValue={problem?.title}
            maxLength={200}
            minLength={2}
            name="title"
            placeholder="Ví dụ: Xây dựng website bán hàng trực tuyến"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">
          Mô tả vấn đề
          <textarea
            className={`${inputClass} min-h-32 resize-y`}
            defaultValue={problem?.description}
            minLength={2}
            name="description"
            placeholder="Mô tả thực trạng và vấn đề doanh nghiệp đang gặp phải"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">
          Mục tiêu mong muốn
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            defaultValue={problem?.goal}
            minLength={2}
            name="goal"
            placeholder="Kết quả doanh nghiệp mong muốn đạt được"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Lĩnh vực
          <input
            className={inputClass}
            defaultValue={problem?.field}
            maxLength={100}
            minLength={2}
            name="field"
            placeholder="Công nghệ thông tin, Marketing..."
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Thời gian dự kiến
          <input
            className={inputClass}
            defaultValue={problem?.expectedDuration}
            minLength={2}
            name="expectedDuration"
            placeholder="6-8 tuần"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-semibold sm:col-span-2">
          Yêu cầu đối với nhóm sinh viên
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            defaultValue={problem?.requirements}
            minLength={2}
            name="requirements"
            placeholder="Kiến thức, kỹ năng hoặc kinh nghiệm cần thiết"
            required
          />
        </label>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-semibold">Ngân sách tham khảo (VNĐ)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Tối thiểu
              <input
                className={inputClass}
                defaultValue={problem?.budgetMin ?? ""}
                min={0}
                name="budgetMin"
                placeholder="Ví dụ: 5000000"
                type="number"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Tối đa
              <input
                className={inputClass}
                defaultValue={problem?.budgetMax ?? ""}
                min={0}
                name="budgetMax"
                placeholder="Ví dụ: 15000000"
                type="number"
              />
            </label>
          </div>
        </fieldset>
      </div>

      <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Tài liệu liên quan</h2>
        </div>
        {visibleAttachments.length > 0 && (
          <ul className="space-y-2">
            {visibleAttachments.map((attachment) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                key={attachment.id}
              >
                <span className="min-w-0 break-all">
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/api/business/attachments/${attachment.id}`}
                    target="_blank"
                  >
                    {attachment.originalName}
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    {formatSize(attachment.sizeBytes)}
                  </span>
                </span>
                <button
                  className="rounded-lg px-2 py-1 text-sm font-medium text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setDeletedIds((current) => [...current, attachment.id])
                  }
                  type="button"
                >
                  Gỡ tệp
                </button>
              </li>
            ))}
          </ul>
        )}
        {deletedIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Tệp được gỡ khỏi bài toán khi bạn lưu thay đổi.
          </p>
        )}
        <FilePicker
          existingBytes={visibleAttachments.reduce(
            (total, attachment) => total + attachment.sizeBytes,
            0,
          )}
          existingCount={visibleAttachments.length}
          label="Tài liệu mới"
          limits={{
            count: MAX_ATTACHMENT_COUNT,
            fileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
            totalBytes: MAX_ATTACHMENT_TOTAL_BYTES,
          }}
          name="attachments"
          onFilesChange={() => {
            setClientError(null);
            setState({ error: null });
          }}
        />
      </section>

      {(clientError || state.error) && (
        <p
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {clientError || state.error}
          {!clientError && state.actionHref && (
            <>
              {" "}
              <Link className="font-semibold underline" href="/business/credits">
                Mua thêm lượt
              </Link>
              {" · "}
              <Link className="font-semibold underline" href={state.actionHref}>
                Mở bản nháp
              </Link>
            </>
          )}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          className="rounded-xl border border-border px-5 py-3 text-center text-sm font-semibold hover:bg-muted"
          href={problem ? `/business/problems/${problem.id}` : "/business/problems"}
        >
          Hủy
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
            disabled={isPending}
            name="intent"
            type="submit"
            value="draft"
          >
            {isPending ? "Đang lưu..." : "Lưu nháp"}
          </button>
          <button
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            disabled={isPending}
            name="intent"
            type="submit"
            value="submit"
          >
            {isPending ? "Đang gửi..." : "Gửi duyệt"}
          </button>
        </div>
      </div>
    </form>
  );
}
