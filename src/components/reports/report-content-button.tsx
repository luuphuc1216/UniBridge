"use client";

import { useState, type FormEvent } from "react";

export function ReportContentButton({
  targetType,
  targetId,
}: {
  targetType: "PROBLEM" | "TEAM" | "MESSAGE" | "REVIEW";
  targetId: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: form.get("reason"),
        }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      setMessage(
        response.ok
          ? result.message ?? "Báo cáo đã được gửi."
          : result.error ?? "Không thể gửi báo cáo.",
      );
      if (response.ok) event.currentTarget.reset();
    } catch {
      setMessage("Không thể gửi báo cáo lúc này. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        Báo cáo nội dung
      </summary>
      <form className="mt-2 grid max-w-xl gap-2" onSubmit={submit}>
        <label className="font-medium" htmlFor={`report-${targetType}-${targetId}`}>
          Lý do báo cáo
        </label>
        <textarea
          className="min-h-20 rounded-lg border border-border bg-background px-3 py-2"
          id={`report-${targetType}-${targetId}`}
          maxLength={2000}
          minLength={5}
          name="reason"
          required
        />
        <button
          className="w-fit rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Đang gửi..." : "Gửi báo cáo"}
        </button>
        {message && <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>}
      </form>
    </details>
  );
}
