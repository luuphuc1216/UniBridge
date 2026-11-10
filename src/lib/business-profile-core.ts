import type { PrismaClient } from "@/generated/prisma/client";
import {
  isBusinessLogoUrl,
  isBusinessWebsiteUrl,
} from "@/lib/business-profile-validation";
import type { AttachmentStorage } from "@/lib/storage/attachment-storage";
import type { ValidatedAttachment } from "@/lib/business-attachments/validation";

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

export type BusinessProfileSaveState = {
  error: string | null;
  success: string | null;
};

export type BusinessProfileLogoRequest = {
  file: File | null;
  uploadedFile?: {
    storageKey: string;
    contentType: string;
  } | null;
  logoUrl: string;
  removeLogo: boolean;
};

export type BusinessProfileLogoSaveDependencies = {
  storage: AttachmentStorage;
  validateFile: (file: File) => Promise<ValidatedAttachment>;
  createStorageKey: () => string;
  persist: (
    fields: BusinessProfileFields,
    logo: string | null,
    logoMimeType: string | null,
  ) => Promise<void>;
  readCurrentLogo: () => Promise<string | null>;
  countLogoReferences: (logo: string) => Promise<number>;
  revalidate: (path: string) => void;
  logError: (message: string, error: unknown) => void;
};

type BusinessProfileLogoSnapshot = {
  logo: string | null;
  logoMimeType: string | null;
};

type BusinessProfileFields = Omit<
  BusinessProfileInput,
  "logo" | "logoMimeType"
>;

const internalLogoKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function deleteNewLogoAfterFailedSave(
  storageKey: string,
  dependencies: BusinessProfileLogoSaveDependencies,
): Promise<void> {
  try {
    await dependencies.storage.delete(storageKey);
  } catch (error) {
    dependencies.logError("Không thể dọn logo mới sau khi lưu hồ sơ thất bại:", error);
  }
}

async function deleteReplacedLogo(
  oldLogo: string | null,
  newLogo: string | null,
  dependencies: BusinessProfileLogoSaveDependencies,
): Promise<boolean> {
  if (
    !oldLogo ||
    oldLogo === newLogo ||
    !internalLogoKeyPattern.test(oldLogo)
  ) {
    return true;
  }

  try {
    if ((await dependencies.countLogoReferences(oldLogo)) > 0) return true;
    await dependencies.storage.delete(oldLogo);
    return true;
  } catch (error) {
    dependencies.logError("Không thể dọn logo doanh nghiệp cũ:", error);
    return false;
  }
}

export async function saveBusinessProfileWithLogo(
  currentProfile: BusinessProfileLogoSnapshot,
  fields: BusinessProfileFields,
  request: BusinessProfileLogoRequest,
  dependencies: BusinessProfileLogoSaveDependencies,
): Promise<BusinessProfileSaveState> {
  const hasFile = Boolean(
    (request.file && request.file.size > 0) || request.uploadedFile,
  );
  const logoUrl = request.logoUrl.trim();
  const hasLogoUrl = Boolean(logoUrl);
  let newStorageKey = request.uploadedFile?.storageKey ?? null;

  if (request.removeLogo && (hasFile || hasLogoUrl)) {
    if (newStorageKey) await deleteNewLogoAfterFailedSave(newStorageKey, dependencies);
    return {
      error: "Hãy chọn xóa logo hoặc thay logo, không thể thực hiện cả hai cùng lúc.",
      success: null,
    };
  }
  if (hasFile && hasLogoUrl) {
    if (newStorageKey) await deleteNewLogoAfterFailedSave(newStorageKey, dependencies);
    return {
      error: "Hãy chọn tải tệp logo hoặc nhập URL logo, không thể dùng cả hai cùng lúc.",
      success: null,
    };
  }

  let nextLogo = currentProfile.logo;
  let nextLogoMimeType = currentProfile.logoMimeType;
  if (request.removeLogo) {
    nextLogo = null;
    nextLogoMimeType = null;
  } else if (request.uploadedFile) {
    if (!["image/png", "image/jpeg"].includes(request.uploadedFile.contentType)) {
      await deleteNewLogoAfterFailedSave(request.uploadedFile.storageKey, dependencies);
      return { error: "Logo chỉ nhận tệp PNG hoặc JPG.", success: null };
    }
    nextLogo = newStorageKey;
    nextLogoMimeType = request.uploadedFile.contentType;
  } else if (hasFile && request.file) {
    let validatedFile: ValidatedAttachment;
    try {
      validatedFile = await dependencies.validateFile(request.file);
    } catch (error) {
      return {
        error: messageFromError(error, "Tệp logo không hợp lệ."),
        success: null,
      };
    }

    if (!["image/png", "image/jpeg"].includes(validatedFile.contentType)) {
      return { error: "Logo chỉ nhận tệp PNG hoặc JPG.", success: null };
    }

    newStorageKey = dependencies.createStorageKey();
    try {
      await dependencies.storage.save(newStorageKey, validatedFile.content);
    } catch (error) {
      await deleteNewLogoAfterFailedSave(newStorageKey, dependencies);
      return {
        error: messageFromError(error, "Không thể tải logo lên. Vui lòng thử lại."),
        success: null,
      };
    }
    nextLogo = newStorageKey;
    nextLogoMimeType = validatedFile.contentType;
  } else if (hasLogoUrl) {
    nextLogo = logoUrl;
    nextLogoMimeType = null;
  }

  try {
    await dependencies.persist(fields, nextLogo, nextLogoMimeType);
  } catch (error) {
    dependencies.logError("Cập nhật cơ sở dữ liệu hồ sơ doanh nghiệp thất bại:", error);
    let currentLogoAfterFailure: string | null;
    try {
      currentLogoAfterFailure = await dependencies.readCurrentLogo();
    } catch (readError) {
      dependencies.logError(
        "Không thể xác định trạng thái logo sau khi lưu hồ sơ thất bại:",
        readError,
      );
      return {
        error: "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại.",
        success: null,
      };
    }

    const logoUpdateWasCommitted =
      currentLogoAfterFailure === nextLogo &&
      (newStorageKey !== null || nextLogo !== currentProfile.logo);
    if (!logoUpdateWasCommitted) {
      if (newStorageKey) await deleteNewLogoAfterFailedSave(newStorageKey, dependencies);
      return {
        error: "Không thể lưu hồ sơ doanh nghiệp. Vui lòng thử lại.",
        success: null,
      };
    }
  }

  const oldLogoCleaned = await deleteReplacedLogo(
    currentProfile.logo,
    nextLogo,
    dependencies,
  );

  const success = oldLogoCleaned
    ? "Đã lưu hồ sơ doanh nghiệp."
    : "Đã lưu hồ sơ doanh nghiệp, nhưng chưa thể dọn logo cũ.";
  let result: BusinessProfileSaveState = { error: null, success };

  for (const path of ["/business/profile", "/business", "/business/problems"]) {
    try {
      dependencies.revalidate(path);
    } catch (error) {
      dependencies.logError(`Không thể làm mới dữ liệu tại ${path}:`, error);
      result = {
        error: null,
        success: "Đã lưu hồ sơ, nhưng chưa thể làm mới mọi nội dung. Vui lòng tải lại trang.",
      };
    }
  }

  return result;
}

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
