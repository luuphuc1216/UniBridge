"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  saveBusinessProfileWithLogo,
  updateBusinessProfileCore,
  type BusinessProfileSaveState,
} from "@/lib/business-profile-core";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { attachmentStorage } from "@/lib/storage";

export type BusinessProfileActionState = BusinessProfileSaveState;

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
    return {
      error: "Bạn cần đăng nhập bằng tài khoản doanh nghiệp.",
      success: null,
    };
  }

  const logoFile = formData.get("logoFile");
  try {
    const profile = await prisma.businessProfile.findUniqueOrThrow({
      where: { userId: session.user.id },
      select: { id: true, logo: true, logoMimeType: true },
    });
    const fields = {
      companyName: text(formData, "companyName"),
      industry: text(formData, "industry"),
      industries: text(formData, "industries"),
      website: text(formData, "website") || null,
      description: text(formData, "description"),
      address: text(formData, "address"),
      contactEmail: text(formData, "contactEmail") || null,
      phone: text(formData, "phone") || null,
      representative: text(formData, "representative"),
    };

    return await saveBusinessProfileWithLogo(
      { logo: profile.logo, logoMimeType: profile.logoMimeType },
      fields,
      {
        file: logoFile instanceof File && logoFile.size > 0 ? logoFile : null,
        logoUrl: text(formData, "logo"),
        removeLogo: formData.get("removeLogo") === "true",
      },
      {
        storage: attachmentStorage,
        validateFile: validateAttachment,
        createStorageKey: randomUUID,
        persist: async (profileFields, logo, logoMimeType) => {
          await updateBusinessProfileCore(
            session.user.id,
            profile.id,
            {
              ...profileFields,
              logo,
              logoMimeType,
            },
            prisma,
          );
        },
        readCurrentLogo: async () => {
          const currentProfile = await prisma.businessProfile.findUnique({
            where: { id: profile.id },
            select: { logo: true },
          });
          return currentProfile?.logo ?? null;
        },
        countLogoReferences: (logo) =>
          prisma.businessProfile.count({ where: { logo } }),
        revalidate: revalidatePath,
        logError: (message, error) => console.error(message, error),
      },
    );
  } catch (error) {
    console.error("Lưu hồ sơ doanh nghiệp thất bại:", error);
    return {
      error: "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại.",
      success: null,
    };
  }
}
