import Link from "next/link";
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
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tổng quan</h1>
      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
        <h2 className="text-lg font-semibold">Không gian làm việc của doanh nghiệp</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard đang sẵn sàng. Các bài toán và hoạt động của bạn sẽ hiển thị tại đây.
        </p>
        {remaining === 0 && (
          <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            Bạn đã hết lượt đăng. Hãy mua thêm lượt hoặc Premium trước khi gửi bài toán.
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            href="/business/problems/new"
          >
            Đăng bài toán
          </Link>
          <Link
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted"
            href="/business/problems"
          >
            Bài toán của tôi
          </Link>
        </div>
      </section>
    </main>
  );
}
