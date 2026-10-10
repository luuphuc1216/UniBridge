import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireBusinessProfile() {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }
  if (session.user.role !== "BUSINESS") {
    redirect("/business");
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    throw new Error("Tài khoản doanh nghiệp chưa có hồ sơ doanh nghiệp.");
  }

  return { userId: session.user.id, businessProfileId: profile.id };
}
