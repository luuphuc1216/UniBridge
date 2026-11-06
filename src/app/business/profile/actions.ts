"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type BusinessProfileActionState = { error: string | null };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveBusinessProfileAction(
  _previous: BusinessProfileActionState,
  formData: FormData,
): Promise<BusinessProfileActionState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") {
    return { error: "Bạn cần đăng nhập bằng tài khoản doanh nghiệp." };
  }
  const companyName = text(formData, "companyName");
  const industry = text(formData, "industry");
  const contactEmail = text(formData, "contactEmail");
  const website = text(formData, "website");
  const phone = text(formData, "phone");
  if (!companyName) return { error: "Tên doanh nghiệp là bắt buộc." };
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: "Email liên hệ không hợp lệ." };
  }
  if (website && !/^https?:\/\/\S+$/i.test(website)) {
    return { error: "Website phải bắt đầu bằng http:// hoặc https://." };
  }
  if (phone && !/^[+]?[0-9 ()-]{8,20}$/.test(phone)) {
    return { error: "Số điện thoại không hợp lệ." };
  }
  try {
    await prisma.businessProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        companyName,
        industry: industry || "Chưa cập nhật",
        industries: text(formData, "industries"),
        logo: text(formData, "logo") || null,
        website: website || null,
        description: text(formData, "description"),
        address: text(formData, "address"),
        contactEmail: contactEmail || null,
        phone: phone || null,
        representative: text(formData, "representative"),
      },
      update: {
        companyName,
        industry: industry || "Chưa cập nhật",
        industries: text(formData, "industries"),
        logo: text(formData, "logo") || null,
        website: website || null,
        description: text(formData, "description"),
        address: text(formData, "address"),
        contactEmail: contactEmail || null,
        phone: phone || null,
        representative: text(formData, "representative"),
      },
    });
  } catch (error) {
    console.error("Lưu hồ sơ doanh nghiệp thất bại:", error);
    return { error: "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại." };
  }
  revalidatePath("/business/profile");
  revalidatePath("/business");
  revalidatePath("/business/problems");
  return { error: null };
}
