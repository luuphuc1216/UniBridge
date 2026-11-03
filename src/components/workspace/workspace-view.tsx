"use client";

import {
  useActionState,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  evaluateProposalAction,
  evaluatePrototypeAction,
  decidePrototypeImplementationAction,
  closePrototypeWithoutSubmissionAction,
  createTrialBriefAction,
  sendWorkspaceMessageAction,
  respondToTrialBriefAction,
  submitProposalAction,
  type PrototypeDecisionActionState,
  type WorkspaceActionState,
} from "@/app/workspace/actions";
import {
  MAX_PROPOSAL_FILE_COUNT,
  MAX_PROPOSAL_FILE_SIZE_BYTES,
  MAX_PROPOSAL_FILE_TOTAL_BYTES,
} from "@/lib/business-attachments/config";
import { validateSelectedAttachments } from "@/lib/business-attachments/client-validation";
import {
  evaluationScoreLabels,
  proposalEvaluationFields,
  proposalTypeOptions,
} from "@/lib/workspace";
import { FilePicker } from "@/components/uploads/file-picker";
import { ReportContentButton } from "@/components/reports/report-content-button";
import { canOpenPaidImplementationAgreement } from "@/lib/agreement-access";
import { getPrototypeProblemStatusLabel } from "@/lib/prototype-status";
import type { WorkspacePrototypeOverdueStatus } from "@/lib/prototype-reminders";

type WorkspaceFile = {
  id: string;
  originalName: string;
  sizeBytes: number;
};

type Evaluation = {
  problemResponse: number;
  feasibility: number;
  goalAlignment: number;
  practicalImplementation: number;
  estimatedCost: number;
  implementationTime: number;
  valueDelivered: number;
  comment: string;
  decision: string;
  createdAt: Date;
};

type SubmissionAttempt = {
  id: string;
  attempt: number;
  description: string;
  submittedAt: Date;
  files: WorkspaceFile[];
  handoffReviews: {
    id: string;
    result: string;
    note: string;
    missingItems: string | null;
    createdAt: Date;
  }[];
};

type Proposal = {
  id: string;
  version: number;
  type: string;
  description: string;
  status: string;
  submissionStatus: string;
  handoffStatus: string;
  submittedAt: Date;
  files: WorkspaceFile[];
  evaluations: Evaluation[];
  submissionAttempts: SubmissionAttempt[];
};

export type WorkspaceViewData = {
  problem: {
    id: string;
    title: string;
    status: string;
    description: string;
    goal: string;
    companyName: string;
    teamName: string;
    applicationId: string;
    trialBriefLockedAt: Date | null;
    prototypeLegacy: boolean;
    evaluationResult: string | null;
    implementationDecision: string | null;
    prototypeRevisionRequestCount: number;
    canRespondToTrialBrief: boolean;
    overdue: WorkspacePrototypeOverdueStatus;
  };
  trialBriefVersions: {
    id: string;
    version: number;
    objective: string;
    scope: string;
    deliverables: string;
    deadline: Date;
    evaluationCriteria: string;
    maxRevisionRequests: number;
    businessProvidedData: string | null;
    confidentialityTerms: string;
    ownershipTerms: string;
    compensationTerms: string | null;
    createdAt: Date;
    lockedAt: Date | null;
    responses: {
      party: string;
      decision: string;
      note: string | null;
      respondedBy: { name: string };
    }[];
  }[];
  messages: {
    id: string;
    content: string;
    createdAt: Date;
    sender: { id: string; name: string; role: string };
  }[];
  proposals: Proposal[];
  project: { id: string; status: string } | null;
  isBusiness: boolean;
};

