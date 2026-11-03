import { notFound } from "next/navigation";
import { ProjectActionForm } from "@/components/projects/project-action-form";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import {
  addProjectSupportNoteAction,
  resolveProjectDisputeForAdminAction,
} from "@/app/projects/actions";
import { findAccessibleProject } from "@/lib/project-access";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const instant = false;

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
  const openDisputes = project.changeRequests.filter(
    ({ kind, status }) => kind === "DISPUTE" && status === "OPEN",
  );

  return (
    <>
      <ProjectDetailView
        applicationId={project.applicationId}
        project={project}
        reviewState={null}
        role="ADMIN"
      />
      <section className="mx-auto mb-10 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Hỗ trợ quản trị</h2>
          <p className="mt-1 text-sm text-amber-900">
            Admin có thể ghi nhận hướng hỗ trợ trung lập, không kết luận bên nào có lỗi và không phân bổ tiền.
          </p>
          <div className="mt-4">
            <ProjectActionForm
              action={addProjectSupportNoteAction}
              buttonLabel="Lưu ghi chú"
              hiddenFields={{ projectId }}
            >
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                maxLength={4000}
                name="note"
                placeholder="Ghi nhận nội dung hỗ trợ khách quan"
                required
              />
            </ProjectActionForm>
          </div>
        </div>
        {openDisputes.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-card p-5">
            <h2 className="font-semibold">Hỗ trợ bất đồng đang mở</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tiếp tục chỉ khôi phục trạng thái mốc trước bất đồng; hướng dẫn hủy/chấm dứt không tự hoàn tiền.
            </p>
            <ul className="mt-4 space-y-4">
              {openDisputes.map((dispute) => (
                <li className="rounded-xl border border-border p-4" key={dispute.id}>
                  <p className="font-medium">
                    {dispute.milestone?.title ?? "Milestone"} · {dispute.reason}
                  </p>
                  <div className="mt-3">
                    <ProjectActionForm
                      action={resolveProjectDisputeForAdminAction}
                      buttonLabel="Lưu hướng hỗ trợ"
                      hiddenFields={{ projectId, disputeRequestId: dispute.id }}
                    >
                      <select
                        className="w-full rounded-lg border border-border bg-background px-3 py-2"
                        name="outcome"
                        required
                      >
                        <option value="RESUME_WORK">Tiếp tục thực hiện</option>
                        <option value="GUIDE_TERMINATION">
                          Hướng dẫn hai bên tạo yêu cầu hủy mốc/chấm dứt
                        </option>
                      </select>
                      <textarea
                        className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                        maxLength={4000}
                        name="reason"
                        placeholder="Ghi rõ lý do hỗ trợ trung lập"
                        required
                      />
                    </ProjectActionForm>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Lịch sử ghi chú hỗ trợ</h2>
          {supportNotes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Chưa có ghi chú hỗ trợ.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {supportNotes.map((supportNote) => (
                <li className="border-t border-border pt-3 first:border-0 first:pt-0" key={supportNote.id}>
                  <p className="whitespace-pre-wrap text-sm">{supportNote.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {supportNote.admin.name ?? "Admin"} · {supportNote.createdAt.toLocaleString("vi-VN")}
                    {supportNote.milestone ? ` · ${supportNote.milestone.title}` : ""}
                    {supportNote.changeRequest ? ` · ${supportNote.changeRequest.kind}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
