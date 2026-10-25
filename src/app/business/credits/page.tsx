import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { BUSINESS_POST_CONFIG, POST_CREDIT_SOURCES } from "@/lib/business-post-config";
import { CreditPurchaseForm } from "@/components/business/credit-purchase-form";
import { ensureBusinessCreditNotifications } from "@/lib/business-credit-notifications";

export const instant = false;

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export default async function BusinessCreditsPage() {
  const { businessProfileId } = await requireBusinessProfile();
  const owner = await prisma.businessProfile.findUniqueOrThrow({
    where: { id: businessProfileId },
    select: { userId: true },
  });
  try {
    await prisma.$transaction((transaction) =>
      ensureBusinessCreditNotifications(transaction, {
        businessProfileId,
        userId: owner.userId,
      }),
    );
  } catch (error) {
    console.error("Không thể tạo thông báo hạn mức doanh nghiệp:", error);
  }
  const now = new Date();
  const [credits, subscription, charges] = await Promise.all([
    prisma.postCredit.findMany({ where: { businessProfileId, remaining: { gt: 0 } }, orderBy: { source: "asc" } }),
    prisma.subscription.findUnique({ where: { businessProfileId_package: { businessProfileId, package: "PREMIUM" } } }),
    prisma.platformCharge.findMany({ where: { businessProfileId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const totals = {
    free: credits.filter((credit) => credit.source === POST_CREDIT_SOURCES.FREE).reduce((sum, credit) => sum + credit.remaining, 0),
    premium: credits.filter((credit) => credit.source === POST_CREDIT_SOURCES.PREMIUM && credit.expiresAt && credit.expiresAt > now).reduce((sum, credit) => sum + credit.remaining, 0),
    purchased: credits.filter((credit) => credit.source === POST_CREDIT_SOURCES.PURCHASED).reduce((sum, credit) => sum + credit.remaining, 0),
  };
  const premiumActive = subscription?.endsAt && subscription.endsAt > now;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Gói và hạn mức</h1>
      <p className="mt-2 text-sm text-muted-foreground">Thanh toán giả lập, không phát sinh giao dịch thật.</p>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["FREE", totals.free],
          ["PREMIUM còn hạn", totals.premium],
          ["MUA LẺ", totals.purchased],
        ].map(([label, value]) => <div className="rounded-2xl border border-border bg-card p-5" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
      </section>
      <p className="mt-4 text-sm">{premiumActive ? `Premium đến ${subscription?.endsAt.toLocaleDateString("vi-VN")}` : "Bạn chưa có Premium đang hoạt động."}</p>
      <div className="mt-6"><CreditPurchaseForm maxQuantity={BUSINESS_POST_CONFIG.maxPurchasedCreditsPerOrder} postPrice={BUSINESS_POST_CONFIG.purchasedPostCreditPriceVnd} premiumPrice={BUSINESS_POST_CONFIG.premiumPriceVnd} /></div>
      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Lịch sử mua</h2>
        <div className="mt-4 divide-y divide-border">{charges.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p> : charges.map((charge) => <div className="flex justify-between py-3 text-sm" key={charge.id}><span>{charge.type === "PREMIUM" ? "Premium" : `Mua ${charge.units} lượt`}</span><span>{money(charge.amount)}</span></div>)}</div>
      </section>
    </main>
  );
}
