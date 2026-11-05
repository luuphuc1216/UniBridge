import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { ProjectListView } from "@/components/projects/project-list-view";
import { prisma } from "@/lib/prisma";

export const instant = false;
export const metadata = {
  title: "Dự án triển khai có phí | UniBridge",
};

export default async function BusinessProjectsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BUSINESS") notFound();
  const projects = await prisma.project.findMany({
    where: { application: { problem: { businessProfile: { userId: session.user.id } } } },
    orderBy: { updatedAt: "desc" },
    include: {
      application: {
        select: {
          problem: { select: { businessProfile: { select: { companyName: true } } } },
        },
      },
      team: { select: { name: true } },
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
  return (
    <ProjectListView
      projects={projects.map((project) => ({
        ...project,
        teamName: project.team.name,
        businessName: project.application.problem.businessProfile.companyName,
      }))}
      role="BUSINESS"
    />
  );
}
