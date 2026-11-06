"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  isBusinessLogoUrl,
  isBusinessWebsiteUrl,
} from "@/lib/business-profile-validation";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { attachmentStorage } from "@/lib/storage";
import { randomUUID } from "node:crypto";

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
  const logo = text(formData, "logo");
  if (logo && !isBusinessLogoUrl(logo)) {
    return { error: "Logo phải là URL HTTPS hợp lệ và không vượt quá 2.048 ký tự." };
  }
  if (website && !isBusinessWebsiteUrl(website)) {
    return { error: "Website phải bắt đầu bằng http:// hoặc https://." };
  }
  if (phone && !/^[+]?[0-9 ()-]{8,20}$/.test(phone)) {
    return { error: "Số điện thoại không hợp lệ." };
  }
  let storedLogoKey: string | null = null;
  let storedLogoMimeType: string | null = null;
  const logoFile = formData.get("logoFile");
  if (logoFile instanceof File && logoFile.size > 0) {
    const validated = await validateAttachment(logoFile);
    if (!["image/png", "image/jpeg"].includes(validated.contentType)) {
      return { error: "Logo chỉ nhận tệp PNG hoặc JPG." };
    }
    storedLogoKey = randomUUID();
    storedLogoMimeType = validated.contentType;
    await attachmentStorage.save(storedLogoKey, validated.content);
  }
  try {
    await prisma.businessProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        companyName,
        industry: industry || "Chưa cập nhật",
        industries: text(formData, "industries"),
        logo: storedLogoKey ?? (logo || null),
        logoMimeType: storedLogoMimeType,
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
        logo: storedLogoKey ?? (logo || null),
        logoMimeType: storedLogoMimeType,
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
