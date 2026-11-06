import type { PrismaClient } from "@/generated/prisma/client";
import {
  isBusinessLogoUrl,
  isBusinessWebsiteUrl,
} from "@/lib/business-profile-validation";

type BusinessDatabase = Pick<PrismaClient, "businessProfile">;

export type BusinessProfileInput = {
  companyName: string;
  industry: string;
  industries: string;
  logo: string | null;
  logoMimeType?: string | null;
  website: string | null;
  description: string;
  address: string;
  contactEmail: string | null;
  phone: string | null;
  representative: string;
};

export async function updateBusinessProfileCore(
  userId: string,
  businessProfileId: string,
  input: BusinessProfileInput,
  database: BusinessDatabase,
) {
  if (!input.companyName) throw new Error("Tên doanh nghiệp là bắt buộc.");
  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    throw new Error("Email liên hệ không hợp lệ.");
  }
  if (input.logo && !/^[0-9a-f-]{36}$/i.test(input.logo) && !isBusinessLogoUrl(input.logo)) {
    throw new Error("Logo phải là URL HTTPS hợp lệ và không vượt quá 2.048 ký tự.");
  }
  if (input.website && !isBusinessWebsiteUrl(input.website)) {
    throw new Error("Website phải bắt đầu bằng http:// hoặc https://.");
  }
  if (input.phone && !/^[+]?[0-9 ()-]{8,20}$/.test(input.phone)) {
    throw new Error("Số điện thoại không hợp lệ.");
  }
  const owned = await database.businessProfile.findFirst({
    where: { id: businessProfileId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Bạn không có quyền sửa hồ sơ doanh nghiệp này.");
  return database.businessProfile.update({
    where: { id: businessProfileId },
    data: {
      companyName: input.companyName,
      industry: input.industry || "Chưa cập nhật",
      industries: input.industries,
      logo: input.logo,
      logoMimeType: input.logoMimeType ?? null,
      website: input.website,
      description: input.description,
      address: input.address,
      contactEmail: input.contactEmail,
      phone: input.phone,
      representative: input.representative,
    },
  });
}
