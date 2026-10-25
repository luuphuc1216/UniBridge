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
  sendWorkspaceMessageAction,
  startWorkspaceAction,
  submitProposalAction,
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

type Proposal = {
  id: string;
  version: number;
  type: string;
  description: string;
  status: string;
  submittedAt: Date;
  files: WorkspaceFile[];
  evaluations: Evaluation[];
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
  };
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

function StartWorkspaceForm({ problemId }: { problemId: string }) {
  const [state, action, pending] = useActionState<WorkspaceActionState, FormData>(
    startWorkspaceAction,
    { error: null },
  );
  return (
    <form action={action} className="mt-5">
      <input name="problemId" type="hidden" value={problemId} />
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Đang bắt đầu..." : "Bắt đầu làm Prototype / Solution Proposal"}
      </button>
      <ActionFeedback state={state} />
    </form>
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

function ProposalForm({ problemId }: { problemId: string }) {
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
      <label className="block text-sm font-medium">
        Loại kết quả
        <select
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5"
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

export function WorkspaceView({ data }: { data: WorkspaceViewData }) {
  const { problem, messages, proposals, isBusiness } = data;
  const readonly = ["CLOSED", "READY_FOR_IMPLEMENTATION", "COMPLETED"].includes(problem.status);
  const latestProposal = proposals[0];
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
          {statusLabels[problem.status] ?? problem.status}
        </span>
      </div>

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
      ) : problem.status === "TEAM_SELECTED" && !isBusiness ? (
        <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <h2 className="font-semibold">Nhóm đã được chọn</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bắt đầu làm để chuyển bài toán sang giai đoạn Prototype / Solution Proposal.
          </p>
          <StartWorkspaceForm problemId={problem.id} />
        </section>
      ) : null}

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
          ) : isBusiness && problem.status === "READY_FOR_IMPLEMENTATION" ? (
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
              Nhóm chưa nộp phiên bản nào. Các phiên bản nộp lại sẽ được lưu thành lịch sử riêng.
            </p>
          ) : (
            <ol className="mt-4 space-y-4">
              {proposals.map((proposal) => (
                <li className="rounded-xl border border-border p-4" key={proposal.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Phiên bản {proposal.version}</h3>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {statusLabels[proposal.status] ?? proposal.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {proposalTypeOptions.find(([value]) => value === proposal.type)?.[1] ?? proposal.type}
                    {" · Nộp "}{dateLabel(proposal.submittedAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{proposal.description}</p>
                  {proposal.files.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {proposal.files.map((file) => (
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
                  {isBusiness && problem.status === "EVALUATING" &&
                    proposal.id === latestProposal?.id && proposal.status === "SUBMITTED" && (
                      <EvaluationForm problemId={problem.id} proposalId={proposal.id} />
                    )}
                </li>
              ))}
            </ol>
          )}
          {!isBusiness && problem.status === "PROTOTYPING" && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-semibold">Nộp phiên bản mới</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sau khi nộp, doanh nghiệp sẽ nhận thông báo và bài toán chuyển sang trạng thái đánh giá.
              </p>
              <ProposalForm problemId={problem.id} />
            </div>
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
