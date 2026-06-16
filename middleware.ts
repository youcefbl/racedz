import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole } from "@/types/race";

const organizerRoles: UserRole[] = ["ORGANIZER", "ADMIN", "SUPERADMIN"];
const adminRoles: UserRole[] = ["ADMIN", "SUPERADMIN"];

export default auth((request) => {
  const { nextUrl } = request;
  const role = request.auth?.user?.role;

  if (!request.auth?.user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (nextUrl.pathname.startsWith("/admin") && (!role || !adminRoles.includes(role))) {
    return NextResponse.redirect(new URL("/account", nextUrl));
  }

  if (nextUrl.pathname === "/organizer/request") {
    return NextResponse.next();
  }

  if (nextUrl.pathname.startsWith("/organizer") && (!role || !organizerRoles.includes(role))) {
    return NextResponse.redirect(new URL("/organizer/request", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/account/:path*", "/organizer/:path*", "/admin/:path*"]
};
