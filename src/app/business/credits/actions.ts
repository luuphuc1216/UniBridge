"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CreditPayloadConflictError,
  purchasePostCredits,
  purchasePremium,
} from "@/lib/post-credits";

export type CreditPurchaseState = { error: string | null; success: string | null };

async function getBusinessBuyer() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") {
    throw new Error("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.");
  }
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) throw new Error("Không tìm thấy hồ sơ doanh nghiệp.");
  return { businessProfileId: profile.id, buyerId: session.user.id };
}

function key(formData: FormData): string {
  const value = formData.get("idempotencyKey");
  if (typeof value !== "string" || value.length < 10) {
    throw new Error("Phiên thanh toán không hợp lệ. Vui lòng tải lại trang.");
  }
  return value;
}

export async function purchasePostCreditsAction(
  _previous: CreditPurchaseState,
  formData: FormData,
): Promise<CreditPurchaseState> {
  try {
    const { businessProfileId, buyerId } = await getBusinessBuyer();
    const quantity = Number(formData.get("quantity"));
    await prisma.$transaction((transaction) =>
      purchasePostCredits(transaction, {
        businessProfileId,
        buyerId,
        quantity,
        idempotencyKey: key(formData),
      }),
    );
    revalidatePath("/business/credits");
    revalidatePath("/business");
    return { error: null, success: "Đã mua lượt đăng thành công (thanh toán giả lập)." };
  } catch (error) {
    if (error instanceof CreditPayloadConflictError) {
      return { error: error.message, success: null };
    }
    return {
      error: error instanceof Error ? error.message : "Không thể mua lượt đăng.",
      success: null,
    };
  }
}

export async function purchasePremiumAction(
  _previous: CreditPurchaseState,
  formData: FormData,
): Promise<CreditPurchaseState> {
  try {
    const { businessProfileId, buyerId } = await getBusinessBuyer();
    await prisma.$transaction((transaction) =>
      purchasePremium(transaction, {
        businessProfileId,
        buyerId,
        idempotencyKey: key(formData),
      }),
    );
    revalidatePath("/business/credits");
    revalidatePath("/business");
    return { error: null, success: "Đã mua/gia hạn Premium thành công (thanh toán giả lập)." };
  } catch (error) {
    if (error instanceof CreditPayloadConflictError) {
      return { error: error.message, success: null };
    }
    return {
      error: error instanceof Error ? error.message : "Không thể mua Premium.",
      success: null,
    };
  }
}
