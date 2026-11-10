import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateAttachment } from "@/lib/business-attachments/validation";
import { requireOwnedTeam } from "@/lib/student-team";
import { canReplaceApproachAttachments } from "@/lib/approach-attachments";
import { findAccessibleProject } from "@/lib/project-access";
import { canRespondForTeam } from "@/lib/team-permissions";
import { attachmentStorage } from "./index";
import {
  getAllowedContentType,
  safeOriginalName,
  validateUploadBatch,
  type UploadFileDescription,
} from "./upload-validation";

export { validateUploadBatch } from "./upload-validation";

export type UploadScope =
  | { kind: "business-problem"; problemId?: string }
  | { kind: "business-logo" }
  | { kind: "approach"; problemId: string }
  | { kind: "portfolio"; teamId: string; itemId?: string }
  | {
      kind: "proposal";
      problemId: string;
      applicationId: string;
      legacy?: boolean;
    }
  | { kind: "milestone"; milestoneId: string };

type UploadClaim = {
  userId: string;
  scope: UploadScope;
  pendingKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: number;
};

export type UploadGrant = {
  token: string;
  url: string;
  contentType: string;
  local: boolean;
};

export type CompletedUpload = {
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET cần có ít nhất 32 ký tự để ký quyền tải tệp.");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function signClaim(claim: UploadClaim): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readClaim(token: string): UploadClaim {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Quyền tải tệp không hợp lệ.");
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Quyền tải tệp không hợp lệ.");
  }
  let claim: unknown;
  try {
    claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Quyền tải tệp không hợp lệ.");
  }
  if (
    !claim ||
    typeof claim !== "object" ||
    !("userId" in claim) ||
    typeof claim.userId !== "string" ||
    !("pendingKey" in claim) ||
    typeof claim.pendingKey !== "string" ||
    !/^pending\/[0-9a-f-]{36}$/i.test(claim.pendingKey) ||
    !("expiresAt" in claim) ||
    typeof claim.expiresAt !== "number" ||
    claim.expiresAt <= Date.now()
  ) {
    throw new Error("Quyền tải tệp đã hết hạn hoặc không hợp lệ.");
  }
  return claim as UploadClaim;
}

function isUploadScope(value: unknown): value is UploadScope {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const scope = value as Record<string, unknown>;
  switch (scope.kind) {
    case "business-problem":
      return scope.problemId === undefined || typeof scope.problemId === "string";
    case "business-logo":
      return true;
    case "approach":
      return typeof scope.problemId === "string";
    case "portfolio":
      return (
        typeof scope.teamId === "string" &&
        (scope.itemId === undefined || typeof scope.itemId === "string")
      );
    case "proposal":
      return (
        typeof scope.problemId === "string" &&
        typeof scope.applicationId === "string" &&
        (scope.legacy === undefined || typeof scope.legacy === "boolean")
      );
    case "milestone":
      return typeof scope.milestoneId === "string";
    default:
      return false;
  }
}

