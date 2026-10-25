"use client";

import { useActionState } from "react";
import {
  saveApplicationAction,
  type ApplicationActionState,
} from "@/app/student/applications/actions";

export type ApplicationFormData = {
  problemUnderstanding: string;
  solutionDirection: string;
  methodology: string;
  keySteps: string;
  tools: string;
  resources: string;
  estimatedDuration: string;
  proposedBudget: number | null;
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
    <form action={formAction} className="mt-5 space-y-4">
      <input name="problemId" type="hidden" value={problemId} />
      {state.error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {fields.map(([name, label]) => (
        <label className="grid gap-2 text-sm font-medium" key={name}>
          {label}
          <textarea
            className="min-h-24 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
            defaultValue={application?.[name] ?? ""}
            maxLength={4000}
            name={name}
            required
          />
        </label>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Thời gian dự kiến
          <input
            className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
            defaultValue={application?.estimatedDuration ?? ""}
            maxLength={120}
            name="estimatedDuration"
            placeholder="Ví dụ: 6–8 tuần"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Chi phí đề xuất (đồng, không bắt buộc)
          <input
            className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
            defaultValue={application?.proposedBudget ?? ""}
            min="0"
            name="proposedBudget"
            step="1000"
            type="number"
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Liên kết tham khảo (tối đa 3, mỗi liên kết một dòng)
        <textarea
          className="min-h-20 rounded-xl border border-border bg-background px-3 py-2.5 font-normal"
          name="approachLinks"
          placeholder="https://..."
        />
      </label>
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? "Đang gửi..."
          : isResubmission
            ? "Gửi lại Profile + Approach"
            : application
            ? "Lưu thay đổi hồ sơ"
            : "Gửi Profile + Approach"}
      </button>
    </form>
  );
}
