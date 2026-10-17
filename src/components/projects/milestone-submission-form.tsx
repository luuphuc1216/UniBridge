"use client";

import { useState, type FormEvent } from "react";
import { FilePicker } from "@/components/uploads/file-picker";
import {
  MAX_PROPOSAL_FILE_COUNT,
  MAX_PROPOSAL_FILE_SIZE_BYTES,
  MAX_PROPOSAL_FILE_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import {
  parseMilestoneSubmissionLinks,
  validateMilestoneSubmission,
} from "@/lib/milestone-submission-validation";

export function MilestoneSubmissionForm({
  milestoneId,
}: {
  milestoneId: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData(form);
      const note = String(formData.get("note") ?? "");
      const files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const links = parseMilestoneSubmissionLinks(String(formData.get("links") ?? ""));
      const validationError = validateMilestoneSubmission(note, files.length, links);
      if (validationError) throw new Error(validationError);

      const response = await fetch(
        `/api/projects/milestones/${milestoneId}/submissions`,
        { method: "POST", body: formData },
      );
      const result = (await response.json()) as { error?: string; success?: string };
      if (!response.ok) throw new Error(result.error ?? "Không thể nộp kết quả.");
      form.reset();
      setMessage(result.success ?? "Đã nộp kết quả.");
      window.location.reload();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Đã xảy ra lỗi. Vui lòng thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4" onSubmit={submit}>
      <h4 className="font-semibold">Nộp kết quả Milestone</h4>
      <label className="block text-sm font-medium">
        Mô tả kết quả
        <textarea
          className="mt-1.5 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5"
          maxLength={10_000}
          minLength={10}
          name="note"
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Liên kết sản phẩm
        <textarea
          className="mt-1.5 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5"
          name="links"
          placeholder={"Nhập tối đa 3 liên kết http:// hoặc https://, mỗi liên kết một dòng"}
          rows={2}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Có thể đính kèm tệp, nhập liên kết hoặc gửi cả hai.
        </span>
      </label>
      <FilePicker
        label="Tệp kết quả"
        limits={{
          count: MAX_PROPOSAL_FILE_COUNT,
          fileSizeBytes: MAX_PROPOSAL_FILE_SIZE_BYTES,
          totalBytes: MAX_PROPOSAL_FILE_TOTAL_BYTES,
        }}
        name="files"
      />
      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
      {message && <p className="text-sm font-medium text-emerald-700">{message}</p>}
      <button
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang nộp..." : "Nộp Milestone"}
      </button>
    </form>
  );
}
