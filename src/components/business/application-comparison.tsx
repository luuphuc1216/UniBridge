"use client";

import { useActionState } from "react";
import { selectTeamAction, type ProblemActionState } from "@/app/business/problems/actions";

type ApplicationCardData = {
  id: string;
  approach: string;
  problemUnderstanding: string;
  solutionDirection: string;
  methodology: string;
  keySteps: string;
  tools: string;
  resources: string;
  estimatedDuration: string;
  proposedBudget: number | null;
  status: string;
  team: {
    name: string;
    university: string;
    description: string;
    experience: string;
    relevantProducts: string;
    achievements: string;
    interests: string;
    ratingAverage: number;
    ratingCount: number;
    skills: string[];
    members: { name: string; major: string }[];
    projects: { title: string }[];
  };
};

type ApplicationComparisonProps = {
  problemId: string;
  applications: ApplicationCardData[];
  problemSkills: string[];
  problemStatus: string;
};

function formatCurrency(amount: number | null): string {
  return amount === null
    ? "Chưa đề xuất"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
}

function SelectTeamForm({
  problemId,
  applicationId,
}: {
  problemId: string;
  applicationId: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ProblemActionState,
    FormData
  >(selectTeamAction, { error: null });

  return (
    <form action={formAction} className="mt-5 border-t border-border pt-4">
      <input name="problemId" type="hidden" value={problemId} />
      <input name="applicationId" type="hidden" value={applicationId} />
      {state.error && (
        <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Đang chọn..." : "Chọn nhóm"}
      </button>
    </form>
  );
}

export function ApplicationComparison({
  problemId,
  applications,
  problemSkills,
  problemStatus,
}: ApplicationComparisonProps) {
  const canSelect = ["APPROVED", "PUBLISHED"].includes(problemStatus);

  if (applications.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <h2 className="font-semibold">Chưa có nhóm ứng tuyển</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hồ sơ ứng tuyển sẽ xuất hiện tại đây khi có nhóm quan tâm bài toán.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {applications.map((application) => {
        const matchedSkills = application.team.skills.filter((skill) =>
          problemSkills.includes(skill),
        );
        const approachDetails = [
          ["Cách nhóm hiểu vấn đề", application.problemUnderstanding],
          ["Hướng giải quyết", application.solutionDirection],
          ["Phương pháp thực hiện", application.methodology],
          ["Các bước chính", application.keySteps],
          ["Công cụ hoặc công nghệ", application.tools],
          ["Nguồn lực cần thiết", application.resources],
        ];
        const hasStructuredApproach = approachDetails.some(([, value]) => value);
        return (
          <article
            className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
            key={application.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{application.team.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {application.team.university}
                </p>
                {application.status !== "SUBMITTED" && (
                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      application.status === "SELECTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {application.status === "SELECTED" ? "Đã được chọn" : "Đã từ chối"}
                  </span>
                )}
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {application.team.ratingAverage.toFixed(1)} / 5 ·{" "}
                {application.team.ratingCount} đánh giá
              </span>
            </div>
            <p className="mt-4 text-sm leading-6">{application.team.description}</p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kỹ năng phù hợp
                </dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {matchedSkills.length
                    ? matchedSkills.map((skill) => (
                        <span
                          className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                          key={skill}
                        >
                          {skill}
                        </span>
                      ))
                    : "Chưa trùng kỹ năng yêu cầu"}
                </dd>
                <p className="mt-2 text-xs text-muted-foreground">
                  Kỹ năng khác: {application.team.skills.join(", ") || "Chưa cập nhật"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chuyên môn thành viên
                </dt>
                <dd className="mt-2 text-sm">
                  {application.team.members.length > 0
                    ? application.team.members.map(({ name, major }) => `${name} — ${major}`).join(", ")
                    : "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kinh nghiệm
                </dt>
                <dd className="mt-2 text-sm">
                  {application.team.experience || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sản phẩm liên quan
                </dt>
                <dd className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {application.team.relevantProducts || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Thành tích và chứng chỉ
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm">
                  {application.team.achievements || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lĩnh vực quan tâm
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm">
                  {application.team.interests || "Chưa cập nhật"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dự án đã hoàn thành trên nền tảng
                </dt>
                <dd className="mt-2 text-sm">
                  {application.team.projects.map(({ title }) => title).join(", ") ||
                    "Chưa có"}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Thời gian dự kiến
                </dt>
                <dd className="mt-2 text-sm">{application.estimatedDuration}</dd>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chi phí đề xuất
                </dt>
                <dd className="mt-2 text-sm font-semibold">
                  {formatCurrency(application.proposedBudget)}
                </dd>
              </div>
            </dl>
            <section className="mt-5 rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold">Approach</h3>
              {hasStructuredApproach ? (
                <dl className="mt-3 grid gap-4">
                  {approachDetails.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {value || "Chưa cập nhật"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {application.approach || "Chưa cập nhật Approach"}
                </p>
              )}
            </section>
            {canSelect && application.status === "SUBMITTED" ? (
              <SelectTeamForm
                applicationId={application.id}
                problemId={problemId}
              />
            ) : (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Bài toán đã chọn nhóm hoặc không còn nhận lựa chọn.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
