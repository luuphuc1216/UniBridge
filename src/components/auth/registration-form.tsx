"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getRoleHome, type SelfRegistrationRole } from "@/lib/roles";

export function RegistrationForm() {
  const router = useRouter();
  const [role, setRole] = useState<SelfRegistrationRole>("STUDENT");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.role = role;

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Không thể tạo tài khoản. Vui lòng thử lại.");
        return;
      }

      const signInResult = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });
      if (signInResult?.error) {
        router.replace("/dang-nhap");
        return;
      }

      router.replace(getRoleHome(role));
      router.refresh();
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Bạn tham gia với vai trò</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["STUDENT", "BUSINESS"] as const).map((option) => (
            <label
              className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 py-3 text-sm font-medium transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                role === option
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/40"
              }`}
              key={option}
            >
              <input
                checked={role === option}
                className="sr-only"
                name="role-choice"
                onChange={() => setRole(option)}
                type="radio"
                value={option}
              />
              {option === "STUDENT" ? "Sinh viên" : "Doanh nghiệp"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Họ và tên
          <Input
            autoComplete="name"
            className="h-12 text-base font-normal sm:text-sm"
            maxLength={100}
            minLength={2}
            name="name"
            placeholder="Nguyễn Văn An"
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
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
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Mật khẩu
          <Input
            autoComplete="new-password"
            className="h-12 text-base font-normal sm:text-sm"
            minLength={8}
            name="password"
            placeholder="Ít nhất 8 ký tự"
            required
            type="password"
          />
        </label>
        {role === "STUDENT" ? (
          <>
            <label className="space-y-2 text-sm font-medium">
              Chuyên ngành
              <Input
                className="h-12 text-base font-normal sm:text-sm"
                minLength={2}
                name="major"
                placeholder="Công nghệ thông tin"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Trường đại học
              <Input
                className="h-12 text-base font-normal sm:text-sm"
                minLength={2}
                name="university"
                placeholder="Tên trường"
                required
              />
            </label>
          </>
        ) : (
          <>
            <label className="space-y-2 text-sm font-medium">
              Tên doanh nghiệp
              <Input
                className="h-12 text-base font-normal sm:text-sm"
                minLength={2}
                name="companyName"
                placeholder="Tên doanh nghiệp"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Lĩnh vực hoạt động
              <Input
                className="h-12 text-base font-normal sm:text-sm"
                minLength={2}
                name="industry"
                placeholder="Công nghệ, giáo dục..."
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Giới thiệu doanh nghiệp
              <Textarea
                className="min-h-28 text-base font-normal sm:text-sm"
                minLength={10}
                name="description"
                placeholder="Giới thiệu ngắn về doanh nghiệp"
                required
              />
            </label>
          </>
        )}
      </div>

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
        {isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="/dang-nhap">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
