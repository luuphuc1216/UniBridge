import { RecommendedProblems } from "@/components/student/recommended-problems";
import { requireStudent } from "@/lib/student-access";
import { getStudentRecommendations } from "@/lib/student-recommendations";
import { prisma } from "@/lib/prisma";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";
import { BriefcaseBusiness, FileClock, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const instant = false;

export default async function StudentDashboard() {
  const { userId } = await requireStudent();
  const { hasTeam, recommendations } = await getStudentRecommendations(userId);
  const [unreadMessages, pendingApplications, selectedProjects] = await Promise.all([
    getUnreadWorkspaceMessageCount(userId, "STUDENT"),
    prisma.application.count({ where: { team: { OR: [{ ownerId: userId }, { memberships: { some: { studentProfile: { userId } } } }] }, status: "PENDING_CONFIRMATION" } }),
    prisma.project.count({ where: { team: { OR: [{ ownerId: userId }, { memberships: { some: { studentProfile: { userId } } } }] }, status: { in: ["AGREEING", "AWAITING_PAYMENT", "IN_PROGRESS"] } } }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary">
            KHÔNG GIAN SINH VIÊN
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Tổng quan
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Theo dõi hồ sơ nhóm, cơ hội hợp tác và các dự án đang thực hiện.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className={cn(buttonVariants(), "w-full motion-reduce:transition-none sm:w-auto")}
            href="/student/problems"
          >
            Khám phá bài toán
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "w-full motion-reduce:transition-none sm:w-auto")}
            href="/student/team"
          >
            Hồ sơ nhóm
          </Link>
        </div>
      </header>

      <section aria-label="Số liệu tổng quan" className="mt-6 sm:mt-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            aria-label={`Hồ sơ đang chờ phản hồi: ${pendingApplications}`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            href="/student/applications"
          >
            <Card className="h-full p-5 transition-[border-color,box-shadow] duration-200 group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:border-primary motion-reduce:transition-none sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileClock aria-hidden="true" className="size-5" />
                </span>
                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {pendingApplications}
                </span>
              </div>
              <p className="mt-5 text-sm font-medium leading-5 text-muted-foreground">
                Hồ sơ đang chờ phản hồi
              </p>
            </Card>
          </Link>

          <Link
            aria-label={`Dự án đang thực hiện: ${selectedProjects}`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            href="/student/projects"
          >
            <Card className="h-full p-5 transition-[border-color,box-shadow] duration-200 group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:border-primary motion-reduce:transition-none sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BriefcaseBusiness aria-hidden="true" className="size-5" />
                </span>
                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {selectedProjects}
                </span>
              </div>
              <p className="mt-5 text-sm font-medium leading-5 text-muted-foreground">
                Dự án đang thực hiện
              </p>
            </Card>
          </Link>

          <Link
            aria-label={`Tin nhắn chưa đọc: ${unreadMessages}`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            href="/student/messages"
          >
            <Card className="h-full p-5 transition-[border-color,box-shadow] duration-200 group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:border-primary motion-reduce:transition-none sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle aria-hidden="true" className="size-5" />
                </span>
                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {unreadMessages}
                </span>
              </div>
              <p className="mt-5 text-sm font-medium leading-5 text-muted-foreground">
                Tin nhắn chưa đọc
              </p>
            </Card>
          </Link>
        </div>
      </section>

      <RecommendedProblems hasTeam={hasTeam} problems={recommendations} />
    </main>
  );
}
