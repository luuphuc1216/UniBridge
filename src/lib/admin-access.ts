import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleHome } from "@/lib/roles";

export function isAdminRole(role: string): boolean {
  return role === "ADMIN";
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }
  if (!isAdminRole(session.user.role)) {
    redirect(getRoleHome(session.user.role));
  }

  return { userId: session.user.id };
}
