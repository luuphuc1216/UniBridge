import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FileText, Plus, type LucideIcon } from "lucide-react";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { ensureBusinessCreditNotifications } from "@/lib/business-credit-notifications";

export default async function BusinessDashboard() {
  const { businessProfileId } = await requireBusinessProfile();
  const sessionProfile = await prisma.businessProfile.findUniqueOrThrow({
    where: { id: businessProfileId },
    select: { userId: true },
  });
  try {
    await prisma.$transaction((transaction) =>
      ensureBusinessCreditNotifications(transaction, {
        businessProfileId,
        userId: sessionProfile.userId,
      }),
    );
  } catch (error) {
    console.error("Không thể tạo thông báo hạn mức doanh nghiệp:", error);
  }
  const credits = await prisma.postCredit.aggregate({
    where: { businessProfileId, remaining: { gt: 0 } },
    _sum: { remaining: true },
  });
  const remaining = credits._sum.remaining ?? 0;
  const dashboardCards: { label: string; value: string | number; icon: LucideIcon }[] = [
    { label: "Hạn mức còn lại", value: remaining, icon: BriefcaseBusiness },
    { label: "Bài toán của tôi", value: "Quản lý", icon: FileText },
    { label: "Tạo cơ hội mới", value: "Bắt đầu", icon: Plus },
  ];
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] bg-brand-navy p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-brand-light">Khu vực doanh nghiệp</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tổng quan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
          Quản lý bài toán, theo dõi hồ sơ ứng tuyển và tiến trình hợp tác trong một không gian rõ ràng.
        </p>
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {dashboardCards.map(({ label, value, icon: Icon }) => (
          <article className="rounded-2xl border border-border bg-card p-5" key={label}>
            <Icon className="size-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-6 rounded-[2rem] border border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Bắt đầu với một bài toán thực tế</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Mô tả nhu cầu của doanh nghiệp để các nhóm sinh viên phù hợp có thể gửi hồ sơ ứng tuyển.
        </p>
        {remaining === 0 && (
          <p className="mt-5 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            Bạn đã hết lượt đăng. Hãy mua thêm lượt hoặc Premium trước khi gửi bài toán.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            href="/business/problems/new"
          >
            Đăng bài toán <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted"
            href="/business/problems"
          >
            Quản lý bài toán
          </Link>
        </div>
      </section>
    </main>
  );
}
