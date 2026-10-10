import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRoleHome } from "@/lib/roles";

const routeRoles = [
  { prefix: "/business", role: "BUSINESS" },
  { prefix: "/student", role: "STUDENT" },
  { prefix: "/admin", role: "ADMIN" },
] as const;

export default auth((request) => {
  const requiredRoute = routeRoles.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!requiredRoute) {
    return NextResponse.next();
  }

  const user = request.auth?.user;
  if (!user) {
    const signInUrl = new URL("/dang-nhap", request.nextUrl);
    signInUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signInUrl);
  }

  if (user.role !== requiredRoute.role) {
    return NextResponse.redirect(
      new URL(getRoleHome(user.role), request.nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/business/:path*", "/student/:path*", "/admin/:path*"],
};
