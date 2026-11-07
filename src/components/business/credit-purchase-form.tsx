"use client";

import { useState, useTransition } from "react";
import {
  purchasePostCreditsAction,
  purchasePremiumAction,
  type CreditPurchaseState,
} from "@/app/business/credits/actions";
import { formatVietnamDateTime } from "@/lib/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarClock, Check, Crown, FileText, LoaderCircle, Sparkles } from "lucide-react";

const initialState: CreditPurchaseState = { error: null, success: null };
type PremiumStatus = "active" | "expiring" | "expired" | "inactive" | "none";

export function CreditPurchaseForm({
  maxQuantity,
  postPrice,
  activePremiumEndsAt,
  premiumDurationMonths,
  premiumEndsAt,
  premiumPostCredits,
  premiumPrice,
  premiumRemainingDays,
  premiumStatus,
}: {
  maxQuantity: number;
  postPrice: number;
  activePremiumEndsAt: string | null;
  premiumDurationMonths: number;
  premiumEndsAt: string | null;
  premiumPostCredits: number;
  premiumPrice: number;
  premiumRemainingDays: number | null;
  premiumStatus: PremiumStatus;
}) {
  const [quantity, setQuantity] = useState(1);
  const [postKey, setPostKey] = useState(() => crypto.randomUUID());
  const [premiumKey, setPremiumKey] = useState(() => crypto.randomUUID());
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
  const statusLabel = {
    active: "Đang sử dụng",
    expiring: "Sắp hết hạn",
    expired: "Đã hết hạn",
    inactive: "Không hoạt động",
    none: "Chưa đăng ký",
  }[premiumStatus];
  const statusVariant = {
    active: "success",
    expiring: "warning",
    expired: "secondary",
    inactive: "secondary",
    none: "outline",
  } as const;

  function buyPost() {
    const data = new FormData();
    data.set("quantity", String(quantity));
    data.set("idempotencyKey", postKey);
    startTransition(async () => {
      const result = await purchasePostCreditsAction(state, data);
      setState(result);
      if (result.success) setPostKey(crypto.randomUUID());
    });
  }

  function buyPremium() {
    const now = new Date();
    const startsAt = activePremiumEndsAt && new Date(activePremiumEndsAt) > now
      ? new Date(activePremiumEndsAt)
      : now;
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + premiumDurationMonths);
    const confirmation = activePremiumEndsAt && new Date(activePremiumEndsAt) > now
      ? `Gói hiện tại hết hạn ngày ${formatVietnamDateTime(startsAt)}. Gia hạn sẽ kéo dài đến ngày ${formatVietnamDateTime(endsAt)}.`
      : `Gói bắt đầu từ bây giờ và hết hạn ngày ${formatVietnamDateTime(endsAt)}.`;
    if (!window.confirm(confirmation)) return;
    const data = new FormData();
    data.set("idempotencyKey", premiumKey);
    startTransition(async () => {
      const result = await purchasePremiumAction(state, data);
      setState(result);
      if (result.success) setPremiumKey(crypto.randomUUID());
    });
  }

  return (
    <section
      aria-label="Các gói và lượt đăng bài"
      className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.9fr)]"
    >
      <Card className="relative min-w-0 overflow-hidden border-brand-navy bg-brand-navy text-white shadow-md">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full border border-white/10"
        />
        <CardHeader className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-sky-200">
                <Crown aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-xl text-white">Gói Premium</CardTitle>
                <CardDescription className="mt-1 text-white/70">
                  Dành cho tài khoản doanh nghiệp
                </CardDescription>
              </div>
            </div>
            <Badge className="border-white/20 bg-white/10 text-white">
              Premium
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-5">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-3xl font-bold tracking-tight text-amber-100 sm:text-4xl">
              {money(premiumPrice)}
            </p>
            <p className="pb-1 text-sm text-white/70">
              / {premiumDurationMonths} tháng
            </p>
          </div>

          <ul aria-label="Quyền lợi Premium" className="grid gap-3">
            <li className="flex items-start gap-2.5 text-sm leading-6 text-white/90">
              <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-sky-200" />
              <span>
                Tặng {premiumPostCredits} lượt đăng bài toán, có hiệu lực trong thời hạn gói.
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-sm leading-6 text-white/90">
              <Sparkles aria-hidden="true" className="mt-1 size-4 shrink-0 text-sky-200" />
              <span>
                Truy cập hỗ trợ AI soạn thảo bài toán khi Premium còn hiệu lực.
              </span>
            </li>
          </ul>

          <div className="flex flex-col gap-3 border-t border-white/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge className="w-fit" variant={statusVariant[premiumStatus]}>
                {statusLabel}
              </Badge>
              {premiumEndsAt && (
                <p className="flex items-center gap-1.5 text-xs leading-5 text-white/70">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
                  {premiumStatus === "expired"
                    ? `Đã hết hạn ${formatVietnamDateTime(new Date(premiumEndsAt))}`
                    : `Thời hạn đến ${formatVietnamDateTime(new Date(premiumEndsAt))}`}
                </p>
              )}
              {premiumStatus === "expiring" && premiumRemainingDays !== null && (
                <p className="w-full text-xs text-white/70 sm:pl-1">
                  {premiumRemainingDays === 0
                    ? "Còn dưới 1 ngày"
                    : `Còn ${premiumRemainingDays} ngày`}
                </p>
              )}
            </div>
            <Button
              aria-busy={pending}
              className="min-h-11 w-full shrink-0 bg-white text-brand-navy hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-brand-navy sm:w-auto"
              disabled={pending}
              onClick={buyPremium}
              type="button"
            >
              {pending ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  Đang xử lý...
                </>
              ) : (
                <>
                  {premiumStatus === "active" || premiumStatus === "expiring"
                    ? "Gia hạn Premium"
                    : "Mua Premium"}
                  <span aria-hidden="true">→</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base">Mua lượt đăng bài lẻ</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Bổ sung lượt gửi bài toán để xét duyệt, không hết hạn.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-2xl font-bold tracking-tight">{money(postPrice)}</p>
            <p className="mt-1 text-sm text-muted-foreground">cho mỗi lượt đăng bài</p>
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="post-credit-quantity"
            >
              Số lượt mua
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label={`Số lượt mua, tối đa ${maxQuantity}`}
                className="text-base tabular-nums sm:max-w-28 sm:text-sm"
                id="post-credit-quantity"
                max={maxQuantity}
                min={1}
                onChange={(event) => setQuantity(Number(event.target.value))}
                type="number"
                value={quantity}
              />
              <Button
                aria-busy={pending}
                className="min-h-11 w-full sm:flex-1"
                disabled={pending}
                onClick={buyPost}
                type="button"
              >
                {pending ? (
                  <>
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Mua lượt
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Mỗi lần mua tối đa {maxQuantity} lượt. Thanh toán giả lập.
            </p>
          </div>
        </CardContent>
      </Card>

      {(state.error || state.success) && (
        <p
          aria-live={state.error ? "assertive" : "polite"}
          className={`rounded-xl border px-4 py-3 text-sm lg:col-span-2 ${
            state.error
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-success/30 bg-success/10 text-success"
          }`}
          role={state.error ? "alert" : "status"}
        >
          {state.error ?? state.success}
        </p>
      )}
    </section>
  );
}
