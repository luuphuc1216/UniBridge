import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { ProjectListView } from "@/components/projects/project-list-view";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function BusinessProjectsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") notFound();
  const projects = await prisma.project.findMany({
    where: { application: { problem: { businessProfile: { userId: session.user.id } } } },
    orderBy: { updatedAt: "desc" },
    include: {
      application: { include: { problem: { select: { title: true } } } },
      transactions: {
        select: {
          type: true,
          amount: true,
          platformFee: true,
          businessFee: true,
          businessFeeBasisPoints: true,
          studentFeeBasisPoints: true,
        },
      },
    },
  });
  return <ProjectListView projects={projects} role="BUSINESS" />;
}
