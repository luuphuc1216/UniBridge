import Link from "next/link";
import { ProblemForm } from "@/components/business/problem-form";
import { createProblemAction } from "../actions";
import { requireBusinessProfile } from "@/lib/business-access";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const instant = false;

export default async function NewBusinessProblemPage() {
  await requireBusinessProfile();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <Link
          className={`${buttonVariants({ variant: "ghost", size: "sm" })}
            -ml-3 w-fit motion-reduce:transition-none`}
          href="/business/problems"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Bài toán của tôi
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Đăng bài toán mới
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Cung cấp thông tin rõ ràng để lưu bản nháp hoặc gửi bài toán đến nền
          tảng kiểm duyệt.
        </p>
      </header>
      <ProblemForm action={createProblemAction} />
    </main>
  );
}
