import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadWorkspaceMessageCount } from "@/lib/workspace-messages";

export const instant = false;

export default async function BusinessMessagesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") return null;
  const applications = await prisma.application.findMany({
    where: { problem: { businessProfile: { userId: session.user.id } }, status: { in: ["PENDING_CONFIRMATION", "SELECTED"] } },
    include: { problem: { select: { id: true, title: true } }, team: { select: { name: true } }, workspaceMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  const unread = await getUnreadWorkspaceMessageCount(session.user.id, "BUSINESS");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight">Tin nhắn</h1>
      <p className="mt-2 text-sm text-muted-foreground">{unread} tin chưa đọc</p>
      <div className="mt-6 grid gap-3">
        {applications.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Chưa có cuộc trò chuyện.</p> : applications.map((application) => (
          <Link className="rounded-2xl border border-border bg-card p-5 hover:border-primary" href={`/business/problems/${application.problem.id}/workspace?applicationId=${application.id}`} key={application.id}>
            <p className="font-semibold">{application.team.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{application.problem.title}</p>
            <p className="mt-3 line-clamp-1 text-sm">{application.workspaceMessages[0]?.content ?? "Chưa có tin nhắn"}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
