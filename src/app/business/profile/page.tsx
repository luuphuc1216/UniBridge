import Link from "next/link";
import { requireBusinessProfile } from "@/lib/business-access";
import { prisma } from "@/lib/prisma";
import { BusinessProfileForm } from "@/components/business/business-profile-form";

export default async function BusinessProfilePage() {
  const { businessProfileId } = await requireBusinessProfile();
  const profile = await prisma.businessProfile.findUnique({
    where: { id: businessProfileId },
  });
  if (!profile) throw new Error("Không tìm thấy hồ sơ doanh nghiệp.");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link className="text-sm font-semibold text-primary hover:underline" href="/business">
        ← Tổng quan doanh nghiệp
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Hồ sơ doanh nghiệp</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thông tin liên hệ riêng tư chỉ được hiển thị trong phạm vi được phép.
      </p>
      <BusinessProfileForm profile={profile} />
    </main>
  );
}