const statusLabels: Record<string, string> = {
  TEAM_SELECTED: "Đã chọn nhóm",
  PROTOTYPING: "Đang xây dựng Prototype / Solution Proposal",
  EVALUATING: "Doanh nghiệp đang đánh giá",
  CLOSED: "Đã kết thúc – không triển khai",
  READY_FOR_IMPLEMENTATION: "Sẵn sàng sang Paid Implementation",
  COMPLETED: "Đã hoàn thành",
  SUBMITTED: "Đã nộp",
  CHANGES_REQUESTED: "Được yêu cầu chỉnh sửa",
  NOT_IMPLEMENTED: "Không triển khai",
  ACCEPTED: "Được chấp nhận",
  REVISION_REQUESTED: "Doanh nghiệp yêu cầu chỉnh sửa Prototype",
  STOPPED: "Doanh nghiệp không tiếp tục Prototype",
  PENDING_REVIEW: "Đang chờ Admin kiểm tra bàn giao",
  APPROVED: "Đã qua kiểm tra bàn giao",
  RETURNED: "Cần bổ sung bàn giao",
};

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getEvaluationScores(evaluation: Evaluation) {
  return proposalEvaluationFields.map(([field, label, description]) => ({
    label,
    description,
    score: evaluation[field],
  }));
}

function formatEvaluationScore(score: number) {
  return `${score}/5 — ${evaluationScoreLabels[score] ?? "Chưa rõ"}`;
}

function ActionFeedback({ state }: { state: WorkspaceActionState }) {
  if (state.error === null) {
    return null;
  }
  return (
    <p
      className={`mt-3 rounded-lg p-3 text-sm ${
        state.error
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-100 text-emerald-800"
      }`}
      role={state.error ? "alert" : "status"}
    >
      {state.error}
    </p>
  );
}

function TrialBriefForm({ problemId }: { problemId: string }) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    createTrialBriefAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input name="problemId" type="hidden" value={problemId} />
      {[
        ["objective", "Mục tiêu"],
        ["scope", "Phạm vi"],
        ["deliverables", "Sản phẩm đầu ra"],
        ["evaluationCriteria", "Tiêu chí đánh giá"],
        ["confidentialityTerms", "Yêu cầu bảo mật"],
        ["ownershipTerms", "Quyền sở hữu/sử dụng"],
      ].map(([name, label]) => (
        <label className="text-sm font-medium" key={name}>
          {label}
          <textarea className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background p-3" name={name} required />
        </label>
      ))}
      <label className="text-sm font-medium">
        Thời hạn
        <input className="mt-1.5 w-full rounded-xl border border-border bg-background p-3" name="deadline" required type="datetime-local" />
      </label>
      <label className="text-sm font-medium">
        Số lần chỉnh sửa tối đa
        <input className="mt-1.5 w-full rounded-xl border border-border bg-background p-3" defaultValue="1" min="0" name="maxRevisionRequests" required type="number" />
      </label>
      <label className="text-sm font-medium">
        Dữ liệu doanh nghiệp cung cấp (không bắt buộc)
        <textarea className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background p-3" name="businessProvidedData" />
      </label>
      <label className="text-sm font-medium">
        Thù lao thử nghiệm (chỉ thông tin, không tạo giao dịch)
        <textarea className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background p-3" name="compensationTerms" />
      </label>
      <div className="sm:col-span-2">
        <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Đang gửi..." : "Gửi phiên bản hồ sơ mới"}
        </button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function TrialBriefResponseForm({ problemId, version }: { problemId: string; version: number }) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    respondToTrialBriefAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="version" type="hidden" value={version} />
      <textarea className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm" name="note" placeholder="Ghi chú khi đề nghị điều chỉnh (bắt buộc với lựa chọn này)" />
      <p className="mt-1 text-xs text-muted-foreground">
        Ghi rõ nội dung cần điều chỉnh để gửi đề nghị.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} name="decision" value="CONFIRMED" type="submit">
          Đồng ý phiên bản {version}
        </button>
        <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-60" disabled={pending} name="decision" value="REVISION_REQUESTED" type="submit">
          Đề nghị điều chỉnh
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

