"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveAgreementAction,
  type ProjectActionState,
} from "@/app/projects/actions";

export type AgreementFormMilestone = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  dueAt: string;
  paymentPercent: number;
};

export type AgreementFormValues = {
  title: string;
  agreedScope: string;
  deliverables: string;
  duration: string;
  totalAmount: number | "";
  generalAcceptanceCriteria: string;
  businessResponsibilities: string;
  teamResponsibilities: string;
  paymentMethod: string;
  milestones: AgreementFormMilestone[];
};

const emptyMilestone = (): AgreementFormMilestone => ({
  title: "",
  description: "",
  acceptanceCriteria: "",
  dueAt: "",
  paymentPercent: 0,
});

const emptyState: ProjectActionState = { error: null, success: null };

function TextField({
  label,
  name,
  value,
  onChange,
  required = true,
  multiline = false,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  multiline?: boolean;
  type?: string;
}) {
  const className =
    "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
  return (
    <label className="block text-sm font-medium">
      {label}
      {multiline ? (
        <textarea
          className={`${className} min-h-24`}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          value={value}
        />
      ) : (
        <input
          className={className}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type={type}
          value={value}
        />
      )}
    </label>
  );
}

export function AgreementForm({
  applicationId,
  problemId,
  projectId,
  initialValues,
}: {
  applicationId: string;
  problemId: string;
  projectId?: string;
  initialValues: AgreementFormValues;
}) {
  const [state, formAction, pending] = useActionState(saveAgreementAction, emptyState);
  const [values, setValues] = useState(initialValues);
  const router = useRouter();
  const percentageTotal = values.milestones.reduce(
    (sum, milestone) => sum + Number(milestone.paymentPercent || 0),
    0,
  );

  useEffect(() => {
    if (state.projectId) router.push(`/business/projects/${state.projectId}`);
  }, [router, state.projectId]);

  function updateField<K extends keyof AgreementFormValues>(
    field: K,
    value: AgreementFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateMilestone(
    index: number,
    field: keyof AgreementFormMilestone,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      milestones: current.milestones.map((milestone, itemIndex) =>
        itemIndex === index
          ? {
              ...milestone,
              [field]: field === "paymentPercent" ? Number(value) : value,
            }
          : milestone,
      ),
    }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input name="applicationId" type="hidden" value={applicationId} />
      <input name="problemId" type="hidden" value={problemId} />
      <input name="projectId" type="hidden" value={projectId ?? ""} />
      <input name="milestones" type="hidden" value={JSON.stringify(values.milestones)} />

      <section className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tên dự án"
          name="title"
          onChange={(value) => updateField("title", value)}
          value={values.title}
        />
        <TextField
          label="Giá trị dự án (VND)"
          name="totalAmount"
          onChange={(value) =>
            updateField("totalAmount", value === "" ? "" : Number(value))
          }
          type="number"
          value={String(values.totalAmount)}
        />
        <TextField
          label="Phạm vi công việc"
          name="agreedScope"
          multiline
          onChange={(value) => updateField("agreedScope", value)}
          value={values.agreedScope}
        />
        <TextField
          label="Sản phẩm đầu ra"
          name="deliverables"
          multiline
          onChange={(value) => updateField("deliverables", value)}
          value={values.deliverables}
        />
        <TextField
          label="Thời gian thực hiện"
          name="duration"
          onChange={(value) => updateField("duration", value)}
          value={values.duration}
        />
        <TextField
          label="Tiêu chí nghiệm thu chung"
          name="generalAcceptanceCriteria"
          multiline
          onChange={(value) => updateField("generalAcceptanceCriteria", value)}
          value={values.generalAcceptanceCriteria}
        />
        <TextField
          label="Trách nhiệm của doanh nghiệp"
          name="businessResponsibilities"
          multiline
          onChange={(value) => updateField("businessResponsibilities", value)}
          value={values.businessResponsibilities}
        />
        <TextField
          label="Trách nhiệm của nhóm"
          name="teamResponsibilities"
          multiline
          onChange={(value) => updateField("teamResponsibilities", value)}
          value={values.teamResponsibilities}
        />
        <TextField
          label="Phương thức thanh toán"
          name="paymentMethod"
          multiline
          onChange={(value) => updateField("paymentMethod", value)}
          value={values.paymentMethod}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Milestone</h3>
            <p className="text-sm text-muted-foreground">
              Tổng tỷ lệ hiện tại:{" "}
              <strong className={percentageTotal === 100 ? "text-emerald-700" : "text-amber-700"}>
                {percentageTotal}%
              </strong>{" "}
              (cần đúng 100%)
            </p>
          </div>
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
            onClick={() =>
              setValues((current) => ({
                ...current,
                milestones: [...current.milestones, emptyMilestone()],
              }))
            }
            type="button"
          >
            Thêm Milestone
          </button>
        </div>
        {values.milestones.map((milestone, index) => (
          <fieldset className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" key={index}>
            <legend className="px-1 text-sm font-semibold">Milestone {index + 1}</legend>
            <label className="text-sm font-medium">
              Tên
              <input
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
                onChange={(event) => updateMilestone(index, "title", event.target.value)}
                required
                value={milestone.title}
              />
            </label>
            <label className="text-sm font-medium">
              Hạn hoàn thành
              <input
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
                onChange={(event) => updateMilestone(index, "dueAt", event.target.value)}
                required
                type="date"
                value={milestone.dueAt}
              />
            </label>
            <label className="text-sm font-medium">
              Mô tả công việc
              <textarea
                className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2.5"
                onChange={(event) => updateMilestone(index, "description", event.target.value)}
                required
                value={milestone.description}
              />
            </label>
            <label className="text-sm font-medium">
              Tiêu chí nghiệm thu
              <textarea
                className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2.5"
                onChange={(event) =>
                  updateMilestone(index, "acceptanceCriteria", event.target.value)
                }
                required
                value={milestone.acceptanceCriteria}
              />
            </label>
            <label className="text-sm font-medium">
              Tỷ lệ thanh toán (%)
              <input
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
                min={1}
                max={100}
                onChange={(event) => updateMilestone(index, "paymentPercent", event.target.value)}
                required
                type="number"
                value={milestone.paymentPercent}
              />
            </label>
            {values.milestones.length > 1 && (
              <button
                className="self-end justify-self-start text-sm font-semibold text-rose-700 hover:underline"
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    milestones: current.milestones.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
                type="button"
              >
                Xóa Milestone
              </button>
            )}
          </fieldset>
        ))}
      </section>

      {state.error && <p className="text-sm font-medium text-rose-700">{state.error}</p>}
      {state.success && <p className="text-sm font-medium text-emerald-700">{state.success}</p>}
      <button
        className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto"
        disabled={pending || percentageTotal !== 100}
        type="submit"
      >
        {pending ? "Đang lưu..." : projectId ? "Gửi lại thỏa thuận" : "Gửi thỏa thuận"}
      </button>
    </form>
  );
}
