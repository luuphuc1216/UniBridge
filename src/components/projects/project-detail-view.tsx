import Link from "next/link";
import {
  acceptProjectFinalCompletionAction,
  acceptMilestoneAction,
  cancelProjectAction,
  depositProjectAction,
  requestMilestoneRevisionAction,
  respondAgreementAction,
  updateMilestoneProgressAction,
} from "@/app/projects/actions";
import { AgreementForm, type AgreementFormValues } from "@/components/projects/agreement-form";
import { MilestoneSubmissionForm } from "@/components/projects/milestone-submission-form";
import { ProjectActionForm } from "@/components/projects/project-action-form";
import { ProjectChangeRequestPanel } from "@/components/projects/project-change-request-panel";
import { ProjectReviewSection } from "@/components/projects/project-review-section";
import {
  businessFeeRate,
  legacyPlatformFeeRate,
  studentFeeRate,
} from "@/lib/project-config";
import {
  calculateLegacyProjectFinancialBreakdown,
  calculateProjectFinancialBreakdown,
} from "@/lib/project-money";
import { readAgreementSnapshot, type AgreementSnapshot } from "@/lib/project-agreements";
import { getStoredMilestoneSubmissionLinks } from "@/lib/milestone-submission-validation";
import { getPaidMilestoneOverdueStatus } from "@/lib/project-milestone-workflow";
import { getEffectiveProjectPauseSeconds } from "@/lib/project-change-requests";
import type { findAccessibleProject } from "@/lib/project-access";
import type { ProjectReviewState } from "@/lib/reputation-data";

export type ProjectDetailData = NonNullable<
  Awaited<ReturnType<typeof findAccessibleProject>>
>;

const projectStatusLabels: Record<string, string> = {
  AGREEING: "Đang thỏa thuận",
  AWAITING_PAYMENT: "Chờ nạp tiền",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};
const acceptanceStatusLabels: Record<string, string> = {
  NOT_SUBMITTED: "Chưa nộp",
  AWAITING_ACCEPTANCE: "Chờ nghiệm thu",
  NEEDS_REVISION: "Cần chỉnh sửa",
  ACCEPTED: "Đã nghiệm thu",
  DISPUTED: "Có bất đồng - Chờ xử lý",
  CANCELLED: "Đã hủy",
};

const milestoneStatusLabels: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  PENDING: "Chưa mở",
  IN_PROGRESS: "Đang thực hiện",
  AWAITING_ACCEPTANCE: "Chờ nghiệm thu",
  NEEDS_REVISION: "Cần chỉnh sửa",
  OVERDUE: "Quá hạn",
  AWAITING_RESPONSE_OVERDUE: "Chờ xử lý quá hạn phản hồi",
  SUBMITTED: "Chờ nghiệm thu",
  ACCEPTED: "Đã nghiệm thu",
  REVISION_REQUESTED: "Cần chỉnh sửa",
  PAUSED: "Tạm dừng",
  DISPUTED: "Có bất đồng - Chờ xử lý",
  CANCELLED: "Đã hủy",
};

const paymentStatusLabels: Record<string, string> = {
  UNFUNDED: "Chưa nạp",
  ESCROW: "Đang giữ trong escrow",
  RELEASED: "Đã giải ngân giả lập",
  REFUNDED: "Đã hoàn lại",
};