function sameScope(left: UploadScope, right: UploadScope): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function authorizeScope(userId: string, role: string, scope: UploadScope) {
  if (scope.kind === "business-logo" || scope.kind === "business-problem") {
    if (role !== "BUSINESS") throw new Error("Chỉ tài khoản doanh nghiệp được phép tải tệp này lên.");
    const profile = await prisma.businessProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new Error("Không tìm thấy hồ sơ doanh nghiệp.");
    if (scope.kind === "business-problem" && scope.problemId) {
      const problem = await prisma.problem.findFirst({
        where: { id: scope.problemId, businessProfileId: profile.id },
        select: { id: true },
      });
      if (!problem) throw new Error("Bạn không có quyền đính kèm tệp cho bài toán này.");
    }
    return;
  }

  if (scope.kind === "approach") {
    if (role !== "STUDENT") throw new Error("Chỉ tài khoản sinh viên được gửi Approach.");
    const team = await requireOwnedTeam(userId);
    const application = await prisma.application.findUnique({
      where: { problemId_teamId: { problemId: scope.problemId, teamId: team.id } },
      select: { id: true, status: true },
    });
    if (application && !canReplaceApproachAttachments(application.status)) {
      throw new Error("Bạn không thể thay đổi tài liệu của hồ sơ này.");
    }
    return;
  }

  if (scope.kind === "portfolio") {
    if (role !== "STUDENT") throw new Error("Chỉ tài khoản sinh viên được quản lý Portfolio.");
    const team = await prisma.studentTeam.findFirst({
      where: {
        id: scope.teamId,
        OR: [
          { ownerId: userId },
          { memberships: { some: { isLead: true, studentProfile: { userId } } } },
        ],
      },
      select: { id: true },
    });
    if (!team) throw new Error("Bạn không có quyền quản lý nhóm này.");
    if (scope.itemId) {
      const item = await prisma.portfolioItem.findFirst({
        where: { id: scope.itemId, teamId: scope.teamId },
        select: { id: true },
      });
      if (!item) throw new Error("Không tìm thấy mục Portfolio.");
    }
    return;
  }

  if (scope.kind === "proposal") {
    if (role !== "STUDENT") throw new Error("Chỉ nhóm sinh viên được nộp Proposal.");
    const application = await prisma.application.findFirst({
      where: {
        id: scope.applicationId,
        problemId: scope.problemId,
        status: "SELECTED",
        problem: {
          is: {
            status: "PROTOTYPING",
            ...(scope.legacy
              ? {}
              : { prototypeLegacy: false, trialBriefLockedAt: { not: null } }),
          },
        },
        ...(scope.legacy
          ? {
              team: {
                OR: [
                  { ownerId: userId },
                  { memberships: { some: { studentProfile: { userId } } } },
                ],
              },
            }
          : { team: { is: { ownerId: userId } } }),
      },
      select: { id: true },
    });
    if (!application) throw new Error("Bạn không có quyền nộp Proposal cho bài toán này.");
    return;
  }

  if (scope.kind === "milestone") {
    if (role !== "STUDENT") throw new Error("Chỉ tài khoản sinh viên được nộp Milestone.");
    const milestone = await prisma.milestone.findUnique({
      where: { id: scope.milestoneId },
      select: { projectId: true },
    });
    if (!milestone) throw new Error("Không tìm thấy Milestone.");
    const project = await findAccessibleProject(milestone.projectId, userId, role);
    const activeMilestone = project?.milestones.find(({ id }) => id === scope.milestoneId);
    if (
      !project ||
      project.status !== "IN_PROGRESS" ||
      !activeMilestone ||
      (!project.legacyTermsExempt && !canRespondForTeam(project.team.ownerId, userId)) ||
      !["IN_PROGRESS", "NEEDS_REVISION", "REVISION_REQUESTED"].includes(activeMilestone.status)
    ) {
      throw new Error("Bạn không có quyền nộp kết quả cho Milestone này.");
    }
  }
}

