import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleHome } from "@/lib/roles";

export async function requireStudent() {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }
  if (session.user.role !== "STUDENT") {
    redirect(getRoleHome(session.user.role));
  }

  return { userId: session.user.id };
}
