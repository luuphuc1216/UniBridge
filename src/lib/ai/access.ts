import "server-only";
import { prisma } from "@/lib/prisma";
import { isActivePremium } from "@/lib/ai/policy";

export async function requireActivePremium(businessProfileId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { businessProfileId_package: { businessProfileId, package: "PREMIUM" } },
    select: { endsAt: true, status: true },
  });
  if (!isActivePremium(subscription ? { ...subscription, package: "PREMIUM" } : null)) {
    throw new Error("Tính năng AI dành cho doanh nghiệp Premium còn hạn. Hãy nâng cấp để sử dụng.");
  }
}