function TrialBriefPanel({
  problemId,
  versions,
  isBusiness,
  lockedAt,
  status,
  canRespondToTrialBrief,
}: {
  problemId: string;
  versions: WorkspaceViewData["trialBriefVersions"];
  isBusiness: boolean;
  lockedAt: Date | null;
  status: string;
  canRespondToTrialBrief: boolean;
}) {
  if (status !== "TEAM_SELECTED" && !versions.length) return null;
  const latest = versions[0];
  return (
    <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <h2 className="font-semibold">Hồ sơ dự án thử nghiệm</h2>
      {lockedAt ? (
        <p className="mt-2 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">
          Hồ sơ đã được hai bên xác nhận và khóa. Bài toán đang trong giai đoạn Prototype.
        </p>
      ) : latest ? (
        <>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <p><strong>Phiên bản:</strong> {latest.version}</p>
            <p><strong>Thời hạn:</strong> {dateLabel(latest.deadline)}</p>
            <p><strong>Mục tiêu:</strong> {latest.objective}</p>
            <p><strong>Phạm vi:</strong> {latest.scope}</p>
            <p><strong>Sản phẩm đầu ra:</strong> {latest.deliverables}</p>
            <p><strong>Tiêu chí:</strong> {latest.evaluationCriteria}</p>
            <p><strong>Số lần chỉnh sửa tối đa:</strong> {latest.maxRevisionRequests}</p>
            <p><strong>Bảo mật:</strong> {latest.confidentialityTerms}</p>
            <p><strong>Quyền sở hữu/sử dụng:</strong> {latest.ownershipTerms}</p>
            <p><strong>Thù lao:</strong> {latest.compensationTerms || "Không có thông tin"}</p>
          </div>
          {!isBusiness && canRespondToTrialBrief && (
            <TrialBriefResponseForm
              problemId={problemId}
              version={latest.version}
            />
          )}
          {!isBusiness && !canRespondToTrialBrief && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Chỉ chủ nhóm mới được xác nhận hoặc đề nghị điều chỉnh hồ sơ thử nghiệm.
            </p>
          )}
          {isBusiness && (
            <p className="mt-3 text-sm text-muted-foreground">
              Đang chờ nhóm phản hồi phiên bản này.
            </p>
          )}
        </>
      ) : isBusiness ? (
        <TrialBriefForm problemId={problemId} />
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Doanh nghiệp chưa gửi hồ sơ thử nghiệm.</p>
      )}
      {isBusiness && latest && !lockedAt && (
        <TrialBriefForm problemId={problemId} />
      )}
      <div className="mt-5 border-t border-primary/20 pt-4">
        <h3 className="text-sm font-semibold">Lịch sử phiên bản</h3>
        <ol className="mt-2 space-y-2 text-sm">
          {versions.map((version) => (
            <li className="rounded-lg bg-background/70 p-3" key={version.id}>
              Phiên bản {version.version} · tạo ngày {dateLabel(version.createdAt)} ·{" "}
              {version.lockedAt ? "Đã khóa" : "Đang chờ xác nhận"}
              {version.responses.map((response) => (
                <span className="ml-2 text-muted-foreground" key={`${version.id}-${response.party}`}>
                  {response.party === "BUSINESS" ? "Doanh nghiệp" : "Nhóm"}:{" "}
                  {response.decision === "CONFIRMED" ? "Đã xác nhận" : `Đề nghị điều chỉnh${response.note ? ` — ${response.note}` : ""}`}
                </span>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MessageForm({
  problemId,
  applicationId,
}: {
  problemId: string;
  applicationId: string;
}) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    sendWorkspaceMessageAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      <label className="sr-only" htmlFor="workspace-message">Tin nhắn mới</label>
      <textarea
        className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"
        id="workspace-message"
        maxLength={4000}
        name="content"
        placeholder="Trao đổi yêu cầu, phạm vi, hướng tiếp cận hoặc nguồn lực..."
        required
      />
      <div className="mt-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">Tối đa 4.000 ký tự</p>
        <button
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Đang gửi..." : "Gửi tin nhắn"}
        </button>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

function ProposalForm({
  problemId,
  applicationId,
  returnedProposal,
}: {
  problemId: string;
  applicationId: string;
  returnedProposal?: Proposal;
}) {
  const [pending, startPendingTransition] = useTransition();
  const [fileError, setFileError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFileError(null);

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("files");
    const files =
      fileInput instanceof HTMLInputElement && fileInput.files
        ? Array.from(fileInput.files).filter((file) => file.name !== "")
        : [];
    const validationError = validateSelectedAttachments(files, 0, 0, {
      count: MAX_PROPOSAL_FILE_COUNT,
      fileSizeBytes: MAX_PROPOSAL_FILE_SIZE_BYTES,
      totalBytes: MAX_PROPOSAL_FILE_TOTAL_BYTES,
    });
    if (validationError) {
      setFileError(validationError);
      return;
    }

    const formData = new FormData(form);
    startPendingTransition(() => {
      void submitProposalAction({ error: null }, formData)
        .then((result) => setFileError(result.error))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "";
          setFileError(
            /unexpected end of form/i.test(message)
              ? "Tệp quá lớn hoặc quá nhiều tệp, vui lòng kiểm tra lại"
              : "Không thể nộp Proposal lúc này. Vui lòng kiểm tra tệp và thử lại.",
          );
        });
    });
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      {returnedProposal && (
        <>
          <input name="proposalId" type="hidden" value={returnedProposal.id} />
          <label className="flex items-start gap-2 text-sm">
            <input className="mt-1" name="newVersion" type="checkbox" value="true" />
            <span>Nộp thành phiên bản mới thay vì nộp lại phiên bản {returnedProposal.version}</span>
          </label>
        </>
      )}
      <label className="block text-sm font-medium">
        Loại kết quả
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          defaultValue={returnedProposal?.type ?? ""}
          name="type"
          required
        >
          <option value="">Chọn loại Prototype / Proposal</option>
          {proposalTypeOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Mô tả
        <textarea
          className="mt-1.5 min-h-32 w-full rounded-xl border border-border bg-background p-3"
          maxLength={10000}
          name="description"
          required
        />
      </label>
      <FilePicker
        label="Tệp đính kèm"
        limits={{
          count: MAX_PROPOSAL_FILE_COUNT,
          fileSizeBytes: MAX_PROPOSAL_FILE_SIZE_BYTES,
          totalBytes: MAX_PROPOSAL_FILE_TOTAL_BYTES,
        }}
        name="files"
        onFilesChange={() => setFileError(null)}
      />
      {fileError && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {fileError}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang nộp..." : "Nộp để đánh giá"}
      </button>
    </form>
  );
}

function EvaluationForm({
  problemId,
  proposalId,
}: {
  problemId: string;
  proposalId: string;
}) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    evaluateProposalAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-5 space-y-4 border-t border-border pt-5">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="proposalId" type="hidden" value={proposalId} />
      <h4 className="font-semibold">Đánh giá theo thang điểm 1–5</h4>
      <p className="text-sm text-muted-foreground">
        1 = rất chưa đạt, 3 = chấp nhận được, 5 = rất tốt/đáp ứng hoàn toàn
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {proposalEvaluationFields.map(([name, label, description]) => (
          <label className="text-sm font-medium" key={name}>
            {label}
            <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
              {description}
            </span>
            <select
              className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2"
              name={name}
              required
            >
              <option value="">Chọn điểm</option>
              {[1, 2, 3, 4, 5].map((score) => (
                <option key={score} value={score}>
                  {score} - {evaluationScoreLabels[score]}
                  {score === 5 && "/đáp ứng hoàn toàn"}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="block text-sm font-medium">
        Nhận xét
        <textarea
          className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3"
          maxLength={4000}
          name="comment"
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Quyết định
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          name="decision"
          required
        >
          <option value="CHANGES_REQUESTED">Yêu cầu chỉnh sửa</option>
          <option value="CLOSED">Không triển khai</option>
          <option value="READY_FOR_IMPLEMENTATION">Sẵn sàng sang Paid Implementation</option>
        </select>
      </label>
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang lưu đánh giá..." : "Gửi quyết định"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function PrototypeEvaluationForm({
  problemId,
  applicationId,
  proposalId,
  revisionCount,
  maxRevisionRequests,
}: {
  problemId: string;
  applicationId: string;
  proposalId: string;
  revisionCount: number;
  maxRevisionRequests: number;
}) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    evaluatePrototypeAction,
    { error: null },
  );
  const canRequestRevision = revisionCount < maxRevisionRequests;
  return (
    <form action={action} className="mt-5 space-y-4 border-t border-border pt-5">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      <input name="proposalId" type="hidden" value={proposalId} />
      <h4 className="font-semibold">Đánh giá Prototype theo thang điểm 1–5</h4>
      <p className="text-sm text-muted-foreground">
        Bắt buộc chấm đủ 7 tiêu chí và ghi nhận xét cho mọi kết quả.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {proposalEvaluationFields.map(([name, label, description]) => (
          <label className="text-sm font-medium" key={name}>
            {label}
            <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
              {description}
            </span>
            <select
              className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2"
              name={name}
              required
            >
              <option value="">Chọn điểm</option>
              {[1, 2, 3, 4, 5].map((score) => (
                <option key={score} value={score}>
                  {score} - {evaluationScoreLabels[score]}
                  {score === 5 && "/đáp ứng hoàn toàn"}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="block text-sm font-medium">
        Nhận xét{ " " }{`(bắt buộc${canRequestRevision ? "; ghi rõ nội dung cần chỉnh sửa nếu chọn yêu cầu chỉnh sửa" : ""})`}
        <textarea
          className="mt-1.5 min-h-24 w-full rounded-xl border border-border bg-background p-3"
          maxLength={4000}
          name="comment"
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Kết quả
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          name="decision"
          required
        >
          <option value="ACCEPTED">Chấp nhận Prototype</option>
          {canRequestRevision && (
            <option value="REVISION_REQUESTED">Yêu cầu chỉnh sửa</option>
          )}
          <option value="STOPPED">Không tiếp tục</option>
        </select>
      </label>
      {!canRequestRevision && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Đã dùng hết {maxRevisionRequests} lần chỉnh sửa theo hồ sơ đã khóa. Chỉ còn Chấp nhận hoặc Không tiếp tục.
        </p>
      )}
      <button
        className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang lưu đánh giá..." : "Gửi đánh giá"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function ImplementationDecisionForm({
  problemId,
  applicationId,
}: {
  problemId: string;
  applicationId: string;
}) {
  const [state, action, pending] = useActionState<PrototypeDecisionActionState, FormData>(
    decidePrototypeImplementationAction,
    { error: null, completed: 0 },
  );
  return (
    <ImplementationDecisionFields
      action={action}
      applicationId={applicationId}
      key={state.completed}
      pending={pending}
      problemId={problemId}
      state={state}
    />
  );
}

function ImplementationDecisionFields({
  action,
  applicationId,
  pending,
  problemId,
  state,
}: {
  action: (formData: FormData) => void;
  applicationId: string;
  pending: boolean;
  problemId: string;
  state: PrototypeDecisionActionState;
}) {
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      action={action}
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        if (!window.confirm("Quyết định này không thể thay đổi sau khi lưu. Bạn có muốn tiếp tục không?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      <label className="block text-sm font-medium">
        Quyết định sau khi chấp nhận Prototype
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
          name="decision"
          onChange={(event) => setDecision(event.target.value)}
          required
          value={decision}
        >
          <option disabled value="">Chọn quyết định...</option>
          <option value="IMPLEMENT">Tạo thỏa thuận triển khai</option>
          <option value="ENDED">Kết thúc</option>
        </select>
      </label>
      {decision === "ENDED" && (
        <label className="block text-sm font-medium">
          Lý do kết thúc (bắt buộc)
          <textarea
            className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background p-3"
            maxLength={4000}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </label>
      )}
      <button
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        disabled={pending || !decision}
        type="submit"
      >
        {pending ? "Đang lưu..." : "Lưu quyết định"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

function ClosePrototypeForm({
  problemId,
  applicationId,
}: {
  problemId: string;
  applicationId: string;
}) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    closePrototypeWithoutSubmissionAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-4 border-t border-border pt-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      <label className="block text-sm font-medium">
        Kết thúc thử nghiệm khi nhóm chưa có lần nộp đang chờ kiểm tra
        <textarea
          className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background p-3"
          maxLength={4000}
          name="reason"
          placeholder="Lý do kết thúc (bắt buộc)"
          required
        />
      </label>
      <button
        className="mt-3 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang lưu..." : "Kết thúc thử nghiệm"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function WorkspaceView({ data }: { data: WorkspaceViewData }) {
  const { problem, messages, proposals, isBusiness } = data;
  const readonly = ["CLOSED", "READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(problem.status);
  const latestProposal = proposals[0];
  const maxRevisionRequests =
    data.trialBriefVersions.find((version) => version.lockedAt !== null)
      ?.maxRevisionRequests ?? 0;
  const revisionResubmissionAvailable =
    !problem.prototypeLegacy &&
    problem.evaluationResult === "REVISION_REQUESTED" &&
    latestProposal?.handoffStatus === "APPROVED";
  const returnedProposal =
    !problem.prototypeLegacy &&
    (latestProposal?.handoffStatus === "RETURNED" || revisionResubmissionAvailable)
      ? latestProposal
      : undefined;
  const handoffPending = proposals.some(
    (proposal) => proposal.handoffStatus === "PENDING_REVIEW",
  );
  const handoffApproved = proposals.some(
    (proposal) => proposal.handoffStatus === "APPROVED",
  );
  const canCreateAgreement = isBusiness && canOpenPaidImplementationAgreement(problem);
  const overdueLabels = [
    ["submission", "Nộp Proposal quá hạn"],
    ["evaluation", "Doanh nghiệp đánh giá quá hạn"],
    ["implementationDecision", "Quyết định triển khai quá hạn"],
  ] as const;
  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold text-primary">Không gian làm việc chung</p>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{problem.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {problem.companyName} · Nhóm {problem.teamName}
          </p>
        </div>
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          {getPrototypeProblemStatusLabel(problem)}
        </span>
      </div>
      {overdueLabels
        .filter(([kind]) => data.problem.overdue[kind])
        .map(([, label]) => (
          <p
            className="mt-3 w-fit rounded-full bg-rose-100 px-3 py-1.5 text-sm font-semibold text-rose-800"
            key={label}
          >
            Quá hạn · {label}
          </p>
        ))}
      {problem.prototypeLegacy && (
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Dữ liệu trước thay đổi
        </p>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Vấn đề</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{problem.description}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Mục tiêu</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{problem.goal}</p>
        </article>
      </section>

      {readonly ? (
        <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Quy trình Prototype / Solution Proposal đã kết thúc. Không thể gửi thêm tin nhắn hoặc Proposal tại đây;
          lịch sử vẫn được xem. Thỏa thuận và Milestone được quản lý trong trang dự án.
        </p>
      ) : null}
      {!readonly && (
        <TrialBriefPanel
          isBusiness={isBusiness}
          lockedAt={problem.trialBriefLockedAt}
          problemId={problem.id}
          status={problem.status}
          versions={data.trialBriefVersions}
          canRespondToTrialBrief={problem.canRespondToTrialBrief}
        />
      )}
      {isBusiness &&
        !problem.prototypeLegacy &&
        problem.status === "EVALUATING" &&
        problem.evaluationResult === "ACCEPTED" &&
        problem.implementationDecision === "PENDING" && (
          <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-emerald-950">
              Prototype đã được chấp nhận
            </h2>
            <p className="mt-1 text-sm text-emerald-900">
              Chọn riêng việc tạo thỏa thuận triển khai hoặc kết thúc. Chấp nhận Prototype chưa tạo dự án hay giao dịch.
            </p>
            <ImplementationDecisionForm
              applicationId={problem.applicationId}
              problemId={problem.id}
            />
          </section>
        )}

      {["READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(problem.status) && (
        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-950">
            {problem.status === "COMPLETED" ? "Paid Implementation đã hoàn tất" : "Sẵn sàng sang Paid Implementation"}
          </h2>
          <p className="mt-1 text-sm text-emerald-900">
            Thỏa thuận, thanh toán giả lập và tiến độ theo Milestone được quản lý riêng trong trang dự án.
          </p>
          {data.project ? (
            <Link
              className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              href={`${isBusiness ? "/business" : "/student"}/projects/${data.project.id}`}
            >
              Mở dự án
            </Link>
          ) : canCreateAgreement ? (
            <Link
              className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              href={`/business/problems/${problem.id}/agreement`}
            >
              Soạn thỏa thuận dự án
            </Link>
          ) : (
            <p className="mt-3 text-sm text-emerald-900">
              Doanh nghiệp đang chuẩn bị thỏa thuận. Nhóm sẽ nhận thông báo khi có đề nghị.
            </p>
          )}
        </section>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Trao đổi giữa hai bên</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Làm rõ yêu cầu, phạm vi, hướng tiếp cận và nguồn lực cần thiết.
          </p>
          <ol aria-label="Lịch sử trao đổi" className="mt-5 max-h-[36rem] space-y-3 overflow-y-auto">
            {messages.length ? messages.map((message) => (
              <li className="rounded-xl bg-muted/60 p-3" key={message.id}>
                <div className="flex flex-wrap justify-between gap-1 text-xs">
                  <span className="font-semibold">
                    {message.sender.name} · {message.sender.role === "BUSINESS" ? "Doanh nghiệp" : "Sinh viên"}
                  </span>
                  <time dateTime={message.createdAt.toISOString()}>{dateLabel(message.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                <ReportContentButton targetType="MESSAGE" targetId={message.id} />
              </li>
            )) : (
              <li className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Chưa có trao đổi. Hai bên có thể bắt đầu làm rõ yêu cầu tại đây.
              </li>
            )}
          </ol>
          {!readonly && (
            <MessageForm
              applicationId={problem.applicationId}
              problemId={problem.id}
            />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Prototype / Solution Proposal</h2>
          {proposals.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {isBusiness && !problem.prototypeLegacy && problem.status !== "EVALUATING"
                ? "Chưa có Proposal nào được duyệt bàn giao để doanh nghiệp xem."
                : "Nhóm chưa nộp phiên bản nào. Các phiên bản nộp lại sẽ được lưu thành lịch sử riêng."}
            </p>
          ) : (
            <ol className="mt-4 space-y-4">
              {proposals.map((proposal) => (
                <li className="rounded-xl border border-border p-4" key={proposal.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Phiên bản {proposal.version}</h3>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {statusLabels[proposal.handoffStatus] ?? statusLabels[proposal.status] ?? proposal.status}
                    </span>
                  </div>
                  {(() => {
                    const attempts: SubmissionAttempt[] = proposal.submissionAttempts.length
                      ? proposal.submissionAttempts
                      : [{
                          id: proposal.id,
                          attempt: 1,
                          description: proposal.description,
                          submittedAt: proposal.submittedAt,
                          files: proposal.files,
                          handoffReviews: [],
                        }];
                    return attempts.map((attempt) => (
                      <div className="mt-4 border-t border-border pt-4" key={attempt.id}>
                        <p className="text-xs text-muted-foreground">
                          {proposalTypeOptions.find(([value]) => value === proposal.type)?.[1] ?? proposal.type}
                          {" · "}{problem.prototypeLegacy ? "Nộp " : `Lần nộp ${attempt.attempt} · `}
                          {dateLabel(attempt.submittedAt)}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{attempt.description}</p>
                        {attempt.files.length > 0 && (
                          <ul className="mt-3 space-y-1">
                            {attempt.files.map((file) => (
                              <li key={file.id}>
                                <a
                                  className="break-all text-sm font-medium text-primary hover:underline"
                                  href={`/api/workspace/proposals/${file.id}`}
                                >
                                  {file.originalName}
                                </a>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({(file.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {attempt.handoffReviews.map((review) => (
                          <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm" key={review.id}>
                            <p className="font-semibold">
                              {review.result === "RETURNED" ? "Cần bổ sung bàn giao" : "Đã qua kiểm tra bàn giao"}
                              {" · "}{dateLabel(review.createdAt)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{review.note}</p>
                            {review.missingItems && (
                              <p className="mt-2 whitespace-pre-wrap">
                                Mục cần bổ sung: {review.missingItems.split("\n").join(", ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                  {proposal.evaluations.map((evaluation, index) => (
                    <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm" key={`${proposal.id}-${index}`}>
                      <p className="font-semibold">
                        {statusLabels[evaluation.decision] ?? evaluation.decision}
                        {" · "}{dateLabel(evaluation.createdAt)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap leading-6">{evaluation.comment}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        {getEvaluationScores(evaluation).map(({ label, description, score }) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd className="mt-0.5 text-muted-foreground">{description}</dd>
                            <dd className="mt-1 font-semibold text-foreground">
                              {formatEvaluationScore(score)}
                              {score === 5 && " / đáp ứng hoàn toàn"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                  {isBusiness &&
                    problem.status === "EVALUATING" &&
                    proposal.id === latestProposal?.id &&
                    proposal.status === "SUBMITTED" &&
                    (problem.prototypeLegacy ||
                      (problem.evaluationResult === null &&
                        proposal.handoffStatus === "APPROVED")) &&
                    (problem.prototypeLegacy ? (
                      <EvaluationForm problemId={problem.id} proposalId={proposal.id} />
                    ) : (
                      <PrototypeEvaluationForm
                        applicationId={problem.applicationId}
                        maxRevisionRequests={maxRevisionRequests}
                        problemId={problem.id}
                        proposalId={proposal.id}
                        revisionCount={problem.prototypeRevisionRequestCount}
                      />
                    ))}
                </li>
              ))}
            </ol>
          )}
          {!isBusiness && problem.status === "PROTOTYPING" &&
            (problem.prototypeLegacy ||
              (problem.canRespondToTrialBrief && problem.trialBriefLockedAt !== null)) &&
            (problem.prototypeLegacy ||
              (!handoffPending && (!handoffApproved || revisionResubmissionAvailable))) && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-semibold">
                {returnedProposal ? `Nộp lại phiên bản ${returnedProposal.version}` : "Nộp Proposal"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {problem.prototypeLegacy
                  ? "Sau khi nộp, bài toán chuyển sang trạng thái doanh nghiệp đánh giá."
                  : "Sau khi nộp, Proposal được khóa để Admin kiểm tra bàn giao. Doanh nghiệp chỉ xem được khi Admin duyệt đạt."}
              </p>
              <ProposalForm
                applicationId={problem.applicationId}
                problemId={problem.id}
                returnedProposal={returnedProposal}
              />
            </div>
          )}
          {!isBusiness && problem.status === "PROTOTYPING" && handoffPending && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Đang chờ Admin kiểm tra bàn giao. Không thể chỉnh sửa hoặc nộp lại trong thời gian này.
            </p>
          )}
          {!isBusiness &&
            !problem.prototypeLegacy &&
            problem.status === "PROTOTYPING" &&
            !handoffPending &&
            !handoffApproved &&
            !problem.canRespondToTrialBrief && (
              <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Chỉ chủ nhóm mới có thể nộp Proposal.
              </p>
            )}
          {isBusiness &&
            !problem.prototypeLegacy &&
            problem.status === "PROTOTYPING" &&
            problem.trialBriefLockedAt !== null && (
              <ClosePrototypeForm
                applicationId={problem.applicationId}
                problemId={problem.id}
              />
            )}
          {!isBusiness &&
            !problem.prototypeLegacy &&
            problem.status === "PROTOTYPING" &&
            problem.trialBriefLockedAt === null &&
            !handoffPending && (
              <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Chỉ có thể nộp Proposal sau khi hai bên xác nhận và khóa hồ sơ thử nghiệm.
              </p>
            )}
          {problem.status === "EVALUATING" && !isBusiness && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Đang chờ doanh nghiệp đánh giá. Nếu được yêu cầu chỉnh sửa, bạn có thể nộp phiên bản tiếp theo.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
