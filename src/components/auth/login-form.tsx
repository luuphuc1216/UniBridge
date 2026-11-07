"use client";

import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Input
          autoComplete="email"
          className="h-12 text-base font-normal sm:text-sm"
          name="email"
          placeholder="ban@example.com"
          required
          type="email"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Mật khẩu
        <Input
          autoComplete="current-password"
          className="h-12 text-base font-normal sm:text-sm"
          name="password"
          placeholder="Nhập mật khẩu"
          required
          type="password"
        />
      </label>
      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        className="h-12 w-full rounded-xl text-base font-semibold"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
