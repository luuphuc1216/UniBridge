"use client";

import { useActionState } from "react";
import { saveBusinessProfileAction, type BusinessProfileActionState } from "@/app/business/profile/actions";

type Profile = {
  companyName: string;
  industry: string;
  industries: string;
  logo: string | null;
  website: string | null;
  description: string;
  address: string;
  contactEmail: string | null;
  phone: string | null;
  representative: string;
};

export function BusinessProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<BusinessProfileActionState, FormData>(
    saveBusinessProfileAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-8 grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-7">
      {[
        ["companyName", "Tên doanh nghiệp", profile.companyName, true],
        ["industry", "Lĩnh vực chính", profile.industry, true],
        ["industries", "Các lĩnh vực (ngăn cách bằng dấu phẩy)", profile.industries, false],
        ["logo", "URL logo (HTTPS)", profile.logo ?? "", false],
        ["website", "Website", profile.website ?? "", false],
        ["address", "Địa chỉ", profile.address, false],
        ["contactEmail", "Email liên hệ", profile.contactEmail ?? "", false],
        ["phone", "Số điện thoại", profile.phone ?? "", false],
        ["representative", "Người đại diện", profile.representative, false],
      ].map(([name, label, value, required]) => (
        <label className="text-sm font-medium" key={name as string}>
          {label as string}
          <input
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
            defaultValue={value as string}
            name={name as string}
            required={required as boolean}
          />
        </label>
      ))}
      <label className="text-sm font-medium sm:col-span-2">
        Mô tả doanh nghiệp
        <textarea className="mt-1.5 min-h-32 w-full rounded-xl border border-border bg-background p-3" defaultValue={profile.description} name="description" />
      </label>
      {state.error && <p className="sm:col-span-2 text-sm text-destructive" role="alert">{state.error}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <a className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold" href="/business/profile">Hủy</a>
      </div>
    </form>
  );
}
