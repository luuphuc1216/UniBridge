import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AgreementForm, type AgreementFormValues } from "@/components/projects/agreement-form";
import { canOpenPaidImplementationAgreement } from "@/lib/agreement-access";
import {
  findAuthorizedWorkspace,
} from "@/lib/workspace-access";

export const instant = false;

export default async function BusinessAgreementPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") notFound();
  const { problemId } = await params;
  const problem = await findAuthorizedWorkspace(
    problemId,
    session.user.id,
    session.user.role,
  );
  const application = problem?.applications[0];
  if (!problem || !canOpenPaidImplementationAgreement(problem) || !application) {
    notFound();
  }
  if (application.project) redirect(`/business/projects/${application.project.id}`);

  const initialValues: AgreementFormValues = {
    title: problem.title,
    agreedScope: "",
    deliverables: "",
    duration: "",
    totalAmount: "",
    generalAcceptanceCriteria: "",
    businessResponsibilities: "",
    teamResponsibilities: "",
    paymentMethod: "",
    milestones: [
      {
        title: "",
        description: "",
        acceptanceCriteria: "",
        dueAt: "",
        paymentPercent: 100,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <Link
        className="text-sm font-semibold text-primary hover:underline"
        href={`/business/problems/${problemId}/workspace`}
      >
        ← Không gian làm việc
      </Link>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Soạn thỏa thuận Paid Implementation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bài toán: {problem.title} · Nhóm: {application.team.name}
      </p>
      <aside className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
        Thanh toán giả lập, không phát sinh giao dịch thật.
      </aside>
      <section className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <p className="mb-5 text-sm leading-6 text-muted-foreground">
          Nhóm sẽ xem và đồng ý hoặc đề nghị chỉnh sửa. Mọi thay đổi sau phản hồi đều cần hai bên
          xác nhận lại. Tỷ lệ Milestone phải cộng đúng 100%.
        </p>
        <AgreementForm
          applicationId={application.id}
          initialValues={initialValues}
          problemId={problemId}
        />
      </section>
    </main>
  );
}
