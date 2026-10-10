import Link from "next/link";
import { ProblemForm } from "@/components/business/problem-form";
import { createProblemAction } from "../actions";
import { requireBusinessProfile } from "@/lib/business-access";

export const instant = false;

export default async function NewBusinessProblemPage() {
  await requireBusinessProfile();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link className="text-sm font-semibold text-primary hover:underline" href="/business/problems">
        ← Bài toán của tôi
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Đăng bài toán</h1>
      <p className="mb-8 mt-2 text-sm leading-6 text-muted-foreground">
        Điền thông tin để lưu bản nháp hoặc gửi nền tảng kiểm duyệt.
      </p>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <ProblemForm action={createProblemAction} />
      </section>
    </main>
  );
}
