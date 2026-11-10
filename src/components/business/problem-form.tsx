"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
  type FormEvent,
  useRef,
  useId,
} from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import {
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateSelectedAttachments } from "@/lib/business-attachments/client-validation";
import type { ProblemActionState } from "@/app/business/problems/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/uploads/file-picker";

type ProblemFormValues = {
  id: string;
  title: string;
  description: string;
  goal: string;
  field: string;
  requirements: string;
  expectedDuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  status: string;
  reviewNote: string | null;
};

type ExistingAttachment = {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

type AiDraftField = "description" | "goal" | "requirements";
type AiDraftSuggestion = Record<AiDraftField, string>;
type AiDraftFeedback = {
  kind: "success" | "unavailable" | "quota" | "access" | "validation" | "error";
  message: string;
};

type ProblemFormProps = {
  action: (
    state: ProblemActionState,
    formData: FormData,
  ) => Promise<ProblemActionState>;
  problem?: ProblemFormValues;
  attachments?: ExistingAttachment[];
};

const fieldClass = "text-base motion-reduce:transition-none sm:text-sm";
const aiDraftFields: {
  key: AiDraftField;
  label: string;
  applyLabel: string;
}[] = [
  { key: "description", label: "Mô tả vấn đề", applyLabel: "Áp dụng vào mô tả" },
  { key: "goal", label: "Mục tiêu mong muốn", applyLabel: "Áp dụng vào mục tiêu" },
  {
    key: "requirements",
    label: "Yêu cầu đối với nhóm sinh viên",
    applyLabel: "Áp dụng vào yêu cầu",
  },
];

function isAiDraftSuggestion(value: unknown): value is AiDraftSuggestion {
  if (!value || typeof value !== "object") return false;
  const suggestion = value as Record<string, unknown>;
  return ["description", "goal", "requirements"].every((field) => {
    const content = suggestion[field];
    return typeof content === "string" && content.trim().length > 0;
  });
}

function formatSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 2 : 1)} MB`;
}

function getAiDraftFeedback(status: number, message: string): AiDraftFeedback {
  const safeMessage = message.trim();
  if (status === 400) {
    return {
      kind: "validation",
      message: safeMessage.startsWith("Ý ngắn")
        ? safeMessage
        : "Vui lòng nhập ý chính về bài toán và thử lại.",
    };
  }
  if (status === 403) {
    if (/hết lượt AI/i.test(safeMessage)) {
      return { kind: "quota", message: safeMessage };
    }
    if (/Premium|đăng nhập|hồ sơ/i.test(safeMessage)) {
      return { kind: "access", message: safeMessage };
    }
    return {
      kind: "access",
      message: "Tài khoản hiện không đủ điều kiện sử dụng chức năng AI này.",
    };
  }
  if (
    status === 502 &&
    /dịch vụ AI hiện chưa được bật|AI chưa được cấu hình/i.test(safeMessage)
  ) {
    return {
      kind: "unavailable",
      message: "AI hiện chưa khả dụng. Bạn vẫn có thể tiếp tục điền biểu mẫu.",
    };
  }
  return {
    kind: "error",
    message: "AI tạm thời không thể xử lý yêu cầu. Vui lòng thử lại sau.",
  };
}

export function ProblemForm({
  action,
  problem,
  attachments = [],
}: ProblemFormProps) {
  const [state, setState] = useState<ProblemActionState>({ error: null });
  const [isPending, startPendingTransition] = useTransition();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [uploadResetSignal, setUploadResetSignal] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AiDraftSuggestion | null>(null);
  const [aiAppliedFields, setAiAppliedFields] = useState<
    Record<AiDraftField, boolean>
  >({ description: false, goal: false, requirements: false });
  const [aiFeedback, setAiFeedback] = useState<AiDraftFeedback | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const aiBriefId = useId();
  const aiBriefHelpId = useId();
  const aiSuggestionId = useId();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const requirementsRef = useRef<HTMLTextAreaElement>(null);
  const visibleAttachments = attachments.filter(
    (attachment) => !deletedIds.includes(attachment.id),
  );

  async function handleAiDraft() {
    if (aiPending) return;
    setAiPending(true);
    setAiSuggestion(null);
    setAiAppliedFields({ description: false, goal: false, requirements: false });
    setAiFeedback(null);
    try {
      const response = await fetch("/api/business/ai/problem-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: aiBrief }),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            error?: unknown;
            suggestion?: unknown;
          }
        | null;
      if (!response.ok) {
        setAiFeedback(
          getAiDraftFeedback(
            response.status,
            typeof result?.error === "string" ? result.error : "",
          ),
        );
        return;
      }

      if (!isAiDraftSuggestion(result?.suggestion)) {
        setAiFeedback({
          kind: "error",
          message: "AI trả về nội dung không hợp lệ. Biểu mẫu của bạn chưa bị thay đổi.",
        });
        return;
      }

      setAiSuggestion({
        description: result.suggestion.description,
        goal: result.suggestion.goal,
        requirements: result.suggestion.requirements,
      });
      setAiFeedback({
        kind: "success",
        message:
          "Đề xuất đã sẵn sàng để xem. Chưa có nội dung nào trong biểu mẫu bị thay đổi.",
      });
    } catch {
      setAiFeedback({
        kind: "error",
        message: "Không thể kết nối dịch vụ AI lúc này. Vui lòng thử lại sau.",
      });
    } finally {
      setAiPending(false);
    }
  }

  function applyAiSuggestion(field: AiDraftField) {
    if (!aiSuggestion) return;
    const target = {
      description: descriptionRef.current,
      goal: goalRef.current,
      requirements: requirementsRef.current,
    }[field];
    if (!target) return;

    target.value = aiSuggestion[field];
    setAiAppliedFields((current) => ({ ...current, [field]: true }));
    setAiFeedback({
      kind: "success",
      message: `Đã áp dụng gợi ý vào trường “${aiDraftFields.find((item) => item.key === field)?.label}”. Bạn vẫn có thể chỉnh sửa trước khi lưu.`,
    });
  }

  function handleAiDraftFieldChange(field: AiDraftField) {
    setAiAppliedFields((current) => ({ ...current, [field]: false }));
    setAiFeedback((current) =>
      current?.kind === "success" ? null : current,
    );
  }

  function discardAiSuggestion() {
    const hasAppliedFields = Object.values(aiAppliedFields).some(Boolean);
    setAiSuggestion(null);
    setAiAppliedFields({ description: false, goal: false, requirements: false });
    setAiFeedback({
      kind: "success",
      message: hasAppliedFields
        ? "Đã đóng phần gợi ý. Nội dung bạn đã áp dụng hoặc chỉnh sửa vẫn được giữ nguyên."
        : "Đã bỏ qua đề xuất. Nội dung hiện có trong biểu mẫu được giữ nguyên.",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || isUploading) return;
    setClientError(null);
    setState({ error: null });

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("attachments");
    const selectedFiles =
      fileInput instanceof HTMLInputElement && fileInput.files
        ? Array.from(fileInput.files)
        : [];

    const validationError = validateSelectedAttachments(
      selectedFiles,
      visibleAttachments.length,
      visibleAttachments.reduce((total, attachment) => total + attachment.sizeBytes, 0),
    );
    if (validationError) {
      setClientError(validationError);
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData =
      submitter instanceof HTMLButtonElement && submitter.name
        ? new FormData(form, submitter)
        : new FormData(form);
    startPendingTransition(() => {
      void action(state, formData)
        .then((result) => {
          setState(result);
          setUploadResetSignal((current) => current + 1);
        })
        .catch((error: unknown) => {
          setUploadResetSignal((current) => current + 1);
          const message = error instanceof Error ? error.message : "";
          setClientError(
            /unexpected end of form/i.test(message)
              ? "Tệp quá lớn hoặc quá nhiều tệp, vui lòng kiểm tra lại"
              : "Không thể lưu bài toán lúc này. Vui lòng kiểm tra tài liệu và thử lại.",
          );
        });
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {problem && <input name="problemId" type="hidden" value={problem.id} />}
      {deletedIds.map((id) => (
        <input key={id} name="deletedAttachmentIds" type="hidden" value={id} />
      ))}

      {problem?.reviewNote && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Yêu cầu chỉnh sửa</p>
          <p className="mt-1">{problem.reviewNote}</p>
        </div>
      )}

      <Card>
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Thông tin cơ bản</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Đặt tên rõ ràng và xác định lĩnh vực, thời gian dự kiến của bài toán.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              <span>Tên vấn đề</span>
              <Input
                className={fieldClass}
                defaultValue={problem?.title}
                maxLength={200}
                minLength={2}
                name="title"
                placeholder="Ví dụ: Xây dựng website bán hàng trực tuyến"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Lĩnh vực</span>
              <Input
                className={fieldClass}
                defaultValue={problem?.field}
                maxLength={100}
                minLength={2}
                name="field"
                placeholder="Công nghệ thông tin, Marketing..."
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Thời gian dự kiến</span>
              <Input
                className={fieldClass}
                defaultValue={problem?.expectedDuration}
                minLength={2}
                name="expectedDuration"
                placeholder="6-8 tuần"
                required
              />
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Mô tả bài toán</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Mô tả bối cảnh và kết quả doanh nghiệp mong muốn đạt được.
            </p>
          </div>
          <div className="space-y-5">
            <label className="block space-y-2 text-sm font-medium">
              <span>Mô tả vấn đề</span>
              <Textarea
                className={`${fieldClass} min-h-36 resize-y`}
                defaultValue={problem?.description}
                onChange={() => handleAiDraftFieldChange("description")}
                ref={descriptionRef}
                minLength={2}
                name="description"
                placeholder="Mô tả thực trạng và vấn đề doanh nghiệp đang gặp phải"
                required
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Mục tiêu mong muốn</span>
              <Textarea
                className={`${fieldClass} min-h-28 resize-y`}
                defaultValue={problem?.goal}
                onChange={() => handleAiDraftFieldChange("goal")}
                ref={goalRef}
                minLength={2}
                name="goal"
                placeholder="Kết quả doanh nghiệp mong muốn đạt được"
                required
              />
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Yêu cầu đối với nhóm</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Nêu kiến thức, kỹ năng hoặc kinh nghiệm cần thiết để thực hiện bài
              toán.
            </p>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            <span>Yêu cầu đối với nhóm sinh viên</span>
            <Textarea
              className={`${fieldClass} min-h-28 resize-y`}
              defaultValue={problem?.requirements}
              onChange={() => handleAiDraftFieldChange("requirements")}
              ref={requirementsRef}
              minLength={2}
              name="requirements"
              placeholder="Kiến thức, kỹ năng hoặc kinh nghiệm cần thiết"
              required
            />
          </label>
        </div>
      </Card>

      <Card>
        <section
          aria-labelledby="problem-ai-title"
          aria-busy={aiPending}
          className="space-y-5 p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold" id="problem-ai-title">
                  Hỗ trợ soạn thảo bằng AI
                </h2>
                <Badge
                  className="motion-reduce:transition-none"
                  variant="outline"
                >
                  Premium
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Nhập ý chính về bài toán. AI có thể đề xuất nội dung cho mô tả,
                mục tiêu và yêu cầu đối với nhóm.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Chức năng dành cho tài khoản doanh nghiệp Premium.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={aiBriefId}>
              Ý chính về bài toán
            </label>
            <Textarea
              aria-describedby={aiBriefHelpId}
              className={`${fieldClass} min-h-28 resize-y`}
              disabled={aiPending}
              id={aiBriefId}
              maxLength={4000}
              onChange={(event) => {
                setAiBrief(event.target.value);
                setAiSuggestion(null);
                setAiAppliedFields({
                  description: false,
                  goal: false,
                  requirements: false,
                });
                setAiFeedback(null);
              }}
              placeholder="Ví dụ: Cần tìm cách giúp khách hàng dễ tìm và lựa chọn sản phẩm trên website."
              value={aiBrief}
            />
            <div
              className="flex flex-col gap-1 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-start sm:justify-between"
              id={aiBriefHelpId}
            >
              <span>
                Nêu bối cảnh, vấn đề đang gặp và kết quả mong muốn. Gợi ý sẽ
                hiển thị riêng để bạn xem và chọn áp dụng từng trường.
              </span>
              <span
                aria-label={`${aiBrief.length} trên 4000 ký tự`}
                className="shrink-0 tabular-nums"
              >
                {aiBrief.length}/4000
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              className="w-full motion-reduce:transition-none sm:w-auto"
              disabled={aiPending || !aiBrief.trim()}
              onClick={handleAiDraft}
              type="button"
            >
              {aiPending ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  />
                  Đang tạo đề xuất...
                </>
              ) : (
                <>
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  Tạo đề xuất
                </>
              )}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              AI chỉ hỗ trợ soạn thảo, không tự lưu hoặc gửi duyệt bài toán.
            </p>
          </div>

          {aiPending && (
            <p
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              />
              Đang tạo nội dung đề xuất...
            </p>
          )}
          {aiSuggestion && (
            <section
              aria-labelledby={aiSuggestionId}
              className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold" id={aiSuggestionId}>
                    Nội dung gợi ý
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Xem từng phần bên dưới. Chỉ trường bạn chọn mới được thay đổi;
                    các phần còn lại và dữ liệu hiện có sẽ được giữ nguyên.
                  </p>
                </div>
                <Button
                  className="w-full shrink-0 motion-reduce:transition-none sm:w-auto"
                  onClick={discardAiSuggestion}
                  type="button"
                  variant="outline"
                >
                  {Object.values(aiAppliedFields).some(Boolean)
                    ? "Đóng phần gợi ý"
                    : "Bỏ qua toàn bộ gợi ý"}
                </Button>
              </div>

              <div className="space-y-3">
                {aiDraftFields.map(({ key, label, applyLabel }) => (
                  <article
                    className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4"
                    key={key}
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold">{label}</h4>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
                        {aiSuggestion[key]}
                      </p>
                    </div>
                    <Button
                      className="min-h-11 w-full motion-reduce:transition-none sm:w-auto"
                      disabled={aiAppliedFields[key] || aiPending}
                      onClick={() => applyAiSuggestion(key)}
                      type="button"
                      variant="outline"
                    >
                      {aiAppliedFields[key] ? "Đã áp dụng" : applyLabel}
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}
          {aiFeedback && (
            <p
              aria-live={aiFeedback.kind === "success" ? "polite" : "assertive"}
              className={`rounded-xl border px-3 py-2 text-sm ${
                aiFeedback.kind === "success"
                  ? "border-success/20 bg-success/5 text-foreground"
                  : aiFeedback.kind === "quota" ||
                      aiFeedback.kind === "unavailable" ||
                      aiFeedback.kind === "validation"
                    ? "border-warning/40 bg-warning/10 text-foreground"
                    : "border-destructive/20 bg-destructive/5 text-destructive"
              }`}
              role={aiFeedback.kind === "success" ? "status" : "alert"}
            >
              {aiFeedback.message}
            </p>
          )}
        </section>
      </Card>

      <Card>
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Ngân sách tham khảo</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Tùy chọn · Đơn vị Việt Nam đồng (VNĐ)
            </p>
          </div>
          <fieldset>
            <legend className="sr-only">Ngân sách tham khảo (VNĐ)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Tối thiểu</span>
                <Input
                  className={fieldClass}
                  defaultValue={problem?.budgetMin ?? ""}
                  min={0}
                  name="budgetMin"
                  placeholder="Ví dụ: 5000000"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Tối đa</span>
                <Input
                  className={fieldClass}
                  defaultValue={problem?.budgetMax ?? ""}
                  min={0}
                  name="budgetMax"
                  placeholder="Ví dụ: 15000000"
                  type="number"
                />
              </label>
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <section
          aria-labelledby="problem-attachments-title"
          className="space-y-5 p-5 sm:p-6"
        >
          <div>
            <h2 className="text-lg font-semibold" id="problem-attachments-title">
              Tài liệu đính kèm
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Cung cấp tài liệu hỗ trợ sinh viên hiểu rõ hơn về bài toán.
            </p>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Tệp đã lưu</h3>
              <ul aria-label="Danh sách tệp đã lưu" className="space-y-3">
                {attachments.map((attachment) => {
                  const isMarkedForDeletion = deletedIds.includes(attachment.id);
                  const extension = attachment.originalName.split(".").pop();
                  return (
                    <li
                      className={`flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 sm:px-4 ${
                        isMarkedForDeletion
                          ? "border-warning/40 bg-warning/5"
                          : "border-border bg-background"
                      }`}
                      key={attachment.id}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-0.5 shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">
                          <span aria-hidden="true" className="text-sm font-semibold">
                            {extension?.slice(0, 4).toUpperCase() ?? "TỆP"}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <Link
                            className="block break-all text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            href={`/api/business/attachments/${attachment.id}`}
                            target="_blank"
                          >
                            {attachment.originalName}
                          </Link>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatSize(attachment.sizeBytes)}</span>
                            {extension && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{extension.toUpperCase()}</span>
                              </>
                            )}
                          </span>
                          {isMarkedForDeletion && (
                            <span className="mt-2 block text-xs text-foreground">
                              Chưa xóa khỏi bài toán; thay đổi chỉ được áp dụng khi lưu.
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
                        {isMarkedForDeletion ? (
                          <Badge
                            className="motion-reduce:transition-none"
                            variant="warning"
                          >
                            Đã đánh dấu gỡ
                          </Badge>
                        ) : (
                          <>
                            <Badge
                              className="motion-reduce:transition-none"
                              variant="secondary"
                            >
                              Đã lưu
                            </Badge>
                            <button
                              aria-label={`Gỡ tệp ${attachment.originalName}`}
                              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                              onClick={() =>
                                setDeletedIds((current) => [...current, attachment.id])
                              }
                              type="button"
                            >
                              Gỡ tệp
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {deletedIds.length > 0 && (
            <p
              className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
              role="status"
            >
              Tệp được đánh dấu gỡ chỉ bị xóa khỏi bài toán sau khi lưu thay đổi.
            </p>
          )}

          <FilePicker
            existingBytes={visibleAttachments.reduce(
              (total, attachment) => total + attachment.sizeBytes,
              0,
            )}
            existingCount={visibleAttachments.length}
            label="Tài liệu mới"
            limits={{
              count: MAX_ATTACHMENT_COUNT,
              fileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
              totalBytes: MAX_ATTACHMENT_TOTAL_BYTES,
            }}
            name="attachments"
            scope={{
              kind: "business-problem",
              ...(problem ? { problemId: problem.id } : {}),
            }}
            resetSignal={uploadResetSignal}
            onFilesChange={() => {
              setClientError(null);
              setState({ error: null });
            }}
            onUploadStateChange={setIsUploading}
            presentation="business-problem"
          />

          {clientError && (
            <p
              className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {clientError}
            </p>
          )}
        </section>
      </Card>

      {state.error && (
        <p
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
          {state.actionHref && (
            <>
              {" "}
              <Link className="font-semibold underline" href="/business/credits">
                Mua thêm lượt
              </Link>
              {" · "}
              <Link className="font-semibold underline" href={state.actionHref}>
                Mở bản nháp
              </Link>
            </>
          )}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <Link
          className={`${buttonVariants({ variant: "outline" })}
            w-full motion-reduce:transition-none sm:w-auto`}
          href={problem ? `/business/problems/${problem.id}` : "/business/problems"}
        >
          Hủy
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="w-full motion-reduce:transition-none sm:w-auto"
            disabled={isPending || isUploading}
            name="intent"
            variant="outline"
            type="submit"
            value="draft"
          >
            {isPending ? "Đang lưu..." : "Lưu nháp"}
          </Button>
          <Button
            className="w-full motion-reduce:transition-none sm:w-auto"
            disabled={isPending}
            name="intent"
            variant="default"
            type="submit"
            value="submit"
          >
            {isPending ? "Đang gửi..." : "Gửi duyệt"}
          </Button>
        </div>
      </div>
    </form>
  );
}
