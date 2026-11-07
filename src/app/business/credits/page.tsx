import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { BUSINESS_POST_CONFIG, POST_CREDIT_SOURCES } from "@/lib/business-post-config";
import { CreditPurchaseForm } from "@/components/business/credit-purchase-form";
import { ensureBusinessCreditNotifications } from "@/lib/business-credit-notifications";
import { formatVietnamDateTime, remainingWholeDays } from "@/lib/date-format";
import { getAiUsageRemaining } from "@/lib/ai/usage";
import { isActivePremium } from "@/lib/ai/policy";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, CalendarClock, CircleDollarSign, FileText, Sparkles } from "lucide-react";

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
  const [credits, subscription, charges, aiRemaining] = await Promise.all([
    prisma.postCredit.findMany({ where: { businessProfileId, remaining: { gt: 0 } }, orderBy: { source: "asc" } }),
    prisma.subscription.findUnique({ where: { businessProfileId_package: { businessProfileId, package: "PREMIUM" } } }),
    prisma.platformCharge.findMany({ where: { businessProfileId }, orderBy: { createdAt: "desc" }, take: 20 }),
    getAiUsageRemaining(prisma, businessProfileId),
  ]);
  const totals = {
    free: credits.filter((credit) => credit.source === POST_CREDIT_SOURCES.FREE).reduce((sum, credit) => sum + credit.remaining, 0),
    premium: credits.filter((credit) => credit.source === POST_CREDIT_SOURCES.PREMIUM && credit.expiresAt && credit.expiresAt > now).reduce((sum, credit) => sum + credit.remaining, 0),
    purchased: credits.filter((credit) => credit.source === POST_CREDIT_SOURCES.PURCHASED).reduce((sum, credit) => sum + credit.remaining, 0),
  };
  const premiumActive = isActivePremium(
    subscription
      ? {
          package: subscription.package,
          status: subscription.status,
          endsAt: subscription.endsAt,
        }
      : null,
    now,
  );
  const premiumRemainingDays = premiumActive && subscription
    ? remainingWholeDays(subscription.endsAt, now)
    : null;
  const premiumStatus = !subscription
    ? "none"
    : !premiumActive
      ? subscription.endsAt <= now
        ? "expired"
        : "inactive"
      : premiumRemainingDays !== null && premiumRemainingDays <= 7
        ? "expiring"
        : "active";

  const creditSummaries = [
    {
      label: "Lượt miễn phí",
      value: totals.free,
      description: "Lượt đăng bài còn lại",
      Icon: FileText,
    },
    {
      label: "Lượt Premium",
      value: totals.premium,
      description: "Lượt còn hiệu lực",
      Icon: Sparkles,
    },
    {
      label: "Lượt mua lẻ",
      value: totals.purchased,
      description: "Lượt đăng bài còn lại",
      Icon: CircleDollarSign,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
      <header className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <p className="text-sm font-semibold text-primary">Khu vực doanh nghiệp</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Gói và hạn mức
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Theo dõi lượt đăng bài, quyền lợi Premium và hạn mức AI của doanh nghiệp.
            </p>
          </div>
          <Badge className="w-fit shrink-0" variant="outline">
            <CircleDollarSign aria-hidden="true" className="mr-1.5 size-3.5" />
            Thanh toán giả lập
          </Badge>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Không phát sinh giao dịch hoặc thanh toán thật.
        </p>
      </header>

      <section aria-label="Tổng quan lượt đăng bài" className="grid gap-3 sm:grid-cols-3">
        {creditSummaries.map(({ label, value, description, Icon }) => (
          <Card className="min-w-0" key={label}>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card aria-labelledby="ai-usage-title" className="min-w-0">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Activity aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base" id="ai-usage-title">
                Hạn mức AI còn lại
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-6">
                Hạn mức AI được theo dõi riêng theo ngày và tháng, không phải lượt đăng bài
                mua lẻ. Quyền truy cập từng tính năng áp dụng theo điều kiện hiện có.
              </CardDescription>
            </div>
          </div>
          <Badge className="w-fit shrink-0" variant="secondary">
            Dùng riêng với lượt đăng bài
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">Còn lại hôm nay</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {aiRemaining.daily}
              <span className="ml-1 text-sm font-medium text-muted-foreground">lượt</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">Còn lại trong tháng</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {aiRemaining.monthly}
              <span className="ml-1 text-sm font-medium text-muted-foreground">lượt</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <CreditPurchaseForm
        activePremiumEndsAt={premiumActive && subscription ? subscription.endsAt.toISOString() : null}
        maxQuantity={BUSINESS_POST_CONFIG.maxPurchasedCreditsPerOrder}
        postPrice={BUSINESS_POST_CONFIG.purchasedPostCreditPriceVnd}
        premiumDurationMonths={BUSINESS_POST_CONFIG.premiumDurationMonths}
        premiumEndsAt={subscription?.endsAt.toISOString() ?? null}
        premiumPostCredits={BUSINESS_POST_CONFIG.premiumPostCredits}
        premiumPrice={BUSINESS_POST_CONFIG.premiumPriceVnd}
        premiumRemainingDays={premiumRemainingDays}
        premiumStatus={premiumStatus}
      />

      <Card aria-labelledby="purchase-history-title" className="min-w-0">
        <CardHeader>
          <CardTitle id="purchase-history-title">Lịch sử mua</CardTitle>
          <CardDescription>
            Các lượt đăng bài mua lẻ và giao dịch Premium đã được ghi nhận.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {charges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
              <CalendarClock
                aria-hidden="true"
                className="mx-auto size-6 text-muted-foreground"
              />
              <p className="mt-3 text-sm font-medium">Chưa có giao dịch</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lịch sử mua sẽ xuất hiện tại đây sau khi có giao dịch mô phỏng.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {charges.map((charge) => (
                <li
                  className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  key={charge.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {charge.type === "PREMIUM"
                          ? `Premium (+${charge.quantity ?? "—"} lượt đăng bài)`
                          : `Lượt đăng bài lẻ × ${charge.quantity ?? "—"}`}
                      </p>
                      <Badge variant="outline">Thanh toán giả lập</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mua lúc: {formatVietnamDateTime(charge.createdAt)}
                    </p>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {charge.type === "PREMIUM"
                        ? charge.periodStartsAt && charge.periodEndsAt
                          ? `Hiệu lực: ${formatVietnamDateTime(charge.periodStartsAt)} – ${formatVietnamDateTime(charge.periodEndsAt)}`
                          : "Hiệu lực: —"
                        : "Lượt mua lẻ không hết hạn"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums sm:text-right">
                    {money(charge.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
