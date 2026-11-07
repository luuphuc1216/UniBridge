"use client";

import { useActionState, type ReactNode } from "react";
import type { ProjectActionState } from "@/app/projects/actions";

export function ProjectActionForm({
  action,
  hiddenFields,
  buttonLabel,
  children,
  buttonClassName = "rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60",
}: {
  action: (
    state: ProjectActionState,
    formData: FormData,
  ) => Promise<ProjectActionState>;
  hiddenFields: Record<string, string>;
  buttonLabel: string;
  children?: ReactNode;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    success: null,
  });
  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {children}
      <button className={buttonClassName} disabled={pending} type="submit">
        {pending ? "Đang xử lý..." : buttonLabel}
      </button>
      {state.error && (
        <p aria-live="assertive" className="text-sm font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p aria-live="polite" className="text-sm font-medium text-emerald-700" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
