"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function RequestPasswordResetForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      if (!response.ok) throw new Error("Request failed");
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.");
    } catch {
      setMessage("Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block space-y-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 font-normal"
          maxLength={254}
          name="email"
          required
          type="email"
        />
      </label>
      {message && <p aria-live="polite" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang gửi..." : "Gửi hướng dẫn"}
      </button>
      <p className="text-center text-sm">
        <Link className="font-semibold text-primary hover:underline" href="/dang-nhap">
          Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function CompletePasswordResetForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setMessage("Mật khẩu xác nhận không khớp.");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.get("password") }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Không thể đặt lại mật khẩu.");
      setCompleted(true);
      setMessage(result.message ?? "Mật khẩu đã được cập nhật.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return <p className="mt-6 text-sm text-destructive">Liên kết đặt lại mật khẩu không hợp lệ.</p>;
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block space-y-2 text-sm font-medium">
        Mật khẩu mới
        <input
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 font-normal"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Xác nhận mật khẩu
        <input
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 font-normal"
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {message && <p aria-live="polite" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
      {completed ? (
        <Link className="block text-center font-semibold text-primary" href="/dang-nhap">
          Đăng nhập bằng mật khẩu mới
        </Link>
      ) : (
        <button
          className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
        </button>
      )}
    </form>
  );
}
