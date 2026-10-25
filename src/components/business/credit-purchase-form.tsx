"use client";

import { useState, useTransition } from "react";
import {
  purchasePostCreditsAction,
  purchasePremiumAction,
  type CreditPurchaseState,
} from "@/app/business/credits/actions";

const initialState: CreditPurchaseState = { error: null, success: null };

export function CreditPurchaseForm({
  maxQuantity,
  postPrice,
  premiumPrice,
}: {
  maxQuantity: number;
  postPrice: number;
  premiumPrice: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [postKey, setPostKey] = useState(() => crypto.randomUUID());
  const [premiumKey, setPremiumKey] = useState(() => crypto.randomUUID());
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

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
    const data = new FormData();
    data.set("idempotencyKey", premiumKey);
    startTransition(async () => {
      const result = await purchasePremiumAction(state, data);
      setState(result);
      if (result.success) setPremiumKey(crypto.randomUUID());
    });
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Mua lượt lẻ</h2>
        <p className="mt-2 text-sm text-muted-foreground">{money(postPrice)} / lượt</p>
        <div className="mt-4 flex gap-2">
          <input
            className="w-24 rounded-xl border border-border bg-background px-3 py-2"
            max={maxQuantity}
            min={1}
            onChange={(event) => setQuantity(Number(event.target.value))}
            type="number"
            value={quantity}
          />
          <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} onClick={buyPost} type="button">
            Mua lượt
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Gói Premium</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {money(premiumPrice)} / 3 tháng · tặng 10 lượt
        </p>
        <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} onClick={buyPremium} type="button">
          Mua/gia hạn Premium
        </button>
      </div>
      {(state.error || state.success) && (
        <p className={`sm:col-span-2 rounded-xl px-4 py-3 text-sm ${state.error ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-800"}`} role="alert">
          {state.error ?? state.success}
        </p>
      )}
    </section>
  );
}