export async function createUploadGrants(
  userId: string,
  role: string,
  scope: UploadScope,
  files: UploadFileDescription[],
): Promise<UploadGrant[]> {
  validateUploadBatch(files);
  await authorizeScope(userId, role, scope);
  if (scope.kind === "business-logo" && files.length !== 1) {
    throw new Error("Logo chỉ được tải lên một tệp.");
  }
  if (
    scope.kind === "business-logo" &&
    files.some((file) => ![".png", ".jpg", ".jpeg"].includes(file.name.toLowerCase().slice(file.name.lastIndexOf("."))))
  ) {
    throw new Error("Logo chỉ nhận tệp PNG hoặc JPG.");
  }
  if (scope.kind === "portfolio" && files.length !== 1) {
    throw new Error("Mỗi mục Portfolio chỉ nhận một tệp.");
  }
  if (
    scope.kind === "portfolio" &&
    files.some((file) => ![".pdf", ".png", ".jpg", ".jpeg"].includes(file.name.toLowerCase().slice(file.name.lastIndexOf("."))))
  ) {
    throw new Error("Portfolio chỉ nhận tệp PNG, JPG hoặc PDF.");
  }

  return Promise.all(
    files.map(async (file) => {
      const originalName = safeOriginalName(file.name);
      const contentType = getAllowedContentType(file);
      const pendingKey = `pending/${randomUUID()}`;
      const uploadUrl = await attachmentStorage.createUploadUrl?.(
        pendingKey,
        contentType,
        file.size,
      );
      const claim: UploadClaim = {
        userId,
        scope,
        pendingKey,
        originalName,
        contentType,
        sizeBytes: file.size,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      return {
        token: signClaim(claim),
        url: uploadUrl ?? "/api/uploads/local",
        contentType,
        local: !uploadUrl,
      };
    }),
  );
}

export async function storeLocalUpload(token: string, userId: string, file: File) {
  const claim = readClaim(token);
  if (claim.userId !== userId) throw new Error("Quyền tải tệp không hợp lệ.");
  const session = await auth();
  if (!session?.user || session.user.id !== userId) throw new Error("Vui lòng đăng nhập.");
  if (!isUploadScope(claim.scope)) throw new Error("Phạm vi tải tệp không hợp lệ.");
  await authorizeScope(userId, session.user.role, claim.scope);
  if (file.size !== claim.sizeBytes || file.name !== claim.originalName) {
    throw new Error("Thông tin tệp tải lên đã thay đổi.");
  }
  const validated = await validateAttachment(file);
  if (validated.contentType !== claim.contentType) {
    throw new Error("Định dạng nội dung tệp không khớp.");
  }
  if (!attachmentStorage.savePending) {
    throw new Error("Kho lưu trữ hiện không hỗ trợ tải tệp trực tiếp.");
  }
  await attachmentStorage.savePending(claim.pendingKey, validated.content);
}

export async function deletePendingUpload(token: string, userId: string): Promise<void> {
  const claim = readClaim(token);
  if (claim.userId !== userId) throw new Error("Quyền tải tệp không hợp lệ.");
  await attachmentStorage.delete(claim.pendingKey);
}

export async function completeUploadTokens(
  tokens: string[],
  userId: string,
  role: string,
  expectedScope: UploadScope,
): Promise<CompletedUpload[]> {
  if (tokens.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`Chỉ được tải lên tối đa ${MAX_ATTACHMENT_COUNT} tệp.`);
  }
  const claims = tokens.map(readClaim);
  if (
    claims.some(
      (claim) =>
        claim.userId !== userId ||
        !isUploadScope(claim.scope) ||
        !sameScope(claim.scope, expectedScope),
    )
  ) {
    throw new Error("Tệp tải lên không thuộc tài nguyên hiện tại.");
  }
  await authorizeScope(userId, role, expectedScope);
  const total = claims.reduce((sum, claim) => sum + claim.sizeBytes, 0);
  if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new Error("Tổng dung lượng tệp không được vượt quá 60 MB.");
  }

  const completed: CompletedUpload[] = [];
  let failedPromotionKey: string | undefined;
  try {
    for (const claim of claims) {
      const content = await attachmentStorage.read(claim.pendingKey);
      if (content.byteLength !== claim.sizeBytes) {
        throw new Error(`Dung lượng tệp ${claim.originalName} không khớp.`);
      }
      const fileContent = new ArrayBuffer(content.byteLength);
      new Uint8Array(fileContent).set(content);
      const file = new File([fileContent], claim.originalName, { type: claim.contentType });
      const validated = await validateAttachment(file);
      if (validated.contentType !== claim.contentType) {
        throw new Error(`Định dạng tệp ${claim.originalName} không khớp.`);
      }
      const storageKey = randomUUID();
      try {
        if (attachmentStorage.promote) {
          failedPromotionKey = claim.pendingKey;
          await attachmentStorage.promote(
            claim.pendingKey,
            storageKey,
            validated.contentType,
          );
          failedPromotionKey = undefined;
        } else {
          await attachmentStorage.save(storageKey, content);
          await attachmentStorage.delete(claim.pendingKey);
        }
      } catch (error) {
        if (!attachmentStorage.promote) {
          try {
            await attachmentStorage.delete(storageKey);
          } catch (cleanupError) {
            console.error("Không thể dọn tệp sau khi hoàn tất upload thất bại:", cleanupError);
          }
        }
        throw error;
      }
      completed.push({
        storageKey,
        originalName: validated.originalName,
        contentType: validated.contentType,
        sizeBytes: validated.sizeBytes,
      });
    }
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      ...completed.map(({ storageKey }) => attachmentStorage.delete(storageKey)),
      ...claims
        .filter(({ pendingKey }) => pendingKey !== failedPromotionKey)
        .map(({ pendingKey }) => attachmentStorage.delete(pendingKey)),
    ]);
    cleanupResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Không thể dọn tệp upload chưa được gắn metadata:", result.reason);
      }
    });
    throw error;
  }
  return completed;
}

export function parseUploadTokens(formData: FormData, fieldName: string): string[] {
  const value = formData.get(`${fieldName}UploadTokens`);
  if (value === null || value === "") return [];
  if (typeof value !== "string" || value.length > 32_000) {
    throw new Error("Danh sách tệp tải lên không hợp lệ.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Danh sách tệp tải lên không hợp lệ.");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some((token) => typeof token !== "string" || token.length > 4096)
  ) {
    throw new Error("Danh sách tệp tải lên không hợp lệ.");
  }
  return parsed;
}

export function parseUploadScope(value: unknown): UploadScope {
  if (!isUploadScope(value)) throw new Error("Phạm vi tải tệp không hợp lệ.");
  return value;
}
