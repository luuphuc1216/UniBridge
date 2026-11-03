"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getRoleHome, isRole } from "@/lib/roles";

type LoginFormProps = {
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });

      if (!result || result.error) {
        setError(
          result?.code === "account-locked"
            ? "Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên."
            : "Email hoặc mật khẩu không chính xác.",
        );
        return;
      }

      const session = await getSession();
      const role = isRole(session?.user.role) ? session.user.role : undefined;
      const safeCallback =
        role &&
        callbackUrl?.startsWith(`${getRoleHome(role)}/`) &&
        callbackUrl.startsWith("/") &&
        !callbackUrl.startsWith("//")
          ? callbackUrl
          : role
            ? getRoleHome(role)
            : "/";

      router.replace(safeCallback);
      router.refresh();
    } catch {
      setError("Không thể đăng nhập lúc này. Vui lòng thử lại.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block space-y-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          name="email"
          placeholder="ban@example.com"
          required
          type="email"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Mật khẩu
        <input
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          name="password"
          placeholder="Nhập mật khẩu"
          required
          type="password"
        />
      </label>
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
