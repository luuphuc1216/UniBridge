import { AlertTriangle, FileText, HandHelping, History } from "lucide-react";
import { notFound } from "next/navigation";
import {
  addProjectSupportNoteAction,
  resolveProjectDisputeForAdminAction,
} from "@/app/projects/actions";
import { ProjectActionForm } from "@/components/projects/project-action-form";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { findAccessibleProject } from "@/lib/project-access";
import { getProjectChangeRequestStatusLabel } from "@/lib/project-change-requests";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

const projectStatusLabels: Record<string, string> = {
  AGREEING: "Đang thỏa thuận",
  AWAITING_PAYMENT: "Chờ nạp tiền",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

const changeKindLabels: Record<string, string> = {
  DISPUTE: "Bất đồng Milestone",
  PROJECT_TERMINATION: "Yêu cầu chấm dứt dự án",
  MILESTONE_CANCEL: "Yêu cầu hủy Milestone",
};

function getRequestStatusVariant(status: string) {
  if (status === "OPEN") return "warning" as const;
  if (status === "ACCEPTED" || status === "RESOLVED") return "success" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { userId } = await requireAdmin();
  const { projectId } = await params;
  const project = await findAccessibleProject(projectId, userId, "ADMIN");
  if (!project) notFound();
  const supportNotes = await prisma.projectSupportNote.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      admin: { select: { name: true } },
      milestone: { select: { title: true } },
      changeRequest: { select: { kind: true } },
    },
  });
  const supportRequests = project.changeRequests.filter(({ kind }) =>
    ["DISPUTE", "PROJECT_TERMINATION", "MILESTONE_CANCEL"].includes(kind),
  );

  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-4 pb-5 pt-7 sm:px-6 sm:pt-9">
        <p className="text-sm font-semibold text-primary">Khu vực quản trị</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Hỗ trợ dự án
            </h1>
            <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
              Theo dõi thỏa thuận, Milestone, giao dịch và các yêu cầu hỗ trợ đã phát sinh.
            </p>
          </div>
          <Badge className="w-fit shrink-0" variant="outline">
            {projectStatusLabels[project.status] ?? project.status}
          </Badge>
        </div>
        <Card className="mt-5 grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dự án
            </p>
            <p className="mt-1 break-words font-semibold">{project.title}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              Mã dự án: {project.id}
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Doanh nghiệp
              </p>
              <p className="mt-1 break-words font-medium">
                {project.application.problem.businessProfile.companyName}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nhóm sinh viên
              </p>
              <p className="mt-1 break-words font-medium">{project.team.name}</p>
            </div>
          </div>
        </Card>
      </header>

      <ProjectDetailView
        applicationId={project.applicationId}
        project={project}
        reviewState={null}
        role="ADMIN"
      />

      <section
        aria-labelledby="admin-project-support-heading"
        className="mx-auto mb-10 grid w-full max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]"
      >
        <div className="grid min-w-0 gap-5">
          <Card className="min-w-0 border-primary/20 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <HandHelping
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2
                  className="text-lg font-semibold"
                  id="admin-project-support-heading"
                >
                  Ghi nhận hỗ trợ quản trị
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Admin hỗ trợ quy trình một cách trung lập, không kết luận bên nào có lỗi,
                  không tự phân bổ tiền và không thực hiện hoàn tiền.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <ProjectActionForm
                action={addProjectSupportNoteAction}
                buttonClassName="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:transition-none"
                buttonLabel="Lưu ghi chú hỗ trợ"
                hiddenFields={{ projectId }}
              >
                <label
                  className="block text-sm font-semibold"
                  htmlFor="admin-project-support-note"
                >
                  Ghi chú khách quan
                </label>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="admin-project-support-note"
                  maxLength={4000}
                  name="note"
                  placeholder="Ghi nhận nội dung hỗ trợ khách quan"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Tối đa 4.000 ký tự.
                </p>
              </ProjectActionForm>
            </div>
          </Card>

          <Card className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <History
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2 className="text-lg font-semibold">Lịch sử ghi chú hỗ trợ</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Các ghi chú đã được lưu cho dự án này.
                </p>
              </div>
            </div>
            {supportNotes.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Chưa có ghi chú hỗ trợ.
              </p>
            ) : (
              <ol className="mt-4 divide-y divide-border">
                {supportNotes.map((supportNote) => (
                  <li className="min-w-0 py-4 first:pt-0 last:pb-0" key={supportNote.id}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                      {supportNote.note}
                    </p>
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      {supportNote.admin.name ?? "Admin"} ·{" "}
                      <time dateTime={supportNote.createdAt.toISOString()}>
                        {new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(supportNote.createdAt)}
                      </time>
                      {supportNote.milestone
                        ? ` · ${supportNote.milestone.title}`
                        : ""}
                      {supportNote.changeRequest
                        ? ` · ${supportNote.changeRequest.kind}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <section className="rounded-2xl border border-warning/40 bg-warning/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
              />
              <div>
                <h2 className="font-semibold">Giới hạn hỗ trợ</h2>
                <p className="mt-2 text-sm leading-6">
                  Admin chỉ hướng dẫn quy trình và ghi nhận hỗ trợ. Không tự quyết định tranh chấp,
                  thay đổi giao dịch, phân bổ tiền hoặc hoàn tiền.
                </p>
              </div>
            </div>
          </section>

          <Card className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <FileText
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2 className="text-lg font-semibold">
                  Bất đồng và yêu cầu chấm dứt
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Trạng thái chỉ phản ánh dữ liệu yêu cầu hiện có; Admin không tự thay mặt các bên đưa ra quyết định.
                </p>
              </div>
            </div>

            {supportRequests.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Chưa có bất đồng hoặc yêu cầu chấm dứt liên quan được ghi nhận.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {supportRequests.map((request) => (
                  <li
                    className="min-w-0 rounded-xl border border-border bg-background p-4"
                    key={request.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {changeKindLabels[request.kind] ?? request.kind}
                      </p>
                      <Badge variant={getRequestStatusVariant(request.status)}>
                        {getProjectChangeRequestStatusLabel(
                          request.kind,
                          request.status,
                        )}
                      </Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {request.milestone?.title
                        ? `${request.milestone.title} · `
                        : ""}
                      {request.reason}
                    </p>
                    <time
                      className="mt-2 block text-xs text-muted-foreground"
                      dateTime={request.createdAt.toISOString()}
                    >
                      Gửi lúc{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(request.createdAt)}
                    </time>

                    {request.kind === "DISPUTE" && request.status === "OPEN" && (
                      <div className="mt-4 border-t border-border pt-4">
                        <p className="mb-3 text-sm font-medium">
                          Chọn hướng hỗ trợ theo quy trình hiện có.
                        </p>
                        <ProjectActionForm
                          action={resolveProjectDisputeForAdminAction}
                          buttonClassName="min-h-11 rounded-xl border border-primary/30 bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:transition-none"
                          buttonLabel="Lưu hướng hỗ trợ"
                          hiddenFields={{
                            projectId,
                            disputeRequestId: request.id,
                          }}
                        >
                          <label
                            className="block text-sm font-semibold"
                            htmlFor={`dispute-outcome-${request.id}`}
                          >
                            Hướng xử lý
                          </label>
                          <select
                            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            id={`dispute-outcome-${request.id}`}
                            name="outcome"
                            required
                          >
                            <option value="RESUME_WORK">Tiếp tục thực hiện</option>
                            <option value="GUIDE_TERMINATION">
                              Hướng dẫn hai bên tạo yêu cầu hủy mốc/chấm dứt
                            </option>
                          </select>
                          <label
                            className="block text-sm font-semibold"
                            htmlFor={`dispute-reason-${request.id}`}
                          >
                            Lý do hỗ trợ trung lập
                          </label>
                          <textarea
                            className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            id={`dispute-reason-${request.id}`}
                            maxLength={4000}
                            name="reason"
                            placeholder="Ghi rõ lý do hỗ trợ trung lập"
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Tối đa 4.000 ký tự.
                          </p>
                        </ProjectActionForm>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </section>
    </>
  );
}
