import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectListView } from "@/components/projects/project-list-view";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function StudentProjectsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") notFound();
  const projects = await prisma.project.findMany({
    where: {
      team: {
        OR: [
          { ownerId: session.user.id },
          { memberships: { some: { studentProfile: { userId: session.user.id } } } },
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      application: { include: { problem: { select: { title: true } } } },
      transactions: { select: { type: true, amount: true, platformFee: true } },
    },
  });
  return <ProjectListView projects={projects} role="STUDENT" />;
}
