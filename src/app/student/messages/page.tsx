import Link from "next/link";
import { auth } from "@/auth";
import { ArrowRight, MessageCircle, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";

export const instant = false;

export default async function StudentMessagesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") return null;
  const applications = await prisma.application.findMany({
    where: { team: { OR: [{ ownerId: session.user.id }, { memberships: { some: { studentProfile: { userId: session.user.id } } } }] }, status: { in: ["PENDING_CONFIRMATION", "SELECTED"] } },
    include: { problem: { select: { id: true, title: true } }, team: { select: { name: true } }, workspaceMessages: { where: { hiddenByAdmin: false }, orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  const unread = await getUnreadWorkspaceMessageCount(session.user.id, "STUDENT");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">KHÔNG GIAN SINH VIÊN</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tin nhắn</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Trao đổi với doanh nghiệp trong các cuộc trò chuyện gắn với bài toán.
          </p>
        </div>
        <Badge className="w-fit gap-2 px-3 py-2" variant={unread > 0 ? "warning" : "secondary"}>
          <MessageCircle aria-hidden="true" className="size-4" />
          {unread} tin chưa đọc
        </Badge>
      </header>
      {applications.length === 0 ? (
        <EmptyState
          action={
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "motion-reduce:transition-none")}
              href="/student/problems"
            >
              Khám phá bài toán
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          }
          className="mt-7"
          description="Cuộc trò chuyện sẽ xuất hiện khi nhóm có lời mời đang chờ hoặc được chọn cho một bài toán."
          icon={<MessageSquareText aria-hidden="true" className="size-5" />}
          title="Chưa có cuộc trò chuyện"
        />
      ) : (
        <section aria-label="Danh sách cuộc trò chuyện" className="mt-7 grid gap-3">
          {applications.map((application) => {
            const latestMessage = application.workspaceMessages[0];
            return (
              <Link
                aria-label={`Mở cuộc trò chuyện về ${application.problem.title}`}
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                href={`/student/workspace/${application.problem.id}?applicationId=${application.id}`}
                key={application.id}
              >
                <Card className="p-5 transition-[border-color,box-shadow] duration-200 group-hover:border-primary/40 group-hover:shadow-md motion-reduce:transition-none sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{application.team.name}</p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {application.problem.title}
                      </p>
                    </div>
                    <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </div>
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="line-clamp-2 min-w-0 text-sm leading-6 text-muted-foreground">
                      {latestMessage?.content ?? "Chưa có tin nhắn"}
                    </p>
                    {latestMessage && (
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={latestMessage.createdAt.toISOString()}
                      >
                        {new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(latestMessage.createdAt)}
                      </time>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