function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} ₫`;
}

function formatDate(date: Date | null): string {
  if (!date) return "Chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAgreementFormValues(
  project: ProjectDetailData,
  snapshot?: AgreementSnapshot,
): AgreementFormValues {
  return {
    title: snapshot?.title ?? project.title,
    agreedScope: snapshot?.agreedScope ?? project.agreedScope,
    deliverables: snapshot?.deliverables ?? project.deliverables,
    duration: snapshot?.duration ?? project.duration,
    totalAmount: snapshot?.totalAmount ?? project.totalAmount,
    generalAcceptanceCriteria:
      snapshot?.generalAcceptanceCriteria ?? project.generalAcceptanceCriteria,
    businessResponsibilities:
      snapshot?.businessResponsibilities ?? project.businessResponsibilities,
    teamResponsibilities: snapshot?.teamResponsibilities ?? project.teamResponsibilities,
    paymentMethod: snapshot?.paymentMethod ?? project.paymentMethod,
    maxMilestoneRevisions: snapshot?.maxMilestoneRevisions ?? 0,
    ownershipTerms: snapshot?.ownershipTerms ?? "",
    usageTerms: snapshot?.usageTerms ?? "",
    confidentialityTerms: snapshot?.confidentialityTerms ?? "",
    extensionTerms: snapshot?.extensionTerms ?? "",
    suspensionTerms: snapshot?.suspensionTerms ?? "",
    terminationTerms: snapshot?.terminationTerms ?? "",
    disputeTerms: snapshot?.disputeTerms ?? "",
    milestones: snapshot
      ? snapshot.milestones
      : project.milestones.map((milestone) => ({
          title: milestone.title,
          description: milestone.description,
          acceptanceCriteria: milestone.acceptanceCriteria,
          dueAt: milestone.dueAt?.toISOString().slice(0, 10) ?? "",
          paymentPercent: milestone.paymentPercent,
        })),
  };
}

function getPaymentSummary(project: ProjectDetailData) {
  const deposits = project.transactions.filter(
    (transaction) => transaction.type === "DEPOSIT",
  );
  const releases = project.transactions.filter(
    (transaction) => transaction.type === "MILESTONE_RELEASE",
  );
  const refunds = project.transactions.filter(
    (transaction) => transaction.type === "REFUND",
  );
  const deposited = deposits.reduce((sum, transaction) => sum + transaction.amount, 0);
  const paidOut = releases.reduce((sum, transaction) => sum + transaction.amount, 0);
  const refunded = refunds.reduce((sum, transaction) => sum + transaction.amount, 0);
  const collectedBusinessFees = deposits.reduce(
    (sum, transaction) =>
      transaction.businessFeeBasisPoints !== null &&
      transaction.studentFeeBasisPoints !== null
        ? sum + (transaction.businessFee ?? 0)
        : sum,
    0,
  );
  const fees =
    collectedBusinessFees +
    releases.reduce((sum, transaction) => sum + transaction.platformFee, 0);
  return {
    deposited,
    paidOut,
    fees,
    refunded,
    escrow: Math.max(0, deposited - paidOut - fees - refunded),
    deposit: deposits[0],
  };
}

export function ProjectDetailView({
  project,
  role,
  applicationId,
  reviewState,
  canRespondForTeam = false,
}: {
  project: ProjectDetailData;
  role: "BUSINESS" | "STUDENT" | "ADMIN";
  applicationId?: string;
  reviewState: ProjectReviewState | null;
  canRespondForTeam?: boolean;
}) {
  const isBusiness = role === "BUSINESS";
  const isAdmin = role === "ADMIN";
  const latestAgreementVersion = project.agreementVersions[0];
  const latestAgreementRevision = project.changeRequests.find(
    ({ kind }) => kind === "AGREEMENT_REVISION",
  );
  const agreementSnapshot =
    latestAgreementVersion && !project.legacyTermsExempt
      ? readAgreementSnapshot(latestAgreementVersion)
      : undefined;
  const agreementTitle = agreementSnapshot?.title ?? project.title;
  const currentDate = new Date();
  const effectivePauseSeconds = getEffectiveProjectPauseSeconds(
    project.pausedAt,
    project.pausedTotalSeconds,
    currentDate,
  );
  const summary = getPaymentSummary(project);
  const canEditAgreement =
    isBusiness &&
    (project.legacyTermsExempt
      ? ["AGREEING", "AWAITING_PAYMENT"].includes(project.status)
      : project.status === "AGREEING") &&
    project.transactions.every((transaction) => transaction.type !== "DEPOSIT");
  const canCancel = isBusiness && ["AGREEING", "AWAITING_PAYMENT"].includes(project.status);
  const isLegacyDeposit =
    summary.deposit !== undefined &&
    (summary.deposit.businessFeeBasisPoints === null ||
      summary.deposit.studentFeeBasisPoints === null);
  const paymentBreakdown = summary.deposit
    ? isLegacyDeposit
      ? calculateLegacyProjectFinancialBreakdown(
          project.totalAmount,
          project.milestones.map(({ paymentPercent }) => paymentPercent),
          legacyPlatformFeeRate,
        )
      : calculateProjectFinancialBreakdown(
          project.totalAmount,
          project.milestones.map(({ paymentPercent }) => paymentPercent),
          summary.deposit.businessFeeBasisPoints ?? businessFeeRate,
          summary.deposit.studentFeeBasisPoints ?? studentFeeRate,
        )
    : calculateProjectFinancialBreakdown(
        agreementSnapshot?.totalAmount ?? project.totalAmount,
        agreementSnapshot?.milestones.map(({ paymentPercent }) => paymentPercent) ??
          project.milestones.map(({ paymentPercent }) => paymentPercent),
        businessFeeRate,
        studentFeeRate,
      );

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href={isAdmin ? "/admin" : isBusiness ? "/business/projects" : "/student/projects"}
      >
        ← Dự án
      </Link>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold text-primary">
            <Link
              className="hover:underline"
              href={`/businesses/${project.application.problem.businessProfile.id}`}
            >
              {project.application.problem.businessProfile.companyName}
            </Link>
            {" · Nhóm "}
            {project.team.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{agreementTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bài toán: {project.application.problem.title}
          </p>
        </div>
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          {projectStatusLabels[project.status] ?? project.status}
        </span>
      </div>

      <aside
        className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950"
        role="note"
      >
        Thanh toán giả lập, không phát sinh giao dịch thật.
      </aside>

      {(project.status === "AGREEING" || project.status === "AWAITING_PAYMENT") && (
        <section className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-semibold">Tóm tắt tài chính thỏa thuận</h3>
          {isBusiness ? (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              {[
                ["Giá trị dự án", paymentBreakdown.totalAmount],
                [
                  `Phụ phí nền tảng ${(businessFeeRate / 100).toFixed(2)}%`,
                  paymentBreakdown.totalBusinessFee,
                ],
                ["Tổng cần nạp", paymentBreakdown.totalDeposit],
              ].map(([label, amount]) => (
                <div key={String(label)}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold">
                    {formatCurrency(Number(amount))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              {[
                ["Giá trị dự án", paymentBreakdown.totalAmount],
                [
                  `Phí nền tảng ${(studentFeeRate / 100).toFixed(2)}%`,
                  paymentBreakdown.totalStudentFee,
                ],
                ["Nhóm nhận ròng", paymentBreakdown.totalTeamAmount],
              ].map(([label, amount]) => (
                <div key={String(label)}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold">
                    {formatCurrency(Number(amount))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Giá trị dự án", formatCurrency(paymentBreakdown.totalAmount), ""],
          ["Đã nạp vào escrow", formatCurrency(summary.deposited), ""],
          ["Đã giải ngân cho nhóm", formatCurrency(summary.paidOut), ""],
          ["Đã hoàn lại cho doanh nghiệp", formatCurrency(summary.refunded), ""],
          [
            "Tổng phí nền tảng đã ghi nhận",
            formatCurrency(summary.fees),
            "Gồm phụ phí doanh nghiệp 10% ghi nhận lúc nạp và phí nhóm 5% ghi nhận khi giải ngân.",
          ],
        ].map(([label, value, description]) => (
          <article className="rounded-xl border border-border bg-card p-4" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold">{value}</p>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </article>
        ))}
      </section>
      <section className="mt-4 flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row">
        <div>
          <h2 className="font-semibold">Tiền còn trong escrow</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLegacyDeposit
              ? "Áp dụng phí nền tảng theo luồng cũ · Giữ nguyên đến khi dự án hoàn tất."
              : `Phụ phí doanh nghiệp ${(paymentBreakdown.businessFeeBasisPoints ?? 0) / 100}% · Phí nhóm ${(paymentBreakdown.studentFeeBasisPoints ?? 0) / 100}% · Tỷ lệ được chụp tại thời điểm nạp.`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Giá trị các mốc chưa giải ngân.
          </p>
          {summary.refunded > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Đã hoàn lại {formatCurrency(summary.refunded)}; phụ phí doanh nghiệp 10% không hoàn.
            </p>
          )}
        </div>
        <p className="text-xl font-bold">{formatCurrency(summary.escrow)}</p>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Điều khoản thỏa thuận</h2>
            {project.legacyTermsExempt && project.revisionNote && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                Đề nghị chỉnh sửa từ nhóm: {project.revisionNote}
              </p>
            )}
            {!project.legacyTermsExempt && latestAgreementRevision?.status === "OPEN" && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                Đề nghị chỉnh sửa từ nhóm: {latestAgreementRevision.reason}
              </p>
            )}
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["Phạm vi công việc", agreementSnapshot?.agreedScope ?? project.agreedScope],
                ["Sản phẩm đầu ra", agreementSnapshot?.deliverables ?? project.deliverables],
                ["Thời gian thực hiện", agreementSnapshot?.duration ?? project.duration],
                [
                  "Tiêu chí nghiệm thu chung",
                  agreementSnapshot?.generalAcceptanceCriteria ?? project.generalAcceptanceCriteria,
                ],
                [
                  "Trách nhiệm doanh nghiệp",
                  agreementSnapshot?.businessResponsibilities ?? project.businessResponsibilities,
                ],
                [
                  "Trách nhiệm nhóm",
                  agreementSnapshot?.teamResponsibilities ?? project.teamResponsibilities,
                ],
                ["Phương thức thanh toán", agreementSnapshot?.paymentMethod ?? project.paymentMethod],
                ...(agreementSnapshot
                  ? [
                      ["Quyền sở hữu sản phẩm", agreementSnapshot.ownershipTerms],
                      ["Quyền sử dụng sản phẩm", agreementSnapshot.usageTerms],
                      ["Bảo mật", agreementSnapshot.confidentialityTerms],
                      ["Điều kiện gia hạn", agreementSnapshot.extensionTerms],
                      ["Điều kiện tạm dừng", agreementSnapshot.suspensionTerms],
                      ["Điều kiện chấm dứt", agreementSnapshot.terminationTerms],
                      ["Xử lý bất đồng", agreementSnapshot.disputeTerms],
                      [
                        "Số lần chỉnh sửa tối đa mỗi mốc công việc",
                        String(agreementSnapshot.maxMilestoneRevisions),
                      ],
                    ]
                  : []),
              ].map(([label, value]) => (
                <div className="rounded-xl bg-muted/50 p-3" key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{value || "Chưa cập nhật"}</dd>
                </div>
              ))}
            </dl>
            {project.legacyTermsExempt ? (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span>
                  Doanh nghiệp:{" "}
                  <strong>{project.businessAcceptedAt ? "Đã đồng ý" : "Chưa đồng ý"}</strong>
                </span>
                <span>
                  Nhóm: <strong>{project.teamAcceptedAt ? "Đã đồng ý" : "Chưa đồng ý"}</strong>
                </span>
                <span>Phiên bản {project.agreementRevision}</span>
              </div>
            ) : latestAgreementVersion ? (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span>
                  Doanh nghiệp:{" "}
                  <strong>
                    {latestAgreementVersion.businessAcceptedAt ? "Đã xác nhận" : "Chưa xác nhận"}
                  </strong>
                </span>
                <span>
                  Nhóm:{" "}
                  <strong>
                    {latestAgreementVersion.teamAcceptedAt ? "Đã xác nhận" : "Chưa xác nhận"}
                  </strong>
                </span>
                <span>Phiên bản {latestAgreementVersion.versionNumber}</span>
              </div>
            ) : null}

            {project.legacyTermsExempt && project.status === "AGREEING" && !isAdmin && (
              <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                {project.revisionNote ? (
                  <p className="text-sm text-amber-900">
                    Cần cập nhật điều khoản theo đề nghị chỉnh sửa trước khi xác nhận lại.
                  </p>
                ) : (isBusiness ? project.businessAcceptedAt : project.teamAcceptedAt) ? (
                  <p className="text-sm text-emerald-800">
                    Bạn đã đồng ý phiên bản {project.agreementRevision}; đang chờ đối tác.
                  </p>
                ) : (
                  <ProjectActionForm
                    action={respondAgreementAction}
                    buttonLabel="Đồng ý thỏa thuận"
                    hiddenFields={{ projectId: project.id, response: "ACCEPT" }}
                  />
                )}
                {!isBusiness && !isAdmin && (
                  <ProjectActionForm
                    action={respondAgreementAction}
                    buttonClassName="rounded-lg border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-60"
                    buttonLabel="Đề nghị chỉnh sửa"
                    hiddenFields={{ projectId: project.id, response: "REQUEST_CHANGES" }}
                  >
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                      maxLength={4000}
                      name="note"
                      placeholder="Mô tả nội dung cần làm rõ hoặc chỉnh sửa"
                      required
                    />
                  </ProjectActionForm>
                )}
              </div>
            )}
            {!project.legacyTermsExempt &&
              project.status === "AGREEING" &&
              !isAdmin &&
              latestAgreementVersion?.status === "PENDING_TEAM" && (
                <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                  {canRespondForTeam ? (
                    <>
                      <ProjectActionForm
                        action={respondAgreementAction}
                        buttonLabel="Xác nhận phiên bản này"
                        hiddenFields={{
                          projectId: project.id,
                          response: "ACCEPT",
                          versionNumber: String(latestAgreementVersion.versionNumber),
                        }}
                      />
                      <ProjectActionForm
                        action={respondAgreementAction}
                        buttonClassName="rounded-lg border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-60"
                        buttonLabel="Đề nghị chỉnh sửa"
                        hiddenFields={{
                          projectId: project.id,
                          response: "REQUEST_CHANGES",
                          versionNumber: String(latestAgreementVersion.versionNumber),
                        }}
                      >
                        <textarea
                          className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          maxLength={4000}
                          name="note"
                          placeholder="Mô tả nội dung cần làm rõ hoặc chỉnh sửa"
                          required
                        />
                      </ProjectActionForm>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Chỉ chủ nhóm có thể xác nhận hoặc đề nghị chỉnh sửa phiên bản này.
                    </p>
                  )}
                </div>
              )}
          </section>

          {!project.legacyTermsExempt && (
            <ProjectChangeRequestPanel
              canManage={
                !isAdmin &&
                project.status !== "CANCELLED" &&
                project.status !== "COMPLETED" &&
                (isBusiness || canRespondForTeam)
              }
              milestones={project.milestones.map(({ id, title, status }) => ({ id, title, status }))}
              projectId={project.id}
              requests={project.changeRequests}
              role={isBusiness ? "BUSINESS" : "STUDENT"}
            />
          )}

          {canEditAgreement && applicationId && (
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold">
                {project.status === "AWAITING_PAYMENT" ? "Chỉnh sửa thỏa thuận" : "Cập nhật thỏa thuận"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mọi thay đổi sẽ xóa xác nhận cũ; cả hai bên cần đồng ý lại.
              </p>
              <div className="mt-4">
                <AgreementForm
                  applicationId={applicationId}
                  expectedVersionNumber={latestAgreementVersion?.versionNumber ?? 0}
                  initialValues={getAgreementFormValues(project, agreementSnapshot)}
                  problemId={project.application.problem.id}
                  projectId={project.id}
                  termsRequired={!project.legacyTermsExempt}
                />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Mốc công việc và nghiệm thu</h2>
            {!project.legacyTermsExempt && project.pausedAt && (
              <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                Dự án đang tạm dừng. Tiến độ, bàn giao, nghiệm thu và giải ngân đang bị khóa.
              </p>
            )}
            <ol className="mt-4 space-y-4">
              {project.status === "AGREEING" && agreementSnapshot
                ? agreementSnapshot.milestones.map((milestone, index) => {
                    const allocation = paymentBreakdown.milestones[index];
                    return (
                      <li
                        className="rounded-xl border border-border p-4"
                        key={`${latestAgreementVersion?.versionNumber}-${index}`}
                      >
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <div>
                            <p className="text-xs font-semibold text-primary">
                              Mốc công việc {index + 1}
                            </p>
                            <h3 className="mt-1 font-semibold">{milestone.title}</h3>
                          </div>
                          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                            Chờ xác nhận phiên bản
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                          {milestone.description}
                        </p>
                        <p className="mt-3 text-sm">
                          <strong>Tiêu chí nghiệm thu:</strong> {milestone.acceptanceCriteria}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                          <span>Hạn: {formatDate(new Date(`${milestone.dueAt}T12:00:00.000Z`))}</span>
                          <span>Thanh toán: {milestone.paymentPercent}%</span>
                          <span>
                            Giá trị mốc công việc: {formatCurrency(allocation?.grossAmount ?? 0)}
                          </span>
                        </div>
                      </li>
                    );
                  })
                : project.milestones.map((milestone, index) => {
                const allocation = paymentBreakdown.milestones[index];
                  const overdue = project.legacyTermsExempt
                    ? null
                    : getPaidMilestoneOverdueStatus(
                        milestone,
                        currentDate,
                        effectivePauseSeconds,
                      ).status;
                  const currentOpenMilestone = project.legacyTermsExempt
                    ? project.milestones.find(({ status }) =>
                        ["IN_PROGRESS", "SUBMITTED", "REVISION_REQUESTED"].includes(status),
                      )
                    : project.milestones.find(
                        ({ acceptanceStatus, paymentStatus, status }) =>
                          acceptanceStatus !== "ACCEPTED" &&
                          !(status === "CANCELLED" && paymentStatus === "REFUNDED") &&
                          status !== "DISPUTED",
                      );
                  const isCurrent =
                    project.status === "IN_PROGRESS" &&
                    !project.pausedAt &&
                    currentOpenMilestone?.id === milestone.id;
                  const displayStatus =
                    overdue ??
                    (!project.legacyTermsExempt && milestone.status === "PENDING"
                      ? "NOT_STARTED"
                      : milestone.status);
                  const hasMilestoneRelease = project.transactions.some(
                    (transaction) =>
                      transaction.type === "MILESTONE_RELEASE" &&
                      transaction.milestoneId === milestone.id,
                  );
                  const displayPaymentStatus =
                    !project.legacyTermsExempt && hasMilestoneRelease
                      ? "RELEASED"
                      : !project.legacyTermsExempt &&
                          milestone.paymentStatus === "UNFUNDED" &&
                          project.transactions.some(
                            (transaction) =>
                              transaction.type === "DEPOSIT" &&
                              transaction.status === "ESCROW",
                          )
                        ? "ESCROW"
                        : milestone.paymentStatus;
                  return (
                  <li className="rounded-xl border border-border p-4" key={milestone.id}>
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div>
                        <p className="text-xs font-semibold text-primary">Mốc công việc {index + 1}</p>
                        <h3 className="mt-1 font-semibold">{milestone.title}</h3>
                      </div>
                      <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                        {milestoneStatusLabels[displayStatus] ?? displayStatus}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{milestone.description}</p>
                    <p className="mt-3 text-sm">
                      <strong>Tiêu chí nghiệm thu:</strong> {milestone.acceptanceCriteria}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Hạn: {formatDate(
                          !project.legacyTermsExempt && milestone.dueAt
                            ? new Date(milestone.dueAt.getTime() + effectivePauseSeconds * 1000)
                            : milestone.dueAt,
                        )}
                      </span>
                      <span>Thanh toán: {milestone.paymentPercent}%</span>
                      <span>Giá trị mốc công việc: {formatCurrency(allocation?.grossAmount ?? milestone.amount ?? 0)}</span>
                      {isLegacyDeposit ? (
                        <span>Áp dụng phí nền tảng theo luồng cũ: {formatCurrency(allocation?.platformFee ?? 0)}</span>
                      ) : (
                        <>
                          <span>Phụ phí doanh nghiệp: {formatCurrency(allocation?.businessFee ?? 0)}</span>
                          <span>Phí sinh viên: {formatCurrency(allocation?.studentFee ?? 0)}</span>
                        </>
                      )}
                      <span>Nhóm nhận ròng: {formatCurrency(allocation?.teamAmount ?? 0)}</span>
                      {!project.legacyTermsExempt && (
                        <>
                          <span>
                            Tiến độ: {milestone.progressPercent}%
                          </span>
                          <span>
                            Thanh toán: {paymentStatusLabels[displayPaymentStatus] ?? displayPaymentStatus}
                          </span>
                          <span>
                            Chỉnh sửa: {milestone.revisionCount}
                            {agreementSnapshot
                              ? `/${agreementSnapshot.maxMilestoneRevisions}`
                              : ""}
                          </span>
                        </>
                      )}
                    </div>
                    {!project.legacyTermsExempt && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nghiệm thu: {acceptanceStatusLabels[milestone.acceptanceStatus] ?? milestone.acceptanceStatus}
                      </p>
                    )}
                    {milestone.workCompleted && (
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
                        <strong>Công việc đã làm:</strong> {milestone.workCompleted}
                      </p>
                    )}
                    {milestone.difficulties && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
                        <strong>Khó khăn:</strong> {milestone.difficulties}
                      </p>
                    )}
                    {milestone.progressNote && (
                      <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                        <strong>Cập nhật tiến độ:</strong> {milestone.progressNote}
                      </p>
                    )}
                    {milestone.progressUpdates.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-semibold">Lịch sử tiến độ</h4>
                        {milestone.progressUpdates.map((update) => (
                          <article className="rounded-lg bg-muted/50 p-3" key={update.id}>
                            <p className="text-xs text-muted-foreground">
                              {update.createdBy.name} · {formatDateTime(update.createdAt)} ·{" "}
                              {update.progressPercent}%
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">
                              {update.workCompleted}
                            </p>
                            {update.difficulties && (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                Khó khăn: {update.difficulties}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                    {milestone.revisionFeedback && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        <strong>Phản hồi cần chỉnh sửa:</strong> {milestone.revisionFeedback}
                      </p>
                    )}
                    {milestone.submissions.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-semibold">Lịch sử nộp kết quả</h4>
                        {milestone.submissions.map((submission) => (
                          <article className="rounded-lg bg-muted/50 p-3" key={submission.id}>
                            <p className="text-xs text-muted-foreground">
                              {submission.submittedBy.name} · {formatDateTime(submission.createdAt)}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm">{submission.note}</p>
                            {getStoredMilestoneSubmissionLinks(submission.links).length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {getStoredMilestoneSubmissionLinks(submission.links).map((link) => (
                                  <li key={link}>
                                    <a
                                      className="break-all text-sm font-medium text-primary hover:underline"
                                      href={link}
                                      rel="noopener noreferrer"
                                      target="_blank"
                                    >
                                      {link}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {submission.files.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {submission.files.map((file) => (
                                  <li key={file.id}>
                                    <a
                                      className="break-all text-sm font-medium text-primary hover:underline"
                                      href={`/api/projects/files/${file.id}`}
                                    >
                                      Tải {file.originalName}
                                    </a>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      ({(file.sizeBytes / 1024 / 1024).toFixed(2)} MB)
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    )}

                    {isCurrent && !isBusiness && canRespondForTeam &&
                      (project.legacyTermsExempt
                        ? ["IN_PROGRESS", "REVISION_REQUESTED"].includes(milestone.status)
                        : ["PENDING", "NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(milestone.status)) && (
                      <>
                        <ProjectActionForm
                          action={updateMilestoneProgressAction}
                          buttonClassName="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          buttonLabel="Cập nhật tiến độ"
                          hiddenFields={{ projectId: project.id, milestoneId: milestone.id }}
                        >
                          {project.legacyTermsExempt ? (
                            <textarea
                              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                              maxLength={4000}
                              name="progressNote"
                              placeholder="Cập nhật tình hình thực hiện"
                              required
                            />
                          ) : (
                            <>
                              <label className="block text-sm font-medium">
                                Tiến độ (%)
                                <input
                                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5"
                                  max={100}
                                  min={0}
                                  name="progressPercent"
                                  required
                                  type="number"
                                />
                              </label>
                              <label className="block text-sm font-medium">
                                Công việc đã làm
                                <textarea
                                  className="mt-1.5 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                                  maxLength={10_000}
                                  name="workCompleted"
                                  required
                                />
                              </label>
                              <label className="block text-sm font-medium">
                                Khó khăn
                                <textarea
                                  className="mt-1.5 min-h-16 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                                  maxLength={4_000}
                                  name="difficulties"
                                />
                              </label>
                            </>
                          )}
                        </ProjectActionForm>
                        {(project.legacyTermsExempt
                          ? ["IN_PROGRESS", "REVISION_REQUESTED"].includes(milestone.status)
                          : ["IN_PROGRESS", "NEEDS_REVISION"].includes(milestone.status)) && (
                          <MilestoneSubmissionForm milestoneId={milestone.id} />
                        )}
                      </>
                    )}
                    {isCurrent && isBusiness &&
                      (project.legacyTermsExempt
                        ? milestone.status === "SUBMITTED"
                        : milestone.acceptanceStatus === "AWAITING_ACCEPTANCE") && (
                      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                        <ProjectActionForm
                          action={acceptMilestoneAction}
                          buttonLabel="Nghiệm thu và giải ngân"
                          hiddenFields={{ projectId: project.id, milestoneId: milestone.id }}
                        />
                        <ProjectActionForm
                          action={requestMilestoneRevisionAction}
                          buttonClassName="rounded-lg border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-900 disabled:opacity-60"
                          buttonLabel="Yêu cầu chỉnh sửa"
                          hiddenFields={{ projectId: project.id, milestoneId: milestone.id }}
                        >
                          <textarea
                            className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                            maxLength={4000}
                            name="feedback"
                            placeholder="Ghi rõ nội dung cần điều chỉnh trong phạm vi"
                            required
                          />
                        </ProjectActionForm>
                      </div>
                    )}
                  </li>
                );
                  })}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {!project.legacyTermsExempt &&
            project.status !== "CANCELLED" &&
            project.status !== "COMPLETED" &&
            project.finalAcceptanceStatus !== "NOT_REQUESTED" && (
            <section className="rounded-2xl border border-primary/30 bg-card p-5">
              <h2 className="font-semibold">Nghiệm thu cuối cùng</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {project.finalAcceptanceStatus === "AWAITING_FINAL_ACCEPTANCE"
                  ? "Tất cả mốc công việc đã được nghiệm thu hoặc hủy và hoàn tiền mô phỏng. Đang chờ doanh nghiệp xác nhận hoàn tất dự án."
                  : project.finalAcceptanceStatus === "ACCEPTED"
                    ? `Đã xác nhận hoàn tất${project.finalAcceptedAt ? ` lúc ${formatDateTime(project.finalAcceptedAt)}` : ""}.`
                    : project.finalAcceptanceStatus}
              </p>
              {isBusiness &&
                project.finalAcceptanceStatus === "AWAITING_FINAL_ACCEPTANCE" && (
                  <div className="mt-4">
                    <ProjectActionForm
                      action={acceptProjectFinalCompletionAction}
                      buttonLabel="Xác nhận hoàn tất dự án"
                      hiddenFields={{ projectId: project.id }}
                    />
                  </div>
                )}
            </section>
          )}
          {project.status === "AWAITING_PAYMENT" && isBusiness && (
            <section className="rounded-2xl border border-primary/30 bg-card p-5">
              <h2 className="font-semibold">Nạp tiền vào escrow</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Giá trị dự án: {formatCurrency(paymentBreakdown.totalAmount)}
              </p>
              <p className="mt-1 text-sm">
                Phụ phí nền tảng doanh nghiệp ({(businessFeeRate / 100).toFixed(2)}%):{" "}
                {formatCurrency(paymentBreakdown.totalBusinessFee)}
              </p>
              <p className="mt-1 text-sm font-semibold">
                Tổng cần nạp: {formatCurrency(paymentBreakdown.totalDeposit)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Phí sinh viên ({(studentFeeRate / 100).toFixed(2)}%) sẽ được khấu trừ khỏi từng
                Mốc công việc khi giải ngân. Sau khi nạp, điều khoản và tỷ lệ chia không thể chỉnh sửa.
              </p>
              <div className="mt-4">
                <ProjectActionForm
                  action={depositProjectAction}
                  buttonLabel={`Nạp ${formatCurrency(paymentBreakdown.totalDeposit)}`}
                  hiddenFields={{ projectId: project.id }}
                />
              </div>
            </section>
          )}
          {canCancel && (
            <section className="rounded-2xl border border-rose-200 bg-card p-5">
              <h2 className="font-semibold">Hủy dự án</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Chỉ có thể hủy khi đang thỏa thuận hoặc chờ nạp tiền.
              </p>
              <div className="mt-3">
                <ProjectActionForm
                  action={cancelProjectAction}
                  buttonClassName="rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
                  buttonLabel="Hủy dự án"
                  hiddenFields={{ projectId: project.id }}
                />
              </div>
            </section>
          )}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Lịch sử giao dịch</h2>
            {project.transactions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Chưa có giao dịch giả lập.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {project.transactions.map((transaction) => (
                  <li className="border-t border-border pt-3 first:border-0 first:pt-0" key={transaction.id}>
                    {(() => {
                      const transactionUsesLegacyFees =
                        transaction.businessFeeBasisPoints === null ||
                        transaction.studentFeeBasisPoints === null;
                      const releasedMilestone = project.milestones.find(
                        ({ id }) => id === transaction.milestoneId,
                      );
                      return (
                        <>
                          <p className="text-sm font-semibold">
                            {transaction.type === "DEPOSIT"
                              ? "Khoản đặt cọc mô phỏng"
                              : transaction.type === "REFUND"
                                ? `Hoàn tiền mô phỏng${releasedMilestone ? `: ${releasedMilestone.title}` : ""}`
                                : `Giải ngân mốc công việc${releasedMilestone ? `: ${releasedMilestone.title}` : ""}`}
                          </p>
                          {transaction.type === "REFUND" ? (
                            <>
                              <p className="mt-1 text-sm font-semibold">
                                Số tiền hoàn: {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Không hoàn phụ phí doanh nghiệp đã ghi nhận; không phát sinh phí nhóm.
                              </p>
                            </>
                          ) : transactionUsesLegacyFees ? (
                            <>
                              <p className="mt-1 text-sm">
                                {transaction.type === "DEPOSIT" ? "Tổng nạp mô phỏng" : "Phần nhóm nhận"}:{" "}
                                {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Áp dụng phí nền tảng theo luồng cũ: {formatCurrency(transaction.platformFee)}
                              </p>
                            </>
                          ) : transaction.type === "DEPOSIT" ? (
                            <>
                              <p className="mt-1 text-sm">
                                Giá trị dự án: {formatCurrency(project.totalAmount)}
                              </p>
                              <p className="text-sm">
                                Phụ phí doanh nghiệp ({((transaction.businessFeeBasisPoints ?? 0) / 100).toFixed(2)}%):{" "}
                                {formatCurrency(transaction.businessFee ?? 0)}
                              </p>
                              <p className="text-sm font-semibold">
                                Tổng nạp: {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Phí sinh viên ({((transaction.studentFeeBasisPoints ?? 0) / 100).toFixed(2)}%):{" "}
                                {formatCurrency(transaction.platformFee - (transaction.businessFee ?? 0))} ·
                                Tổng phí nền tảng: {formatCurrency(transaction.platformFee)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mt-1 text-sm">
                                Giá trị mốc công việc: {formatCurrency(releasedMilestone?.amount ?? transaction.amount + transaction.platformFee)}
                              </p>
                              <p className="text-sm">
                                Phụ phí doanh nghiệp (đã tính trong khoản nạp):{" "}
                                {formatCurrency(transaction.businessFee ?? 0)} ·
                                Phí sinh viên: {formatCurrency(transaction.platformFee)}
                              </p>
                              <p className="text-sm font-semibold">
                                Nhóm nhận ròng: {formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Tổng phí nền tảng mốc công việc: {formatCurrency(transaction.platformFee + (transaction.businessFee ?? 0))} ·
                                Tỷ lệ chụp lúc nạp: {((transaction.businessFeeBasisPoints ?? 0) / 100).toFixed(2)}% +
                                {((transaction.studentFeeBasisPoints ?? 0) / 100).toFixed(2)}%
                              </p>
                            </>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {transaction.status === "ESCROW"
                              ? "Đang giữ trong escrow giả lập"
                              : transaction.status === "SETTLED"
                                ? "Đã đối soát"
                                : transaction.type === "REFUND"
                                  ? "Đã hoàn trong mô phỏng"
                                  : "Đã ghi nhận"}
                            {transaction.paidAt ? ` · ${formatDateTime(transaction.paidAt)}` : ""}
                          </p>
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {project.status === "COMPLETED" && (
            <>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                Tất cả mốc công việc đã được nghiệm thu hoặc hủy và hoàn tiền mô phỏng. Dự án và bài toán đã hoàn thành.
              </p>
              {reviewState && (
                <ProjectReviewSection
                  direction={isBusiness ? "BUSINESS_TO_TEAM" : "TEAM_TO_BUSINESS"}
                  projectId={project.id}
                  reviewState={reviewState}
                />
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
